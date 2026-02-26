// @ts-nocheck
import type { TextChunk } from "@opentui/core";
import { bold, dim, StyledText, t } from "@opentui/core";
import { useEffect, useState } from "react";
import { COLORS, SEMANTIC } from "../../theme";

interface TrendsData {
	healthScore: {
		current: number;
		change: number;
		trend: "improving" | "degrading" | "stable" | "volatile";
	};
	avgComplexity: {
		current: number;
		change: number;
		trend: "improving" | "degrading" | "stable" | "volatile";
	};
	documentationCoverage: {
		current: number;
		change: number;
		trend: "improving" | "degrading" | "stable" | "volatile";
	};
	deadCodeCount: {
		current: number;
		change: number;
		trend: "improving" | "degrading" | "stable" | "volatile";
	};
	period: string;
	recommendations: string[];
	anomalies: string[];
}

function s(...chunks: TextChunk[]): StyledText {
	return new StyledText(chunks);
}

function getTrendEmoji(trend: string): string {
	switch (trend) {
		case "improving":
			return "📈";
		case "degrading":
			return "📉";
		case "volatile":
			return "📊";
		default:
			return "➖";
	}
}

function getTrendColor(trend: string, isHigherBetter: boolean): string {
	if (trend === "improving") {
		return SEMANTIC.success;
	}
	if (trend === "degrading") {
		return SEMANTIC.error;
	}
	if (trend === "volatile") {
		return SEMANTIC.warning;
	}
	return COLORS.dim;
}

function formatChange(change: number): string {
	const sign = change >= 0 ? "+" : "";
	return `${sign}${change.toFixed(1)}%`;
}

export default function TrendsTab() {
	const [trends, setTrends] = useState<TrendsData | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		// Load trends from API
		fetch("/api/trends?days=30")
			.then((res) => res.json())
			.then((data) => {
				setTrends(data);
				setLoading(false);
			})
			.catch(() => {
				setLoading(false);
			});
	}, []);

	if (loading) {
		return (
			<box flexDirection="column" paddingTop={1}>
				<text content={s(dim("Loading trends..."))} />
			</box>
		);
	}

	if (!trends) {
		return (
			<box flexDirection="column" paddingTop={1}>
				<text content={s(dim("No trends data available"))} />
				<text content={s(dim("Run 'yep index-code' to capture metrics"))} />
			</box>
		);
	}

	const lines: TextChunk[][] = [];

	// Header
	lines.push([bold(t`📊 Code Quality Trends (${trends.period})`)]);
	lines.push([t``]); // Empty line

	// Health Score
	const healthEmoji = getTrendEmoji(trends.healthScore.trend);
	const healthColor = getTrendColor(trends.healthScore.trend, true);
	lines.push([
		t`${SEMANTIC.accent}Health Score${COLORS.reset}: ${healthEmoji} `,
		bold(t`${trends.healthScore.current.toFixed(0)}/100`),
		t` ${healthColor}(${formatChange(trends.healthScore.change)})${COLORS.reset}`,
	]);

	// Complexity
	const complexityEmoji = getTrendEmoji(trends.avgComplexity.trend);
	const complexityColor = getTrendColor(trends.avgComplexity.trend, false);
	lines.push([
		t`${SEMANTIC.accent}Complexity${COLORS.reset}: ${complexityEmoji} `,
		bold(t`${trends.avgComplexity.current.toFixed(2)}`),
		t` ${complexityColor}(${formatChange(trends.avgComplexity.change)})${COLORS.reset}`,
	]);

	// Documentation
	const docEmoji = getTrendEmoji(trends.documentationCoverage.trend);
	const docColor = getTrendColor(trends.documentationCoverage.trend, true);
	const docPercent = (trends.documentationCoverage.current * 100).toFixed(0);
	lines.push([
		t`${SEMANTIC.accent}Documentation${COLORS.reset}: ${docEmoji} `,
		bold(t`${docPercent}%`),
		t` ${docColor}(${formatChange(trends.documentationCoverage.change)})${COLORS.reset}`,
	]);

	// Dead Code
	const deadCodeEmoji = getTrendEmoji(trends.deadCodeCount.trend);
	const deadCodeColor = getTrendColor(trends.deadCodeCount.trend, false);
	lines.push([
		t`${SEMANTIC.accent}Dead Code${COLORS.reset}: ${deadCodeEmoji} `,
		bold(t`${trends.deadCodeCount.current.toFixed(0)} symbols`),
		t` ${deadCodeColor}(${formatChange(trends.deadCodeCount.change)})${COLORS.reset}`,
	]);

	lines.push([t``]); // Empty line

	// Recommendations
	if (trends.recommendations.length > 0) {
		lines.push([bold(t`💡 Recommendations`)]);
		for (const rec of trends.recommendations.slice(0, 5)) {
			lines.push([dim(t`  ${rec}`)]);
		}
		lines.push([t``]);
	}

	// Anomalies
	if (trends.anomalies.length > 0) {
		lines.push([bold(t`${SEMANTIC.warning}⚠️ Anomalies${COLORS.reset}`)]);
		for (const anomaly of trends.anomalies.slice(0, 3)) {
			lines.push([dim(t`  ${anomaly}`)]);
		}
	}

	return (
		<box flexDirection="column" paddingTop={1}>
			{lines.map((line, i) => (
				<text key={i} content={s(...line)} />
			))}
		</box>
	);
}
