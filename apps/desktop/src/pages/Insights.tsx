import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type CodeInsights } from "@/api";
import AnimatedNumber from "@/components/charts/AnimatedNumber";
import DonutChart from "@/components/charts/DonutChart";
import FileTreemap from "@/components/charts/FileTreemap";
import HorizontalBarChart from "@/components/charts/HorizontalBarChart";
import RadarHealth from "@/components/charts/RadarHealth";
import {
	CHART_COLORS,
	LANG_CHART_COLORS,
	TYPE_CHART_COLORS,
} from "@/components/charts/theme";

function StatNumber({
	value,
	label,
	accent,
}: {
	value: number | string;
	label: string;
	accent?: boolean;
}) {
	return (
		<div className="text-center">
			<div
				className={`font-bold text-3xl tabular-nums ${accent ? "text-indigo-400" : "text-zinc-100"}`}
			>
				{typeof value === "number" ? <AnimatedNumber value={value} /> : value}
			</div>
			<div className="mt-1 text-xs text-zinc-500">{label}</div>
		</div>
	);
}

function EmptyState({ onIndex }: { onIndex: () => void }) {
	return (
		<div className="flex h-64 items-center justify-center">
			<div className="card max-w-md p-8 text-center">
				<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10">
					<svg
						aria-hidden="true"
						className="h-6 w-6 text-indigo-400"
						fill="currentColor"
						viewBox="0 0 16 16"
					>
						<path d="M1.5 14.25a.75.75 0 0 1 0-1.5h13a.75.75 0 0 1 0 1.5h-13Z" />
						<path d="M3 11.5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h1.5a1 1 0 0 1 1 1v2.5a1 1 0 0 1-1 1H3Zm4 0a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h1.5a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H7Zm4 0a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h1.5a1 1 0 0 1 1 1v8.5a1 1 0 0 1-1 1H11Z" />
					</svg>
				</div>
				<p className="font-semibold text-zinc-200">No code insights yet</p>
				<p className="mt-2 text-sm text-zinc-500">
					Index your codebase to unlock insights about your code structure,
					dependencies, and potential issues.
				</p>
				<button className="btn-primary mt-4" onClick={onIndex} type="button">
					Index Code Now
				</button>
			</div>
		</div>
	);
}

function IndexingOverlay({ message }: { message: string }) {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
			<div className="card max-w-sm p-8 text-center">
				<div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
				<p className="font-medium text-zinc-200">Indexing code...</p>
				<p className="mt-2 text-sm text-zinc-500">{message}</p>
			</div>
		</div>
	);
}

function buildHealthData(insights: CodeInsights) {
	const deadRatio =
		insights.totalSymbols > 0
			? 1 - insights.deadCode.length / insights.totalSymbols
			: 1;
	const avgNorm = Math.min(insights.avgSymbolsPerFile / 20, 1);
	const maxConn = insights.mostConnected[0]?.totalConnections ?? 0;
	const connectNorm = Math.min(maxConn / 30, 1);
	const langDiv = Math.min(insights.languageDistribution.length / 5, 1);
	const fileSpread = Math.min(insights.totalFiles / 50, 1);

	return [
		{ axis: "Health", value: Math.round(deadRatio * 100) },
		{ axis: "Density", value: Math.round(avgNorm * 100) },
		{ axis: "Connectivity", value: Math.round(connectNorm * 100) },
		{ axis: "Diversity", value: Math.round(langDiv * 100) },
		{ axis: "Spread", value: Math.round(fileSpread * 100) },
	];
}

