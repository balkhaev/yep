import { Index, type Table } from "@lancedb/lancedb";
import { getVectorDimensions } from "../lib/config.ts";
import { createLogger } from "../lib/logger.ts";
import { escapeSql } from "../lib/sql.ts";
import type { CodeChunk } from "./code-chunker.ts";
import {
	buildComplexityDistribution,
	calculateComplexity,
} from "./complexity.ts";
import { findDuplicateClusters } from "./duplication.ts";
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

let codeTableExistsCache: boolean | null = null;
let codeTablePromise: Promise<Table> | null = null;

let insightsCache: CodeInsights | null = null;

export function invalidateInsightsCache(): void {
	insightsCache = null;
}

export function getCachedInsights(): CodeInsights | null {
	return insightsCache;
}

async function codeTableExists(): Promise<boolean> {
	if (codeTableExistsCache !== null) {
		return codeTableExistsCache;
	}
	const conn = await getConnection();
	const tables = await conn.tableNames();
	codeTableExistsCache = tables.includes(CODE_TABLE);
	return codeTableExistsCache;
}

function getCodeTable(): Promise<Table> {
	if (!codeTablePromise) {
		codeTablePromise = (async () => {
			const conn = await getConnection();
			const table = await conn.openTable(CODE_TABLE);
			await migrateCodeSchema(table);
			return table;
		})();
	}
	return codeTablePromise;
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
		return;
	}

	const table = await conn.createTable(CODE_TABLE, [emptyCodeRecord()]);
	await table.delete('id = ""');
	try {
		await table.createIndex("embeddingText", { config: Index.fts() });
	} catch (err) {
		log.debug("FTS index creation skipped", { error: String(err) });
	}
	codeTableExistsCache = true;
	codeTablePromise = null;
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
	invalidateInsightsCache();
	return records.length;
}

