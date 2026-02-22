import { useState } from "react";
import type { SearchResult as SearchResultType } from "@/api";
import ScoreRing from "./charts/ScoreRing";
import HighlightText from "./Highlight";

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
	const { chunk, score } = result;

	const time = chunk.timestamp
		? new Date(chunk.timestamp).toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			})
		: null;

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
							{chunk.agent && chunk.agent !== "unknown" && (
								<span className="badge">{chunk.agent}</span>
							)}
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
