// @ts-nocheck
import type { TextChunk } from "@opentui/core";
import { bold, dim, StyledText, t } from "@opentui/core";
import { shortenPath } from "../../helpers";
import { COLORS, SEMANTIC, SYMBOL_COLORS } from "../../theme";
import type { CodeInsights } from "../../types";

function s(...chunks: TextChunk[]): StyledText {
	return new StyledText(chunks);
}

export default function DependenciesTab({
	insights,
}: {
	insights: CodeInsights;
}) {
	return (
		<scrollbox flexDirection="column" flexGrow={1} gap={1}>
			{/* Most Connected Symbols */}
			{insights.mostConnected.length > 0 && (
				<box flexDirection="column" paddingBottom={1}>
					<text
						content={s(
							t`${SEMANTIC.primary}${bold("Most Connected Symbols")}${COLORS.reset} ${dim(`(median: ${insights.medianConnections})`)}`
						)}
						height={1}
					/>
					<box flexDirection="column" gap={0} paddingTop={1}>
						{insights.mostConnected.slice(0, 10).map((sym, i) => {
							const color =
								SYMBOL_COLORS[sym.symbolType as keyof typeof SYMBOL_COLORS] ||
								COLORS.zinc400;
							const shortPath = shortenPath(sym.path);

							return (
								<box flexDirection="column" gap={0} key={i}>
									<text
										content={s(
											t`${dim(`${i + 1}.`)} ${color}${sym.symbol}${COLORS.reset} ${dim(`@ ${shortPath}`)}`
										)}
										height={1}
									/>
									<text
										content={s(
											t`   ${dim(`Callers: ${sym.callerCount} · Callees: ${sym.calleeCount} · Importers: ${sym.importerCount}`)}`
										)}
										height={1}
									/>
								</box>
							);
						})}
					</box>
				</box>
			)}

			{/* High Fan-In Symbols */}
			{insights.highFanInSymbols && insights.highFanInSymbols.length > 0 && (
				<box flexDirection="column" paddingBottom={1}>
					<text
						content={s(
							t`${SEMANTIC.primary}${bold("High Fan-In Symbols")}${COLORS.reset} ${dim("(widely imported)")}`
						)}
						height={1}
					/>
					<box flexDirection="column" gap={0} paddingTop={1}>
						{insights.highFanInSymbols.slice(0, 8).map((sym, i) => {
							const shortPath = shortenPath(sym.path);
							const percentage = sym.importerPercentage.toFixed(0);

							return (
								<text
									content={s(
										t`${dim(`${i + 1}.`)} ${COLORS.cyan}${sym.symbol}${COLORS.reset} ${dim(`(${sym.importerCount} importers, ${percentage}%)`)}`
									)}
									height={1}
									key={i}
								/>
							);
						})}
					</box>
					<text
						content={s(
							t`${dim("These symbols are central to your codebase architecture")}`
						)}
						height={1}
					/>
				</box>
			)}

			{/* Hot Files */}
			{insights.hotFiles.length > 0 && (
				<box flexDirection="column" paddingBottom={1}>
					<text
						content={s(
							t`${SEMANTIC.primary}${bold("Hot Files")}${COLORS.reset} ${dim("(symbol density)")}`
						)}
						height={1}
					/>
					<box flexDirection="column" gap={0} paddingTop={1}>
						{insights.hotFiles.slice(0, 8).map((file, i) => {
							// Create a simple bar chart
							const maxSymbols = insights.hotFiles[0].symbolCount;
							const barWidth = Math.round((file.symbolCount / maxSymbols) * 15);
							const bar =
								SEMANTIC.info +
								"█".repeat(barWidth) +
								COLORS.reset +
								COLORS.dim +
								"░".repeat(15 - barWidth) +
								COLORS.reset;

							const shortPath = shortenPath(file.path);

							return (
								<text
									content={s(
										t`${dim(`${i + 1}.`)} ${bar} ${COLORS.cyan}${shortPath}${COLORS.reset} ${dim(`(${file.symbolCount})`)}`
									)}
									height={1}
									key={i}
								/>
							);
						})}
					</box>
				</box>
			)}

			{/* Cross-Directory Imports */}
			{insights.crossDirectoryImports &&
				insights.crossDirectoryImports.length > 0 && (
					<box flexDirection="column" paddingBottom={1}>
						<text
							content={s(
								t`${SEMANTIC.primary}${bold("Cross-Directory Imports")}${COLORS.reset}`
							)}
							height={1}
						/>
						<box flexDirection="column" gap={0} paddingTop={1}>
							{insights.crossDirectoryImports.slice(0, 8).map((imp, i) => {
								return (
									<text
										content={s(
											t`${COLORS.amber}${imp.from}${COLORS.reset} ${dim("→")} ${COLORS.emerald}${imp.to}${COLORS.reset} ${dim(`(${imp.count} imports)`)}`
										)}
										height={1}
										key={i}
									/>
								);
							})}
						</box>
						{insights.crossDirectoryImports.length > 8 && (
							<text
								content={s(
									t`${dim(`...and ${insights.crossDirectoryImports.length - 8} more`)}`
								)}
								height={1}
							/>
						)}
					</box>
				)}

			{/* Insights Summary */}
			<box flexDirection="column" paddingBottom={1}>
				<text
					content={s(
						t`${SEMANTIC.info}${bold("Dependency Insights")}${COLORS.reset}`
					)}
					height={1}
				/>
				<box flexDirection="column" gap={0} paddingTop={1}>
					{insights.avgSymbolsPerFile > 20 && (
						<text
							content={s(
								t`${SEMANTIC.warning}•${COLORS.reset} ${dim(`High avg symbols per file (${insights.avgSymbolsPerFile.toFixed(1)})`)}`
							)}
							height={1}
						/>
					)}
					{insights.mostConnected.length > 0 &&
						insights.mostConnected[0].totalConnections > 50 && (
							<text
								content={s(
									t`${SEMANTIC.warning}•${COLORS.reset} ${dim("Some symbols have very high coupling")}`
								)}
								height={1}
							/>
						)}
					{insights.highFanInSymbols &&
						insights.highFanInSymbols.length > 0 &&
						insights.highFanInSymbols[0].importerPercentage > 50 && (
							<text
								content={s(
									t`${SEMANTIC.info}•${COLORS.reset} ${dim("Strong central symbols - good for shared utilities")}`
								)}
								height={1}
							/>
						)}
					{insights.crossDirectoryImports &&
						insights.crossDirectoryImports.length > 20 && (
							<text
								content={s(
									t`${SEMANTIC.warning}•${COLORS.reset} ${dim("Many cross-directory imports - consider module boundaries")}`
								)}
								height={1}
							/>
						)}
				</box>
			</box>
		</scrollbox>
	);
}
