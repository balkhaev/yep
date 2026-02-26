// @ts-nocheck
import type { TextChunk } from "@opentui/core";
import { bold, dim, StyledText, t } from "@opentui/core";
import { useEffect, useState } from "react";
import { COLORS, SEMANTIC } from "../../theme";

interface RiskSymbol {
	symbol: string;
	path: string;
	riskLevel: "low" | "medium" | "high" | "critical";
	score: number;
	topFactors: Array<{ factor: string; score: number }>;
}

interface RiskData {
	highRiskSymbols: RiskSymbol[];
	summary: {
		totalSymbols: number;
		avgRiskScore: number;
		criticalCount: number;
		highCount: number;
		mediumCount: number;
		lowCount: number;
	};
}

function s(...chunks: TextChunk[]): StyledText {
	return new StyledText(chunks);
}

function getRiskEmoji(level: string): string {
	switch (level) {
		case "critical":
			return "🔴";
		case "high":
			return "🟠";
		case "medium":
			return "🟡";
		default:
			return "🟢";
	}
}

function getRiskColor(level: string): string {
	switch (level) {
		case "critical":
			return SEMANTIC.error;
		case "high":
			return SEMANTIC.warning;
		case "medium":
			return SEMANTIC.accent;
		default:
			return SEMANTIC.success;
	}
}

export default function RiskTab() {
	const [riskData, setRiskData] = useState<RiskData | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		// Load risk data from API
		fetch("/api/risk-analysis?limit=10")
			.then((res) => res.json())
			.then((data) => {
				setRiskData(data);
				setLoading(false);
			})
			.catch(() => {
				setLoading(false);
			});
	}, []);

	if (loading) {
		return (
			<box flexDirection="column" paddingTop={1}>
				<text content={s(dim("Loading risk analysis..."))} />
			</box>
		);
	}

	if (!riskData) {
		return (
			<box flexDirection="column" paddingTop={1}>
				<text content={s(dim("No risk data available"))} />
				<text content={s(dim("Run 'yep index-code' to analyze risks"))} />
			</box>
		);
	}

	const lines: TextChunk[][] = [];

	// Header
	lines.push([bold(t`🔴 Bug Risk Analysis`)]);
	lines.push([t``]); // Empty line

	// Summary
	lines.push([
		t`${SEMANTIC.accent}Total Symbols${COLORS.reset}: `,
		bold(t`${riskData.summary.totalSymbols}`),
	]);
	lines.push([
		t`${SEMANTIC.accent}Average Risk${COLORS.reset}: `,
		bold(t`${riskData.summary.avgRiskScore.toFixed(1)}/100`),
	]);
	lines.push([t``]);

	lines.push([
		t`${SEMANTIC.error}Critical${COLORS.reset}: ${riskData.summary.criticalCount}  `,
		t`${SEMANTIC.warning}High${COLORS.reset}: ${riskData.summary.highCount}  `,
		t`${SEMANTIC.accent}Medium${COLORS.reset}: ${riskData.summary.mediumCount}  `,
		t`${SEMANTIC.success}Low${COLORS.reset}: ${riskData.summary.lowCount}`,
	]);
	lines.push([t``]);

	// High Risk Symbols
	if (riskData.highRiskSymbols.length > 0) {
		lines.push([bold(t`Top Risk Symbols`)]);
		lines.push([t``]);

		for (const symbol of riskData.highRiskSymbols.slice(0, 8)) {
			const emoji = getRiskEmoji(symbol.riskLevel);
			const color = getRiskColor(symbol.riskLevel);

			lines.push([
				t`${emoji} `,
				bold(t`${color}${symbol.symbol}${COLORS.reset}`),
				t` ${color}(${symbol.score.toFixed(0)}/100)${COLORS.reset}`,
			]);

			lines.push([dim(t`   ${symbol.path}`)]);

			// Top factors
			const topFactor = symbol.topFactors[0];
			if (topFactor) {
				lines.push([
					dim(
						t`   Main issue: ${topFactor.factor} (${(topFactor.score * 100).toFixed(0)}%)`
					),
				]);
			}

			lines.push([t``]);
		}
	} else {
		lines.push([t`${SEMANTIC.success}✅ No high-risk symbols found${COLORS.reset}`]);
	}

	// Recommendations
	lines.push([bold(t`💡 Recommendations`)]);
	lines.push([
		dim(t`  • Focus on critical and high-risk symbols first`),
	]);
	lines.push([
		dim(t`  • Refactor complex functions (>15 cyclomatic)`),
	]);
	lines.push([dim(t`  • Add tests for frequently changed code`)]);
	lines.push([dim(t`  • Document code with multiple authors`)]);

	return (
		<box flexDirection="column" paddingTop={1}>
			{lines.map((line, i) => (
				<text key={i} content={s(...line)} />
			))}
		</box>
	);
}
