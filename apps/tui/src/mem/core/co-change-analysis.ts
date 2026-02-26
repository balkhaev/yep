// @ts-nocheck
/**
 * co-change-analysis.ts - Анализ файлов меняющихся вместе
 *
 * Анализирует git историю для определения:
 * - Какие файлы часто меняются вместе (co-change patterns)
 * - Coupling между модулями (если A меняется, B тоже меняется)
 * - Рекомендации: "если меняешь A, проверь B"
 *
 * Используется для:
 * - Обнаружения скрытых зависимостей
 * - Рекомендаций при code review
 * - Определения тестовых приоритетов
 */

import { createLogger } from "../lib/logger.ts";

const log = createLogger("co-change");

/**
 * Co-change пара файлов
 */
export interface CoChangePair {
	changeCount: number; // Количество раз когда оба менялись вместе
	confidence: number; // 0-1, насколько часто B меняется когда меняется A
	file1: string;
	file2: string;
	recentCommits: string[]; // Последние коммиты где оба менялись
	support: number; // 0-1, процент коммитов где оба файла менялись
}

/**
 * Результат co-change analysis
 */
export interface CoChangeReport {
	pairs: CoChangePair[];
	totalCommits: number;
}

/**
 * Извлечь историю изменений файлов из git
 *
 * @param daysBack - Количество дней назад для анализа
 * @returns Map commit hash → список изменённых файлов
 */
async function extractGitChangeHistory(
	daysBack = 90
): Promise<Map<string, string[]>> {
	try {
		const since = new Date();
		since.setDate(since.getDate() - daysBack);
		const sinceDate = since.toISOString().split("T")[0];

		// git log --name-only --pretty=format:%H --since=DATE
		const proc = Bun.spawn(
			[
				"git",
				"log",
				"--name-only",
				`--pretty=format:%H`,
				`--since=${sinceDate}`,
			],
			{
				stdout: "pipe",
				stderr: "pipe",
				cwd: process.cwd(),
			}
		);

		const output = await new Response(proc.stdout).text();
		const exitCode = await proc.exited;

		if (exitCode !== 0 || !output.trim()) {
			log.warn("Failed to get git change history");
			return new Map();
		}

		// Парсинг результата
		const lines = output.trim().split("\n");
		const history = new Map<string, string[]>();

		let currentCommit = "";
		const currentFiles: string[] = [];

		for (const line of lines) {
			const trimmed = line.trim();

			if (!trimmed) {
				// Пустая строка = разделитель между коммитами
				if (currentCommit && currentFiles.length > 0) {
					history.set(currentCommit, [...currentFiles]);
				}
				currentFiles.length = 0;
				continue;
			}

			// Если строка выглядит как hash (40 символов hex)
			if (/^[0-9a-f]{40}$/i.test(trimmed)) {
				currentCommit = trimmed;
			} else {
				// Это файл
				currentFiles.push(trimmed);
			}
		}

		// Добавить последний коммит
		if (currentCommit && currentFiles.length > 0) {
			history.set(currentCommit, [...currentFiles]);
		}

		log.info(`Extracted ${history.size} commits from git history`);
		return history;
	} catch (err) {
		log.error("Failed to extract git change history", { error: err });
		return new Map();
	}
}

/**
 * Построить co-change matrix из git истории
 */
function buildCoChangeMatrix(
	history: Map<string, string[]>
): Map<string, Map<string, { changeCount: number; commits: string[] }>> {
	const matrix = new Map<
		string,
		Map<string, { changeCount: number; commits: string[] }>
	>();

	// Для каждого коммита
	for (const [commit, files] of history) {
		// Пропускаем коммиты с одним файлом
		if (files.length < 2) {
			continue;
		}

		// Для каждой пары файлов в коммите
		for (let i = 0; i < files.length; i++) {
			const file1 = files[i];

			for (let j = i + 1; j < files.length; j++) {
				const file2 = files[j];

				// Нормализовать порядок (file1 < file2)
				const [f1, f2] = file1 < file2 ? [file1, file2] : [file2, file1];

				// Обновить matrix
				if (!matrix.has(f1)) {
					matrix.set(f1, new Map());
				}

				const file1Map = matrix.get(f1)!;
				if (!file1Map.has(f2)) {
					file1Map.set(f2, { changeCount: 0, commits: [] });
				}

				const entry = file1Map.get(f2)!;
				entry.changeCount++;
				entry.commits.push(commit);
			}
		}
	}

	return matrix;
}

