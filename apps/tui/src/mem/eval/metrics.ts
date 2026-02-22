export interface EvalResult {
	keywordHits: string[];
	queryKeywords: string[];
	resultIds: string[];
	resultTexts: string[];
}

export function recallAtK(result: EvalResult, _k?: number): number {
	if (result.queryKeywords.length === 0) {
		return 0;
	}
	return result.keywordHits.length / result.queryKeywords.length;
}

export function mrr(result: EvalResult): number {
	if (result.queryKeywords.length === 0) {
		return 0;
	}

	for (let i = 0; i < result.resultTexts.length; i++) {
		const text = (result.resultTexts[i] ?? "").toLowerCase();
		const hasRelevant = result.queryKeywords.some((kw) =>
			text.includes(kw.toLowerCase())
		);
		if (hasRelevant) {
			return 1 / (i + 1);
		}
	}
	return 0;
}

export function ndcgAtK(result: EvalResult, k?: number): number {
	const limit = k ?? result.resultTexts.length;
	const relevances: number[] = [];

	for (let i = 0; i < Math.min(limit, result.resultTexts.length); i++) {
		const text = (result.resultTexts[i] ?? "").toLowerCase();
		let rel = 0;
		for (const kw of result.queryKeywords) {
			if (text.includes(kw.toLowerCase())) {
				rel++;
			}
		}
		relevances.push(rel);
	}

	const dcg = relevances.reduce(
		(sum, rel, i) => sum + rel / Math.log2(i + 2),
		0
	);

	const idealRelevances = [...relevances].sort((a, b) => b - a);
	const idcg = idealRelevances.reduce(
		(sum, rel, i) => sum + rel / Math.log2(i + 2),
		0
	);

	return idcg === 0 ? 0 : dcg / idcg;
}

export function computeKeywordHits(
	keywords: string[],
	texts: string[]
): string[] {
	const combined = texts.join(" ").toLowerCase();
	return keywords.filter((kw) => combined.includes(kw.toLowerCase()));
}

export interface MetricsSummary {
	avgMRR: number;
	avgNDCG: number;
	avgRecall: number;
	totalQueries: number;
}

export function summarizeMetrics(results: EvalResult[]): MetricsSummary {
	if (results.length === 0) {
		return { totalQueries: 0, avgRecall: 0, avgMRR: 0, avgNDCG: 0 };
	}

	let sumRecall = 0;
	let sumMRR = 0;
	let sumNDCG = 0;

	for (const r of results) {
		sumRecall += recallAtK(r);
		sumMRR += mrr(r);
		sumNDCG += ndcgAtK(r);
	}

	const n = results.length;
	return {
		totalQueries: n,
		avgRecall: sumRecall / n,
		avgMRR: sumMRR / n,
		avgNDCG: sumNDCG / n,
	};
}
