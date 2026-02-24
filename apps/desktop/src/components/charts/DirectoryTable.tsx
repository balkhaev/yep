import { useState } from "react";
import type { CodeInsights } from "@/api";

type SortKey =
	| "directory"
	| "symbolCount"
	| "avgComplexity"
	| "deadCodeCount"
	| "docCoverage";

interface DirectoryTableProps {
	data: CodeInsights["directoryInsights"];
	onSymbolClick?: (symbol: string) => void;
}

function complexityColor(value: number): string {
	if (value > 15) {
		return "text-red-400";
	}
	if (value > 8) {
		return "text-amber-400";
	}
	return "text-emerald-400";
}

function docBarColor(value: number): string {
	if (value > 60) {
		return "#10b981";
	}
	if (value > 30) {
		return "#f59e0b";
	}
	return "#ef4444";
}

function SortHeader({
	label,
	colKey,
	align = "left",
	active,
	ascending,
	onSort,
}: {
	label: string;
	colKey: SortKey;
	align?: "left" | "right";
	active: boolean;
	ascending: boolean;
	onSort: (key: SortKey) => void;
}) {
	return (
		<th
			className={`cursor-pointer px-3 py-2 font-medium text-[11px] transition-colors hover:text-zinc-300 ${
				active ? "text-zinc-300" : "text-zinc-500"
			} ${align === "right" ? "text-right" : "text-left"}`}
			onClick={() => onSort(colKey)}
		>
			{label}
			{active && (
				<span className="ml-1">{ascending ? "\u2191" : "\u2193"}</span>
			)}
		</th>
	);
}

export default function DirectoryTable({
	data,
	onSymbolClick,
}: DirectoryTableProps) {
	const [sortKey, setSortKey] = useState<SortKey>("symbolCount");
	const [sortAsc, setSortAsc] = useState(false);

	const sorted = [...data].sort((a, b) => {
		const aVal = a[sortKey];
		const bVal = b[sortKey];
		if (typeof aVal === "string" && typeof bVal === "string") {
			return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
		}
		const an = Number(aVal) || 0;
		const bn = Number(bVal) || 0;
		return sortAsc ? an - bn : bn - an;
	});

	function handleSort(key: SortKey) {
		if (sortKey === key) {
			setSortAsc(!sortAsc);
		} else {
			setSortKey(key);
			setSortAsc(false);
		}
	}

	return (
		<div className="overflow-x-auto">
			<table className="w-full">
				<thead>
					<tr className="border-zinc-800/50 border-b">
						<SortHeader
							active={sortKey === "directory"}
							ascending={sortAsc}
							colKey="directory"
							label="Directory"
							onSort={handleSort}
						/>
						<SortHeader
							active={sortKey === "symbolCount"}
							align="right"
							ascending={sortAsc}
							colKey="symbolCount"
							label="Symbols"
							onSort={handleSort}
						/>
						<SortHeader
							active={sortKey === "avgComplexity"}
							align="right"
							ascending={sortAsc}
							colKey="avgComplexity"
							label="Avg Complexity"
							onSort={handleSort}
						/>
						<SortHeader
							active={sortKey === "deadCodeCount"}
							align="right"
							ascending={sortAsc}
							colKey="deadCodeCount"
							label="Dead Code"
							onSort={handleSort}
						/>
						<SortHeader
							active={sortKey === "docCoverage"}
							align="right"
							ascending={sortAsc}
							colKey="docCoverage"
							label="Docs %"
							onSort={handleSort}
						/>
						<th className="px-3 py-2 text-left font-medium text-[11px] text-zinc-500">
							Top Symbol
						</th>
					</tr>
				</thead>
				<tbody>
					{sorted.map((dir) => (
						<tr
							className="border-zinc-800/20 border-b transition-colors hover:bg-zinc-800/20"
							key={dir.directory}
						>
							<td className="px-3 py-2.5 font-mono text-xs text-zinc-300">
								{dir.directory}
							</td>
							<td className="px-3 py-2.5 text-right font-mono text-xs text-zinc-400 tabular-nums">
								{dir.symbolCount}
							</td>
							<td className="px-3 py-2.5 text-right text-xs tabular-nums">
								<span className={complexityColor(dir.avgComplexity)}>
									{dir.avgComplexity}
								</span>
							</td>
							<td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
								<span
									className={
										dir.deadCodeCount > 5 ? "text-amber-400" : "text-zinc-400"
									}
								>
									{dir.deadCodeCount}
								</span>
							</td>
							<td className="px-3 py-2.5 text-right text-xs tabular-nums">
								<div className="flex items-center justify-end gap-2">
									<div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-800">
										<div
											className="h-full rounded-full transition-all duration-500"
											style={{
												width: `${dir.docCoverage}%`,
												backgroundColor: docBarColor(dir.docCoverage),
											}}
										/>
									</div>
									<span className="w-8 text-zinc-400">{dir.docCoverage}%</span>
								</div>
							</td>
							<td className="px-3 py-2.5">
								{dir.topSymbol && (
									<button
										className="font-mono text-[11px] text-indigo-400 transition-colors hover:text-indigo-300"
										onClick={() => onSymbolClick?.(dir.topSymbol)}
										type="button"
									>
										{dir.topSymbol}
									</button>
								)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
