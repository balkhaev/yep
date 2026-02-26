import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
	api,
	type CodeStats,
	type FileInfo,
	type SymbolContext,
	type SymbolInfo,
} from "@/api";

// Утилита для извлечения относительного пути
function getRelativePath(fullPath: string): string {
	// Если путь уже относительный, вернуть как есть
	if (!fullPath.startsWith("/")) {
		return fullPath;
	}

	// Попробовать найти корень проекта (apps/, src/, packages/ и т.д.)
	const projectRoots = ["apps/", "src/", "packages/", "lib/"];
	for (const root of projectRoots) {
		const index = fullPath.indexOf(root);
		if (index !== -1) {
			return fullPath.slice(index);
		}
	}

	// Если не нашли корень, вернуть имя файла и родительские папки
	const parts = fullPath.split("/");
	return parts.slice(-3).join("/");
}

import FileDetailPanel from "@/components/code/FileDetailPanel";
import SymbolDetailPanel from "@/components/code/SymbolDetailPanel";
import SymbolTypeBadge from "@/components/code/SymbolTypeBadge";
import FileTreemap from "@/components/charts/FileTreemap";
import { CHART_COLORS, TYPE_CHART_COLORS } from "@/components/charts/theme";
import { LoadingMessage } from "@/components/LoadingState";
import PageHeader from "@/components/PageHeader";
import { useCodeInsights } from "@/hooks/queries";

const SYMBOL_TYPES = [
	"all",
	"function",
	"class",
	"interface",
	"type",
	"component",
] as const;

