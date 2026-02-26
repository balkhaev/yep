import type { CodeResult, SymbolContext } from "@/api";
import SymbolTypeBadge from "../SymbolTypeBadge";

interface RelationsTabProps {
	context: SymbolContext;
	onSelectSymbol: (name: string) => void;
}

function RelationSection({
	items,
	onSelect,
	title,
}: {
	items: CodeResult[];
	onSelect: (name: string) => void;
	title: string;
}) {
	if (items.length === 0) {
		return null;
	}
	return (
		<div>
			<p className="mb-2 font-semibold text-[11px] text-zinc-600 uppercase tracking-widest">
				{title}
			</p>
			<div className="space-y-1">
				{items.map((item) => (
					<button
						className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-zinc-800/60"
						key={item.id}
						onClick={() => onSelect(item.symbol)}
						type="button"
					>
						<SymbolTypeBadge type={item.symbolType} />
						<span className="font-mono text-xs text-zinc-300">
							{item.symbol}
						</span>
						<span className="ml-auto truncate text-[10px] text-zinc-600">
							{item.path}
						</span>
					</button>
				))}
			</div>
		</div>
	);
}

function ImportsList({ imports }: { imports: string }) {
	if (!imports) {
		return null;
	}

	const importList = imports
		.split(",")
		.map((i) => i.trim())
		.filter(Boolean);

	if (importList.length === 0) {
		return null;
	}

	return (
		<div>
			<p className="mb-2 font-semibold text-[11px] text-zinc-600 uppercase tracking-widest">
				Direct Imports
			</p>
			<div className="flex flex-wrap gap-1">
				{importList.map((imp) => (
					<span
						className="rounded-lg bg-cyan-500/10 px-2 py-1 font-mono text-[11px] text-cyan-400"
						key={imp}
					>
						{imp}
					</span>
				))}
			</div>
		</div>
	);
}

function CallsList({ calls }: { calls: string }) {
	if (!calls) {
		return null;
	}

	const callList = calls
		.split(",")
		.map((c) => c.trim())
		.filter(Boolean);

	if (callList.length === 0) {
		return null;
	}

	return (
		<div>
			<p className="mb-2 font-semibold text-[11px] text-zinc-600 uppercase tracking-widest">
				Direct Function Calls
			</p>
			<div className="flex flex-wrap gap-1">
				{callList.map((call) => (
					<span
						className="rounded-lg bg-blue-500/10 px-2 py-1 font-mono text-[11px] text-blue-400"
						key={call}
					>
						{call}
					</span>
				))}
			</div>
		</div>
	);
}

export default function RelationsTab({
	context,
	onSelectSymbol,
}: RelationsTabProps) {
	const { definition } = context;

	return (
		<div className="space-y-4">
			<ImportsList imports={definition.imports} />
			<CallsList calls={definition.calls} />
			<RelationSection
				items={context.callers}
				onSelect={onSelectSymbol}
				title="Called by"
			/>
			<RelationSection
				items={context.callees}
				onSelect={onSelectSymbol}
				title="Calls"
			/>
			<RelationSection
				items={context.importers}
				onSelect={onSelectSymbol}
				title="Imported by"
			/>
		</div>
	);
}
