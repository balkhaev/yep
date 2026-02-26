import { extname } from "node:path";
import { createLogger } from "../../lib/logger.ts";
import type { CodeSymbol } from "../code-chunker.ts";
import type { EnhancedCodeSymbol } from "./types.ts";

const log = createLogger("parser");

const MAX_BODY_LENGTH = 3000;
const MAX_CALLS = 30;
const MAX_IMPORTS = 30;

const LANG_BY_EXT: Record<string, string> = {
	".ts": "typescript",
	".tsx": "typescript",
	".js": "javascript",
	".jsx": "javascript",
	".py": "python",
	".go": "go",
	".rs": "rust",
};

/**
 * Абстрактный базовый класс для всех парсеров
 */
export abstract class BaseParser {
	protected maxBodyLength = MAX_BODY_LENGTH;
	protected maxCalls = MAX_CALLS;
	protected maxImports = MAX_IMPORTS;
	protected fallbackParser?: BaseParser;

	/**
	 * Основной метод парсинга файла
	 */
	async parse(filePath: string): Promise<EnhancedCodeSymbol[]> {
		try {
			return await this.doParse(filePath);
		} catch (error) {
			log.warn("Primary parser failed", {
				file: filePath,
				error: String(error),
			});

			if (this.fallbackParser) {
				log.info("Trying fallback parser", { file: filePath });
				try {
					return await this.fallbackParser.parse(filePath);
				} catch (fallbackError) {
					log.error("Fallback parser also failed", {
						file: filePath,
						error: String(fallbackError),
					});
				}
			}

			return this.handleError(error as Error, filePath);
		}
	}

	/**
	 * Реальная имплементация парсинга (должна быть переопределена в подклассах)
	 */
	protected abstract doParse(filePath: string): Promise<EnhancedCodeSymbol[]>;

	/**
	 * Установить fallback парсер
	 */
	setFallback(parser: BaseParser): void {
		this.fallbackParser = parser;
	}

	/**
	 * Обработка ошибки парсинга
	 */
	protected handleError(error: Error, filePath: string): EnhancedCodeSymbol[] {
		log.error("Failed to parse file", {
			file: filePath,
			error: error.message,
		});
		return [];
	}

	/**
	 * Определить язык программирования по расширению файла
	 */
	protected detectLanguage(filePath: string): string {
		const ext = extname(filePath);
		return LANG_BY_EXT[ext] ?? "unknown";
	}

	/**
	 * Обрезать тело кода до максимальной длины
	 */
	protected truncateBody(body: string): string {
		if (body.length <= this.maxBodyLength) {
			return body;
		}
		return body.slice(0, this.maxBodyLength);
	}

	/**
	 * Извлечь вызовы функций из тела кода
	 */
	protected extractCalls(body: string, ownName: string): string[] {
		const calls = new Set<string>();
		const callPattern = /\b([a-zA-Z_]\w{2,})\s*\(/g;

		let match: RegExpExecArray | null;
		while ((match = callPattern.exec(body)) !== null) {
			const callName = match[1];
			if (callName && callName !== ownName && !this.isKeyword(callName)) {
				calls.add(callName);
			}
		}

		const result = Array.from(calls);
		return result.length > this.maxCalls
			? result.slice(0, this.maxCalls)
			: result;
	}

	/**
	 * Проверить, является ли слово ключевым словом языка
	 */
	protected isKeyword(word: string): boolean {
		const keywords = new Set([
			"if",
			"for",
			"while",
			"switch",
			"catch",
			"return",
			"throw",
			"new",
			"typeof",
			"instanceof",
			"void",
			"delete",
			"await",
			"async",
			"import",
			"export",
			"from",
			"const",
			"let",
			"var",
			"function",
			"class",
			"interface",
			"type",
			"enum",
			"console",
			"require",
		]);
		return keywords.has(word);
	}

	/**
	 * Извлечь импорты из кода (базовая реализация)
	 */
	protected extractImports(body: string): string[] {
		const imports = new Set<string>();

		// Named imports: import { foo, bar } from "module"
		const namedPattern = /import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["']/g;
		let match: RegExpExecArray | null;
		while ((match = namedPattern.exec(body)) !== null) {
			const names = match[1]?.split(",");
			const source = match[2];
			if (names && source) {
				for (const name of names) {
					const cleanName = name
						.trim()
						.split(/\s+as\s+/)[0]
						?.trim();
					if (cleanName) {
						imports.add(`${cleanName}:${source}`);
					}
				}
			}
		}

		// Default imports: import foo from "module"
		const defaultPattern = /import\s+(\w+)\s+from\s+["']([^"']+)["']/g;
		while ((match = defaultPattern.exec(body)) !== null) {
			const name = match[1];
			const source = match[2];
			if (name && source) {
				imports.add(`${name}:${source}`);
			}
		}

		const result = Array.from(imports);
		return result.length > this.maxImports
			? result.slice(0, this.maxImports)
			: result;
	}

	/**
	 * Конвертировать EnhancedCodeSymbol в базовый CodeSymbol
	 * (для обратной совместимости)
	 */
	protected toCodeSymbol(enhanced: EnhancedCodeSymbol): CodeSymbol {
		return {
			name: enhanced.name,
			symbolType: enhanced.symbolType,
			path: enhanced.path,
			startLine: enhanced.startLine,
			endLine: enhanced.endLine,
			body: enhanced.body,
			jsDoc: enhanced.jsDoc,
			calls: enhanced.calls,
			imports: enhanced.imports,
		};
	}
}
