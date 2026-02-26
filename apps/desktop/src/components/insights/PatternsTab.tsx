import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Code2, Lightbulb, XCircle } from "lucide-react";
import { LoadingMessage } from "../LoadingState";
import { FadeInUp } from "../Motion";

interface DetectedPattern {
	category: "architectural" | "react" | "anti-pattern";
	confidence: number;
	description?: string;
	path: string;
	pattern: string;
	symbol: string;
}

interface PatternReport {
	antiPatterns: DetectedPattern[];
	patterns: DetectedPattern[];
	summary: {
		totalPatterns: number;
		totalAntiPatterns: number;
		architecturalCount: number;
		reactCount: number;
	};
}

function getPatternEmoji(pattern: string) {
	const emojiMap: Record<string, string> = {
		Singleton: "🔒",
		Factory: "🏭",
		Observer: "👁️",
		Builder: "🔨",
		Strategy: "🎯",
		Decorator: "🎨",
		"Higher-Order Component": "⚛️",
		"Custom Hook": "🪝",
		"Render Props": "📦",
		"Compound Component": "🧩",
		"Magic Numbers": "🔢",
		"Long Parameter List": "📝",
		"Deep Nesting": "📐",
		"God Object": "👑",
		"Large Class": "📏",
	};
	return emojiMap[pattern] || "🏗️";
}

function getConfidenceColor(confidence: number) {
	if (confidence >= 0.8) {
		return "text-emerald-500";
	}
	if (confidence >= 0.6) {
		return "text-blue-500";
	}
	if (confidence >= 0.4) {
		return "text-amber-500";
	}
	return "text-zinc-500";
}

function getConfidenceBadge(confidence: number) {
	const percent = (confidence * 100).toFixed(0);
	const colorClass = getConfidenceColor(confidence);

	return <span className={`font-mono text-xs ${colorClass}`}>{percent}%</span>;
}

function PatternCard({
	pattern,
	index,
	isAntiPattern = false,
}: {
	pattern: DetectedPattern;
	index: number;
	isAntiPattern?: boolean;
}) {
	const Icon = isAntiPattern ? XCircle : CheckCircle2;
	const iconColor = isAntiPattern ? "text-red-500" : "text-emerald-500";
	const bgColor = isAntiPattern ? "bg-red-500/5" : "bg-emerald-500/5";
	const borderColor = isAntiPattern
		? "border-red-500/20"
		: "border-emerald-500/20";

	return (
		<FadeInUp
			className={`card p-4 ${bgColor} ${borderColor} border transition-all hover:bg-opacity-10`}
			delay={index * 0.05}
		>
			<div className="mb-3 flex items-start justify-between">
				<div className="flex items-center gap-2">
					<Icon className={`h-5 w-5 ${iconColor}`} />
					<div>
						<h4 className="flex items-center gap-2 font-semibold text-sm text-zinc-100">
							{getPatternEmoji(pattern.pattern)} {pattern.pattern}
							{pattern.category === "react" && (
								<span className="rounded bg-blue-500/20 px-2 py-0.5 text-blue-400 text-xs">
									React
								</span>
							)}
						</h4>
						{pattern.description && (
							<p className="mt-1 text-xs text-zinc-500">
								{pattern.description}
							</p>
						)}
					</div>
				</div>
				<div className="flex items-center gap-2">
					<span className="text-xs text-zinc-500">Confidence:</span>
					{getConfidenceBadge(pattern.confidence)}
				</div>
			</div>

			<div className="flex items-center gap-2 text-xs text-zinc-400">
				<Code2 className="h-3 w-3" />
				<code className="font-mono text-zinc-300">{pattern.symbol}</code>
				<span className="text-zinc-600">•</span>
				<span className="truncate" title={pattern.path}>
					{pattern.path}
				</span>
			</div>

			{/* Confidence Bar */}
			<div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800/50">
				<div
					className={`h-full transition-all ${isAntiPattern ? "bg-red-500" : "bg-emerald-500"}`}
					style={{ width: `${pattern.confidence * 100}%` }}
				/>
			</div>
		</FadeInUp>
	);
}

