export type View = "menu" | "search" | "code" | "status" | "diff";

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
	diffSummary: string;
	filesChanged: string;
	prompt: string;
	response: string;
	score: number;
	summary: string;
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
	imports: string;
	language: string;
	path: string;
	score: number;
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
