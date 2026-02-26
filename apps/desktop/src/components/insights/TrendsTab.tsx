import { useQuery } from "@tanstack/react-query";
import { TrendingDown, TrendingUp } from "lucide-react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { CHART_COLORS, TOOLTIP_STYLE_GLASS } from "../charts/theme";
import { LoadingMessage } from "../LoadingState";
import { FadeInUp } from "../Motion";

interface TrendAnalysis {
	change: number;
	changeAbsolute: number;
	current: number;
	max: number;
	min: number;
	prediction: number;
	previous: number;
	trend: "improving" | "degrading" | "stable" | "volatile";
	velocity: number;
}

interface MetricsSnapshot {
	avgComplexity: number;
	avgSymbolsPerFile: number;
	deadCodeCount: number;
	documentationCoverage: number;
	duplicateSymbolCount: number;
	healthScore: number;
	timestamp: string;
	totalFiles: number;
	totalSymbols: number;
}

interface TrendsReport {
	anomalies: string[];
	avgComplexity: TrendAnalysis;
	deadCodeCount: TrendAnalysis;
	documentationCoverage: TrendAnalysis;
	duplicateSymbolCount: TrendAnalysis;
	healthScore: TrendAnalysis;
	period: string; // "today" or "30 days"
	recommendations: string[];
	snapshots: MetricsSnapshot[];
	totalSymbols: TrendAnalysis;
}

function TrendIndicator({ trend }: { trend: TrendAnalysis["trend"] }) {
	if (trend === "improving") {
		return (
			<span className="inline-flex items-center gap-1 text-emerald-500">
				<TrendingUp className="h-4 w-4" />
				Improving
			</span>
		);
	}
	if (trend === "degrading") {
		return (
			<span className="inline-flex items-center gap-1 text-red-500">
				<TrendingDown className="h-4 w-4" />
				Degrading
			</span>
		);
	}
	if (trend === "volatile") {
		return <span className="text-amber-500">Volatile</span>;
	}
	return <span className="text-zinc-500">Stable</span>;
}

function MetricCard({
	title,
	data,
	unit = "",
}: {
	title: string;
	data: TrendAnalysis;
	unit?: string;
}) {
	const changeColor =
		data.trend === "improving"
			? "text-emerald-500"
			: data.trend === "degrading"
				? "text-red-500"
				: data.trend === "volatile"
					? "text-amber-500"
					: "text-zinc-500";

	// Вычисляем процентное изменение
	const changePercent =
		data.previous !== 0 ? (data.change / data.previous) * 100 : 0;

	// Создаем простой график из min, previous, current, prediction
	const chartData = [
		{ value: data.min, index: 0 },
		{ value: data.previous, index: 1 },
		{ value: data.current, index: 2 },
		{ value: data.prediction, index: 3 },
	];

	return (
		<FadeInUp className="card p-6" delay={0.1}>
			<div className="mb-4 flex items-start justify-between">
				<div>
					<h3 className="font-medium text-sm text-zinc-400">{title}</h3>
					<div className="mt-1 flex items-baseline gap-2">
						<span className="font-bold text-3xl text-zinc-100">
							{data.current.toFixed(1)}
							{unit}
						</span>
						<span className={`font-medium text-sm ${changeColor}`}>
							{data.change > 0 ? "+" : ""}
							{data.change.toFixed(1)} ({changePercent > 0 ? "+" : ""}
							{changePercent.toFixed(1)}%)
						</span>
					</div>
				</div>
				<TrendIndicator trend={data.trend} />
			</div>

			<div className="h-24">
				<ResponsiveContainer height="100%" width="100%">
					<AreaChart data={chartData}>
						<defs>
							<linearGradient id={`grad-${title}`} x1="0" x2="0" y1="0" y2="1">
								<stop
									offset="0%"
									stopColor={
										data.trend === "improving"
											? CHART_COLORS.emerald
											: data.trend === "degrading"
												? CHART_COLORS.red
												: CHART_COLORS.indigo
									}
									stopOpacity={0.3}
								/>
								<stop
									offset="100%"
									stopColor={
										data.trend === "improving"
											? CHART_COLORS.emerald
											: data.trend === "degrading"
												? CHART_COLORS.red
												: CHART_COLORS.indigo
									}
									stopOpacity={0}
								/>
							</linearGradient>
						</defs>
						<Area
							dataKey="value"
							fill={`url(#grad-${title})`}
							stroke={
								data.trend === "improving"
									? CHART_COLORS.emerald
									: data.trend === "degrading"
										? CHART_COLORS.red
										: CHART_COLORS.indigo
							}
							strokeWidth={2}
							type="monotone"
						/>
					</AreaChart>
				</ResponsiveContainer>
			</div>

			<div className="mt-3 border-zinc-800/50 border-t pt-3">
				<p className="text-xs text-zinc-500">
					Predicted next:{" "}
					<span className="text-zinc-300">
						{data.prediction.toFixed(1)}
						{unit}
					</span>
				</p>
			</div>
		</FadeInUp>
	);
}

