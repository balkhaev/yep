// @ts-nocheck
import type { TextChunk } from "@opentui/core";
import { bold, dim, StyledText, t } from "@opentui/core";
import { useEffect, useState } from "react";
import { COLORS, SEMANTIC } from "../../theme";

interface DetectedPattern {
	pattern: string;
	type: "architectural" | "react";
	symbol: string;
	path: string;
	confidence: number;
	description: string;
}

interface DetectedAntiPattern {
	antiPattern: string;
	symbol: string;
	path: string;
	severity: "low" | "medium" | "high";
	confidence: number;
	description: string;
}

interface PatternsData {
	patterns: DetectedPattern[];
	antiPatterns: DetectedAntiPattern[];
}

function s(...chunks: TextChunk[]): StyledText {
	return new StyledText(chunks);
}

function getPatternEmoji(type: string): string {
	return type === "architectural" ? "🏗️" : "⚛️";
}

function getAntiPatternEmoji(severity: string): string {
	switch (severity) {
		case "high":
			return "🔴";
		case "medium":
			return "🟡";
		default:
			return "🟢";
	}
}

function getSeverityColor(severity: string): string {
	switch (severity) {
		case "high":
			return SEMANTIC.error;
		case "medium":
			return SEMANTIC.warning;
		default:
			return SEMANTIC.success;
	}
}

export default function PatternsTab() {
	const [patternsData, setPatternsData] = useState<PatternsData | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		// Load patterns from API
		fetch("/api/patterns")
			.then((res) => res.json())
			.then((data) => {
				setPatternsData(data);
				setLoading(false);
			})
			.catch(() => {
				setLoading(false);
			});
	}, []);

	if (loading) {
		return (
			<box flexDirection="column" paddingTop={1}>
				<text content={s(dim("Loading pattern detection..."))} />
			</box>
		);
	}

	if (!patternsData) {
		return (
			<box flexDirection="column" paddingTop={1}>
				<text content={s(dim("No pattern data available"))} />
				<text content={s(dim("Run 'yep index-code' to detect patterns"))} />
			</box>
		);
	}

	const lines: TextChunk[][] = [];

	// Header
	lines.push([bold(t`🏗️ Pattern Detection`)]);
	lines.push([t``]); // Empty line

	// Summary
	lines.push([
		t`${SEMANTIC.accent}Patterns Found${COLORS.reset}: `,
		bold(t`${patternsData.patterns.length}`),
	]);
	lines.push([
		t`${SEMANTIC.warning}Anti-Patterns${COLORS.reset}: `,
		bold(t`${patternsData.antiPatterns.length}`),
	]);
	lines.push([t``]);

	// Detected Patterns
	if (patternsData.patterns.length > 0) {
		lines.push([bold(t`✨ Detected Patterns`)]);
		lines.push([t``]);

		for (const pattern of patternsData.patterns.slice(0, 8)) {
			const emoji = getPatternEmoji(pattern.type);
			const confidence = (pattern.confidence * 100).toFixed(0);

			lines.push([
				t`${emoji} `,
				bold(t`${SEMANTIC.accent}${pattern.pattern}${COLORS.reset}`),
				dim(t` (${confidence}% confidence)`),
			]);

			lines.push([dim(t`   in ${pattern.symbol}`)]);
			lines.push([dim(t`   ${pattern.path}`)]);
			lines.push([t``]);
		}

		if (patternsData.patterns.length > 8) {
			lines.push([
				dim(t`  ... and ${patternsData.patterns.length - 8} more`),
			]);
			lines.push([t``]);
		}
	}

	// Anti-Patterns
	if (patternsData.antiPatterns.length > 0) {
		lines.push([bold(t`⚠️ Anti-Patterns Detected`)]);
		lines.push([t``]);

		for (const antiPattern of patternsData.antiPatterns.slice(0, 8)) {
			const emoji = getAntiPatternEmoji(antiPattern.severity);
			const color = getSeverityColor(antiPattern.severity);

			lines.push([
				t`${emoji} `,
				bold(t`${color}${antiPattern.antiPattern}${COLORS.reset}`),
				dim(t` (${antiPattern.severity})`),
			]);

			lines.push([dim(t`   in ${antiPattern.symbol}`)]);
			lines.push([dim(t`   ${antiPattern.description}`)]);
			lines.push([t``]);
		}

		if (patternsData.antiPatterns.length > 8) {
			lines.push([
				dim(t`  ... and ${patternsData.antiPatterns.length - 8} more`),
			]);
			lines.push([t``]);
		}
	}

	// Recommendations
	lines.push([bold(t`💡 Pattern Guidelines`)]);
	lines.push([
		dim(t`  • Good patterns indicate maintainable architecture`),
	]);
	lines.push([
		dim(t`  • Anti-patterns should be refactored when possible`),
	]);
	lines.push([dim(t`  • Check confidence scores for validation`)]);

	return (
		<box flexDirection="column" paddingTop={1}>
			{lines.map((line, i) => (
				<text key={i} content={s(...line)} />
			))}
		</box>
	);
}
