// @ts-nocheck
import type { TextChunk } from "@opentui/core";
import { bold, dim, StyledText, t } from "@opentui/core";
import {
	COLORS,
	LANGUAGE_COLORS,
	progressBar,
	SEMANTIC,
	SYMBOL_COLORS,
} from "../../theme";
import type { CodeInsights } from "../../types";

function s(...chunks: TextChunk[]): StyledText {
	return new StyledText(chunks);
}

function StatCard({
	label,
	value,
	color = SEMANTIC.text,
}: {
	label: string;
	value: string | number;
	color?: string;
}) {
	return (
		<box alignItems="center" flexDirection="column" gap={0}>
			<text
				content={t`${color}${bold(String(value))}${COLORS.reset}`}
				height={1}
			/>
			<text content={t`${dim(label)}`} height={1} />
		</box>
	);
}

export default function OverviewTab({ insights }: { insights: CodeInsights }) {
	const avgSymbolsPerFile = insights.avgSymbolsPerFile.toFixed(1);
	const avgComplexity = insights.avgComplexity.toFixed(1);

	// Calculate health score (simple average of key metrics)
	const healthMetrics = {
		complexity: Math.max(0, 100 - insights.avgComplexity * 10),
		documentation: insights.documentationCoverage,
		deadCode: Math.max(
			0,
			100 - (insights.deadCode.length / insights.totalSymbols) * 100
		),
	};
	const healthScore = Math.round(
		(healthMetrics.complexity +
			healthMetrics.documentation +
			healthMetrics.deadCode) /
			3
	);

	return (
		<scrollbox flexDirection="column" flexGrow={1} gap={1}>
			{/* Stats Grid */}
			<box flexDirection="column" paddingBottom={1}>
				<text
					content={s(
						t`${SEMANTIC.primary}${bold("Statistics")}${COLORS.reset}`
					)}
					height={1}
				/>
				<box flexDirection="row" gap={3} paddingTop={1}>
					<StatCard
						color={SEMANTIC.primary}
						label="Symbols"
						value={insights.totalSymbols}
					/>
					<StatCard
						color={SEMANTIC.info}
						label="Files"
						value={insights.totalFiles}
					/>
					<StatCard
						color={SEMANTIC.muted}
						label="Avg/File"
						value={avgSymbolsPerFile}
					/>
					<StatCard
						color={COLORS.emerald}
						label="Languages"
						value={insights.languageDistribution.length}
					/>
					<StatCard
						color={COLORS.amber}
						label="Complexity"
						value={avgComplexity}
					/>
				</box>
			</box>

			{/* Health Score */}
			<box flexDirection="column" paddingBottom={1}>
				<text
					content={s(
						t`${SEMANTIC.primary}${bold("Code Health")}${COLORS.reset}`
					)}
					height={1}
				/>
				<box alignItems="center" flexDirection="row" gap={2} paddingTop={1}>
					<text
						content={s(
							t`${bold("Overall:")} ${progressBar(healthScore)} ${COLORS.dim}${healthScore}%${COLORS.reset}`
						)}
						height={1}
					/>
				</box>
				<box flexDirection="column" gap={0} paddingTop={1}>
					<text
						content={s(
							t`${dim("Complexity:")} ${progressBar(healthMetrics.complexity, 100, 15)} ${COLORS.dim}${Math.round(healthMetrics.complexity)}%${COLORS.reset}`
						)}
						height={1}
					/>
					<text
						content={s(
							t`${dim("Documentation:")} ${progressBar(insights.documentationCoverage, 100, 15)} ${COLORS.dim}${Math.round(insights.documentationCoverage)}%${COLORS.reset}`
						)}
						height={1}
					/>
					<text
						content={s(
							t`${dim("Clean Code:")} ${progressBar(healthMetrics.deadCode, 100, 15)} ${COLORS.dim}${Math.round(healthMetrics.deadCode)}%${COLORS.reset}`
						)}
						height={1}
					/>
				</box>
			</box>

			{/* Language Distribution */}
			<box flexDirection="column" paddingBottom={1}>
				<text
					content={s(
						t`${SEMANTIC.primary}${bold("Language Distribution")}${COLORS.reset}`
					)}
					height={1}
				/>
				<box flexDirection="column" gap={0} paddingTop={1}>
					{insights.languageDistribution.slice(0, 5).map((lang) => {
						const color =
							LANGUAGE_COLORS[
								lang.language.toLowerCase() as keyof typeof LANGUAGE_COLORS
							] || LANGUAGE_COLORS.default;
						const barWidth = Math.round((lang.percentage / 100) * 20);
						const bar = "█".repeat(barWidth) + "░".repeat(20 - barWidth);

						return (
							<text
								content={s(
									t`${color}${lang.language.padEnd(12)}${COLORS.reset} ${color}${bar}${COLORS.reset} ${dim(`${lang.count} (${lang.percentage.toFixed(0)}%)`)}`
								)}
								height={1}
								key={lang.language}
							/>
						);
					})}
				</box>
			</box>

			{/* Symbol Types */}
			<box flexDirection="column" paddingBottom={1}>
				<text
					content={s(
						t`${SEMANTIC.primary}${bold("Symbol Types")}${COLORS.reset}`
					)}
					height={1}
				/>
				<box flexDirection="column" gap={0} paddingTop={1}>
					{insights.typeDistribution.slice(0, 6).map((type) => {
						const color =
							SYMBOL_COLORS[type.symbolType as keyof typeof SYMBOL_COLORS] ||
							COLORS.zinc400;
						const barWidth = Math.round((type.percentage / 100) * 20);
						const bar = "█".repeat(barWidth) + "░".repeat(20 - barWidth);

						return (
							<text
								content={s(
									t`${color}${type.symbolType.padEnd(12)}${COLORS.reset} ${color}${bar}${COLORS.reset} ${dim(`${type.count} (${type.percentage.toFixed(0)}%)`)}`
								)}
								height={1}
								key={type.symbolType}
							/>
						);
					})}
				</box>
			</box>

			{/* Top Connected Symbols */}
			{insights.mostConnected.length > 0 && (
				<box flexDirection="column" paddingBottom={1}>
					<text
						content={s(
							t`${SEMANTIC.primary}${bold("Most Connected Symbols")}${COLORS.reset} ${dim(`(median: ${insights.medianConnections})`)}`
						)}
						height={1}
					/>
					<box flexDirection="column" gap={0} paddingTop={1}>
						{insights.mostConnected.slice(0, 5).map((sym, i) => {
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
				</box>
			)}

			{/* Hot Files */}
			{insights.hotFiles.length > 0 && (
				<box flexDirection="column" paddingBottom={1}>
					<text
						content={s(
							t`${SEMANTIC.primary}${bold("Hot Files")}${COLORS.reset} ${dim("(most symbols)")}`
						)}
						height={1}
					/>
					<box flexDirection="column" gap={0} paddingTop={1}>
						{insights.hotFiles.slice(0, 5).map((file, i) => {
							return (
								<text
									content={s(
										t`${dim(`${i + 1}.`)} ${COLORS.cyan}${file.path}${COLORS.reset} ${dim(`(${file.symbolCount} symbols)`)}`
									)}
									height={1}
									key={i}
								/>
							);
						})}
					</box>
				</box>
			)}
		</scrollbox>
	);
}