export default function TrendsTab() {
	const {
		data: trends,
		isLoading,
		error,
	} = useQuery<TrendsReport>({
		queryKey: ["trends"],
		queryFn: async () => {
			const res = await fetch("/api/trends?days=30");
			if (!res.ok) {
				throw new Error("Failed to load trends");
			}
			return res.json();
		},
		refetchInterval: 30_000, // Refresh every 30s
	});

	if (isLoading) {
		return <LoadingMessage message="Loading trends..." />;
	}

	if (error || !trends) {
		return (
			<div className="card p-8 text-center">
				<p className="text-zinc-400">Failed to load trends</p>
				<p className="mt-2 text-sm text-zinc-500">
					Error: {error instanceof Error ? error.message : "Unknown error"}
				</p>
			</div>
		);
	}

	if (!trends.snapshots || trends.snapshots.length === 0) {
		return (
			<div className="card p-8 text-center">
				<p className="text-zinc-400">No trend data available</p>
				<p className="mt-2 text-sm text-zinc-500">
					Run{" "}
					<code className="rounded bg-zinc-800 px-2 py-1">yep index-code</code>{" "}
					multiple times over several days to collect trend data
				</p>
			</div>
		);
	}

	// Prepare chart data for overall trends
	const chartData = trends.snapshots.map((s, idx) => ({
		index: idx,
		timestamp: new Date(s.timestamp).toLocaleDateString(),
		health: s.healthScore,
		complexity: s.avgComplexity,
		documentation: s.documentationCoverage * 100,
		deadCode: s.deadCodeCount,
	}));

	return (
		<div className="space-y-6">
			{/* Period Info */}
			<FadeInUp className="card border-indigo-500/20 bg-indigo-500/5 p-4">
				<div className="flex items-center justify-between">
					<div>
						<p className="text-sm text-zinc-400">Analyzing trends for</p>
						<p className="font-semibold text-indigo-400 text-lg">
							{trends.period}
						</p>
					</div>
					<div className="text-right">
						<p className="text-xs text-zinc-500">
							{trends.snapshots.length} snapshot
							{trends.snapshots.length !== 1 ? "s" : ""}
						</p>
						{trends.snapshots.length > 0 && (
							<p className="mt-1 text-xs text-zinc-500">
								Latest:{" "}
								{new Date(trends.snapshots[0].timestamp).toLocaleDateString()}
							</p>
						)}
					</div>
				</div>
			</FadeInUp>

			{/* Key Metrics */}
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
				<MetricCard
					data={trends.healthScore}
					title="Health Score"
					unit="/100"
				/>
				<MetricCard data={trends.avgComplexity} title="Avg Complexity" />
				<MetricCard
					data={trends.documentationCoverage}
					title="Documentation"
					unit="%"
				/>
				<MetricCard
					data={trends.deadCodeCount}
					title="Dead Code"
					unit=" symbols"
				/>
			</div>

			{/* Combined Chart */}
			<FadeInUp className="card p-6" delay={0.2}>
				<h3 className="mb-4 font-semibold text-lg text-zinc-200">
					Metrics Over Time
				</h3>
				<div className="h-80">
					<ResponsiveContainer height="100%" width="100%">
						<LineChart data={chartData}>
							<CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
							<XAxis
								dataKey="timestamp"
								stroke="#52525b"
								style={{ fontSize: 11 }}
								tick={{ fill: "#71717a" }}
							/>
							<YAxis
								stroke="#52525b"
								style={{ fontSize: 11 }}
								tick={{ fill: "#71717a" }}
							/>
							<Tooltip {...TOOLTIP_STYLE_GLASS} />
							<Line
								dataKey="health"
								name="Health Score"
								stroke={CHART_COLORS.emerald}
								strokeWidth={2}
								type="monotone"
							/>
							<Line
								dataKey="documentation"
								name="Documentation %"
								stroke={CHART_COLORS.blue}
								strokeWidth={2}
								type="monotone"
							/>
							<Line
								dataKey="complexity"
								name="Avg Complexity"
								stroke={CHART_COLORS.amber}
								strokeWidth={2}
								type="monotone"
							/>
						</LineChart>
					</ResponsiveContainer>
				</div>
			</FadeInUp>
		</div>
	);
}
