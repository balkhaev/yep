// @ts-nocheck
import type { TextChunk } from "@opentui/core";
import { bold, dim, StyledText, t } from "@opentui/core";
// @ts-expect-error react types resolved via opentui reconciler
import { useEffect, useState } from "react";
import { Breadcrumbs } from "../components/ui";
import { formatTime, SYMBOL_ICONS, truncate } from "../helpers";
import { COLORS, SEMANTIC, SYMBOL_COLORS } from "../theme";
import type {
	CodeInsights,
	CodeStats,
	MemStats,
	RecentSession,
} from "../types";

function s(...chunks: TextChunk[]): any {
	return new StyledText(chunks);
}

interface StatusViewProps {
	onLoadCodeStats: () => Promise<CodeStats>;
	onLoadInsights: () => Promise<CodeInsights | null>;
	onLoadRecentSessions: (limit: number) => Promise<RecentSession[]>;
	stats: MemStats | null;
}

export default function StatusView({
	stats,
	onLoadCodeStats,
	onLoadInsights,
	onLoadRecentSessions,
}: StatusViewProps) {
	const [codeStats, setCodeStats] = useState<CodeStats | null>(null);
	const [insights, setInsights] = useState<CodeInsights | null>(null);
	const [recent, setRecent] = useState<RecentSession[]>([]);

	useEffect(() => {
		if (stats?.initialized) {
			onLoadCodeStats().then(setCodeStats);
			onLoadInsights().then(setInsights);
			onLoadRecentSessions(5).then(setRecent);
		}
	}, [
		stats?.initialized,
		onLoadCodeStats,
		onLoadInsights,
		onLoadRecentSessions,
	]);

	if (!stats?.initialized) {
		return (
			<box flexDirection="column" flexGrow={1} paddingX={1}>
				<Breadcrumbs items={[{ label: "Status", active: true }]} />
				<box paddingY={1}>
					<text
						content={s(
							t`${SEMANTIC.warning}${bold("Not initialized.")}${COLORS.reset} ${dim("Run: yep enable")}`
						)}
						height={1}
					/>
				</box>
			</box>
		);
	}

	const PAD = 18;
	const table = stats.hasTable
		? `${SEMANTIC.success}exists${COLORS.reset}`
		: `${SEMANTIC.warning}not created${COLORS.reset}`;

	return (
		<scrollbox flexGrow={1} focused scrollY>
			<box flexDirection="column" paddingX={1}>
				<Breadcrumbs items={[{ label: "Status", active: true }]} />

				<box
					border
					borderStyle="rounded"
					flexDirection="column"
					paddingX={1}
					title=" Memory "
				>
					<text
						content={s(
							t`${SEMANTIC.info}${"Provider".padEnd(PAD)}${COLORS.reset}${stats.provider}`
						)}
						height={1}
					/>
					<text
						content={s(
							t`${SEMANTIC.info}${"Embedding".padEnd(PAD)}${COLORS.reset}${stats.embeddingModel}`
						)}
						height={1}
					/>
					<text
						content={s(
							t`${SEMANTIC.info}${"Chunks".padEnd(PAD)}${COLORS.reset}${SEMANTIC.primary}${stats.totalChunks}${COLORS.reset}`
						)}
						height={1}
					/>
					<text
						content={s(
							t`${SEMANTIC.info}${"Table".padEnd(PAD)}${COLORS.reset}${table}`
						)}
						height={1}
					/>
					{stats.agents.length > 0 && (
						<text
							content={s(
								t`${SEMANTIC.info}${"Agents".padEnd(PAD)}${COLORS.reset}${stats.agents.join(", ")}`
							)}
							height={1}
						/>
					)}
				</box>

				{codeStats && (
					<box
						border
						borderStyle="rounded"
						flexDirection="column"
						marginTop={1}
						paddingX={1}
						title=" Code Index "
					>
						<text
							content={s(
								t`${SEMANTIC.info}${"Symbols".padEnd(PAD)}${COLORS.reset}${SEMANTIC.primary}${codeStats.totalSymbols}${COLORS.reset}`
							)}
							height={1}
						/>
						<text
							content={s(
								t`${SEMANTIC.info}${"Languages".padEnd(PAD)}${COLORS.reset}${codeStats.languages.join(", ") || "—"}`
							)}
							height={1}
						/>
						<text
							content={s(
								t`${SEMANTIC.info}${"Table".padEnd(PAD)}${COLORS.reset}${codeStats.hasTable ? `${SEMANTIC.success}exists${COLORS.reset}` : `${SEMANTIC.warning}not created${COLORS.reset}`}`
							)}
							height={1}
						/>
						{insights && (
							<>
								<text
									content={s(
										t`${SEMANTIC.info}${"Files".padEnd(PAD)}${COLORS.reset}${insights.totalFiles}`
									)}
									height={1}
								/>
								<text
									content={s(
										t`${SEMANTIC.info}${"Avg sym/file".padEnd(PAD)}${COLORS.reset}${insights.avgSymbolsPerFile.toFixed(1)}`
									)}
									height={1}
								/>
								<text
									content={s(
										t`${SEMANTIC.info}${"Dead code".padEnd(PAD)}${COLORS.reset}${SEMANTIC.warning}${insights.deadCode.length}${COLORS.reset} ${dim("potential")}`
									)}
									height={1}
								/>
							</>
						)}
					</box>
				)}

				{insights && insights.mostConnected.length > 0 && (
					<box
						border
						borderStyle="rounded"
						flexDirection="column"
						marginTop={1}
						paddingX={1}
						title=" Top Connected Symbols "
					>
						{insights.mostConnected
							.slice(0, 5)
							.map((sym: CodeInsights["mostConnected"][number]) => {
								const icon = SYMBOL_ICONS[sym.symbolType] ?? "?";
								const symbolColor =
									SYMBOL_COLORS[sym.symbolType as keyof typeof SYMBOL_COLORS] ??
									COLORS.zinc400;
								return (
									<text
										content={s(
											t`  ${symbolColor}${icon}${COLORS.reset} ${sym.symbol.padEnd(24)} ${dim(`${sym.totalConnections} connections`)}`
										)}
										height={1}
										key={`${sym.symbol}-${sym.path}`}
									/>
								);
							})}
					</box>
				)}

				{insights && insights.largestSymbols.length > 0 && (
					<box
						border
						borderStyle="rounded"
						flexDirection="column"
						marginTop={1}
						paddingX={1}
						title=" Largest Symbols "
					>
						{insights.largestSymbols
							.slice(0, 5)
							.map((sym: CodeInsights["largestSymbols"][number]) => {
								const icon = SYMBOL_ICONS[sym.symbolType] ?? "?";
								const symbolColor =
									SYMBOL_COLORS[sym.symbolType as keyof typeof SYMBOL_COLORS] ??
									COLORS.zinc400;
								return (
									<text
										content={s(
											t`  ${symbolColor}${icon}${COLORS.reset} ${sym.symbol.padEnd(24)} ${dim(`${sym.lineCount} lines`)}`
										)}
										height={1}
										key={`${sym.symbol}-${sym.path}`}
									/>
								);
							})}
					</box>
				)}

				{insights && insights.languageDistribution.length > 0 && (
					<box
						border
						borderStyle="rounded"
						flexDirection="column"
						marginTop={1}
						paddingX={1}
						title=" Language Distribution "
					>
						{insights.languageDistribution.map(
							(lang: CodeInsights["languageDistribution"][number]) => (
								<text
									content={s(
										t`  ${SEMANTIC.primary}${lang.language.padEnd(16)}${COLORS.reset} ${String(lang.count).padStart(5)}  ${dim(`(${lang.percentage.toFixed(1)}%)`)}`
									)}
									height={1}
									key={lang.language}
								/>
							)
						)}
					</box>
				)}

				{recent.length > 0 && (
					<box
						border
						borderStyle="rounded"
						flexDirection="column"
						marginTop={1}
						paddingX={1}
						title=" Recent Activity "
					>
						{recent.map((sess: RecentSession, i: number) => {
							const fileCount = sess.filesChanged
								? sess.filesChanged.split(",").filter(Boolean).length
								: 0;
							const agent =
								sess.agent && sess.agent !== "unknown"
									? `[${sess.agent}] `
									: "";
							return (
								<text
									content={s(
										t`  ${agent}${truncate(sess.summary || "no summary", 42)}  ${dim(formatTime(sess.timestamp))}${fileCount > 0 ? dim(`  ${fileCount}f`) : ""}`
									)}
									height={1}
									key={`${sess.timestamp}-${i}`}
								/>
							);
						})}
					</box>
				)}

				{stats.topFiles.length > 0 && (
					<box
						border
						borderStyle="rounded"
						flexDirection="column"
						marginTop={1}
						paddingX={1}
						title=" Most Touched Files "
					>
						{stats.topFiles.slice(0, 10).map(({ file, count }) => (
							<text
								content={s(
									t`  ${COLORS.cyan}›${COLORS.reset} ${file}  ${dim(`(${count})`)}`
								)}
								height={1}
								key={file}
							/>
						))}
					</box>
				)}
			</box>
		</scrollbox>
	);
}
