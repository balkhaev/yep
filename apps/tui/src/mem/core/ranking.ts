/**
 * ranking.ts - Multi-signal ranking для поиска кода
 *
 * Объединяет несколько сигналов для улучшения релевантности:
 * - Vector similarity (35%) - семантическое сходство
 * - FTS keyword match (20%) - полнотекстовый поиск
 * - Exact name match (15%) - точное совпадение имени
 * - PageRank popularity (15%) - популярность символа
 * - Recency/freshness (5%) - недавние изменения
 * - Complexity score (5%) - простота кода
 * - Context match (5%) - совпадение файла/директории
 */

import { createLogger } from "../lib/logger.ts";
import type { CodeResult } from "./code-store.ts";
import { calculateComplexity } from "./complexity.ts";
import { getCachedPageRank } from "./pagerank.ts";

const log = createLogger("ranking");

/**
 * Веса для сигналов ранжирования
 */
export const RANKING_WEIGHTS = {
	vectorScore: 0.35, // Семантическое сходство
	ftsScore: 0.2, // Полнотекстовый поиск
	exactMatch: 0.15, // Точное совпадение имени
	popularityScore: 0.15, // PageRank популярность
	freshnessScore: 0.05, // Свежесть (recency)
	complexityScore: 0.05, // Простота кода
	contextScore: 0.05, // Контекст файла/директории
} as const;

/**
 * Все сигналы для ранжирования
 */
export interface RankingSignals {
	complexityScore: number; // 0-1
	contextScore: number; // 0-1
	exactMatch: number; // 0 или 1
	freshnessScore: number; // 0-1
	ftsScore: number; // 0-1
	popularityScore: number; // 0-1
	vectorScore: number; // 0-1
}

/**
 * Результат с финальным score
 */
export interface RankedResult {
	chunk: CodeResult;
	finalScore: number;
	signals: RankingSignals;
}

/**
 * Контекст поиска для context-aware ranking
 */
export interface SearchContext {
	currentDirectory?: string;
	currentFile?: string;
	recentSymbols?: string[];
}

/**
 * Нормализовать score в диапазон [0, 1]
 */
function normalizeScore(score: number, min: number, max: number): number {
	if (max === min) {
		return 0.5;
	}
	return Math.max(0, Math.min(1, (score - min) / (max - min)));
}

/**
 * Вычислить exact match score
 */
function computeExactMatchScore(symbolName: string, query: string): number {
	const lowerSymbol = symbolName.toLowerCase();
	const lowerQuery = query.toLowerCase();

	// Точное совпадение
	if (lowerSymbol === lowerQuery) {
		return 1.0;
	}

	// Префикс совпадение
	if (lowerSymbol.startsWith(lowerQuery)) {
		return 0.8;
	}

	// Содержит как слово
	if (lowerSymbol.includes(lowerQuery)) {
		return 0.5;
	}

	// Camel case match (напр. "getData" matches "gd")
	const initials = symbolName.replace(/[a-z]/g, "").toLowerCase();
	if (initials === lowerQuery) {
		return 0.6;
	}

	return 0;
}

/**
 * Вычислить freshness score (новые изменения = выше score)
 */
function computeFreshnessScore(lastModified: string): number {
	try {
		const modifiedDate = new Date(lastModified);
		const now = new Date();
		const daysSinceModified =
			(now.getTime() - modifiedDate.getTime()) / (1000 * 60 * 60 * 24);

		// Экспоненциальный decay: свежие файлы (0-7 дней) = 1.0, старые (>90 дней) = 0.1
		if (daysSinceModified < 7) {
			return 1.0;
		}
		if (daysSinceModified < 30) {
			return 0.8;
		}
		if (daysSinceModified < 90) {
			return 0.5;
		}
		return 0.2;
	} catch {
		return 0.5; // Если не можем распарсить дату
	}
}

/**
 * Вычислить complexity score (простой код = выше score)
 */
function computeComplexityScore(body: string, summary: string): number {
	const result = calculateComplexity(body, summary);
	const complexity = result.cyclomatic;

	// Инвертировать: простой код (complexity < 5) = 1.0, сложный (> 20) = 0
	if (complexity <= 5) {
		return 1.0;
	}
	if (complexity <= 10) {
		return 0.8;
	}
	if (complexity <= 15) {
		return 0.5;
	}
	if (complexity <= 20) {
		return 0.3;
	}
	return 0.1;
}

/**
 * Вычислить context score (совпадение файла/директории)
 */