export default function Code() {
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const initialFile = searchParams.get("file") ?? "";
	const initialSymbol = searchParams.get("symbol") ?? "";

	const [codeStats, setCodeStats] = useState<CodeStats | null>(null);
	const [symbols, setSymbols] = useState<SymbolInfo[]>([]);
	const [files, setFiles] = useState<FileInfo[]>([]);
	const [loading, setLoading] = useState(true);

	const [typeFilter, setTypeFilter] = useState<string>("all");
	const [nameFilter, setNameFilter] = useState("");
	const [view, setView] = useState<"symbols" | "files" | "treemap">(
		initialFile ? "files" : "symbols"
	);

	const [selectedSymbol, setSelectedSymbol] = useState<string | null>(
		initialSymbol || null
	);
	const [symbolContext, setSymbolContext] = useState<SymbolContext | null>(
		null
	);
	const [contextLoading, setContextLoading] = useState(false);
	const [selectedFile, setSelectedFile] = useState<string | null>(null);

	const { data: insights } = useCodeInsights();

	useEffect(() => {
		Promise.all([
			api.code.stats().catch(() => null),
			api.code.symbols().catch(() => ({ symbols: [] })),
			api.code.files(100).catch(() => ({ files: [] })),
		])
			.then(([stats, syms, f]) => {
				setCodeStats(stats);
				setSymbols(syms.symbols);
				setFiles(f.files);
			})
			.finally(() => setLoading(false));
	}, []);

	const selectSymbol = useCallback(async (name: string) => {
		setSelectedSymbol(name);
		setContextLoading(true);
		try {
			const ctx = await api.code.symbol(name);
			setSymbolContext(ctx);
		} catch {
			setSymbolContext(null);
		} finally {
			setContextLoading(false);
		}
	}, []);

	useEffect(() => {
		if (initialSymbol) {
			selectSymbol(initialSymbol);
		}
	}, [initialSymbol, selectSymbol]);

	useEffect(() => {
		if (initialFile) {
			setView("files");
		}
	}, [initialFile]);

	const filteredSymbols = symbols.filter((s) => {
		if (typeFilter !== "all" && s.symbolType !== typeFilter) {
			return false;
		}
		if (
			nameFilter &&
			!s.symbol.toLowerCase().includes(nameFilter.toLowerCase())
		) {
			return false;
		}
		return true;
	});

	const filteredFiles = initialFile
		? files.filter((f) => f.path.includes(initialFile))
		: files;

	const treemapData = files.map((f) => ({
		name: f.path,
		size: f.symbolCount,
	}));

	if (loading) {
		return <LoadingMessage message="Loading code index..." />;
	}

	if (!codeStats?.hasTable) {
		return (
			<div className="flex h-64 items-center justify-center">
				<div className="card max-w-md p-8 text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800">
						<span className="text-lg text-zinc-500">{"</>"}</span>
					</div>
					<p className="font-semibold text-zinc-200">No code index</p>
					<p className="mt-2 text-sm text-zinc-500">
						Run{" "}
						<code className="rounded-md bg-zinc-800 px-2 py-1 font-mono text-zinc-300">
							yep index-code
						</code>{" "}
						to index your project's functions, classes, and types
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-8">
			<PageHeader
				actions={
					<div className="flex gap-1 rounded-xl bg-zinc-900/60 p-1">
						{(["symbols", "files", "treemap"] as const).map((v) => (
							<button
								className={`rounded-lg px-3 py-1.5 font-medium text-xs transition-all ${
									view === v
										? "bg-zinc-800 text-white shadow-sm"
										: "text-zinc-500 hover:text-zinc-300"
								}`}
								key={v}
								onClick={() => {
									setView(v);
									if (v !== "files") {
										setSearchParams({});
									}
								}}
								type="button"
							>
								{v === "treemap"
									? "Map"
									: v.charAt(0).toUpperCase() + v.slice(1)}
							</button>
						))}
					</div>
				}
				subtitle={`${codeStats.totalSymbols} symbols across ${codeStats.languages.join(", ")}`}
				title="Code Index"
			/>

			{view === "symbols" && (
				<>
					<div className="flex gap-2">
						<input
							className="input flex-1"
							onChange={(e) => setNameFilter(e.target.value)}
							placeholder="Filter by name..."
							type="text"
							value={nameFilter}
						/>
						<div className="flex gap-1 rounded-xl bg-zinc-900/60 p-1">
							{SYMBOL_TYPES.map((t) => (
								<button
									className={`rounded-lg px-2.5 py-1.5 font-medium text-[11px] transition-all ${
										typeFilter === t
											? "bg-zinc-800 text-white shadow-sm"
											: "text-zinc-500 hover:text-zinc-300"
									}`}
									key={t}
									onClick={() => setTypeFilter(t)}
									type="button"
								>
									{t === "all" ? "All" : t}
								</button>
							))}
						</div>
					</div>

					<div className="flex gap-6">
						<div className={`space-y-1 ${selectedSymbol ? "w-1/2" : "w-full"}`}>
							<p className="px-1 text-xs text-zinc-600">
								{filteredSymbols.length} symbol
								{filteredSymbols.length !== 1 && "s"}
							</p>
							<div className="max-h-[60vh] space-y-0.5 overflow-y-auto">
								{filteredSymbols.map((s) => (
									<button
										className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150 ${
											selectedSymbol === s.symbol
												? "bg-zinc-800/80 ring-1 ring-zinc-700"
												: "hover:bg-zinc-800/40"
										}`}
										key={`${s.symbol}-${s.path}`}
										onClick={() => selectSymbol(s.symbol)}
										type="button"
									>
										<SymbolTypeBadge type={s.symbolType} />
										<span className="font-mono text-[13px] text-zinc-300">
											{s.symbol}
										</span>
										<span className="ml-auto flex items-center gap-1.5 truncate text-[11px] text-zinc-600">
											<span
												className="h-1.5 w-1.5 rounded-full"
												style={{
													background:
														TYPE_CHART_COLORS[s.symbolType] ??
														CHART_COLORS.indigo,
												}}
											/>
											{s.path}
										</span>
									</button>
								))}
								{filteredSymbols.length === 0 && (
									<p className="py-8 text-center text-sm text-zinc-600">
										No symbols match the filter
									</p>
								)}
							</div>
						</div>

						{selectedSymbol && (
							<SymbolDetailPanel
								context={symbolContext}
								insights={insights ?? null}
								loading={contextLoading}
								onNavigateToHistory={(path) =>
									navigate(
										`/diff?file=${encodeURIComponent(getRelativePath(path))}`
									)
								}
								onSelectSymbol={selectSymbol}
							/>
						)}
					</div>
				</>
			)}

			{view === "files" && (
				<div className="flex gap-6">
					<div className={`space-y-2 ${selectedFile ? "w-1/2" : "w-full"}`}>
						{initialFile && (
							<div className="flex items-center gap-2">
								<span className="text-xs text-zinc-600">
									Filtered by: {initialFile}
								</span>
								<button
									className="text-xs text-zinc-500 hover:text-zinc-300"
									onClick={() => setSearchParams({})}
									type="button"
								>
									Clear
								</button>
							</div>
						)}
						<div className="card">
							<div className="border-zinc-800/40 border-b px-5 py-3">
								<div className="flex items-center font-semibold text-[11px] text-zinc-600 uppercase tracking-widest">
									<span className="flex-1">Path</span>
									<span className="w-20 text-center">Symbols</span>
									<span className="w-32 text-right">Last Modified</span>
								</div>
							</div>
							<div className="max-h-[65vh] overflow-y-auto">
								{filteredFiles.map((f) => (
									<button
										className={`flex w-full items-center border-zinc-800/20 border-b px-5 py-3 text-left transition-colors last:border-0 ${
											selectedFile === f.path
												? "bg-zinc-800/80 ring-1 ring-zinc-700"
												: "hover:bg-zinc-800/30"
										}`}
										key={f.path}
										onClick={() => setSelectedFile(f.path)}
										type="button"
									>
										<span className="min-w-0 flex-1 truncate font-mono text-[12px] text-zinc-300">
											{f.path}
										</span>
										<span className="w-20 text-center">
											<span className="badge">{f.symbolCount}</span>
										</span>
										<span className="w-32 text-right text-[11px] text-zinc-600">
											{f.lastModified
												? new Date(f.lastModified).toLocaleDateString("en-US", {
														month: "short",
														day: "numeric",
													})
												: "\u2014"}
										</span>
									</button>
								))}
								{filteredFiles.length === 0 && (
									<p className="py-8 text-center text-sm text-zinc-600">
										No indexed files
									</p>
								)}
							</div>
						</div>
					</div>

					{selectedFile && (
						<FileDetailPanel
							onSelectSymbol={(name) => {
								setView("symbols");
								selectSymbol(name);
								setSelectedFile(null);
							}}
							path={selectedFile}
						/>
					)}
				</div>
			)}

			{view === "treemap" && (
				<div className="card fade-in-up p-6">
					<h2 className="mb-1 font-semibold text-sm text-zinc-200">
						File Density Map
					</h2>
					<p className="mb-4 text-xs text-zinc-600">
						Files sized by symbol count
					</p>
					{treemapData.length > 0 ? (
						<FileTreemap
							data={treemapData}
							height={400}
							onClick={(path) => setSearchParams({ file: path })}
						/>
					) : (
						<p className="py-8 text-center text-sm text-zinc-600">
							No indexed files
						</p>
					)}
				</div>
			)}
		</div>
	);
}
