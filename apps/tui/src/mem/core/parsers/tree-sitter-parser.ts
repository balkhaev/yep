import Parser from "tree-sitter";
import { createLogger } from "../../lib/logger.ts";
import { BaseParser } from "./base-parser.ts";
import type { EnhancedCodeSymbol } from "./types.ts";

const log = createLogger("tree-sitter");

/**
 * Интерфейс для извлечения символов из AST узлов
 */
export interface NodeExtractor {
	extractSymbols(
		tree: Parser.Tree,
		filePath: string,
		source: string
	): EnhancedCodeSymbol[];
}

/**
 * Абстрактный парсер на основе Tree-sitter
 */
export abstract class TreeSitterParser extends BaseParser {
	/**
	 * Получить грамматику языка для Tree-sitter
	 */
	protected abstract getLanguage(): unknown;

	/**
	 * Получить extractor для извлечения символов из AST
	 */
	protected abstract getNodeExtractor(): NodeExtractor;

	/**
	 * Парсинг файла с помощью Tree-sitter
	 */
	protected async doParse(filePath: string): Promise<EnhancedCodeSymbol[]> {
		const parser = new Parser();
		const language = this.getLanguage();

		parser.setLanguage(language);

		// Читаем исходный код
		const sourceCode = await Bun.file(filePath).text();

		// Парсим с помощью Tree-sitter
		const tree = parser.parse(sourceCode);

		if (tree.rootNode.hasError) {
			log.warn("Parse tree contains errors", { file: filePath });
			// Продолжаем даже с ошибками - частичный парсинг лучше чем ничего
		}

		// Извлекаем символы с помощью extractor'а
		const extractor = this.getNodeExtractor();
		const symbols = extractor.extractSymbols(tree, filePath, sourceCode);

		log.debug("Extracted symbols", {
			file: filePath,
			count: symbols.length,
		});

		return symbols;
	}
}

/**
 * Базовый класс для NodeExtractor с общими утилитами
 */
export abstract class BaseNodeExtractor implements NodeExtractor {
	abstract extractSymbols(
		tree: Parser.Tree,
		filePath: string,
		source: string
	): EnhancedCodeSymbol[];

	/**
	 * Получить текст узла
	 */
	protected getText(node: Parser.SyntaxNode): string {
		return node.text;
	}

	/**
	 * Получить дочерний узел по имени поля
	 */
	protected getChild(
		node: Parser.SyntaxNode,
		fieldName: string
	): Parser.SyntaxNode | null {
		return node.childForFieldName(fieldName);
	}

	/**
	 * Получить все дочерние узлы определённого типа
	 */
	protected getChildrenOfType(
		node: Parser.SyntaxNode,
		type: string
	): Parser.SyntaxNode[] {
		const children: Parser.SyntaxNode[] = [];
		for (const child of node.children) {
			if (child.type === type) {
				children.push(child);
			}
		}
		return children;
	}

	/**
	 * Рекурсивно найти все узлы определённого типа
	 */
	protected findNodesOfType(
		node: Parser.SyntaxNode,
		type: string
	): Parser.SyntaxNode[] {
		const result: Parser.SyntaxNode[] = [];

		if (node.type === type) {
			result.push(node);
		}

		for (const child of node.children) {
			result.push(...this.findNodesOfType(child, type));
		}

		return result;
	}

	/**
	 * Получить номер строки из позиции
	 */
	protected getLineNumber(position: Parser.Point): number {
		return position.row + 1; // Tree-sitter использует 0-based, нам нужен 1-based
	}

	/**
	 * Обрезать текст до максимальной длины
	 */
	protected truncateBody(text: string, maxLength = 3000): string {
		return text.length > maxLength ? text.slice(0, maxLength) : text;
	}
}
