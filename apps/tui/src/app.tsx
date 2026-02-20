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

type View = "menu" | "search" | "status" | "diff";

interface MemStats {
	agents: string[];
	embeddingModel: string;
	hasTable: boolean;
	initialized: boolean;
	provider: string;
	topFiles: string[];
	totalChunks: number;
}

interface SearchHit {
	agent: string;
	diffSummary: string;
	filesChanged: string;
	prompt: string;
	response: string;
	score: number;
	summary: string;
	timestamp: string;
	tokensUsed: number;
}

interface DiffEntry {
	agent: string;
	diffSummary: string;
	prompt: string;
	response: string;
	summary: string;
	timestamp: string;
	tokensUsed: number;
}

const PAD = 16;

function s(...chunks: TextChunk[]): StyledText {
	return new StyledText(chunks);
}

function cleanText(raw: string): string {
	return raw
		.replace(/<[^>]+>/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

function truncate(text: string, maxLen = 60): string {
	if (text.length <= maxLen) {
		return text;
	}
	return `${text.slice(0, maxLen)}…`;
}

function formatTime(ts: string): string {
	if (!ts) {
		return "unknown";
	}
	return new Date(ts).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function wrapText(text: string, width = 72): string[] {
	const lines: string[] = [];
	for (const paragraph of text.split("\n")) {
		if (paragraph.length <= width) {
			lines.push(paragraph);
			continue;
		}
		const words = paragraph.split(" ");
		let current = "";
		for (const word of words) {
			if (current.length + word.length + 1 > width && current) {
				lines.push(current);
				current = word;
			} else {
				current = current ? `${current} ${word}` : word;
			}
		}
		if (current) {
			lines.push(current);
		}
	}
	return lines;
}

function buildDetailBlock(
	sections: Array<{ label: string; value: string }>
): string[] {
	const lines: string[] = [];
	for (const { label, value } of sections) {
		if (!value) {
			continue;
		}
		if (lines.length > 0) {
			lines.push("");
		}
		lines.push(`── ${label} ──`);
		lines.push(...wrapText(value));
	}
	return lines;
}

const MENU = [
	{
		name: "Search",
		description: "Find relevant past solutions",
		value: "search",
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

async function loadStats(): Promise<MemStats> {
	try {
		const config = await import("./mem/lib/config.ts");
		if (!config.isInitialized()) {
			return {
				initialized: false,
				provider: "openai",
				embeddingModel: "",
				totalChunks: 0,
				hasTable: false,
				topFiles: [],
				agents: [],
			};
		}
		const cfg = config.readConfig();
		const { getStats } = await import("./mem/core/store.ts");
		const stats = await getStats();
		return {
			initialized: true,
			provider: cfg.provider,
			embeddingModel: config.getEmbeddingModel(),
			...stats,
		};
	} catch {
		return {
			initialized: false,
			provider: "unknown",
			embeddingModel: "",
			totalChunks: 0,
			hasTable: false,
			topFiles: [],
			agents: [],
		};
	}
}

async function doSearch(query: string): Promise<SearchHit[]> {
	const config = await import("./mem/lib/config.ts");
	if (!config.isInitialized()) {
		throw new Error("Not initialized. Run yep enable first.");
	}
	if (config.getProvider() === "openai") {
		const key = config.resolveOpenAIKey();
		if (!key) {
			throw new Error("OpenAI API key not configured");
		}
		process.env.OPENAI_API_KEY = key;
	}
	const { embedText } = await import("./mem/core/embedder.ts");
	const { searchSolutions } = await import("./mem/core/store.ts");
	const vector = await embedText(query);
	const results = await searchSolutions(vector, 5, { queryText: query });
	return results.map((r) => ({
		summary: cleanText(r.chunk.summary || r.chunk.prompt),
		prompt: cleanText(r.chunk.prompt),
		response: cleanText(r.chunk.response),
		diffSummary: cleanText(r.chunk.diffSummary),
		filesChanged: r.chunk.filesChanged,
		score: r.score,
		timestamp: r.chunk.timestamp,
		agent: r.chunk.agent,
		tokensUsed: r.chunk.tokensUsed,
	}));
}

async function doDiff(file: string): Promise<DiffEntry[]> {
	const config = await import("./mem/lib/config.ts");
	if (!config.isInitialized()) {
		throw new Error("Not initialized. Run yep enable first.");
	}
	const { searchByFile } = await import("./mem/core/store.ts");
	const results = await searchByFile(file);
	return results.map((r) => ({
		summary: cleanText(r.summary || r.prompt),
		prompt: cleanText(r.prompt),
		response: cleanText(r.response),
		diffSummary: r.diffSummary ? cleanText(r.diffSummary) : "",
		timestamp: r.timestamp,
		agent: r.agent,
		tokensUsed: r.tokensUsed,
	}));
}

function StatusBar({ stats }: { stats: MemStats | null }) {
	if (!stats) {
		return <text content={s(dim("loading..."))} height={1} />;
	}
	if (!stats.initialized) {
		return (
			<text
				content={s(yellow("not initialized — run yep enable"))}
				height={1}
			/>
		);
	}
	const health = stats.hasTable ? green("●") : yellow("○");
	return (
		<text
			content={t`${health} ${dim(stats.provider)} ${dim("·")} ${dim(stats.embeddingModel)} ${dim("·")} ${cyan(String(stats.totalChunks))} ${dim("chunks")}`}
			height={1}
		/>
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
		const meta = [
			`${"Score".padEnd(PAD)}${entry.score.toFixed(3)}`,
			`${"Date".padEnd(PAD)}${formatTime(entry.timestamp)}`,
			`${"Agent".padEnd(PAD)}${entry.agent}`,
		];
		if (entry.tokensUsed > 0) {
			meta.push(`${"Tokens".padEnd(PAD)}${entry.tokensUsed.toLocaleString()}`);
		}
		if (entry.filesChanged) {
			const fileList = entry.filesChanged
				.split(",")
				.map((f: string) => f.trim())
				.filter(Boolean);
			meta.push(`${"Files".padEnd(PAD)}${fileList.length} file(s)`);
			for (const f of fileList.slice(0, 8)) {
				meta.push(`${"".padEnd(PAD)}› ${f}`);
			}
			if (fileList.length > 8) {
				meta.push(`${"".padEnd(PAD)}  +${fileList.length - 8} more`);
			}
		}

		const sections = buildDetailBlock([
			{ label: "Summary", value: entry.summary },
			...(entry.prompt !== entry.summary
				? [{ label: "Prompt", value: entry.prompt }]
				: []),
			{ label: "Response", value: entry.response },
			{ label: "Diff", value: entry.diffSummary },
		]);

		const allLines = [...meta, "", ...sections];

		return (
			<box flexDirection="column" flexGrow={1} paddingX={2}>
				<text content={s(bold(`Result #${detailIdx + 1}`))} height={1} />
				<text content=" " height={1} />
				<text content={s(dim(allLines.join("\n")))} height={allLines.length} />
				<box flexGrow={1} />
				<text content={s(dim("esc back to list"))} height={1} />
			</box>
		);
	}

	const searchOptions = results.map((r: SearchHit, i: number) => {
		const agentStr = r.agent !== "unknown" ? ` [${r.agent}]` : "";
		return {
			name: `${r.score.toFixed(2)}${agentStr}  ${truncate(r.summary)}`,
			description: "",
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
					placeholder="describe what you need..."
					width={50}
				/>
			</box>

			{loading && <text content={s(dim("searching..."))} height={1} />}
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
					options={searchOptions}
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

	const tableText = stats.hasTable ? "exists" : "not created";

	const lines = [
		`${"Provider".padEnd(PAD)}${stats.provider}`,
		`${"Embedding".padEnd(PAD)}${stats.embeddingModel}`,
		`${"Chunks".padEnd(PAD)}${stats.totalChunks}`,
		`${"Table".padEnd(PAD)}${tableText}`,
	];
	if (stats.agents.length > 0) {
		lines.push(`${"Agents".padEnd(PAD)}${stats.agents.join(", ")}`);
	}
	if (stats.topFiles.length > 0) {
		lines.push("");
		lines.push("Most touched files");
		for (const f of stats.topFiles.slice(0, 5)) {
			lines.push(`  › ${f}`);
		}
	}

	return (
		<box flexDirection="column" flexGrow={1} paddingX={2}>
			<text content={s(bold("Memory Status"))} height={1} />
			<text content=" " height={1} />
			<text content={s(dim(lines.join("\n")))} height={lines.length} />
			<box flexGrow={1} />
			<text content={s(dim("esc back"))} height={1} />
		</box>
	);
}

function DiffView({
	files,
	detail,
	onDetail,
}: {
	files: string[];
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
		const options = [
			...files.map((f) => ({ name: f, description: "", value: f })),
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
					options={options}
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
				<text content={s(dim("loading..."))} height={1} />
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
		const meta = [
			`${"Date".padEnd(PAD)}${formatTime(entry.timestamp)}`,
			`${"Agent".padEnd(PAD)}${entry.agent}`,
		];
		if (entry.tokensUsed > 0) {
			meta.push(`${"Tokens".padEnd(PAD)}${entry.tokensUsed.toLocaleString()}`);
		}

		const sections = buildDetailBlock([
			{ label: "Summary", value: entry.summary },
			...(entry.prompt !== entry.summary
				? [{ label: "Prompt", value: entry.prompt }]
				: []),
			{ label: "Response", value: entry.response },
			{ label: "Diff", value: entry.diffSummary },
		]);

		const allLines = [...meta, "", ...sections];

		return (
			<box flexDirection="column" flexGrow={1} paddingX={2}>
				<text
					content={s(bold(`${selectedFile}  #${detailIdx + 1}`))}
					height={1}
				/>
				<text content=" " height={1} />
				<text content={s(dim(allLines.join("\n")))} height={allLines.length} />
				<box flexGrow={1} />
				<text content={s(dim("esc back to list"))} height={1} />
			</box>
		);
	}

	const options = sorted.map((r, i) => ({
		name: `${String(i + 1).padStart(2)}. ${formatTime(r.timestamp)}  ${truncate(r.summary)}`,
		description: "",
		value: String(i),
	}));

	return (
		<box flexDirection="column" flexGrow={1} paddingX={2}>
			<text content={s(bold(selectedFile))} height={1} />
			<text content={s(dim(`${sorted.length} session(s)`))} height={1} />
			<select
				flexGrow={1}
				focused
				itemSpacing={0}
				onSelect={handleResultSelect}
				options={options}
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

export async function renderTuiApp(): Promise<string | null> {
	const exitPromise = new Promise<string | null>((resolve) => {
		resolveExit = resolve;
	});
	const renderer = await createCliRenderer();
	createRoot(renderer).render(<App />);
	return exitPromise;
}
