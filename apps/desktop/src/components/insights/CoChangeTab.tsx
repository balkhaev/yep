import { useQuery } from "@tanstack/react-query";
import { GitBranch, Link2, TrendingUp } from "lucide-react";
import { LoadingMessage } from "../LoadingState";
import { FadeInUp } from "../Motion";

interface CoChangePair {
	changeCount: number;
	confidence: number; // 0-1
	file1: string;
	file2: string;
	support: number; // 0-1
}

interface CoChangeData {
	pairs: CoChangePair[];
	totalCommits: number;
}

function getConfidenceColor(confidence: number) {
	if (confidence >= 0.8) {
		return {
			bg: "bg-red-500/10",
			border: "border-red-500/30",
			text: "text-red-500",
		};
	}
	if (confidence >= 0.6) {
		return {
			bg: "bg-orange-500/10",
			border: "border-orange-500/30",
			text: "text-orange-500",
		};
	}
	if (confidence >= 0.4) {
		return {
			bg: "bg-amber-500/10",
			border: "border-amber-500/30",
			text: "text-amber-500",
		};
	}
	return {
		bg: "bg-zinc-800/50",
		border: "border-zinc-700/30",
		text: "text-zinc-400",
	};
}

function getConfidenceLabel(confidence: number) {
	if (confidence >= 0.8) {
		return "Very Strong";
	}
	if (confidence >= 0.6) {
		return "Strong";
	}
	if (confidence >= 0.4) {
		return "Moderate";
	}
	return "Weak";
}

function CoChangePairCard({
	pair,
	index,
}: {
	pair: CoChangePair;
	index: number;
}) {
	const colors = getConfidenceColor(pair.confidence);
	const label = getConfidenceLabel(pair.confidence);

	// Shorten paths for display
	const shortPath1 =
		pair.file1.length > 50 ? "..." + pair.file1.slice(-47) : pair.file1;
	const shortPath2 =
		pair.file2.length > 50 ? "..." + pair.file2.slice(-47) : pair.file2;

	return (
		<FadeInUp
			className={`card p-4 ${colors.bg} ${colors.border} border transition-all hover:bg-opacity-20`}
			delay={index * 0.03}
		>
			<div className="mb-3 flex items-start justify-between">
				<div className="min-w-0 flex-1">
					<div className="mb-2 flex items-center gap-2">
						<Link2 className={`h-4 w-4 ${colors.text}`} />
						<span className={`font-semibold text-xs uppercase ${colors.text}`}>
							{label} Coupling
						</span>
						<span className="text-xs text-zinc-500">•</span>
						<span className={`font-mono text-xs ${colors.text}`}>
							{(pair.confidence * 100).toFixed(0)}% confidence
						</span>
					</div>

					<div className="space-y-1.5">
						<div className="flex items-center gap-2">
							<code
								className="truncate font-mono text-xs text-zinc-300"
								title={pair.file1}
							>
								{shortPath1}
							</code>
						</div>
						<div className="flex items-center gap-2">
							<span className={`text-sm ${colors.text}`}>↔</span>
							<code
								className="truncate font-mono text-xs text-zinc-300"
								title={pair.file2}
							>
								{shortPath2}
							</code>
						</div>
					</div>
				</div>
			</div>

			<div className="flex items-center gap-4 text-xs text-zinc-500">
				<div>
					Changed together:{" "}
					<span className={`font-semibold ${colors.text}`}>
						{pair.changeCount}x
					</span>
				</div>
				<div>
					Support:{" "}
					<span className={`font-mono ${colors.text}`}>
						{(pair.support * 100).toFixed(1)}%
					</span>
				</div>
			</div>

			{/* Confidence Bar */}
			<div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800/50">
				<div
					className={`h-full transition-all ${colors.text.replace("text-", "bg-")}`}
					style={{ width: `${pair.confidence * 100}%` }}
				/>
			</div>
		</FadeInUp>
	);
}

