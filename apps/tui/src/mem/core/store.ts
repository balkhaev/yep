import { type Connection, connect, Index, type Table } from "@lancedb/lancedb";
import { getStorePath, getVectorDimensions } from "../lib/config.ts";
import { createLogger } from "../lib/logger.ts";
import { escapeSql } from "../lib/sql.ts";
import type { SolutionChunk } from "./chunker.ts";

const log = createLogger("store");

const TABLE_NAME = "solutions";

interface VectorRecord {
	agent: string;
	checkpointId: string;
	confidence: number;
	contentHash: string;
	diffSummary: string;
	embeddingText: string;
	filesChanged: string;
	id: string;
	language: string;
	prompt: string;
	response: string;
	scope: string;
	sessionIndex: number;
	source: string;
	summary: string;
	symbols: string;
	timestamp: string;
	tokensUsed: number;
	vector: number[];
	version: number;
	[key: string]: unknown;
}

export interface SolutionResult {
	agent: string;
	checkpointId: string;
	confidence: number;
	diffSummary: string;
	embeddingText: string;
	filesChanged: string;
	id: string;
	language: string;
	prompt: string;
	response: string;
	scope: string;
	sessionIndex: number;
	source: string;
	summary: string;
	symbols: string;
	timestamp: string;
	tokensUsed: number;
	version: number;
}

export interface SearchResult {
	chunk: SolutionResult;
	score: number;
}

let cachedConnection: Connection | null = null;

export async function getConnection(): Promise<Connection> {
	if (!cachedConnection) {
		cachedConnection = await connect(getStorePath());
	}
	return cachedConnection;
}

let tablePromise: Promise<Table> | null = null;

function getTable(): Promise<Table> {
	if (!tablePromise) {
		tablePromise = (async () => {
			const conn = await getConnection();
			const table = await conn.openTable(TABLE_NAME);
			await migrateSchema(table);
			return table;
		})();
	}
	return tablePromise;
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
		source: chunk.metadata.source ?? "transcript",
		confidence: chunk.metadata.confidence ?? 0.7,
		scope: chunk.metadata.scope ?? "",
		version: chunk.metadata.version ?? 1,
		language: chunk.metadata.language ?? "",
		symbols: chunk.metadata.symbols?.join(",") ?? "",
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
		source: "transcript",
		confidence: 0,
		scope: "",
		version: 0,
		language: "",
		symbols: "",
		vector: new Array(getVectorDimensions()).fill(0) as number[],
	};
}

const MIGRATION_COLUMNS: Array<{ name: string; valueSql: string }> = [
	{ name: "summary", valueSql: "''" },
	{ name: "contentHash", valueSql: "''" },
	{ name: "embeddingText", valueSql: "''" },
	{ name: "source", valueSql: "'transcript'" },
	{ name: "confidence", valueSql: "0.7" },
	{ name: "scope", valueSql: "''" },
	{ name: "version", valueSql: "1" },
	{ name: "language", valueSql: "''" },
	{ name: "symbols", valueSql: "''" },
];

