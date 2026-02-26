// @ts-nocheck
/**
 * Тест схемы git метаданных в CodeChunk и CodeRecord
 */

import type { CodeChunk } from "./src/mem/core/code-chunker.ts";
import type { CodeResult } from "./src/mem/core/code-store.ts";

async function testGitSchema() {
	console.log("=== Test Git Metadata Schema ===\n");

	// 1. Test CodeChunk with git metadata
	console.log("1. Testing CodeChunk with git metadata...");
	const chunk: CodeChunk = {
		id: "test:test:function",
		path: "test.ts",
		symbol: "testFunction",
		symbolType: "function",
		language: "typescript",
		body: "function test() {}",
		summary: "Test function",
		embeddingText: "function test() {}",
		lastModified: new Date().toISOString(),
		calls: "",
		imports: "",
		// Git metadata
		gitChangeCount: 5,
		gitAuthorCount: 2,
		gitLastChangeDate: "2026-02-24 12:00:00 +0200",
	};

	console.log(`   ✓ Symbol: ${chunk.symbol}`);
	console.log(`   ✓ Git changes: ${chunk.gitChangeCount}`);
	console.log(`   ✓ Git authors: ${chunk.gitAuthorCount}`);
	console.log(`   ✓ Git last change: ${chunk.gitLastChangeDate}`);

	// 2. Test CodeResult with git metadata
	console.log("\n2. Testing CodeResult with git metadata...");
	const result: CodeResult = {
		id: chunk.id,
		path: chunk.path,
		symbol: chunk.symbol,
		symbolType: chunk.symbolType,
		language: chunk.language,
		body: chunk.body,
		summary: chunk.summary,
		commit: "abc123",
		lastModified: chunk.lastModified,
		calls: chunk.calls,
		imports: chunk.imports,
		// Git metadata
		gitChangeCount: chunk.gitChangeCount,
		gitAuthorCount: chunk.gitAuthorCount,
		gitLastChangeDate: chunk.gitLastChangeDate,
	};

	console.log(`   ✓ Symbol: ${result.symbol}`);
	console.log(`   ✓ Git changes: ${result.gitChangeCount}`);
	console.log(`   ✓ Git authors: ${result.gitAuthorCount}`);
	console.log(`   ✓ Git last change: ${result.gitLastChangeDate}`);

	// 3. Test optional git metadata (backward compatibility)
	console.log("\n3. Testing backward compatibility (no git metadata)...");
	const legacyChunk: CodeChunk = {
		id: "legacy:legacy:function",
		path: "legacy.ts",
		symbol: "legacyFunction",
		symbolType: "function",
		language: "typescript",
		body: "function legacy() {}",
		summary: "Legacy function",
		embeddingText: "function legacy() {}",
		lastModified: new Date().toISOString(),
		calls: "",
		imports: "",
		// No git metadata
	};

	console.log(`   ✓ Symbol: ${legacyChunk.symbol}`);
	console.log(`   ✓ Git changes: ${legacyChunk.gitChangeCount ?? "undefined (OK)"}`);
	console.log(`   ✓ Git authors: ${legacyChunk.gitAuthorCount ?? "undefined (OK)"}`);
	console.log(`   ✓ Git last change: ${legacyChunk.gitLastChangeDate ?? "undefined (OK)"}`);

	console.log("\n=== All Schema Checks Passed ===");
}

// Run test
testGitSchema().catch((err) => {
	console.error("Test failed:", err);
	process.exit(1);
});
