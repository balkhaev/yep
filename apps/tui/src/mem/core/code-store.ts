import { Index, type Table } from "@lancedb/lancedb";
import { getVectorDimensions } from "../lib/config.ts";
import { createLogger } from "../lib/logger.ts";
import type { CodeChunk } from "./code-chunker.ts";
import { getConnection } from "./store.ts";

const log = createLogger("code-store");

const CODE_TABLE = "code_symbols";

interface CodeRecord {
	body: string;
	calls: string;
	commit: string;
	embeddingText: string;
	id: string;
	imports: string;
	language: string;
	lastModified: string;
	path: string;
	summary: string;
	symbol: string;
	symbolType: string;
	vector: number[];
	[key: string]: unknown;
}

export interface CodeResult {
	body: string;
	calls: string;
	commit: string;
	id: string;
	imports: string;
	language: string;
	lastModified: string;
	path: string;
	summary: string;
	symbol: string;
	symbolType: string;
}

export interface CodeSearchResult {
	chunk: CodeResult;
	score: number;
}

async function codeTableExists(): Promise<boolean> {
	const conn = await getConnection();
	const tables = await conn.tableNames();
	return tables.includes(CODE_TABLE);
}

async function getCodeTable(): Promise<Table> {
	const conn = await getConnection();
	return conn.openTable(CODE_TABLE);
}

function emptyCodeRecord(): CodeRecord {
	return {
		id: "",
		path: "",
		symbol: "",
		symbolType: "",
		language: "",
		body: "",
		summary: "",
		embeddingText: "",
		commit: "",
		lastModified: "",
		calls: "",
		imports: "",
		vector: new Array(getVectorDimensions()).fill(0) as number[],
	};
}

function chunkToCodeRecord(
	chunk: CodeChunk,
	vector: number[],
	commit: string
): CodeRecord {
	return {
		id: chunk.id,
		path: chunk.path,
		symbol: chunk.symbol,
		symbolType: chunk.symbolType,
		language: chunk.language,
		body: chunk.body,
		summary: chunk.summary,
		embeddingText: chunk.embeddingText,
		commit,
		lastModified: chunk.lastModified,
		calls: chunk.calls,
		imports: chunk.imports,
		vector,
	};
}

function rowToCodeResult(row: Record<string, unknown>): CodeResult {
	return {
		id: row.id as string,
		path: row.path as string,
		symbol: row.symbol as string,
		symbolType: row.symbolType as string,
		language: row.language as string,
		body: row.body as string,
		summary: (row.summary as string) ?? "",
		commit: row.commit as string,
		lastModified: row.lastModified as string,
		calls: (row.calls as string) ?? "",
		imports: (row.imports as string) ?? "",
	};
}

async function migrateCodeSchema(table: Table): Promise<void> {
	try {
		const rows = await table.query().limit(1).toArray();
		const sample = rows[0] as Record<string, unknown> | undefined;
		if (sample && !("calls" in sample)) {
			const emptyRow = emptyCodeRecord();
			await table.add([emptyRow]);
			await table.delete('id = ""');
		}
	} catch (err) {
		log.warn("Schema migration failed", { error: String(err) });
	}
}

export async function initCodeStore(): Promise<void> {
	const conn = await getConnection();
	if (await codeTableExists()) {
		const table = await getCodeTable();
		await migrateCodeSchema(table);
		return;
	}

	const table = await conn.createTable(CODE_TABLE, [emptyCodeRecord()]);
	await table.delete('id = ""');
	try {
		await table.createIndex("embeddingText", { config: Index.fts() });
	} catch (err) {
		log.debug("FTS index creation skipped", { error: String(err) });
	}
}

export async function insertCodeChunks(
	chunks: CodeChunk[],
	vectors: number[][],
	commit: string
): Promise<number> {
	if (chunks.length === 0) {
		return 0;
	}
	if (!(await codeTableExists())) {
		await initCodeStore();
	}

	const table = await getCodeTable();
	const records: CodeRecord[] = [];
	for (let i = 0; i < chunks.length; i++) {
		const chunk = chunks[i];
		const vector = vectors[i];
		if (chunk && vector) {
			records.push(chunkToCodeRecord(chunk, vector, commit));
		}
	}
	await table.add(records);
	return records.length;
}