export default function CoChangeTab() {
	const {
		data: coChangeData,
		isLoading,
		error,
	} = useQuery<CoChangeData>({
		queryKey: ["co-change"],
		queryFn: async () => {
			const res = await fetch("/api/co-change?days=90");
			if (!res.ok) {
				throw new Error("Failed to load co-change data");
			}
			return res.json();
		},
		refetchInterval: 120_000, // Refresh every 2 minutes
	});

	if (isLoading) {
		return <LoadingMessage message="Analyzing co-change patterns..." />;
	}

	if (error || !coChangeData) {
		return (
			<div className="card p-8 text-center">
				<p className="text-zinc-400">Failed to load co-change analysis</p>
				<p className="mt-2 text-sm text-zinc-500">
					Error: {error instanceof Error ? error.message : "Unknown error"}
				</p>
			</div>
		);
	}

	if (coChangeData.pairs.length === 0) {
		return (
			<div className="card p-8 text-center">
				<p className="text-zinc-400">No co-change data available</p>
				<p className="mt-2 text-sm text-zinc-500">
					Need at least 30 days of git history with multiple commits
				</p>
			</div>
		);
	}

	// Calculate statistics
	const veryStrongCount = coChangeData.pairs.filter(
		(p) => p.confidence >= 0.8
	).length;
	const strongCount = coChangeData.pairs.filter(
		(p) => p.confidence >= 0.6 && p.confidence < 0.8
	).length;
	const moderateCount = coChangeData.pairs.filter(
		(p) => p.confidence >= 0.4 && p.confidence < 0.6
	).length;

	return (
		<div className="space-y-6">
			{/* Header Info */}
			<FadeInUp className="card border-indigo-500/20 bg-indigo-500/5 p-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<GitBranch className="h-6 w-6 text-indigo-400" />
						<div>
							<h3 className="font-semibold text-indigo-400 text-lg">
								Co-Change Analysis
							</h3>
							<p className="text-xs text-zinc-500">
								Files that frequently change together indicate hidden
								dependencies
							</p>
						</div>
					</div>
					<div className="text-right">
						<p className="text-xs text-zinc-500">Analyzed commits</p>
						<p className="font-bold text-2xl text-indigo-400">
							{coChangeData.totalCommits}
						</p>
					</div>
				</div>
			</FadeInUp>

			{/* Statistics */}
			<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
				<FadeInUp className="card bg-zinc-800/30 p-4" delay={0.05}>
					<p className="mb-1 text-xs text-zinc-500">Total Pairs</p>
					<p className="font-bold text-2xl text-zinc-100">
						{coChangeData.pairs.length}
					</p>
				</FadeInUp>
				<FadeInUp
					className="card border-red-500/20 bg-red-500/10 p-4"
					delay={0.1}
				>
					<p className="mb-1 text-xs text-zinc-500">Very Strong</p>
					<p className="font-bold text-2xl text-red-500">{veryStrongCount}</p>
				</FadeInUp>
				<FadeInUp
					className="card border-orange-500/20 bg-orange-500/10 p-4"
					delay={0.15}
				>
					<p className="mb-1 text-xs text-zinc-500">Strong</p>
					<p className="font-bold text-2xl text-orange-500">{strongCount}</p>
				</FadeInUp>
				<FadeInUp
					className="card border-amber-500/20 bg-amber-500/10 p-4"
					delay={0.2}
				>
					<p className="mb-1 text-xs text-zinc-500">Moderate</p>
					<p className="font-bold text-2xl text-amber-500">{moderateCount}</p>
				</FadeInUp>
			</div>

			{/* Pairs List */}
			<div>
				<h3 className="mb-4 font-semibold text-lg text-zinc-200">
					Coupled Files
				</h3>
				<div className="space-y-3">
					{coChangeData.pairs.slice(0, 20).map((pair, i) => (
						<CoChangePairCard index={i} key={i} pair={pair} />
					))}
				</div>
				{coChangeData.pairs.length > 20 && (
					<p className="mt-4 text-center text-sm text-zinc-500">
						... and {coChangeData.pairs.length - 20} more pairs
					</p>
				)}
			</div>

			{/* Info Box */}
			<FadeInUp
				className="card border-blue-500/20 bg-blue-500/5 p-4"
				delay={0.25}
			>
				<h4 className="mb-2 flex items-center gap-2 font-semibold text-blue-400 text-sm">
					<TrendingUp className="h-4 w-4" />
					What This Means
				</h4>
				<div className="space-y-2 text-xs text-zinc-400">
					<p>
						Co-change analysis identifies files that are frequently modified
						together in the same commits. This reveals hidden dependencies and
						coupling in your codebase.
					</p>
					<div className="mt-3 space-y-1">
						<p className="font-medium text-zinc-300">How to use this data:</p>
						<ul className="ml-4 space-y-1">
							<li>
								•{" "}
								<strong className="text-red-400">Very Strong (&gt;80%)</strong>:
								Consider refactoring to reduce coupling
							</li>
							<li>
								• <strong className="text-orange-400">Strong (&gt;60%)</strong>:
								When changing one file, review the coupled file
							</li>
							<li>
								• Use for test prioritization: if file A changes, test file B
								too
							</li>
							<li>
								• Use for code review: assign reviewers familiar with both files
							</li>
						</ul>
					</div>
					<p className="mt-3 text-xs text-zinc-500">
						<strong>Metrics:</strong> Support = how often files change together
						/ total commits. Confidence = how often file2 changes when file1
						changes.
					</p>
				</div>
			</FadeInUp>
		</div>
	);
}
