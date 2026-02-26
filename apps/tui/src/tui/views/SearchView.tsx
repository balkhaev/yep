// @ts-nocheck
import type { TextChunk } from "@opentui/core";
import { bold, dim, StyledText, t } from "@opentui/core";
// @ts-expect-error react types resolved via opentui reconciler
import { useCallback, useState } from "react";
import { Breadcrumbs } from "../components/ui";
import { formatTime, truncate, wrapLines } from "../helpers";
import { COLORS, LANGUAGE_COLORS, SEMANTIC } from "../theme";
import type { SearchHit } from "../types";

function s(...chunks: TextChunk[]): StyledText {
	return new StyledText(chunks);
}

interface SearchViewProps {
	detail: number | null;
	onDetail: (idx: number | null) => void;
	onSearch: (query: string) => Promise<SearchHit[]>;
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

	// Language color
	const langColor =
		entry.language &&
		LANGUAGE_COLORS[
			entry.language.toLowerCase() as keyof typeof LANGUAGE_COLORS
		]
			? LANGUAGE_COLORS[
					entry.language.toLowerCase() as keyof typeof LANGUAGE_COLORS
				]
			: LANGUAGE_COLORS.default;

	return (
		<scrollbox flexGrow={1} focused scrollY>
			<box flexDirection="column" paddingX={1}>
				<Breadcrumbs
					items={[
						{ label: "Search" },
						{ label: `Result #${index + 1}`, active: true },
					]}
				/>
				<text content={s(dim(meta))} height={1} />
				{tags.length > 0 && (
					<box flexDirection="row" gap={1} paddingY={0}>
						{tags.map((tag) => (
							<text
								content={s(
									t`${tag === entry.language ? langColor : SEMANTIC.info}${tag}${COLORS.reset}`
								)}
								height={1}
								key={tag}
							/>
						))}
					</box>
				)}

				{entry.summary && (
					<box flexDirection="column" paddingTop={1}>
						<text
							content={s(
								t`${SEMANTIC.primary}${bold("Summary")}${COLORS.reset}`
							)}
							height={1}
						/>
						<text height={wrapLines(entry.summary, 72, 50).length}>
							{wrapLines(entry.summary, 72, 50).join("\n")}
						</text>
					</box>
				)}

				{symbolList.length > 0 && (
					<box flexDirection="column" paddingTop={1}>
						<text
							content={s(
								t`${SEMANTIC.primary}${bold(`Symbols (${symbolList.length})`)}${COLORS.reset}`
							)}
							height={1}
						/>
						<text height={1}>{`  ${symbolList.join(", ")}`}</text>
					</box>
				)}

				{entry.prompt && entry.prompt !== entry.summary && (
					<box flexDirection="column" paddingTop={1}>
						<text
							content={s(
								t`${SEMANTIC.primary}${bold("Prompt")}${COLORS.reset}`
							)}
							height={1}
						/>
						<text height={wrapLines(entry.prompt, 72, 50).length}>
							{wrapLines(entry.prompt, 72, 50).join("\n")}
						</text>
					</box>
				)}

				{entry.response && (
					<box flexDirection="column" paddingTop={1}>
						<text
							content={s(
								t`${SEMANTIC.primary}${bold("Response")}${COLORS.reset}`
							)}
							height={1}
						/>
						<text height={wrapLines(entry.response, 72, 50).length}>
							{wrapLines(entry.response, 72, 50).join("\n")}
						</text>
					</box>
				)}

				{entry.diffSummary && (
					<box flexDirection="column" paddingTop={1}>
						<text
							content={s(t`${SEMANTIC.primary}${bold("Diff")}${COLORS.reset}`)}
							height={1}
						/>
						<text height={wrapLines(entry.diffSummary, 72, 50).length}>
							{wrapLines(entry.diffSummary, 72, 50).join("\n")}
						</text>
					</box>
				)}

				{fileList.length > 0 && (
					<box flexDirection="column" paddingTop={1}>
						<text
							content={s(
								t`${SEMANTIC.primary}${bold(`Files (${fileList.length})`)}${COLORS.reset}`
							)}
							height={1}
						/>
						<text height={fileList.length}>
							{fileList.map((f: string) => `  › ${f}`).join("\n")}
						</text>
					</box>
				)}
			</box>
		</scrollbox>
	);
}

export default function SearchView({
	detail,
	onDetail,
	onSearch,
}: SearchViewProps) {
	const [results, setResults] = useState<SearchHit[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [searched, setSearched] = useState(false);

	const handleSubmit = useCallback(
		async (value: string) => {
			const q = value.trim();
			if (!q) {
				return;
			}
			setError("");
			setLoading(true);
			setSearched(true);
			try {
				setResults(await onSearch(q));
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			} finally {
				setLoading(false);
			}
		},
		[onSearch]
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
			<Breadcrumbs items={[{ label: "Search", active: true }]} />

			<box flexDirection="row" gap={1} paddingX={1} paddingY={1}>
				<text content={s(t`${SEMANTIC.primary}›${COLORS.reset}`)} height={1} />
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
				<text
					content={s(t`${SEMANTIC.muted}  No results found.${COLORS.reset}`)}
					height={1}
				/>
			)}

			{results.length > 0 && (
				<box border borderStyle="rounded" flexGrow={1} title=" Results ">
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
