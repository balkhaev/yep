// @ts-nocheck
/**
 * graph-store.ts - Хранилище графа зависимостей кода
 *
 * Управляет таблицей code_graph для хранения связей между символами:
 * - calls: функция A вызывает функцию B
 * - imports: модуль A импортирует модуль B
 * - extends: класс A расширяет класс B
 * - implements: класс A реализует интерфейс B
 *
 * Используется для:
 * - PageRank вычисления популярности
 * - Быстрые графовые запросы
 * - Визуализация зависимостей
 */

import type { Table } from "@lancedb/lancedb";
import { createLogger } from "../lib/logger.ts";
import { getConnection } from "./store.ts";

const log = createLogger("graph-store");

const GRAPH_TABLE = "code_graph";

/**
 * Тип ребра графа
 */
export type EdgeType = "calls" | "imports" | "extends" | "implements";

/**
 * Ребро графа зависимостей
 */
export interface GraphEdge {
	commit: string;
	count: number; // Количество раз (если несколько вызовов)
	edgeType: EdgeType;
	id: string; // "source:target:type"
	lastModified: string;
	source: string; // Имя символа источника
	sourceFile: string;
	target: string; // Имя символа назначения
	targetFile?: string; // Может быть unknown для внешних зависимостей
}

/**
 * Результат запроса графа
 */
export interface GraphQueryResult {
	count: number;
	edgeType: EdgeType;
	source: string;
	target: string;
}

let graphTableExistsCache: boolean | null = null;
let graphTablePromise: Promise<Table> | null = null;

/**
 * Получить таблицу графа (с кэшированием)
 */
async function getGraphTable(): Promise<Table> {
	if (graphTablePromise) {
		return graphTablePromise;
	}

	graphTablePromise = (async () => {
		const db = await getConnection();
		return db.openTable(GRAPH_TABLE);
	})();

	return graphTablePromise;
}

/**
 * Проверить существование таблицы графа
 */
export async function graphTableExists(): Promise<boolean> {
	if (graphTableExistsCache !== null) {
		return graphTableExistsCache;
	}

	try {
		const db = await getConnection();
		const tables = await db.tableNames();
		graphTableExistsCache = tables.includes(GRAPH_TABLE);
		return graphTableExistsCache;
	} catch (err) {
		log.error("Failed to check graph table existence", { error: err });
		return false;
	}
}

/**
 * Инициализировать таблицу графа
 */
export async function initGraphStore(): Promise<void> {
	if (await graphTableExists()) {
		log.info("Graph table already exists");
		return;
	}

	try {
		const db = await getConnection();

		// Создать пустую таблицу с схемой
		const emptyData: GraphEdge[] = [
			{
				id: "init:init:calls",
				source: "init",
				target: "init",
				edgeType: "calls",
				sourceFile: "/init",
				targetFile: "/init",
				count: 1,
				commit: "initial",
				lastModified: new Date().toISOString(),
			},
		];

		await db.createTable(GRAPH_TABLE, emptyData);

		// Удалить инициализационную запись
		const table = await db.openTable(GRAPH_TABLE);
		await table.delete("id = 'init:init:calls'");

		graphTableExistsCache = true;
		graphTablePromise = null;

		log.info("Graph table initialized");
	} catch (err) {
		log.error("Failed to initialize graph table", { error: err });
		throw err;
	}
}

/**
 * Вставить ребра в граф
 */
export async function insertGraphEdges(edges: GraphEdge[]): Promise<number> {
	if (edges.length === 0) {
		return 0;
	}

	if (!(await graphTableExists())) {
		await initGraphStore();
	}

	try {
		const table = await getGraphTable();
		await table.add(edges);
		log.info(`Inserted ${edges.length} graph edges`);
		return edges.length;
	} catch (err) {
		log.error("Failed to insert graph edges", { error: err });
		throw err;
	}
}

/**
 * Удалить все ребра связанные с файлом
 */
export async function deleteGraphEdgesByFile(filePath: string): Promise<void> {
	if (!(await graphTableExists())) {
		return;
	}

	try {
		const table = await getGraphTable();
		await table.delete(`sourceFile = '${filePath.replace(/'/g, "''")}'`);
		log.info(`Deleted graph edges for file: ${filePath}`);
	} catch (err) {
		log.error("Failed to delete graph edges", { error: err, filePath });
	}
}

/**
 * Получить все ребра исходящие из символа (кого вызывает)
 */
export async function getOutgoingEdges(
	symbolName: string,
	edgeType?: EdgeType
): Promise<GraphQueryResult[]> {
	if (!(await graphTableExists())) {
		return [];
	}

	try {
		const table = await getGraphTable();

		// Получить все записи и фильтровать в памяти
		// (LanceDB filter API имеет ограничения)
		const results = await table
			.query()
			.select(["source", "target", "edgeType", "count"])
			.limit(10_000)
			.toArray();

		return results
			.filter((r: Record<string, unknown>) => {
				if (r.source !== symbolName) {
					return false;
				}
				if (edgeType && r.edgeType !== edgeType) {
					return false;
				}
				return true;
			})
			.map((r: Record<string, unknown>) => ({
				source: r.source as string,
				target: r.target as string,
				edgeType: r.edgeType as EdgeType,
				count: (r.count as number) || 1,
			}));
	} catch (err) {
		log.error("Failed to get outgoing edges", { error: err, symbolName });
		return [];
	}
}