function computeContextScore(
	resultPath: string,
	context?: SearchContext
): number {
	if (!context) {
		return 0.5;
	}

	let score = 0;

	// Точное совпадение файла
	if (context.currentFile && resultPath === context.currentFile) {
		score += 1.0;
	}

	// Совпадение директории
	if (
		context.currentDirectory &&
		resultPath.includes(context.currentDirectory)
	) {
		score += 0.5;
	}

	// Недавно использованные символы (proximity)
	// (пока не реализовано, placeholder)

	return Math.min(1.0, score);
}

/**
 * Вычислить все сигналы ранжирования для результата
 */
export async function computeRankingSignals(
	chunk: CodeResult,
	query: string,
	vectorScore: number,
	ftsScore: number,
	context?: SearchContext
): Promise<RankingSignals> {
	// 1. Vector и FTS scores уже есть
	const normalizedVectorScore = normalizeScore(vectorScore, 0, 1);
	const normalizedFtsScore = normalizeScore(ftsScore, 0, 1);

	// 2. Exact match
	const exactMatch = computeExactMatchScore(chunk.symbol, query);

	// 3. PageRank popularity
	let popularityScore = 0.5;
	try {
		const pageRankScores = await getCachedPageRank();
		const rawScore = pageRankScores.get(chunk.symbol) || 0;

		// Нормализовать PageRank относительно всех scores
		const allScores = Array.from(pageRankScores.values());
		const minScore = Math.min(...allScores);
		const maxScore = Math.max(...allScores);
		popularityScore = normalizeScore(rawScore, minScore, maxScore);
	} catch (err) {
		log.warn("Failed to get PageRank scores", { error: err });
	}

	// 4. Freshness
	const freshnessScore = computeFreshnessScore(chunk.lastModified);

	// 5. Complexity (простота)
	const complexityScore = computeComplexityScore(chunk.body, chunk.summary);

	// 6. Context
	const contextScore = computeContextScore(chunk.path, context);

	return {
		vectorScore: normalizedVectorScore,
		ftsScore: normalizedFtsScore,
		exactMatch,
		popularityScore,
		freshnessScore,
		complexityScore,
		contextScore,
	};
}

/**
 * Вычислить финальный score из сигналов
 */
export function computeFinalScore(signals: RankingSignals): number {
	return (
		signals.vectorScore * RANKING_WEIGHTS.vectorScore +
		signals.ftsScore * RANKING_WEIGHTS.ftsScore +
		signals.exactMatch * RANKING_WEIGHTS.exactMatch +
		signals.popularityScore * RANKING_WEIGHTS.popularityScore +
		signals.freshnessScore * RANKING_WEIGHTS.freshnessScore +
		signals.complexityScore * RANKING_WEIGHTS.complexityScore +
		signals.contextScore * RANKING_WEIGHTS.contextScore
	);
}

/**
 * Rerank результатов поиска используя multi-signal ranking
 *
 * @param results - Исходные результаты с vector/fts scores
 * @param query - Поисковый запрос
 * @param context - Контекст поиска (опционально)
 * @returns Переранжированные результаты
 */
export async function rerankSearchResults(
	results: Array<{ chunk: CodeResult; score: number }>,
	query: string,
	context?: SearchContext
): Promise<RankedResult[]> {
	if (results.length === 0) {
		return [];
	}

	const startTime = Date.now();

	// Вычислить сигналы для каждого результата
	const rankedResults: RankedResult[] = [];

	for (const result of results) {
		// Разделить score на vector и fts компоненты (примерно)
		// В реальности нужно получать их отдельно из поиска
		const vectorScore = result.score * 0.7; // Предполагаем что 70% от score - vector
		const ftsScore = result.score * 0.3; // 30% - FTS

		const signals = await computeRankingSignals(
			result.chunk,
			query,
			vectorScore,
			ftsScore,
			context
		);

		const finalScore = computeFinalScore(signals);

		rankedResults.push({
			chunk: result.chunk,
			finalScore,
			signals,
		});
	}

	// Сортировать по финальному score
	rankedResults.sort((a, b) => b.finalScore - a.finalScore);

	const elapsed = Date.now() - startTime;
	log.info(`Reranked ${results.length} results in ${elapsed}ms`);

	return rankedResults;
}

/**
 * Форматировать сигналы для отладки
 */
export function formatSignals(signals: RankingSignals): string {
	return Object.entries(signals)
		.map(([key, value]) => `${key}: ${value.toFixed(3)}`)
		.join(", ");
}
