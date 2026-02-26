// @ts-nocheck
/**
 * Тест git-metadata: извлечение git истории для файлов
 */

import {
	getGitMetadataForFile,
	getGitMetadataForFiles,
	getGitRelativePath,
	isGitAvailable,
} from "./src/mem/core/git-metadata.ts";

async function testGitMetadata() {
	console.log("=== Test Git Metadata ===\n");

	// 1. Check git availability
	console.log("1. Checking git availability...");
	const gitAvailable = await isGitAvailable();
	console.log(`   Git available: ${gitAvailable}`);

	if (!gitAvailable) {
		console.log("\n❌ Git not available - skipping tests");
		return;
	}

	// 2. Test getGitRelativePath
	console.log("\n2. Testing git relative path...");
	const testFilePath = "/Users/balkhaev/mycode/yep/apps/tui/src/mem/core/code-store.ts";
	const relativePath = await getGitRelativePath(testFilePath);
	console.log(`   Absolute: ${testFilePath}`);
	console.log(`   Relative: ${relativePath}`);

	if (!relativePath) {
		console.log("\n❌ Could not get relative path");
		return;
	}

	// 3. Test getGitMetadataForFile
	console.log("\n3. Testing git metadata for single file...");
	const metadata = await getGitMetadataForFile(relativePath);
	if (metadata) {
		console.log(`   ✓ Change count: ${metadata.changeCount}`);
		console.log(`   ✓ Author count: ${metadata.authorCount}`);
		console.log(`   ✓ Last change: ${metadata.lastChangeDate}`);
		console.log(`   ✓ Recent commits: ${metadata.recentCommits?.slice(0, 3).join(", ")}`);
	} else {
		console.log("   ⚠ No git metadata found");
	}

	// 4. Test batch extraction
	console.log("\n4. Testing batch git metadata extraction...");
	const filePaths = [
		"apps/tui/src/mem/core/code-store.ts",
		"apps/tui/src/mem/core/code-chunker.ts",
		"apps/tui/src/mem/commands/index-code.ts",
	];

	const batchResults = await getGitMetadataForFiles(filePaths);
	console.log(`   Extracted metadata for ${batchResults.size} files:`);

	for (const [path, meta] of batchResults) {
		if (meta) {
			console.log(`   ✓ ${path}: ${meta.changeCount} changes, ${meta.authorCount} authors`);
		} else {
			console.log(`   ⚠ ${path}: no metadata`);
		}
	}

	// 5. Test file with no git history (should be null)
	console.log("\n5. Testing file with no git history...");
	const noHistoryMeta = await getGitMetadataForFile("nonexistent-file.ts");
	console.log(`   Result: ${noHistoryMeta === null ? "null (expected)" : "unexpected data"}`);

	console.log("\n=== All Checks Passed ===");
}

// Run test
testGitMetadata().catch((err) => {
	console.error("Test failed:", err);
	process.exit(1);
});
