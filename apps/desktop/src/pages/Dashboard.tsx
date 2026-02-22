import { useNavigate } from "react-router-dom";
import type { CodeInsights, RecentSession } from "@/api";
import DonutChart from "@/components/charts/DonutChart";
import HorizontalBarChart from "@/components/charts/HorizontalBarChart";
import MiniAreaChart from "@/components/charts/MiniAreaChart";
import RadarHealth from "@/components/charts/RadarHealth";
import { CHART_COLORS, LANG_CHART_COLORS } from "@/components/charts/theme";
import StatusCard from "@/components/StatusCard";
import {
	useCodeFiles,
	useCodeInsights,
	useCodeStats,
	useRecentSessions,
	useStatus,
} from "@/hooks/queries";

function FileIcon() {
	return (
		<svg
			aria-hidden="true"
			className="h-3.5 w-3.5 shrink-0 text-zinc-600"
			fill="currentColor"
			viewBox="0 0 16 16"
		>
			<path d="M4 1.75C4 .784 4.784 0 5.75 0h5.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v8.586A1.75 1.75 0 0 1 14.25 15H5.75A1.75 1.75 0 0 1 4 13.25V1.75Z" />
			<path d="M0 4.75C0 3.784.784 3 1.75 3H3v10.25A2.75 2.75 0 0 0 5.75 16h7.5v.25A1.75 1.75 0 0 1 11.5 18h-9.75A1.75 1.75 0 0 1 0 16.25V4.75Z" />
		</svg>
	);
}

const AGENT_COLORS: Record<string, string> = {
	cursor: CHART_COLORS.indigo,
	copilot: CHART_COLORS.emerald,
	claude: CHART_COLORS.amber,
	windsurf: CHART_COLORS.cyan,
};

function agentColor(agent: string): string {
	return AGENT_COLORS[agent.toLowerCase()] ?? CHART_COLORS.purple;
}

function relativeTime(timestamp: string): string {
	const diff = Date.now() - new Date(timestamp).getTime();
	const mins = Math.floor(diff / 60_000);
	if (mins < 1) {
		return "just now";
	}
	if (mins < 60) {
		return `${mins}m ago`;
	}
	const hours = Math.floor(mins / 60);
	if (hours < 24) {
		return `${hours}h ago`;
	}
	const days = Math.floor(hours / 24);
	if (days < 30) {
		return `${days}d ago`;
	}
	return `${Math.floor(days / 30)}mo ago`;
}

function buildHealthData(insights: CodeInsights, chunks: number) {
	const maxConnected = insights.mostConnected[0]?.totalConnections ?? 0;
	const deadRatio =
		insights.totalSymbols > 0
			? 1 - insights.deadCode.length / insights.totalSymbols
			: 1;
	return [
		{ axis: "Health", value: Math.round(deadRatio * 100) },
		{
			axis: "Density",
			value: Math.round(Math.min(insights.avgSymbolsPerFile / 20, 1) * 100),
		},
		{
			axis: "Connect",
			value: Math.round(Math.min(maxConnected / 30, 1) * 100),
		},
		{
			axis: "Diversity",
			value: Math.round(
				Math.min(insights.languageDistribution.length / 5, 1) * 100
			),
		},
		{ axis: "Memory", value: Math.round(Math.min(chunks / 100, 1) * 100) },
	];
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex h-64 items-center justify-center">{children}</div>
	);
}

function prepareDashboardData(
	insights: CodeInsights | null,
	recent: RecentSession[],
	totalChunks: number
) {
	const langDonutData =
		insights?.languageDistribution.map((l) => ({
			name: l.language,
			value: l.count,
			color: LANG_CHART_COLORS[l.language],
		})) ?? [];

	const sparklineData = recent.map((_s, i) => ({
		value: 10 + ((i * 17 + 7) % 40),
	}));

	const connectedBarData =
		insights?.mostConnected.slice(0, 5).map((s) => ({
			name: s.symbol,
			value: s.callerCount,
			value2: s.calleeCount,
			value3: s.importerCount,
		})) ?? [];

	const healthData = insights ? buildHealthData(insights, totalChunks) : [];

	return { langDonutData, sparklineData, connectedBarData, healthData };
}

