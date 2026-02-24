import type { TextChunk } from "@opentui/core";
import {
	bold,
	createCliRenderer,
	cyan,
	dim,
	green,
	StyledText,
	SyntaxStyle,
	t,
	yellow,
} from "@opentui/core";
import { createRoot, useKeyboard, useRenderer } from "@opentui/react";
// @ts-expect-error react types resolved via opentui reconciler
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	doCodeSearch,
	doDiff,
	doSearch,
	formatTime,
	loadCodeInsights,
	loadCodeRelations,
	loadCodeStats,
	loadRecentSessions,
	loadStats,
	shortenPath,
	SYMBOL_ICONS,
	truncate,
	wrapLines,
} from "./tui/helpers.ts";
import type {
	CodeInsights,
	CodeRelation,
	CodeSearchHit,
	CodeStats,
	DiffEntry,
	MemStats,
	RecentSession,
	SearchHit,
	View,
} from "./tui/types.ts";

function s(...chunks: TextChunk[]): StyledText {
	return new StyledText(chunks);
}

const syntaxStyleInstance = SyntaxStyle.create();

const TAB_VIEWS: View[] = ["search", "code", "status", "diff"];
const TAB_LABELS: Record<View, string> = {
	search: "Search",
	code: "Code",
	status: "Status",
	diff: "Diff",
};

let resolveExit: ((action: string | null) => void) | null = null;

function Section({ label, text }: { label: string; text: string }) {
	if (!text) {
		return null;
	}
	const lines = wrapLines(text, 72, 50);
	return (
		<box flexDirection="column" paddingTop={1}>
			<text content={s(cyan(label))} height={1} />
			<text height={lines.length}>{lines.join("\n")}</text>
		</box>
	);
}

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

function TabBar({ active }: { active: View }) {
	const parts: TextChunk[] = [];
	for (const view of TAB_VIEWS) {
		if (parts.length > 0) {
			parts.push(dim("  "));
		}
		if (view === active) {
			parts.push(bold(cyan(` ${TAB_LABELS[view]} `)));
		} else {
			parts.push(dim(` ${TAB_LABELS[view]} `));
		}
	}
	return (
		<box paddingX={1} paddingY={0}>
			<text content={s(...parts)} height={1} />
		</box>
	);
}

function HelpBar({ hints }: { hints: string }) {
	return (
		<box paddingTop={0} paddingX={1}>
			<text content={s(dim(hints))} height={1} />
		</box>
	);
}

