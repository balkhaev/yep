import { type Connection, connect, Index, type Table } from "@lancedb/lancedb";
import { getStorePath, getVectorDimensions } from "../lib/config.ts";
import type { SolutionChunk } from "./chunker.ts";

const TABLE_NAME = "solutions";

interface VectorRecord {
	agent: string;
	checkpointId: string;
	contentHash: string;
	diffSummary: string;
	embeddingText: string;
	filesChanged: string;
	id: string;
	prompt: string;
	response: string;
	sessionIndex: number;
	summary: string;
	timestamp: string;
	tokensUsed: number;
	vector: number[];
	[key: string]: unknown;
}

export interface SolutionResult {
	agent: string;
	checkpointId: string;
	diffSummary: string;
	embeddingText: string;
	filesChanged: string;
	id: string;
	prompt: string;
	response: string;
	sessionIndex: number;
	summary: string;
	timestamp: string;
	tokensUsed: number;
}

interface SearchResult {
	chunk: SolutionResult;
	score: number;
}

let cachedConnection: Connection | null = null;

async function getConnection(): Promise<Connection> {
	if (!cachedConnection) {
		cachedConnection = await connect(getStorePath());
	}
	return cachedConnection;
}

let migrated = false;

async function getTable(): Promise<Table> {
	const conn = await getConnection();
	const table = await conn.openTable(TABLE_NAME);
	if (!migrated) {
		await migrateSchema(table);
		migrated = true;
	}
	return table;
}

async function tableExists(): Promise<boolean> {
	const conn = await getConnection();
	const tables = await conn.tableNames();
	return tables.includes(TABLE_NAME);
}

function chunkToRecord(
	chunk: SolutionChunk,
	vector: number[],
	contentHash = ""
): VectorRecord {
	return {
		id: chunk.id,
		checkpointId: chunk.checkpointId,
		sessionIndex: chunk.sessionIndex,
		prompt: chunk.prompt,
		response: chunk.response,
		diffSummary: chunk.diffSummary,
		summary: chunk.summary ?? "",
		agent: chunk.metadata.agent,
		timestamp: chunk.metadata.timestamp,
		filesChanged: chunk.metadata.filesChanged.join(","),
		tokensUsed: chunk.metadata.tokensUsed,
		embeddingText: chunk.embeddingText,
		contentHash,
		vector,
	};
}

function emptyRecord(): VectorRecord {
	return {
		id: "",
		checkpointId: "",
		sessionIndex: 0,
		prompt: "",
		response: "",
		diffSummary: "",
		summary: "",
		agent: "",
		timestamp: "",
		filesChanged: "",
		tokensUsed: 0,
		embeddingText: "",
		contentHash: "",
		vector: new Array(getVectorDimensions()).fill(0) as number[],
	};
}

async function migrateSchema(table: Table): Promise<void> {
	const schema = await table.schema();
	const existingFields = new Set(schema.fields.map((f) => f.name));
	const missing: { name: string; valueSql: string }[] = [];
	if (!existingFields.has("summary")) {
		missing.push({ name: "summary", valueSql: "''" });
	}
	if (!existingFields.has("contentHash")) {
		missing.push({ name: "contentHash", valueSql: "''" });
	}
	if (!existingFields.has("embeddingText")) {
		missing.push({ name: "embeddingText", valueSql: "''" });
	}
	if (missing.length > 0) {
		await table.addColumns(missing);
	}
}

export async function initStore(): Promise<void> {
	const conn = await getConnection();
	if (await tableExists()) {
		const table = await getTable();
		await migrateSchema(table);
		return;
	}

	const table = await conn.createTable(TABLE_NAME, [emptyRecord()]);
	await table.delete('id = ""');
	await createFtsIndex(table);
}

async function createFtsIndex(table: Table): Promise<void> {
	try {
		await table.createIndex("embeddingText", {
			config: Index.fts(),
		});
	} catch {
		// FTS index creation may fail on empty tables or unsupported versions
	}
}

export async function ensureFtsIndex(): Promise<void> {
	if (!(await tableExists())) {
		return;
	}
	const table = await getTable();
	await createFtsIndex(table);
}

export async function insertChunks(
	chunks: SolutionChunk[],
	vectors: number[][],
	contentHash = ""
): Promise<number> {
	if (chunks.length === 0) {
		return 0;
	}

	if (!(await tableExists())) {
		await initStore();
	}

	const table = await getTable();
	const records: VectorRecord[] = [];
	for (let i = 0; i < chunks.length; i++) {
		const chunk = chunks[i];
		const vector = vectors[i];
		if (chunk && vector) {
			records.push(chunkToRecord(chunk, vector, contentHash));
		}
	}

	await table.add(records);
	return records.length;
}

