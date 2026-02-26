import type { SymbolContext } from "@/api";
import DependencyGraph from "@/components/charts/DependencyGraph";
import SymbolTypeBadge from "../SymbolTypeBadge";

interface OverviewTabProps {
	context: SymbolContext;
	onNavigateToHistory: (path: string) => void;
}

export default function OverviewTab({
	context,
	onNavigateToHistory,
}: OverviewTabProps) {
	const { definition } = context;
	const hasRelations =
		context.callers.length > 0 ||
		context.callees.length > 0 ||
		context.importers.length > 0;

	const commitShort = definition.commit ? definition.commit.slice(0, 7) : null;
	const lastMod = definition.lastModified
		? new Date(definition.lastModified).toLocaleDateString("en-US", {
				day: "numeric",
				month: "short",
				year: "numeric",
			})
		: null;
	const lineCount = definition.body ? definition.body.split("\n").length : 0;

	return (
		<div className="space-y-4">
			{/* Header */}
			<div>
				<div className="mb-2 flex items-center gap-2">
					<SymbolTypeBadge type={definition.symbolType} />
					<span className="font-mono font-semibold text-sm text-zinc-200">
						{definition.symbol}
					</span>
					<span className="badge ml-auto">{definition.language}</span>
				</div>
				<p className="font-mono text-[11px] text-zinc-600">
					{definition.path}
				</p>
				<div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-zinc-600">
					{commitShort && (
						<span className="rounded-md bg-zinc-800/60 px-1.5 py-0.5 font-mono">
							{commitShort}
						</span>
					)}
					{lastMod && (
						<span className="rounded-md bg-zinc-800/60 px-1.5 py-0.5">
							{lastMod}
						</span>
					)}
					{lineCount > 0 && (
						<span className="rounded-md bg-zinc-800/60 px-1.5 py-0.5">
							{lineCount} lines
						</span>
					)}
				</div>
			</div>

			{/* View History Button */}
			{definition.path && (
				<button
					className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-3 py-2 font-medium text-xs text-zinc-400 transition-all hover:border-zinc-700 hover:bg-zinc-800/60 hover:text-zinc-200"
					onClick={() => onNavigateToHistory(definition.path)}
					type="button"
				>
					<svg
						className="h-3.5 w-3.5"
						fill="none"
						stroke="currentColor"
						strokeWidth={2}
						viewBox="0 0 24 24"
					>
						<path
							d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
					View History
				</button>
			)}

			{/* Summary */}
			{definition.summary && (
				<p className="text-[13px] text-zinc-400 leading-relaxed">
					{definition.summary}
				</p>
			)}

			{/* Dependency Graph */}
			{hasRelations && (
				<DependencyGraph
					callees={context.callees}
					callers={context.callers}
					center={{
						symbol: definition.symbol,
						symbolType: definition.symbolType,
					}}
					importers={context.importers}
					size={280}
				/>
			)}

			{!hasRelations && (
				<p className="text-xs text-zinc-600">No relationships found</p>
			)}
		</div>
	);
}
