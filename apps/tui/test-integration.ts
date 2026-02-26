// @ts-nocheck
/**
 * Интеграционный тест - проверка работы ParserFactory на реальных файлах
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import {
	getParser,
	getSupportedExtensions,
	isSupported,
} from "./src/mem/core/parsers/parser-factory.ts";

console.log("\n=== Интеграционный тест ParserFactory ===\n");

// 1. Проверить поддерживаемые расширения
console.log("1. Поддерживаемые расширения:");
const extensions = getSupportedExtensions();
console.log(`   ${extensions.join(", ")}\n`);

// 2. Тестовые файлы из fixtures
const testFiles = [
	{
		path: "./src/mem/core/parsers/__tests__/fixtures/python/sample.py",
		language: "Python",
	},
	{
		path: "./src/mem/core/parsers/__tests__/fixtures/go/sample.go",
		language: "Go",
	},
	{
		path: "./src/mem/core/parsers/__tests__/fixtures/rust/sample.rs",
		language: "Rust",
	},
];

console.log("2. Тестирование парсинга:");

for (const { path, language } of testFiles) {
	const fullPath = join(process.cwd(), path);

	if (!existsSync(fullPath)) {
		console.log(`   ❌ ${language}: файл не найден ${fullPath}`);
		continue;
	}

	const ext = path.slice(path.lastIndexOf("."));

	if (!isSupported(ext)) {
		console.log(`   ❌ ${language}: расширение ${ext} не поддерживается`);
		continue;
	}

	const parser = getParser(ext);
	if (!parser) {
		console.log(`   ❌ ${language}: парсер не найден для ${ext}`);
		continue;
	}

	try {
		const symbols = await parser.parse(fullPath);
		console.log(`   ✓ ${language}: ${symbols.length} символов`);

		// Проверить что metadata извлечена
		const withMetadata = symbols.filter((s) => s.metadata);
		console.log(`      - ${withMetadata.length} с metadata`);

		// Показать примеры
		const func = symbols.find((s) => s.symbolType === "function");
		if (func?.metadata) {
			console.log(
				`      - функция "${func.name}": ${func.metadata.parameters?.length || 0} параметров`
			);
			if (func.metadata.returnType) {
				console.log(`        returnType: ${func.metadata.returnType}`);
			}
		}

		const classOrStruct = symbols.find((s) => s.symbolType === "class");
		if (classOrStruct?.metadata) {
			console.log(`      - struct/class "${classOrStruct.name}"`);
			if (classOrStruct.metadata.genericParams) {
				console.log(
					`        generics: ${classOrStruct.metadata.genericParams.map((g) => g.name).join(", ")}`
				);
			}
		}

		const method = symbols.find((s) => s.symbolType === "method");
		if (method?.metadata) {
			console.log(`      - метод "${method.name}"`);
			if (method.metadata.visibility) {
				console.log(`        visibility: ${method.metadata.visibility}`);
			}
		}
	} catch (err) {
		console.log(`   ❌ ${language}: ошибка парсинга -`, err);
	}
}

console.log("\n=== Тест завершён ===\n");
