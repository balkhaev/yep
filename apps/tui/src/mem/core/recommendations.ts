import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { createOllama } from "ollama-ai-provider-v2";
import {
	getOllamaBaseUrl,
	getProvider,
	getSummarizerModel,
} from "../lib/config.ts";
import { createLogger } from "../lib/logger.ts";
import { withRetry } from "../lib/retry.ts";
import type { CodeInsights } from "./code-store.ts";

const log = createLogger("recommendations");

function computeInsightsHash(insights: CodeInsights): string {
	return `${insights.totalSymbols}:${insights.totalFiles}:${insights.avgComplexity}:${insights.documentationCoverage}:${insights.deadCode.length}:${insights.duplicateSymbolCount}`;
}

let cachedRecommendations: CodeRecommendation[] | null = null;
let cachedInsightsHash: string | null = null;

export function invalidateRecommendationsCache(): void {
	cachedRecommendations = null;
	cachedInsightsHash = null;
}

export type RecommendationCategory =
	| "complexity"
	| "duplication"
	| "dead-code"
	| "health"
	| "structure"
	| "architecture"
	| "modularization";

export interface CodeRecommendation {
	affectedSymbols: Array<{ path: string; symbol: string }>;
	category: RecommendationCategory;
	description: string;
	id: string;
	severity: "info" | "warning" | "critical";
	title: string;
}

function resolveModel() {
	const provider = getProvider();
	const modelName = getSummarizerModel();
	if (provider === "ollama") {
		const ollamaProvider = createOllama({ baseURL: getOllamaBaseUrl() });
		return ollamaProvider(modelName);
	}
	return openai(modelName);
}

function buildDeepSummary(insights: CodeInsights): string {
	const lines = [
		"=== CODEBASE OVERVIEW ===",
		`${insights.totalSymbols} symbols across ${insights.totalFiles} files in ${insights.languageDistribution.length} languages.`,
		`Average complexity: ${insights.avgComplexity}, documentation coverage: ${insights.documentationCoverage}%.`,
		`Avg symbols/file: ${insights.avgSymbolsPerFile}, median connections/symbol: ${insights.medianConnections}.`,
		`Dead code: ${insights.deadCode.length} symbols. Duplicates: ${insights.duplicateClusters.length} clusters (${insights.duplicateSymbolCount} symbols).`,
	];

	if (insights.topComplexSymbols.length > 0) {
		lines.push(
			"\n=== COMPLEXITY HOTSPOTS ===",
			...insights.topComplexSymbols
				.slice(0, 7)
				.map(
					(s) =>
						`- ${s.symbol} (cyclomatic: ${s.cyclomatic}, cognitive: ${s.cognitive}, ${s.lineCount} lines) @ ${s.path}`
				)
		);
	}

	if (insights.godSymbols.length > 0) {
		lines.push(
			"\n=== GOD OBJECTS (>3x median connections) ===",
			...insights.godSymbols
				.slice(0, 5)
				.map(
					(s) =>
						`- ${s.symbol} (${s.totalConnections} connections, ${s.symbolType}) @ ${s.path}`
				)
		);
	}

	if (insights.highFanInSymbols.length > 0) {
		lines.push(
			"\n=== HIGH FAN-IN (imported by many files) ===",
			...insights.highFanInSymbols
				.slice(0, 5)
				.map(
					(s) =>
						`- ${s.symbol}: ${s.importerCount} importers (${s.importerPercentage}% of files) @ ${s.path}`
				)
		);
	}

	if (insights.crossDirectoryImports.length > 0) {
		lines.push(
			"\n=== CROSS-MODULE COUPLING ===",
			...insights.crossDirectoryImports
				.slice(0, 8)
				.map((e) => `- ${e.from} → ${e.to}: ${e.count} imports`)
		);
	}

	if (insights.deadCode.length > 0) {
		lines.push(
			"\n=== DEAD CODE EXAMPLES ===",
			...insights.deadCode
				.slice(0, 5)
				.map((s) => `- ${s.symbol} (${s.symbolType}) @ ${s.path}`)
		);
	}

	if (insights.duplicateClusters.length > 0) {
		lines.push(
			"\n=== DUPLICATE CLUSTERS ===",
			...insights.duplicateClusters
				.slice(0, 3)
				.map(
					(c) =>
						`- [${c.symbols.map((s) => `${s.symbol}(${s.path})`).join(", ")}] similarity=${Math.round(c.similarity * 100)}%`
				)
		);
	}

	appendDirectoryAnalysis(lines, insights);
	appendOversizedSymbols(lines, insights);

	return lines.join("\n").slice(0, 4000);
}

