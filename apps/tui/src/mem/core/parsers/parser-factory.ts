/**
 * ParserFactory - фабрика парсеров по расширению файла
 *
 * Возвращает подходящий парсер для заданного расширения файла.
 * Использует Tree-sitter парсеры где доступно, fallback на regex парсеры.
 */

import type { BaseParser } from "./base-parser.ts";
import { GoParser } from "./go-parser.ts";
import { PythonParser } from "./python-parser.ts";
import { RustParser } from "./rust-parser.ts";

/**
 * Mapping расширений файлов на парсеры
 *
 * NOTE: TypeScript/JavaScript используют свой parseFileWithTsCompiler()
 * и не включены в ParserFactory
 */
const PARSER_MAP: Record<string, () => BaseParser> = {
	// Python
	".py": () => new PythonParser(),
	".pyi": () => new PythonParser(),

	// Go
	".go": () => new GoParser(),

	// Rust
	".rs": () => new RustParser(),
};

/**
 * Получить парсер для файла по его расширению
 *
 * @param fileExtension - расширение файла (с точкой, например ".ts")
 * @returns Парсер для данного типа файла или null если не поддерживается
 */
export function getParser(fileExtension: string): BaseParser | null {
	const factory = PARSER_MAP[fileExtension.toLowerCase()];
	if (!factory) {
		return null;
	}

	return factory();
}

/**
 * Проверить, поддерживается ли файл с данным расширением
 *
 * @param fileExtension - расширение файла (с точкой, например ".ts")
 * @returns true если файл может быть обработан
 */
export function isSupported(fileExtension: string): boolean {
	return fileExtension.toLowerCase() in PARSER_MAP;
}

/**
 * Получить список всех поддерживаемых расширений
 *
 * @returns Массив расширений (с точками)
 */
export function getSupportedExtensions(): string[] {
	return Object.keys(PARSER_MAP);
}
