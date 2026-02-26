import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type SymbolInfo } from "@/api";
import { Spinner } from "@/components/LoadingState";
import { FadeInUp } from "@/components/Motion";
import SymbolTypeBadge from "./SymbolTypeBadge";

interface FileDetailPanelProps {
	onSelectSymbol: (name: string) => void;
	path: string;
}

export default function FileDetailPanel({
	onSelectSymbol,
	path,
}: FileDetailPanelProps) {
	const [loading, setLoading] = useState(true);
	const [symbols, setSymbols] = useState<SymbolInfo[]>([]);

	useEffect(() => {
		setLoading(true);
		// Получить все символы и отфильтровать по пути
		api.code
			.symbols(undefined, 1000)
			.then((res) => {
				const fileSymbols = res.symbols.filter((s) => s.path === path);
				setSymbols(fileSymbols);
			})
			.catch(() => setSymbols([]))
			.finally(() => setLoading(false));
	}, [path]);

	if (loading) {
		return (
			<div className="w-1/2">
				<div className="flex h-32 items-center justify-center">
					<Spinner />
				</div>
			</div>
		);
	}

	const typeGroups = symbols.reduce(
		(acc, s) => {
			if (!acc[s.symbolType]) {
				acc[s.symbolType] = [];
			}
			acc[s.symbolType].push(s);
			return acc;
		},
		{} as Record<string, SymbolInfo[]>
	);

	return (
		<div className="w-1/2">
			<FadeInUp className="card space-y-4 p-5">
				<div>
					<h3 className="mb-1 font-semibold text-sm text-zinc-200">
						File Details
					</h3>
					<p className="font-mono text-[11px] text-zinc-600">{path}</p>
				</div>

				<div className="grid grid-cols-3 gap-2">
					<div className="rounded-lg border border-zinc-800/40 bg-zinc-900/40 p-2 text-center">
						<div className="font-bold text-lg text-zinc-100">
							{symbols.length}
						</div>
						<div className="text-[10px] text-zinc-600">Total Symbols</div>
					</div>
					<div className="rounded-lg border border-zinc-800/40 bg-zinc-900/40 p-2 text-center">
						<div className="font-bold text-lg text-zinc-100">
							{Object.keys(typeGroups).length}
						</div>
						<div className="text-[10px] text-zinc-600">Symbol Types</div>
					</div>
					<div className="rounded-lg border border-zinc-800/40 bg-zinc-900/40 p-2 text-center">
						<Link
							className="font-bold text-lg text-indigo-400 hover:text-indigo-300"
							to={`/diff?file=${encodeURIComponent(path)}`}
						>
							View
						</Link>
						<div className="text-[10px] text-zinc-600">History</div>
					</div>
				</div>

				<div>
					<p className="mb-2 font-semibold text-[11px] text-zinc-600 uppercase tracking-widest">
						Symbols in this file
					</p>
					{symbols.length === 0 ? (
						<p className="py-4 text-center text-sm text-zinc-600">
							No symbols found
						</p>
					) : (
						<div className="max-h-[50vh] space-y-0.5 overflow-y-auto">
							{symbols.map((s) => (
								<button
									className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-zinc-800/60"
									key={`${s.symbol}-${s.symbolType}`}
									onClick={() => onSelectSymbol(s.symbol)}
									type="button"
								>
									<SymbolTypeBadge type={s.symbolType} />
									<span className="font-mono text-xs text-zinc-300">
										{s.symbol}
									</span>
								</button>
							))}
						</div>
					)}
				</div>
			</FadeInUp>
		</div>
	);
}
