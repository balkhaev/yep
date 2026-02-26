// @ts-nocheck
/**
 * risk-analysis.ts - Предиктивная аналитика рисков багов
 *
 * Вычисляет bug risk score для символов кода на основе:
 * - Complexity (высокая сложность = выше риск)
 * - Change frequency (частые изменения = выше риск)
 * - Author churn (много авторов = выше риск)
 * - Line count (большой размер = выше риск)
 * - Test coverage (низкое покрытие = выше риск)
 * - Documentation (отсутствие документации = выше риск)
 */

import { createLogger } from "../lib/logger.ts";
import type { CodeResult } from "./code-store.ts";
import { calculateComplexity } from "./complexity.ts";

const log = createLogger("risk-analysis");

/**
 * Веса для bug risk scoring
 */
export const RISK_WEIGHTS = {
	complexity: 0.25, // High complexity = risk
	changeFrequency: 0.2, // Often changed = risk
	authorChurn: 0.15, // Many authors = risk
	lineCount: 0.15, // Large size = risk
	testCoverage: 0.15, // Low coverage = risk (если доступно)
	documentation: 0.1, // No docs = risk
} as const;

/**
 * Bug risk score для символа
 */
export interface BugRiskScore {
	// Component scores (0-1, higher = more risk)
	authorChurnScore: number;
	changeFrequencyScore: number;
	complexityScore: number;
	documentationScore: number;
	lineCountScore: number;
	riskLevel: "low" | "medium" | "high" | "critical";
	// Final risk score (0-100)
	score: number;
	testCoverageScore: number;
}

/**
 * Результат с risk score
 */
export interface CodeResultWithRisk {
	chunk: CodeResult;
	risk: BugRiskScore;
}

/**
 * Вычислить complexity score (0-1, higher = more risk)
 */
function computeComplexityRiskScore(body: string, summary: string): number {
	try {
		const result = calculateComplexity(body, summary);
		const complexity = result.cyclomatic;

		// Нелинейная шкала: exponential growth
		if (complexity <= 5) return 0.1; // Low risk
		if (complexity <= 10) return 0.3;
		if (complexity <= 15) return 0.5;
		if (complexity <= 20) return 0.7;
		if (complexity <= 30) return 0.9;
		return 1.0; // Critical risk
	} catch {
		return 0.5; // Unknown
	}
}

/**
 * Вычислить change frequency score (0-1, higher = more risk)
 */
function computeChangeFrequencyScore(gitChangeCount?: number): number {
	if (gitChangeCount === undefined || gitChangeCount === 0) {
		return 0.1; // No history = low risk assumption
	}

	// Нелинейная шкала: больше изменений = выше риск
	if (gitChangeCount <= 2) return 0.1;
	if (gitChangeCount <= 5) return 0.3;
	if (gitChangeCount <= 10) return 0.5;
	if (gitChangeCount <= 20) return 0.7;
	if (gitChangeCount <= 50) return 0.9;
	return 1.0; // Очень часто меняется
}

/**
 * Вычислить author churn score (0-1, higher = more risk)
 */
function computeAuthorChurnScore(gitAuthorCount?: number): number {
	if (gitAuthorCount === undefined || gitAuthorCount === 0) {
		return 0.1; // No history
	}

	// Больше авторов = выше риск коммуникации и непонимания
	if (gitAuthorCount === 1) return 0.1; // Single author
	if (gitAuthorCount === 2) return 0.3;
	if (gitAuthorCount === 3) return 0.5;
	if (gitAuthorCount <= 5) return 0.7;
	return 1.0; // Много авторов
}

/**
 * Вычислить line count score (0-1, higher = more risk)
 */
function computeLineCountScore(body: string): number {
	const lineCount = body.split("\n").length;

	// Больше строк = выше риск
	if (lineCount <= 50) return 0.1;
	if (lineCount <= 100) return 0.3;
	if (lineCount <= 200) return 0.5;
	if (lineCount <= 300) return 0.7;
	if (lineCount <= 500) return 0.9;
	return 1.0; // Очень большой файл
}

/**
 * Вычислить test coverage score (0-1, higher = more risk)
 *
 * NOTE: Требует интеграции с coverage tools (Фаза 13)
 * Пока возвращает 0.5 (unknown)
 */
function computeTestCoverageScore(
	_coveragePercent?: number
): number {
	// TODO: Implement in Phase 13 when coverage integration is done
	return 0.5; // Unknown coverage = medium risk
}

/**
 * Вычислить documentation score (0-1, higher = more risk)
 */
function computeDocumentationScore(chunk: CodeResult): number {
	// Проверяем наличие JSDoc/docstring в metadata
	try {
		if (chunk.metadata) {
			const metadata = JSON.parse(chunk.metadata);
			if (metadata.jsDoc || metadata.docstring) {
				return 0.1; // Has documentation
			}
		}
	} catch {
		// Ignore parse errors
	}

	// Fallback: проверяем summary
	if (chunk.summary && chunk.summary.length > 20) {
		return 0.3; // Has some description
	}

	return 1.0; // No documentation
}

/**
 * Вычислить bug risk score для символа
 */
