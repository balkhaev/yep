// @ts-nocheck
import type { TextChunk } from "@opentui/core";
import { bold, dim, StyledText, t } from "@opentui/core";
import {
	COLORS,
	getHealthColor,
	progressBar,
	SEMANTIC,
	SYMBOL_COLORS,
} from "../../theme";
import type { CodeInsights } from "../../types";

function s(...chunks: TextChunk[]): StyledText {
	return new StyledText(chunks);
}

export default function ComplexityTab({
	insights,
}: {
	insights: CodeInsights;
}) {
	const avgComplexity = insights.avgComplexity;
	const complexityScore = Math.max(0, 100 - avgComplexity * 10);
	const docCoverage = insights.documentationCoverage;

	// Complexity distribution buckets
	const complexityBuckets = [
		{ range: "1-5", min: 1, max: 5, count: 0 },
		{ range: "6-10", min: 6, max: 10, count: 0 },
		{ range: "11-15", min: 11, max: 15, count: 0 },
		{ range: "16-20", min: 16, max: 20, count: 0 },
		{ range: "21+", min: 21, max: 999, count: 0 },
	];

	// Note: We don't have per-symbol complexity data in CodeInsights
	// This is a simplified visualization based on average
	// In a real implementation, you'd need to add complexity distribution to CodeInsights
	const totalSymbols = insights.totalSymbols;
	if (avgComplexity <= 5) {
		complexityBuckets[0].count = Math.round(totalSymbols * 0.7);
		complexityBuckets[1].count = Math.round(totalSymbols * 0.2);
		complexityBuckets[2].count = Math.round(totalSymbols * 0.1);
	} else if (avgComplexity <= 10) {
		complexityBuckets[0].count = Math.round(totalSymbols * 0.5);
		complexityBuckets[1].count = Math.round(totalSymbols * 0.3);
		complexityBuckets[2].count = Math.round(totalSymbols * 0.15);
		complexityBuckets[3].count = Math.round(totalSymbols * 0.05);
	} else {
		complexityBuckets[0].count = Math.round(totalSymbols * 0.3);
		complexityBuckets[1].count = Math.round(totalSymbols * 0.3);
		complexityBuckets[2].count = Math.round(totalSymbols * 0.2);
		complexityBuckets[3].count = Math.round(totalSymbols * 0.15);
		complexityBuckets[4].count = Math.round(totalSymbols * 0.05);
	}

	return (
		<scrollbox flexDirection="column" flexGrow={1} gap={1}>
			{/* Main Metrics */}
			<box flexDirection="column" paddingBottom={1}>
				<text
					content={s(
						t`${SEMANTIC.primary}${bold("Complexity Metrics")}${COLORS.reset}`
					)}
					height={1}
				/>
				<box flexDirection="column" gap={0} paddingTop={1}>
					<text
						content={s(
							t`${bold("Avg Cyclomatic:")} ${COLORS.amber}${avgComplexity.toFixed(1)}${COLORS.reset} ${progressBar(complexityScore, 100, 15)} ${dim(`${Math.round(complexityScore)}%`)}`
						)}
						height={1}
					/>
					<text
						content={s(
							t`${bold("Documentation:")} ${COLORS.emerald}${docCoverage.toFixed(0)}%${COLORS.reset} ${progressBar(docCoverage, 100, 15)} ${dim(`${Math.round(docCoverage)}%`)}`
						)}
						height={1}
					/>
				</box>
			</box>

			{/* Complexity Distribution */}
			<box flexDirection="column" paddingBottom={1}>
				<text
					content={s(
						t`${SEMANTIC.primary}${bold("Complexity Distribution")}${COLORS.reset}`
					)}
					height={1}
				/>
				<box flexDirection="column" gap={0} paddingTop={1}>
					{complexityBuckets.map((bucket) => {
						if (bucket.count === 0) {
							return null;
						}

						const percentage = (bucket.count / totalSymbols) * 100;
						const barWidth = Math.round((percentage / 100) * 20);
						const bar = "█".repeat(barWidth) + "░".repeat(20 - barWidth);

						// Color based on complexity range
						let color = SEMANTIC.success;
						if (bucket.min > 10) {
							color = SEMANTIC.warning;
						}
						if (bucket.min > 15) {
							color = SEMANTIC.error;
						}

						return (
							<text
								content={s(
									t`${bucket.range.padEnd(8)} ${color}${bar}${COLORS.reset} ${dim(`${bucket.count} (${percentage.toFixed(0)}%)`)}`
								)}
								height={1}
								key={bucket.range}
							/>
						);
					})}
				</box>
			</box>

			{/* Largest Symbols */}
			{insights.largestSymbols.length > 0 && (
				<box flexDirection="column" paddingBottom={1}>
					<text
						content={s(
							t`${SEMANTIC.primary}${bold("Largest Symbols")}${COLORS.reset} ${dim("(by line count)")}`
						)}
						height={1}
					/>
					<box flexDirection="column" gap={0} paddingTop={1}>
						{insights.largestSymbols.slice(0, 8).map((sym, i) => {
							const color =
								SYMBOL_COLORS[sym.symbolType as keyof typeof SYMBOL_COLORS] ||
								COLORS.zinc400;
							const healthColor = getHealthColor(
								Math.max(0, 100 - sym.lineCount / 10)
							);

							return (
								<text
									content={s(
										t`${dim(`${i + 1}.`)} ${color}${sym.symbol.padEnd(25)}${COLORS.reset} ${healthColor}${sym.lineCount.toString().padStart(4)} lines${COLORS.reset}`
									)}
									height={1}
									key={i}
								/>
							);
						})}
					</box>
				</box>
			)}

			{/* God Symbols (overly connected) */}
			{insights.godSymbols && insights.godSymbols.length > 0 && (
				<box flexDirection="column" paddingBottom={1}>
					<text
						content={s(
							t`${SEMANTIC.warning}${bold("God Symbols")}${COLORS.reset} ${dim("(high coupling)")}`
						)}
						height={1}
					/>
					<box flexDirection="column" gap={0} paddingTop={1}>
						{insights.godSymbols.slice(0, 5).map((sym, i) => {
							const color =
								SYMBOL_COLORS[sym.symbolType as keyof typeof SYMBOL_COLORS] ||
								COLORS.zinc400;

							return (
								<text
									content={s(
										t`${dim(`${i + 1}.`)} ${color}${sym.symbol}${COLORS.reset} ${dim(`(${sym.totalConnections} connections)`)}`
									)}
									height={1}
									key={i}
								/>
							);
						})}
					</box>
					<text
						content={s(
							t`${dim("Consider refactoring these symbols to reduce complexity")}`
						)}
						height={1}
					/>
				</box>
			)}

			{/* Recommendations */}
			<box flexDirection="column" paddingBottom={1}>
				<text
					content={s(
						t`${SEMANTIC.info}${bold("Recommendations")}${COLORS.reset}`
					)}
					height={1}
				/>
				<box flexDirection="column" gap={0} paddingTop={1}>
					{avgComplexity > 10 && (
						<text
							content={s(
								t`${SEMANTIC.warning}•${COLORS.reset} ${dim("High average complexity - consider breaking down complex functions")}`
							)}
							height={1}
						/>
					)}
					{docCoverage < 50 && (
						<text
							content={s(
								t`${SEMANTIC.warning}•${COLORS.reset} ${dim("Low documentation coverage - add JSDoc comments")}`
							)}
							height={1}
						/>
					)}
					{insights.largestSymbols.length > 0 &&
						insights.largestSymbols[0].lineCount > 200 && (
							<text
								content={s(
									t`${SEMANTIC.warning}•${COLORS.reset} ${dim("Very large symbols detected - split into smaller units")}`
								)}
								height={1}
							/>
						)}
					{avgComplexity <= 5 && docCoverage >= 70 && (
						<text
							content={s(
								t`${SEMANTIC.success}✓${COLORS.reset} ${dim("Good code complexity and documentation")}`
							)}
							height={1}
						/>
					)}
				</box>
			</box>
		</scrollbox>
	);
}
