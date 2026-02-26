/**
 * Query intent classification for adaptive reranking
 * Different query types need different reranking weights
 */

export type QueryIntent =
	| "recent_change"
	| "how_it_works"
	| "find_code"
	| "debug"
	| "default";

export interface RerankWeights {
	fileOverlap: number;
	keywordDensity: number;
	recency: number;
	symbolMatch: number;
}

/**
 * Default weights (balanced)
 */
const DEFAULT_WEIGHTS: RerankWeights = {
	recency: 0.15,
	fileOverlap: 0.25,
	keywordDensity: 0.35,
	symbolMatch: 0.25,
};

/**
 * Intent-specific weights
 * Each intent has weights optimized for that query type
 */
const INTENT_WEIGHTS: Record<QueryIntent, RerankWeights> = {
	// Recent changes: prioritize recency and file overlap
	recent_change: {
		recency: 0.5, // 50% - freshness is critical
		fileOverlap: 0.2, // 20% - file context matters
		keywordDensity: 0.2, // 20% - keywords still relevant
		symbolMatch: 0.1, // 10% - symbols less important
	},

	// How it works: prioritize keyword density and symbol match
	how_it_works: {
		recency: 0.05, // 5% - age doesn't matter much
		fileOverlap: 0.15, // 15% - file context helps
		keywordDensity: 0.5, // 50% - keyword matching is key
		symbolMatch: 0.3, // 30% - symbol names matter
	},

	// Find code: prioritize symbol match
	find_code: {
		recency: 0.05, // 5% - age doesn't matter
		fileOverlap: 0.2, // 20% - file context helps
		keywordDensity: 0.25, // 25% - keywords help
		symbolMatch: 0.5, // 50% - symbol names are critical
	},

	// Debug: balanced with emphasis on file overlap and keywords
	debug: {
		recency: 0.2, // 20% - recent issues more relevant
		fileOverlap: 0.3, // 30% - file context important
		keywordDensity: 0.3, // 30% - error messages/keywords
		symbolMatch: 0.2, // 20% - affected symbols
	},

	// Default: balanced weights
	default: DEFAULT_WEIGHTS,
};

/**
 * Patterns for detecting query intent
 */
const INTENT_PATTERNS: Record<Exclude<QueryIntent, "default">, RegExp[]> = {
	recent_change: [
		/\b(last|latest|recent|newest|new)\b/i,
		/\b(changed?|updated?|modified)\b/i,
		/\b(yesterday|today|week|session)\b/i,
		/\bwhat.*(changed?|added?|updated?|modified)\b/i,
		/\b(current|now)\b/i,
	],

	how_it_works: [
		/\bhow\s+(does|do|is|are|can|to)\b/i,
		/\bwhat\s+(is|are|does|do)\b/i,
		/\b(explain|understand|learn|know)\b/i,
		/\b(works?|working|implement(s|ed|ation)?)\b/i,
		/\b(mechanism|approach|strategy|pattern)\b/i,
	],

	find_code: [
		/\b(find|locate|search|where)\b/i,
		/\bwhere\s+(is|are|can|to)\b/i,
		/\b(function|class|method|component|module)\s+\w+/i,
		/\b\w+(function|class|method|component)\b/i,
		/\bcode\s+for\b/i,
	],

	debug: [
		/\b(error|bug|issue|problem|fail|crash|break)\b/i,
		/\b(fix|solve|debug|troubleshoot)\b/i,
		/\b(why|when|where).*(error|fail|break|wrong)\b/i,
		/\b(not\s+work|doesn't\s+work|isn't\s+work)\b/i,
		/\b(exception|stack\s+trace)\b/i,
	],
};

/**
 * Detect query intent from text
 * @param query - Query text to classify
 * @returns QueryIntent type
 */
export function detectQueryIntent(query: string): QueryIntent {
	const normalized = query.toLowerCase().trim();

	// Check each intent's patterns
	for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
		const matchCount = patterns.filter((pattern) =>
			pattern.test(normalized)
		).length;

		// If 2+ patterns match, it's likely this intent
		if (matchCount >= 2) {
			return intent as QueryIntent;
		}

		// If 1 pattern matches and query is short (< 50 chars), use it
		if (matchCount === 1 && normalized.length < 50) {
			return intent as QueryIntent;
		}
	}

	return "default";
}

/**
 * Get reranking weights for a query
 * @param query - Query text
 * @returns Weights optimized for the query's intent
 */
export function getWeightsForQuery(query: string): RerankWeights {
	const intent = detectQueryIntent(query);
	return INTENT_WEIGHTS[intent];
}

/**
 * Get intent and weights for a query (for debugging)
 */
export function analyzeQuery(query: string): {
	intent: QueryIntent;
	weights: RerankWeights;
} {
	const intent = detectQueryIntent(query);
	return {
		intent,
		weights: INTENT_WEIGHTS[intent],
	};
}
