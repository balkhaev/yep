// @ts-nocheck
/**
 * Тест enriched embeddings
 */

import type { CodeSymbol } from "./src/mem/core/code-chunker.ts";
import {
	buildEnrichedEmbeddingText,
	buildSimpleEmbeddingText,
} from "./src/mem/core/enriched-embedding.ts";
import {
	clearGraphStore,
	type GraphEdge,
	initGraphStore,
	insertGraphEdges,
} from "./src/mem/core/graph-store.ts";

console.log("\n=== Тест enriched embeddings ===\n");

// Тестовый символ
const testSymbol: CodeSymbol = {
	name: "processData",
	symbolType: "function",
	path: "/src/utils/processor.ts",
	startLine: 10,
	endLine: 25,
	jsDoc: "Process data and validate it before transformation",
	body: `async function processData(data: string[]): Promise<Result> {
  const validated = await validate(data);
  const transformed = transform(validated);
  return { success: true, data: transformed };
}`,
	calls: ["validate", "transform"],
	imports: ["Result"],
	metadata: {
		parameters: [{ name: "data", type: "string[]" }],
		returnType: "Promise<Result>",
		isAsync: true,
		visibility: "public",
		isExported: true,
	},
};

async function runTest() {
	console.log("1. Простой embedding (без графа):");
	const simpleEmbedding = buildSimpleEmbeddingText(testSymbol);
	console.log(simpleEmbedding);
	console.log(`   Длина: ${simpleEmbedding.length} символов\n`);

	console.log("2. Enriched embedding (без графа):");
	const enrichedNoGraph = await buildEnrichedEmbeddingText(testSymbol, false);
	console.log(enrichedNoGraph);
	console.log(`   Длина: ${enrichedNoGraph.length} символов\n`);

	// Подготовить граф
	console.log("3. Создание тестового графа...");
	await clearGraphStore();
	await initGraphStore();

	const graphEdges: GraphEdge[] = [
		// main вызывает processData
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
		// api handler вызывает processData
		{
			id: "handleRequest:processData:calls",
			source: "handleRequest",
			target: "processData",
			edgeType: "calls",
			sourceFile: "/src/api.ts",
			count: 2,
			commit: "test",
			lastModified: new Date().toISOString(),
		},
		// processData вызывает validate
		{
			id: "processData:validate:calls",
			source: "processData",
			target: "validate",
			edgeType: "calls",
			sourceFile: "/src/utils/processor.ts",
			count: 1,
			commit: "test",
			lastModified: new Date().toISOString(),
		},
		// processData вызывает transform
		{
			id: "processData:transform:calls",
			source: "processData",
			target: "transform",
			edgeType: "calls",
			sourceFile: "/src/utils/processor.ts",
			count: 1,
			commit: "test",
			lastModified: new Date().toISOString(),
		},
	];

	await insertGraphEdges(graphEdges);
	console.log("   ✓ Граф создан\n");

	console.log("4. Enriched embedding (с графом):");
	const enrichedWithGraph = await buildEnrichedEmbeddingText(testSymbol, true);
	console.log(enrichedWithGraph);
	console.log(`   Длина: ${enrichedWithGraph.length} символов\n`);

	// Проверить что граф информация присутствует
	console.log("5. Проверка содержимого:");
	const hasCallers = enrichedWithGraph.includes("used by:");
	const hasCallees = enrichedWithGraph.includes("calls:");
	const hasSignature = enrichedWithGraph.includes("signature:");
	const hasMetadata = enrichedWithGraph.includes("async");

	console.log(`   - Включены callers (used by): ${hasCallers ? "✓" : "❌"}`);
	console.log(`   - Включены callees (calls): ${hasCallees ? "✓" : "❌"}`);
	console.log(`   - Включена signature: ${hasSignature ? "✓" : "❌"}`);
	console.log(`   - Включены metadata (async): ${hasMetadata ? "✓" : "❌"}`);

	// Проверить конкретные имена
	const hasMainCaller = enrichedWithGraph.includes("main");
	const hasHandlerCaller = enrichedWithGraph.includes("handleRequest");
	const hasValidateCallee = enrichedWithGraph.includes("validate");
	const hasTransformCallee = enrichedWithGraph.includes("transform");

	console.log(`\n   - Caller "main": ${hasMainCaller ? "✓" : "❌"}`);
	console.log(`   - Caller "handleRequest": ${hasHandlerCaller ? "✓" : "❌"}`);
	console.log(`   - Callee "validate": ${hasValidateCallee ? "✓" : "❌"}`);
	console.log(`   - Callee "transform": ${hasTransformCallee ? "✓" : "❌"}`);

	if (hasCallers && hasCallees && hasSignature && hasMetadata) {
		console.log("\n✓ Все проверки пройдены!");
	} else {
		console.log("\n❌ Некоторые проверки не прошли");
	}

	console.log("\n=== Тест завершён ===\n");
}

await runTest();
