// @ts-nocheck
/**
 * metrics-store.ts - Persistent snapshots метрик кода
 *
 * Сохраняет снапшоты CodeInsights для отслеживания трендов:
 * - Complexity trends (улучшается или ухудшается)
 * - Documentation coverage trends
 * - Dead code trends
 * - Health score (0-100)
 *
 * Используется для:
 * - Визуализации трендов в UI
 * - Предиктивной аналитики
 * - Мониторинга качества кода
 */

import type { Table } from "@lancedb/lancedb";
import { createLogger } from "../lib/logger.ts";
import type { CodeInsights } from "./code-store.ts";
import { getConnection } from "./store.ts";

const log = createLogger("metrics-store");

const METRICS_TABLE = "code_metrics";

/**
 * Снапшот метрик кода
 */
export interface MetricsSnapshot {
	// Meta
	commit: string;
	id: string; // timestamp:commit
	timestamp: string; // ISO string

	// Global metrics
	avgComplexity: number;
	avgSymbolsPerFile: number;
	deadCodeCount: number;
	documentationCoverage: number; // 0-1
	duplicateSymbolCount: number;
	totalFiles: number;
	totalSymbols: number;

	// Top issues (JSON strings)
	topComplexSymbols: string; // Array<{symbol, cyclomatic, path}>
	godSymbols: string; // Array<{symbol, totalConnections, path}>

	// Health score (computed)
	healthScore: number; // 0-100

	// Trend indicators (computed from previous snapshot)
	complexityTrend?: "up" | "down" | "stable";
	docCoverageTrend?: "up" | "down" | "stable";
	deadCodeTrend?: "up" | "down" | "stable";
}

let metricsTableExistsCache: boolean | null = null;
let metricsTablePromise: Promise<Table> | null = null;

/**
 * Получить таблицу метрик (с кэшированием)
 */
async function getMetricsTable(): Promise<Table> {
	if (metricsTablePromise) {
		return metricsTablePromise;
	}

	metricsTablePromise = (async () => {
		const db = await getConnection();
		return db.openTable(METRICS_TABLE);
	})();

	return metricsTablePromise;
}

/**
 * Проверить существование таблицы метрик
 */
export async function metricsTableExists(): Promise<boolean> {
	if (metricsTableExistsCache !== null) {
		return metricsTableExistsCache;
	}

	try {
		const db = await getConnection();
		const tables = await db.tableNames();
		metricsTableExistsCache = tables.includes(METRICS_TABLE);
		return metricsTableExistsCache;
	} catch (err) {
		log.error("Failed to check metrics table existence", { error: err });
		return false;
	}
}

/**
 * Инициализировать таблицу метрик
 */
export async function initMetricsStore(): Promise<void> {
	if (await metricsTableExists()) {
		log.info("Metrics table already exists");
		return;
	}

	try {
		const db = await getConnection();

		// Создать пустую таблицу с схемой (включая все опциональные поля)
		const emptyData: MetricsSnapshot[] = [
			{
				id: "init",
				timestamp: new Date().toISOString(),
				commit: "init",
				totalSymbols: 0,
				totalFiles: 0,
				avgComplexity: 0,
				avgSymbolsPerFile: 0,
				documentationCoverage: 0,
				deadCodeCount: 0,
				duplicateSymbolCount: 0,
				topComplexSymbols: "[]",
				godSymbols: "[]",
				healthScore: 0,
				complexityTrend: "stable",
				deadCodeTrend: "stable",
				docCoverageTrend: "stable",
			},
		];

		await db.createTable(METRICS_TABLE, emptyData);

		// Удалить инициализационную запись
		const table = await db.openTable(METRICS_TABLE);
		await table.delete("id = 'init'");

		metricsTableExistsCache = true;
		metricsTablePromise = null;

		log.info("Metrics table initialized");
	} catch (err) {
		log.error("Failed to initialize metrics table", { error: err });
		throw err;
	}
}

/**
 * Вычислить health score (0-100) на основе метрик
 */
