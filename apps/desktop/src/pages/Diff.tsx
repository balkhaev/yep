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
		<div className="space-y-4">
			<div className="fade-in-up">
				<h1 className="font-bold text-2xl tracking-tight">Timeline</h1>
				<p className="mt-1 text-sm text-zinc-500">
					Track how files evolved across agent sessions
				</p>
			</div>

			<form className="flex gap-2" onSubmit={handleSearch}>
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

			{topFiles.length > 0 && !searched && (
				<div className="flex flex-wrap gap-2">
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
			)}

			{error && (
				<div className="rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-red-400 text-sm">
					{error}
				</div>
			)}

			{searched && !loading && !error && (
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