function SearchDetail({ entry, index }: { entry: SearchHit; index: number }) {
	const meta = [
		`score ${entry.score.toFixed(2)}`,
		entry.confidence > 0 ? `conf ${entry.confidence.toFixed(2)}` : null,
		formatTime(entry.timestamp),
		entry.agent !== "unknown" ? entry.agent : null,
		entry.tokensUsed > 0 ? `${entry.tokensUsed.toLocaleString()} tok` : null,
	]
		.filter(Boolean)
		.join("  ·  ");

	const tags = [
		entry.source && entry.source !== "transcript" ? entry.source : null,
		entry.language || null,
	].filter(Boolean);

	const symbolList = entry.symbols
		? entry.symbols
				.split(",")
				.map((sym: string) => sym.trim())
				.filter(Boolean)
		: [];

	const fileList = entry.filesChanged
		? entry.filesChanged
				.split(",")
				.map((f: string) => f.trim())
				.filter(Boolean)
		: [];

	return (
		<scrollbox flexGrow={1} focused scrollY>
			<box flexDirection="column" paddingX={1}>
				<text
					content={s(dim("Search › "), bold(`Result #${index + 1}`))}
					height={1}
				/>
				<text content={s(dim(meta))} height={1} />
				{tags.length > 0 && (
					<text
						content={s(...tags.map((tag) => yellow(` ${tag} `)))}
						height={1}
					/>
				)}

				<Section label="Summary" text={entry.summary} />

				{symbolList.length > 0 && (
					<box flexDirection="column" paddingTop={1}>
						<text
							content={s(cyan(`Symbols (${symbolList.length})`))}
							height={1}
						/>
						<text height={1}>{`  ${symbolList.join(", ")}`}</text>
					</box>
				)}

				{entry.prompt !== entry.summary && (
					<Section label="Prompt" text={entry.prompt} />
				)}

				<Section label="Response" text={entry.response} />
				<Section label="Diff" text={entry.diffSummary} />

				{fileList.length > 0 && (
					<box flexDirection="column" paddingTop={1}>
						<text content={s(cyan(`Files (${fileList.length})`))} height={1} />
						<text height={fileList.length}>
							{fileList.map((f: string) => `  › ${f}`).join("\n")}
						</text>
					</box>
				)}
			</box>
		</scrollbox>
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
		const fileCount = r.filesChanged
			? r.filesChanged.split(",").filter(Boolean).length
			: 0;
		const fileSuffix = fileCount > 0 ? `  ${fileCount}f` : "";
		const langTag = r.language ? ` ${r.language}` : "";
		return {
			name: `${r.score.toFixed(2)}  ${agent}${truncate(r.summary, 46)}`,
			description: `${formatTime(r.timestamp)}${fileSuffix}${langTag}`,
			value: String(i),
		};
	});

	let statusLine = "";
	if (loading) {
		statusLine = "searching…";
	} else if (results.length > 0) {
		statusLine = `${results.length} result(s)`;
	}

	return (
		<box flexDirection="column" flexGrow={1}>
			<box flexDirection="row" gap={1} paddingX={1} paddingY={1}>
				<text content={s(cyan("›"))} height={1} />
				<input
					focused={results.length === 0}
					onSubmit={handleSubmit}
					placeholder="describe what you need…"
					width={50}
				/>
				{statusLine !== "" && <text content={s(dim(statusLine))} height={1} />}
			</box>

			{error !== "" && (
				<text fg="red" height={1} paddingX={1}>
					{error}
				</text>
			)}

			{searched && !loading && error === "" && results.length === 0 && (
				<text content={s(dim("  No results found."))} height={1} />
			)}

			{results.length > 0 && (
				<box border borderStyle="round" flexGrow={1} title=" Results ">
					<select
						flexGrow={1}
						focused={results.length > 0}
						itemSpacing={0}
						onSelect={handleResultSelect}
						options={options}
						showDescription
						wrapSelection
					/>
				</box>
			)}

			{results.length === 0 && <box flexGrow={1} />}
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
	const shortPath = shortenPath(entry.path);

	const filetypeMap: Record<string, string> = {
		typescript: "typescript",
		javascript: "javascript",
		python: "python",
		go: "go",
		rust: "rust",
	};
	const filetype = filetypeMap[entry.language] ?? "typescript";

	const renderRelList = (label: string, items: CodeRelation[]) => {
		if (items.length === 0) {
			return null;
		}
		const lines = items.slice(0, 12).map((r) => {
			const ri = SYMBOL_ICONS[r.symbolType] ?? "?";
			const rp = shortenPath(r.path);
			return `  ${ri} ${r.symbol}  ${dim(rp).text}`;
		});
		return (
			<box flexDirection="column" paddingTop={1}>
				<text content={s(cyan(`${label} (${items.length})`))} height={1} />
				<text height={lines.length}>{lines.join("\n")}</text>
			</box>
		);
	};

	const commitInfo = [
		entry.commit ? `commit ${entry.commit.slice(0, 7)}` : null,
		entry.lastModified ? formatTime(entry.lastModified) : null,
	]
		.filter(Boolean)
		.join("  ·  ");

	return (
		<scrollbox flexGrow={1} focused scrollY>
			<box flexDirection="column" paddingX={1}>
				<text
					content={s(
						dim("Code › "),
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
				{commitInfo && <text content={s(dim(commitInfo))} height={1} />}
				{entry.summary ? (
					<box flexDirection="column" paddingTop={1}>
						<text content={s(cyan("Summary"))} height={1} />
						<text height={1}>{entry.summary}</text>
					</box>
				) : null}

				<box
					border
					borderStyle="round"
					flexDirection="column"
					marginTop={1}
					title=" Source "
				>
					<code
						content={entry.body}
						filetype={filetype}
						syntaxStyle={syntaxStyleInstance}
					/>
				</box>

				{relations && renderRelList("Callers", relations.callers)}
				{relations && renderRelList("Callees", relations.callees)}
				{relations && renderRelList("Importers", relations.importers)}
			</box>
		</scrollbox>
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
		const shortPath = shortenPath(r.path);
		return {
			name: `${icon} ${r.symbol}`,
			description: `${r.score.toFixed(3)}  ${truncate(shortPath, 40)}`,
			value: String(i),
		};
	});

	let statusLine = "";
	if (loading) {
		statusLine = "searching…";
	} else if (results.length > 0) {
		statusLine = `${results.length} symbol(s)`;
	}

	return (
		<box flexDirection="column" flexGrow={1}>
			<box flexDirection="row" gap={1} paddingX={1} paddingY={1}>
				<text content={s(cyan("›"))} height={1} />
				<input
					focused={results.length === 0}
					onSubmit={handleSubmit}
					placeholder="function name or description…"
					width={50}
				/>
				{statusLine !== "" && <text content={s(dim(statusLine))} height={1} />}
			</box>

			{error !== "" && (
				<text fg="red" height={1} paddingX={1}>
					{error}
				</text>
			)}

			{searched && !loading && error === "" && results.length === 0 && (
				<text content={s(dim("  No symbols found."))} height={1} />
			)}

			{results.length > 0 && (
				<box border borderStyle="round" flexGrow={1} title=" Symbols ">
					<select
						flexGrow={1}
						focused={results.length > 0}
						itemSpacing={0}
						onSelect={handleResultSelect}
						options={options}
						showDescription
						wrapSelection
					/>
				</box>
			)}

			{results.length === 0 && <box flexGrow={1} />}
		</box>
	);
}

function StatusView({ stats }: { stats: MemStats | null }) {
	const [codeStats, setCodeStats] = useState<CodeStats | null>(null);
	const [insights, setInsights] = useState<CodeInsights | null>(null);
	const [recent, setRecent] = useState<RecentSession[]>([]);

	useEffect(() => {
		if (stats?.initialized) {
			loadCodeStats().then(setCodeStats);
			loadCodeInsights().then(setInsights);
			loadRecentSessions(5).then(setRecent);
		}
	}, [stats?.initialized]);

	if (!stats?.initialized) {
		return (
			<box flexDirection="column" flexGrow={1} paddingX={1}>
				<box paddingY={1}>
					<text
						content={s(yellow("Not initialized. Run: yep enable"))}
						height={1}
					/>
				</box>
			</box>
		);
	}

	const PAD = 18;
	const table = stats.hasTable ? green("exists").text : "not created";

	return (
		<scrollbox flexGrow={1} focused scrollY>
			<box flexDirection="column" paddingX={1}>
				<box
					border
					borderStyle="round"
					flexDirection="column"
					paddingX={1}
					title=" Memory "
				>
					<text height={1}>{`${"Provider".padEnd(PAD)}${stats.provider}`}</text>
					<text height={1}>
						{`${"Embedding".padEnd(PAD)}${stats.embeddingModel}`}
					</text>
					<text height={1}>
						{`${"Chunks".padEnd(PAD)}${stats.totalChunks}`}
					</text>
					<text height={1}>{`${"Table".padEnd(PAD)}${table}`}</text>
					{stats.agents.length > 0 && (
						<text height={1}>
							{`${"Agents".padEnd(PAD)}${stats.agents.join(", ")}`}
						</text>
					)}
				</box>

				{codeStats && (
					<box
						border
						borderStyle="round"
						flexDirection="column"
						marginTop={1}
						paddingX={1}
						title=" Code Index "
					>
						<text height={1}>
							{`${"Symbols".padEnd(PAD)}${codeStats.totalSymbols}`}
						</text>
						<text height={1}>
							{`${"Languages".padEnd(PAD)}${codeStats.languages.join(", ") || "—"}`}
						</text>
						<text height={1}>
							{`${"Table".padEnd(PAD)}${codeStats.hasTable ? green("exists").text : "not created"}`}
						</text>
						{insights && (
							<>
								<text height={1}>
									{`${"Files".padEnd(PAD)}${insights.totalFiles}`}
								</text>
								<text height={1}>
									{`${"Avg sym/file".padEnd(PAD)}${insights.avgSymbolsPerFile.toFixed(1)}`}
								</text>
								<text height={1}>
									{`${"Dead code".padEnd(PAD)}${insights.deadCode.length} potential`}
								</text>
							</>
						)}
					</box>
				)}

				{insights && insights.mostConnected.length > 0 && (
					<box
						border
						borderStyle="round"
						flexDirection="column"
						marginTop={1}
						paddingX={1}
						title=" Top Connected Symbols "
					>
						{insights.mostConnected
							.slice(0, 5)
							.map((sym: CodeInsights["mostConnected"][number]) => {
								const icon = SYMBOL_ICONS[sym.symbolType] ?? "?";
								return (
									<text height={1} key={`${sym.symbol}-${sym.path}`}>
										{`  ${icon} ${sym.symbol.padEnd(24)} `}
										<span fg="gray">{`${sym.totalConnections} connections`}</span>
									</text>
								);
							})}
					</box>
				)}

				{insights && insights.largestSymbols.length > 0 && (
					<box
						border
						borderStyle="round"
						flexDirection="column"
						marginTop={1}
						paddingX={1}
						title=" Largest Symbols "
					>
						{insights.largestSymbols
							.slice(0, 5)
							.map((sym: CodeInsights["largestSymbols"][number]) => {
								const icon = SYMBOL_ICONS[sym.symbolType] ?? "?";
								return (
									<text height={1} key={`${sym.symbol}-${sym.path}`}>
										{`  ${icon} ${sym.symbol.padEnd(24)} `}
										<span fg="gray">{`${sym.lineCount} lines`}</span>
									</text>
								);
							})}
					</box>
				)}

				{insights && insights.languageDistribution.length > 0 && (
					<box
						border
						borderStyle="round"
						flexDirection="column"
						marginTop={1}
						paddingX={1}
						title=" Language Distribution "
					>
						{insights.languageDistribution.map(
							(lang: CodeInsights["languageDistribution"][number]) => (
								<text height={1} key={lang.language}>
									{`  ${lang.language.padEnd(16)} ${String(lang.count).padStart(5)}  `}
									<span fg="gray">{`(${lang.percentage.toFixed(1)}%)`}</span>
								</text>
							)
						)}
					</box>
				)}

				{recent.length > 0 && (
					<box
						border
						borderStyle="round"
						flexDirection="column"
						marginTop={1}
						paddingX={1}
						title=" Recent Activity "
					>
						{recent.map((sess: RecentSession, i: number) => {
							const fileCount = sess.filesChanged
								? sess.filesChanged.split(",").filter(Boolean).length
								: 0;
							const agent =
								sess.agent && sess.agent !== "unknown"
									? `[${sess.agent}] `
									: "";
							return (
								<text height={1} key={`${sess.timestamp}-${i}`}>
									{`  ${agent}${truncate(sess.summary || "no summary", 42)}  `}
									<span fg="gray">
										{formatTime(sess.timestamp)}
										{fileCount > 0 ? `  ${fileCount}f` : ""}
									</span>
								</text>
							);
						})}
					</box>
				)}

				{stats.topFiles.length > 0 && (
					<box
						border
						borderStyle="round"
						flexDirection="column"
						marginTop={1}
						paddingX={1}
						title=" Most Touched Files "
					>
						{stats.topFiles.slice(0, 10).map(({ file, count }) => (
							<text height={1} key={file}>
								{`  › ${file}  `}
								<span fg="gray">{`(${count})`}</span>
							</text>
						))}
					</box>
				)}
			</box>
		</scrollbox>
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
		<scrollbox flexGrow={1} focused scrollY>
			<box flexDirection="column" paddingX={1}>
				<text
					content={s(dim("Diff › "), bold(`${file}  #${index + 1}`))}
					height={1}
				/>
				<text content={s(dim(meta))} height={1} />

				<Section label="Summary" text={entry.summary} />

				{entry.prompt !== entry.summary && (
					<Section label="Prompt" text={entry.prompt} />
				)}

				<Section label="Response" text={entry.response} />
				<Section label="Diff" text={entry.diffSummary} />
			</box>
		</scrollbox>
	);
}

function DiffView({
	files,
	detail,
	onDetail,
	onSubStateChange,
	resetRef,
}: {
	files: Array<{ file: string; count: number }>;
	detail: number | null;
	onDetail: (idx: number | null) => void;
	onSubStateChange: (hasState: boolean) => void;
	resetRef: { current: (() => void) | null };
}) {
	const [results, setResults] = useState<DiffEntry[]>([]);
	const [selectedFile, setSelectedFile] = useState("");
	const [customInput, setCustomInput] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		onSubStateChange(selectedFile !== "" || customInput);
	}, [selectedFile, customInput, onSubStateChange]);

	useEffect(() => {
		resetRef.current = () => {
			setSelectedFile("");
			setCustomInput(false);
			setResults([]);
			setError("");
		};
		return () => {
			resetRef.current = null;
		};
	}, [resetRef]);

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
		if (files.length === 0) {
			return (
				<box flexDirection="column" flexGrow={1} paddingX={1}>
					<box paddingY={1}>
						<text
							content={s(yellow("No agent sessions indexed yet."))}
							height={1}
						/>
					</box>
					<text
						content={s(
							dim("Run yep sync after working with an agent to index sessions.")
						)}
						height={1}
					/>
					<text content=" " height={1} />
					<box flexDirection="row" gap={1}>
						<text content={s(dim("Or enter a path:"))} height={1} />
						<input
							focused
							onSubmit={handleInputSubmit}
							placeholder="path/to/file.ts"
							width={40}
						/>
					</box>
					<box flexGrow={1} />
				</box>
			);
		}

		const opts = [
			...files.map(({ file, count }) => ({
				name: file,
				description: `${count} refs`,
				value: file,
			})),
			{
				name: "Enter path manually…",
				description: "",
				value: "__custom__",
			},
		];
		return (
			<box flexDirection="column" flexGrow={1}>
				<text
					content={s(dim("  Select a file to view its change history"))}
					height={1}
				/>
				<box
					border
					borderStyle="round"
					flexGrow={1}
					marginTop={1}
					title=" Files "
				>
					<select
						flexGrow={1}
						focused
						itemSpacing={0}
						onSelect={handleFileSelect}
						options={opts}
						showDescription
						wrapSelection
					/>
				</box>
			</box>
		);
	}

	if (!selectedFile && customInput) {
		return (
			<box flexDirection="column" flexGrow={1} paddingX={1}>
				<box flexDirection="row" gap={1} paddingY={1}>
					<text content={s(cyan("›"))} height={1} />
					<input
						focused
						onSubmit={handleInputSubmit}
						placeholder="path/to/file.ts"
						width={50}
					/>
				</box>
				<box flexGrow={1} />
			</box>
		);
	}

	if (loading) {
		return (
			<box flexDirection="column" flexGrow={1} paddingX={1}>
				<text content={s(bold(selectedFile))} height={1} />
				<text content={s(dim("loading…"))} height={1} />
			</box>
		);
	}

	if (error) {
		return (
			<box flexDirection="column" flexGrow={1} paddingX={1}>
				<text content={s(bold(selectedFile))} height={1} />
				<text fg="red" height={1}>
					{error}
				</text>
				<box flexGrow={1} />
			</box>
		);
	}

	const sorted = [...results].sort((a, b) =>
		a.timestamp.localeCompare(b.timestamp)
	);

	if (sorted.length === 0) {
		return (
			<box flexDirection="column" flexGrow={1} paddingX={1}>
				<text content={s(bold(selectedFile))} height={1} />
				<text
					content={s(dim("No agent sessions have touched this file."))}
					height={1}
				/>
				<text
					content={s(dim("Sessions are indexed after yep sync."))}
					height={1}
				/>
				<box flexGrow={1} />
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
		<box flexDirection="column" flexGrow={1}>
			<text
				content={s(dim(`  ${selectedFile}  ·  ${sorted.length} session(s)`))}
				height={1}
			/>
			<box
				border
				borderStyle="round"
				flexGrow={1}
				marginTop={1}
				title=" Timeline "
			>
				<select
					flexGrow={1}
					focused
					itemSpacing={0}
					onSelect={handleResultSelect}
					options={options}
					showDescription
					wrapSelection
				/>
			</box>
		</box>
	);
}

