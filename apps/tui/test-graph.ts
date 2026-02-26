// @ts-nocheck
/**
 * Интеграционный тест графа зависимостей и PageRank
 */

import {
	clearGraphStore,
	type GraphEdge,
	getAllGraphSymbols,
	getCallerCount,
	getIncomingEdges,
	getOutgoingEdges,
	initGraphStore,
	insertGraphEdges,
} from "./src/mem/core/graph-store.ts";
import {
	computePageRank,
	getTopPageRankSymbols,
	normalizePageRankScores,
} from "./src/mem/core/pagerank.ts";

console.log("\n=== Тест графа зависимостей и PageRank ===\n");

// Тестовые данные - простой граф вызовов
const testEdges: GraphEdge[] = [
	// main вызывает parseFile и processData
	{
		id: "main:parseFile:calls",
		source: "main",
		target: "parseFile",
		edgeType: "calls",
		sourceFile: "/app.ts",
		count: 1,
		commit: "test",
		lastModified: new Date().toISOString(),
	},
	{
		id: "main:processData:calls",
		source: "main",
		target: "processData",
		edgeType: "calls",
		sourceFile: "/app.ts",
		count: 1,
		commit: "test",
		lastModified: new Date().toISOString(),
	},
	// parseFile вызывает readFile и parseJSON
	{
		id: "parseFile:readFile:calls",
		source: "parseFile",
		target: "readFile",
		edgeType: "calls",
		sourceFile: "/parser.ts",
		count: 1,
		commit: "test",
		lastModified: new Date().toISOString(),
	},
	{
		id: "parseFile:parseJSON:calls",
		source: "parseFile",
		target: "parseJSON",
		edgeType: "calls",
		sourceFile: "/parser.ts",
		count: 1,
		commit: "test",
		lastModified: new Date().toISOString(),
	},
	// processData вызывает validate и transform
	{
		id: "processData:validate:calls",
		source: "processData",
		target: "validate",
		edgeType: "calls",
		sourceFile: "/processor.ts",
		count: 2,
		commit: "test",
		lastModified: new Date().toISOString(),
	},
	{
		id: "processData:transform:calls",
		source: "processData",
		target: "transform",
		edgeType: "calls",
		sourceFile: "/processor.ts",
		count: 1,
		commit: "test",
		lastModified: new Date().toISOString(),
	},
	// transform вызывает validate (цикл)
	{
		id: "transform:validate:calls",
		source: "transform",
		target: "validate",
		edgeType: "calls",
		sourceFile: "/transformer.ts",
		count: 1,
		commit: "test",
		lastModified: new Date().toISOString(),
	},
];

async function runTest() {
	try {
		// 1. Очистить и инициализировать
		console.log("1. Инициализация...");
		await clearGraphStore();
		await initGraphStore();
		console.log("   ✓ Граф инициализирован\n");

		// 2. Вставить тестовые ребра
		console.log("2. Вставка тестовых данных...");
		await insertGraphEdges(testEdges);
		console.log(`   ✓ Вставлено ${testEdges.length} ребер\n`);

		// 3. Проверить запросы графа
		console.log("3. Проверка запросов графа:");

		const mainOutgoing = await getOutgoingEdges("main");
		console.log(
			`   - main вызывает: ${mainOutgoing.map((e) => e.target).join(", ")}`
		);

		const validateIncoming = await getIncomingEdges("validate");
		console.log(
			`   - validate вызывается из: ${validateIncoming.map((e) => e.source).join(", ")}`
		);

		const validateCallers = await getCallerCount("validate");
		console.log(`   - validate имеет ${validateCallers} вызывающих\n`);

		// 4. Получить все символы
		console.log("4. Все символы в графе:");
		const allSymbols = await getAllGraphSymbols();
		console.log(`   ${allSymbols.join(", ")}\n`);

		// 5. Вычислить PageRank
		console.log("5. Вычисление PageRank...");
		const startTime = Date.now();
		const scores = await computePageRank();
		const elapsed = Date.now() - startTime;
		console.log(`   ✓ PageRank вычислен за ${elapsed}ms\n`);

		// 6. Показать топ символов
		console.log("6. Топ символов по PageRank:");
		const topSymbols = await getTopPageRankSymbols(10);
		for (const { symbol, score } of topSymbols) {
			console.log(`   - ${symbol}: ${score.toFixed(4)}`);
		}
		console.log();

		// 7. Нормализованные scores
		console.log("7. Нормализованные scores (0-1):");
		const normalized = normalizePageRankScores(scores);
		const sortedNormalized = Array.from(normalized.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5);
		for (const [symbol, score] of sortedNormalized) {
			console.log(`   - ${symbol}: ${score.toFixed(3)}`);
		}
		console.log();

		// 8. Проверить что validate имеет высокий PageRank (его вызывают 2 функции)
		const validateScore = scores.get("validate") || 0;
		console.log(
			`8. Проверка: validate имеет высокий score (${validateScore.toFixed(4)})`
		);
		if (validateScore > 0.1) {
			console.log("   ✓ Тест пройден\n");
		} else {
			console.log("   ❌ Тест не пройден - score слишком низкий\n");
		}

		console.log("=== Тест завершён успешно ===\n");
	} catch (err) {
		console.error("❌ Ошибка теста:", err);
		throw err;
	}
}

await runTest();