async function migrateSchema(table: Table): Promise<void> {
	try {
		const schema = await table.schema();
		const existingFields = new Set(schema.fields.map((f) => f.name));
		const missing = MIGRATION_COLUMNS.filter(
			(col) => !existingFields.has(col.name)
		);
		if (missing.length > 0) {
			await table.addColumns(missing);
		}
	} catch (err) {
		log.warn("Schema migration failed", { error: String(err) });
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
	} catch (err) {
		log.debug("FTS index creation skipped", { error: String(err) });
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
		} catch (err) {
			log.warn("Delete checkpoint failed", {
				checkpointId: cpId,
				error: String(err),
			});
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
		source: (row.source as string) ?? "transcript",
		confidence: (row.confidence as number) ?? 0.7,
		scope: (row.scope as string) ?? "",
		version: (row.version as number) ?? 1,
		language: (row.language as string) ?? "",
		symbols: (row.symbols as string) ?? "",
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

export interface SearchFilter {
	agent?: string;
	files?: string[];
	minScore?: number;
	queryText?: string;
	rerank?: boolean;
}

const RECENCY_HALF_LIFE_DAYS = 14;

function computeRecencyBoost(timestamp: string): number {
	if (!timestamp) {
		return 0;
	}
	const ts = new Date(timestamp).getTime();
	if (Number.isNaN(ts)) {
		return 0;
	}
	const ageDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
	return Math.exp((-Math.LN2 * ageDays) / RECENCY_HALF_LIFE_DAYS);
}

function computeFileOverlap(
	filesChanged: string,
	filterFiles: string[]
): number {
	if (filterFiles.length === 0 || !filesChanged) {
		return 0;
	}
	const stored = filesChanged.toLowerCase();
	let matches = 0;
	for (const f of filterFiles) {
		if (stored.includes(f.toLowerCase())) {
			matches++;
		}
	}
	return matches / filterFiles.length;
}

const TOKEN_SPLIT_RE = /[\s/.,;:!?()[\]{}<>'"=+\-*&#@|\\`~^]+/;

function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.split(TOKEN_SPLIT_RE)
		.filter((t) => t.length > 2);
}

function computeKeywordDensity(
	queryText: string,
	prompt: string,
	summary: string,
	embeddingText: string
): number {
	const queryTokens = tokenize(queryText);
	if (queryTokens.length === 0) {
		return 0;
	}
	const haystack = `${prompt} ${summary} ${embeddingText}`.toLowerCase();
	let hits = 0;
	for (const token of queryTokens) {
		if (haystack.includes(token)) {
			hits++;
		}
	}
	return hits / queryTokens.length;
}

const ALPHA_START_RE = /^[A-Za-z]/;
const SYMBOL_PATTERN =
	/(?:function|class|interface|type|const|let|var|export)\s+(\w{3,})/g;

function computeSymbolMatch(queryText: string, embeddingText: string): number {
	const querySymbols = new Set<string>();
	for (const m of queryText.matchAll(SYMBOL_PATTERN)) {
		if (m[1]) {
			querySymbols.add(m[1].toLowerCase());
		}
	}
	const freeformNames = tokenize(queryText).filter(
		(t) => t.length >= 4 && ALPHA_START_RE.test(t)
	);
	for (const n of freeformNames) {
		querySymbols.add(n.toLowerCase());
	}
	if (querySymbols.size === 0) {
		return 0;
	}

	const textLower = embeddingText.toLowerCase();
	let hits = 0;
	for (const sym of querySymbols) {
		if (textLower.includes(sym)) {
			hits++;
		}
	}
	return hits / querySymbols.size;
}

const RERANK_WEIGHTS = {
	recency: 0.15,
	fileOverlap: 0.25,
	keywordDensity: 0.35,
	symbolMatch: 0.25,
};

function rerankResults(
	results: SearchResult[],
	queryText: string,
	filterFiles: string[]
): SearchResult[] {
	return results
		.map((r) => {
			const recency = computeRecencyBoost(r.chunk.timestamp);
			const fileOverlap = computeFileOverlap(r.chunk.filesChanged, filterFiles);
			const keywords = computeKeywordDensity(
				queryText,
				r.chunk.prompt,
				r.chunk.summary,
				r.chunk.embeddingText
			);
			const symbols = computeSymbolMatch(queryText, r.chunk.embeddingText);

			const boost =
				RERANK_WEIGHTS.recency * recency +
				RERANK_WEIGHTS.fileOverlap * fileOverlap +
				RERANK_WEIGHTS.keywordDensity * keywords +
				RERANK_WEIGHTS.symbolMatch * symbols;

			return { ...r, score: r.score * (1 + boost) };
		})
		.sort((a, b) => b.score - a.score);
}

export async function searchSolutions(
	queryVector: number[],
	topK = 3,
	filter?: SearchFilter
): Promise<SearchResult[]> {
	if (!(await tableExists())) {
		return [];
	}

	const table = await getTable();
	const fetchK = Math.max(topK * 5, 50);

	let whereClause: string | undefined;
	if (filter?.agent) {
		whereClause = `agent = '${escapeSql(filter.agent)}'`;
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

	if (filter?.files && filter.files.length > 0) {
		const needles = filter.files.map((f) => f.toLowerCase());
		results = results.filter((row) => {
			const fc = (row.filesChanged as string)?.toLowerCase() ?? "";
			return needles.some((n) => fc.includes(n));
		});
	}

	const searchResults: SearchResult[] = results.map((row) => ({
		chunk: rowToResult(row),
		score:
			row._rrfScore ??
			(row._distance != null ? 1 - (row._distance as number) : 0),
	}));

	const resultVectors = results.map((row) => (row.vector as number[]) ?? []);
	const deduped = deduplicateResults(searchResults, resultVectors);

	const shouldRerank = filter?.rerank !== false;
	const ranked =
		shouldRerank && filter?.queryText
			? rerankResults(deduped, filter.queryText, filter.files ?? [])
			: deduped;

	const minScore = filter?.minScore ?? 0;
	const filtered =
		minScore > 0 ? ranked.filter((r) => r.score >= minScore) : ranked;

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
	} catch (err) {
		log.debug("FTS search failed, falling back to vector-only", {
			error: String(err),
		});
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

export async function vectorOnlySearchSolutions(
	queryVector: number[],
	topK = 3,
	whereClause?: string
): Promise<SearchResult[]> {
	if (!(await tableExists())) {
		return [];
	}
	const table = await getTable();
	const rows = await vectorOnlySearch(table, queryVector, topK, whereClause);
	return rows.map((row) => ({
		chunk: rowToResult(row),
		score: row._distance != null ? 1 - (row._distance as number) : 0,
	}));
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
	"source",
	"confidence",
	"scope",
	"version",
	"language",
	"symbols",
];

export async function searchByFile(
	file: string,
	limit = 20
): Promise<SolutionResult[]> {
	if (!(await tableExists())) {
		return [];
	}

	const table = await getTable();
	const needle = file.toLowerCase();
	const rows = await table.query().select(RESULT_COLUMNS).limit(5000).toArray();

	return (rows as Record<string, unknown>[])
		.filter((r) => {
			const fc = r.filesChanged as string | undefined;
			return fc?.toLowerCase().includes(needle);
		})
		.slice(0, limit)
		.map(rowToResult);
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
	topFiles: Array<{ file: string; count: number }>;
	agents: string[];
}> {
	if (!(await tableExists())) {
		return { totalChunks: 0, hasTable: false, topFiles: [], agents: [] };
	}

	const table = await getTable();
	const count = Number(await table.countRows());

	const rows = await table
		.query()
		.select(["filesChanged", "agent"])
		.limit(5000)
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
		.map(([file, count]) => ({ file, count }));

	return {
		totalChunks: count,
		hasTable: true,
		topFiles,
		agents: [...agentSet],
	};
}

export type SearchSource = "all" | "code" | "transcript";

export interface UnifiedResult {
	body?: string;
	filesChanged?: string;
	id: string;
	path?: string;
	prompt?: string;
	response?: string;
	score: number;
	source: SearchSource;
	summary: string;
	symbol?: string;
	symbolType?: string;
	timestamp?: string;
}

export async function unifiedSearch(
	queryVector: number[],
	topK = 5,
	filter?: SearchFilter & { source?: SearchSource }
): Promise<UnifiedResult[]> {
	const source = filter?.source ?? "all";
	const results: UnifiedResult[] = [];

	if (source === "all" || source === "transcript") {
		const transcriptResults = await searchSolutions(
			queryVector,
			topK * 2,
			filter
		);
		for (const r of transcriptResults) {
			results.push({
				score: r.score,
				source: "transcript",
				id: r.chunk.id,
				summary: r.chunk.summary || r.chunk.prompt.slice(0, 200),
				prompt: r.chunk.prompt,
				response: r.chunk.response,
				filesChanged: r.chunk.filesChanged,
				timestamp: r.chunk.timestamp,
			});
		}
	}

	if (source === "all" || source === "code") {
		try {
			const { searchCode } = await import("./code-store.ts");
			const codeResults = await searchCode(queryVector, topK * 2, {
				queryText: filter?.queryText,
			});
			for (const r of codeResults) {
				results.push({
					score: r.score,
					source: "code",
					id: r.chunk.id,
					summary: r.chunk.summary,
					body: r.chunk.body,
					path: r.chunk.path,
					symbol: r.chunk.symbol,
					symbolType: r.chunk.symbolType,
				});
			}
		} catch {
			// code_symbols table may not exist yet
		}
	}

	if (source === "all") {
		const TRANSCRIPT_WEIGHT = 1.0;
		const CODE_WEIGHT = 0.85;
		for (const r of results) {
			r.score *= r.source === "transcript" ? TRANSCRIPT_WEIGHT : CODE_WEIGHT;
		}
	}

	results.sort((a, b) => b.score - a.score);
	return results.slice(0, topK);
}

export async function getRecentSessions(limit = 10): Promise<
	Array<{
		agent: string;
		filesChanged: string;
		summary: string;
		timestamp: string;
	}>
> {
	if (!(await tableExists())) {
		return [];
	}
	const table = await getTable();
	const rows = await table
		.query()
		.select(["summary", "timestamp", "agent", "filesChanged"])
		.limit(200)
		.toArray();

	return (rows as Record<string, unknown>[])
		.map((r) => ({
			summary: (r.summary as string) || "",
			timestamp: (r.timestamp as string) || "",
			agent: (r.agent as string) || "",
			filesChanged: (r.filesChanged as string) || "",
		}))
		.filter((r) => r.timestamp)
		.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
		.slice(0, limit);
}

export async function dropTable(): Promise<boolean> {
	if (!(await tableExists())) {
		return false;
	}

	const conn = await getConnection();
	await conn.dropTable(TABLE_NAME);
	return true;
}