export async function upsertChunks(
	chunks: SolutionChunk[],
	vectors: number[][],
	contentHash: string
): Promise<number> {
	if (chunks.length === 0) {
		return 0;
	}

	if (!(await tableExists())) {
		await initStore();
	}

	const table = await getTable();

	const checkpointIds = new Set(chunks.map((c) => c.checkpointId));
	for (const cpId of checkpointIds) {
		try {
			await table.delete(`"checkpointId" = '${escapeSql(cpId)}'`);
		} catch {
			// table may be empty
		}
	}

	const records: VectorRecord[] = [];
	for (let i = 0; i < chunks.length; i++) {
		const chunk = chunks[i];
		const vector = vectors[i];
		if (chunk && vector) {
			records.push(chunkToRecord(chunk, vector, contentHash));
		}
	}

	await table.add(records);
	return records.length;
}

type RankedRow = Record<string, unknown> & { _rrfScore?: number };

function escapeSql(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/'/g, "''").replace(/\0/g, "");
}

function rowToResult(row: Record<string, unknown>): SolutionResult {
	return {
		id: row.id as string,
		checkpointId: row.checkpointId as string,
		sessionIndex: row.sessionIndex as number,
		prompt: row.prompt as string,
		response: row.response as string,
		diffSummary: row.diffSummary as string,
		summary: (row.summary as string) ?? "",
		agent: row.agent as string,
		timestamp: row.timestamp as string,
		filesChanged: row.filesChanged as string,
		tokensUsed: row.tokensUsed as number,
		embeddingText: row.embeddingText as string,
	};
}

function cosineSimilarity(a: number[], b: number[]): number {
	let dot = 0;
	let normA = 0;
	let normB = 0;
	for (let i = 0; i < a.length; i++) {
		const av = a[i] ?? 0;
		const bv = b[i] ?? 0;
		dot += av * bv;
		normA += av * av;
		normB += bv * bv;
	}
	const denom = Math.sqrt(normA) * Math.sqrt(normB);
	return denom === 0 ? 0 : dot / denom;
}

function deduplicateResults(
	results: SearchResult[],
	vectors: number[][],
	threshold = 0.95
): SearchResult[] {
	const kept: SearchResult[] = [];
	const keptVectors: number[][] = [];

	for (let i = 0; i < results.length; i++) {
		const result = results[i];
		const vector = vectors[i];
		if (!(result && vector)) {
			continue;
		}

		let isDuplicate = false;
		for (const kv of keptVectors) {
			if (cosineSimilarity(vector, kv) > threshold) {
				isDuplicate = true;
				break;
			}
		}

		if (!isDuplicate) {
			kept.push(result);
			keptVectors.push(vector);
		}
	}

	return kept;
}

export async function searchSolutions(
	queryVector: number[],
	topK = 3,
	filter?: {
		agent?: string;
		files?: string[];
		queryText?: string;
		minScore?: number;
	}
): Promise<SearchResult[]> {
	if (!(await tableExists())) {
		return [];
	}

	const table = await getTable();
	const fetchK = topK * 3;

	let whereClause: string | undefined;
	if (filter?.agent) {
		whereClause = `agent = '${escapeSql(filter.agent)}'`;
	}
	if (filter?.files && filter.files.length > 0) {
		const fileConditions = filter.files
			.map((f) => `"filesChanged" LIKE '%${escapeSql(f)}%'`)
			.join(" OR ");
		const fileWhere = `(${fileConditions})`;
		whereClause = whereClause ? `${whereClause} AND ${fileWhere}` : fileWhere;
	}

	const vectorResults = await vectorOnlySearch(
		table,
		queryVector,
		fetchK,
		whereClause
	);

	let results: RankedRow[];
	if (filter?.queryText) {
		const ftsResults = await ftsSearch(
			table,
			filter.queryText,
			fetchK,
			whereClause
		);
		results = mergeWithRRF(vectorResults, ftsResults, fetchK);
	} else {
		results = vectorResults.map((row) => ({
			...row,
			_rrfScore: row._distance != null ? 1 - (row._distance as number) : 0,
		}));
	}

	const searchResults: SearchResult[] = results.map((row) => ({
		chunk: rowToResult(row),
		score:
			row._rrfScore ??
			(row._distance != null ? 1 - (row._distance as number) : 0),
	}));

	const resultVectors = results.map((row) => (row.vector as number[]) ?? []);

	const deduped = deduplicateResults(searchResults, resultVectors);

	const minScore = filter?.minScore ?? 0;
	const filtered =
		minScore > 0 ? deduped.filter((r) => r.score >= minScore) : deduped;

	return filtered.slice(0, topK);
}

