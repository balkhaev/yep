// @ts-nocheck
import type { TextChunk } from "@opentui/core";
import { bold, dim, StyledText, t } from "@opentui/core";
// @ts-expect-error react types resolved via opentui reconciler
import { useCallback, useEffect, useState } from "react";
import { Breadcrumbs } from "../components/ui";
import { formatTime, truncate, wrapLines } from "../helpers";
import { COLORS, SEMANTIC } from "../theme";
import type { DiffEntry } from "../types";

function s(...chunks: TextChunk[]): StyledText {
	return new StyledText(chunks);
}

interface DiffViewProps {
	detail: number | null;
	files: Array<{ file: string; count: number }>;
	onDetail: (idx: number | null) => void;
	onDoDiff: (file: string) => Promise<DiffEntry[]>;
	onSubStateChange: (hasState: boolean) => void;
	resetRef: { current: (() => void) | null };
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

	// Agent color (example: Claude = indigo, GPT = emerald)
	const agentColor =
		entry.agent === "claude"
			? SEMANTIC.primary
			: entry.agent === "gpt"
				? SEMANTIC.success
				: COLORS.zinc400;

	return (
		<scrollbox flexGrow={1} focused scrollY>
			<box flexDirection="column" paddingX={1}>
				<Breadcrumbs
					items={[
						{ label: "Timeline" },
						{ label: file },
						{ label: `#${index + 1}`, active: true },
					]}
				/>
				<text
					content={s(
						t`${entry.agent !== "unknown" ? `${agentColor}[${entry.agent}]${COLORS.reset} ` : ""}${dim(meta)}`
					)}
					height={1}
				/>

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
			</box>
		</scrollbox>
	);
}

export default function DiffView({
	files,
	detail,
	onDetail,
	onSubStateChange,
	resetRef,
	onDoDiff,
}: DiffViewProps) {
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

	const runDiff = useCallback(
		async (file: string) => {
			setSelectedFile(file);
			setLoading(true);
			setError("");
			try {
				setResults(await onDoDiff(file));
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			} finally {
				setLoading(false);
			}
		},
		[onDoDiff]
	);

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
					<Breadcrumbs items={[{ label: "Timeline", active: true }]} />
					<box paddingY={1}>
						<text
							content={s(
								t`${SEMANTIC.warning}${bold("No agent sessions indexed yet.")}${COLORS.reset}`
							)}
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
				<Breadcrumbs items={[{ label: "Timeline", active: true }]} />
				<text
					content={s(dim("  Select a file to view its change history"))}
					height={1}
				/>
				<box
					border
					borderStyle="rounded"
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
				<Breadcrumbs items={[{ label: "Timeline", active: true }]} />
				<box flexDirection="row" gap={1} paddingY={1}>
					<text
						content={s(t`${SEMANTIC.primary}›${COLORS.reset}`)}
						height={1}
					/>
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
				<Breadcrumbs
					items={[{ label: "Timeline" }, { label: selectedFile, active: true }]}
				/>
				<text content={s(dim("loading…"))} height={1} />
			</box>
		);
	}

	if (error) {
		return (
			<box flexDirection="column" flexGrow={1} paddingX={1}>
				<Breadcrumbs
					items={[{ label: "Timeline" }, { label: selectedFile, active: true }]}
				/>
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
				<Breadcrumbs
					items={[{ label: "Timeline" }, { label: selectedFile, active: true }]}
				/>
				<text
					content={s(
						t`${SEMANTIC.warning}No agent sessions have touched this file.${COLORS.reset}`
					)}
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

	const options = sorted.map((r, i) => {
		const agentColor =
			r.agent === "claude"
				? SEMANTIC.primary
				: r.agent === "gpt"
					? SEMANTIC.success
					: COLORS.zinc400;
		return {
			name: `${String(i + 1).padStart(2)}.  ${truncate(r.summary, 55)}`,
			description: `${formatTime(r.timestamp)}${r.agent !== "unknown" ? `${agentColor}  ·  ${r.agent}${COLORS.reset}` : ""}`,
			value: String(i),
		};
	});

	return (
		<box flexDirection="column" flexGrow={1}>
			<Breadcrumbs
				items={[{ label: "Timeline" }, { label: selectedFile, active: true }]}
			/>
			<text
				content={s(dim(`  ${sorted.length} session(s)`))}
				height={1}
				paddingX={1}
			/>
			<box
				border
				borderStyle="rounded"
				flexGrow={1}
				marginTop={1}
				title=" Sessions "
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
