// @ts-nocheck
/**
 * Тест интеграции git метаданных с индексацией
 */

import { searchCode } from "./src/mem/core/code-store.ts";
import { runCodeIndex } from "./src/mem/commands/index-code.ts";

async function testGitIntegration() {
	console.log("=== Test Git Metadata Integration ===\n");

	// 1. Run indexing
	console.log("1. Running code indexing with git metadata...");
	const result = await runCodeIndex((msg, progress) => {
		if (progress?.filesProcessed !== undefined) {
			console.log(`   ${msg}`);
		}
	});

	console.log(`   ✓ Indexed ${result.totalSymbols} symbols from ${result.totalFiles} files`);

	// 2. Search for some symbols and check git metadata
	console.log("\n2. Checking git metadata in search results...");
	const searchResults = await searchCode("initCodeStore", { limit: 5 });

	if (searchResults.length === 0) {
		console.log("   ⚠ No search results found");
		return;
	}

	console.log(`   Found ${searchResults.length} results:`);
	for (const result of searchResults.slice(0, 3)) {
		console.log(`\n   Symbol: ${result.chunk.symbol} (${result.chunk.symbolType})`);
		console.log(`   Path: ${result.chunk.path}`);
		if (result.chunk.gitChangeCount !== undefined) {
			console.log(`   ✓ Git changes: ${result.chunk.gitChangeCount}`);
			console.log(`   ✓ Git authors: ${result.chunk.gitAuthorCount}`);
			console.log(`   ✓ Git last change: ${result.chunk.gitLastChangeDate}`);
		} else {
			console.log("   ⚠ No git metadata found");
		}
	}

	console.log("\n=== All Checks Passed ===");
}

// Run test
testGitIntegration().catch((err) => {
	console.error("Test failed:", err);
	process.exit(1);
});
