/**
 * pagerank.ts - PageRank алгоритм для определения популярности символов
 *
 * Вычисляет PageRank для символов кода на основе графа вызовов.
 * Символы с высоким PageRank:
 * - Часто вызываются другими функциями (много входящих связей)
 * - Вызываются важными функциями (высокий PageRank вызывающих)
 *
 * Используется для ранжирования результатов поиска.
 */

import { createLogger } from "../lib/logger.ts";
import {
	getAllGraphSymbols,
	getIncomingEdges,
	getOutgoingEdges,
} from "./graph-store.ts";

const log = createLogger("pagerank");

/**
 * Параметры алгоритма PageRank
 */
const DAMPING_FACTOR = 0.85; // Damping factor (d)
const MAX_ITERATIONS = 20; // Максимум итераций
const CONVERGENCE_THRESHOLD = 0.0001; // Порог сходимости

/**
 * Результат вычисления PageRank
 */
export interface PageRankResult {
	score: number;
	symbol: string;
}

/**
 * Граф для PageRank
 */
interface PageRankGraph {
	incomingEdges: Map<string, string[]>; // target -> [sources]
	nodes: Set<string>;
	outgoingCount: Map<string, number>; // source -> count
	outgoingEdges: Map<string, string[]>; // source -> [targets]
}

/**
 * Построить граф из результатов запросов
 */
async function buildPageRankGraph(): Promise<PageRankGraph> {
	const nodes = new Set<string>();
	const incomingEdges = new Map<string, string[]>();
	const outgoingEdges = new Map<string, string[]>();
	const outgoingCount = new Map<string, number>();

	// Получить все символы
	const allSymbols = await getAllGraphSymbols();

	if (allSymbols.length === 0) {
		log.warn("No symbols found in graph");
		return { nodes, incomingEdges, outgoingEdges, outgoingCount };
	}

	log.info(`Building PageRank graph for ${allSymbols.length} symbols`);

	// Для каждого символа получить его связи
	for (const symbol of allSymbols) {
		nodes.add(symbol);

		// Получить входящие связи (кто вызывает этот символ)
		const incoming = await getIncomingEdges(symbol, "calls");
		if (incoming.length > 0) {
			const sources = incoming.map((e) => e.source);
			incomingEdges.set(symbol, sources);

			// Добавить источники в nodes
			for (const source of sources) {
				nodes.add(source);
			}
		}

		// Получить исходящие связи (кого вызывает этот символ)
		const outgoing = await getOutgoingEdges(symbol, "calls");
		if (outgoing.length > 0) {
			const targets = outgoing.map((e) => e.target);
			outgoingEdges.set(symbol, targets);
			outgoingCount.set(symbol, targets.length);

			// Добавить цели в nodes
			for (const target of targets) {
				nodes.add(target);
			}
		}
	}

	log.info(
		`PageRank graph: ${nodes.size} nodes, ${incomingEdges.size} with incoming edges`
	);

	return { nodes, incomingEdges, outgoingEdges, outgoingCount };
}

/**
 * Вычислить PageRank для всех символов в графе
 *
 * @returns Map с символами и их PageRank scores
 */
export async function computePageRank(): Promise<Map<string, number>> {
	const startTime = Date.now();

	// Построить граф
	const graph = await buildPageRankGraph();

	if (graph.nodes.size === 0) {
		log.warn("Empty graph, returning empty PageRank");
		return new Map();
	}

	const numNodes = graph.nodes.size;
	const initialScore = 1.0 / numNodes;

	// Инициализировать scores
	const scores = new Map<string, number>();
	const newScores = new Map<string, number>();

	for (const node of graph.nodes) {
		scores.set(node, initialScore);
		newScores.set(node, 0);
	}

	// Итеративно вычислять PageRank
	let iteration = 0;
	let converged = false;

	while (iteration < MAX_ITERATIONS && !converged) {
		// Вычислить новые scores
		for (const node of graph.nodes) {
			let sum = 0;

			// Суммировать вклад от всех входящих узлов
			const incomingNodes = graph.incomingEdges.get(node) || [];
			for (const source of incomingNodes) {
				const sourceScore = scores.get(source) || 0;
				const sourceOutgoingCount = graph.outgoingCount.get(source) || 1;
				sum += sourceScore / sourceOutgoingCount;
			}

			// Формула PageRank: PR(A) = (1-d) / N + d * sum
			const newScore = (1 - DAMPING_FACTOR) / numNodes + DAMPING_FACTOR * sum;
			newScores.set(node, newScore);
		}

		// Проверить сходимость
		let maxDiff = 0;
		for (const node of graph.nodes) {
			const oldScore = scores.get(node) || 0;
			const newScore = newScores.get(node) || 0;
			const diff = Math.abs(newScore - oldScore);
			if (diff > maxDiff) {
				maxDiff = diff;
			}
		}

		if (maxDiff < CONVERGENCE_THRESHOLD) {
			converged = true;
		}

		// Копировать новые scores в текущие
		for (const node of graph.nodes) {
			scores.set(node, newScores.get(node) || 0);
		}

		iteration++;
	}

	const elapsed = Date.now() - startTime;
	log.info(`PageRank computed in ${iteration} iterations (${elapsed}ms)`);

	if (!converged) {
		log.warn("PageRank did not converge");
	}

	return scores;
}

/**
 * Получить топ N символов по PageRank
 */
export async function getTopPageRankSymbols(
	limit = 100
): Promise<PageRankResult[]> {
	const scores = await computePageRank();

	// Преобразовать в массив и отсортировать
	const results: PageRankResult[] = [];
	for (const [symbol, score] of scores) {
		results.push({ symbol, score });
	}

	results.sort((a, b) => b.score - a.score);

	return results.slice(0, limit);
}

/**
 * Получить PageRank score для конкретного символа
 */
export async function getSymbolPageRank(symbolName: string): Promise<number> {
	const scores = await computePageRank();
	return scores.get(symbolName) || 0;
}

/**
 * Нормализовать PageRank scores в диапазон [0, 1]
 */
export function normalizePageRankScores(
	scores: Map<string, number>
): Map<string, number> {
	if (scores.size === 0) {
		return scores;
	}

	// Найти мин и макс
	let min = Number.POSITIVE_INFINITY;
	let max = Number.NEGATIVE_INFINITY;

	for (const score of scores.values()) {
		if (score < min) {
			min = score;
		}
		if (score > max) {
			max = score;
		}
	}

	// Нормализовать
	const normalized = new Map<string, number>();
	const range = max - min;

	if (range === 0) {
		// Все scores одинаковые
		for (const [symbol] of scores) {
			normalized.set(symbol, 0.5);
		}
	} else {
		for (const [symbol, score] of scores) {
			normalized.set(symbol, (score - min) / range);
		}
	}

	return normalized;
}

// In-memory кэш PageRank (invalidate при добавлении новых chunks)
let pageRankCache: Map<string, number> | null = null;
let cacheTimestamp: number | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

/**
 * Получить кэшированный PageRank (или вычислить если кэш невалидный)
 */
export async function getCachedPageRank(): Promise<Map<string, number>> {
	const now = Date.now();

	if (pageRankCache && cacheTimestamp && now - cacheTimestamp < CACHE_TTL) {
		return pageRankCache;
	}

	// Перевычислить
	pageRankCache = await computePageRank();
	cacheTimestamp = now;

	return pageRankCache;
}

/**
 * Инвалидировать кэш PageRank
 */
export function invalidatePageRankCache(): void {
	pageRankCache = null;
	cacheTimestamp = null;
	log.info("PageRank cache invalidated");
}