function appendDirectoryAnalysis(lines: string[], insights: CodeInsights) {
	if (insights.directoryInsights.length === 0) {
		return;
	}

	const imbalanced = insights.directoryInsights.filter(
		(d) => d.symbolCount / insights.totalSymbols > 0.3
	);
	const lowDoc = insights.directoryInsights.filter(
		(d) => d.docCoverage < 20 && d.symbolCount > 5
	);
	const hotDirs = insights.directoryInsights.filter(
		(d) => d.avgComplexity > 10
	);

	lines.push(
		"\n=== DIRECTORY ANALYSIS ===",
		...insights.directoryInsights
			.slice(0, 8)
			.map(
				(d) =>
					`- ${d.directory}: ${d.symbolCount} symbols, complexity=${d.avgComplexity}, dead=${d.deadCodeCount}, doc=${d.docCoverage}%`
			)
	);

	if (imbalanced.length > 0) {
		lines.push(
			`Imbalanced modules: ${imbalanced.map((d) => `${d.directory} (${Math.round((d.symbolCount / insights.totalSymbols) * 100)}% of codebase)`).join(", ")}`
		);
	}
	if (lowDoc.length > 0) {
		lines.push(
			`Under-documented modules: ${lowDoc.map((d) => `${d.directory} (${d.docCoverage}%)`).join(", ")}`
		);
	}
	if (hotDirs.length > 0) {
		lines.push(
			`High-complexity modules: ${hotDirs.map((d) => `${d.directory} (avg=${d.avgComplexity})`).join(", ")}`
		);
	}
}

function appendOversizedSymbols(lines: string[], insights: CodeInsights) {
	if (insights.largestSymbols.length === 0) {
		return;
	}
	const oversized = insights.largestSymbols.filter((s) => s.lineCount > 100);
	if (oversized.length > 0) {
		lines.push(
			"\n=== OVERSIZED SYMBOLS (>100 lines) ===",
			...oversized
				.slice(0, 5)
				.map(
					(s) =>
						`- ${s.symbol} (${s.lineCount} lines, ${s.symbolType}) @ ${s.path}`
				)
		);
	}
}

const SYSTEM_PROMPT = `You are a senior software architect performing a deep codebase review. Analyze the provided metrics and produce 5-8 actionable recommendations ordered by impact.

Analyze these dimensions:
1. COMPLEXITY — functions/classes that are too complex, need decomposition
2. ARCHITECTURE — god objects, high fan-in creating coupling bottlenecks, circular cross-module dependencies
3. MODULARIZATION — imbalanced modules, files that should be split, poor directory structure
4. DUPLICATION — similar code clusters that should be unified
5. DEAD CODE — unused symbols adding maintenance cost
6. HEALTH — documentation gaps (especially on complex code), naming, test coverage signals
7. STRUCTURE — oversized files, poor separation of concerns

For each recommendation, output a JSON object:
- "severity": "critical" | "warning" | "info"
- "category": "complexity" | "architecture" | "modularization" | "duplication" | "dead-code" | "health" | "structure"
- "title": concise title (under 60 chars)
- "description": 2-3 sentences with specific, actionable advice referencing concrete symbols/paths
- "affectedSymbols": array of {"symbol": "name", "path": "file/path"} (up to 5)

Prioritize: critical architectural issues > complexity hotspots > coupling risks > code hygiene.
Output ONLY a valid JSON array, no markdown or extra text.`;

export async function generateRecommendations(
	insights: CodeInsights,
	force = false
): Promise<CodeRecommendation[]> {
	const hash = computeInsightsHash(insights);

	if (!force && cachedRecommendations && cachedInsightsHash === hash) {
		return cachedRecommendations;
	}

	const summary = buildDeepSummary(insights);

	try {
		const raw = await withRetry(
			async () => {
				const { text } = await generateText({
					model: resolveModel(),
					maxOutputTokens: 2000,
					temperature: 0.1,
					system: SYSTEM_PROMPT,
					prompt: summary,
				});
				return text.trim();
			},
			{
				attempts: 2,
				onRetry: (err, attempt) => {
					log.warn(`Recommendations retry ${attempt}`, {
						error: err instanceof Error ? err.message : String(err),
					});
				},
			}
		);

		const recs = parseRecommendations(raw);
		cachedRecommendations = recs;
		cachedInsightsHash = hash;
		return recs;
	} catch (err) {
		log.warn("LLM recommendations failed, using rule-based fallback", {
			error: err instanceof Error ? err.message : String(err),
		});
		const recs = buildFallbackRecommendations(insights);
		cachedRecommendations = recs;
		cachedInsightsHash = hash;
		return recs;
	}
}

