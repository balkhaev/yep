/**
 * trends.ts - Анализ трендов метрик кода
 *
 * Анализирует изменения метрик во времени:
 * - Velocity трендов (скорость изменений)
 * - Предсказание будущих значений (linear regression)
 * - Аномалии (резкие скачки)
 * - Рекомендации по улучшению
 */

// @ts-nocheck
import type { MetricsSnapshot } from "./metrics-store.ts";

/**
 * Тип тренда
 */
export type TrendType = "improving" | "degrading" | "stable" | "volatile";

/**
 * Анализ тренда для одной метрики
 */
export interface TrendAnalysis {
	change: number; // Изменение от первого к последнему снапшоту (%)
	changeAbsolute: number; // Абсолютное изменение
	current: number; // Текущее значение
	max: number; // Максимальное значение за период
	min: number; // Минимальное значение за период
	prediction?: number; // Предсказание на следующий период
	previous: number; // Предыдущее значение
	trend: TrendType; // Тип тренда
	velocity: number; // Скорость изменения (среднее за период)
}

/**
 * Полный анализ трендов
 */
export interface TrendsReport {
	anomalies: string[]; // Обнаруженные аномалии
	avgComplexity: TrendAnalysis;
	deadCodeCount: TrendAnalysis;
	documentationCoverage: TrendAnalysis;
	duplicateSymbolCount: TrendAnalysis;
	healthScore: TrendAnalysis;
	period: string; // Период анализа (напр. "30 days")
	recommendations: string[]; // Рекомендации
	snapshots: MetricsSnapshot[]; // Исходные snapshots для графиков
	totalSymbols: TrendAnalysis;
}

/**
 * Вычислить trend analysis для массива значений
 */
function analyzeTrend(
	values: number[],
	isHigherBetter = true
): TrendAnalysis {
	if (values.length === 0) {
		return {
			current: 0,
			previous: 0,
			change: 0,
			changeAbsolute: 0,
			min: 0,
			max: 0,
			velocity: 0,
			trend: "stable",
		};
	}

	const current = values[0]; // Последний (самый новый)
	const previous = values.length > 1 ? values[1] : current;
	const oldest = values[values.length - 1];

	const changeAbsolute = current - previous;
	const change =
		previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : 0;

	const min = Math.min(...values);
	const max = Math.max(...values);

	// Velocity: средняя скорость изменения за весь период
	const totalChange = current - oldest;
	const velocity = values.length > 1 ? totalChange / (values.length - 1) : 0;

	// Предсказание: linear regression (простая версия)
	const prediction = current + velocity;

	// Определить тип тренда
	let trend: TrendType = "stable";

	// Volatility: стандартное отклонение
	const mean = values.reduce((a, b) => a + b, 0) / values.length;
	const variance =
		values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length;
	const stdDev = Math.sqrt(variance);
	const volatility = mean !== 0 ? stdDev / Math.abs(mean) : 0;

	if (volatility > 0.3) {
		trend = "volatile";
	} else {
		const THRESHOLD = 0.05; // 5% change считается значимым
		const totalChangePercent = oldest !== 0 ? Math.abs(totalChange / oldest) : 0;

		if (totalChangePercent < THRESHOLD) {
			trend = "stable";
		} else {
			// Определяем improving/degrading в зависимости от направления метрики
			const isImproving = isHigherBetter ? totalChange > 0 : totalChange < 0;
			trend = isImproving ? "improving" : "degrading";
		}
	}

	return {
		current,
		previous,
		change,
		changeAbsolute,
		min,
		max,
		velocity,
		prediction,
		trend,
	};
}

/**
 * Обнаружить аномалии в снапшотах
 */
function detectAnomalies(snapshots: MetricsSnapshot[]): string[] {
	const anomalies: string[] = [];

	if (snapshots.length < 3) {
		return anomalies;
	}

	// Проверить резкие скачки complexity
	for (let i = 0; i < snapshots.length - 1; i++) {
		const current = snapshots[i];
		const prev = snapshots[i + 1];

		const complexityChange =
			prev.avgComplexity !== 0
				? ((current.avgComplexity - prev.avgComplexity) / prev.avgComplexity) *
					100
				: 0;

		if (Math.abs(complexityChange) > 20) {
			// 20% change
			anomalies.push(
				`Sharp complexity ${complexityChange > 0 ? "increase" : "decrease"} (${complexityChange.toFixed(1)}%) at ${current.timestamp.split("T")[0]}`
			);
		}

		// Проверить резкое увеличение dead code
		const deadCodeChange = current.deadCodeCount - prev.deadCodeCount;
		const deadCodeChangePercent =
			prev.deadCodeCount !== 0
				? (deadCodeChange / prev.deadCodeCount) * 100
				: 0;

		if (deadCodeChangePercent > 50) {
			// 50% increase
			anomalies.push(
				`Dead code spike (+${deadCodeChange} symbols, +${deadCodeChangePercent.toFixed(0)}%) at ${current.timestamp.split("T")[0]}`
			);
		}

		// Проверить падение health score
		const healthChange = current.healthScore - prev.healthScore;
		if (healthChange < -15) {
			// Drop of 15+ points
			anomalies.push(
				`Health score drop (${healthChange.toFixed(0)} points) at ${current.timestamp.split("T")[0]}`
			);
		}
	}

	return anomalies;
}

/**
 * Генерировать рекомендации на основе трендов
 */
