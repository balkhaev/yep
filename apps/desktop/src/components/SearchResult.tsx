import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SearchResult as SearchResultType } from "@/api";
import ScoreRing from "./charts/ScoreRing";
import HighlightText from "./Highlight";

function confidenceColor(value: number): string {
	if (value >= 0.8) {
		return "text-emerald-400 bg-emerald-500/10";
	}
	if (value >= 0.5) {
		return "text-amber-400 bg-amber-500/10";
	}
	return "text-red-400 bg-red-500/10";
}

function ConfidenceBadge({ value }: { value: number }) {
	if (value <= 0) {
		return null;
	}
	return (
		<span
			className={`rounded-lg px-1.5 py-0.5 font-mono text-[10px] ${confidenceColor(value)}`}
		>
			{value.toFixed(2)}
		</span>
	);
}

interface SearchResultProps {
	index: number;
	query: string;
	result: SearchResultType;
}

export default function SearchResultCard({
	result,
	index,
	query,
}: SearchResultProps) {
	const [expanded, setExpanded] = useState(false);
	const navigate = useNavigate();
	const { chunk, score } = result;

	const time = chunk.timestamp
		? new Date(chunk.timestamp).toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			})
		: null;

	const symbolList = chunk.symbols
		? chunk.symbols
				.split(",")
				.map((sym: string) => sym.trim())
				.filter(Boolean)
		: [];

	return (
		<div
			className={`card-hover group fade-in-up stagger-${Math.min(index + 1, 8)}`}
		>
			<button
				className="w-full px-5 py-4 text-left"
				onClick={() => setExpanded(!expanded)}
				type="button"
			>
				<div className="flex items-start gap-4">
					<ScoreRing score={score} size={40} strokeWidth={3} />
					<div className="min-w-0 flex-1">
						<div className="mb-1.5 flex flex-wrap items-center gap-2">
							{chunk.source && chunk.source !== "transcript" && (
								<span className="rounded-lg bg-indigo-500/10 px-2 py-0.5 font-medium text-[10px] text-indigo-400">
									{chunk.source}
								</span>
							)}
							{chunk.agent && chunk.agent !== "unknown" && (
								<span className="badge">{chunk.agent}</span>
							)}
							{chunk.language && (
								<span className="rounded-lg bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
									{chunk.language}
								</span>
							)}
							<ConfidenceBadge value={chunk.confidence} />
							{time && <span className="text-xs text-zinc-600">{time}</span>}
						</div>
						<p className="text-[13px] text-zinc-200 leading-relaxed">
							<HighlightText
								query={query}
								text={chunk.summary || chunk.prompt.slice(0, 200)}
							/>
						</p>
						{chunk.filesChanged && (
							<p className="mt-2 truncate font-mono text-[11px] text-zinc-600">
								<HighlightText query={query} text={chunk.filesChanged} />
							</p>
						)}
					</div>
					<svg
						aria-hidden="true"
						className={`mt-1 h-3.5 w-3.5 shrink-0 text-zinc-600 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
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
			</button>

			{expanded && (
				<div className="space-y-4 border-zinc-800/40 border-t px-5 py-5">
					{symbolList.length > 0 && (
						<div>
							<p className="mb-2 font-semibold text-[11px] text-zinc-600 uppercase tracking-widest">
								Related Symbols
							</p>
							<div className="flex flex-wrap gap-1.5">
								{symbolList.map((sym) => (
									<button
										className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-2 py-1 font-mono text-[11px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
										key={sym}
										onClick={(e) => {
											e.stopPropagation();
											navigate(`/code?symbol=${encodeURIComponent(sym)}`);
										}}
										type="button"
									>
										{sym}
									</button>
								))}
							</div>
						</div>
					)}
					{chunk.tokensUsed > 0 && (
						<p className="text-[11px] text-zinc-600">
							{chunk.tokensUsed.toLocaleString()} tokens used
						</p>
					)}
					{chunk.prompt && (
						<div>
							<p className="mb-2 font-semibold text-[11px] text-zinc-600 uppercase tracking-widest">
								Prompt
							</p>
							<pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-950/80 p-4 font-mono text-xs text-zinc-300 leading-relaxed">
								{chunk.prompt}
							</pre>
						</div>
					)}
					{chunk.response && (
						<div>
							<p className="mb-2 font-semibold text-[11px] text-zinc-600 uppercase tracking-widest">
								Response
							</p>
							<pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-950/80 p-4 font-mono text-xs text-zinc-300 leading-relaxed">
								{chunk.response}
							</pre>
						</div>
					)}
					{chunk.diffSummary && (
						<div>
							<p className="mb-2 font-semibold text-[11px] text-zinc-600 uppercase tracking-widest">
								Changes
							</p>
							<pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-950/80 p-4 font-mono text-xs text-zinc-500 leading-relaxed">
								{chunk.diffSummary}
							</pre>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
