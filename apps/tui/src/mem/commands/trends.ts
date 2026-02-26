/**
 * trends.ts - Команда для просмотра трендов метрик кода
 *
 * Usage:
 *   yep trends [--days=30]
 */

import { requireInit } from "../lib/guards.ts";
import { getSnapshotHistory } from "../core/metrics-store.ts";
import { buildTrendsReport, getTrendsSummary } from "../core/trends.ts";

export async function trendsCommand(days = 30): Promise<void> {
	requireInit();

	console.log(`\n📊 Code Quality Trends (last ${days} days)\n`);

	// Get snapshot history
	const snapshots = await getSnapshotHistory(days);

	if (snapshots.length === 0) {
		console.log("No metrics snapshots found.");
		console.log("Run 'yep index-code' to capture your first snapshot.");
		return;
	}

	if (snapshots.length === 1) {
		const snapshot = snapshots[0];
		if (!snapshot) return;
		console.log("Only one snapshot found:");
		console.log(`  Captured: ${snapshot.timestamp.split("T")[0]}`);
		console.log(`  Health Score: ${snapshot.healthScore}/100`);
		console.log(`  Avg Complexity: ${snapshot.avgComplexity.toFixed(2)}`);
		console.log(
			`  Documentation: ${(snapshot.documentationCoverage * 100).toFixed(0)}%`
		);
		console.log(`  Dead Code: ${snapshot.deadCodeCount} symbols`);
		console.log("\nRun 'yep index-code' again to track trends over time.");
		return;
	}

	// Build trends report
	const report = buildTrendsReport(snapshots);

	// Display summary
	console.log(getTrendsSummary(report));

	// Display recommendations
	if (report.recommendations.length > 0) {
		console.log("\n💡 Recommendations:");
		for (const rec of report.recommendations) {
			console.log(`  ${rec}`);
		}
	}

	// Display anomalies
	if (report.anomalies.length > 0) {
		console.log("\n⚠️ Anomalies Detected:");
		for (const anomaly of report.anomalies) {
			console.log(`  ${anomaly}`);
		}
	}

	// Display latest snapshot details
	const latest = snapshots[0];
	if (!latest) return;
	console.log("\n📈 Latest Snapshot:");
	console.log(`  Date: ${latest.timestamp.split("T")[0]}`);
	console.log(`  Commit: ${latest.commit.slice(0, 8)}`);
	console.log(`  Total Symbols: ${latest.totalSymbols}`);
	console.log(`  Total Files: ${latest.totalFiles}`);

	// Parse and display top complex symbols
	try {
		const topComplex = JSON.parse(latest.topComplexSymbols);
		if (topComplex.length > 0) {
			console.log("\n🔥 Most Complex Symbols:");
			for (const sym of topComplex.slice(0, 5)) {
				console.log(
					`  ${sym.symbol} (${sym.symbolType}): ${sym.cyclomatic} complexity`
				);
			}
		}
	} catch {
		// Ignore parse errors
	}

	// Parse and display god symbols
	try {
		const godSymbols = JSON.parse(latest.godSymbols);
		if (godSymbols.length > 0) {
			console.log("\n🔗 Most Connected Symbols:");
			for (const sym of godSymbols.slice(0, 5)) {
				console.log(
					`  ${sym.symbol} (${sym.symbolType}): ${sym.totalConnections} connections`
				);
			}
		}
	} catch {
		// Ignore parse errors
	}

	console.log(
		`\n${snapshots.length} snapshots analyzed over ${report.period}\n`
	);
}
