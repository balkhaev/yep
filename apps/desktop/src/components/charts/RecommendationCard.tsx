import type { CodeRecommendation } from "@/api";

interface RecommendationCardProps {
	onSymbolClick?: (symbol: string) => void;
	recommendation: CodeRecommendation;
}

const SEVERITY_STYLES: Record<
	string,
	{ badge: string; border: string; icon: string }
> = {
	critical: {
		border: "border-red-500/30",
		badge: "bg-red-500/15 text-red-400",
		icon: "text-red-400",
	},
	warning: {
		border: "border-amber-500/30",
		badge: "bg-amber-500/15 text-amber-400",
		icon: "text-amber-400",
	},
	info: {
		border: "border-blue-500/30",
		badge: "bg-blue-500/15 text-blue-400",
		icon: "text-blue-400",
	},
};

const CATEGORY_LABELS: Record<string, string> = {
	complexity: "Complexity",
	duplication: "Duplication",
	"dead-code": "Dead Code",
	health: "Health",
	structure: "Structure",
	architecture: "Architecture",
	modularization: "Modularization",
};

export default function RecommendationCard({
	recommendation,
	onSymbolClick,
}: RecommendationCardProps) {
	const style =
		SEVERITY_STYLES[recommendation.severity] ?? SEVERITY_STYLES.info;

	return (
		<div className={`rounded-xl border ${style.border} bg-zinc-900/40 p-4`}>
			<div className="flex items-start gap-3">
				<div className={`mt-0.5 shrink-0 ${style.icon}`}>
					{recommendation.severity === "critical" ? (
						<svg
							aria-hidden="true"
							className="h-4 w-4"
							fill="currentColor"
							viewBox="0 0 16 16"
						>
							<path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575ZM8 5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8 5Zm1 6a1 1 0 1 0-2 0 1 1 0 0 0 2 0Z" />
						</svg>
					) : (
						<svg
							aria-hidden="true"
							className="h-4 w-4"
							fill="currentColor"
							viewBox="0 0 16 16"
						>
							<path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
						</svg>
					)}
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<span className="font-medium text-sm text-zinc-200">
							{recommendation.title}
						</span>
						<span
							className={`rounded-full px-2 py-0.5 font-medium text-[10px] ${style.badge}`}
						>
							{recommendation.severity}
						</span>
						<span className="rounded-full bg-zinc-800/60 px-2 py-0.5 text-[10px] text-zinc-500">
							{CATEGORY_LABELS[recommendation.category] ??
								recommendation.category}
						</span>
					</div>
					<p className="mt-1 text-xs text-zinc-400 leading-relaxed">
						{recommendation.description}
					</p>
					{recommendation.affectedSymbols.length > 0 && (
						<div className="mt-2 flex flex-wrap gap-1.5">
							{recommendation.affectedSymbols.map((s) => (
								<button
									className="rounded-md bg-zinc-800/50 px-2 py-0.5 font-mono text-[11px] text-zinc-400 transition-colors hover:bg-zinc-700/50 hover:text-zinc-300"
									key={`${s.symbol}-${s.path}`}
									onClick={() => onSymbolClick?.(s.symbol)}
									type="button"
								>
									{s.symbol}
								</button>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