function generateRecommendations(report: Partial<TrendsReport>): string[] {
	const recommendations: string[] = [];

	// Complexity recommendations
	if (report.avgComplexity) {
		if (report.avgComplexity.trend === "degrading") {
			recommendations.push(
				"⚠️ Code complexity increasing - consider refactoring complex functions"
			);
		}
		if (report.avgComplexity.current > 10) {
			recommendations.push(
				"📊 High average complexity detected - review top complex symbols"
			);
		}
	}

	// Documentation recommendations
	if (report.documentationCoverage) {
		if (report.documentationCoverage.trend === "degrading") {
			recommendations.push(
				"📝 Documentation coverage declining - add JSDoc/docstrings to new code"
			);
		}
		if (report.documentationCoverage.current < 0.5) {
			recommendations.push(
				"📖 Low documentation coverage (<50%) - prioritize documenting public APIs"
			);
		}
	}

	// Dead code recommendations
	if (report.deadCodeCount) {
		if (report.deadCodeCount.trend === "degrading") {
			recommendations.push(
				"🗑️ Dead code accumulating - run cleanup to remove unused symbols"
			);
		}
		if (report.deadCodeCount.current > 20) {
			recommendations.push(
				"🧹 Significant dead code detected - consider automated cleanup tools"
			);
		}
	}

	// Health score recommendations
	if (report.healthScore) {
		if (report.healthScore.trend === "degrading") {
			recommendations.push(
				"🏥 Overall code health declining - address top issues first"
			);
		}
		if (report.healthScore.current < 70) {
			recommendations.push(
				"⚡ Health score below 70 - focus on reducing complexity and improving docs"
			);
		}
	}

	// Duplicate code recommendations
	if (report.duplicateSymbolCount) {
		if (
			report.duplicateSymbolCount.trend === "degrading" ||
			report.duplicateSymbolCount.current > 10
		) {
			recommendations.push(
				"🔄 Code duplication detected - extract common logic into shared utilities"
			);
		}
	}

	// Positive feedback
	if (recommendations.length === 0) {
		recommendations.push("✅ Code quality metrics are stable or improving");
	}

	return recommendations;
}

/**
 * Построить trends report из истории снапшотов
 *
 * @param snapshots - История снапшотов (sorted newest → oldest)
 * @returns Полный анализ трендов
 */
export function buildTrendsReport(snapshots: MetricsSnapshot[]): TrendsReport {
	if (snapshots.length === 0) {
		return {
			period: "0 days",
			totalSymbols: analyzeTrend([], true),
			avgComplexity: analyzeTrend([], false),
			documentationCoverage: analyzeTrend([], true),
			deadCodeCount: analyzeTrend([], false),
			duplicateSymbolCount: analyzeTrend([], false),
			healthScore: analyzeTrend([], true),
			anomalies: [],
			recommendations: ["No historical data available"],
			snapshots: [],
		};
	}

	// Вычислить период
	const oldest = snapshots[snapshots.length - 1];
	const newest = snapshots[0];
	const days = Math.ceil(
		(new Date(newest.timestamp).getTime() -
			new Date(oldest.timestamp).getTime()) /
			(1000 * 60 * 60 * 24)
	);
	const period = days === 0 ? "today" : `${days} days`;

	// Извлечь значения для каждой метрики (newest → oldest)
	const totalSymbols = snapshots.map((s) => s.totalSymbols);
	const avgComplexity = snapshots.map((s) => s.avgComplexity);
	const documentationCoverage = snapshots.map((s) => s.documentationCoverage);
	const deadCodeCount = snapshots.map((s) => s.deadCodeCount);
	const duplicateSymbolCount = snapshots.map((s) => s.duplicateSymbolCount);
	const healthScore = snapshots.map((s) => s.healthScore);

	// Анализировать каждую метрику
	const report: Partial<TrendsReport> = {
		period,
		totalSymbols: analyzeTrend(totalSymbols, true),
		avgComplexity: analyzeTrend(avgComplexity, false), // Lower is better
		documentationCoverage: analyzeTrend(documentationCoverage, true),
		deadCodeCount: analyzeTrend(deadCodeCount, false), // Lower is better
		duplicateSymbolCount: analyzeTrend(duplicateSymbolCount, false),
		healthScore: analyzeTrend(healthScore, true),
	};

	// Обнаружить аномалии
	report.anomalies = detectAnomalies(snapshots);

	// Генерировать рекомендации
	report.recommendations = generateRecommendations(report);

	// Включить исходные snapshots для графиков
	report.snapshots = snapshots;

	return report as TrendsReport;
}

/**
 * Форматировать trend для отображения
 */
export function formatTrend(trend: TrendAnalysis, unit = ""): string {
	const emoji =
		trend.trend === "improving"
			? "📈"
			: trend.trend === "degrading"
				? "📉"
				: trend.trend === "volatile"
					? "📊"
					: "➖";

	const changeStr =
		trend.change >= 0 ? `+${trend.change.toFixed(1)}%` : `${trend.change.toFixed(1)}%`;

	return `${emoji} ${trend.current.toFixed(2)}${unit} (${changeStr})`;
}

/**
 * Получить summary строку для trends report
 */
export function getTrendsSummary(report: TrendsReport): string {
	const lines: string[] = [];

	lines.push(`📊 Trends over ${report.period}`);
	lines.push(`   Health: ${formatTrend(report.healthScore, "/100")}`);
	lines.push(`   Complexity: ${formatTrend(report.avgComplexity)}`);
	lines.push(
		`   Docs: ${formatTrend(report.documentationCoverage, "%")
			.replace(/%/, "")
			.replace(/\d+\.\d+/, (m) => (Number.parseFloat(m) * 100).toFixed(0))
			}%`
	);
	lines.push(`   Dead code: ${formatTrend(report.deadCodeCount, " symbols")}`);

	if (report.anomalies.length > 0) {
		lines.push(`\n⚠️ Anomalies detected: ${report.anomalies.length}`);
	}

	return lines.join("\n");
}
