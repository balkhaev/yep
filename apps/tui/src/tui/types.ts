export type View = "search" | "code" | "status" | "diff" | "insights";

export type InsightsTab =
	| "overview"
	| "trends"
	| "risk"
	| "complexity"
	| "dependencies"
	| "quality"
	| "patterns"
	| "cochange"
	| "directories";

export interface MemStats {
	agents: string[];
	embeddingModel: string;
	hasTable: boolean;
	initialized: boolean;
	provider: string;
	topFiles: Array<{ file: string; count: number }>;
	totalChunks: number;
}

export interface SearchHit {
	agent: string;
	confidence: number;
	diffSummary: string;
	filesChanged: string;
	language: string;
	prompt: string;
	response: string;
	score: number;
	source: string;
	summary: string;
	symbols: string;
	timestamp: string;
	tokensUsed: number;
}

export interface DiffEntry {
	agent: string;
	diffSummary: string;
	prompt: string;
	response: string;
	summary: string;
	timestamp: string;
	tokensUsed: number;
}

export interface CodeSearchHit {
	body: string;
	calls: string;
	commit: string;
	imports: string;
	language: string;
	lastModified: string;
	path: string;
	score: number;
	summary: string;
	symbol: string;
	symbolType: string;
}

export interface CodeRelation {
	path: string;
	symbol: string;
	symbolType: string;
}

export interface CodeStats {
	hasTable: boolean;
	languages: string[];
	totalSymbols: number;
}

export interface CodeInsights {
	avgComplexity: number;
	avgSymbolsPerFile: number;
	crossDirectoryImports: Array<{
		from: string;
		to: string;
		count: number;
	}>;
	deadCode: Array<{ path: string; symbol: string; symbolType: string }>;
	documentationCoverage: number;
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
		count: number;
		language: string;
		percentage: number;
	}>;
	largestSymbols: Array<{
		lineCount: number;
		path: string;
		symbol: string;
		symbolType: string;
	}>;
	medianConnections: number;
	mostConnected: Array<{
		calleeCount: number;
		callerCount: number;
		importerCount: number;
		path: string;
		symbol: string;
		symbolType: string;
		totalConnections: number;
	}>;
	totalFiles: number;
	totalSymbols: number;
	typeDistribution: Array<{
		count: number;
		percentage: number;
		symbolType: string;
	}>;
}

export interface RecentSession {
	agent: string;
	filesChanged: string;
	summary: string;
	timestamp: string;
}
