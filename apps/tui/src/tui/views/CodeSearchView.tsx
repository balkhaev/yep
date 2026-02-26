// @ts-nocheck
import type { TextChunk } from "@opentui/core";
import { bold, dim, StyledText, SyntaxStyle, t } from "@opentui/core";
// @ts-expect-error react types resolved via opentui reconciler
import { useCallback, useEffect, useState } from "react";
import { Breadcrumbs } from "../components/ui";
import { formatTime, SYMBOL_ICONS, shortenPath, truncate } from "../helpers";
import { COLORS, SEMANTIC, SYMBOL_COLORS } from "../theme";
import type { CodeRelation, CodeSearchHit } from "../types";

function s(...chunks: TextChunk[]): StyledText {
	return new StyledText(chunks);
}

const syntaxStyleInstance = SyntaxStyle.create();

interface CodeSearchViewProps {
	detail: number | null;
	onCodeSearch: (query: string) => Promise<CodeSearchHit[]>;
	onDetail: (idx: number | null) => void;
	onLoadRelations: (symbol: string) => Promise<{
		callers: CodeRelation[];
		callees: CodeRelation[];
		importers: CodeRelation[];
	}>;
}

function CodeDetail({
	entry,
	onLoadRelations,
}: {
	entry: CodeSearchHit;
	onLoadRelations: (symbol: string) => Promise<{
		callers: CodeRelation[];
		callees: CodeRelation[];
		importers: CodeRelation[];
	}>;
}) {
	const [relations, setRelations] = useState<{
		callers: CodeRelation[];
		callees: CodeRelation[];
		importers: CodeRelation[];
	} | null>(null);

	useEffect(() => {
		const baseName = entry.symbol.includes(".")
			? (entry.symbol.split(".").pop() ?? entry.symbol)
			: entry.symbol;
		onLoadRelations(baseName).then(setRelations);
	}, [entry.symbol, onLoadRelations]);

	const icon = SYMBOL_ICONS[entry.symbolType] ?? "?";
	const shortPath = shortenPath(entry.path);

	// Symbol type color
	const symbolColor =
		SYMBOL_COLORS[entry.symbolType as keyof typeof SYMBOL_COLORS] ??
		COLORS.zinc400;

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
			const riColor =
				SYMBOL_COLORS[r.symbolType as keyof typeof SYMBOL_COLORS] ??
				COLORS.zinc400;
			return `  ${riColor}${ri}${COLORS.reset} ${r.symbol}  ${dim(rp).text}`;
		});
		return (
			<box flexDirection="column" paddingTop={1}>
				<text
					content={s(
						t`${SEMANTIC.primary}${bold(`${label} (${items.length})`)}${COLORS.reset}`
					)}
					height={1}
				/>
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
				<Breadcrumbs
					items={[
						{ label: "Code" },
						{ label: `${icon} ${entry.symbol}`, active: true },
					]}
				/>
				<text content={s(dim(shortPath))} height={1} />
				<text
					content={s(
						t`${symbolColor}${entry.symbolType}${COLORS.reset} ${dim(`· score ${entry.score.toFixed(3)}  ·  ${entry.language}`)}`
					)}
					height={1}
				/>
				{commitInfo && <text content={s(dim(commitInfo))} height={1} />}
				{entry.summary ? (
					<box flexDirection="column" paddingTop={1}>
						<text
							content={s(
								t`${SEMANTIC.primary}${bold("Summary")}${COLORS.reset}`
							)}
							height={1}
						/>
						<text height={1}>{entry.summary}</text>
					</box>
				) : null}

				<box
					border
					borderStyle="rounded"
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

export default function CodeSearchView({
	detail,
	onDetail,
	onCodeSearch,
	onLoadRelations,
}: CodeSearchViewProps) {
	const [results, setResults] = useState<CodeSearchHit[]>([]);
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
				setResults(await onCodeSearch(q));
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			} finally {
				setLoading(false);
			}
		},
		[onCodeSearch]
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
		return <CodeDetail entry={entry} onLoadRelations={onLoadRelations} />;
	}

	const options = results.map((r: CodeSearchHit, i: number) => {
		const icon = SYMBOL_ICONS[r.symbolType] ?? "?";
		const shortPath = shortenPath(r.path);
		const symbolColor =
			SYMBOL_COLORS[r.symbolType as keyof typeof SYMBOL_COLORS] ??
			COLORS.zinc400;
		return {
			name: `${symbolColor}${icon}${COLORS.reset} ${r.symbol}`,
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
			<Breadcrumbs items={[{ label: "Code", active: true }]} />

			<box flexDirection="row" gap={1} paddingX={1} paddingY={1}>
				<text content={s(t`${SEMANTIC.primary}›${COLORS.reset}`)} height={1} />
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
				<text
					content={s(t`${SEMANTIC.muted}  No symbols found.${COLORS.reset}`)}
					height={1}
				/>
			)}

			{results.length > 0 && (
				<box border borderStyle="rounded" flexGrow={1} title=" Symbols ">
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