function computeHealthScore(insights: CodeInsights): number {
	let score = 100;

	// Complexity penalty (max -30)
	if (insights.avgComplexity > 15) {
		score -= 30;
	} else if (insights.avgComplexity > 10) {
		score -= 20;
	} else if (insights.avgComplexity > 7) {
		score -= 10;
	}

	// Documentation penalty (max -25)
	const docCoverage = insights.documentationCoverage;
	if (docCoverage < 0.3) {
		score -= 25;
	} else if (docCoverage < 0.5) {
		score -= 15;
	} else if (docCoverage < 0.7) {
		score -= 5;
	}

	// Dead code penalty (max -20)
	const deadCodeRatio = insights.deadCode.length / insights.totalSymbols;
	if (deadCodeRatio > 0.1) {
		score -= 20;
	} else if (deadCodeRatio > 0.05) {
		score -= 10;
	}

	// Duplicate code penalty (max -15)
	const duplicateRatio = insights.duplicateSymbolCount / insights.totalSymbols;
	if (duplicateRatio > 0.1) {
		score -= 15;
	} else if (duplicateRatio > 0.05) {
		score -= 8;
	}

	// God symbols penalty (max -10)
	if (insights.godSymbols.length > 10) {
		score -= 10;
	} else if (insights.godSymbols.length > 5) {
		score -= 5;
	}

	return Math.max(0, Math.min(100, score));
}

/**
 * Вычислить trend indicators на основе предыдущего снапшота
 */
async function computeTrends(
	current: CodeInsights
): Promise<{
	complexityTrend?: "up" | "down" | "stable";
	deadCodeTrend?: "up" | "down" | "stable";
	docCoverageTrend?: "up" | "down" | "stable";
}> {
	try {
		const previous = await getLatestSnapshot();
		if (!previous) {
			return {};
		}

		const THRESHOLD = 0.05; // 5% change считается значимым

		// Complexity trend
		const complexityChange =
			(current.avgComplexity - previous.avgComplexity) /
			Math.max(previous.avgComplexity, 1);
		const complexityTrend =
			Math.abs(complexityChange) < THRESHOLD
				? "stable"
				: complexityChange > 0
					? "up"
					: "down";

		// Dead code trend
		const deadCodeChange =
			(current.deadCode.length - previous.deadCodeCount) /
			Math.max(previous.deadCodeCount, 1);
		const deadCodeTrend =
			Math.abs(deadCodeChange) < THRESHOLD
				? "stable"
				: deadCodeChange > 0
					? "up"
					: "down";

		// Doc coverage trend
		const docCoverageChange =
			current.documentationCoverage - previous.documentationCoverage;
		const docCoverageTrend =
			Math.abs(docCoverageChange) < THRESHOLD
				? "stable"
				: docCoverageChange > 0
					? "up"
					: "down";

		return { complexityTrend, deadCodeTrend, docCoverageTrend };
	} catch {
		return {};
	}
}

/**
 * Сохранить снапшот метрик
 */
export async function captureSnapshot(
	insights: CodeInsights,
	commit: string
): Promise<void> {
	if (!(await metricsTableExists())) {
		await initMetricsStore();
	}

	try {
		const timestamp = new Date().toISOString();
		const trends = await computeTrends(insights);
		const healthScore = computeHealthScore(insights);

		const snapshot: MetricsSnapshot = {
			id: `${timestamp}:${commit.slice(0, 8)}`,
			timestamp,
			commit,
			totalSymbols: insights.totalSymbols,
			totalFiles: insights.totalFiles,
			avgComplexity: insights.avgComplexity,
			avgSymbolsPerFile: insights.avgSymbolsPerFile,
			documentationCoverage: insights.documentationCoverage,
			deadCodeCount: insights.deadCode.length,
			duplicateSymbolCount: insights.duplicateSymbolCount,
			topComplexSymbols: JSON.stringify(insights.topComplexSymbols.slice(0, 10)),
			godSymbols: JSON.stringify(insights.godSymbols.slice(0, 10)),
			healthScore,
			complexityTrend: trends.complexityTrend || "stable",
			deadCodeTrend: trends.deadCodeTrend || "stable",
			docCoverageTrend: trends.docCoverageTrend || "stable",
		};

		const table = await getMetricsTable();
		await table.add([snapshot]);

		log.info("Captured metrics snapshot", {
			id: snapshot.id,
			timestamp,
			commit: commit.slice(0, 8),
			healthScore,
			totalSymbols: snapshot.totalSymbols,
			trends,
		});
	} catch (err) {
		log.error("Failed to capture metrics snapshot", { error: err });
		throw err;
	}
}

/**
 * Получить последний снапшот
 */
