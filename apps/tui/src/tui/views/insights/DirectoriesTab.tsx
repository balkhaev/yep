// @ts-nocheck
import type { TextChunk } from "@opentui/core";
import { bold, dim, StyledText, t } from "@opentui/core";
import { COLORS, getHealthColor, SEMANTIC } from "../../theme";
import type { CodeInsights } from "../../types";

function s(...chunks: TextChunk[]): StyledText {
	return new StyledText(chunks);
}

interface DirectoryMetrics {
	avgComplexity: number;
	deadCodeCount: number;
	files: number;
	health: number;
	path: string;
	symbols: number;
}

export default function DirectoriesTab({
	insights,
}: {
	insights: CodeInsights;
}) {
	// Group metrics by directory from hot files
	const directoryMap = new Map<string, DirectoryMetrics>();

	// Aggregate data from hot files
	for (const file of insights.hotFiles) {
		// Extract directory path (everything before last /)
		const lastSlash = file.path.lastIndexOf("/");
		const dirPath = lastSlash > 0 ? file.path.substring(0, lastSlash) : ".";

		if (!directoryMap.has(dirPath)) {
			directoryMap.set(dirPath, {
				path: dirPath,
				symbols: 0,
				files: 0,
				avgComplexity: 0,
				deadCodeCount: 0,
				health: 0,
			});
		}

		const dir = directoryMap.get(dirPath)!;
		dir.symbols += file.symbolCount;
		dir.files += 1;
	}

	// Add dead code counts
	for (const deadSymbol of insights.deadCode) {
		const lastSlash = deadSymbol.path.lastIndexOf("/");
		const dirPath =
			lastSlash > 0 ? deadSymbol.path.substring(0, lastSlash) : ".";

		if (directoryMap.has(dirPath)) {
			const dir = directoryMap.get(dirPath)!;
			dir.deadCodeCount += 1;
		}
	}

	// Calculate metrics and health scores
	const directories = Array.from(directoryMap.values())
		.map((dir) => {
			// Estimate complexity (simplified - would need per-directory data)
			dir.avgComplexity = insights.avgComplexity;

			// Calculate health score
			const deadCodePercentage =
				dir.symbols > 0 ? (dir.deadCodeCount / dir.symbols) * 100 : 0;
			const complexityScore = Math.max(0, 100 - dir.avgComplexity * 10);
			const cleanCodeScore = Math.max(0, 100 - deadCodePercentage);
			dir.health = Math.round((complexityScore + cleanCodeScore) / 2);

			return dir;
		})
		.sort((a, b) => b.symbols - a.symbols);

	// Get top-level directories (only one level deep)
	const topLevelDirs = directories.filter((dir) => {
		const slashCount = (dir.path.match(/\//g) || []).length;
		return slashCount <= 2; // Root + one level
	});

	return (
		<scrollbox flexDirection="column" flexGrow={1} gap={1}>
			{/* Directory Breakdown */}
			<box flexDirection="column" paddingBottom={1}>
				<text
					content={s(
						t`${SEMANTIC.primary}${bold("Directory Breakdown")}${COLORS.reset} ${dim(`(${topLevelDirs.length} directories)`)}`
					)}
					height={1}
				/>
				<box flexDirection="column" gap={0} paddingTop={1}>
					{/* Table Header */}
					<text
						content={s(
							t`${bold("Directory".padEnd(25))} ${"Symbols".padStart(8)} ${"Files".padStart(7)} ${"Dead".padStart(6)} ${"Health".padStart(8)}`
						)}
						height={1}
					/>
					<text
						content={s(
							t`${dim("─".repeat(25))} ${dim("─".repeat(8))} ${dim("─".repeat(7))} ${dim("─".repeat(6))} ${dim("─".repeat(8))}`
						)}
						height={1}
					/>

					{/* Table Rows */}
					{topLevelDirs.slice(0, 15).map((dir) => {
						const healthColor = getHealthColor(dir.health);
						const healthBar = "█".repeat(Math.round(dir.health / 20));

						// Shorten directory path if too long
						let displayPath = dir.path;
						if (displayPath.length > 25) {
							displayPath = "..." + displayPath.slice(-22);
						}

						return (
							<text
								content={s(
									t`${COLORS.cyan}${displayPath.padEnd(25)}${COLORS.reset} ${COLORS.zinc100}${dir.symbols.toString().padStart(8)}${COLORS.reset} ${dim(dir.files.toString().padStart(7))} ${SEMANTIC.warning}${dir.deadCodeCount.toString().padStart(6)}${COLORS.reset} ${healthColor}${healthBar.padEnd(8)}${COLORS.reset}`
								)}
								height={1}
								key={dir.path}
							/>
						);
					})}
				</box>
			</box>

			{/* Top Directories by Symbols */}
			<box flexDirection="column" paddingBottom={1}>
				<text
					content={s(
						t`${SEMANTIC.primary}${bold("Largest Directories")}${COLORS.reset} ${dim("(by symbol count)")}`
					)}
					height={1}
				/>
				<box flexDirection="column" gap={0} paddingTop={1}>
					{directories.slice(0, 8).map((dir, i) => {
						const maxSymbols = directories[0].symbols;
						const barWidth = Math.round((dir.symbols / maxSymbols) * 20);
						const bar = "█".repeat(barWidth) + "░".repeat(20 - barWidth);

						return (
							<text
								content={s(
									t`${dim(`${i + 1}.`)} ${SEMANTIC.info}${bar}${COLORS.reset} ${COLORS.cyan}${dir.path}${COLORS.reset} ${dim(`(${dir.symbols})`)}`
								)}
								height={1}
								key={i}
							/>
						);
					})}
				</box>
			</box>

			{/* Directories with Dead Code */}
			{(() => {
				const dirsWithDeadCode = directories
					.filter((d) => d.deadCodeCount > 0)
					.sort((a, b) => b.deadCodeCount - a.deadCodeCount);

				if (dirsWithDeadCode.length === 0) {
					return null;
				}

				return (
					<box flexDirection="column" paddingBottom={1}>
						<text
							content={s(
								t`${SEMANTIC.warning}${bold("Directories with Dead Code")}${COLORS.reset}`
							)}
							height={1}
						/>
						<box flexDirection="column" gap={0} paddingTop={1}>
							{dirsWithDeadCode.slice(0, 8).map((dir, i) => {
								const percentage =
									dir.symbols > 0
										? ((dir.deadCodeCount / dir.symbols) * 100).toFixed(0)
										: "0";

								return (
									<text
										content={s(
											t`${dim(`${i + 1}.`)} ${COLORS.cyan}${dir.path}${COLORS.reset} ${SEMANTIC.warning}${dir.deadCodeCount} unused${COLORS.reset} ${dim(`(${percentage}%)`)}`
										)}
										height={1}
										key={i}
									/>
								);
							})}
						</box>
					</box>
				);
			})()}

			{/* Healthiest Directories */}
			{(() => {
				const healthiestDirs = directories
					.filter((d) => d.symbols >= 5) // Only consider dirs with enough symbols
					.sort((a, b) => b.health - a.health);

				if (healthiestDirs.length === 0) {
					return null;
				}

				return (
					<box flexDirection="column" paddingBottom={1}>
						<text
							content={s(
								t`${SEMANTIC.success}${bold("Healthiest Directories")}${COLORS.reset}`
							)}
							height={1}
						/>
						<box flexDirection="column" gap={0} paddingTop={1}>
							{healthiestDirs.slice(0, 5).map((dir, i) => {
								const healthColor = getHealthColor(dir.health);

								return (
									<text
										content={s(
											t`${dim(`${i + 1}.`)} ${COLORS.cyan}${dir.path}${COLORS.reset} ${healthColor}${dir.health}%${COLORS.reset} ${dim(`(${dir.symbols} symbols)`)}`
										)}
										height={1}
										key={i}
									/>
								);
							})}
						</box>
					</box>
				);
			})()}

			{/* Directory Insights */}
			<box flexDirection="column" paddingBottom={1}>
				<text
					content={s(
						t`${SEMANTIC.info}${bold("Directory Insights")}${COLORS.reset}`
					)}
					height={1}
				/>
				<box flexDirection="column" gap={0} paddingTop={1}>
					<text
						content={s(
							t`${dim(`Total directories analyzed: ${directories.length}`)}`
						)}
						height={1}
					/>
					<text
						content={s(
							t`${dim(`Avg symbols per directory: ${Math.round(insights.totalSymbols / directories.length)}`)}`
						)}
						height={1}
					/>

					{directories.length > 20 && (
						<text
							content={s(
								t`${SEMANTIC.warning}•${COLORS.reset} ${dim("Many directories - consider consolidating")}`
							)}
							height={1}
						/>
					)}

					{directories.some((d) => d.symbols > 100) && (
						<text
							content={s(
								t`${SEMANTIC.warning}•${COLORS.reset} ${dim("Some directories are very large - consider splitting")}`
							)}
							height={1}
						/>
					)}

					{directories.filter((d) => d.deadCodeCount > 0).length >
						directories.length * 0.5 && (
						<text
							content={s(
								t`${SEMANTIC.warning}•${COLORS.reset} ${dim("Many directories have dead code - cleanup needed")}`
							)}
							height={1}
						/>
					)}
				</box>
			</box>
		</scrollbox>
	);
}
