import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, type CodeInsights } from "@/api";
import AnimatedNumber from "@/components/charts/AnimatedNumber";
import ComplexityHistogram from "@/components/charts/ComplexityHistogram";
import DirectoryTable from "@/components/charts/DirectoryTable";
import DonutChart from "@/components/charts/DonutChart";
import FileTreemap from "@/components/charts/FileTreemap";
import GaugeChart from "@/components/charts/GaugeChart";
import HorizontalBarChart from "@/components/charts/HorizontalBarChart";
import RadarHealth from "@/components/charts/RadarHealth";
import RecommendationCard from "@/components/charts/RecommendationCard";
import {
	CHART_COLORS,
	LANG_CHART_COLORS,
	TYPE_CHART_COLORS,
} from "@/components/charts/theme";
import {
	queryKeys,
	useCodeInsights,
	useCodeRecommendations,
} from "@/hooks/queries";

const TABS = [
	{ id: "overview", label: "Overview" },
	{ id: "complexity", label: "Complexity" },
	{ id: "dependencies", label: "Dependencies" },
	{ id: "quality", label: "Quality" },
	{ id: "directories", label: "Directories" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function complexityGaugeColor(avg: number): string {
	if (avg > 15) {
		return CHART_COLORS.red;
	}
	if (avg > 8) {
		return CHART_COLORS.amber;
	}
	return CHART_COLORS.emerald;
}

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
	const connectNorm = Math.min(insights.medianConnections / 10, 1);
	const langDiv = Math.min(insights.languageDistribution.length / 5, 1);
	const fileSpread = Math.min(insights.totalFiles / 50, 1);
	const complexNorm =
		insights.totalSymbols > 0
			? (insights.complexityDistribution.find((d) => d.range === "1-5")
					?.count ?? 0) / insights.totalSymbols
			: 1;
	const docNorm = insights.documentationCoverage / 100;

	return [
		{ axis: "Health", value: Math.round(deadRatio * 100) },
		{ axis: "Density", value: Math.round(avgNorm * 100) },
		{ axis: "Connectivity", value: Math.round(connectNorm * 100) },
		{ axis: "Diversity", value: Math.round(langDiv * 100) },
		{ axis: "Spread", value: Math.round(fileSpread * 100) },
		{ axis: "Simplicity", value: Math.round(complexNorm * 100) },
		{ axis: "Docs", value: Math.round(docNorm * 100) },
	];
}

function OverviewTab({ insights }: { insights: CodeInsights }) {
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

	const healthData = buildHealthData(insights);

	return (
		<div className="space-y-6">
			<div className="card p-6">
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
					<StatNumber label="Avg Complexity" value={insights.avgComplexity} />
					<div className="h-10 w-px bg-zinc-800" />
					<StatNumber
						label="Doc Coverage"
						value={`${insights.documentationCoverage}%`}
					/>
				</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				<div className="card p-6">
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

				<div className="card p-6">
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

			<div className="card flex flex-col p-6">
				<h2 className="mb-2 font-semibold text-sm text-zinc-200">
					Codebase Health
				</h2>
				<p className="mb-2 text-xs text-zinc-600">
					Overall quality indicators (7 dimensions)
				</p>
				<div className="flex items-center justify-center">
					<RadarHealth data={healthData} size={260} />
				</div>
				<div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1.5">
					{[
						{ axis: "Health", desc: "Ratio of actively used symbols" },
						{ axis: "Density", desc: "Average symbols per file" },
						{ axis: "Connectivity", desc: "Median dependency connections" },
						{ axis: "Diversity", desc: "Number of languages used" },
						{ axis: "Spread", desc: "Number of indexed files" },
						{
							axis: "Simplicity",
							desc: "% of symbols with low complexity",
						},
						{ axis: "Docs", desc: "Documentation coverage" },
					].map((item) => {
						const metric = healthData.find((d) => d.axis === item.axis);
						return (
							<div className="flex items-center gap-2" key={item.axis}>
								<span className="w-20 text-[11px] text-zinc-400">
									{item.axis}
								</span>
								<span className="font-mono text-[11px] text-zinc-300 tabular-nums">
									{metric?.value ?? 0}%
								</span>
								<span className="text-[10px] text-zinc-600" title={item.desc}>
									{item.desc}
								</span>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}

function ComplexityTab({
	insights,
	onSymbolClick,
}: {
	insights: CodeInsights;
	onSymbolClick: (name: string) => void;
}) {
	const complexBarData = insights.topComplexSymbols.slice(0, 10).map((s) => ({
		name: s.symbol,
		value: s.cyclomatic,
		value2: s.cognitive,
	}));

	return (
		<div className="space-y-6">
			<div className="grid gap-6 lg:grid-cols-3">
				<div className="card flex flex-col items-center justify-center p-6">
					<GaugeChart
						color={complexityGaugeColor(insights.avgComplexity)}
						label="Avg Cyclomatic"
						size={140}
						value={Math.min(Math.round(insights.avgComplexity * 3.3), 100)}
					/>
					<p className="mt-2 text-center font-mono text-lg text-zinc-200">
						{insights.avgComplexity}
					</p>
				</div>
				<div className="card flex flex-col items-center justify-center p-6">
					<GaugeChart
						color={CHART_COLORS.indigo}
						label="Documentation"
						size={140}
						value={insights.documentationCoverage}
					/>
				</div>
				<div className="card p-6">
					<h2 className="mb-3 font-semibold text-sm text-zinc-200">
						Complexity Distribution
					</h2>
					<ComplexityHistogram
						data={insights.complexityDistribution}
						height={150}
					/>
				</div>
			</div>

			<div className="card p-6">
				<div className="mb-4">
					<h2 className="font-semibold text-sm text-zinc-200">
						Most Complex Symbols
					</h2>
					<p className="mt-0.5 text-xs text-zinc-600">
						Symbols with highest cyclomatic and cognitive complexity
					</p>
				</div>
				<div className="mb-4 flex items-center gap-3 text-[10px]">
					<span className="flex items-center gap-1.5">
						<span
							className="h-2 w-2 rounded-full"
							style={{ background: CHART_COLORS.red }}
						/>
						<span className="text-zinc-500">Cyclomatic</span>
					</span>
					<span className="flex items-center gap-1.5">
						<span
							className="h-2 w-2 rounded-full"
							style={{ background: CHART_COLORS.purple }}
						/>
						<span className="text-zinc-500">Cognitive</span>
					</span>
				</div>
				<HorizontalBarChart
					barKeys={[
						{ key: "value", color: CHART_COLORS.red, label: "Cyclomatic" },
						{ key: "value2", color: CHART_COLORS.purple, label: "Cognitive" },
					]}
					data={complexBarData}
					onClick={onSymbolClick}
					stacked
				/>
			</div>

			<div className="card p-6">
				<h2 className="mb-3 font-semibold text-sm text-zinc-200">
					Largest Symbols
				</h2>
				<p className="mb-4 text-xs text-zinc-600">
					May benefit from refactoring
				</p>
				<HorizontalBarChart
					barKeys={[
						{ key: "value", color: CHART_COLORS.amber, label: "Lines" },
					]}
					data={insights.largestSymbols.slice(0, 10).map((s) => ({
						name: s.symbol,
						value: s.lineCount,
					}))}
					onClick={onSymbolClick}
				/>
			</div>
		</div>
	);
}

function DependenciesTab({
	insights,
	onSymbolClick,
}: {
	insights: CodeInsights;
	onSymbolClick: (name: string) => void;
}) {
	const navigate = useNavigate();

	const connectedBarData = insights.mostConnected.slice(0, 10).map((s) => ({
		name: s.symbol,
		value: s.callerCount,
		value2: s.calleeCount,
		value3: s.importerCount,
	}));

	const treemapData = insights.hotFiles.slice(0, 24).map((f) => ({
		name: f.path,
		size: f.symbolCount,
	}));

	return (
		<div className="space-y-6">
			<div className="card p-6">
				<div className="mb-4 flex items-center justify-between">
					<div>
						<h2 className="font-semibold text-sm text-zinc-200">
							Most Connected Symbols
						</h2>
						<p className="mt-0.5 text-xs text-zinc-600">
							Central pieces with the highest dependency count (median:{" "}
							{insights.medianConnections})
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
					onClick={onSymbolClick}
					stacked
				/>
			</div>

			{treemapData.length > 0 && (
				<div className="card p-6">
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
		</div>
	);
}

function QualityTab({
	insights,
	onSymbolClick,
}: {
	insights: CodeInsights;
	onSymbolClick: (name: string) => void;
}) {
	const [deadExpanded, setDeadExpanded] = useState(false);
	const [deadFilter, setDeadFilter] = useState("");
	const [shouldLoadRecs, setShouldLoadRecs] = useState(false);
	const queryClient = useQueryClient();
	const { data: recsData, isLoading: recsLoading } = useCodeRecommendations(shouldLoadRecs);

	const handleGenerate = useCallback(() => {
		setShouldLoadRecs(true);
	}, []);

	const forceRegenerate = useCallback(async () => {
		const fresh = await api.code.recommendations(true);
		queryClient.setQueryData(queryKeys.codeRecommendations, fresh);
	}, [queryClient]);

	const filteredDeadCode = deadFilter
		? (() => {
				const lower = deadFilter.toLowerCase();
				return insights.deadCode.filter(
					(s) =>
						s.symbol.toLowerCase().includes(lower) ||
						s.path.toLowerCase().includes(lower) ||
						s.symbolType.toLowerCase().includes(lower)
				);
			})()
		: insights.deadCode;

	const deadCodeShown = deadExpanded
		? filteredDeadCode
		: filteredDeadCode.slice(0, 8);

	const recommendations = recsData?.recommendations ?? [];

	return (
		<div className="space-y-6">
			<div className="card p-6">
				<div className="mb-4 flex items-center justify-between">
					<div>
						<h2 className="font-semibold text-sm text-zinc-200">
							AI Recommendations
						</h2>
						<p className="mt-0.5 text-xs text-zinc-600">
							Actionable suggestions to improve code quality
						</p>
					</div>
					{shouldLoadRecs || recommendations.length > 0 ? (
						<button
							className="btn-ghost text-xs"
							disabled={recsLoading}
							onClick={forceRegenerate}
							type="button"
						>
							{recsLoading ? "Analyzing..." : "Regenerate"}
						</button>
					) : (
						<div className="flex flex-col items-end gap-1">
							<button
								className="btn-primary text-xs"
								onClick={handleGenerate}
								type="button"
							>
								Generate Recommendations
							</button>
							<span className="text-[10px] text-amber-500/80">
								⚠️ Will consume AI tokens
							</span>
						</div>
					)}
				</div>
				{recsLoading && recommendations.length === 0 ? (
					<div className="flex items-center gap-3 py-8 text-sm text-zinc-500">
						<div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-400" />
						Generating recommendations...
					</div>
				) : recommendations.length > 0 ? (
					<div className="space-y-3">
						{recommendations.map((rec) => (
							<RecommendationCard
								key={rec.id}
								onSymbolClick={onSymbolClick}
								recommendation={rec}
							/>
						))}
					</div>
				) : (
					<div className="py-8 text-center text-sm text-zinc-500">
						Click "Generate Recommendations" to get AI-powered suggestions
					</div>
				)}
			</div>

			{insights.duplicateClusters.length > 0 && (
				<div className="card p-6">
					<h2 className="mb-1 font-semibold text-sm text-zinc-200">
						Duplicate Code Clusters
					</h2>
					<p className="mb-4 text-xs text-zinc-600">
						{insights.duplicateClusters.length} clusters with{" "}
						{insights.duplicateSymbolCount} similar symbols
					</p>
					<div className="space-y-3">
						{insights.duplicateClusters.map((cluster) => (
							<div
								className="rounded-xl border border-zinc-800/40 bg-zinc-900/30 p-3"
								key={`cluster-${cluster.symbols.map((s) => s.symbol).join("-")}`}
							>
								<div className="mb-2 flex items-center gap-2">
									<span className="rounded-full bg-pink-500/15 px-2 py-0.5 font-mono text-[10px] text-pink-400">
										{Math.round(cluster.similarity * 100)}% similar
									</span>
									<span className="text-[10px] text-zinc-600">
										{cluster.symbols.length} symbols
									</span>
								</div>
								<div className="flex flex-wrap gap-1.5">
									{cluster.symbols.map((s) => (
										<button
											className="rounded-md bg-zinc-800/50 px-2 py-1 text-left transition-colors hover:bg-zinc-700/50"
											key={`${s.symbol}-${s.path}`}
											onClick={() => onSymbolClick(s.symbol)}
											type="button"
										>
											<span className="block font-mono text-[11px] text-zinc-300">
												{s.symbol}
											</span>
											<span className="block text-[9px] text-zinc-600">
												{s.path}
											</span>
										</button>
									))}
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{insights.deadCode.length > 0 && (
				<div className="card p-6">
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
						<div className="flex items-center gap-2">
							<input
								className="w-40 rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-2.5 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 outline-none transition-colors focus:border-zinc-700"
								onChange={(e) => setDeadFilter(e.target.value)}
								placeholder="Filter symbols..."
								type="text"
								value={deadFilter}
							/>
							{filteredDeadCode.length > 8 && (
								<button
									className="btn-ghost text-xs"
									onClick={() => setDeadExpanded(!deadExpanded)}
									type="button"
								>
									{deadExpanded
										? "Show less"
										: `Show all ${filteredDeadCode.length}`}
								</button>
							)}
						</div>
					</div>
					<div className="space-y-1">
						{deadCodeShown.map((s) => (
							<button
								className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-zinc-800/40"
								key={`${s.symbol}-${s.path}`}
								onClick={() => onSymbolClick(s.symbol)}
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

function DirectoriesTab({
	insights,
	onSymbolClick,
}: {
	insights: CodeInsights;
	onSymbolClick: (name: string) => void;
}) {
	return (
		<div className="space-y-6">
			<div className="card p-6">
				<h2 className="mb-1 font-semibold text-sm text-zinc-200">
					Directory Breakdown
				</h2>
				<p className="mb-4 text-xs text-zinc-600">
					Per-module code quality metrics ({insights.directoryInsights.length}{" "}
					directories)
				</p>
				<DirectoryTable
					data={insights.directoryInsights}
					onSymbolClick={onSymbolClick}
				/>
			</div>
		</div>
	);
}

export default function Insights() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [searchParams, setSearchParams] = useSearchParams();
	const activeTab = (searchParams.get("tab") as TabId) || "overview";

	const {
		data: insights,
		isLoading: loading,
		error: queryError,
	} = useCodeInsights();
	const [indexing, setIndexing] = useState(false);
	const [indexMessage, setIndexMessage] = useState("");
	const [indexError, setIndexError] = useState<string | null>(null);

	const controllerRef = useRef<AbortController | null>(null);

	function setTab(tab: TabId) {
		setSearchParams({ tab });
	}

	const invalidateAll = useCallback(() => {
		queryClient.invalidateQueries({ queryKey: queryKeys.codeInsights });
		queryClient.invalidateQueries({ queryKey: queryKeys.codeRecommendations });
	}, [queryClient]);

	const handleSymbolClick = useCallback(
		(name: string) => {
			navigate(`/code?symbol=${encodeURIComponent(name)}`);
		},
		[navigate]
	);

	const handleIndexCode = useCallback(() => {
		setIndexing(true);
		setIndexMessage("Starting...");
		setIndexError(null);
		const controller = api.code.indexCode((event) => {
			if (event.event === "progress") {
				setIndexMessage(event.data.message);
			} else if (event.event === "done") {
				setIndexing(false);
				invalidateAll();
			} else if (event.event === "error") {
				setIndexing(false);
				setIndexError(event.data.message);
			}
		});
		controllerRef.current = controller;
		return () => controllerRef.current?.abort();
	}, [invalidateAll]);

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

	const error =
		indexError ?? (queryError ? extractErrorMessage(queryError) : null);

	if (error) {
		return (
			<div className="flex h-64 items-center justify-center">
				<div className="card max-w-md p-8 text-center">
					<p className="font-semibold text-zinc-200">Failed to load insights</p>
					<p className="mt-2 text-sm text-zinc-500">{error}</p>
					<button
						className="btn-secondary mt-4"
						onClick={invalidateAll}
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

	return (
		<div className="space-y-6">
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

			<div className="flex gap-1 rounded-xl bg-zinc-900/50 p-1">
				{TABS.map((tab) => (
					<button
						className={`rounded-lg px-4 py-2 font-medium text-xs transition-colors ${
							activeTab === tab.id
								? "bg-zinc-800 text-zinc-100 shadow-sm"
								: "text-zinc-500 hover:text-zinc-300"
						}`}
						key={tab.id}
						onClick={() => setTab(tab.id)}
						type="button"
					>
						{tab.label}
					</button>
				))}
			</div>

			<div className="fade-in-up">
				{activeTab === "overview" && <OverviewTab insights={insights} />}
				{activeTab === "complexity" && (
					<ComplexityTab
						insights={insights}
						onSymbolClick={handleSymbolClick}
					/>
				)}
				{activeTab === "dependencies" && (
					<DependenciesTab
						insights={insights}
						onSymbolClick={handleSymbolClick}
					/>
				)}
				{activeTab === "quality" && (
					<QualityTab insights={insights} onSymbolClick={handleSymbolClick} />
				)}
				{activeTab === "directories" && (
					<DirectoriesTab
						insights={insights}
						onSymbolClick={handleSymbolClick}
					/>
				)}
			</div>
		</div>
	);
}

function extractErrorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}
