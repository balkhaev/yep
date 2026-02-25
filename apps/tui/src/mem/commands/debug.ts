import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
	type CodeChunk,
	chunkFileSymbols,
	parseFileSymbols,
} from "../core/code-chunker.ts";
import { chunkCheckpoints } from "../core/chunker.ts";
import { parseAllCheckpoints } from "../core/parser.ts";
import { summarizeChunk } from "../core/summarizer.ts";
import {
	type CodeResult,
	deleteCodeChunksByPath,
	findSymbolByName,
	findSymbolsByPath,
	getCodeStats,
	getIndexedCodePaths,
	listAllSymbols,
} from "../core/code-store.ts";
import { embedText } from "../core/embedder.ts";
import {
	getConnection,
	getStats,
	searchSolutions,
	unifiedSearch,
} from "../core/store.ts";
import { ensureProviderReady, getVectorDimensions } from "../lib/config.ts";
import { requireInit } from "../lib/guards.ts";

const ANSI = {
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	red: "\x1b[31m",
	cyan: "\x1b[36m",
	reset: "\x1b[0m",
};

function bold(s: string): string {
	return `${ANSI.bold}${s}${ANSI.reset}`;
}
function dim(s: string): string {
	return `${ANSI.dim}${s}${ANSI.reset}`;
}
function green(s: string): string {
	return `${ANSI.green}${s}${ANSI.reset}`;
}
function yellow(s: string): string {
	return `${ANSI.yellow}${s}${ANSI.reset}`;
}
function red(s: string): string {
	return `${ANSI.red}${s}${ANSI.reset}`;
}
function cyan(s: string): string {
	return `${ANSI.cyan}${s}${ANSI.reset}`;
}

function truncate(s: string, max: number): string {
	return s.length > max ? `${s.slice(0, max)}...` : s;
}

function formatMs(ms: number): string {
	if (ms < 1) {
		return "<1ms";
	}
	if (ms < 1000) {
		return `${Math.round(ms)}ms`;
	}
	return `${(ms / 1000).toFixed(2)}s`;
}

function severityIcon(severity: "error" | "warning" | "info"): string {
	if (severity === "error") {
		return red("✗");
	}
	if (severity === "warning") {
		return yellow("⚠");
	}
	return cyan("ℹ");
}

function detectLang(path: string): string {
	if (path.endsWith(".ts") || path.endsWith(".tsx")) {
		return "typescript";
	}
	if (path.endsWith(".py")) {
		return "python";
	}
	if (path.endsWith(".go")) {
		return "go";
	}
	if (path.endsWith(".rs")) {
		return "rust";
	}
	return "other";
}

const INDEX_CODE_EXTENSIONS = new Set([
	".ts",
	".tsx",
	".js",
	".jsx",
	".py",
	".go",
	".rs",
]);
const INDEX_IGNORE_DIRS = new Set([
	"node_modules",
	".git",
	".next",
	"dist",
	"build",
	".yep-mem",
	".entire",
	"coverage",
	".turbo",
	".cache",
]);

function walkForFiles(dir: string): string[] {
	const results: string[] = [];
	let entries: string[];
	try {
		entries = readdirSync(dir);
	} catch {
		return results;
	}
	for (const entry of entries) {
		if (INDEX_IGNORE_DIRS.has(entry) || entry.startsWith(".")) {
			continue;
		}
		const full = join(dir, entry);
		try {
			const stat = statSync(full);
			if (stat.isDirectory()) {
				results.push(...walkForFiles(full));
			} else if (stat.isFile()) {
				const ext = full.slice(full.lastIndexOf("."));
				if (INDEX_CODE_EXTENSIONS.has(ext)) {
					results.push(full);
				}
			}
		} catch {
			// inaccessible file, skip
		}
	}
	return results;
}

// ── debug parse ─────────────────────────────────────────────

export interface ParseDebugResult {
	chunks: CodeChunk[];
	comparison: Array<{
		indexed: boolean;
		indexedBody?: string;
		symbol: string;
		symbolType: string;
	}>;
	file: string;
	symbols: Array<{
		body: string;
		calls: string[];
		endLine: number;
		imports: string[];
		jsDoc: string;
		name: string;
		startLine: number;
		symbolType: string;
	}>;
}

export async function debugParse(filePath: string): Promise<ParseDebugResult> {
	const root = process.cwd();
	const fullPath = filePath.startsWith("/") ? filePath : join(root, filePath);

	if (!existsSync(fullPath)) {
		throw new Error(`File not found: ${fullPath}`);
	}

	const symbols = parseFileSymbols(fullPath);
	const lastModified = statSync(fullPath).mtime.toISOString();
	const chunks = chunkFileSymbols(fullPath, lastModified);

	const indexedSymbols = await findSymbolsByPath(fullPath);
	const indexedByName = new Map(indexedSymbols.map((s) => [s.symbol, s]));

	const comparison = symbols.map((sym) => {
		const indexed = indexedByName.get(sym.name);
		return {
			symbol: sym.name,
			symbolType: sym.symbolType,
			indexed: !!indexed,
			indexedBody: indexed?.body?.slice(0, 100),
		};
	});

	return {
		file: relative(root, fullPath),
		symbols: symbols.map((s) => ({
			name: s.name,
			symbolType: s.symbolType,
			startLine: s.startLine,
			endLine: s.endLine,
			body: s.body.slice(0, 200),
			jsDoc: s.jsDoc,
			calls: s.calls,
			imports: s.imports,
		})),
		chunks,
		comparison,
	};
}