function App() {
	const [view, setView] = useState<View>("search");
	const [stats, setStats] = useState<MemStats | null>(null);
	const [detail, setDetail] = useState<number | null>(null);
	const [diffHasSubState, setDiffHasSubState] = useState(false);
	const diffResetRef = useRef<(() => void) | null>(null);
	const renderer = useRenderer();

	useEffect(() => {
		loadStats().then(setStats);
	}, []);

	const handleDiffSubState = useCallback((hasState: boolean) => {
		setDiffHasSubState(hasState);
	}, []);

	const handleEscape = useCallback(() => {
		if (detail !== null) {
			setDetail(null);
			return;
		}
		if (view === "diff" && diffHasSubState) {
			diffResetRef.current?.();
			return;
		}
		renderer.destroy();
		resolveExit?.(null);
	}, [detail, view, diffHasSubState, renderer]);

	const handleTabSwitch = useCallback(
		(shift: boolean) => {
			const dir = shift ? -1 : 1;
			const idx = TAB_VIEWS.indexOf(view);
			const next = TAB_VIEWS[(idx + dir + TAB_VIEWS.length) % TAB_VIEWS.length];
			if (next) {
				setDetail(null);
				setView(next);
			}
		},
		[view]
	);

	const handleCtrlAction = useCallback(
		(name: string) => {
			const actions: Record<string, string> = {
				s: "sync",
				w: "watch",
				r: "reset",
			};
			const action = actions[name];
			if (action) {
				renderer.destroy();
				resolveExit?.(action);
			}
		},
		[renderer]
	);

	useKeyboard((key) => {
		if (key.name === "escape") {
			handleEscape();
			return;
		}
		if (key.name === "tab" && !key.ctrl && !key.meta) {
			handleTabSwitch(key.shift === true);
			return;
		}
		if (key.ctrl && key.name) {
			handleCtrlAction(key.name);
		}
	});

	const helpText = useMemo(() => {
		if (detail !== null) {
			return "↑↓ scroll · esc back";
		}
		if (view === "diff" && diffHasSubState) {
			return "↑↓ scroll · esc back · tab/shift+tab switch";
		}
		return "tab/shift+tab switch · ^S sync · ^W watch · ^R reset · esc quit";
	}, [detail, view, diffHasSubState]);

	return (
		<box flexDirection="column" flexGrow={1}>
			<box border borderStyle="round" flexDirection="column" paddingX={1}>
				<ascii-font font="tiny" text="yep" />
				<StatusBar stats={stats} />
			</box>

			<TabBar active={view} />

			<box flexDirection="column" flexGrow={1}>
				{view === "search" && (
					<SearchView detail={detail} onDetail={setDetail} />
				)}
				{view === "code" && (
					<CodeSearchView detail={detail} onDetail={setDetail} />
				)}
				{view === "status" && <StatusView stats={stats} />}
				{view === "diff" && (
					<DiffView
						detail={detail}
						files={stats?.topFiles ?? []}
						onDetail={setDetail}
						onSubStateChange={handleDiffSubState}
						resetRef={diffResetRef}
					/>
				)}
			</box>

			<HelpBar hints={helpText} />
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