const JSON_ARRAY_RE = /\[[\s\S]*\]/;

function parseRecommendations(raw: string): CodeRecommendation[] {
	const jsonMatch = raw.match(JSON_ARRAY_RE);
	if (!jsonMatch) {
		return [];
	}

	const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>[];
	return parsed.slice(0, 8).map((item, i) => ({
		id: `rec-${i}`,
		severity: validateSeverity(item.severity),
		category: validateCategory(item.category),
		title: String(item.title ?? "Recommendation"),
		description: String(item.description ?? ""),
		affectedSymbols: Array.isArray(item.affectedSymbols)
			? (item.affectedSymbols as Array<{ symbol: string; path: string }>).slice(
					0,
					5
				)
			: [],
	}));
}

function validateSeverity(v: unknown): "info" | "warning" | "critical" {
	if (v === "critical" || v === "warning" || v === "info") {
		return v;
	}
	return "info";
}

function validateCategory(v: unknown): RecommendationCategory {
	const valid = new Set<RecommendationCategory>([
		"complexity",
		"duplication",
		"dead-code",
		"health",
		"structure",
		"architecture",
		"modularization",
	]);
	return valid.has(v as RecommendationCategory)
		? (v as RecommendationCategory)
		: "health";
}

// --- Fallback rule functions (one per analysis dimension) ---

type FallbackRule = (insights: CodeInsights) => CodeRecommendation | null;

const ruleGodObjects: FallbackRule = (insights) => {
	const top = insights.godSymbols[0];
	if (!top) {
		return null;
	}
	const ratio = Math.round(
		top.totalConnections / Math.max(insights.medianConnections, 1)
	);
	return {
		id: "rec-god-object",
		severity: insights.godSymbols.length > 3 ? "critical" : "warning",
		category: "architecture",
		title: "Break apart god objects",
		description: `${top.symbol} has ${top.totalConnections} connections (${ratio}x median). Split into smaller, focused modules with clear interfaces.`,
		affectedSymbols: insights.godSymbols
			.slice(0, 5)
			.map((s) => ({ symbol: s.symbol, path: s.path })),
	};
};

const ruleFanIn: FallbackRule = (insights) => {
	const top = insights.highFanInSymbols[0];
	if (!top) {
		return null;
	}
	return {
		id: "rec-fan-in",
		severity: top.importerPercentage > 50 ? "critical" : "warning",
		category: "architecture",
		title: "Reduce coupling on high fan-in symbols",
		description: `${top.symbol} is imported by ${top.importerCount} files (${top.importerPercentage}% of codebase). Introduce an abstraction layer or split responsibilities.`,
		affectedSymbols: insights.highFanInSymbols
			.slice(0, 3)
			.map((s) => ({ symbol: s.symbol, path: s.path })),
	};
};

const ruleCoupling: FallbackRule = (insights) => {
	const top = insights.crossDirectoryImports[0];
	if (!top || top.count <= 10) {
		return null;
	}
	return {
		id: "rec-coupling",
		severity: top.count > 20 ? "warning" : "info",
		category: "architecture",
		title: "Decouple tightly linked modules",
		description: `${top.from} → ${top.to} has ${top.count} cross-module imports. Extract a shared interface or consolidate related logic.`,
		affectedSymbols: [],
	};
};

const ruleComplexity: FallbackRule = (insights) => {
	const top = insights.topComplexSymbols[0];
	if (!top || top.cyclomatic <= 15) {
		return null;
	}
	return {
		id: "rec-complexity",
		severity: top.cyclomatic > 25 ? "critical" : "warning",
		category: "complexity",
		title: "Reduce complexity in hot symbols",
		description: `${top.symbol} has cyclomatic complexity of ${top.cyclomatic} and cognitive of ${top.cognitive}. Extract helpers, use early returns, and simplify conditionals.`,
		affectedSymbols: insights.topComplexSymbols
			.slice(0, 5)
			.map((s) => ({ symbol: s.symbol, path: s.path })),
	};
};

const ruleImbalance: FallbackRule = (insights) => {
	const total = Math.max(insights.totalSymbols, 1);
	const dir = insights.directoryInsights.find(
		(d) => d.symbolCount / total > 0.4
	);
	if (!dir) {
		return null;
	}
	const pct = Math.round((dir.symbolCount / total) * 100);
	return {
		id: "rec-imbalance",
		severity: pct > 50 ? "warning" : "info",
		category: "modularization",
		title: "Rebalance oversized module",
		description: `${dir.directory} contains ${pct}% of all symbols (${dir.symbolCount}/${insights.totalSymbols}). Split by responsibility into sub-modules.`,
		affectedSymbols: [],
	};
};