function DashboardContent({
	status,
	codeStats,
	insights,
	recent,
	codeFiles,
}: {
	status: StatusResponse;
	codeStats: CodeStats | null;
	insights: CodeInsights | null;
	recent: RecentSession[];
	codeFiles: FileInfo[];
}) {
	const navigate = useNavigate();
	const { stats, config } = status;
	const lastCommit = config?.lastIndexedCommit;
	const { langDonutData, sparklineData, connectedBarData, healthData } =
		prepareDashboardData(insights, recent, stats?.totalChunks ?? 0);

	return (
		<div className="space-y-8">
			<div className="fade-in-up">
				<h1 className="font-bold text-2xl tracking-tight">Dashboard</h1>
				<p className="mt-1 text-sm text-zinc-500">
					Overview of your agent memory
					{lastCommit && (
						<span className="ml-2 text-zinc-600">
							&middot; last sync{" "}
							<code className="font-mono text-zinc-500">
								{lastCommit.slice(0, 7)}
							</code>
						</span>
					)}
				</p>
			</div>

			<div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
				<StatusCard
					detail={config?.provider ?? "unknown"}
					label="Status"
					value={stats?.hasTable ? "Active" : "Empty"}
					variant="accent"
				/>
				<StatusCard
					chart={
						sparklineData.length > 1 ? (
							<MiniAreaChart
								className="w-16"
								data={sparklineData}
								height={28}
							/>
						) : undefined
					}
					detail="indexed in vector store"
					label="Chunks"
					value={stats?.totalChunks ?? 0}
				/>
				<StatusCard
					detail={stats?.agents.join(", ") || "none detected"}
					label="Agents"
					value={stats?.agents.length ?? 0}
				/>
				<StatusCard
					detail={config?.embeddingModel ?? "default"}
					label="Model"
					value={config?.provider === "openai" ? "OpenAI" : "Ollama"}
				/>
				<StatusCard
					detail={codeStats?.languages.join(", ") || "run yep index-code"}
					label="Symbols"
					value={codeStats?.totalSymbols ?? 0}
				/>
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				{recent.length > 0 && (
					<div className="card fade-in-up stagger-1 p-6">
						<h2 className="mb-1 font-semibold text-sm text-zinc-200">
							Recent Activity
						</h2>
						<p className="mb-4 text-xs text-zinc-600">
							Latest indexed sessions
						</p>
						<div className="space-y-1">
							{recent.map((s, i) => (
								<div
									className={`fade-in-up flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-zinc-800/40 stagger-${Math.min(i + 1, 8)}`}
									key={`${s.timestamp}-${i}`}
								>
									<div
										className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
										style={{ background: agentColor(s.agent ?? "unknown") }}
									/>
									<div className="min-w-0 flex-1">
										<p className="truncate text-[13px] text-zinc-300 leading-snug">
											{s.summary || "No summary"}
										</p>
										<div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-600">
											{s.timestamp && (
												<span className="rounded-md bg-zinc-800/60 px-1.5 py-0.5">
													{relativeTime(s.timestamp)}
												</span>
											)}
											{s.agent && s.agent !== "unknown" && (
												<span
													className="rounded-md px-1.5 py-0.5"
													style={{
														background: `${agentColor(s.agent)}15`,
														color: agentColor(s.agent),
													}}
												>
													{s.agent}
												</span>
											)}
											{s.filesChanged && (
												<span className="truncate">
													{s.filesChanged.split(",").length} file(s)
												</span>
											)}
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
				)}

				{stats && stats.topFiles.length > 0 && (
					<div className="card fade-in-up stagger-2 p-6">
						<h2 className="mb-1 font-semibold text-sm text-zinc-200">
							Most Referenced Files
						</h2>
						<p className="mb-4 text-xs text-zinc-600">
							Files frequently mentioned in past sessions
						</p>
						<div className="space-y-1">
							{stats.topFiles.map(({ file, count }) => (
								<button
									className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150 hover:bg-zinc-800/60"
									key={file}
									onClick={() =>
										navigate(`/diff?file=${encodeURIComponent(file)}`)
									}
									type="button"
								>
									<FileIcon />
									<span className="min-w-0 flex-1 truncate font-mono text-[13px] text-zinc-300">
										{file}
									</span>
									<span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 font-mono text-[11px] text-zinc-500">
										{count}
									</span>
									<svg
										aria-hidden="true"
										className="h-3 w-3 shrink-0 text-zinc-700"
										fill="currentColor"
										viewBox="0 0 16 16"
									>
										<path
											clipRule="evenodd"
											d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z"
											fillRule="evenodd"
										/>
									</svg>
								</button>
							))}
						</div>
					</div>
				)}
			</div>

			<div className="grid gap-6 lg:grid-cols-3">
				{langDonutData.length > 0 && (
					<div className="card fade-in-up stagger-3 flex flex-col items-center p-6">
						<h2 className="mb-4 self-start font-semibold text-sm text-zinc-200">
							Language Mix
						</h2>
						<DonutChart
							data={langDonutData}
							innerLabel="languages"
							innerValue={langDonutData.length}
							size={160}
						/>
						<div className="mt-4 flex flex-wrap justify-center gap-3">
							{langDonutData.map((l) => (
								<div className="flex items-center gap-1.5" key={l.name}>
									<span
										className="h-2 w-2 rounded-full"
										style={{ background: l.color ?? CHART_COLORS.indigo }}
									/>
									<span className="text-[11px] text-zinc-400">{l.name}</span>
								</div>
							))}
						</div>
					</div>
				)}

				{connectedBarData.length > 0 && (
					<div className="card fade-in-up stagger-4 p-6">
						<div className="mb-4 flex items-center justify-between">
							<h2 className="font-semibold text-sm text-zinc-200">
								Top Connected
							</h2>
							<button
								className="btn-ghost text-xs"
								onClick={() => navigate("/insights")}
								type="button"
							>
								View all
							</button>
						</div>
						<HorizontalBarChart
							barKeys={[
								{ key: "value", color: CHART_COLORS.emerald, label: "Callers" },
								{ key: "value2", color: CHART_COLORS.blue, label: "Callees" },
								{
									key: "value3",
									color: CHART_COLORS.amber,
									label: "Importers",
								},
							]}
							data={connectedBarData}
							onClick={(name) =>
								navigate(`/code?symbol=${encodeURIComponent(name)}`)
							}
							stacked
						/>
					</div>
				)}

				{healthData.length > 0 && (
					<div className="card fade-in-up stagger-5 flex flex-col items-center p-6">
						<h2 className="mb-2 self-start font-semibold text-sm text-zinc-200">
							Codebase Health
						</h2>
						<RadarHealth data={healthData} size={200} />
					</div>
				)}
			</div>

			{codeFiles.length > 0 && (
				<div className="card fade-in-up stagger-6 p-6">
					<div className="mb-4 flex items-center justify-between">
						<div>
							<h2 className="font-semibold text-sm text-zinc-200">
								Indexed Code Files
							</h2>
							<p className="mt-0.5 text-xs text-zinc-600">
								Recently indexed source files with symbol counts
							</p>
						</div>
						<button
							className="btn-ghost text-xs"
							onClick={() => navigate("/code")}
							type="button"
						>
							View all
						</button>
					</div>
					<div className="grid grid-cols-2 gap-2">
						{codeFiles.map((f) => (
							<button
								className="flex items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-zinc-800/60"
								key={f.path}
								onClick={() =>
									navigate(`/code?file=${encodeURIComponent(f.path)}`)
								}
								type="button"
							>
								<span className="min-w-0 flex-1 truncate font-mono text-[12px] text-zinc-400">
									{f.path}
								</span>
								<span className="badge ml-2 shrink-0">{f.symbolCount}</span>
							</button>
						))}
					</div>
				</div>
			)}

			<div className="fade-in-up stagger-7 flex gap-3">
				<button
					className="btn-primary"
					onClick={() => navigate("/sync")}
					type="button"
				>
					Sync Now
				</button>
				<button
					className="btn-secondary"
					onClick={() => navigate("/search")}
					type="button"
				>
					Search Memory
				</button>
			</div>
		</div>
	);
}

export default function Dashboard() {
	const {
		data: status,
		isLoading: statusLoading,
		error: statusError,
	} = useStatus();
	const { data: codeStats } = useCodeStats();
	const { data: recentData } = useRecentSessions(5);
	const { data: codeFilesData } = useCodeFiles(8);
	const { data: insights } = useCodeInsights();

	if (statusLoading) {
		return (
			<CenteredMessage>
				<div className="flex items-center gap-3 text-sm text-zinc-500">
					<div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-400" />
					Loading...
				</div>
			</CenteredMessage>
		);
	}

	if (statusError) {
		const message =
			statusError instanceof Error ? statusError.message : String(statusError);
		return (
			<CenteredMessage>
				<div className="card max-w-md p-8 text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10">
						<span className="text-lg text-red-400">!</span>
					</div>
					<p className="font-semibold text-zinc-200">Connection failed</p>
					<p className="mt-2 text-sm text-zinc-500">{message}</p>
					<p className="mt-4 text-xs text-zinc-600">
						Run{" "}
						<code className="rounded-md bg-zinc-800 px-2 py-1 font-mono text-zinc-300">
							yep gui
						</code>{" "}
						to start the server
					</p>
				</div>
			</CenteredMessage>
		);
	}

	if (!status?.initialized) {
		return (
			<CenteredMessage>
				<div className="card max-w-md p-8 text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10">
						<span className="text-amber-400 text-lg">?</span>
					</div>
					<p className="font-semibold text-zinc-200">Not initialized</p>
					<p className="mt-2 text-sm text-zinc-500">
						Run{" "}
						<code className="rounded-md bg-zinc-800 px-2 py-1 font-mono text-zinc-300">
							yep enable
						</code>{" "}
						in your project directory first
					</p>
				</div>
			</CenteredMessage>
		);
	}

	return (
		<DashboardContent
			codeFiles={codeFilesData?.files ?? []}
			codeStats={codeStats ?? null}
			insights={insights ?? null}
			recent={recentData?.sessions ?? []}
			status={status}
		/>
	);
}
