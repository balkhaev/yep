import { useState } from "react";
import { Link } from "react-router-dom";
import type { SolutionResult } from "@/api";

interface DiffTimelineProps {
	results: SolutionResult[];
}

const AGENT_COLORS: Record<string, string> = {
	cursor: "#6366f1",
	copilot: "#10b981",
	claude: "#f59e0b",
	windsurf: "#06b6d4",
};

function agentColor(agent: string): string {
	return AGENT_COLORS[agent?.toLowerCase()] ?? "#a855f7";
}

function TimelineEntry({
	result,
	isFirst,
}: {
	isFirst: boolean;
	result: SolutionResult;
}) {
	const [expanded, setExpanded] = useState(false);

	const time = result.timestamp
		? new Date(result.timestamp).toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			})
		: "unknown";

	const summary =
		result.summary ||
		result.prompt
			.replace(/<[^>]+>/g, "")
			.replace(/\s+/g, " ")
			.trim()
			.slice(0, 150);

	const color = agentColor(result.agent);
	const maxTokens = 50_000;
	const tokenBarWidth = Math.min((result.tokensUsed / maxTokens) * 100, 100);

	return (
		<div className="fade-in-up relative pb-6">
			<div
				className="absolute top-1.5 -left-6 h-3.5 w-3.5 rounded-full border-2"
				style={{
					borderColor: isFirst ? color : "rgb(63 63 70)",
					background: isFirst ? `${color}33` : "rgb(24 24 27)",
				}}
			/>
			<button
				className="w-full rounded-xl p-3 text-left transition-colors hover:bg-zinc-800/30"
				onClick={() => setExpanded(!expanded)}
				type="button"
			>
				<div className="mb-1.5 flex items-center gap-2">
					<span className="rounded-md bg-zinc-800/80 px-2 py-0.5 font-medium text-xs text-zinc-400">
						{time}
					</span>
					{result.agent && result.agent !== "unknown" && (
						<span
							className="rounded-md px-1.5 py-0.5 font-medium text-[11px]"
							style={{
								background: `${color}15`,
								color,
							}}
						>
							{result.agent}
						</span>
					)}
					{result.tokensUsed > 0 && (
						<div className="flex items-center gap-1.5">
							<div className="h-1 w-12 overflow-hidden rounded-full bg-zinc-800">
								<div
									className="h-full rounded-full transition-all"
									style={{
										width: `${tokenBarWidth}%`,
										background: color,
										opacity: 0.6,
									}}
								/>
							</div>
							<span className="text-[10px] text-zinc-600 tabular-nums">
								{result.tokensUsed.toLocaleString()} tok
							</span>
						</div>
					)}
					<span className="ml-auto font-mono text-[10px] text-zinc-700">
						{result.checkpointId.slice(0, 8)}
					</span>
					<svg
						aria-hidden="true"
						className={`h-3 w-3 shrink-0 text-zinc-600 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
						fill="currentColor"
						viewBox="0 0 16 16"
					>
						<path
							clipRule="evenodd"
							d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"
							fillRule="evenodd"
						/>
					</svg>
				</div>
				<p className="text-[13px] text-zinc-300 leading-relaxed">{summary}</p>
				{!expanded && result.diffSummary && (
					<p className="mt-1.5 font-mono text-[11px] text-zinc-600">
						{result.diffSummary
							.replace(/<[^>]+>/g, "")
							.replace(/\s+/g, " ")
							.trim()
							.slice(0, 120)}
					</p>
				)}
			</button>

			{expanded && (
				<div className="fade-in-up mt-1 space-y-3 rounded-xl border border-zinc-800/40 bg-zinc-900/30 p-4">
					{result.filesChanged && (
						<div>
							<p className="mb-1.5 font-semibold text-[11px] text-zinc-600 uppercase tracking-widest">
								Files Changed
							</p>
							<div className="flex flex-wrap gap-1">
								{result.filesChanged.split(",").map((f) => {
									const trimmed = f.trim();
									return trimmed ? (
										<Link
											className="badge cursor-pointer font-mono transition-all hover:bg-zinc-700/80 hover:text-zinc-200"
											key={trimmed}
											onClick={(e) => e.stopPropagation()}
											to={`/code?file=${encodeURIComponent(trimmed)}`}
										>
											{trimmed}
										</Link>
									) : null;
								})}
							</div>
						</div>
					)}
					{result.symbols && (
						<div>
							<p className="mb-1.5 font-semibold text-[11px] text-zinc-600 uppercase tracking-widest">
								Symbols
							</p>
							<div className="flex flex-wrap gap-1">
								{result.symbols.split(",").map((s) => {
									const trimmed = s.trim();
									return trimmed ? (
										<Link
											className="badge-accent cursor-pointer font-mono transition-all hover:bg-indigo-500/20 hover:text-indigo-300"
											key={trimmed}
											onClick={(e) => e.stopPropagation()}
											to={`/code?symbol=${encodeURIComponent(trimmed)}`}
										>
											{trimmed}
										</Link>
									) : null;
								})}
							</div>
						</div>
					)}
					{result.prompt && (
						<div>
							<p className="mb-1.5 font-semibold text-[11px] text-zinc-600 uppercase tracking-widest">
								Prompt
							</p>
							<pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-950/80 p-4 font-mono text-xs text-zinc-300 leading-relaxed">
								{result.prompt}
							</pre>
						</div>
					)}
					{result.response && (
						<div>
							<p className="mb-1.5 font-semibold text-[11px] text-zinc-600 uppercase tracking-widest">
								Response
							</p>
							<pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-950/80 p-4 font-mono text-xs text-zinc-300 leading-relaxed">
								{result.response}
							</pre>
						</div>
					)}
					{result.diffSummary && (
						<div>
							<p className="mb-1.5 font-semibold text-[11px] text-zinc-600 uppercase tracking-widest">
								Changes
							</p>
							<pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-950/80 p-4 font-mono text-xs text-zinc-500 leading-relaxed">
								{result.diffSummary}
							</pre>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

export default function DiffTimeline({ results }: DiffTimelineProps) {
	if (results.length === 0) {
		return (
			<div className="flex h-32 items-center justify-center">
				<p className="text-sm text-zinc-600">
					No memory entries found for this file
				</p>
			</div>
		);
	}

	return (
		<div className="relative space-y-0 pl-6">
			<div className="absolute top-2 bottom-2 left-[7px] w-px bg-gradient-to-b from-indigo-500/30 via-zinc-800 to-zinc-800/0" />
			{results.map((result, i) => (
				<TimelineEntry isFirst={i === 0} key={result.id} result={result} />
			))}
		</div>
	);
}
