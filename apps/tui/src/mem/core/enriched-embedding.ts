/**
 * enriched-embedding.ts - Обогащенные embeddings с контекстом
 *
 * Строит улучшенный текст для embedding, включающий:
 * - Базовую информацию: тип, имя, путь, язык
 * - Документацию (jsDoc/docstring)
 * - Сигнатуру функции (из metadata)
 * - Контекст вызовов: кто вызывает (callers), что вызывает (callees)
 * - Контекст директории
 * - Тело кода
 *
 * Цель: улучшить качество семантического поиска
 */

import { basename, dirname } from "node:path";
import type { CodeSymbol } from "./code-chunker.ts";
import { getIncomingEdges, getOutgoingEdges } from "./graph-store.ts";

const MAX_EMBEDDING_LENGTH = 4000;

/**
 * Извлечь сигнатуру функции из metadata
 */
function extractSignature(sym: CodeSymbol): string | null {
	if (!sym.metadata) {
		return null;
	}

	const parts: string[] = [];

	// Async модификатор
	if (sym.metadata.isAsync) {
		parts.push("async");
	}

	// Visibility
	if (sym.metadata.visibility && sym.metadata.visibility !== "public") {
		parts.push(sym.metadata.visibility);
	}

	// Тип символа и имя
	parts.push(sym.symbolType);
	parts.push(sym.name);

	// Generic параметры
	if (sym.metadata.genericParams && sym.metadata.genericParams.length > 0) {
		const generics = sym.metadata.genericParams
			.map((g) => (g.constraint ? `${g.name}: ${g.constraint}` : g.name))
			.join(", ");
		parts.push(`<${generics}>`);
	}

	// Параметры функции
	if (sym.metadata.parameters && sym.metadata.parameters.length > 0) {
		const params = sym.metadata.parameters
			.map((p) => {
				let param = p.name;
				if (p.type) {
					param += `: ${p.type}`;
				}
				if (p.isOptional) {
					param += "?";
				}
				if (p.defaultValue) {
					param += ` = ${p.defaultValue}`;
				}
				return param;
			})
			.join(", ");
		parts.push(`(${params})`);
	} else if (sym.symbolType === "function" || sym.symbolType === "method") {
		parts.push("()");
	}

	// Тип возвращаемого значения
	if (sym.metadata.returnType) {
		parts.push(`-> ${sym.metadata.returnType}`);
	}

	return parts.join(" ");
}

/**
 * Построить обогащенный текст для embedding
 *
 * @param sym - Символ кода
 * @param includeGraphContext - Включать ли контекст из графа (callers/callees)
 * @returns Обогащенный текст для embedding
 */
export async function buildEnrichedEmbeddingText(
	sym: CodeSymbol,
	includeGraphContext = true
): Promise<string> {
	const parts: string[] = [];

	// 1. Базовая информация
	const fileName = basename(sym.path);
	const dirName = dirname(sym.path).split("/").pop() || "";

	parts.push(`${sym.symbolType} ${sym.name}`);
	parts.push(`file: ${fileName}`);

	if (dirName && dirName !== ".") {
		parts.push(`directory: ${dirName}`);
	}

	// 2. Сигнатура (из metadata)
	const signature = extractSignature(sym);
	if (signature) {
		parts.push(`signature: ${signature}`);
	}

	// 3. Документация
	if (sym.jsDoc) {
		parts.push(`docs: ${sym.jsDoc.slice(0, 400)}`);
	}

	// 4. Контекст из графа (если включено)
	if (includeGraphContext) {
		try {
			// Top callers (кто вызывает эту функцию)
			const incoming = await getIncomingEdges(sym.name, "calls");
			if (incoming.length > 0) {
				const topCallers = incoming
					.slice(0, 10)
					.map((e) => e.source)
					.join(", ");
				parts.push(`used by: ${topCallers}`);
			}

			// Top callees (что вызывает эта функция)
			const outgoing = await getOutgoingEdges(sym.name, "calls");
			if (outgoing.length > 0) {
				const topCallees = outgoing
					.slice(0, 10)
					.map((e) => e.target)
					.join(", ");
				parts.push(`calls: ${topCallees}`);
			}
		} catch (err) {
			// Граф может быть недоступен, продолжаем без него
		}
	}

	// Fallback: если граф недоступен, используем старые calls/imports
	if (!includeGraphContext || parts.length < 5) {
		if (sym.calls.length > 0) {
			parts.push(`calls: ${sym.calls.slice(0, 10).join(", ")}`);
		}
		if (sym.imports.length > 0) {
			parts.push(`imports: ${sym.imports.slice(0, 10).join(", ")}`);
		}
	}

	// 5. Тело кода (усеченное)
	parts.push(sym.body.slice(0, 1500));

	// Объединить и обрезать до MAX_EMBEDDING_LENGTH
	return parts.join("\n\n").slice(0, MAX_EMBEDDING_LENGTH);
}

/**
 * Построить простой embedding текст (без графа) - синхронная версия
 *
 * Используется как fallback когда граф недоступен
 */
export function buildSimpleEmbeddingText(sym: CodeSymbol): string {
	const parts: string[] = [];

	// Базовая информация
	parts.push(`${sym.symbolType} ${sym.name} in ${basename(sym.path)}`);

	// Сигнатура
	const signature = extractSignature(sym);
	if (signature) {
		parts.push(signature);
	}

	// Документация
	if (sym.jsDoc) {
		parts.push(sym.jsDoc.slice(0, 300));
	}

	// Calls и imports
	if (sym.calls.length > 0) {
		parts.push(`calls: ${sym.calls.slice(0, 10).join(", ")}`);
	}
	if (sym.imports.length > 0) {
		parts.push(`imports: ${sym.imports.slice(0, 10).join(", ")}`);
	}

	// Тело
	parts.push(sym.body.slice(0, 1800));

	return parts.join("\n\n").slice(0, MAX_EMBEDDING_LENGTH);
}

/**
 * Batch построение enriched embeddings для массива символов
 *
 * Оптимизировано для минимизации запросов к графу
 */
export async function buildEnrichedEmbeddingsForSymbols(
	symbols: CodeSymbol[],
	includeGraphContext = true
): Promise<string[]> {
	// Если граф не нужен, быстрая синхронная версия
	if (!includeGraphContext) {
		return symbols.map((sym) => buildSimpleEmbeddingText(sym));
	}

	// С графом - асинхронная обработка
	const embeddings = await Promise.all(
		symbols.map((sym) => buildEnrichedEmbeddingText(sym, true))
	);

	return embeddings;
}