async function vectorOnlySearch(
	table: Table,
	queryVector: number[],
	limit: number,
	whereClause?: string
): Promise<Record<string, unknown>[]> {
	let query = table.search(queryVector).limit(limit);
	if (whereClause) {
		query = query.where(whereClause);
	}
	return (await query.toArray()) as Record<string, unknown>[];
}

async function ftsSearch(
	table: Table,
	queryText: string,
	limit: number,
	whereClause?: string
): Promise<Record<string, unknown>[]> {
	try {
		let query = table.search(queryText, "fts").limit(limit);
		if (whereClause) {
			query = query.where(whereClause);
		}
		return (await query.toArray()) as Record<string, unknown>[];
	} catch {
		return [];
	}
}

const RRF_K = 60;

function mergeWithRRF(
	vectorResults: Record<string, unknown>[],
	ftsResults: Record<string, unknown>[],
	limit: number
): RankedRow[] {
	const scores = new Map<
		string,
		{ score: number; row: Record<string, unknown> }
	>();

	for (const [rank, row] of vectorResults.entries()) {
		const id = row.id as string;
		const entry = scores.get(id) ?? { score: 0, row };
		entry.score += 1 / (RRF_K + rank + 1);
		entry.row = row;
		scores.set(id, entry);
	}

	for (const [rank, row] of ftsResults.entries()) {
		const id = row.id as string;
		const entry = scores.get(id) ?? { score: 0, row };
		entry.score += 1 / (RRF_K + rank + 1);
		if (!scores.has(id)) {
			entry.row = row;
		}
		scores.set(id, entry);
	}

	return [...scores.values()]
		.sort((a, b) => b.score - a.score)
		.slice(0, limit)
		.map((e) => ({ ...e.row, _rrfScore: e.score }));
}

const RESULT_COLUMNS = [
	"id",
	"checkpointId",
	"sessionIndex",
	"prompt",
	"response",
	"diffSummary",
	"summary",
	"agent",
	"timestamp",
	"filesChanged",
	"tokensUsed",
	"embeddingText",
];

export async function searchByFile(
	file: string,
	limit = 20
): Promise<SolutionResult[]> {
	if (!(await tableExists())) {
		return [];
	}

	const table = await getTable();
	const rows = await table.query().select(RESULT_COLUMNS).limit(500).toArray();

	const needle = file.toLowerCase();
	const matched = rows.filter((row) => {
		const files = String(row.filesChanged ?? "").toLowerCase();
		return files.includes(needle);
	});

	return matched
		.slice(0, limit)
		.map((row) => rowToResult(row as Record<string, unknown>));
}

export async function getIndexedChunkIds(): Promise<Set<string>> {
	if (!(await tableExists())) {
		return new Set();
	}

	const table = await getTable();
	const rows = await table.query().select(["id"]).toArray();
	return new Set(rows.map((r) => r.id as string));
}

export async function getContentHash(
	checkpointId: string
): Promise<string | null> {
	if (!(await tableExists())) {
		return null;
	}

	const table = await getTable();
	const rows = await table
		.query()
		.where(`"checkpointId" = '${escapeSql(checkpointId)}'`)
		.select(["contentHash"])
		.limit(1)
		.toArray();

	if (rows.length === 0) {
		return null;
	}
	return (rows[0]?.contentHash as string) || null;
}

export async function getStats(): Promise<{
	totalChunks: number;
	hasTable: boolean;
	topFiles: string[];
	agents: string[];
}> {
	if (!(await tableExists())) {
		return { totalChunks: 0, hasTable: false, topFiles: [], agents: [] };
	}

	const table = await getTable();
	const count = await table.countRows();

	const rows = await table
		.query()
		.select(["filesChanged", "agent"])
		.limit(500)
		.toArray();

	const fileCounts = new Map<string, number>();
	const agentSet = new Set<string>();
	for (const row of rows) {
		const agent = row.agent as string;
		if (agent) {
			agentSet.add(agent);
		}

		const files = (row.filesChanged as string)?.split(",") ?? [];
		for (const f of files) {
			const trimmed = f.trim();
			if (trimmed) {
				fileCounts.set(trimmed, (fileCounts.get(trimmed) ?? 0) + 1);
			}
		}
	}

	const topFiles = [...fileCounts.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10)
		.map(([f]) => f);

	return {
		totalChunks: count,
		hasTable: true,
		topFiles,
		agents: [...agentSet],
	};
}

export async function dropTable(): Promise<boolean> {
	if (!(await tableExists())) {
		return false;
	}

	const conn = await getConnection();
	await conn.dropTable(TABLE_NAME);
	return true;
}