function printParseDebug(result: ParseDebugResult): void {
	console.log(bold(`\n  File: ${result.file}`));
	console.log(
		`  Symbols extracted: ${result.symbols.length}  |  Chunks: ${result.chunks.length}\n`
	);

	for (const sym of result.symbols) {
		const status = result.comparison.find((c) => c.symbol === sym.name);
		const indexIcon = status?.indexed ? green("✓") : red("✗");
		console.log(
			`  ${indexIcon} ${cyan(sym.symbolType.padEnd(10))} ${bold(sym.name)} ${dim(`L${sym.startLine}-${sym.endLine}`)}`
		);
		if (sym.jsDoc) {
			console.log(`    ${dim(`doc: ${truncate(sym.jsDoc, 80)}`)}`);
		}
		if (sym.calls.length > 0) {
			console.log(`    ${dim(`calls: ${sym.calls.slice(0, 8).join(", ")}`)}`);
		}
		if (sym.imports.length > 0) {
			console.log(
				`    ${dim(`imports: ${sym.imports.slice(0, 5).join(", ")}`)}`
			);
		}
	}

	const notIndexed = result.comparison.filter((c) => !c.indexed);
	if (notIndexed.length > 0) {
		console.log(
			yellow(
				`\n  ⚠ ${notIndexed.length} symbol(s) not in index: ${notIndexed.map((c) => c.symbol).join(", ")}`
			)
		);
	}

	if (result.chunks.length > 0) {
		console.log(bold("\n  Embedding text samples:"));
		for (const chunk of result.chunks.slice(0, 3)) {
			console.log(
				`    ${cyan(chunk.symbol)}: ${dim(truncate(chunk.embeddingText, 120))}`
			);
			console.log(
				`      ${dim(`len=${chunk.embeddingText.length}  body=${chunk.body.length}`)}`
			);
		}
	}
}

// ── debug index ─────────────────────────────────────────────

interface IndexIssue {
	details: string;
	severity: "error" | "warning" | "info";
	type: string;
}

export interface IndexDebugResult {
	codeIndex: {
		duplicates: Array<{ count: number; symbol: string }>;
		embeddingLengths: { avg: number; max: number; min: number };
		issues: IndexIssue[];
		languages: Record<string, number>;
		missingFiles: string[];
		staleEntries: string[];
		symbolTypes: Record<string, number>;
		totalFiles: number;
		totalSymbols: number;
	};
	solutionIndex: {
		agents: string[];
		totalChunks: number;
		topFiles: Array<{ count: number; file: string }>;
	};
	vectorDimensions: number;
}

function findStaleEntries(indexedPaths: Set<string>, root: string): string[] {
	const stale: string[] = [];
	for (const p of indexedPaths) {
		const fullPath = p.startsWith("/") ? p : join(root, p);
		if (!existsSync(fullPath)) {
			stale.push(p);
		}
	}
	return stale;
}

