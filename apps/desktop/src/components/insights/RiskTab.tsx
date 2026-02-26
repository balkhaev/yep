import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronRight, TrendingUp } from "lucide-react";
import { LoadingMessage } from "../LoadingState";
import { FadeInUp } from "../Motion";

interface RiskScore {
	authorChurnScore: number;
	changeFrequencyScore: number;
	complexityScore: number;
	documentationScore: number;
	lineCountScore: number;
	riskLevel: "low" | "medium" | "high" | "critical";
	score: number;
	testCoverageScore: number;
}

interface HighRiskSymbol {
	path: string;
	riskLevel: RiskScore["riskLevel"];
	score: number;
	symbol: string;
	topFactors: Array<{ factor: string; score: number }>;
}

interface RiskSummary {
	avgRiskScore: number;
	criticalCount: number;
	highCount: number;
	lowCount: number;
	mediumCount: number;
	topRiskFactors: Array<{ factor: string; avgScore: number }>;
	totalSymbols: number;
}

interface RiskAnalysis {
	highRiskSymbols: HighRiskSymbol[];
	summary: RiskSummary;
}

function getRiskColor(level: RiskScore["riskLevel"]) {
	switch (level) {
		case "critical":
			return {
				bg: "bg-red-500/10",
				border: "border-red-500/30",
				text: "text-red-500",
			};
		case "high":
			return {
				bg: "bg-orange-500/10",
				border: "border-orange-500/30",
				text: "text-orange-500",
			};
		case "medium":
			return {
				bg: "bg-amber-500/10",
				border: "border-amber-500/30",
				text: "text-amber-500",
			};
		case "low":
			return {
				bg: "bg-emerald-500/10",
				border: "border-emerald-500/30",
				text: "text-emerald-500",
			};
	}
}