/**
 * Вычислить support и confidence для co-change pairs
 */
function computeCoChangePairs(
	matrix: Map<string, Map<string, { changeCount: number; commits: string[] }>>,
	history: Map<string, string[]>,
	minSupport = 0.01, // 1% коммитов
	minConfidence = 0.3 // 30% вероятность
): CoChangePair[] {
	const pairs: CoChangePair[] = [];
	const totalCommits = history.size;

	// Подсчитать сколько раз каждый файл менялся
	const fileChangeCounts = new Map<string, number>();
	for (const files of history.values()) {
		for (const file of files) {
			fileChangeCounts.set(file, (fileChangeCounts.get(file) || 0) + 1);
		}
	}

	// Для каждой пары в matrix
	for (const [file1, file1Map] of matrix) {
		for (const [file2, entry] of file1Map) {
			const changeCount = entry.changeCount;

			// Support: процент коммитов где оба файла менялись
			const support = changeCount / totalCommits;

			if (support < minSupport) {
				continue;
			}

			// Confidence: P(file2 changes | file1 changes)
			const file1Changes = fileChangeCounts.get(file1) || 1;
			const confidence = changeCount / file1Changes;

			if (confidence < minConfidence) {
				continue;
			}

			pairs.push({
				file1,
				file2,
				changeCount,
				support,
				confidence,
				recentCommits: entry.commits.slice(0, 5), // Последние 5
			});
		}
	}

	// Сортировать по confidence (высокий → низкий)
	pairs.sort((a, b) => b.confidence - a.confidence);

	return pairs;
}

/**
 * Выполнить co-change analysis
 *
 * @param daysBack - Количество дней истории для анализа
 * @param minSupport - Минимальный support (0-1)
 * @param minConfidence - Минимальная confidence (0-1)
 * @returns Co-change report
 */
export async function analyzeCoChange(
	daysBack = 90,
	minSupport = 0.01,
	minConfidence = 0.3
): Promise<CoChangeReport> {
	log.info(`Analyzing co-change patterns (${daysBack} days)`);

	// 1. Извлечь git историю
	const history = await extractGitChangeHistory(daysBack);

	if (history.size === 0) {
		return { totalCommits: 0, pairs: [] };
	}

	// 2. Построить co-change matrix
	const matrix = buildCoChangeMatrix(history);

	// 3. Вычислить pairs с support/confidence
	const pairs = computeCoChangePairs(matrix, history, minSupport, minConfidence);

	log.info(`Found ${pairs.length} co-change pairs`);

	return {
		totalCommits: history.size,
		pairs,
	};
}

/**
 * Найти files связанные с данным файлом
 *
 * @param targetFile - Целевой файл
 * @param report - Co-change report
 * @returns Список связанных файлов
 */
export function getRelatedFiles(
	targetFile: string,
	report: CoChangeReport
): Array<{
	confidence: number;
	file: string;
}> {
	const related: Array<{ file: string; confidence: number }> = [];

	for (const pair of report.pairs) {
		if (pair.file1 === targetFile) {
			related.push({ file: pair.file2, confidence: pair.confidence });
		} else if (pair.file2 === targetFile) {
			related.push({ file: pair.file1, confidence: pair.confidence });
		}
	}

	// Сортировать по confidence
	related.sort((a, b) => b.confidence - a.confidence);

	return related;
}

/**
 * Форматировать co-change pair для отображения
 */
export function formatCoChangePair(pair: CoChangePair): string {
	const confidencePercent = (pair.confidence * 100).toFixed(0);
	return `${pair.file1} ↔ ${pair.file2} (${confidencePercent}% confidence, ${pair.changeCount} times)`;
}

/**
 * Генерировать рекомендации на основе co-change analysis
 */
export function generateCoChangeRecommendations(
	file: string,
	report: CoChangeReport,
	topN = 3
): string[] {
	const related = getRelatedFiles(file, report);

	if (related.length === 0) {
		return [];
	}

	const recommendations: string[] = [];

	for (const { file: relatedFile, confidence } of related.slice(0, topN)) {
		const confidencePercent = (confidence * 100).toFixed(0);
		recommendations.push(
			`⚠️ ${confidencePercent}% of the time, changes to this file also affect ${relatedFile}`
		);
	}

	return recommendations;
}
