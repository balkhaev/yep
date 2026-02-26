import type {
	CodeSearchHit,
	CodeStats,
	DiffEntry,
	MemStats,
	SearchHit,
} from "./types.ts";

type CodeInsights = Awaited<
	ReturnType<typeof import("../mem/core/code-store.ts")["getCodeInsights"]>
>;

type RecentSession = {
	agent: string;
	filesChanged: string;
	summary: string;
	timestamp: string;
};

function cleanText(raw: string): string {
	return raw
		.replace(/<[^>]+>/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

export function truncate(text: string, maxLen = 60): string {
	if (text.length <= maxLen) {
		return text;
	}
	return `${text.slice(0, maxLen)}…`;
}

export function formatTime(ts: string): string {
	if (!ts) {
		return "—";
	}
	return new Date(ts).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function wrapParagraph(
	paragraph: string,
	width: number,
	maxLines: number,
	out: string[]
): void {
	const words = paragraph.split(" ");
	let cur = "";
	for (const w of words) {
		if (out.length >= maxLines) {
			return;
		}
		if (cur.length + w.length + 1 > width && cur) {
			out.push(cur);
			cur = w;
		} else {
			cur = cur ? `${cur} ${w}` : w;
		}
	}
	if (cur && out.length < maxLines) {
		out.push(cur);
	}
}

export function wrapLines(text: string, width = 68, maxLines = 6): string[] {
	const out: string[] = [];
	const paragraphs = text.split("\n");
	for (const paragraph of paragraphs) {
		if (out.length >= maxLines) {
			break;
		}
		if (paragraph.length <= width) {
			out.push(paragraph);
			continue;
		}
		wrapParagraph(paragraph, width, maxLines, out);
	}
	if (text.length > out.join(" ").length) {
		const last = out.at(-1) ?? "";
		out[out.length - 1] = `${last.slice(0, width - 1)}…`;
	}
	return out;
}

export const SYMBOL_ICONS: Record<string, string> = {
	function: "ƒ",
	method: "ƒ",
	class: "C",
	interface: "I",
	type: "T",
	enum: "E",
	component: "◇",
};

export function shortenPath(fullPath: string): string {
	const cwd = process.cwd();
	const homeDir = process.env.HOME || process.env.USERPROFILE || "";

	// Попытка заменить полный рабочий путь
	if (fullPath.startsWith(cwd)) {
		return fullPath.slice(cwd.length).replace(/^\/+/, "");
	}

	// Попытка заменить домашнюю директорию на ~
	if (homeDir && fullPath.startsWith(homeDir)) {
		return `~${fullPath.slice(homeDir.length)}`;
	}

	// Убрать начальный слеш если есть
	return fullPath.replace(/^\/+/, "");
}

async function ensureProvider(): Promise<void> {
	const config = await import("../mem/lib/config.ts");
	if (!config.isInitialized()) {
		throw new Error("Not initialized. Run yep enable first.");
	}
	if (config.getProvider() === "openai") {
		const key = config.resolveOpenAIKey();
		if (!key) {
			throw new Error("OpenAI API key not configured");
		}
		process.env.OPENAI_API_KEY = key;
	}
}

export async function loadStats(): Promise<MemStats> {
	try {
		const config = await import("../mem/lib/config.ts");
		if (!config.isInitialized()) {
			return {
				initialized: false,
				provider: "openai",
				embeddingModel: "",
				totalChunks: 0,
				hasTable: false,
				topFiles: [],
				agents: [],
			};
		}
		const cfg = config.readConfig();
		const { getStats } = await import("../mem/core/store.ts");
		const stats = await getStats();
		return {
			initialized: true,
			provider: cfg.provider,
			embeddingModel: config.getEmbeddingModel(),
			...stats,
		};
	} catch {
		return {
			initialized: false,
			provider: "unknown",
			embeddingModel: "",
			totalChunks: 0,
			hasTable: false,
			topFiles: [],
			agents: [],
		};
	}
}

export async function doSearch(query: string): Promise<SearchHit[]> {
	await ensureProvider();
	const { embedText } = await import("../mem/core/embedder.ts");
	const { searchSolutions } = await import("../mem/core/store.ts");
	const vector = await embedText(query);
	const results = await searchSolutions(vector, 5, { queryText: query });
	return results.map((r) => ({
		summary: cleanText(r.chunk.summary || r.chunk.prompt),
		prompt: cleanText(r.chunk.prompt),
		response: cleanText(r.chunk.response),
		diffSummary: cleanText(r.chunk.diffSummary),
		filesChanged: r.chunk.filesChanged,
		score: r.score,
		timestamp: r.chunk.timestamp,
		agent: r.chunk.agent,
		tokensUsed: r.chunk.tokensUsed,
		confidence: r.chunk.confidence,
		source: r.chunk.source,
		language: r.chunk.language,
		symbols: r.chunk.symbols,
	}));
}

export async function doDiff(file: string): Promise<DiffEntry[]> {
	await ensureProvider();
	const { searchByFile } = await import("../mem/core/store.ts");
	const results = await searchByFile(file);
	return results.map((r) => ({
		summary: cleanText(r.summary || r.prompt),
		prompt: cleanText(r.prompt),
		response: cleanText(r.response),
		diffSummary: r.diffSummary ? cleanText(r.diffSummary) : "",
		timestamp: r.timestamp,
		agent: r.agent,
		tokensUsed: r.tokensUsed,
	}));
}

export async function doCodeSearch(query: string): Promise<CodeSearchHit[]> {
	await ensureProvider();
	const { embedText } = await import("../mem/core/embedder.ts");
	const { searchCode } = await import("../mem/core/code-store.ts");
	const vector = await embedText(query);
	const results = await searchCode(vector, 15, { queryText: query });
	return results.map((r) => ({
		symbol: r.chunk.symbol,
		symbolType: r.chunk.symbolType,
		path: r.chunk.path,
		body: r.chunk.body,
		language: r.chunk.language,
		calls: r.chunk.calls,
		imports: r.chunk.imports,
		score: r.score,
		summary: r.chunk.summary ?? "",
		commit: r.chunk.commit ?? "",
		lastModified: r.chunk.lastModified ?? "",
	}));
}

export async function loadCodeRelations(symbolName: string): Promise<{
	callers: import("./types.ts").CodeRelation[];
	callees: import("./types.ts").CodeRelation[];
	importers: import("./types.ts").CodeRelation[];
}> {
	const { findCallers, findCallees, findImporters } = await import(
		"../mem/core/code-store.ts"
	);
	const [callers, callees, importers] = await Promise.all([
		findCallers(symbolName),
		findCallees(symbolName),
		findImporters(symbolName),
	]);
	const toRelation = (r: {
		symbol: string;
		symbolType: string;
		path: string;
	}) => ({
		symbol: r.symbol,
		symbolType: r.symbolType,
		path: r.path,
	});
	return {
		callers: callers.map(toRelation),
		callees: callees.map(toRelation),
		importers: importers.map(toRelation),
	};
}

export async function loadCodeStats(): Promise<CodeStats> {
	try {
		const { getCodeStats } = await import("../mem/core/code-store.ts");
		return await getCodeStats();
	} catch {
		return { totalSymbols: 0, hasTable: false, languages: [] };
	}
}

export async function loadCodeInsights(): Promise<CodeInsights | null> {
	try {
		const { getCodeInsights } = await import("../mem/core/code-store.ts");
		return await getCodeInsights();
	} catch {
		return null;
	}
}

export async function loadRecentSessions(limit = 5): Promise<RecentSession[]> {
	try {
		await ensureProvider();
		const { getRecentSessions } = await import("../mem/core/store.ts");
		return await getRecentSessions(limit);
	} catch {
		return [];
	}
}
