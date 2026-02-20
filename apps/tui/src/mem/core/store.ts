import { type Connection, connect, type Table } from "@lancedb/lancedb";
import { getStorePath } from "../lib/config.ts";
import type { SolutionChunk } from "./chunker.ts";

const TABLE_NAME = "solutions";

interface VectorRecord {
	agent: string;
	checkpointId: string;
	diffSummary: string;
	embeddingText: string;
	filesChanged: string;
	id: string;
	prompt: string;
	response: string;
	sessionIndex: number;
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

async function getTable(): Promise<Table> {
	const conn = await getConnection();
	return conn.openTable(TABLE_NAME);
}

async function tableExists(): Promise<boolean> {
	const conn = await getConnection();
	const tables = await conn.tableNames();
	return tables.includes(TABLE_NAME);
}

function chunkToRecord(chunk: SolutionChunk, vector: number[]): VectorRecord {
	return {
		id: chunk.id,
		checkpointId: chunk.checkpointId,
		sessionIndex: chunk.sessionIndex,
		prompt: chunk.prompt,
		response: chunk.response,
		diffSummary: chunk.diffSummary,
		agent: chunk.metadata.agent,
		timestamp: chunk.metadata.timestamp,
		filesChanged: chunk.metadata.filesChanged.join(","),
		tokensUsed: chunk.metadata.tokensUsed,
		embeddingText: chunk.embeddingText,
		vector,
	};
}

export async function initStore(): Promise<void> {
	const conn = await getConnection();
	if (await tableExists()) {
		return;
	}

	const emptyRecord: VectorRecord = {
		id: "",
		checkpointId: "",
		sessionIndex: 0,
		prompt: "",
		response: "",
		diffSummary: "",
		agent: "",
		timestamp: "",
		filesChanged: "",
		tokensUsed: 0,
		embeddingText: "",
		vector: new Array(1536).fill(0) as number[],
	};

	const table = await conn.createTable(TABLE_NAME, [emptyRecord]);
	await table.delete('id = ""');
}

export async function insertChunks(
	chunks: SolutionChunk[],
	vectors: number[][]
): Promise<number> {
	if (chunks.length === 0) {
		return 0;
	}

	const exists = await tableExists();
	if (!exists) {
		await initStore();
	}

	const table = await getTable();

	const records: VectorRecord[] = [];
	for (let i = 0; i < chunks.length; i++) {
		const chunk = chunks[i];
		const vector = vectors[i];
		if (chunk && vector) {
			records.push(chunkToRecord(chunk, vector));
		}
	}

	await table.add(records);
	return records.length;
}

function escapeSql(value: string): string {
	return value.replace(/'/g, "''");
}

export async function searchSolutions(
	queryVector: number[],
	topK = 5,
	filter?: { agent?: string; files?: string[] }
): Promise<SearchResult[]> {
	if (!(await tableExists())) {
		return [];
	}

	const table = await getTable();
	let query = table.search(queryVector).limit(topK);

	if (filter?.agent) {
		query = query.where(`agent = '${escapeSql(filter.agent)}'`);
	}
	if (filter?.files && filter.files.length > 0) {
		const fileConditions = filter.files
			.map((f) => `filesChanged LIKE '%${escapeSql(f)}%'`)
			.join(" OR ");
		query = query.where(`(${fileConditions})`);
	}

	const results = await query.toArray();

	return results.map((row) => ({
		chunk: {
			id: row.id as string,
			checkpointId: row.checkpointId as string,
			sessionIndex: row.sessionIndex as number,
			prompt: row.prompt as string,
			response: row.response as string,
			diffSummary: row.diffSummary as string,
			agent: row.agent as string,
			timestamp: row.timestamp as string,
			filesChanged: row.filesChanged as string,
			tokensUsed: row.tokensUsed as number,
			embeddingText: row.embeddingText as string,
		},
		score: row._distance != null ? 1 - (row._distance as number) : 0,
	}));
}

export async function getIndexedChunkIds(): Promise<Set<string>> {
	if (!(await tableExists())) {
		return new Set();
	}

	const table = await getTable();
	const rows = await table.query().select(["id"]).toArray();
	return new Set(rows.map((r) => r.id as string));
}

export async function getStats(): Promise<{
	totalChunks: number;
	hasTable: boolean;
}> {
	if (!(await tableExists())) {
		return { totalChunks: 0, hasTable: false };
	}

	const table = await getTable();
	const count = await table.countRows();
	return { totalChunks: count, hasTable: true };
}

export async function dropTable(): Promise<boolean> {
	if (!(await tableExists())) {
		return false;
	}

	const conn = await getConnection();
	await conn.dropTable(TABLE_NAME);
	return true;
}
