import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
	api,
	type CodeResult,
	type CodeStats,
	type FileInfo,
	type SymbolContext,
	type SymbolInfo,
} from "@/api";
import DependencyGraph from "@/components/charts/DependencyGraph";
import FileTreemap from "@/components/charts/FileTreemap";
import { CHART_COLORS, TYPE_CHART_COLORS } from "@/components/charts/theme";

const SYMBOL_TYPES = [
	"all",
	"function",
	"class",
	"interface",
	"type",
	"component",
] as const;

function SymbolTypeBadge({ type }: { type: string }) {
	const colors: Record<string, string> = {
		function: "text-blue-400 bg-blue-500/10",
		class: "text-purple-400 bg-purple-500/10",
		interface: "text-cyan-400 bg-cyan-500/10",
		type: "text-green-400 bg-green-500/10",
		component: "text-orange-400 bg-orange-500/10",
	};
	return (
		<span
			className={`rounded-lg px-2 py-0.5 font-semibold text-[10px] uppercase tracking-wider ${colors[type] ?? "bg-zinc-800 text-zinc-400"}`}
		>
			{type}
		</span>
	);
}

function RelationSection({
	title,
	items,
	onSelect,
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

function CopyButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<button
			className={`rounded-lg px-2 py-1 text-[10px] transition-colors ${
				copied
					? "bg-emerald-500/10 text-emerald-400"
					: "bg-zinc-800 text-zinc-500 hover:text-zinc-300"
			}`}
			onClick={() => {
				navigator.clipboard.writeText(text);
				setCopied(true);
				setTimeout(() => setCopied(false), 2000);
			}}
			type="button"
		>
			{copied ? "Copied!" : "Copy"}
		</button>
	);
}

function SymbolDetailPanel({
	loading,
	context,
	onSelectSymbol,
}: {
	context: SymbolContext | null;
	loading: boolean;
	onSelectSymbol: (name: string) => void;
}) {
	if (loading) {
		return (
			<div className="w-1/2">
				<div className="flex h-32 items-center justify-center">
					<div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-400" />
				</div>
			</div>
		);
	}

	if (!context) {
		return (
			<div className="w-1/2">
				<div className="card p-5">
					<p className="text-sm text-zinc-500">Symbol not found in index</p>
				</div>
			</div>
		);
	}

	const { definition } = context;
	const hasRelations =
		context.callers.length > 0 ||
		context.callees.length > 0 ||
		context.importers.length > 0;

	const commitShort = definition.commit ? definition.commit.slice(0, 7) : null;
	const lastMod = definition.lastModified
		? new Date(definition.lastModified).toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				year: "numeric",
			})
		: null;
	const lineCount = definition.body ? definition.body.split("\n").length : 0;

	return (
		<div className="w-1/2 space-y-4">
			<div className="card fade-in-up space-y-4 p-5">
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

				{definition.summary && (
					<p className="text-[13px] text-zinc-400 leading-relaxed">
						{definition.summary}
					</p>
				)}

				{hasRelations && (
					<DependencyGraph
						callees={context.callees}
						callers={context.callers}
						center={{
							symbol: definition.symbol,
							symbolType: definition.symbolType,
						}}
						importers={context.importers}
						onSelect={onSelectSymbol}
						size={280}
					/>
				)}

				{definition.body && (
					<div>
						<div className="mb-2 flex items-center justify-between">
							<p className="font-semibold text-[11px] text-zinc-600 uppercase tracking-widest">
								Source
							</p>
							<CopyButton text={definition.body} />
						</div>
						<pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-950/80 p-4 font-mono text-xs text-zinc-300 leading-relaxed">
							{definition.body}
						</pre>
					</div>
				)}

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

				{!hasRelations && (
					<p className="text-xs text-zinc-600">No relationships found</p>
				)}
			</div>
		</div>
	);
}

export default function Code() {
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
		return (
			<div className="flex h-64 items-center justify-center">
				<div className="flex items-center gap-3 text-sm text-zinc-500">
					<div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-400" />
					Loading code index...
				</div>
			</div>
		);
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
		<div className="space-y-6">
			<div className="flex items-end justify-between">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">Code Index</h1>
					<p className="mt-1 text-sm text-zinc-500">
						{codeStats.totalSymbols} symbols across{" "}
						{codeStats.languages.join(", ")}
					</p>
				</div>
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
							{v === "treemap" ? "Map" : v.charAt(0).toUpperCase() + v.slice(1)}
						</button>
					))}
				</div>
			</div>

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
								loading={contextLoading}
								onSelectSymbol={selectSymbol}
							/>
						)}
					</div>
				</>
			)}

			{view === "files" && (
				<div className="space-y-2">
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
								<div
									className="flex items-center border-zinc-800/20 border-b px-5 py-3 transition-colors last:border-0 hover:bg-zinc-800/30"
									key={f.path}
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
								</div>
							))}
							{filteredFiles.length === 0 && (
								<p className="py-8 text-center text-sm text-zinc-600">
									No indexed files
								</p>
							)}
						</div>
					</div>
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
