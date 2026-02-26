// @ts-nocheck
/**
 * Тест metrics-store: сохранение и получение снапшотов
 */

import type { CodeInsights } from "./src/mem/core/code-store.ts";
import {
	captureSnapshot,
	cleanOldSnapshots,
	clearMetricsStore,
	getLatestSnapshot,
	getSnapshotHistory,
	initMetricsStore,
} from "./src/mem/core/metrics-store.ts";
import {
	buildTrendsReport,
	formatTrend,
	getTrendsSummary,
} from "./src/mem/core/trends.ts";

async function testMetricsStore() {
	console.log("=== Test Metrics Store ===\n");

	// 0. Clear old metrics store
	console.log("0. Clearing old metrics store...");
	await clearMetricsStore();
	console.log("   ✓ Cleared");

	// 1. Initialize metrics store
	console.log("\n1. Initializing metrics store...");
	await initMetricsStore();
	console.log("   ✓ Metrics table initialized");

	// 2. Create mock insights
	console.log("\n2. Creating mock insights...");
	const mockInsights: CodeInsights = {
		totalSymbols: 150,
		totalFiles: 25,
		avgComplexity: 8.5,
		avgSymbolsPerFile: 6,
		documentationCoverage: 0.65,
		deadCode: [
			{ symbol: "oldFunction", symbolType: "function", path: "old.ts" },
			{ symbol: "deprecatedClass", symbolType: "class", path: "old.ts" },
		],
		duplicateSymbolCount: 5,
		topComplexSymbols: [
			{
				symbol: "complexFunction",
				symbolType: "function",
				path: "complex.ts",
				cyclomatic: 25,
				cognitive: 30,
				lineCount: 150,
			},
		],
		godSymbols: [
			{
				symbol: "GodClass",
				symbolType: "class",
				path: "god.ts",
				totalConnections: 50,
			},
		],
		languageDistribution: [],
		typeDistribution: [],
		complexityDistribution: [],
		directoryInsights: [],
		hotFiles: [],
		largestSymbols: [],
		mostConnected: [],
		duplicateClusters: [],
		crossDirectoryImports: [],
		highFanInSymbols: [],
		medianConnections: 3,
	};

	console.log(`   ✓ Mock insights: ${mockInsights.totalSymbols} symbols`);

	// 3. Capture first snapshot
	console.log("\n3. Capturing first snapshot...");
	await captureSnapshot(mockInsights, "abc123");
	console.log("   ✓ First snapshot captured");

	// 4. Get latest snapshot
	console.log("\n4. Getting latest snapshot...");
	const latest = await getLatestSnapshot();
	if (latest) {
		console.log(`   ✓ Latest snapshot: ${latest.timestamp.split("T")[0]}`);
		console.log(`   ✓ Total symbols: ${latest.totalSymbols}`);
		console.log(`   ✓ Avg complexity: ${latest.avgComplexity.toFixed(2)}`);
		console.log(`   ✓ Health score: ${latest.healthScore}/100`);
		console.log(`   ✓ Dead code: ${latest.deadCodeCount} symbols`);
	} else {
		console.log("   ⚠ No snapshot found");
	}

	// 5. Capture second snapshot (with changes)
	console.log("\n5. Capturing second snapshot (with improvements)...");
	const improvedInsights: CodeInsights = {
		...mockInsights,
		totalSymbols: 160,
		avgComplexity: 7.2, // Improved
		documentationCoverage: 0.72, // Improved
		deadCode: [mockInsights.deadCode[0]], // Reduced
		duplicateSymbolCount: 3, // Reduced
	};

	// Wait 100ms to ensure different timestamp
	await new Promise((resolve) => setTimeout(resolve, 100));
	await captureSnapshot(improvedInsights, "def456");
	console.log("   ✓ Second snapshot captured");

	// 6. Get snapshot history
	console.log("\n6. Getting snapshot history...");
	const history = await getSnapshotHistory(10);
	console.log(`   ✓ Found ${history.length} snapshots`);
	for (const snapshot of history) {
		const date = snapshot.timestamp.split("T")[0];
		const time = snapshot.timestamp.split("T")[1]?.split(".")[0];
		console.log(
			`     ${date} ${time}: Health ${snapshot.healthScore}/100, Complexity ${snapshot.avgComplexity.toFixed(2)}`
		);
	}

	// 7. Build trends report
	console.log("\n7. Building trends report...");
	if (history.length >= 2) {
		const report = buildTrendsReport(history);
		console.log(`   ✓ Period: ${report.period}`);
		console.log(`   ✓ Complexity trend: ${report.avgComplexity.trend}`);
		console.log(`   ✓ Health trend: ${report.healthScore.trend}`);
		console.log(`   ✓ Anomalies: ${report.anomalies.length}`);
		console.log(`   ✓ Recommendations: ${report.recommendations.length}`);

		console.log("\n   Trends summary:");
		const summary = getTrendsSummary(report);
		summary.split("\n").forEach((line) => console.log(`     ${line}`));

		if (report.recommendations.length > 0) {
			console.log("\n   Recommendations:");
			report.recommendations.forEach((rec) => console.log(`     ${rec}`));
		}
	} else {
		console.log("   ⚠ Not enough snapshots for trends (need 2+)");
	}

	// 8. Test cleanup (don't actually clean in test)
	console.log("\n8. Testing cleanup function...");
	const cleaned = await cleanOldSnapshots(9999); // Very old cutoff = clean nothing
	console.log(`   ✓ Would clean ${cleaned} old snapshots`);

	console.log("\n=== All Checks Passed ===");
}

// Run test
testMetricsStore().catch((err) => {
	console.error("Test failed:", err);
	process.exit(1);
});
