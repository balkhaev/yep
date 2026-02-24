const API_BASE =
	typeof import.meta.env?.VITE_API_BASE === "string"
		? import.meta.env.VITE_API_BASE
		: "http://localhost:3838";

export interface MemConfig {
	createdAt: string;
	embeddingModel: string | null;
	lastCodeIndexCommit: string | null;
	lastIndexedCommit: string | null;
	localSyncOffsets: Record<string, number>;
	ollamaBaseUrl: string | null;
	openaiApiKey: string | null;
	provider: "openai" | "ollama";
	scope: string;
	summarizerModel: string | null;
}

export interface StoreStats {
	agents: string[];
	hasTable: boolean;
	topFiles: Array<{ file: string; count: number }>;
	totalChunks: number;
}

export interface StatusResponse {
	config: MemConfig | null;
	initialized: boolean;
	stats: StoreStats | null;
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

export interface SearchResponse {
	results: SearchResult[];
}

export interface DiffResponse {
	file: string;
	results: SolutionResult[];
}

export interface SyncEvent {
	data: {
		step?: string;
		message: string;
		total?: number;
	};
	event: string;
}

export interface CodeStats {
	hasTable: boolean;
	languages: string[];
	totalSymbols: number;
}

export interface SymbolInfo {
	path: string;
	symbol: string;
	symbolType: string;
}

export interface FileInfo {
	lastModified: string;
	path: string;
	symbolCount: number;
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

export interface SymbolContext {
	callees: CodeResult[];
	callers: CodeResult[];
	definition: CodeResult;
	importers: CodeResult[];
}

export interface UnifiedResult {
	body?: string;
	filesChanged?: string;
	id: string;
	path?: string;
	prompt?: string;
	response?: string;
	score: number;
	source: "all" | "transcript" | "code";
	summary: string;
	symbol?: string;
	symbolType?: string;
	timestamp?: string;
}

export interface RecentSession {
	agent: string;
	filesChanged: string;
	summary: string;
	timestamp: string;
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

export interface CodeRecommendation {
	affectedSymbols: Array<{ path: string; symbol: string }>;
	category:
		| "complexity"
		| "duplication"
		| "dead-code"
		| "health"
		| "structure"
		| "architecture"
		| "modularization";
	description: string;
	id: string;
	severity: "info" | "warning" | "critical";
	title: string;
}

export interface IndexCodeEvent {
	data: {
		step?: string;
		message: string;
		totalSymbols?: number;
		totalFiles?: number;
	};
	event: string;
}

function parseSSELines<
	T extends { event: string; data: Record<string, unknown> },
>(lines: string[], onEvent: (event: T) => void): void {
	let currentEvent = "";
	for (const line of lines) {
		if (line.startsWith("event:")) {
			currentEvent = line.slice(6).trim();
		} else if (line.startsWith("data:")) {
			try {
				const data = JSON.parse(line.slice(5).trim());
				onEvent({ event: currentEvent, data } as T);
			} catch {
				// skip malformed
			}
		}
	}
}

async function readSSEStream<
	T extends { event: string; data: Record<string, unknown> },
>(res: Response, onEvent: (event: T) => void): Promise<void> {
	const reader = res.body?.getReader();
	if (!reader) {
		return;
	}
	const decoder = new TextDecoder();
	let buffer = "";

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";
		parseSSELines(lines, onEvent);
	}
}

function streamSSE<T extends { event: string; data: Record<string, unknown> }>(
	path: string,
	onEvent: (event: T) => void
): AbortController {
	const controller = new AbortController();

	fetch(`${API_BASE}${path}`, {
		method: "POST",
		signal: controller.signal,
	})
		.then((res) => readSSEStream(res, onEvent))
		.catch((err) => {
			if (err instanceof DOMException && err.name === "AbortError") {
				return;
			}
			onEvent({
				event: "error",
				data: { message: err instanceof Error ? err.message : String(err) },
			} as T);
		});

	return controller;
}

async function request<T>(
	path: string,
	init?: RequestInit & { signal?: AbortSignal }
): Promise<T> {
	const res = await fetch(`${API_BASE}${path}`, {
		...init,
		headers: { "Content-Type": "application/json", ...init?.headers },
	});
	if (!res.ok) {
		const body = await res.text();
		throw new Error(`API error ${res.status}: ${body}`);
	}
	return res.json() as Promise<T>;
}

export const api = {
	health: () => request<{ ok: boolean }>("/health"),

	status: () => request<StatusResponse>("/status"),

	config: {
		get: () => request<MemConfig>("/config"),
		update: (partial: Partial<MemConfig>) =>
			request<MemConfig>("/config", {
				method: "POST",
				body: JSON.stringify(partial),
			}),
	},

	search: (params: {
		query: string;
		top_k?: number;
		min_score?: number;
		agent?: string;
		files?: string[];
	}) =>
		request<SearchResponse>("/search", {
			method: "POST",
			body: JSON.stringify(params),
		}),

	diff: (file: string) =>
		request<DiffResponse>(`/diff?file=${encodeURIComponent(file)}`),

	sync: (onEvent: (event: SyncEvent) => void): AbortController =>
		streamSSE<SyncEvent>("/sync", onEvent),

	reset: (reindex = false) =>
		request<{ dropped: boolean; reinitialized: boolean; message: string }>(
			"/reset",
			{
				method: "POST",
				body: JSON.stringify({ reindex }),
			}
		),

	code: {
		stats: () => request<CodeStats>("/code/stats"),
		symbols: (type?: string, limit?: number) => {
			const params = new URLSearchParams();
			if (type) {
				params.set("type", type);
			}
			if (limit) {
				params.set("limit", String(limit));
			}
			const qs = params.toString();
			return request<{ symbols: SymbolInfo[] }>(
				`/code/symbols${qs ? `?${qs}` : ""}`
			);
		},
		files: (limit?: number) =>
			request<{ files: FileInfo[] }>(
				`/code/files${limit ? `?limit=${limit}` : ""}`
			),
		symbol: (name: string) =>
			request<SymbolContext>(`/code/symbol/${encodeURIComponent(name)}`),
		insights: () => request<CodeInsights>("/code/insights"),
		recommendations: (force = false) =>
			request<{ recommendations: CodeRecommendation[] }>(
				`/code/recommendations${force ? "?force=true" : ""}`
			),
		indexCode: (onEvent: (event: IndexCodeEvent) => void): AbortController =>
			streamSSE<IndexCodeEvent>("/index-code", onEvent),
	},

	searchAll: (params: {
		query: string;
		top_k?: number;
		source?: "all" | "transcript" | "code";
		min_score?: number;
	}) =>
		request<{ results: UnifiedResult[] }>("/search-all", {
			method: "POST",
			body: JSON.stringify(params),
		}),

	recent: (limit?: number) =>
		request<{ sessions: RecentSession[] }>(
			`/recent${limit ? `?limit=${limit}` : ""}`
		),
};
