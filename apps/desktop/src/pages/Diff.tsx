import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
	Area,
	AreaChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { api, type SolutionResult, type StatusResponse } from "@/api";
import { CHART_COLORS, TOOLTIP_STYLE } from "@/components/charts/theme";
import DiffTimeline from "@/components/DiffTimeline";
import PageHeader from "@/components/PageHeader";

function buildActivityData(results: SolutionResult[]) {
	if (results.length === 0) {
		return [];
	}

	const byDate = new Map<string, number>();
	for (const r of results) {
		if (!r.timestamp) {
			continue;
		}
		const d = new Date(r.timestamp).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		});
		byDate.set(d, (byDate.get(d) ?? 0) + 1);
	}

	return Array.from(byDate.entries()).map(([date, count]) => ({
		date,
		sessions: count,
	}));
}

export default function Diff() {
	const [searchParams, setSearchParams] = useSearchParams();
	const initialFile = searchParams.get("file") ?? "";

	const [file, setFile] = useState(initialFile);
	const [results, setResults] = useState<SolutionResult[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [searched, setSearched] = useState(false);
	const [topFiles, setTopFiles] = useState<
		Array<{ file: string; count: number }>
	>([]);
	const [agents, setAgents] = useState<string[]>([]);
	const [agentFilter, setAgentFilter] = useState("");

	useEffect(() => {
		api
			.status()
			.then((s: StatusResponse) => {
				if (s.stats?.topFiles) {
					setTopFiles(s.stats.topFiles);
				}
				if (s.stats?.agents) {
					setAgents(s.stats.agents);
				}
			})
			.catch(() => undefined);
	}, []);

	const handleSearch = useCallback(
		async (e?: FormEvent) => {
			e?.preventDefault();
			if (!file.trim()) {
				return;
			}

			setLoading(true);
			setError(null);
			setSearched(true);
			setSearchParams({ file: file.trim() });

			try {
				const res = await api.diff(file.trim());
				setResults(res.results);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to load diff");
			} finally {
				setLoading(false);
			}
		},
		[file, setSearchParams]
	);

	useEffect(() => {
		if (initialFile) {
			handleSearch();
		}
	}, []);

	const filteredResults = agentFilter
		? results.filter((r) => r.agent === agentFilter)
		: results;

	const activityData = buildActivityData(filteredResults);

	return (
		<div className="space-y-8">
			<PageHeader
				subtitle="Track how files evolved across agent sessions"
				title="Timeline"
			/>

			<form className="flex gap-3" onSubmit={handleSearch}>
				<input
					className="input flex-1 font-mono"
					list="top-files"
					onChange={(e) => setFile(e.target.value)}
					placeholder="Enter file path..."
					type="text"
					value={file}
				/>
				<datalist id="top-files">
					{topFiles.map(({ file }) => (
						<option key={file} value={file} />
					))}
				</datalist>
				<button
					className="btn-primary"
					disabled={loading || !file.trim()}
					type="submit"
				>
					{loading ? (
						<div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
					) : (
						"Show Timeline"
					)}
				</button>
			</form>

			{!searched && topFiles.length === 0 && (
				<div className="card fade-in-up p-8 text-center">
					<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-900/20">
						<svg
							className="h-8 w-8 text-amber-600"
							fill="none"
							stroke="currentColor"
							strokeWidth={1.5}
							viewBox="0 0 24 24"
						>
							<path
								d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</div>
					<h3 className="mb-2 font-semibold text-sm text-zinc-300">
						No data yet
					</h3>
					<p className="mb-4 text-sm text-zinc-500">
						Run sync first to track agent sessions and file changes
					</p>
					<a
						className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white transition-colors hover:bg-indigo-500"
						href="/sync"
					>
						<svg
							className="h-4 w-4"
							fill="none"
							stroke="currentColor"
							strokeWidth={2}
							viewBox="0 0 24 24"
						>
							<path
								d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
						Go to Sync
					</a>
				</div>
			)}

			{!searched && topFiles.length > 0 && (
				<div className="card fade-in-up p-8">
					<div className="mb-6 text-center">
						<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800/50">
							<svg
								className="h-8 w-8 text-zinc-600"
								fill="none"
								stroke="currentColor"
								strokeWidth={1.5}
								viewBox="0 0 24 24"
							>
								<path
									d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
						</div>
						<h3 className="mb-2 font-semibold text-sm text-zinc-300">
							Track File Evolution
						</h3>
						<p className="text-sm text-zinc-500">
							Enter a file path to see how it changed across different agent
							sessions
						</p>
					</div>
					<div className="space-y-3">
						<p className="text-center text-xs text-zinc-600">
							Most frequently modified files:
						</p>
						<div className="flex flex-wrap justify-center gap-2">
							{topFiles.slice(0, 8).map(({ file, count }) => (
								<button
									className="inline-flex items-center gap-1.5 truncate rounded-xl border border-zinc-800/60 px-3 py-1.5 font-mono text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
									key={file}
									onClick={() => {
										setFile(file);
										setTimeout(() => {
											const form = document.querySelector("form");
											form?.requestSubmit();
										}, 0);
									}}
									type="button"
								>
									{file}
									<span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
										{count}
									</span>
								</button>
							))}
						</div>
					</div>
				</div>
			)}

			{error && (
				<div className="rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-red-400 text-sm">
					{error}
				</div>
			)}

			{searched && !loading && !error && results.length === 0 && (
				<div className="card fade-in-up p-8 text-center">
					<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800/50">
						<svg
							className="h-8 w-8 text-zinc-600"
							fill="none"
							stroke="currentColor"
							strokeWidth={1.5}
							viewBox="0 0 24 24"
						>
							<path
								d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</div>
					<h3 className="mb-2 font-semibold text-sm text-zinc-300">
						No timeline found
					</h3>
					<p className="mb-6 text-sm text-zinc-500">
						{topFiles.length === 0
							? "Run sync first to track agent sessions and file changes"
							: "This file hasn't been modified in any tracked sessions yet"}
					</p>
					{topFiles.length === 0 ? (
						<a
							className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white transition-colors hover:bg-indigo-500"
							href="/sync"
						>
							<svg
								className="h-4 w-4"
								fill="none"
								stroke="currentColor"
								strokeWidth={2}
								viewBox="0 0 24 24"
							>
								<path
									d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
							Go to Sync
						</a>
					) : (
						<div className="space-y-3">
							<p className="text-xs text-zinc-600">
								Try one of these popular files:
							</p>
							<div className="flex flex-wrap justify-center gap-2">
								{topFiles.slice(0, 4).map(({ file, count }) => (
									<button
										className="inline-flex items-center gap-1.5 truncate rounded-xl border border-zinc-800/60 px-3 py-1.5 font-mono text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
										key={file}
										onClick={() => {
											setFile(file);
											setTimeout(() => {
												const form = document.querySelector("form");
												form?.requestSubmit();
											}, 0);
										}}
										type="button"
									>
										{file}
										<span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
											{count}
										</span>
									</button>
								))}
							</div>
						</div>
					)}
				</div>
			)}

			{searched && !loading && !error && results.length > 0 && (
				<>
					{activityData.length > 1 && (
						<div className="card fade-in-up p-5">
							<h2 className="mb-3 font-semibold text-[11px] text-zinc-600 uppercase tracking-widest">
								Activity Over Time
							</h2>
							<div style={{ height: 120 }}>
								<ResponsiveContainer height="100%" width="100%">
									<AreaChart
										data={activityData}
										margin={{ top: 4, right: 8, bottom: 0, left: -20 }}
									>
										<defs>
											<linearGradient
												id="activity-grad"
												x1="0"
												x2="0"
												y1="0"
												y2="1"
											>
												<stop
													offset="0%"
													stopColor={CHART_COLORS.indigo}
													stopOpacity={0.3}
												/>
												<stop
													offset="100%"
													stopColor={CHART_COLORS.indigo}
													stopOpacity={0}
												/>
											</linearGradient>
										</defs>
										<XAxis
											axisLine={false}
											dataKey="date"
											fontSize={10}
											tick={{ fill: "#71717a" }}
											tickLine={false}
										/>
										<YAxis
											allowDecimals={false}
											axisLine={false}
											fontSize={10}
											tick={{ fill: "#52525b" }}
											tickLine={false}
										/>
										<Tooltip {...TOOLTIP_STYLE} />
										<Area
											animationDuration={600}
											dataKey="sessions"
											fill="url(#activity-grad)"
											name="Sessions"
											stroke={CHART_COLORS.indigo}
											strokeWidth={2}
											type="monotone"
										/>
									</AreaChart>
								</ResponsiveContainer>
							</div>
						</div>
					)}

					<div className="card fade-in-up stagger-1 p-5">
						<div className="mb-4 flex items-center justify-between">
							<h2 className="font-mono text-sm text-zinc-400">
								{file}{" "}
								<span className="text-zinc-600">
									&mdash; {filteredResults.length} session
									{filteredResults.length !== 1 && "s"}
									{agentFilter && ` (${agentFilter})`}
								</span>
							</h2>
							{agents.length > 1 && results.length > 0 && (
								<select
									className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 outline-none"
									onChange={(e) => setAgentFilter(e.target.value)}
									value={agentFilter}
								>
									<option value="">All agents</option>
									{agents.map((a) => (
										<option key={a} value={a}>
											{a}
										</option>
									))}
								</select>
							)}
						</div>
						<DiffTimeline results={filteredResults} />
					</div>
				</>
			)}
		</div>
	);
}
