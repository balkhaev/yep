import type { TextChunk } from "@opentui/core";
import {
	bold,
	createCliRenderer,
	cyan,
	dim,
	green,
	StyledText,
	t,
	yellow,
} from "@opentui/core";
import { createRoot, useKeyboard, useRenderer } from "@opentui/react";
// @ts-expect-error react types resolved via opentui reconciler
import { useCallback, useEffect, useState } from "react";
import {
	doCodeSearch,
	doDiff,
	doSearch,
	formatTime,
	loadCodeRelations,
	loadCodeStats,
	loadStats,
	SYMBOL_ICONS,
	truncate,
	wrapLines,
} from "./tui/helpers.ts";
import type {
	CodeRelation,
	CodeSearchHit,
	CodeStats,
	DiffEntry,
	MemStats,
	SearchHit,
	View,
} from "./tui/types.ts";

function s(...chunks: TextChunk[]): StyledText {
	return new StyledText(chunks);
}

const LEADING_SLASH_RE = /^\//;

function Section({
	label,
	text,
	maxLines = 6,
}: {
	label: string;
	text: string;
	maxLines?: number;
}) {
	if (!text) {
		return null;
	}
	const lines = wrapLines(text, 68, maxLines);
	return (
		<box flexDirection="column" paddingTop={1}>
			<text content={s(cyan(label))} height={1} />
			<text height={lines.length}>{lines.join("\n")}</text>
		</box>
	);
}

const MENU = [
	{
		name: "Search",
		description: "Find relevant past solutions",
		value: "search",
	},
	{
		name: "Code",
		description: "Browse & search indexed symbols",
		value: "code",
	},
	{
		name: "Sync",
		description: "Index new checkpoints now",
		value: "sync",
	},
	{
		name: "Status",
		description: "Memory health & configuration",
		value: "status",
	},
	{
		name: "Diff",
		description: "File change timeline",
		value: "diff",
	},
	{
		name: "Watch",
		description: "Auto-sync on file changes",
		value: "watch",
	},
	{
		name: "Reset",
		description: "Drop & rebuild vector store",
		value: "reset",
	},
];

let resolveExit: ((action: string | null) => void) | null = null;

function StatusBar({ stats }: { stats: MemStats | null }) {
	if (!stats) {
		return <text content={s(dim("loading…"))} height={1} />;
	}
	if (!stats.initialized) {
		return (
			<text
				content={s(yellow("not initialized — run yep enable"))}
				height={1}
			/>
		);
	}
	const dot = stats.hasTable ? green("●") : yellow("○");
	return (
		<text
			content={t`${dot} ${dim(stats.provider)} ${dim("·")} ${dim(stats.embeddingModel)} ${dim("·")} ${cyan(String(stats.totalChunks))} ${dim("chunks")}`}
			height={1}
		/>
	);
}

function SearchDetail({ entry, index }: { entry: SearchHit; index: number }) {
	const meta = [
		`${entry.score.toFixed(2)}`,
		formatTime(entry.timestamp),
		entry.agent !== "unknown" ? entry.agent : null,
		entry.tokensUsed > 0 ? `${entry.tokensUsed.toLocaleString()} tokens` : null,
	]
		.filter(Boolean)
		.join("  ·  ");

	const fileList = entry.filesChanged
		? entry.filesChanged
				.split(",")
				.map((f: string) => f.trim())
				.filter(Boolean)
		: [];

	return (
		<box flexDirection="column" flexGrow={1} paddingX={2}>
			<text content={s(bold(`Result #${index + 1}`))} height={1} />
			<text content={s(dim(meta))} height={1} />

			<Section label="Summary" maxLines={8} text={entry.summary} />

			{entry.prompt !== entry.summary && (
				<Section label="Prompt" text={entry.prompt} />
			)}

			<Section label="Response" maxLines={8} text={entry.response} />
			<Section label="Diff" text={entry.diffSummary} />

			{fileList.length > 0 && (
				<box flexDirection="column" paddingTop={1}>
					<text content={s(cyan(`Files (${fileList.length})`))} height={1} />
					<text height={Math.min(fileList.length, 5)}>
						{fileList
							.slice(0, 5)
							.map((f: string) => `  › ${f}`)
							.join("\n")}
					</text>
				</box>
			)}

			<box flexGrow={1} />
			<text content={s(dim("esc back to list"))} height={1} />
		</box>
	);
}