const ruleGodFiles: FallbackRule = (insights) => {
	const avg = insights.avgSymbolsPerFile;
	const top = insights.hotFiles.find(
		(f) => f.symbolCount > avg * 3 && f.symbolCount > 10
	);
	if (!top) {
		return null;
	}
	return {
		id: "rec-god-file",
		severity: top.symbolCount > avg * 5 ? "warning" : "info",
		category: "modularization",
		title: "Split oversized files",
		description: `${top.path} has ${top.symbolCount} symbols (${Math.round(top.symbolCount / avg)}x average). Extract related groups into dedicated files.`,
		affectedSymbols: insights.hotFiles
			.filter((f) => f.symbolCount > avg * 3 && f.symbolCount > 10)
			.slice(0, 3)
			.map((f) => ({ symbol: f.path, path: f.path })),
	};
};

const ruleDeadCode: FallbackRule = (insights) => {
	if (insights.deadCode.length <= 10) {
		return null;
	}
	return {
		id: "rec-dead-code",
		severity: insights.deadCode.length > 30 ? "warning" : "info",
		category: "dead-code",
		title: "Remove unused code",
		description: `Found ${insights.deadCode.length} potentially unused symbols. Audit and remove symbols with no callers or importers.`,
		affectedSymbols: insights.deadCode
			.slice(0, 5)
			.map((s) => ({ symbol: s.symbol, path: s.path })),
	};
};

const ruleDuplication: FallbackRule = (insights) => {
	if (insights.duplicateClusters.length === 0) {
		return null;
	}
	return {
		id: "rec-duplication",
		severity: insights.duplicateSymbolCount > 10 ? "warning" : "info",
		category: "duplication",
		title: "Consolidate duplicated logic",
		description: `Found ${insights.duplicateClusters.length} clusters of similar code (${insights.duplicateSymbolCount} symbols). Extract shared utilities.`,
		affectedSymbols: (insights.duplicateClusters[0]?.symbols ?? [])
			.slice(0, 5)
			.map((s) => ({ symbol: s.symbol, path: s.path })),
	};
};

const ruleDocumentation: FallbackRule = (insights) => {
	if (insights.documentationCoverage >= 30) {
		return null;
	}
	const undocComplex = insights.topComplexSymbols.filter(
		(s) => s.cyclomatic > 10
	);
	if (undocComplex.length > 3) {
		return {
			id: "rec-undoc-complex",
			severity: "warning",
			category: "health",
			title: "Document complex symbols",
			description: `${undocComplex.length} high-complexity symbols lack documentation (coverage: ${insights.documentationCoverage}%). Add JSDoc explaining intent and edge cases.`,
			affectedSymbols: undocComplex
				.slice(0, 5)
				.map((s) => ({ symbol: s.symbol, path: s.path })),
		};
	}
	return {
		id: "rec-docs",
		severity: insights.documentationCoverage < 10 ? "warning" : "info",
		category: "health",
		title: "Improve documentation coverage",
		description: `Only ${insights.documentationCoverage}% of symbols have documentation. Prioritize public APIs and complex functions.`,
		affectedSymbols: [],
	};
};

const ruleOversized: FallbackRule = (insights) => {
	const top = insights.largestSymbols.find((s) => s.lineCount > 150);
	if (!top) {
		return null;
	}
	return {
		id: "rec-oversized",
		severity: top.lineCount > 300 ? "warning" : "info",
		category: "structure",
		title: "Refactor oversized symbols",
		description: `${top.symbol} spans ${top.lineCount} lines. Extract logical sections into focused helpers with clear names.`,
		affectedSymbols: insights.largestSymbols
			.filter((s) => s.lineCount > 150)
			.slice(0, 3)
			.map((s) => ({ symbol: s.symbol, path: s.path })),
	};
};

const FALLBACK_RULES: FallbackRule[] = [
	ruleGodObjects,
	ruleFanIn,
	ruleCoupling,
	ruleComplexity,
	ruleImbalance,
	ruleGodFiles,
	ruleDeadCode,
	ruleDuplication,
	ruleDocumentation,
	ruleOversized,
];

function buildFallbackRecommendations(
	insights: CodeInsights
): CodeRecommendation[] {
	const recs: CodeRecommendation[] = [];
	for (const rule of FALLBACK_RULES) {
		const rec = rule(insights);
		if (rec) {
			recs.push(rec);
		}
	}

	if (recs.length === 0) {
		recs.push({
			id: "rec-healthy",
			severity: "info",
			category: "health",
			title: "Codebase is in good shape",
			description:
				"No critical issues detected. Keep maintaining current quality standards.",
			affectedSymbols: [],
		});
	}

	return recs;
}
