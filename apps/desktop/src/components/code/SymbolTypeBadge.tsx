export default function SymbolTypeBadge({ type }: { type: string }) {
	const colors: Record<string, string> = {
		class: "text-purple-400 bg-purple-500/10",
		component: "text-orange-400 bg-orange-500/10",
		function: "text-blue-400 bg-blue-500/10",
		interface: "text-cyan-400 bg-cyan-500/10",
		type: "text-green-400 bg-green-500/10",
	};
	return (
		<span
			className={`rounded-lg px-2 py-0.5 font-semibold text-[10px] uppercase tracking-wider ${colors[type] ?? "bg-zinc-800 text-zinc-400"}`}
		>
			{type}
		</span>
	);
}