function findDuplicates(
	allSymbols: Array<{ path: string; symbol: string }>
): Array<{ symbol: string; count: number }> {
	const counts = new Map<string, number>();
	for (const s of allSymbols) {
		const key = `${s.path}:${s.symbol}`;
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	const dupes: Array<{ symbol: string; count: number }> = [];
	for (const [key, count] of counts) {
		if (count > 1) {
			dupes.push({ symbol: key, count });
		}
	}
	return dupes;
}

async function getEmbeddingStats(): Promise<{
	avg: number;
	max: number;
	min: number;
}> {
	const conn = await getConnection();
	const tables = await conn.tableNames();
	if (!tables.includes("code_symbols")) {
		return { min: 0, max: 0, avg: 0 };
	}
	const table = await conn.openTable("code_symbols");
	const rows = await table
		.query()
		.select(["embeddingText"])
		.limit(5000)
		.toArray();

	let min = Number.POSITIVE_INFINITY;
	let max = 0;
	let sum = 0;
	for (const row of rows) {
		const len =
			((row as Record<string, unknown>).embeddingText as string)?.length ?? 0;
		min = Math.min(min, len);
		max = Math.max(max, len);
		sum += len;
	}
	if (min === Number.POSITIVE_INFINITY) {
		min = 0;
	}
	const avg = rows.length > 0 ? sum / rows.length : 0;
	return { min, max, avg: Math.round(avg) };
}

function collectDistributions(
	allSymbols: Array<{ path: string; symbol: string; symbolType: string }>
): { languages: Record<string, number>; symbolTypes: Record<string, number> } {
	const languages: Record<string, number> = {};
	const symbolTypes: Record<string, number> = {};
	for (const s of allSymbols) {
		const lang = detectLang(s.path);
		languages[lang] = (languages[lang] ?? 0) + 1;
		symbolTypes[s.symbolType] = (symbolTypes[s.symbolType] ?? 0) + 1;
	}
	return { languages, symbolTypes };
}

function collectIssues(
	codeStats: { hasTable: boolean },
	staleEntries: string[],
	missingFiles: string[],
	duplicates: Array<{ symbol: string; count: number }>
): IndexIssue[] {
	const issues: IndexIssue[] = [];
	if (!codeStats.hasTable) {
		issues.push({
			type: "no_code_table",
			severity: "error",
			details: "Code symbols table does not exist. Run 'yep sync' first.",
		});
	}
	if (staleEntries.length > 0) {
		issues.push({
			type: "stale_entries",
			severity: "warning",
			details: `${staleEntries.length} indexed file(s) no longer exist on disk`,
		});
	}
	if (missingFiles.length > 0) {
		issues.push({
			type: "missing_files",
			severity: "info",
			details: `${missingFiles.length} code file(s) on disk not in index`,
		});
	}
	if (duplicates.length > 0) {
		issues.push({
			type: "duplicates",
			severity: "warning",
			details: `${duplicates.length} duplicate symbol(s) in index`,
		});
	}
	return issues;
}

export async function debugIndex(): Promise<IndexDebugResult> {
	const root = process.cwd();
	const [codeStats, solutionStats, allSymbols, indexedPaths] =
		await Promise.all([
			getCodeStats(),
			getStats(),
			listAllSymbols(10_000),
			getIndexedCodePaths(),
		]);

	const staleEntries = findStaleEntries(indexedPaths, root);
	const diskFiles = walkForFiles(root);
	const missingFiles = diskFiles.filter((f) => !indexedPaths.has(f));
	const duplicates = findDuplicates(allSymbols);
	const issues = collectIssues(
		codeStats,
		staleEntries,
		missingFiles,
		duplicates
	);
	const embeddingLengths = await getEmbeddingStats();
	const { languages, symbolTypes } = collectDistributions(allSymbols);

	return {
		vectorDimensions: getVectorDimensions(),
		codeIndex: {
			totalSymbols: codeStats.totalSymbols,
			totalFiles: indexedPaths.size,
			staleEntries,
			missingFiles: missingFiles.map((f) => relative(root, f)).slice(0, 50),
			duplicates: duplicates.slice(0, 20),
			embeddingLengths,
			languages,
			symbolTypes,
			issues,
		},
		solutionIndex: {
			totalChunks: solutionStats.totalChunks,
			agents: solutionStats.agents,
			topFiles: solutionStats.topFiles,
		},
	};
}

function printIndexIssues(issues: IndexIssue[]): void {
	if (issues.length === 0) {
		console.log(green("\n  ✓ No issues found"));
		return;
	}
	console.log(bold("\n  Issues:"));
	for (const issue of issues) {
		console.log(
			`    ${severityIcon(issue.severity)} [${issue.type}] ${issue.details}`
		);
	}
}

function printIndexDebug(result: IndexDebugResult): void {
	console.log(bold("\n  Index Health Report"));
	console.log(dim(`  Vector dimensions: ${result.vectorDimensions}\n`));

	console.log(bold("  Code Index:"));
	console.log(
		`    Symbols: ${result.codeIndex.totalSymbols}  |  Files: ${result.codeIndex.totalFiles}`
	);
	console.log(
		`    Embedding text: min=${result.codeIndex.embeddingLengths.min} avg=${result.codeIndex.embeddingLengths.avg} max=${result.codeIndex.embeddingLengths.max}`
	);

	if (Object.keys(result.codeIndex.symbolTypes).length > 0) {
		const types = Object.entries(result.codeIndex.symbolTypes)
			.map(([k, v]) => `${k}=${v}`)
			.join(" ");
		console.log(`    Types: ${types}`);
	}
	if (Object.keys(result.codeIndex.languages).length > 0) {
		const langs = Object.entries(result.codeIndex.languages)
			.map(([k, v]) => `${k}=${v}`)
			.join(" ");
		console.log(`    Languages: ${langs}`);
	}

	console.log(bold("\n  Solutions Index:"));
	console.log(`    Chunks: ${result.solutionIndex.totalChunks}`);
	if (result.solutionIndex.agents.length > 0) {
		console.log(`    Agents: ${result.solutionIndex.agents.join(", ")}`);
	}

	printIndexIssues(result.codeIndex.issues);

	if (result.codeIndex.staleEntries.length > 0) {
		console.log(yellow("\n  Stale entries (first 10):"));
		for (const p of result.codeIndex.staleEntries.slice(0, 10)) {
			console.log(`    ${dim(p)}`);
		}
	}
	if (result.codeIndex.missingFiles.length > 0) {
		console.log(
			yellow(
				`\n  Missing from index (${result.codeIndex.missingFiles.length}, first 10):`
			)
		);
		for (const p of result.codeIndex.missingFiles.slice(0, 10)) {
			console.log(`    ${dim(p)}`);
		}
	}
	if (result.codeIndex.duplicates.length > 0) {
		console.log(yellow("\n  Duplicates (first 10):"));
		for (const d of result.codeIndex.duplicates.slice(0, 10)) {
			console.log(`    ${d.symbol} (${d.count}x)`);
		}
	}
}

// ── debug search ────────────────────────────────────────────

interface SearchStepResult {
	count: number;
	ms: number;
	results: Array<{
		id: string;
		path?: string;
		score: number;
		summary?: string;
		symbol?: string;
	}>;
}

export interface SearchDebugResult {
	exactMatch: SearchStepResult;
	finalResults: Array<{
		id: string;
		path?: string;
		score: number;
		source: string;
		summary: string;
		symbol?: string;
	}>;
	fts: SearchStepResult;
	query: string;
	totalMs: number;
	unified: {
		codeResults: number;
		ms: number;
		totalResults: number;
		transcriptResults: number;
	};
	vector: SearchStepResult;
	vectorInfo: {
		dimensions: number;
		magnitude: number;
	};
}

function rowToStepResult(r: Record<string, unknown>): {
	id: string;
	path: string;
	summary: string;
	symbol: string;
} {
	return {
		id: r.id as string,
		symbol: r.symbol as string,
		path: r.path as string,
		summary: ((r.summary as string) ?? "").slice(0, 80),
	};
}

async function runVectorStep(
	table: Awaited<
		ReturnType<Awaited<ReturnType<typeof getConnection>>["openTable"]>
	>,
	queryVector: number[],
	fetchK: number
): Promise<SearchStepResult> {
	const t0 = performance.now();
	const rows = (await table
		.search(queryVector)
		.limit(fetchK)
		.toArray()) as Record<string, unknown>[];
	return {
		count: rows.length,
		ms: performance.now() - t0,
		results: rows.slice(0, 10).map((r) => ({
			...rowToStepResult(r),
			score: r._distance != null ? 1 - (r._distance as number) : 0,
		})),
	};
}

async function runFtsStep(
	table: Awaited<
		ReturnType<Awaited<ReturnType<typeof getConnection>>["openTable"]>
	>,
	query: string,
	fetchK: number
): Promise<SearchStepResult> {
	const t0 = performance.now();
	try {
		const rows = (await table
			.search(query, "fts")
			.limit(fetchK)
			.toArray()) as Record<string, unknown>[];
		return {
			count: rows.length,
			ms: performance.now() - t0,
			results: rows.slice(0, 10).map((r) => ({
				...rowToStepResult(r),
				score: (r._score as number) ?? 0,
			})),
		};
	} catch {
		return { count: 0, ms: performance.now() - t0, results: [] };
	}
}

async function runExactStep(
	table: Awaited<
		ReturnType<Awaited<ReturnType<typeof getConnection>>["openTable"]>
	>,
	query: string,
	fetchK: number
): Promise<SearchStepResult> {
	const t0 = performance.now();
	try {
		const escaped = query.replace(/'/g, "''");
		const rows = (await table
			.query()
			.where(
				`(symbol = '${escaped}' OR symbol LIKE '%.${escaped}' OR symbol LIKE '${escaped}%')`
			)
			.limit(fetchK)
			.toArray()) as Record<string, unknown>[];
		return {
			count: rows.length,
			ms: performance.now() - t0,
			results: rows.slice(0, 10).map((r) => ({
				...rowToStepResult(r),
				score: 1.0,
			})),
		};
	} catch {
		return { count: 0, ms: performance.now() - t0, results: [] };
	}
}

export async function debugSearch(query: string): Promise<SearchDebugResult> {
	const totalStart = performance.now();
	ensureProviderReady();

	const queryVector = await embedText(query);
	const magnitude = Math.sqrt(queryVector.reduce((s, v) => s + v * v, 0));

	const conn = await getConnection();
	const tables = await conn.tableNames();
	const topK = 10;
	const fetchK = Math.max(topK * 3, 30);

	const emptyStep: SearchStepResult = { count: 0, ms: 0, results: [] };
	let vectorStep = emptyStep;
	let ftsStep = emptyStep;
	let exactStep = emptyStep;

	if (tables.includes("code_symbols")) {
		const table = await conn.openTable("code_symbols");
		vectorStep = await runVectorStep(table, queryVector, fetchK);
		ftsStep = await runFtsStep(table, query, fetchK);
		exactStep = await runExactStep(table, query, fetchK);
	}

	const t3 = performance.now();
	const unifiedResults = await unifiedSearch(queryVector, topK, {
		queryText: query,
		source: "all",
	});
	const unifiedMs = performance.now() - t3;

	let codeCount = 0;
	let transcriptCount = 0;
	for (const r of unifiedResults) {
		if (r.source === "code") {
			codeCount++;
		} else {
			transcriptCount++;
		}
	}

	return {
		query,
		vectorInfo: {
			dimensions: queryVector.length,
			magnitude: Math.round(magnitude * 1000) / 1000,
		},
		vector: vectorStep,
		fts: ftsStep,
		exactMatch: exactStep,
		unified: {
			totalResults: unifiedResults.length,
			codeResults: codeCount,
			transcriptResults: transcriptCount,
			ms: unifiedMs,
		},
		finalResults: unifiedResults.map((r) => ({
			id: r.id,
			source: r.source,
			score: Math.round(r.score * 10_000) / 10_000,
			summary: (r.summary ?? "").slice(0, 100),
			symbol: r.symbol,
			path: r.path,
		})),
		totalMs: performance.now() - totalStart,
	};
}

function printSearchDebug(result: SearchDebugResult): void {
	console.log(bold(`\n  Search Debug: "${result.query}"`));
	console.log(
		dim(
			`  Vector: ${result.vectorInfo.dimensions}d, magnitude=${result.vectorInfo.magnitude}`
		)
	);
	console.log(dim(`  Total time: ${formatMs(result.totalMs)}\n`));

	console.log(
		`${bold("  Vector search:")} ${result.vector.count} results (${formatMs(result.vector.ms)})`
	);
	for (const r of result.vector.results.slice(0, 5)) {
		console.log(
			`    ${dim(r.score.toFixed(4))} ${cyan(r.symbol ?? "")} ${dim(r.path ?? "")}`
		);
	}

	console.log(
		`\n${bold("  FTS search:")} ${result.fts.count} results (${formatMs(result.fts.ms)})`
	);
	for (const r of result.fts.results.slice(0, 5)) {
		console.log(
			`    ${dim(r.score.toFixed(4))} ${cyan(r.symbol ?? "")} ${dim(r.path ?? "")}`
		);
	}

	console.log(
		`\n${bold("  Exact match:")} ${result.exactMatch.count} results (${formatMs(result.exactMatch.ms)})`
	);
	for (const r of result.exactMatch.results.slice(0, 5)) {
		console.log(`    ${cyan(r.symbol ?? "")} ${dim(r.path ?? "")}`);
	}

	console.log(
		`\n${bold("  Unified (final):")} ${result.unified.totalResults} results (${formatMs(result.unified.ms)})`
	);
	console.log(
		dim(
			`    code=${result.unified.codeResults} transcript=${result.unified.transcriptResults}`
		)
	);

	for (const r of result.finalResults) {
		const src = r.source === "code" ? green("code") : yellow("transcript");
		const label = r.symbol ?? r.summary.slice(0, 50);
		console.log(
			`    ${dim(r.score.toFixed(4))} [${src}] ${bold(label)} ${dim(r.path ?? "")}`
		);
	}
}

// ── debug embedding ─────────────────────────────────────────

export interface EmbeddingDebugResult {
	codeNeighbors: Array<{
		distance: number;
		path: string;
		symbol: string;
	}>;
	dimensions: number;
	magnitude: number;
	ms: number;
	solutionNeighbors: Array<{
		distance: number;
		prompt: string;
		timestamp: string;
	}>;
	text: string;
}

export async function debugEmbedding(
	text: string
): Promise<EmbeddingDebugResult> {
	ensureProviderReady();

	const t0 = performance.now();
	const vector = await embedText(text);
	const ms = performance.now() - t0;

	const magnitude = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));

	const conn = await getConnection();
	const tables = await conn.tableNames();

	let codeNeighbors: EmbeddingDebugResult["codeNeighbors"] = [];
	if (tables.includes("code_symbols")) {
		const table = await conn.openTable("code_symbols");
		const rows = (await table.search(vector).limit(10).toArray()) as Record<
			string,
			unknown
		>[];
		codeNeighbors = rows.map((r) => ({
			symbol: r.symbol as string,
			path: r.path as string,
			distance: (r._distance as number) ?? 0,
		}));
	}

	let solutionNeighbors: EmbeddingDebugResult["solutionNeighbors"] = [];
	if (tables.includes("solutions")) {
		const table = await conn.openTable("solutions");
		const rows = (await table.search(vector).limit(10).toArray()) as Record<
			string,
			unknown
		>[];
		solutionNeighbors = rows.map((r) => ({
			prompt: ((r.prompt as string) ?? "").slice(0, 100),
			timestamp: (r.timestamp as string) ?? "",
			distance: (r._distance as number) ?? 0,
		}));
	}

	return {
		text: text.slice(0, 200),
		dimensions: vector.length,
		magnitude: Math.round(magnitude * 1000) / 1000,
		ms,
		codeNeighbors,
		solutionNeighbors,
	};
}

