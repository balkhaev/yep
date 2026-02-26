import { embedText } from "../core/embedder.ts";
import {
	type SearchFilter,
	searchSolutions,
	vectorOnlySearchSolutions,
} from "../core/store.ts";
import { ensureProviderReady } from "../lib/config.ts";
import { requireInit } from "../lib/guards.ts";
import type { GoldenEntry, QueryIntent } from "./golden.ts";
import { initGoldenSet, loadGoldenSet } from "./golden.ts";
import {
	computeKeywordHits,
	type EvalResult,
	type MetricsSummary,
	summarizeMetrics,
} from "./metrics.ts";

type SearchMode = "vector" | "hybrid" | "hybrid+rerank";

function toTexts(
	results: Array<{
		chunk: { summary: string; prompt: string; embeddingText: string };
	}>
): string[] {
	return results.map(
		(r) => `${r.chunk.summary} ${r.chunk.prompt} ${r.chunk.embeddingText}`
	);
}

async function runSearch(
	query: string,
	queryVector: number[],
	mode: SearchMode,
	topK: number
): Promise<string[]> {
	if (mode === "vector") {
		const results = await vectorOnlySearchSolutions(queryVector, topK);
		return toTexts(results);
	}

	const filter: SearchFilter = {
		queryText: query,
		rerank: mode === "hybrid+rerank",
	};
	const results = await searchSolutions(queryVector, topK, filter);
	return toTexts(results);
}

interface EvalResultWithType extends EvalResult {
	queryType?: QueryIntent;
}

async function evaluateMode(
	goldenSet: GoldenEntry[],
	mode: SearchMode,
	topK: number
): Promise<{
	mode: SearchMode;
	results: EvalResultWithType[];
	summary: MetricsSummary;
}> {
	const results: EvalResultWithType[] = [];

	for (const entry of goldenSet) {
		const queryVector = await embedText(entry.query);
		const resultTexts = await runSearch(entry.query, queryVector, mode, topK);
		const keywordHits = computeKeywordHits(entry.expectedKeywords, resultTexts);

		results.push({
			queryKeywords: entry.expectedKeywords,
			keywordHits,
			resultTexts,
			resultIds: entry.expectedIds ?? [],
			queryType: entry.queryType,
		});
	}

	return { mode, results, summary: summarizeMetrics(results) };
}

function formatBreakdownByType(
	results: EvalResultWithType[],
	mode: SearchMode
): string[] {
	const byType: Record<string, EvalResult[]> = {};

	for (const result of results) {
		const type = result.queryType ?? "unknown";
		if (!byType[type]) {
			byType[type] = [];
		}
		byType[type]?.push(result);
	}

	const lines: string[] = [];
	lines.push("");
	lines.push(`### Breakdown by Query Type (${mode})`);
	lines.push("");
	lines.push("| Type | Count | Recall@k | MRR | nDCG |");
	lines.push("|------|-------|----------|-----|------|");

	for (const [type, typeResults] of Object.entries(byType)) {
		const summary = summarizeMetrics(typeResults);
		lines.push(
			`| ${type} | ${typeResults.length} | ${summary.avgRecall.toFixed(3)} | ${summary.avgMRR.toFixed(3)} | ${summary.avgNDCG.toFixed(3)} |`
		);
	}

	return lines;
}

function formatReport(
	evaluations: Array<{
		mode: SearchMode;
		results: EvalResultWithType[];
		summary: MetricsSummary;
	}>
): string {
	const lines = [
		"# Search Quality Evaluation Report",
		"",
		`Queries: ${evaluations[0]?.summary.totalQueries ?? 0}`,
		"",
		"| Mode | Recall@k | MRR | nDCG |",
		"|------|----------|-----|------|",
	];

	for (const ev of evaluations) {
		const { mode, summary } = ev;
		lines.push(
			`| ${mode} | ${summary.avgRecall.toFixed(3)} | ${summary.avgMRR.toFixed(3)} | ${summary.avgNDCG.toFixed(3)} |`
		);
	}

	lines.push("");

	const best = evaluations.reduce((a, b) =>
		a.summary.avgRecall + a.summary.avgMRR + a.summary.avgNDCG >
		b.summary.avgRecall + b.summary.avgMRR + b.summary.avgNDCG
			? a
			: b
	);
	lines.push(`**Best mode:** ${best.mode}`);

	// Add breakdown by query type for best mode
	const breakdown = formatBreakdownByType(best.results, best.mode);
	lines.push(...breakdown);

	return lines.join("\n");
}

export async function evalCommand(): Promise<void> {
	requireInit();
	ensureProviderReady();

	initGoldenSet();
	const goldenSet = loadGoldenSet();

	if (goldenSet.length === 0) {
		console.log(
			"No golden set found. Add queries to .yep-mem/eval/golden.json"
		);
		return;
	}

	console.log(`Running evaluation with ${goldenSet.length} queries...\n`);

	const topK = 10;
	const modes: SearchMode[] = ["vector", "hybrid", "hybrid+rerank"];
	const evaluations: Array<{
		mode: SearchMode;
		results: EvalResultWithType[];
		summary: MetricsSummary;
	}> = [];

	for (const mode of modes) {
		console.log(`  Evaluating: ${mode}...`);
		const result = await evaluateMode(goldenSet, mode, topK);
		evaluations.push(result);
	}

	const report = formatReport(evaluations);
	console.log(`\n${report}`);
}