export async function getLatestSnapshot(): Promise<MetricsSnapshot | null> {
	if (!(await metricsTableExists())) {
		return null;
	}

	try {
		const table = await getMetricsTable();
		// Get all records without select (LanceDB select has issues)
		const results = await table.query().limit(1000).toArray();

		if (results.length === 0) {
			return null;
		}

		// Сортировать по timestamp (последний = самый новый)
		const sorted = results.sort((a, b) => {
			const tsA = (a as Record<string, unknown>).timestamp as string;
			const tsB = (b as Record<string, unknown>).timestamp as string;
			return tsB.localeCompare(tsA);
		});

		const row = sorted[0] as Record<string, unknown>;
		return {
			id: row.id as string,
			timestamp: row.timestamp as string,
			commit: row.commit as string,
			totalSymbols: (row.totalSymbols as number) || 0,
			totalFiles: (row.totalFiles as number) || 0,
			avgComplexity: (row.avgComplexity as number) || 0,
			avgSymbolsPerFile: (row.avgSymbolsPerFile as number) || 0,
			documentationCoverage: (row.documentationCoverage as number) || 0,
			deadCodeCount: (row.deadCodeCount as number) || 0,
			duplicateSymbolCount: (row.duplicateSymbolCount as number) || 0,
			topComplexSymbols: (row.topComplexSymbols as string) || "[]",
			godSymbols: (row.godSymbols as string) || "[]",
			healthScore: (row.healthScore as number) || 0,
			complexityTrend: row.complexityTrend as "up" | "down" | "stable" | undefined,
			deadCodeTrend: row.deadCodeTrend as "up" | "down" | "stable" | undefined,
			docCoverageTrend: row.docCoverageTrend as
				| "up"
				| "down"
				| "stable"
				| undefined,
		};
	} catch (err) {
		log.error("Failed to get latest snapshot", { error: err });
		return null;
	}
}

/**
 * Получить историю снапшотов
 */
export async function getSnapshotHistory(
	limit = 90
): Promise<MetricsSnapshot[]> {
	if (!(await metricsTableExists())) {
		return [];
	}

	try {
		const table = await getMetricsTable();
		// Get all records without select (LanceDB select has issues)
		const results = await table.query().limit(Math.min(limit * 2, 1000)).toArray();

		// Сортировать по timestamp (новые → старые)
		const sorted = results
			.map((row) => {
				const r = row as Record<string, unknown>;
				return {
					id: r.id as string,
					timestamp: r.timestamp as string,
					commit: r.commit as string,
					totalSymbols: (r.totalSymbols as number) || 0,
					totalFiles: (r.totalFiles as number) || 0,
					avgComplexity: (r.avgComplexity as number) || 0,
					avgSymbolsPerFile: (r.avgSymbolsPerFile as number) || 0,
					documentationCoverage: (r.documentationCoverage as number) || 0,
					deadCodeCount: (r.deadCodeCount as number) || 0,
					duplicateSymbolCount: (r.duplicateSymbolCount as number) || 0,
					topComplexSymbols: (r.topComplexSymbols as string) || "[]",
					godSymbols: (r.godSymbols as string) || "[]",
					healthScore: (r.healthScore as number) || 0,
					complexityTrend: r.complexityTrend as "up" | "down" | "stable" | undefined,
					deadCodeTrend: r.deadCodeTrend as "up" | "down" | "stable" | undefined,
					docCoverageTrend: r.docCoverageTrend as
						| "up"
						| "down"
						| "stable"
						| undefined,
				};
			})
			.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

		return sorted.slice(0, limit);
	} catch (err) {
		log.error("Failed to get snapshot history", { error: err });
		return [];
	}
}

/**
 * Очистить старые снапшоты (старше N дней)
 */
export async function cleanOldSnapshots(daysToKeep = 90): Promise<number> {
	if (!(await metricsTableExists())) {
		return 0;
	}

	try {
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
		const cutoffTimestamp = cutoffDate.toISOString();

		const table = await getMetricsTable();

		// LanceDB не поддерживает WHERE с датами, поэтому получаем все и фильтруем
		const results = await table
			.query()
			.select(["id", "timestamp"])
			.limit(1000)
			.toArray();

		const idsToDelete: string[] = [];
		for (const row of results) {
			const r = row as Record<string, unknown>;
			const ts = r.timestamp as string;
			if (ts < cutoffTimestamp) {
				idsToDelete.push(r.id as string);
			}
		}

		if (idsToDelete.length === 0) {
			return 0;
		}

		// Удаляем по ID
		for (const id of idsToDelete) {
			await table.delete(`id = '${id.replace(/'/g, "''")}'`);
		}

		log.info(`Cleaned ${idsToDelete.length} old snapshots`);
		return idsToDelete.length;
	} catch (err) {
		log.error("Failed to clean old snapshots", { error: err });
		return 0;
	}
}

/**
 * Очистить всю таблицу метрик
 */
export async function clearMetricsStore(): Promise<void> {
	if (!(await metricsTableExists())) {
		return;
	}

	try {
		const db = await getConnection();
		await db.dropTable(METRICS_TABLE);
		metricsTableExistsCache = false;
		metricsTablePromise = null;
		log.info("Metrics table cleared");
	} catch (err) {
		log.error("Failed to clear metrics table", { error: err });
	}
}