function printEmbeddingDebug(result: EmbeddingDebugResult): void {
	console.log(bold(`\n  Embedding Debug: "${truncate(result.text, 60)}"`));
	console.log(
		dim(
			`  ${result.dimensions}d, magnitude=${result.magnitude}, embed time=${formatMs(result.ms)}\n`
		)
	);

	if (result.codeNeighbors.length > 0) {
		console.log(bold("  Nearest code symbols:"));
		for (const n of result.codeNeighbors) {
			const sim = (1 - n.distance).toFixed(4);
			console.log(`    ${dim(sim)} ${cyan(n.symbol)} ${dim(n.path)}`);
		}
	} else {
		console.log(dim("  No code index available"));
	}

	if (result.solutionNeighbors.length > 0) {
		console.log(bold("\n  Nearest solutions:"));
		for (const n of result.solutionNeighbors) {
			const sim = (1 - n.distance).toFixed(4);
			console.log(
				`    ${dim(sim)} ${truncate(n.prompt, 70)} ${dim(n.timestamp)}`
			);
		}
	} else {
		console.log(dim("  No solutions index available"));
	}
}

// ── debug cleanup ───────────────────────────────────────────

export interface CleanupResult {
	removedDuplicates: number;
	removedStale: number;
}

async function removeStaleFromIndex(root: string): Promise<number> {
	let removed = 0;
	const indexedPaths = await getIndexedCodePaths();
	for (const p of indexedPaths) {
		const fullPath = p.startsWith("/") ? p : join(root, p);
		if (!existsSync(fullPath)) {
			await deleteCodeChunksByPath(p);
			removed++;
		}
	}
	return removed;
}