export async function deleteCodeChunksByPath(path: string): Promise<void> {
	if (!(await codeTableExists())) {
		return;
	}
	const table = await getCodeTable();
	try {
		await table.delete(`path = '${path.replace(/'/g, "''")}'`);
	} catch (err) {
		log.warn("Delete by path failed", { path, error: String(err) });
	}
}

export async function ensureCodeFtsIndex(): Promise<void> {
	if (!(await codeTableExists())) {
		return;
	}
	const table = await getCodeTable();
	try {
		await table.createIndex("embeddingText", { config: Index.fts() });
	} catch (err) {
		log.debug("FTS index update skipped", { error: String(err) });
	}
}

interface CodeFilter {
	language?: string;
	path?: string;
	queryText?: string;
	symbolType?: string;
}

function buildWhereClause(filter?: CodeFilter): string | undefined {
	const conditions: string[] = [];
	if (filter?.language) {
		conditions.push(`language = '${filter.language.replace(/'/g, "''")}'`);
	}
	if (filter?.symbolType) {
		conditions.push(
			`"symbolType" = '${filter.symbolType.replace(/'/g, "''")}'`
		);
	}
	if (filter?.path) {
		conditions.push(`path LIKE '%${filter.path.replace(/'/g, "''")}%'`);
	}
	return conditions.length > 0 ? conditions.join(" AND ") : undefined;
}

interface ScoredRow {
	row: Record<string, unknown>;
	score: number;
}

function addRrfScores(
	scores: Map<string, ScoredRow>,
	rows: Record<string, unknown>[],
	boost = 0
): void {
	const RRF_K = 60;
	for (const [rank, row] of rows.entries()) {
		const id = row.id as string;
		const entry = scores.get(id) ?? { score: 0, row };
		entry.score += boost + 1 / (RRF_K + rank + 1);
		entry.row = row;
		scores.set(id, entry);
	}
}