function RiskBadge({
	level,
	score,
}: {
	level: RiskScore["riskLevel"];
	score: number;
}) {
	const colors = getRiskColor(level);
	return (
		<div
			className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${colors.bg} ${colors.border} border`}
		>
			<AlertTriangle className={`h-3 w-3 ${colors.text}`} />
			<span className={`font-semibold text-xs uppercase ${colors.text}`}>
				{level}
			</span>
			<span className="text-xs text-zinc-400">{score.toFixed(0)}</span>
		</div>
	);
}

function SymbolCard({
	symbol,
	index,
}: {
	symbol: HighRiskSymbol;
	index: number;
}) {
	const colors = getRiskColor(symbol.riskLevel);

	return (
		<FadeInUp
			className={`card p-4 ${colors.bg} ${colors.border} group cursor-pointer border transition-all hover:bg-opacity-20`}
			delay={index * 0.05}
		>
			<div className="mb-3 flex items-start justify-between">
				<div className="min-w-0 flex-1">
					<div className="mb-1 flex items-center gap-2">
						<code className="truncate font-mono text-sm text-zinc-100">
							{symbol.symbol}
						</code>
						<ChevronRight className="h-4 w-4 text-zinc-600 transition-colors group-hover:text-zinc-400" />
					</div>
					<p className="truncate text-xs text-zinc-500" title={symbol.path}>
						{symbol.path}
					</p>
				</div>
				<RiskBadge level={symbol.riskLevel} score={symbol.score} />
			</div>

			<div className="space-y-1.5">
				<p className="mb-2 font-medium text-xs text-zinc-400">
					Top Risk Factors:
				</p>
				{symbol.topFactors.map((factor, i) => (
					<div className="flex items-center gap-2" key={i}>
						<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800/50">
							<div
								className={`h-full ${colors.bg} ${colors.border} border-r`}
								style={{ width: `${factor.score * 100}%` }}
							/>
						</div>
						<span className="w-32 text-right text-xs text-zinc-500">
							{factor.factor}
						</span>
						<span
							className={`font-mono text-xs ${colors.text} w-10 text-right`}
						>
							{(factor.score * 100).toFixed(0)}
						</span>
					</div>
				))}
			</div>
		</FadeInUp>
	);
}

export default function RiskTab() {
	const {
		data: analysis,
		isLoading,
		error,
	} = useQuery<RiskAnalysis>({
		queryKey: ["risk-analysis"],
		queryFn: async () => {
			const res = await fetch("/api/risk-analysis?limit=20");
			if (!res.ok) {
				throw new Error("Failed to load risk analysis");
			}
			return res.json();
		},
		refetchInterval: 60_000, // Refresh every 60s
	});

	if (isLoading) {
		return <LoadingMessage message="Analyzing risk..." />;
	}

	if (error || !analysis) {
		return (
			<div className="card p-8 text-center">
				<p className="text-zinc-400">Failed to load risk analysis</p>
				<p className="mt-2 text-sm text-zinc-500">
					Error: {error instanceof Error ? error.message : "Unknown error"}
				</p>
			</div>
		);
	}

	const summary = analysis.summary;

	return (
		<div className="space-y-6">
			{/* Summary Cards */}
			<div className="grid grid-cols-2 gap-4 md:grid-cols-5">
				<FadeInUp className="card border-red-500/20 bg-red-500/5 p-4">
					<p className="mb-1 text-xs text-zinc-500">Critical</p>
					<p className="font-bold text-2xl text-red-500">
						{summary.criticalCount}
					</p>
				</FadeInUp>
				<FadeInUp
					className="card border-orange-500/20 bg-orange-500/5 p-4"
					delay={0.05}
				>
					<p className="mb-1 text-xs text-zinc-500">High</p>
					<p className="font-bold text-2xl text-orange-500">
						{summary.highCount}
					</p>
				</FadeInUp>
				<FadeInUp
					className="card border-amber-500/20 bg-amber-500/5 p-4"
					delay={0.1}
				>
					<p className="mb-1 text-xs text-zinc-500">Medium</p>
					<p className="font-bold text-2xl text-amber-500">
						{summary.mediumCount}
					</p>
				</FadeInUp>
				<FadeInUp
					className="card border-emerald-500/20 bg-emerald-500/5 p-4"
					delay={0.15}
				>
					<p className="mb-1 text-xs text-zinc-500">Low</p>
					<p className="font-bold text-2xl text-emerald-500">
						{summary.lowCount}
					</p>
				</FadeInUp>
				<FadeInUp
					className="card border-indigo-500/20 bg-indigo-500/5 p-4"
					delay={0.2}
				>
					<p className="mb-1 text-xs text-zinc-500">Avg Risk</p>
					<p className="font-bold text-2xl text-indigo-400">
						{summary.avgRiskScore.toFixed(0)}
					</p>
				</FadeInUp>
			</div>

			{/* Top Risk Factors */}
			{summary.topRiskFactors && summary.topRiskFactors.length > 0 && (
				<FadeInUp className="card p-6" delay={0.25}>
					<h3 className="mb-4 flex items-center gap-2 font-semibold text-lg text-zinc-200">
						<TrendingUp className="h-5 w-5 text-amber-500" />
						Top Contributing Factors
					</h3>
					<div className="space-y-3">
						{summary.topRiskFactors.slice(0, 5).map((factor, i) => (
							<div className="flex items-center gap-3" key={i}>
								<span className="w-40 text-sm text-zinc-400">
									{factor.factor}
								</span>
								<div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800/50">
									<div
										className="h-full bg-gradient-to-r from-amber-500 to-red-500"
										style={{ width: `${factor.avgScore * 100}%` }}
									/>
								</div>
								<span className="w-12 text-right font-mono text-amber-500 text-sm">
									{(factor.avgScore * 100).toFixed(0)}
								</span>
							</div>
						))}
					</div>
				</FadeInUp>
			)}

			{/* High Risk Symbols */}
			<div>
				<h3 className="mb-4 font-semibold text-lg text-zinc-200">
					High Risk Symbols
				</h3>
				{analysis.highRiskSymbols.length === 0 ? (
					<div className="card p-8 text-center">
						<p className="font-medium text-emerald-500 text-lg">
							🎉 No high-risk symbols detected!
						</p>
						<p className="mt-2 text-sm text-zinc-500">
							Your codebase is looking healthy
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 gap-3">
						{analysis.highRiskSymbols.map((symbol, i) => (
							<SymbolCard index={i} key={i} symbol={symbol} />
						))}
					</div>
				)}
			</div>

			{/* Info Box */}
			<FadeInUp
				className="card border-blue-500/20 bg-blue-500/5 p-4"
				delay={0.3}
			>
				<h4 className="mb-2 font-semibold text-blue-400 text-sm">
					💡 How Risk is Calculated
				</h4>
				<ul className="space-y-1 text-xs text-zinc-400">
					<li>
						• <strong className="text-zinc-300">Complexity (25%)</strong>: High
						cyclomatic complexity
					</li>
					<li>
						• <strong className="text-zinc-300">Change Frequency (20%)</strong>:
						Frequently modified code
					</li>
					<li>
						• <strong className="text-zinc-300">Author Churn (15%)</strong>:
						Many different contributors
					</li>
					<li>
						• <strong className="text-zinc-300">Line Count (15%)</strong>: Large
						symbols
					</li>
					<li>
						• <strong className="text-zinc-300">Test Coverage (15%)</strong>:
						Low or no test coverage
					</li>
					<li>
						• <strong className="text-zinc-300">Documentation (10%)</strong>:
						Missing documentation
					</li>
				</ul>
			</FadeInUp>
		</div>
	);
}