async function removeDuplicatesFromIndex(): Promise<number> {
	const conn = await getConnection();
	const tables = await conn.tableNames();
	if (!tables.includes("code_symbols")) {
		return 0;
	}

	const allSymbols = await listAllSymbols(10_000);
	const table = await conn.openTable("code_symbols");
	const seen = new Set<string>();
	let removed = 0;

	for (const s of allSymbols) {
		const key = `${s.path}:${s.symbol}`;
		if (!seen.has(key)) {
			seen.add(key);
			continue;
		}
		const escaped = s.symbol.replace(/'/g, "''");
		const pathEscaped = s.path.replace(/'/g, "''");
		try {
			const rows = (await table
				.query()
				.where(`symbol = '${escaped}' AND path = '${pathEscaped}'`)
				.limit(100)
				.toArray()) as Record<string, unknown>[];

			for (let i = 1; i < rows.length; i++) {
				const id = (rows[i] as Record<string, unknown>).id as string;
				await table.delete(`id = '${id}'`);
				removed++;
			}
		} catch {
			// best effort dedup
		}
	}
	return removed;
}

export async function debugCleanup(): Promise<CleanupResult> {
	const root = process.cwd();
	const removedStale = await removeStaleFromIndex(root);
	const removedDuplicates = await removeDuplicatesFromIndex();
	return { removedStale, removedDuplicates };
}

// ── debug symbol ────────────────────────────────────────────

export interface SymbolDebugResult {
	callers: CodeResult[];
	definition: CodeResult | null;
	embeddingNeighbors: Array<{
		distance: number;
		path: string;
		symbol: string;
	}>;
	importers: CodeResult[];
}

async function findEmbeddingNeighbors(
	definition: CodeResult,
	symbolName: string
): Promise<SymbolDebugResult["embeddingNeighbors"]> {
	const vector = await embedText(
		`${definition.symbolType} ${definition.symbol} ${definition.body.slice(0, 500)}`
	);
	const conn = await getConnection();
	const tables = await conn.tableNames();
	if (!tables.includes("code_symbols")) {
		return [];
	}

	const table = await conn.openTable("code_symbols");
	const rows = (await table.search(vector).limit(11).toArray()) as Record<
		string,
		unknown
	>[];
	return rows
		.filter((r) => (r.symbol as string) !== symbolName)
		.slice(0, 10)
		.map((r) => ({
			symbol: r.symbol as string,
			path: r.path as string,
			distance: (r._distance as number) ?? 0,
		}));
}

export async function debugSymbol(
	symbolName: string
): Promise<SymbolDebugResult> {
	ensureProviderReady();
	const definition = await findSymbolByName(symbolName);

	const embeddingNeighbors = definition
		? await findEmbeddingNeighbors(definition, symbolName)
		: [];

	const { findCallers, findImporters } = await import("../core/code-store.ts");
	const callers = await findCallers(symbolName);
	const importers = await findImporters(symbolName);

	return { definition, callers, importers, embeddingNeighbors };
}

function printSymbolDebug(result: SymbolDebugResult, name: string): void {
	if (!result.definition) {
		console.log(red(`\n  Symbol "${name}" not found in index`));
		return;
	}

	const def = result.definition;
	console.log(
		`${bold(`\n  ${def.symbolType} ${cyan(def.symbol)}`)}${dim(` in ${def.path}`)}`
	);
	console.log(dim(`  body: ${def.body.length} chars`));
	if (def.calls) {
		console.log(`  calls: ${def.calls}`);
	}
	if (def.imports) {
		console.log(`  imports: ${def.imports}`);
	}

	if (result.callers.length > 0) {
		console.log(bold(`\n  Called by (${result.callers.length}):`));
		for (const c of result.callers.slice(0, 10)) {
			console.log(`    ${cyan(c.symbol)} ${dim(c.path)}`);
		}
	}
	if (result.importers.length > 0) {
		console.log(bold(`\n  Imported by (${result.importers.length}):`));
		for (const c of result.importers.slice(0, 10)) {
			console.log(`    ${cyan(c.symbol)} ${dim(c.path)}`);
		}
	}
	if (result.embeddingNeighbors.length > 0) {
		console.log(bold("\n  Semantically similar:"));
		for (const n of result.embeddingNeighbors.slice(0, 8)) {
			const sim = (1 - n.distance).toFixed(4);
			console.log(`    ${dim(sim)} ${cyan(n.symbol)} ${dim(n.path)}`);
		}
	}
}

// ── debug summarize ─────────────────────────────────────────

export interface SummarizeDebugResult {
	diffSummary: string;
	existingSummary: string;
	ms: number;
	newSummary: string;
	prompt: string;
	quality: {
		filesReferenced: string[];
		hasSpecificSymbols: boolean;
		lengthChars: number;
		sentenceCount: number;
	};
	response: string;
}

export async function debugSummarize(
	query: string
): Promise<SummarizeDebugResult> {
	ensureProviderReady();

	const queryVector = await embedText(query);
	const results = await searchSolutions(queryVector, 1, { queryText: query });

	if (results.length === 0) {
		throw new Error("No matching chunks found. Run sync first.");
	}

	const chunk = results[0]!.chunk;
	const t0 = performance.now();
	const newSummary = await summarizeChunk(
		chunk.prompt,
		chunk.response,
		chunk.diffSummary
	);
	const ms = performance.now() - t0;

	const filePattern = /[\w/.-]+\.(?:ts|tsx|js|jsx|py|go|rs)/g;
	const filesReferenced = [
		...new Set(newSummary.match(filePattern) ?? []),
	].slice(0, 10);

	const symbolPattern = /(?:function|class|interface|type|const)\s+(\w{3,})/g;
	const symbolMatches = [...newSummary.matchAll(symbolPattern)];
	const freeformSymbols = newSummary
		.split(/\s+/)
		.filter((w: string) => /^[a-z][a-zA-Z]{4,}$/.test(w) && w.includes(""));

	return {
		prompt: chunk.prompt.slice(0, 500),
		response: chunk.response.slice(0, 500),
		diffSummary: chunk.diffSummary.slice(0, 300),
		existingSummary: chunk.summary,
		newSummary,
		ms,
		quality: {
			lengthChars: newSummary.length,
			sentenceCount: newSummary.split(/[.!?]+/).filter(Boolean).length,
			filesReferenced,
			hasSpecificSymbols:
				symbolMatches.length > 0 || freeformSymbols.length > 0,
		},
	};
}

// ── debug pipeline ──────────────────────────────────────────

export interface PipelineDebugResult {
	checkpointId: string;
	chunks: Array<{
		diffSummary: string;
		embeddingTextLen: number;
		filesChanged: string[];
		id: string;
		language: string;
		promptPreview: string;
		responsePreview: string;
		summary: string;
		symbols: string[];
	}>;
	embedding: {
		dimensions: number;
		magnitude: number;
		ms: number;
		nearestNeighbors: Array<{
			distance: number;
			id: string;
			summary: string;
		}>;
	};
	sessionCount: number;
	summarization: {
		ms: number;
		summaries: string[];
	};
	transcriptEntries: number;
}

export async function debugPipeline(
	limit = 1
): Promise<PipelineDebugResult | null> {
	const checkpoints = await parseAllCheckpoints();
	if (checkpoints.length === 0) {
		return null;
	}

	const cp = checkpoints.at(-1)!;

	let totalEntries = 0;
	for (const s of cp.sessions) {
		totalEntries += s.transcript.length;
	}

	const chunks = chunkCheckpoints([cp]);
	if (chunks.length === 0) {
		return {
			checkpointId: cp.id,
			sessionCount: cp.sessions.length,
			transcriptEntries: totalEntries,
			chunks: [],
			summarization: { ms: 0, summaries: [] },
			embedding: { dimensions: 0, magnitude: 0, ms: 0, nearestNeighbors: [] },
		};
	}

	const chunkInfos = chunks.slice(0, limit).map((c) => ({
		id: c.id,
		promptPreview: c.prompt.slice(0, 200),
		responsePreview: c.response.slice(0, 200),
		diffSummary: c.diffSummary.slice(0, 200),
		filesChanged: c.metadata.filesChanged,
		symbols: c.metadata.symbols ?? [],
		language: c.metadata.language ?? "",
		embeddingTextLen: c.embeddingText.length,
		summary: "",
	}));

	ensureProviderReady();

	const t0 = performance.now();
	const summaries: string[] = [];
	for (const c of chunks.slice(0, limit)) {
		const s = await summarizeChunk(c.prompt, c.response, c.diffSummary);
		summaries.push(s);
	}
	const sumMs = performance.now() - t0;

	for (let i = 0; i < chunkInfos.length; i++) {
		const info = chunkInfos[i];
		const summary = summaries[i];
		if (info && summary) {
			info.summary = summary;
		}
	}

	const firstChunk = chunks[0]!;
	const embText = `${summaries[0] ?? ""}\n\n${firstChunk.embeddingText}`;
	const t1 = performance.now();
	const vector = await embedText(embText);
	const embMs = performance.now() - t1;

	const magnitude = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));

	let nearestNeighbors: PipelineDebugResult["embedding"]["nearestNeighbors"] =
		[];
	const conn = await getConnection();
	const tables = await conn.tableNames();
	if (tables.includes("solutions")) {
		const table = await conn.openTable("solutions");
		const rows = (await table.search(vector).limit(5).toArray()) as Record<
			string,
			unknown
		>[];
		nearestNeighbors = rows.map((r) => ({
			id: (r.id as string) ?? "",
			summary: ((r.summary as string) ?? "").slice(0, 100),
			distance: (r._distance as number) ?? 0,
		}));
	}

	return {
		checkpointId: cp.id,
		sessionCount: cp.sessions.length,
		transcriptEntries: totalEntries,
		chunks: chunkInfos,
		summarization: { ms: sumMs, summaries },
		embedding: {
			dimensions: vector.length,
			magnitude: Math.round(magnitude * 1000) / 1000,
			ms: embMs,
			nearestNeighbors,
		},
	};
}