/**
 * Получить все ребра входящие в символ (кто вызывает)
 */
export async function getIncomingEdges(
	symbolName: string,
	edgeType?: EdgeType
): Promise<GraphQueryResult[]> {
	if (!(await graphTableExists())) {
		return [];
	}

	try {
		const table = await getGraphTable();

		// Получить все записи и фильтровать в памяти
		const results = await table
			.query()
			.select(["source", "target", "edgeType", "count"])
			.limit(10_000)
			.toArray();

		return results
			.filter((r: Record<string, unknown>) => {
				if (r.target !== symbolName) {
					return false;
				}
				if (edgeType && r.edgeType !== edgeType) {
					return false;
				}
				return true;
			})
			.map((r: Record<string, unknown>) => ({
				source: r.source as string,
				target: r.target as string,
				edgeType: r.edgeType as EdgeType,
				count: (r.count as number) || 1,
			}));
	} catch (err) {
		log.error("Failed to get incoming edges", { error: err, symbolName });
		return [];
	}
}

/**
 * Подсчитать количество символов вызывающих данный символ
 */
export async function getCallerCount(symbolName: string): Promise<number> {
	const edges = await getIncomingEdges(symbolName, "calls");
	return edges.length;
}

/**
 * Подсчитать количество символов которые вызывает данный символ
 */
export async function getCalleeCount(symbolName: string): Promise<number> {
	const edges = await getOutgoingEdges(symbolName, "calls");
	return edges.length;
}

/**
 * Подсчитать количество модулей импортирующих данный символ
 */
export async function getImporterCount(symbolName: string): Promise<number> {
	const edges = await getIncomingEdges(symbolName, "imports");
	return edges.length;
}

/**
 * Получить все уникальные символы в графе
 */
export async function getAllGraphSymbols(): Promise<string[]> {
	if (!(await graphTableExists())) {
		return [];
	}

	try {
		const table = await getGraphTable();
		const results = await table
			.query()
			.select(["source", "target"])
			.limit(100_000)
			.toArray();

		const symbols = new Set<string>();
		for (const row of results) {
			const r = row as Record<string, unknown>;
			symbols.add(r.source as string);
			symbols.add(r.target as string);
		}

		return Array.from(symbols);
	} catch (err) {
		log.error("Failed to get all graph symbols", { error: err });
		return [];
	}
}

/**
 * Очистить всю таблицу графа
 */
export async function clearGraphStore(): Promise<void> {
	if (!(await graphTableExists())) {
		return;
	}

	try {
		const db = await getConnection();
		await db.dropTable(GRAPH_TABLE);
		graphTableExistsCache = false;
		graphTablePromise = null;
		log.info("Graph table cleared");
	} catch (err) {
		log.error("Failed to clear graph table", { error: err });
	}
}

/**
 * Построить ребра графа из calls и imports строк
 *
 * Используется для миграции существующих данных из CSV формата
 */
export function buildGraphEdgesFromCalls(
	symbolName: string,
	filePath: string,
	calls: string,
	imports: string,
	commit: string,
	lastModified: string
): GraphEdge[] {
	const edges: GraphEdge[] = [];

	// Обработать calls
	if (calls) {
		const callsList = calls.split(",").filter(Boolean);
		const callCounts = new Map<string, number>();

		// Подсчитать количество вызовов каждой функции
		for (const call of callsList) {
			const trimmed = call.trim();
			if (trimmed) {
				callCounts.set(trimmed, (callCounts.get(trimmed) || 0) + 1);
			}
		}

		// Создать ребра
		for (const [target, count] of callCounts) {
			edges.push({
				id: `${symbolName}:${target}:calls`,
				source: symbolName,
				target,
				edgeType: "calls",
				sourceFile: filePath,
				targetFile: undefined,
				count,
				commit,
				lastModified,
			});
		}
	}

	// Обработать imports
	if (imports) {
		const importsList = imports.split(",").filter(Boolean);
		const importCounts = new Map<string, number>();

		for (const imp of importsList) {
			const trimmed = imp.trim();
			if (trimmed) {
				importCounts.set(trimmed, (importCounts.get(trimmed) || 0) + 1);
			}
		}

		for (const [target, count] of importCounts) {
			edges.push({
				id: `${symbolName}:${target}:imports`,
				source: symbolName,
				target,
				edgeType: "imports",
				sourceFile: filePath,
				targetFile: undefined,
				count,
				commit,
				lastModified,
			});
		}
	}

	return edges;
}