export default function PatternsTab() {
	const {
		data: report,
		isLoading,
		error,
	} = useQuery<PatternReport>({
		queryKey: ["patterns"],
		queryFn: async () => {
			const res = await fetch("/api/patterns");
			if (!res.ok) {
				throw new Error("Failed to load patterns");
			}
			return res.json();
		},
		refetchInterval: 60_000, // Refresh every 60s
	});

	if (isLoading) {
		return <LoadingMessage message="Detecting patterns..." />;
	}

	if (error || !report) {
		return (
			<div className="card p-8 text-center">
				<p className="text-zinc-400">Failed to load patterns</p>
				<p className="mt-2 text-sm text-zinc-500">
					Error: {error instanceof Error ? error.message : "Unknown error"}
				</p>
			</div>
		);
	}

	const { patterns, antiPatterns, summary } = report;

	return (
		<div className="space-y-6">
			{/* Summary Cards */}
			<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
				<FadeInUp className="card border-emerald-500/20 bg-emerald-500/5 p-4">
					<p className="mb-1 text-xs text-zinc-500">Good Patterns</p>
					<p className="font-bold text-2xl text-emerald-500">
						{summary.totalPatterns}
					</p>
				</FadeInUp>
				<FadeInUp
					className="card border-red-500/20 bg-red-500/5 p-4"
					delay={0.05}
				>
					<p className="mb-1 text-xs text-zinc-500">Anti-Patterns</p>
					<p className="font-bold text-2xl text-red-500">
						{summary.totalAntiPatterns}
					</p>
				</FadeInUp>
				<FadeInUp
					className="card border-blue-500/20 bg-blue-500/5 p-4"
					delay={0.1}
				>
					<p className="mb-1 text-xs text-zinc-500">Architectural</p>
					<p className="font-bold text-2xl text-blue-400">
						{summary.architecturalCount}
					</p>
				</FadeInUp>
				<FadeInUp
					className="card border-indigo-500/20 bg-indigo-500/5 p-4"
					delay={0.15}
				>
					<p className="mb-1 text-xs text-zinc-500">React Patterns</p>
					<p className="font-bold text-2xl text-indigo-400">
						{summary.reactCount}
					</p>
				</FadeInUp>
			</div>

			{/* Good Patterns */}
			{patterns.length > 0 && (
				<div>
					<h3 className="mb-4 flex items-center gap-2 font-semibold text-lg text-zinc-200">
						<CheckCircle2 className="h-5 w-5 text-emerald-500" />
						Detected Patterns
					</h3>
					<div className="space-y-3">
						{patterns.map((pattern, i) => (
							<PatternCard index={i} key={i} pattern={pattern} />
						))}
					</div>
				</div>
			)}

			{/* Anti-Patterns */}
			{antiPatterns.length > 0 && (
				<div>
					<h3 className="mb-4 flex items-center gap-2 font-semibold text-lg text-zinc-200">
						<XCircle className="h-5 w-5 text-red-500" />
						Anti-Patterns to Address
					</h3>
					<div className="space-y-3">
						{antiPatterns.map((pattern, i) => (
							<PatternCard index={i} isAntiPattern key={i} pattern={pattern} />
						))}
					</div>
				</div>
			)}

			{/* Empty State */}
			{patterns.length === 0 && antiPatterns.length === 0 && (
				<div className="card p-8 text-center">
					<p className="text-zinc-400">No patterns detected</p>
					<p className="mt-2 text-sm text-zinc-500">
						Index more code to enable pattern detection
					</p>
				</div>
			)}

			{/* Info Box */}
			<FadeInUp
				className="card border-indigo-500/20 bg-indigo-500/5 p-4"
				delay={0.2}
			>
				<h4 className="mb-2 flex items-center gap-2 font-semibold text-indigo-400 text-sm">
					<Lightbulb className="h-4 w-4" />
					About Pattern Detection
				</h4>
				<div className="space-y-2 text-xs text-zinc-400">
					<p>
						Pattern detection uses heuristic analysis to identify common design
						patterns and anti-patterns in your codebase.
					</p>
					<p className="font-medium text-zinc-300">Detected Patterns:</p>
					<ul className="ml-4 space-y-1">
						<li>
							• <strong>Architectural</strong>: Singleton, Factory, Observer,
							Builder, etc.
						</li>
						<li>
							• <strong>React</strong>: Custom Hooks, HOCs, Render Props,
							Compound Components
						</li>
					</ul>
					<p className="mt-2 font-medium text-zinc-300">Anti-Patterns:</p>
					<ul className="ml-4 space-y-1">
						<li>• Magic Numbers (hardcoded values)</li>
						<li>• Long Parameter Lists (&gt;5 params)</li>
						<li>• Deep Nesting (&gt;6 levels)</li>
						<li>• God Objects (excessive connections)</li>
					</ul>
				</div>
			</FadeInUp>
		</div>
	);
}
