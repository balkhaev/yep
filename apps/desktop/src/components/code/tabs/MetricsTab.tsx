import type { CodeInsights, CodeResult } from "@/api";

interface MetricsTabProps {
	complexity?: CodeInsights["topComplexSymbols"][0];
	definition: CodeResult;
	duplication?: CodeInsights["duplicateClusters"][0];
	isDead?: boolean;
}

function MetricCard({
	color,
	description,
	label,
	value,
}: {
	color: "amber" | "emerald" | "red" | "zinc";
	description?: string;
	label: string;
	value: number | string;
}) {
	const colorClasses = {
		amber: "bg-amber-500/10 text-amber-400",
		emerald: "bg-emerald-500/10 text-emerald-400",
		red: "bg-red-500/10 text-red-400",
		zinc: "bg-zinc-800 text-zinc-400",
	};

	return (
		<div className="rounded-lg border border-zinc-800/40 bg-zinc-900/40 p-3">
			<div className="mb-1 text-[10px] text-zinc-600 uppercase tracking-widest">
				{label}
			</div>
			<div
				className={`rounded-lg px-2 py-1 font-mono font-semibold text-lg ${colorClasses[color]}`}
			>
				{value}
			</div>
			{description && (
				<div className="mt-1 text-[11px] text-zinc-500">{description}</div>
			)}
		</div>
	);
}

export default function MetricsTab({
	complexity,
	definition,
	duplication,
	isDead,
}: MetricsTabProps) {
	const lineCount = definition.body ? definition.body.split("\n").length : 0;

	const cyclomaticColor =
		!complexity || complexity.cyclomatic <= 5
			? "emerald"
			: complexity.cyclomatic <= 10
				? "amber"
				: "red";

	const cognitiveColor =
		!complexity || complexity.cognitive <= 7
			? "emerald"
			: complexity.cognitive <= 15
				? "amber"
				: "red";

	return (
		<div className="space-y-4">
			{/* Health Status */}
			{isDead && (
				<div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
					<div className="flex items-center gap-2">
						<svg
							className="h-4 w-4 text-amber-400"
							fill="currentColor"
							viewBox="0 0 16 16"
						>
							<path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566ZM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5Zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
						</svg>
						<span className="font-medium text-sm text-amber-400">
							Dead Code Detected
						</span>
					</div>
					<p className="mt-1 text-[11px] text-amber-300/80">
						This symbol appears to be unused in the codebase
					</p>
				</div>
			)}

			{/* Complexity Metrics */}
			{complexity && (
				<div className="space-y-2">
					<p className="font-semibold text-[11px] text-zinc-600 uppercase tracking-widest">
						Complexity
					</p>
					<div className="grid grid-cols-2 gap-2">
						<MetricCard
							color={cyclomaticColor}
							description="Cyclomatic"
							label="Cyclomatic"
							value={complexity.cyclomatic}
						/>
						<MetricCard
							color={cognitiveColor}
							description="Cognitive"
							label="Cognitive"
							value={complexity.cognitive}
						/>
					</div>
				</div>
			)}

			{/* Size Metrics */}
			<div className="space-y-2">
				<p className="font-semibold text-[11px] text-zinc-600 uppercase tracking-widest">
					Size
				</p>
				<div className="grid grid-cols-2 gap-2">
					<MetricCard
						color={lineCount > 100 ? "amber" : "zinc"}
						label="Lines of Code"
						value={lineCount}
					/>
					{complexity && (
						<MetricCard
							color="zinc"
							label="Line Count"
							value={complexity.lineCount}
						/>
					)}
				</div>
			</div>

			{/* Duplication */}
			{duplication && (
				<div className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-3">
					<div className="mb-2 flex items-center justify-between">
						<span className="font-medium text-sm text-indigo-400">
							Similar Code Detected
						</span>
						<span className="rounded-md bg-indigo-500/20 px-2 py-0.5 font-mono text-[10px] text-indigo-300">
							{Math.round(duplication.similarity * 100)}% similar
						</span>
					</div>
					<p className="mb-2 text-[11px] text-indigo-300/80">
						{duplication.symbols.length} symbols share similar patterns
					</p>
					<div className="space-y-1">
						{duplication.symbols
							.filter(
								(s) =>
									!(
										s.symbol === definition.symbol && s.path === definition.path
									)
							)
							.slice(0, 3)
							.map((s) => (
								<div
									className="rounded-md bg-indigo-950/40 px-2 py-1 font-mono text-[10px] text-indigo-200"
									key={`${s.symbol}-${s.path}`}
								>
									<span className="text-indigo-400">{s.symbol}</span>
									<span className="ml-2 text-indigo-500">{s.path}</span>
								</div>
							))}
					</div>
				</div>
			)}

			{!complexity && !isDead && !duplication && (
				<p className="py-8 text-center text-sm text-zinc-600">
					No metrics available for this symbol
				</p>
			)}
		</div>
	);
}
