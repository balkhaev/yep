// @ts-nocheck
import type { TextChunk } from "@opentui/core";
import { bold, dim, StyledText, t } from "@opentui/core";
import { useEffect, useState } from "react";
import { COLORS, SEMANTIC } from "../../theme";

interface CoChangePair {
	file1: string;
	file2: string;
	changeCount: number;
	support: number; // 0-1
	confidence: number; // 0-1
}

interface CoChangeData {
	totalCommits: number;
	pairs: CoChangePair[];
}

function s(...chunks: TextChunk[]): StyledText {
	return new StyledText(chunks);
}

function getConfidenceColor(confidence: number): string {
	if (confidence >= 0.8) {
		return SEMANTIC.error; // Very strong coupling
	}
	if (confidence >= 0.6) {
		return SEMANTIC.warning;
	}
	if (confidence >= 0.4) {
		return SEMANTIC.accent;
	}
	return COLORS.dim;
}

export default function CoChangeTab() {
	const [coChangeData, setCoChangeData] = useState<CoChangeData | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		// Load co-change data from API
		fetch("/api/co-change?days=90")
			.then((res) => res.json())
			.then((data) => {
				setCoChangeData(data);
				setLoading(false);
			})
			.catch(() => {
				setLoading(false);
			});
	}, []);

	if (loading) {
		return (
			<box flexDirection="column" paddingTop={1}>
				<text content={s(dim("Loading co-change analysis..."))} />
			</box>
		);
	}

	if (!coChangeData || coChangeData.pairs.length === 0) {
		return (
			<box flexDirection="column" paddingTop={1}>
				<text content={s(dim("No co-change data available"))} />
				<text
					content={s(
						dim("Need at least 30 days of git history with multiple commits")
					)}
				/>
			</box>
		);
	}

	const lines: TextChunk[][] = [];

	// Header
	lines.push([bold(t`🔗 Co-Change Analysis`)]);
	lines.push([t``]); // Empty line

	// Summary
	lines.push([
		t`${SEMANTIC.accent}Period${COLORS.reset}: `,
		bold(t`Last 90 days`),
	]);
	lines.push([
		t`${SEMANTIC.accent}Commits Analyzed${COLORS.reset}: `,
		bold(t`${coChangeData.totalCommits}`),
	]);
	lines.push([
		t`${SEMANTIC.accent}Coupling Pairs${COLORS.reset}: `,
		bold(t`${coChangeData.pairs.length}`),
	]);
	lines.push([t``]);

	// Info
	lines.push([
		dim(t`Files that frequently change together indicate hidden dependencies`),
	]);
	lines.push([t``]);

	// Top Co-Change Pairs
	lines.push([bold(t`Top Coupled Files`)]);
	lines.push([t``]);

	for (const pair of coChangeData.pairs.slice(0, 10)) {
		const confidencePercent = (pair.confidence * 100).toFixed(0);
		const color = getConfidenceColor(pair.confidence);

		// Shorten file paths for display
		const file1Short =
			pair.file1.length > 40
				? "..." + pair.file1.slice(-37)
				: pair.file1;
		const file2Short =
			pair.file2.length > 40
				? "..." + pair.file2.slice(-37)
				: pair.file2;

		lines.push([
			t`${color}${confidencePercent}%${COLORS.reset} `,
			dim(t`confidence`),
		]);
		lines.push([dim(t`  ${file1Short}`)]);
		lines.push([dim(t`  ↔ ${file2Short}`)]);
		lines.push([
			dim(t`  Changed together ${pair.changeCount}x`),
		]);
		lines.push([t``]);
	}

	if (coChangeData.pairs.length > 10) {
		lines.push([
			dim(t`... and ${coChangeData.pairs.length - 10} more pairs`),
		]);
		lines.push([t``]);
	}

	// Recommendations
	lines.push([bold(t`💡 What This Means`)]);
	lines.push([
		dim(
			t`  • High confidence (>80%): strong coupling, consider refactoring`
		),
	]);
	lines.push([
		dim(t`  • When changing one file, review the coupled files`),
	]);
	lines.push([dim(t`  • Use for test prioritization and code review`)]);

	return (
		<box flexDirection="column" paddingTop={1}>
			{lines.map((line, i) => (
				<text key={i} content={s(...line)} />
			))}
		</box>
	);
}