// ── CLI dispatcher ──────────────────────────────────────────

function printDebugHelp(): void {
	console.log(`
  ${bold("yep debug")} — diagnostic tools for code index & search

  Subcommands:
    ${cyan("parse <file>")}      Parse a file, show extracted symbols & compare with index
    ${cyan("index")}             Health check: stale entries, duplicates, missing files
    ${cyan("search <query>")}    Step-by-step search debug: vector, FTS, exact, RRF, unified
    ${cyan("embedding <text>")}  Embed text and find nearest neighbors in both indexes
    ${cyan("symbol <name>")}     Inspect a symbol: definition, callers, importers, neighbors
    ${cyan("cleanup")}           Remove stale entries and duplicates from index

  Examples:
    yep debug parse src/app.tsx
    yep debug index
    yep debug search "authentication middleware"
    yep debug embedding "user login flow"
    yep debug symbol searchCode
    yep debug cleanup
`);
}

export async function debugCommand(): Promise<void> {
	const subcommand = process.argv[3];
	const arg = process.argv[4];

	if (!subcommand || subcommand === "help" || subcommand === "--help") {
		printDebugHelp();
		return;
	}

	requireInit();

	switch (subcommand) {
		case "parse": {
			if (!arg) {
				console.error(red("  Usage: yep debug parse <file>"));
				process.exit(1);
			}
			const result = await debugParse(arg);
			printParseDebug(result);
			break;
		}
		case "index": {
			const result = await debugIndex();
			printIndexDebug(result);
			break;
		}
		case "search": {
			if (!arg) {
				console.error(red("  Usage: yep debug search <query>"));
				process.exit(1);
			}
			ensureProviderReady();
			const result = await debugSearch(arg);
			printSearchDebug(result);
			break;
		}
		case "embedding": {
			if (!arg) {
				console.error(red("  Usage: yep debug embedding <text>"));
				process.exit(1);
			}
			ensureProviderReady();
			const result = await debugEmbedding(arg);
			printEmbeddingDebug(result);
			break;
		}
		case "symbol": {
			if (!arg) {
				console.error(red("  Usage: yep debug symbol <name>"));
				process.exit(1);
			}
			ensureProviderReady();
			const result = await debugSymbol(arg);
			printSymbolDebug(result, arg);
			break;
		}
		case "cleanup": {
			console.log(bold("\n  Running cleanup..."));
			const result = await debugCleanup();
			console.log(
				green(
					`  Done: removed ${result.removedStale} stale, ${result.removedDuplicates} duplicates`
				)
			);
			break;
		}
		default:
			console.error(red(`  Unknown debug subcommand: ${subcommand}`));
			printDebugHelp();
			process.exit(1);
	}
}
