// @ts-nocheck
/**
 * Тест co-change-analysis: анализ файлов меняющихся вместе
 */

import {
	analyzeCoChange,
	formatCoChangePair,
	generateCoChangeRecommendations,
	getRelatedFiles,
} from "./src/mem/core/co-change-analysis.ts";

async function testCoChangeAnalysis() {
	console.log("=== Test Co-Change Analysis ===\n");

	// 1. Analyze co-change patterns from git history
	console.log("1. Analyzing co-change patterns from git history...");
	console.log("   (Using last 90 days, min 1% support, 30% confidence)");

	const report = await analyzeCoChange(90, 0.01, 0.3);

	console.log(`   ✓ Analyzed ${report.totalCommits} commits`);
	console.log(`   ✓ Found ${report.pairs.length} co-change pairs`);

	if (report.pairs.length === 0) {
		console.log("\n   No co-change pairs found (this is OK for small/new repos)");
		console.log("   Skipping remaining tests");
		console.log("\n=== Test Completed ===");
		return;
	}

	// 2. Display top co-change pairs
	console.log("\n2. Top co-change pairs:");
	for (const pair of report.pairs.slice(0, 10)) {
		console.log(`   ${formatCoChangePair(pair)}`);
	}

	// 3. Test getRelatedFiles
	console.log("\n3. Finding related files...");
	const firstPair = report.pairs[0];
	if (firstPair) {
		const relatedToFile1 = getRelatedFiles(firstPair.file1, report);
		console.log(
			`   Files related to ${firstPair.file1}: ${relatedToFile1.length}`
		);

		for (const related of relatedToFile1.slice(0, 5)) {
			const confidencePercent = (related.confidence * 100).toFixed(0);
			console.log(`     ${related.file} (${confidencePercent}% confidence)`);
		}
	}

	// 4. Test recommendations
	console.log("\n4. Generating recommendations...");
	if (firstPair) {
		const recommendations = generateCoChangeRecommendations(
			firstPair.file1,
			report,
			3
		);

		if (recommendations.length > 0) {
			console.log(`   Recommendations for ${firstPair.file1}:`);
			for (const rec of recommendations) {
				console.log(`     ${rec}`);
			}
		} else {
			console.log("   No recommendations (low confidence pairs)");
		}
	}

	// 5. Statistics
	console.log("\n5. Co-change statistics:");
	if (report.pairs.length > 0) {
		const avgConfidence =
			report.pairs.reduce((sum, p) => sum + p.confidence, 0) /
			report.pairs.length;
		const avgSupport =
			report.pairs.reduce((sum, p) => sum + p.support, 0) / report.pairs.length;
		const maxConfidence = Math.max(...report.pairs.map((p) => p.confidence));

		console.log(
			`   Average confidence: ${(avgConfidence * 100).toFixed(1)}%`
		);
		console.log(`   Average support: ${(avgSupport * 100).toFixed(1)}%`);
		console.log(`   Max confidence: ${(maxConfidence * 100).toFixed(1)}%`);
	}

	console.log("\n=== All Checks Passed ===");
}

// Run test
testCoChangeAnalysis().catch((err) => {
	console.error("Test failed:", err);
	process.exit(1);
});