async function fetchExactMatches(
	table: Table,
	queryText: string,
	fetchK: number,
	whereClause?: string
): Promise<Record<string, unknown>[]> {
	try {
		const escaped = queryText.replace(/'/g, "''");
		const conds = [
			`(symbol = '${escaped}' OR symbol LIKE '%.${escaped}' OR symbol LIKE '${escaped}%')`,
		];
		if (whereClause) {
			conds.push(whereClause);
		}
		return (await table
			.query()
			.where(conds.join(" AND "))
			.limit(fetchK)
			.toArray()) as Record<string, unknown>[];
	} catch (err) {
		log.debug("Exact match query failed", { queryText, error: String(err) });
		return [];
	}
}

export async function searchCode(
	queryVector: number[],
	topK = 10,
	filter?: CodeFilter
): Promise<CodeSearchResult[]> {
	if (!(await codeTableExists())) {
		return [];
	}

	const table = await getCodeTable();
	const fetchK = Math.max(topK * 3, 30);
	const whereClause = buildWhereClause(filter);

	let query = table.search(queryVector).limit(fetchK);
	if (whereClause) {
		query = query.where(whereClause);
	}
	const vectorResults = (await query.toArray()) as Record<string, unknown>[];

	let ftsResults: Record<string, unknown>[] = [];
	if (filter?.queryText) {
		try {
			let ftsQuery = table.search(filter.queryText, "fts").limit(fetchK);
			if (whereClause) {
				ftsQuery = ftsQuery.where(whereClause);
			}
			ftsResults = (await ftsQuery.toArray()) as Record<string, unknown>[];
		} catch (err) {
			log.debug("FTS search failed", { error: String(err) });
		}
	}

	const exactResults = filter?.queryText
		? await fetchExactMatches(table, filter.queryText, fetchK, whereClause)
		: [];

	const scores = new Map<string, ScoredRow>();
	const queryLower = (filter?.queryText ?? "").toLowerCase();

	for (const [rank, row] of exactResults.entries()) {
		const sym = (row.symbol as string).toLowerCase();
		const isExact = sym === queryLower || sym.endsWith(`.${queryLower}`);
		const boost = isExact ? 0.5 : 0.2;
		const id = row.id as string;
		const entry = scores.get(id) ?? { score: 0, row };
		entry.score += boost + 1 / (60 + rank + 1);
		entry.row = row;
		scores.set(id, entry);
	}

	addRrfScores(scores, vectorResults);
	addRrfScores(scores, ftsResults);

	return [...scores.values()]
		.sort((a, b) => b.score - a.score)
		.slice(0, topK)
		.map((e) => ({
			chunk: rowToCodeResult(e.row),
			score: e.score,
		}));
}

export async function getCodeStats(): Promise<{
	hasTable: boolean;
	languages: string[];
	totalSymbols: number;
}> {
	if (!(await codeTableExists())) {
		return { totalSymbols: 0, hasTable: false, languages: [] };
	}
	const table = await getCodeTable();
	const count = await table.countRows();
	const rows = await table.query().select(["language"]).toArray();
	const langs = new Set<string>();
	for (const row of rows) {
		const lang = row.language as string;
		if (lang) {
			langs.add(lang);
		}
	}
	return { totalSymbols: count, hasTable: true, languages: [...langs] };
}

export async function getIndexedCodePaths(): Promise<Set<string>> {
	if (!(await codeTableExists())) {
		return new Set();
	}
	const table = await getCodeTable();
	const rows = await table.query().select(["path"]).toArray();
	return new Set(rows.map((r) => r.path as string));
}

export async function findSymbolsByPath(
	filePath: string
): Promise<CodeResult[]> {
	if (!(await codeTableExists())) {
		return [];
	}
	const table = await getCodeTable();
	const rows = await table
		.query()
		.where(`path LIKE '%${filePath.replace(/'/g, "''")}'`)
		.limit(50)
		.toArray();
	return (rows as Record<string, unknown>[]).map(rowToCodeResult);
}

export async function findSymbolByName(
	symbolName: string
): Promise<CodeResult | null> {
	if (!(await codeTableExists())) {
		return null;
	}
	const table = await getCodeTable();
	const rows = await table
		.query()
		.where(`symbol = '${symbolName.replace(/'/g, "''")}'`)
		.limit(1)
		.toArray();
	const row = rows[0];
	return row ? rowToCodeResult(row as Record<string, unknown>) : null;
}

export async function findSymbolsByPrefix(
	prefix: string,
	limit = 20
): Promise<CodeResult[]> {
	if (!((await codeTableExists()) && prefix)) {
		return [];
	}
	const table = await getCodeTable();
	const escaped = prefix.replace(/'/g, "''");
	const rows = await table
		.query()
		.where(`(symbol LIKE '${escaped}%' OR symbol LIKE '%.${escaped}%')`)
		.limit(limit)
		.toArray();
	return (rows as Record<string, unknown>[]).map(rowToCodeResult);
}

export async function findCallers(symbolName: string): Promise<CodeResult[]> {
	if (!(await codeTableExists())) {
		return [];
	}
	const table = await getCodeTable();
	const rows = await table
		.query()
		.where(`calls LIKE '%${symbolName.replace(/'/g, "''")}%'`)
		.limit(20)
		.toArray();
	return (rows as Record<string, unknown>[]).map(rowToCodeResult);
}

export async function findCallees(symbolName: string): Promise<CodeResult[]> {
	const sym = await findSymbolByName(symbolName);
	if (!sym?.calls) {
		return [];
	}
	const callNames = sym.calls.split(",").filter(Boolean).slice(0, 10);
	if (callNames.length === 0) {
		return [];
	}

	const table = await getCodeTable();
	const conditions = callNames
		.map((name) => `symbol = '${name.replace(/'/g, "''")}'`)
		.join(" OR ");
	const rows = await table
		.query()
		.where(`(${conditions})`)
		.limit(callNames.length)
		.toArray();
	return (rows as Record<string, unknown>[]).map(rowToCodeResult);
}

export async function findImporters(symbolName: string): Promise<CodeResult[]> {
	if (!(await codeTableExists())) {
		return [];
	}
	const table = await getCodeTable();
	const rows = await table
		.query()
		.where(`imports LIKE '%${symbolName.replace(/'/g, "''")}%'`)
		.limit(20)
		.toArray();
	return (rows as Record<string, unknown>[]).map(rowToCodeResult);
}

export async function listAllSymbols(
	limit = 500
): Promise<Array<{ path: string; symbol: string; symbolType: string }>> {
	if (!(await codeTableExists())) {
		return [];
	}
	const table = await getCodeTable();
	const rows = await table
		.query()
		.select(["symbol", "symbolType", "path"])
		.limit(limit)
		.toArray();
	return (rows as Record<string, unknown>[]).map((r) => ({
		symbol: r.symbol as string,
		symbolType: r.symbolType as string,
		path: r.path as string,
	}));
}

export async function getRecentIndexedFiles(
	limit = 20
): Promise<Array<{ lastModified: string; path: string; symbolCount: number }>> {
	if (!(await codeTableExists())) {
		return [];
	}
	const table = await getCodeTable();
	const rows = await table
		.query()
		.select(["path", "lastModified"])
		.limit(5000)
		.toArray();

	const byPath = new Map<string, { count: number; lastModified: string }>();
	for (const row of rows as Record<string, unknown>[]) {
		const p = row.path as string;
		const lm = row.lastModified as string;
		const existing = byPath.get(p);
		if (!existing || lm > existing.lastModified) {
			byPath.set(p, { count: (existing?.count ?? 0) + 1, lastModified: lm });
		} else {
			existing.count++;
		}
	}

	return [...byPath.entries()]
		.map(([path, info]) => ({
			path,
			lastModified: info.lastModified,
			symbolCount: info.count,
		}))
		.sort((a, b) => b.lastModified.localeCompare(a.lastModified))
		.slice(0, limit);
}

export interface CodeInsights {
	avgSymbolsPerFile: number;
	deadCode: Array<{ symbol: string; symbolType: string; path: string }>;
	hotFiles: Array<{ path: string; symbolCount: number }>;
	languageDistribution: Array<{
		language: string;
		count: number;
		percentage: number;
	}>;
	largestSymbols: Array<{
		symbol: string;
		symbolType: string;
		path: string;
		lineCount: number;
	}>;
	mostConnected: Array<{
		symbol: string;
		symbolType: string;
		path: string;
		callerCount: number;
		calleeCount: number;
		importerCount: number;
		totalConnections: number;
	}>;
	totalFiles: number;
	totalSymbols: number;
	typeDistribution: Array<{
		symbolType: string;
		count: number;
		percentage: number;
	}>;
}

interface SymbolMeta {
	body: string;
	calleeCount: number;
	path: string;
	symbolType: string;
}

interface DependencyGraph {
	allSymbolNames: Set<string>;
	callerCounts: Map<string, number>;
	importerCounts: Map<string, number>;
	symbolMeta: Map<string, SymbolMeta>;
}

function buildDependencyGraph(
	rows: Record<string, unknown>[]
): DependencyGraph {
	const callerCounts = new Map<string, number>();
	const allSymbolNames = new Set<string>();
	const symbolMeta = new Map<string, SymbolMeta>();

	for (const r of rows) {
		const sym = r.symbol as string;
		allSymbolNames.add(sym);
		const calls = (r.calls as string) || "";
		const calleeCount = calls ? calls.split(",").filter(Boolean).length : 0;
		symbolMeta.set(sym, {
			symbolType: r.symbolType as string,
			path: r.path as string,
			calleeCount,
			body: r.body as string,
		});

		for (const callee of calls.split(",").filter(Boolean)) {
			callerCounts.set(callee, (callerCounts.get(callee) ?? 0) + 1);
		}
	}

	const importerCounts = new Map<string, number>();
	for (const r of rows) {
		const imports = (r.imports as string) || "";
		for (const imp of imports.split(",").filter(Boolean)) {
			const name = imp.split(":")[0] ?? "";
			if (name && allSymbolNames.has(name)) {
				importerCounts.set(name, (importerCounts.get(name) ?? 0) + 1);
			}
		}
	}

	return { callerCounts, importerCounts, allSymbolNames, symbolMeta };
}

function computeDistributions(
	rows: Record<string, unknown>[],
	totalSymbols: number
) {
	const langCounts = new Map<string, number>();
	const typeCounts = new Map<string, number>();
	const fileCounts = new Map<string, number>();

	for (const r of rows) {
		const lang = r.language as string;
		const sType = r.symbolType as string;
		const path = r.path as string;
		langCounts.set(lang, (langCounts.get(lang) ?? 0) + 1);
		typeCounts.set(sType, (typeCounts.get(sType) ?? 0) + 1);
		fileCounts.set(path, (fileCounts.get(path) ?? 0) + 1);
	}

	const languageDistribution = [...langCounts.entries()]
		.map(([language, count]) => ({
			language,
			count,
			percentage: Math.round((count / totalSymbols) * 100),
		}))
		.sort((a, b) => b.count - a.count);

	const typeDistribution = [...typeCounts.entries()]
		.map(([symbolType, count]) => ({
			symbolType,
			count,
			percentage: Math.round((count / totalSymbols) * 100),
		}))
		.sort((a, b) => b.count - a.count);

	const hotFiles = [...fileCounts.entries()]
		.map(([path, symbolCount]) => ({ path, symbolCount }))
		.sort((a, b) => b.symbolCount - a.symbolCount)
		.slice(0, 15);

	return {
		languageDistribution,
		typeDistribution,
		hotFiles,
		totalFiles: fileCounts.size,
	};
}

export async function getCodeInsights(): Promise<CodeInsights | null> {
	if (!(await codeTableExists())) {
		return null;
	}

	const table = await getCodeTable();
	const rows = (await table
		.query()
		.select([
			"symbol",
			"symbolType",
			"path",
			"language",
			"body",
			"calls",
			"imports",
		])
		.limit(10_000)
		.toArray()) as Record<string, unknown>[];

	if (rows.length === 0) {
		return null;
	}

	const totalSymbols = rows.length;
	const graph = buildDependencyGraph(rows);
	const dist = computeDistributions(rows, totalSymbols);

	const deadCode = rows
		.filter((r) => {
			const sym = r.symbol as string;
			const type = r.symbolType as string;
			if (type === "type" || type === "interface") {
				return false;
			}
			return (
				(graph.callerCounts.get(sym) ?? 0) === 0 &&
				(graph.importerCounts.get(sym) ?? 0) === 0
			);
		})
		.map((r) => ({
			symbol: r.symbol as string,
			symbolType: r.symbolType as string,
			path: r.path as string,
		}))
		.slice(0, 30);

	const mostConnected = [...graph.allSymbolNames]
		.map((sym) => {
			const meta = graph.symbolMeta.get(sym);
			const cCount = graph.callerCounts.get(sym) ?? 0;
			const iCount = graph.importerCounts.get(sym) ?? 0;
			return {
				symbol: sym,
				symbolType: meta?.symbolType ?? "",
				path: meta?.path ?? "",
				callerCount: cCount,
				calleeCount: meta?.calleeCount ?? 0,
				importerCount: iCount,
				totalConnections: cCount + (meta?.calleeCount ?? 0) + iCount,
			};
		})
		.sort((a, b) => b.totalConnections - a.totalConnections)
		.slice(0, 15);

	const largestSymbols = [...graph.symbolMeta.entries()]
		.map(([sym, meta]) => ({
			symbol: sym,
			symbolType: meta.symbolType,
			path: meta.path,
			lineCount: meta.body.split("\n").length,
		}))
		.sort((a, b) => b.lineCount - a.lineCount)
		.slice(0, 15);

	return {
		deadCode,
		mostConnected,
		largestSymbols,
		languageDistribution: dist.languageDistribution,
		typeDistribution: dist.typeDistribution,
		hotFiles: dist.hotFiles,
		totalSymbols,
		totalFiles: dist.totalFiles,
		avgSymbolsPerFile:
			dist.totalFiles > 0
				? Math.round((totalSymbols / dist.totalFiles) * 10) / 10
				: 0,
	};
}

export async function dropCodeTable(): Promise<boolean> {
	if (!(await codeTableExists())) {
		return false;
	}
	const conn = await getConnection();
	await conn.dropTable(CODE_TABLE);
	return true;
}