export async function deleteCodeChunksByPath(path: string): Promise<void> {
	if (!(await codeTableExists())) {
		return;
	}
	const table = await getCodeTable();
	try {
		await table.delete(`path = '${escapeSql(path)}'`);
		invalidateInsightsCache();
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
		conditions.push(`language = '${escapeSql(filter.language)}'`);
	}
	if (filter?.symbolType) {
		conditions.push(`"symbolType" = '${escapeSql(filter.symbolType)}'`);
	}
	if (filter?.path) {
		conditions.push(`path LIKE '%${escapeSql(filter.path)}%'`);
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
		const escaped = escapeSql(queryText);
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
	const rows = await table.query().select(["language"]).limit(5000).toArray();
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
		.where(`path LIKE '%${escapeSql(filePath)}'`)
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
		.where(`symbol = '${escapeSql(symbolName)}'`)
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
	const escaped = escapeSql(prefix);
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
		.where(`calls LIKE '%${escapeSql(symbolName)}%'`)
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
		.map((name) => `symbol = '${escapeSql(name)}'`)
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
		.where(`imports LIKE '%${escapeSql(symbolName)}%'`)
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
	avgComplexity: number;
	avgSymbolsPerFile: number;
	complexityDistribution: Array<{ range: string; count: number }>;
	crossDirectoryImports: Array<{
		from: string;
		to: string;
		count: number;
	}>;
	deadCode: Array<{ symbol: string; symbolType: string; path: string }>;
	directoryInsights: Array<{
		directory: string;
		symbolCount: number;
		avgComplexity: number;
		deadCodeCount: number;
		docCoverage: number;
		languages: string[];
		topSymbol: string;
	}>;
	documentationCoverage: number;
	duplicateClusters: Array<{
		symbols: Array<{ symbol: string; path: string; symbolType: string }>;
		similarity: number;
	}>;
	duplicateSymbolCount: number;
	godSymbols: Array<{
		symbol: string;
		symbolType: string;
		path: string;
		totalConnections: number;
	}>;
	highFanInSymbols: Array<{
		symbol: string;
		path: string;
		importerCount: number;
		importerPercentage: number;
	}>;
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
	medianConnections: number;
	mostConnected: Array<{
		symbol: string;
		symbolType: string;
		path: string;
		callerCount: number;
		calleeCount: number;
		importerCount: number;
		totalConnections: number;
	}>;
	topComplexSymbols: Array<{
		symbol: string;
		symbolType: string;
		path: string;
		cyclomatic: number;
		cognitive: number;
		lineCount: number;
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
	language: string;
	path: string;
	summary: string;
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
			language: (r.language as string) || "",
			summary: (r.summary as string) || "",
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

function extractDirectory(filePath: string): string {
	const parts = filePath.split("/");
	const meaningful = parts.filter(
		(p) => p && p !== "." && p !== ".." && p !== "src"
	);
	return meaningful.slice(0, 2).join("/") || filePath;
}

function computeMedian(values: number[]): number {
	if (values.length === 0) {
		return 0;
	}
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 !== 0
		? (sorted[mid] ?? 0)
		: ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

function computeDirectoryInsights(
	graph: DependencyGraph,
	complexityMap: Map<
		string,
		{ cyclomatic: number; cognitive: number; hasDoc: boolean }
	>,
	deadCodeSet: Set<string>
): CodeInsights["directoryInsights"] {
	const dirMap = new Map<
		string,
		{
			complexities: number[];
			deadCount: number;
			docCount: number;
			languages: Set<string>;
			symbolCount: number;
			topSymbol: { connections: number; name: string };
		}
	>();

	for (const [sym, meta] of graph.symbolMeta) {
		const dir = extractDirectory(meta.path);
		const entry = dirMap.get(dir) ?? {
			symbolCount: 0,
			complexities: [],
			deadCount: 0,
			docCount: 0,
			languages: new Set<string>(),
			topSymbol: { name: "", connections: 0 },
		};

		entry.symbolCount++;
		entry.languages.add(meta.language);

		const cx = complexityMap.get(sym);
		if (cx) {
			entry.complexities.push(cx.cyclomatic);
			if (cx.hasDoc) {
				entry.docCount++;
			}
		}

		if (deadCodeSet.has(sym)) {
			entry.deadCount++;
		}

		const cCount = graph.callerCounts.get(sym) ?? 0;
		const iCount = graph.importerCounts.get(sym) ?? 0;
		const totalConn = cCount + (meta.calleeCount ?? 0) + iCount;
		if (totalConn > entry.topSymbol.connections) {
			entry.topSymbol = { name: sym, connections: totalConn };
		}

		dirMap.set(dir, entry);
	}

	return [...dirMap.entries()]
		.map(([directory, info]) => ({
			directory,
			symbolCount: info.symbolCount,
			avgComplexity:
				info.complexities.length > 0
					? Math.round(
							(info.complexities.reduce((a, b) => a + b, 0) /
								info.complexities.length) *
								10
						) / 10
					: 0,
			deadCodeCount: info.deadCount,
			docCoverage:
				info.symbolCount > 0
					? Math.round((info.docCount / info.symbolCount) * 100)
					: 0,
			languages: [...info.languages],
			topSymbol: info.topSymbol.name,
		}))
		.sort((a, b) => b.symbolCount - a.symbolCount)
		.slice(0, 20);
}

export async function getCodeInsights(): Promise<CodeInsights | null> {
	if (insightsCache) {
		return insightsCache;
	}

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
			"summary",
		])
		.limit(10_000)
		.toArray()) as Record<string, unknown>[];

	if (rows.length === 0) {
		return null;
	}

	const totalSymbols = rows.length;
	const graph = buildDependencyGraph(rows);
	const dist = computeDistributions(rows, totalSymbols);

	// --- Dead code ---
	const deadCodeAll = rows.filter((r) => {
		const sym = r.symbol as string;
		const type = r.symbolType as string;
		if (type === "type" || type === "interface") {
			return false;
		}
		return (
			(graph.callerCounts.get(sym) ?? 0) === 0 &&
			(graph.importerCounts.get(sym) ?? 0) === 0
		);
	});

	const deadCode = deadCodeAll
		.map((r) => ({
			symbol: r.symbol as string,
			symbolType: r.symbolType as string,
			path: r.path as string,
		}))
		.slice(0, 50);

	// --- Connectivity ---
	const allConnections = [...graph.allSymbolNames].map((sym) => {
		const meta = graph.symbolMeta.get(sym);
		const cCount = graph.callerCounts.get(sym) ?? 0;
		const iCount = graph.importerCounts.get(sym) ?? 0;
		return cCount + (meta?.calleeCount ?? 0) + iCount;
	});

	const medianConnections = computeMedian(allConnections);

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

	// --- Complexity ---
	const complexityMap = new Map<
		string,
		{ cyclomatic: number; cognitive: number; hasDoc: boolean }
	>();
	const cyclomaticValues: number[] = [];

	for (const [sym, meta] of graph.symbolMeta) {
		const result = calculateComplexity(meta.body, meta.summary);
		complexityMap.set(sym, result);
		cyclomaticValues.push(result.cyclomatic);
	}

	const avgComplexity =
		cyclomaticValues.length > 0
			? Math.round(
					(cyclomaticValues.reduce((a, b) => a + b, 0) /
						cyclomaticValues.length) *
						10
				) / 10
			: 0;

	const complexityDistribution = buildComplexityDistribution(cyclomaticValues);

	const topComplexSymbols = [...complexityMap.entries()]
		.map(([sym, cx]) => {
			const meta = graph.symbolMeta.get(sym);
			return {
				symbol: sym,
				symbolType: meta?.symbolType ?? "",
				path: meta?.path ?? "",
				cyclomatic: cx.cyclomatic,
				cognitive: cx.cognitive,
				lineCount: meta?.body.split("\n").length ?? 0,
			};
		})
		.sort((a, b) => b.cyclomatic - a.cyclomatic)
		.slice(0, 15);

	// --- Documentation coverage ---
	const docCount = [...complexityMap.values()].filter((c) => c.hasDoc).length;
	const documentationCoverage =
		totalSymbols > 0 ? Math.round((docCount / totalSymbols) * 100) : 0;

	// --- Duplication ---
	let duplicateClusters: CodeInsights["duplicateClusters"] = [];
	let duplicateSymbolCount = 0;
	try {
		duplicateClusters = await findDuplicateClusters(table);
		duplicateSymbolCount = duplicateClusters.reduce(
			(sum, c) => sum + c.symbols.length,
			0
		);
	} catch (err) {
		log.warn("Duplication detection failed", { error: String(err) });
	}

	const directoryInsights = computeDirectoryInsights(
		graph,
		complexityMap,
		new Set(deadCodeAll.map((r) => r.symbol as string))
	);

	// --- Cross-directory imports ---
	const crossDirCounts = new Map<string, number>();
	for (const r of rows) {
		const fromDir = extractDirectory(r.path as string);
		const imports = (r.imports as string) || "";
		for (const imp of imports.split(",").filter(Boolean)) {
			const name = imp.split(":")[0] ?? "";
			const targetMeta = graph.symbolMeta.get(name);
			if (!targetMeta) {
				continue;
			}
			const toDir = extractDirectory(targetMeta.path);
			if (fromDir !== toDir) {
				const key = `${fromDir}→${toDir}`;
				crossDirCounts.set(key, (crossDirCounts.get(key) ?? 0) + 1);
			}
		}
	}
	const crossDirectoryImports = [...crossDirCounts.entries()]
		.map(([key, count]) => {
			const [from, to] = key.split("→");
			return { from: from ?? "", to: to ?? "", count };
		})
		.sort((a, b) => b.count - a.count)
		.slice(0, 20);

	// --- God symbols (>3x median connections) ---
	const godThreshold = Math.max(medianConnections * 3, 5);
	const godSymbols = mostConnected
		.filter((s) => s.totalConnections >= godThreshold)
		.map((s) => ({
			symbol: s.symbol,
			symbolType: s.symbolType,
			path: s.path,
			totalConnections: s.totalConnections,
		}));

	// --- High fan-in symbols (imported by >30% of files) ---
	const fileThreshold = Math.max(Math.round(dist.totalFiles * 0.3), 3);
	const highFanInSymbols = [...graph.importerCounts.entries()]
		.filter(([, count]) => count >= fileThreshold)
		.map(([sym, count]) => {
			const meta = graph.symbolMeta.get(sym);
			return {
				symbol: sym,
				path: meta?.path ?? "",
				importerCount: count,
				importerPercentage:
					dist.totalFiles > 0 ? Math.round((count / dist.totalFiles) * 100) : 0,
			};
		})
		.sort((a, b) => b.importerCount - a.importerCount)
		.slice(0, 15);

	const result: CodeInsights = {
		avgComplexity,
		avgSymbolsPerFile:
			dist.totalFiles > 0
				? Math.round((totalSymbols / dist.totalFiles) * 10) / 10
				: 0,
		complexityDistribution,
		crossDirectoryImports,
		deadCode,
		directoryInsights,
		documentationCoverage,
		duplicateClusters,
		duplicateSymbolCount,
		godSymbols,
		highFanInSymbols,
		hotFiles: dist.hotFiles,
		languageDistribution: dist.languageDistribution,
		largestSymbols,
		medianConnections,
		mostConnected,
		topComplexSymbols,
		totalFiles: dist.totalFiles,
		totalSymbols,
		typeDistribution: dist.typeDistribution,
	};

	insightsCache = result;
	return result;
}

export async function dropCodeTable(): Promise<boolean> {
	if (!(await codeTableExists())) {
		return false;
	}
	const conn = await getConnection();
	await conn.dropTable(CODE_TABLE);
	codeTableExistsCache = null;
	codeTablePromise = null;
	invalidateInsightsCache();
	return true;
}
