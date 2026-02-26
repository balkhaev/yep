// @ts-nocheck
/**
 * Тест multi-signal ranking
 */

import type { CodeResult } from "./src/mem/core/code-store.ts";
import {
	clearGraphStore,
	type GraphEdge,
	initGraphStore,
	insertGraphEdges,
} from "./src/mem/core/graph-store.ts";
import { computePageRank } from "./src/mem/core/pagerank.ts";
import {
	computeFinalScore,
	computeRankingSignals,
	formatSignals,
	rerankSearchResults,
	type SearchContext,
} from "./src/mem/core/ranking.ts";

console.log("\n=== Тест multi-signal ranking ===\n");

// Тестовые результаты поиска
const testResults: Array<{ chunk: CodeResult; score: number }> = [
	{
		chunk: {
			id: "1",
			symbol: "processData",
			symbolType: "function",
			path: "/src/utils/processor.ts",
			language: "typescript",
			body: "function processData(data) { return validate(data); }",
			summary: "Process data",
			commit: "abc123",
			lastModified: new Date(
				Date.now() - 2 * 24 * 60 * 60 * 1000
			).toISOString(), // 2 days ago
			calls: "validate",
			imports: "",
		},
		score: 0.85,
	},
	{
		chunk: {
			id: "2",
			symbol: "getData",
			symbolType: "function",
			path: "/src/api/handler.ts",
			language: "typescript",
			body: "async function getData() { const result = await fetch(); if (!result) throw new Error(); return transform(result); }",
			summary: "Get data from API",
			commit: "abc124",
			lastModified: new Date(
				Date.now() - 60 * 24 * 60 * 60 * 1000
			).toISOString(), // 60 days ago
			calls: "fetch,transform",
			imports: "fetch",
		},
		score: 0.75,
	},
	{
		chunk: {
			id: "3",
			symbol: "data",
			symbolType: "constant",
			path: "/src/config/data.ts",
			language: "typescript",
			body: "export const data = { api: 'http://example.com' };",
			summary: "Data config",
			commit: "abc125",
			lastModified: new Date(
				Date.now() - 1 * 24 * 60 * 60 * 1000
			).toISOString(), // 1 day ago
			calls: "",
			imports: "",
		},
		score: 0.7,
	},
];

async function runTest() {
	// 1. Создать граф для PageRank
	console.log("1. Подготовка графа для PageRank...");
	await clearGraphStore();
	await initGraphStore();

	const graphEdges: GraphEdge[] = [
		{
			id: "main:processData:calls",
			source: "main",
			target: "processData",
			edgeType: "calls",
			sourceFile: "/src/app.ts",
			count: 1,
			commit: "test",
			lastModified: new Date().toISOString(),
		},
		{
			id: "handler:processData:calls",
			source: "handler",
			target: "processData",
			edgeType: "calls",
			sourceFile: "/src/api.ts",
			count: 1,
			commit: "test",
			lastModified: new Date().toISOString(),
		},
		{
			id: "main:getData:calls",
			source: "main",
			target: "getData",
			edgeType: "calls",
			sourceFile: "/src/app.ts",
			count: 1,
			commit: "test",
			lastModified: new Date().toISOString(),
		},
	];

	await insertGraphEdges(graphEdges);
	await computePageRank(); // Прогреть кэш
	console.log("   ✓ Граф готов\n");

	// 2. Вычислить сигналы для первого результата
	console.log("2. Сигналы ранжирования для 'processData':");
	const signals1 = await computeRankingSignals(
		testResults[0].chunk,
		"process data",
		0.85,
		0.5
	);
	console.log(`   ${formatSignals(signals1)}`);
	const finalScore1 = computeFinalScore(signals1);
	console.log(`   Финальный score: ${finalScore1.toFixed(3)}\n`);

	// 3. Rerank всех результатов
	console.log("3. Reranking результатов поиска:");
	console.log("   Запрос: 'data'\n");

	const reranked = await rerankSearchResults(testResults, "data");

	console.log("   Результаты после reranking:");
	for (let i = 0; i < reranked.length; i++) {
		const result = reranked[i];
		console.log(
			`\n   ${i + 1}. ${result.chunk.symbol} (${result.chunk.symbolType})`
		);
		console.log(`      Path: ${result.chunk.path}`);
		console.log(
			`      Original score: ${testResults.find((r) => r.chunk.id === result.chunk.id)?.score.toFixed(3)}`
		);
		console.log(`      Final score: ${result.finalScore.toFixed(3)}`);
		console.log("      Top signals:");
		console.log(`        - Vector: ${result.signals.vectorScore.toFixed(3)}`);
		console.log(
			`        - Exact match: ${result.signals.exactMatch.toFixed(3)}`
		);
		console.log(
			`        - Popularity: ${result.signals.popularityScore.toFixed(3)}`
		);
		console.log(
			`        - Freshness: ${result.signals.freshnessScore.toFixed(3)}`
		);
		console.log(
			`        - Complexity: ${result.signals.complexityScore.toFixed(3)}`
		);
	}

	// 4. Context-aware reranking
	console.log("\n\n4. Context-aware reranking:");
	console.log("   Контекст: currentDirectory = '/src/utils'\n");

	const context: SearchContext = {
		currentDirectory: "/src/utils",
	};

	const rerankedWithContext = await rerankSearchResults(
		testResults,
		"data",
		context
	);

	console.log("   Результаты с контекстом:");
	for (let i = 0; i < rerankedWithContext.length; i++) {
		const result = rerankedWithContext[i];
		console.log(`\n   ${i + 1}. ${result.chunk.symbol}`);
		console.log(`      Path: ${result.chunk.path}`);
		console.log(`      Final score: ${result.finalScore.toFixed(3)}`);
		console.log(
			`      Context score: ${result.signals.contextScore.toFixed(3)}`
		);
	}

	// 5. Проверки
	console.log("\n\n5. Проверки:");

	// processData должен иметь высокий popularity score (2 callers)
	const processDataResult = reranked.find(
		(r) => r.chunk.symbol === "processData"
	);
	const hasHighPopularity =
		processDataResult && processDataResult.signals.popularityScore > 0.5;
	console.log(
		`   - processData имеет высокую популярность: ${hasHighPopularity ? "✓" : "❌"}`
	);

	// data (constant) должен иметь высокий exact match для запроса "data"
	const dataResult = reranked.find((r) => r.chunk.symbol === "data");
	const hasHighExactMatch = dataResult && dataResult.signals.exactMatch === 1.0;
	console.log(
		`   - 'data' имеет точное совпадение: ${hasHighExactMatch ? "✓" : "❌"}`
	);

	// processData должен иметь высокий freshness (2 дня назад)
	const hasHighFreshness =
		processDataResult && processDataResult.signals.freshnessScore === 1.0;
	console.log(
		`   - processData свежий (2 дня): ${hasHighFreshness ? "✓" : "❌"}`
	);

	// С контекстом processData должен быть выше (в /src/utils)
	const processDataContextRank = rerankedWithContext.findIndex(
		(r) => r.chunk.symbol === "processData"
	);
	const hasContextBoost = processDataContextRank === 0;
	console.log(
		`   - processData поднялся с контекстом: ${hasContextBoost ? "✓" : "❌"}`
	);

	if (hasHighPopularity && hasHighExactMatch && hasHighFreshness) {
		console.log("\n✓ Основные проверки пройдены!");
	}

	console.log("\n=== Тест завершён ===\n");
}

await runTest();