export function computeBugRiskScore(
	chunk: CodeResult,
	testCoveragePercent?: number
): BugRiskScore {
	// Вычислить component scores
	const complexityScore = computeComplexityRiskScore(chunk.body, chunk.summary);
	const changeFrequencyScore = computeChangeFrequencyScore(
		chunk.gitChangeCount
	);
	const authorChurnScore = computeAuthorChurnScore(chunk.gitAuthorCount);
	const lineCountScore = computeLineCountScore(chunk.body);
	const testCoverageScore = computeTestCoverageScore(testCoveragePercent);
	const documentationScore = computeDocumentationScore(chunk);

	// Weighted average (0-1)
	const weightedScore =
		complexityScore * RISK_WEIGHTS.complexity +
		changeFrequencyScore * RISK_WEIGHTS.changeFrequency +
		authorChurnScore * RISK_WEIGHTS.authorChurn +
		lineCountScore * RISK_WEIGHTS.lineCount +
		testCoverageScore * RISK_WEIGHTS.testCoverage +
		documentationScore * RISK_WEIGHTS.documentation;

	// Конвертировать в 0-100 scale
	const score = weightedScore * 100;

	// Определить risk level
	let riskLevel: BugRiskScore["riskLevel"] = "low";
	if (score >= 80) {
		riskLevel = "critical";
	} else if (score >= 60) {
		riskLevel = "high";
	} else if (score >= 40) {
		riskLevel = "medium";
	}

	return {
		score,
		riskLevel,
		complexityScore,
		changeFrequencyScore,
		authorChurnScore,
		lineCountScore,
		testCoverageScore,
		documentationScore,
	};
}

/**
 * Найти top N символов с высоким bug risk
 */
export function findHighRiskSymbols(
	chunks: CodeResult[],
	limit = 20
): CodeResultWithRisk[] {
	const results: CodeResultWithRisk[] = [];

	for (const chunk of chunks) {
		const risk = computeBugRiskScore(chunk);
		results.push({ chunk, risk });
	}

	// Сортировать по risk score (высокий → низкий)
	results.sort((a, b) => b.risk.score - a.risk.score);

	return results.slice(0, limit);
}

/**
 * Форматировать risk score для отображения
 */
export function formatRiskScore(risk: BugRiskScore): string {
	const emoji =
		risk.riskLevel === "critical"
			? "🔴"
			: risk.riskLevel === "high"
				? "🟠"
				: risk.riskLevel === "medium"
					? "🟡"
					: "🟢";

	return `${emoji} ${risk.score.toFixed(0)}/100 (${risk.riskLevel})`;
}

/**
 * Получить top contributing factors для risk score
 */
export function getTopRiskFactors(risk: BugRiskScore): Array<{
	factor: string;
	score: number;
}> {
	const factors = [
		{ factor: "Complexity", score: risk.complexityScore },
		{ factor: "Change Frequency", score: risk.changeFrequencyScore },
		{ factor: "Author Churn", score: risk.authorChurnScore },
		{ factor: "Line Count", score: risk.lineCountScore },
		{ factor: "Test Coverage", score: risk.testCoverageScore },
		{ factor: "Documentation", score: risk.documentationScore },
	];

	// Сортировать по score (высокий → низкий)
	factors.sort((a, b) => b.score - a.score);

	// Вернуть топ 3
	return factors.slice(0, 3);
}

/**
 * Генерировать рекомендации по снижению риска
 */
export function generateRiskRecommendations(risk: BugRiskScore): string[] {
	const recommendations: string[] = [];

	if (risk.complexityScore > 0.7) {
		recommendations.push(
			"🔧 Refactor to reduce complexity - consider breaking into smaller functions"
		);
	}

	if (risk.changeFrequencyScore > 0.7) {
		recommendations.push(
			"🔒 High change frequency - add more tests to prevent regressions"
		);
	}

	if (risk.authorChurnScore > 0.7) {
		recommendations.push(
			"👥 Multiple authors - improve inline documentation and code comments"
		);
	}

	if (risk.lineCountScore > 0.7) {
		recommendations.push(
			"📏 Large file - consider splitting into multiple smaller modules"
		);
	}

	if (risk.testCoverageScore > 0.7) {
		recommendations.push(
			"✅ Add unit tests to increase confidence and reduce risk"
		);
	}

	if (risk.documentationScore > 0.7) {
		recommendations.push(
			"📝 Add JSDoc/docstrings to explain purpose and usage"
		);
	}

	return recommendations;
}

/**
 * Вычислить risk summary для всей кодовой базы
 */
export interface RiskSummary {
	avgRiskScore: number;
	criticalCount: number;
	highCount: number;
	lowCount: number;
	mediumCount: number;
	totalSymbols: number;
}

export function computeRiskSummary(
	riskySymbols: CodeResultWithRisk[]
): RiskSummary {
	let totalScore = 0;
	let criticalCount = 0;
	let highCount = 0;
	let mediumCount = 0;
	let lowCount = 0;

	for (const { risk } of riskySymbols) {
		totalScore += risk.score;

		switch (risk.riskLevel) {
			case "critical":
				criticalCount++;
				break;
			case "high":
				highCount++;
				break;
			case "medium":
				mediumCount++;
				break;
			case "low":
				lowCount++;
				break;
		}
	}

	return {
		totalSymbols: riskySymbols.length,
		avgRiskScore:
			riskySymbols.length > 0 ? totalScore / riskySymbols.length : 0,
		criticalCount,
		highCount,
		mediumCount,
		lowCount,
	};
}
