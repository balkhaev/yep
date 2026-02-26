// @ts-nocheck
import type { TextChunk } from "@opentui/core";
import { bold, dim, StyledText, t } from "@opentui/core";
import { shortenPath } from "../../helpers";
import { COLORS, SEMANTIC, SYMBOL_COLORS } from "../../theme";
import type { CodeInsights } from "../../types";

function s(...chunks: TextChunk[]): StyledText {
	return new StyledText(chunks);
}

export default function QualityTab({ insights }: { insights: CodeInsights }) {
	const deadCodePercentage =
		insights.deadCode.length > 0
			? ((insights.deadCode.length / insights.totalSymbols) * 100).toFixed(1)
			: "0";

	// Generate quality recommendations based on metrics
	const recommendations: Array<{
		severity: "high" | "medium" | "low";
		title: string;
		description: string;
	}> = [];

	if (insights.avgComplexity > 10) {
		recommendations.push({
			severity: "high",
			title: "Reduce complexity",
			description: `Average complexity is ${insights.avgComplexity.toFixed(1)} - consider refactoring`,
		});
	}

	if (insights.documentationCoverage < 50) {
		recommendations.push({
			severity: "medium",
			title: "Improve documentation",
			description: `Only ${insights.documentationCoverage.toFixed(0)}% of code is documented`,
		});
	}

	if (insights.deadCode.length > insights.totalSymbols * 0.1) {
		recommendations.push({
			severity: "high",
			title: "Remove dead code",
			description: `${insights.deadCode.length} unused symbols detected (${deadCodePercentage}%)`,
		});
	}

	if (
		insights.largestSymbols.length > 0 &&
		insights.largestSymbols[0].lineCount > 200
	) {
		recommendations.push({
			severity: "medium",
			title: "Split large symbols",
			description: `${insights.largestSymbols[0].symbol} has ${insights.largestSymbols[0].lineCount} lines`,
		});
	}

	if (insights.godSymbols && insights.godSymbols.length > 0) {
		recommendations.push({
			severity: "high",
			title: "Reduce coupling",
			description: `${insights.godSymbols.length} god symbols with high connections`,
		});
	}

	if (recommendations.length === 0) {
		recommendations.push({
			severity: "low",
			title: "Code quality looks good",
			description: "No major issues detected",
		});
	}

	return (
		<scrollbox flexDirection="column" flexGrow={1} gap={1}>
			{/* Recommendations */}
			<box flexDirection="column" paddingBottom={1}>
				<text
					content={s(
						t`${SEMANTIC.primary}${bold("Quality Recommendations")}${COLORS.reset} ${dim(`(${recommendations.length})`)}`
					)}
					height={1}
				/>
				<box flexDirection="column" gap={1} paddingTop={1}>
					{recommendations.map((rec, i) => {
						const severityColors = {
							high: SEMANTIC.error,
							medium: SEMANTIC.warning,
							low: SEMANTIC.success,
						};
						const severityIcons = {
							high: "⚠",
							medium: "ℹ",
							low: "✓",
						};

						const color = severityColors[rec.severity];
						const icon = severityIcons[rec.severity];

						return (
							<box flexDirection="column" gap={0} key={i}>
								<text
									content={s(
										t`${color}${icon} ${rec.severity.toUpperCase().padEnd(6)}${COLORS.reset} ${bold(rec.title)}`
									)}
									height={1}
								/>
								<text content={s(t`  ${dim(rec.description)}`)} height={1} />
							</box>
						);
					})}
				</box>
			</box>

			{/* Dead Code */}
			{insights.deadCode.length > 0 && (
				<box flexDirection="column" paddingBottom={1}>
					<text
						content={s(
							t`${SEMANTIC.warning}${bold("Potential Dead Code")}${COLORS.reset} ${dim(`(${insights.deadCode.length} symbols, ${deadCodePercentage}%)`)}`
						)}
						height={1}
					/>
					<box flexDirection="column" gap={0} paddingTop={1}>
						{insights.deadCode.slice(0, 10).map((item, i) => {
							const color =
								SYMBOL_COLORS[item.symbolType as keyof typeof SYMBOL_COLORS] ||
								COLORS.zinc400;
							const shortPath = shortenPath(item.path);

							return (
								<text
									content={s(
										t`${dim(`${i + 1}.`)} ${color}${item.symbolType[0]}${COLORS.reset} ${COLORS.zinc400}${item.symbol}${COLORS.reset} ${dim(`@ ${shortPath}`)}`
									)}
									height={1}
									key={i}
								/>
							);
						})}
					</box>
					{insights.deadCode.length > 10 && (
						<text
							content={s(
								t`${dim(`...and ${insights.deadCode.length - 10} more unused symbols`)}`
							)}
							height={1}
						/>
					)}
					<text
						content={s(
							t`${dim("Note: These symbols may be used via dynamic imports or reflection")}`
						)}
						height={1}
					/>
				</box>
			)}

			{/* Documentation Coverage */}
			<box flexDirection="column" paddingBottom={1}>
				<text
					content={s(
						t`${SEMANTIC.primary}${bold("Documentation Coverage")}${COLORS.reset}`
					)}
					height={1}
				/>
				<box flexDirection="column" gap={0} paddingTop={1}>
					<text
						content={s(
							t`${bold("Coverage:")} ${insights.documentationCoverage.toFixed(0)}%`
						)}
						height={1}
					/>

					{insights.documentationCoverage < 30 && (
						<text
							content={s(
								t`${SEMANTIC.error}•${COLORS.reset} ${dim("Very low - add JSDoc comments to public APIs")}`
							)}
							height={1}
						/>
					)}
					{insights.documentationCoverage >= 30 &&
						insights.documentationCoverage < 70 && (
							<text
								content={s(
									t`${SEMANTIC.warning}•${COLORS.reset} ${dim("Moderate - consider documenting complex functions")}`
								)}
								height={1}
							/>
						)}
					{insights.documentationCoverage >= 70 && (
						<text
							content={s(
								t`${SEMANTIC.success}✓${COLORS.reset} ${dim("Good coverage - maintain this level")}`
							)}
							height={1}
						/>
					)}
				</box>
			</box>

			{/* Quality Score Summary */}
			<box flexDirection="column" paddingBottom={1}>
				<text
					content={s(
						t`${SEMANTIC.info}${bold("Quality Score")}${COLORS.reset}`
					)}
					height={1}
				/>
				<box flexDirection="column" gap={0} paddingTop={1}>
					{/* Calculate overall quality score */}
					{(() => {
						const complexityScore = Math.max(
							0,
							100 - insights.avgComplexity * 10
						);
						const docScore = insights.documentationCoverage;
						const deadCodeScore = Math.max(
							0,
							100 - (insights.deadCode.length / insights.totalSymbols) * 100
						);
						const overallScore = Math.round(
							(complexityScore + docScore + deadCodeScore) / 3
						);

						let scoreColor = SEMANTIC.success;
						let scoreLabel = "Excellent";
						if (overallScore < 50) {
							scoreColor = SEMANTIC.error;
							scoreLabel = "Needs Improvement";
						} else if (overallScore < 70) {
							scoreColor = SEMANTIC.warning;
							scoreLabel = "Fair";
						} else if (overallScore < 85) {
							scoreColor = SEMANTIC.info;
							scoreLabel = "Good";
						}

						return (
							<>
								<text
									content={s(
										t`${bold("Overall:")} ${scoreColor}${overallScore}%${COLORS.reset} ${dim(`(${scoreLabel})`)}`
									)}
									height={1}
								/>
								<text
									content={s(
										t`${dim(`• Complexity: ${Math.round(complexityScore)}%`)}`
									)}
									height={1}
								/>
								<text
									content={s(
										t`${dim(`• Documentation: ${Math.round(docScore)}%`)}`
									)}
									height={1}
								/>
								<text
									content={s(
										t`${dim(`• Clean Code: ${Math.round(deadCodeScore)}%`)}`
									)}
									height={1}
								/>
							</>
						);
					})()}
				</box>
			</box>

			{/* Action Items */}
			<box flexDirection="column" paddingBottom={1}>
				<text
					content={s(
						t`${SEMANTIC.primary}${bold("Action Items")}${COLORS.reset}`
					)}
					height={1}
				/>
				<box flexDirection="column" gap={0} paddingTop={1}>
					<text
						content={s(t`${dim("1. Review and remove dead code symbols")}`)}
						height={1}
					/>
					<text
						content={s(
							t`${dim("2. Add documentation to undocumented symbols")}`
						)}
						height={1}
					/>
					<text
						content={s(t`${dim("3. Refactor high-complexity functions")}`)}
						height={1}
					/>
					<text
						content={s(t`${dim("4. Split large symbols into smaller units")}`)}
						height={1}
					/>
				</box>
			</box>
		</scrollbox>
	);
}