function SearchView({
	detail,
	onDetail,
}: {
	detail: number | null;
	onDetail: (idx: number | null) => void;
}) {
	const [results, setResults] = useState<SearchHit[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [searched, setSearched] = useState(false);

	const handleSubmit = useCallback(async (value: string) => {
		const q = value.trim();
		if (!q) {
			return;
		}
		setError("");
		setLoading(true);
		setSearched(true);
		try {
			setResults(await doSearch(q));
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, []);

	const handleResultSelect = useCallback(
		(_index: number, option: { value?: string }) => {
			const idx = Number.parseInt(option?.value ?? "", 10);
			if (!Number.isNaN(idx)) {
				onDetail(idx);
			}
		},
		[onDetail]
	);

	const detailIdx = detail;
	const entry = detailIdx !== null ? results[detailIdx] : null;
	if (entry && detailIdx !== null) {
		return <SearchDetail entry={entry} index={detailIdx} />;
	}

	const options = results.map((r: SearchHit, i: number) => {
		const agent = r.agent !== "unknown" ? `[${r.agent}] ` : "";
		return {
			name: `${r.score.toFixed(2)}  ${agent}${truncate(r.summary, 50)}`,
			description: formatTime(r.timestamp),
			value: String(i),
		};
	});

	return (
		<box flexDirection="column" flexGrow={1} paddingX={2}>
			<text content={s(bold("Search"))} height={1} />

			<box flexDirection="row" gap={1} paddingY={1}>
				<text content={s(dim("query"))} height={1} />
				<input
					focused={results.length === 0}
					onSubmit={handleSubmit}
					placeholder="describe what you need…"
					width={50}
				/>
			</box>

			{loading && <text content={s(dim("searching…"))} height={1} />}
			{error !== "" && (
				<text fg="red" height={1}>
					{error}
				</text>
			)}

			{searched && !loading && error === "" && results.length === 0 && (
				<text content={s(dim("No results found."))} height={1} />
			)}

			{results.length > 0 && (
				<select
					flexGrow={1}
					focused
					itemSpacing={0}
					onSelect={handleResultSelect}
					options={options}
					showDescription
					wrapSelection
				/>
			)}

			{results.length === 0 && <box flexGrow={1} />}
			<text
				content={s(
					dim(
						results.length > 0
							? "enter expand · esc back"
							: "enter search · esc back"
					)
				)}
				height={1}
			/>
		</box>
	);
}

function CodeDetail({ entry }: { entry: CodeSearchHit }) {
	const [relations, setRelations] = useState<{
		callers: CodeRelation[];
		callees: CodeRelation[];
		importers: CodeRelation[];
	} | null>(null);

	useEffect(() => {
		const baseName = entry.symbol.includes(".")
			? (entry.symbol.split(".").pop() ?? entry.symbol)
			: entry.symbol;
		loadCodeRelations(baseName).then(setRelations);
	}, [entry.symbol]);

	const icon = SYMBOL_ICONS[entry.symbolType] ?? "?";
	const shortPath = entry.path
		.replace(process.cwd(), "")
		.replace(LEADING_SLASH_RE, "");

	const bodyLines = entry.body.split("\n").slice(0, 20);
	const bodyPreview = bodyLines.join("\n");
	const bodyHeight = bodyLines.length;

	const renderRelList = (label: string, items: CodeRelation[]) => {
		if (items.length === 0) {
			return null;
		}
		const lines = items.slice(0, 8).map((r) => {
			const ri = SYMBOL_ICONS[r.symbolType] ?? "?";
			const rp = r.path
				.replace(process.cwd(), "")
				.replace(LEADING_SLASH_RE, "");
			return `  ${ri} ${r.symbol}  ${rp}`;
		});
		return (
			<box flexDirection="column" paddingTop={1}>
				<text content={s(cyan(`${label} (${items.length})`))} height={1} />
				<text height={lines.length}>{lines.join("\n")}</text>
			</box>
		);
	};

	return (
		<box flexDirection="column" flexGrow={1} paddingX={2}>
			<text
				content={s(
					bold(`${icon} ${entry.symbol}`),
					dim(` ${entry.symbolType}`)
				)}
				height={1}
			/>
			<text content={s(dim(shortPath))} height={1} />
			<text
				content={s(
					dim(`score ${entry.score.toFixed(3)}  ·  ${entry.language}`)
				)}
				height={1}
			/>

			<box flexDirection="column" paddingTop={1}>
				<text content={s(cyan("Body"))} height={1} />
				<text height={bodyHeight}>{bodyPreview}</text>
			</box>

			{relations && renderRelList("Callers", relations.callers)}
			{relations && renderRelList("Callees", relations.callees)}
			{relations && renderRelList("Importers", relations.importers)}

			<box flexGrow={1} />
			<text content={s(dim("esc back to list"))} height={1} />
		</box>
	);
}

function CodeSearchView({
	detail,
	onDetail,
}: {
	detail: number | null;
	onDetail: (idx: number | null) => void;
}) {
	const [results, setResults] = useState<CodeSearchHit[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [searched, setSearched] = useState(false);

	const handleSubmit = useCallback(async (value: string) => {
		const q = value.trim();
		if (!q) {
			return;
		}
		setError("");
		setLoading(true);
		setSearched(true);
		try {
			setResults(await doCodeSearch(q));
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, []);

	const handleResultSelect = useCallback(
		(_index: number, option: { value?: string }) => {
			const idx = Number.parseInt(option?.value ?? "", 10);
			if (!Number.isNaN(idx)) {
				onDetail(idx);
			}
		},
		[onDetail]
	);

	const detailIdx = detail;
	const entry = detailIdx !== null ? results[detailIdx] : null;
	if (entry && detailIdx !== null) {
		return <CodeDetail entry={entry} />;
	}

	const options = results.map((r: CodeSearchHit, i: number) => {
		const icon = SYMBOL_ICONS[r.symbolType] ?? "?";
		const shortPath = r.path
			.replace(process.cwd(), "")
			.replace(LEADING_SLASH_RE, "");
		return {
			name: `${icon} ${r.symbol}`,
			description: `${r.score.toFixed(3)}  ${truncate(shortPath, 40)}`,
			value: String(i),
		};
	});

	return (
		<box flexDirection="column" flexGrow={1} paddingX={2}>
			<text content={s(bold("Code Search"))} height={1} />

			<box flexDirection="row" gap={1} paddingY={1}>
				<text content={s(dim("symbol"))} height={1} />
				<input
					focused={results.length === 0}
					onSubmit={handleSubmit}
					placeholder="function name or description…"
					width={50}
				/>
			</box>

			{loading && <text content={s(dim("searching…"))} height={1} />}
			{error !== "" && (
				<text fg="red" height={1}>
					{error}
				</text>
			)}

			{searched && !loading && error === "" && results.length === 0 && (
				<text content={s(dim("No symbols found."))} height={1} />
			)}

			{results.length > 0 && (
				<select
					flexGrow={1}
					focused
					itemSpacing={0}
					onSelect={handleResultSelect}
					options={options}
					showDescription
					wrapSelection
				/>
			)}

			{results.length === 0 && <box flexGrow={1} />}
			<text
				content={s(
					dim(
						results.length > 0
							? "enter expand · esc back"
							: "enter search · esc back"
					)
				)}
				height={1}
			/>
		</box>
	);
}

function StatusView({ stats }: { stats: MemStats | null }) {
	const [codeStats, setCodeStats] = useState<CodeStats | null>(null);

	useEffect(() => {
		if (stats?.initialized) {
			loadCodeStats().then(setCodeStats);
		}
	}, [stats?.initialized]);

	if (!stats?.initialized) {
		return (
			<box flexDirection="column" flexGrow={1} paddingX={2}>
				<text content={s(bold("Status"))} height={1} />
				<box paddingY={1}>
					<text
						content={s(dim("Not initialized. Run: yep enable"))}
						height={1}
					/>
				</box>
				<box flexGrow={1} />
				<text content={s(dim("esc back"))} height={1} />
			</box>
		);
	}

	const PAD = 16;
	const table = stats.hasTable ? "exists" : "not created";

	return (
		<box flexDirection="column" flexGrow={1} paddingX={2}>
			<text content={s(bold("Memory Status"))} height={1} />
			<text content=" " height={1} />
			<text height={1}>{`${"Provider".padEnd(PAD)}${stats.provider}`}</text>
			<text
				height={1}
			>{`${"Embedding".padEnd(PAD)}${stats.embeddingModel}`}</text>
			<text height={1}>{`${"Chunks".padEnd(PAD)}${stats.totalChunks}`}</text>
			<text height={1}>{`${"Table".padEnd(PAD)}${table}`}</text>
			{stats.agents.length > 0 && (
				<text
					height={1}
				>{`${"Agents".padEnd(PAD)}${stats.agents.join(", ")}`}</text>
			)}

			{codeStats && (
				<box flexDirection="column" paddingTop={1}>
					<text content={s(cyan("Code Index"))} height={1} />
					<text height={1}>
						{`${"  Symbols".padEnd(PAD)}${codeStats.totalSymbols}`}
					</text>
					<text height={1}>
						{`${"  Languages".padEnd(PAD)}${codeStats.languages.join(", ") || "—"}`}
					</text>
					<text height={1}>
						{`${"  Table".padEnd(PAD)}${codeStats.hasTable ? "exists" : "not created"}`}
					</text>
				</box>
			)}

			{stats.topFiles.length > 0 && (
				<box flexDirection="column" paddingTop={1}>
					<text content={s(cyan("Most touched files"))} height={1} />
					<text height={Math.min(stats.topFiles.length, 5)}>
						{stats.topFiles
							.slice(0, 5)
							.map(({ file, count }) => `  › ${file}  \x1b[2m(${count})\x1b[0m`)
							.join("\n")}
					</text>
				</box>
			)}

			<box flexGrow={1} />
			<text content={s(dim("esc back"))} height={1} />
		</box>
	);
}

function DiffDetail({
	entry,
	index,
	file,
}: {
	entry: DiffEntry;
	index: number;
	file: string;
}) {
	const meta = [
		formatTime(entry.timestamp),
		entry.agent !== "unknown" ? entry.agent : null,
		entry.tokensUsed > 0 ? `${entry.tokensUsed.toLocaleString()} tokens` : null,
	]
		.filter(Boolean)
		.join("  ·  ");

	return (
		<box flexDirection="column" flexGrow={1} paddingX={2}>
			<text content={s(bold(`${file}  #${index + 1}`))} height={1} />
			<text content={s(dim(meta))} height={1} />

			<Section label="Summary" maxLines={8} text={entry.summary} />

			{entry.prompt !== entry.summary && (
				<Section label="Prompt" text={entry.prompt} />
			)}

			<Section label="Response" maxLines={8} text={entry.response} />
			<Section label="Diff" text={entry.diffSummary} />

			<box flexGrow={1} />
			<text content={s(dim("esc back to list"))} height={1} />
		</box>
	);
}

function DiffView({
	files,
	detail,
	onDetail,
}: {
	files: Array<{ file: string; count: number }>;
	detail: number | null;
	onDetail: (idx: number | null) => void;
}) {
	const [results, setResults] = useState<DiffEntry[]>([]);
	const [selectedFile, setSelectedFile] = useState("");
	const [customInput, setCustomInput] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const runDiff = useCallback(async (file: string) => {
		setSelectedFile(file);
		setLoading(true);
		setError("");
		try {
			setResults(await doDiff(file));
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, []);

	const handleFileSelect = useCallback(
		(_index: number, option: { value?: string }) => {
			const val = option?.value ?? "";
			if (val === "__custom__") {
				setCustomInput(true);
			} else if (val) {
				runDiff(val);
			}
		},
		[runDiff]
	);

	const handleResultSelect = useCallback(
		(_index: number, option: { value?: string }) => {
			const idx = Number.parseInt(option?.value ?? "", 10);
			if (!Number.isNaN(idx)) {
				onDetail(idx);
			}
		},
		[onDetail]
	);

	const handleInputSubmit = useCallback(
		(value: string) => {
			const f = value.trim();
			if (f) {
				runDiff(f);
			}
		},
		[runDiff]
	);

	if (!(selectedFile || customInput)) {
		const opts = [
			...files.map(({ file, count }) => ({
				name: file,
				description: `${count} refs`,
				value: file,
			})),
			{ name: "Enter path manually…", description: "", value: "__custom__" },
		];
		return (
			<box flexDirection="column" flexGrow={1} paddingX={2}>
				<text content={s(bold("File Timeline"))} height={1} />
				<text
					content={s(dim("Select a file to view its change history"))}
					height={1}
				/>
				<text content=" " height={1} />
				<select
					flexGrow={1}
					focused
					itemSpacing={0}
					onSelect={handleFileSelect}
					options={opts}
					showDescription
					wrapSelection
				/>
				<text
					content={s(dim("↑↓ navigate · enter select · esc back"))}
					height={1}
				/>
			</box>
		);
	}

	if (!selectedFile && customInput) {
		return (
			<box flexDirection="column" flexGrow={1} paddingX={2}>
				<text content={s(bold("File Timeline"))} height={1} />
				<box flexDirection="row" gap={1} paddingY={1}>
					<text content={s(dim("file"))} height={1} />
					<input
						focused
						onSubmit={handleInputSubmit}
						placeholder="path/to/file.ts"
						width={50}
					/>
				</box>
				<box flexGrow={1} />
				<text content={s(dim("enter search · esc back"))} height={1} />
			</box>
		);
	}

	if (loading) {
		return (
			<box flexDirection="column" flexGrow={1} paddingX={2}>
				<text content={s(bold(selectedFile))} height={1} />
				<text content={s(dim("loading…"))} height={1} />
			</box>
		);
	}

	if (error) {
		return (
			<box flexDirection="column" flexGrow={1} paddingX={2}>
				<text content={s(bold(selectedFile))} height={1} />
				<text fg="red" height={1}>
					{error}
				</text>
				<box flexGrow={1} />
				<text content={s(dim("esc back"))} height={1} />
			</box>
		);
	}

	const sorted = [...results].sort((a, b) =>
		a.timestamp.localeCompare(b.timestamp)
	);

	if (sorted.length === 0) {
		return (
			<box flexDirection="column" flexGrow={1} paddingX={2}>
				<text content={s(bold(selectedFile))} height={1} />
				<text content={s(dim("No entries found for this file."))} height={1} />
				<box flexGrow={1} />
				<text content={s(dim("esc back"))} height={1} />
			</box>
		);
	}

	const detailIdx = detail;
	const entry = detailIdx !== null ? sorted[detailIdx] : null;
	if (entry && detailIdx !== null) {
		return <DiffDetail entry={entry} file={selectedFile} index={detailIdx} />;
	}

	const options = sorted.map((r, i) => ({
		name: `${String(i + 1).padStart(2)}.  ${truncate(r.summary, 55)}`,
		description: `${formatTime(r.timestamp)}${r.agent !== "unknown" ? `  ·  ${r.agent}` : ""}`,
		value: String(i),
	}));

	return (
		<box flexDirection="column" flexGrow={1} paddingX={2}>
			<text content={s(bold(selectedFile))} height={1} />
			<text content={s(dim(`${sorted.length} session(s)`))} height={1} />
			<text content=" " height={1} />
			<select
				flexGrow={1}
				focused
				itemSpacing={0}
				onSelect={handleResultSelect}
				options={options}
				showDescription
				wrapSelection
			/>
			<text
				content={s(dim("↑↓ scroll · enter expand · esc back"))}
				height={1}
			/>
		</box>
	);
}

function App() {
	const [view, setView] = useState<View>("menu");
	const [stats, setStats] = useState<MemStats | null>(null);
	const [detail, setDetail] = useState<number | null>(null);
	const renderer = useRenderer();

	useEffect(() => {
		loadStats().then(setStats);
	}, []);

	useKeyboard((key) => {
		if (key.name === "escape") {
			if (detail !== null) {
				setDetail(null);
			} else if (view === "menu") {
				renderer.destroy();
				resolveExit?.(null);
			} else {
				setView("menu");
			}
		}
	});

	const handleSelect = useCallback(
		(_index: number, option: { value?: string }) => {
			const value = option?.value ?? "";
			switch (value) {
				case "search":
				case "code":
				case "status":
				case "diff":
					setDetail(null);
					setView(value);
					break;
				case "sync":
				case "watch":
				case "reset":
					renderer.destroy();
					resolveExit?.(value);
					break;
				default:
					break;
			}
		},
		[renderer]
	);

	return (
		<box flexDirection="column" flexGrow={1} padding={1}>
			<box flexDirection="column" paddingBottom={1} paddingX={1}>
				<ascii-font font="tiny" text="yep" />
				<StatusBar stats={stats} />
			</box>

			{view === "menu" && (
				<box flexDirection="column" flexGrow={1} paddingX={1}>
					<select
						flexGrow={1}
						focused
						itemSpacing={0}
						onSelect={handleSelect}
						options={MENU}
						showDescription
						wrapSelection
					/>
					<text
						content={s(dim("↑↓ navigate · enter select · esc quit"))}
						height={1}
					/>
				</box>
			)}

			{view === "search" && <SearchView detail={detail} onDetail={setDetail} />}
			{view === "code" && (
				<CodeSearchView detail={detail} onDetail={setDetail} />
			)}
			{view === "status" && <StatusView stats={stats} />}
			{view === "diff" && (
				<DiffView
					detail={detail}
					files={stats?.topFiles ?? []}
					onDetail={setDetail}
				/>
			)}
		</box>
	);
}

function restoreTerminal(): void {
	if (process.stdin.isTTY && process.stdin.setRawMode) {
		process.stdin.setRawMode(false);
	}
	process.stdin.pause();
	process.stdout.write("\x1b[?25h");
	process.stdout.write("\x1b[?1049l");
}

export async function renderTuiApp(): Promise<string | null> {
	const exitPromise = new Promise<string | null>((resolve) => {
		resolveExit = resolve;
	});
	const renderer = await createCliRenderer();
	createRoot(renderer).render(<App />);
	const result = await exitPromise;
	restoreTerminal();
	return result;
}