export default function Insights() {
	const navigate = useNavigate();
	const [insights, setInsights] = useState<CodeInsights | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [indexing, setIndexing] = useState(false);
	const [indexMessage, setIndexMessage] = useState("");
	const [deadExpanded, setDeadExpanded] = useState(false);

	const loadInsights = useCallback(() => {
		setLoading(true);
		setError(null);
		api.code
			.insights()
			.then(setInsights)
			.catch((e) => {
				if (e instanceof Error && e.message.includes("404")) {
					setInsights(null);
				} else {
					setError(e instanceof Error ? e.message : String(e));
				}
			})
			.finally(() => setLoading(false));
	}, []);

	useEffect(() => {
		loadInsights();
	}, [loadInsights]);

	const handleIndexCode = useCallback(() => {
		setIndexing(true);
		setIndexMessage("Starting...");
		const controller = api.code.indexCode((event) => {
			if (event.event === "progress") {
				setIndexMessage(event.data.message);
			} else if (event.event === "done") {
				setIndexing(false);
				loadInsights();
			} else if (event.event === "error") {
				setIndexing(false);
				setError(event.data.message);
			}
		});
		return () => controller.abort();
	}, [loadInsights]);

	if (loading) {
		return (
			<div className="flex h-64 items-center justify-center">
				<div className="flex items-center gap-3 text-sm text-zinc-500">
					<div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-400" />
					Analyzing codebase...
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex h-64 items-center justify-center">
				<div className="card max-w-md p-8 text-center">
					<p className="font-semibold text-zinc-200">Failed to load insights</p>
					<p className="mt-2 text-sm text-zinc-500">{error}</p>
					<button
						className="btn-secondary mt-4"
						onClick={loadInsights}
						type="button"
					>
						Retry
					</button>
				</div>
			</div>
		);
	}

	if (!insights) {
		return <EmptyState onIndex={handleIndexCode} />;
	}

	const langDonutData = insights.languageDistribution.map((l) => ({
		name: l.language,
		value: l.count,
		color: LANG_CHART_COLORS[l.language],
	}));

	const typeDonutData = insights.typeDistribution.map((t) => ({
		name: t.symbolType,
		value: t.count,
		color: TYPE_CHART_COLORS[t.symbolType],
	}));

	const connectedBarData = insights.mostConnected.slice(0, 10).map((s) => ({
		name: s.symbol,
		value: s.callerCount,
		value2: s.calleeCount,
		value3: s.importerCount,
	}));

	const largestBarData = insights.largestSymbols.slice(0, 10).map((s) => ({
		name: s.symbol,
		value: s.lineCount,
	}));

	const treemapData = insights.hotFiles.slice(0, 24).map((f) => ({
		name: f.path,
		size: f.symbolCount,
	}));

	const healthData = buildHealthData(insights);

	const deadCodeShown = deadExpanded
		? insights.deadCode
		: insights.deadCode.slice(0, 8);

	return (
		<div className="space-y-8">
			{indexing && <IndexingOverlay message={indexMessage} />}

			<div className="fade-in-up flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">Code Insights</h1>
					<p className="mt-1 text-sm text-zinc-500">
						AI-powered analysis of your codebase structure
					</p>
				</div>
				<button
					className="btn-secondary text-xs"
					disabled={indexing}
					onClick={handleIndexCode}
					type="button"
				>
					{indexing ? "Indexing..." : "Re-index"}
				</button>
			</div>

			<div className="card fade-in-up stagger-1 p-6">
				<div className="flex items-center justify-around">
					<StatNumber accent label="Symbols" value={insights.totalSymbols} />
					<div className="h-10 w-px bg-zinc-800" />
					<StatNumber label="Files" value={insights.totalFiles} />
					<div className="h-10 w-px bg-zinc-800" />
					<StatNumber label="Avg/File" value={insights.avgSymbolsPerFile} />
					<div className="h-10 w-px bg-zinc-800" />
					<StatNumber
						label="Languages"
						value={insights.languageDistribution.length}
					/>
					<div className="h-10 w-px bg-zinc-800" />
					<StatNumber label="Dead Code" value={insights.deadCode.length} />
				</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				<div className="card fade-in-up stagger-2 p-6">
					<h2 className="mb-4 font-semibold text-sm text-zinc-200">
						Language Distribution
					</h2>
					<div className="flex items-center gap-6">
						<DonutChart
							data={langDonutData}
							innerLabel="languages"
							innerValue={langDonutData.length}
							size={170}
						/>
						<div className="flex flex-1 flex-col gap-2">
							{langDonutData.map((l) => (
								<div className="flex items-center gap-2" key={l.name}>
									<span
										className="h-2.5 w-2.5 shrink-0 rounded-full"
										style={{ background: l.color ?? CHART_COLORS.indigo }}
									/>
									<span className="flex-1 text-xs text-zinc-400">{l.name}</span>
									<span className="text-xs text-zinc-600 tabular-nums">
										{l.value}
									</span>
								</div>
							))}
						</div>
					</div>
				</div>

				<div className="card fade-in-up stagger-3 p-6">
					<h2 className="mb-4 font-semibold text-sm text-zinc-200">
						Symbol Types
					</h2>
					<div className="flex items-center gap-6">
						<DonutChart
							data={typeDonutData}
							innerLabel="types"
							innerValue={typeDonutData.length}
							size={170}
						/>
						<div className="flex flex-1 flex-col gap-2">
							{typeDonutData.map((t) => (
								<div className="flex items-center gap-2" key={t.name}>
									<span
										className="h-2.5 w-2.5 shrink-0 rounded-full"
										style={{ background: t.color ?? CHART_COLORS.indigo }}
									/>
									<span className="flex-1 text-xs text-zinc-400">{t.name}</span>
									<span className="text-xs text-zinc-600 tabular-nums">
										{t.value}
									</span>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>

			<div className="card fade-in-up stagger-4 p-6">
				<div className="mb-4 flex items-center justify-between">
					<div>
						<h2 className="font-semibold text-sm text-zinc-200">
							Most Connected Symbols
						</h2>
						<p className="mt-0.5 text-xs text-zinc-600">
							Central pieces with the highest dependency count
						</p>
					</div>
					<div className="flex items-center gap-3 text-[10px]">
						<span className="flex items-center gap-1.5">
							<span
								className="h-2 w-2 rounded-full"
								style={{ background: CHART_COLORS.emerald }}
							/>
							<span className="text-zinc-500">Callers</span>
						</span>
						<span className="flex items-center gap-1.5">
							<span
								className="h-2 w-2 rounded-full"
								style={{ background: CHART_COLORS.blue }}
							/>
							<span className="text-zinc-500">Callees</span>
						</span>
						<span className="flex items-center gap-1.5">
							<span
								className="h-2 w-2 rounded-full"
								style={{ background: CHART_COLORS.amber }}
							/>
							<span className="text-zinc-500">Importers</span>
						</span>
					</div>
				</div>
				<HorizontalBarChart
					barKeys={[
						{ key: "value", color: CHART_COLORS.emerald, label: "Callers" },
						{ key: "value2", color: CHART_COLORS.blue, label: "Callees" },
						{ key: "value3", color: CHART_COLORS.amber, label: "Importers" },
					]}
					data={connectedBarData}
					onClick={(name) =>
						navigate(`/code?symbol=${encodeURIComponent(name)}`)
					}
					stacked
				/>
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				<div className="card fade-in-up stagger-5 p-6">
					<h2 className="mb-1 font-semibold text-sm text-zinc-200">
						Largest Symbols
					</h2>
					<p className="mb-4 text-xs text-zinc-600">
						May benefit from refactoring
					</p>
					<HorizontalBarChart
						barKeys={[
							{ key: "value", color: CHART_COLORS.amber, label: "Lines" },
						]}
						data={largestBarData}
						onClick={(name) =>
							navigate(`/code?symbol=${encodeURIComponent(name)}`)
						}
					/>
				</div>

				<div className="card fade-in-up stagger-6 flex flex-col items-center p-6">
					<h2 className="mb-2 self-start font-semibold text-sm text-zinc-200">
						Codebase Health
					</h2>
					<p className="mb-2 self-start text-xs text-zinc-600">
						Overall quality indicators
					</p>
					<RadarHealth data={healthData} size={220} />
				</div>
			</div>

			{treemapData.length > 0 && (
				<div className="card fade-in-up stagger-7 p-6">
					<h2 className="mb-1 font-semibold text-sm text-zinc-200">
						File Density Map
					</h2>
					<p className="mb-4 text-xs text-zinc-600">
						Files sized by symbol count — key structural pillars
					</p>
					<FileTreemap
						data={treemapData}
						height={300}
						onClick={(path) =>
							navigate(`/code?file=${encodeURIComponent(path)}`)
						}
					/>
				</div>
			)}

			{insights.deadCode.length > 0 && (
				<div className="card fade-in-up stagger-8 p-6">
					<div className="mb-4 flex items-center justify-between">
						<div>
							<h2 className="font-semibold text-sm text-zinc-200">
								Potential Dead Code
							</h2>
							<p className="mt-0.5 text-xs text-zinc-600">
								{insights.deadCode.length} symbols with no detected callers or
								importers
							</p>
						</div>
						{insights.deadCode.length > 8 && (
							<button
								className="btn-ghost text-xs"
								onClick={() => setDeadExpanded(!deadExpanded)}
								type="button"
							>
								{deadExpanded
									? "Show less"
									: `Show all ${insights.deadCode.length}`}
							</button>
						)}
					</div>
					<div className="space-y-1">
						{deadCodeShown.map((s) => (
							<button
								className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-zinc-800/40"
								key={`${s.symbol}-${s.path}`}
								onClick={() =>
									navigate(`/code?symbol=${encodeURIComponent(s.symbol)}`)
								}
								type="button"
							>
								<span
									className="h-2 w-2 shrink-0 rounded-full"
									style={{
										background:
											TYPE_CHART_COLORS[s.symbolType] ?? CHART_COLORS.indigo,
									}}
								/>
								<div className="min-w-0 flex-1">
									<span className="font-mono text-[13px] text-zinc-300">
										{s.symbol}
									</span>
									<span className="ml-2 text-[11px] text-zinc-600">
										{s.symbolType}
									</span>
								</div>
								<span className="max-w-[200px] shrink-0 truncate text-[11px] text-zinc-600">
									{s.path}
								</span>
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
