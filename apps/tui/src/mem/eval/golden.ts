import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getStorePath } from "../lib/config.ts";

export type QueryIntent =
	| "recent_change"
	| "how_it_works"
	| "find_code"
	| "debug";

export interface GoldenEntry {
	expectedIds?: string[];
	expectedKeywords: string[];
	query: string;
	queryType?: QueryIntent;
}

const GOLDEN_FILE = "golden.json";

function goldenPath(): string {
	const dir = join(getStorePath(), "..");
	return join(dir, "eval", GOLDEN_FILE);
}

function ensureDir(dir: string): void {
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
}

export function loadGoldenSet(): GoldenEntry[] {
	const path = goldenPath();
	if (!existsSync(path)) {
		return [];
	}
	try {
		return JSON.parse(readFileSync(path, "utf-8")) as GoldenEntry[];
	} catch {
		return [];
	}
}

export function saveGoldenSet(entries: GoldenEntry[]): void {
	const path = goldenPath();
	const dir = join(path, "..");
	ensureDir(dir);
	writeFileSync(path, JSON.stringify(entries, null, "\t"));
}

const TEMPLATE: GoldenEntry[] = [
	// recent_change queries (8) - свежесть результатов важна
	{
		query: "What changed in the last session?",
		expectedKeywords: ["session", "changed", "recent", "checkpoint"],
		queryType: "recent_change",
	},
	{
		query: "What files were modified recently?",
		expectedKeywords: ["modified", "files", "changed", "recent"],
		queryType: "recent_change",
	},
	{
		query: "Show me the latest code changes",
		expectedKeywords: ["latest", "code", "changes", "diff"],
		queryType: "recent_change",
	},
	{
		query: "What was worked on yesterday?",
		expectedKeywords: ["yesterday", "worked", "session"],
		queryType: "recent_change",
	},
	{
		query: "Recent updates to the API",
		expectedKeywords: ["recent", "updates", "api"],
		queryType: "recent_change",
	},
	{
		query: "New features added this week",
		expectedKeywords: ["new", "features", "added"],
		queryType: "recent_change",
	},
	{
		query: "Latest bug fixes",
		expectedKeywords: ["latest", "bug", "fix"],
		queryType: "recent_change",
	},
	{
		query: "What's new in the codebase?",
		expectedKeywords: ["new", "codebase", "changes"],
		queryType: "recent_change",
	},

	// how_it_works queries (10) - keyword density важна
	{
		query: "How does vector search work?",
		expectedKeywords: ["vector", "search", "embedding", "lancedb"],
		queryType: "how_it_works",
	},
	{
		query: "How does the chunking algorithm work?",
		expectedKeywords: ["chunking", "algorithm", "chunk", "split"],
		queryType: "how_it_works",
	},
	{
		query: "Explain the caching mechanism",
		expectedKeywords: ["cache", "caching", "mechanism"],
		queryType: "how_it_works",
	},
	{
		query: "How does code indexing work?",
		expectedKeywords: ["code", "indexing", "index", "parser"],
		queryType: "how_it_works",
	},
	{
		query: "How are embeddings generated?",
		expectedKeywords: ["embedding", "generate", "openai", "ollama"],
		queryType: "how_it_works",
	},
	{
		query: "How does deduplication work?",
		expectedKeywords: ["deduplication", "duplicate", "similarity", "cosine"],
		queryType: "how_it_works",
	},
	{
		query: "Explain the sync process",
		expectedKeywords: ["sync", "process", "checkpoint", "index"],
		queryType: "how_it_works",
	},
	{
		query: "How does the MCP server work?",
		expectedKeywords: ["mcp", "server", "tool", "resource"],
		queryType: "how_it_works",
	},
	{
		query: "How is code complexity calculated?",
		expectedKeywords: ["complexity", "calculate", "metric"],
		queryType: "how_it_works",
	},
	{
		query: "How does the reranking algorithm work?",
		expectedKeywords: ["rerank", "algorithm", "score", "boost"],
		queryType: "how_it_works",
	},

	// find_code queries (8) - symbol match важен
	{
		query: "Where is the searchSolutions function?",
		expectedKeywords: ["searchSolutions", "function", "store"],
		queryType: "find_code",
	},
	{
		query: "Find the embedder module",
		expectedKeywords: ["embedder", "module", "embedding"],
		queryType: "find_code",
	},
	{
		query: "Where is the chunker defined?",
		expectedKeywords: ["chunker", "defined", "chunk"],
		queryType: "find_code",
	},
	{
		query: "Locate the LSH implementation",
		expectedKeywords: ["lsh", "implementation"],
		queryType: "find_code",
	},
	{
		query: "Find code that handles LanceDB connection",
		expectedKeywords: ["lancedb", "connection", "connect"],
		queryType: "find_code",
	},
	{
		query: "Where is the logger module?",
		expectedKeywords: ["logger", "module", "log"],
		queryType: "find_code",
	},
	{
		query: "Find TypeScript parser code",
		expectedKeywords: ["typescript", "parser", "ast"],
		queryType: "find_code",
	},
	{
		query: "Locate the retry logic",
		expectedKeywords: ["retry", "logic", "exponential", "backoff"],
		queryType: "find_code",
	},

	// debug queries (4) - file overlap важен
	{
		query: "Why is vector search returning empty results?",
		expectedKeywords: ["vector", "search", "empty", "results"],
		queryType: "debug",
	},
	{
		query: "Fix embedding API errors",
		expectedKeywords: ["embedding", "api", "error"],
		queryType: "debug",
	},
	{
		query: "Debug code indexing failures",
		expectedKeywords: ["debug", "code", "indexing", "failure"],
		queryType: "debug",
	},
	{
		query: "Troubleshoot sync lock issues",
		expectedKeywords: ["troubleshoot", "sync", "lock", "issue"],
		queryType: "debug",
	},
];

export function initGoldenSet(): void {
	const path = goldenPath();
	if (existsSync(path)) {
		return;
	}
	saveGoldenSet(TEMPLATE);
}
