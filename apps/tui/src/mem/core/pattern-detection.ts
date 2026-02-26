// @ts-nocheck
/**
 * pattern-detection.ts - Обнаружение паттернов и anti-patterns
 *
 * Heuristic-based детекция:
 * - Архитектурные паттерны: Singleton, Factory, Observer, Builder
 * - React паттерны: HOC, Render Props, Compound Components
 * - Anti-patterns: Magic numbers, Long parameter list, Deep nesting
 */

import { createLogger } from "../lib/logger.ts";
import type { CodeResult } from "./code-store.ts";

const log = createLogger("pattern-detection");

/**
 * Обнаруженный паттерн
 */
export interface DetectedPattern {
	confidence: number; // 0-1, уверенность в детекции
	description: string;
	path: string;
	pattern:
		| "Singleton"
		| "Factory"
		| "Observer"
		| "Builder"
		| "HOC"
		| "RenderProps"
		| "CompoundComponents"
		| "CustomHook";
	symbol: string;
	type: "architectural" | "react";
}

/**
 * Обнаруженный anti-pattern
 */
export interface DetectedAntiPattern {
	antiPattern:
		| "MagicNumbers"
		| "LongParameterList"
		| "DeepNesting"
		| "GodClass"
		| "LongMethod"
		| "DuplicateCode";
	confidence: number;
	description: string;
	path: string;
	severity: "low" | "medium" | "high";
	symbol: string;
}

/**
 * Результат pattern detection
 */
export interface PatternDetectionReport {
	antiPatterns: DetectedAntiPattern[];
	patterns: DetectedPattern[];
}

/**
 * Детектировать Singleton pattern
 */
function detectSingleton(chunk: CodeResult): DetectedPattern | null {
	const body = chunk.body.toLowerCase();

	// Heuristics:
	// 1. Приватный конструктор (private constructor)
	// 2. Статический getInstance() метод
	// 3. Статическое поле instance

	let confidence = 0;

	if (body.includes("private constructor") || body.includes("private static")) {
		confidence += 0.4;
	}

	if (body.includes("getinstance") || body.includes("get instance")) {
		confidence += 0.3;
	}

	if (body.includes("static instance") || body.includes("static readonly")) {
		confidence += 0.3;
	}

	if (confidence >= 0.5) {
		return {
			pattern: "Singleton",
			type: "architectural",
			symbol: chunk.symbol,
			path: chunk.path,
			confidence,
			description: "Ensures only one instance exists",
		};
	}

	return null;
}

/**
 * Детектировать Factory pattern
 */
function detectFactory(chunk: CodeResult): DetectedPattern | null {
	const body = chunk.body.toLowerCase();
	const symbol = chunk.symbol.toLowerCase();

	let confidence = 0;

	// Heuristics: имя содержит "factory" или "create"
	if (symbol.includes("factory")) {
		confidence += 0.4;
	}

	if (symbol.includes("create") || symbol.includes("build")) {
		confidence += 0.2;
	}

	// Возвращает new SomeClass
	if (body.includes("new ") && body.includes("return")) {
		confidence += 0.3;
	}

	// Switch/if для выбора типа
	if (body.includes("switch") || body.includes("if (type")) {
		confidence += 0.1;
	}

	if (confidence >= 0.5) {
		return {
			pattern: "Factory",
			type: "architectural",
			symbol: chunk.symbol,
			path: chunk.path,
			confidence,
			description: "Creates objects without exposing instantiation logic",
		};
	}

	return null;
}

/**
 * Детектировать Observer pattern
 */
function detectObserver(chunk: CodeResult): DetectedPattern | null {
	const body = chunk.body.toLowerCase();
	const symbol = chunk.symbol.toLowerCase();

	let confidence = 0;

	// Heuristics: addEventListener, subscribe, on, emit
	if (
		body.includes("addeventlistener") ||
		body.includes("subscribe") ||
		body.includes("on(") ||
		symbol.includes("observable")
	) {
		confidence += 0.4;
	}

	if (body.includes("notify") || body.includes("emit")) {
		confidence += 0.3;
	}

	if (body.includes("observers") || body.includes("listeners")) {
		confidence += 0.3;
	}

	if (confidence >= 0.5) {
		return {
			pattern: "Observer",
			type: "architectural",
			symbol: chunk.symbol,
			path: chunk.path,
			confidence,
			description: "Defines subscription mechanism to notify observers",
		};
	}

	return null;
}

/**
 * Детектировать Builder pattern
 */
function detectBuilder(chunk: CodeResult): DetectedPattern | null {
	const body = chunk.body.toLowerCase();
	const symbol = chunk.symbol.toLowerCase();

	let confidence = 0;

	// Heuristics: метод chaining, with* методы, build() метод
	if (symbol.includes("builder")) {
		confidence += 0.4;
	}

	if (body.includes("return this") && body.match(/\bwith\w+/)) {
		confidence += 0.3;
	}

	if (body.includes("build()") || body.includes(".build")) {
		confidence += 0.3;
	}

	if (confidence >= 0.5) {
		return {
			pattern: "Builder",
			type: "architectural",
			symbol: chunk.symbol,
			path: chunk.path,
			confidence,
			description: "Constructs complex objects step by step",
		};
	}

	return null;
}

/**
 * Детектировать React HOC pattern
 */
function detectHOC(chunk: CodeResult): DetectedPattern | null {
	const body = chunk.body;
	const symbol = chunk.symbol.toLowerCase();

	let confidence = 0;

	// Heuristics: with* название, возвращает компонент
	if (symbol.startsWith("with")) {
		confidence += 0.4;
	}

	// Принимает компонент и возвращает компонент
	if (
		body.includes("Component") &&
		body.includes("return") &&
		body.includes("(props")
	) {
		confidence += 0.3;
	}

	if (body.includes("displayName")) {
		confidence += 0.2;
	}

	if (confidence >= 0.5 && chunk.language === "typescript") {
		return {
			pattern: "HOC",
			type: "react",
			symbol: chunk.symbol,
			path: chunk.path,
			confidence,
			description: "Higher-Order Component wraps another component",
		};
	}

	return null;
}

/**
 * Детектировать Render Props pattern
 */
function detectRenderProps(chunk: CodeResult): DetectedPattern | null {
	const body = chunk.body;

	let confidence = 0;

	// Heuristics: props.render или props.children как функция
	if (body.includes("props.render(") || body.includes("{render}")) {
		confidence += 0.5;
	}

	if (
		body.includes("props.children(") ||
		body.includes("children as Function")
	) {
		confidence += 0.4;
	}

	if (confidence >= 0.5 && chunk.language === "typescript") {
		return {
			pattern: "RenderProps",
			type: "react",
			symbol: chunk.symbol,
			path: chunk.path,
			confidence,
			description: "Component uses render prop for flexible rendering",
		};
	}

	return null;
}

/**
 * Детектировать Compound Components pattern
 */
function detectCompoundComponents(chunk: CodeResult): DetectedPattern | null {
	const body = chunk.body;
	const symbol = chunk.symbol;

	let confidence = 0;

	// Heuristics: Component.Subcomponent структура
	if (body.includes(`${symbol}.`) && body.includes("= ")) {
		confidence += 0.4;
	}

	if (body.includes("createContext") || body.includes("useContext")) {
		confidence += 0.3;
	}

	if (body.match(/\w+\.\w+\s*=/g)?.length >= 2) {
		confidence += 0.3;
	}

	if (confidence >= 0.5 && chunk.language === "typescript") {
		return {
			pattern: "CompoundComponents",
			type: "react",
			symbol: chunk.symbol,
			path: chunk.path,
			confidence,
			description: "Component with attached sub-components",
		};
	}

	return null;
}

/**
 * Детектировать Custom Hook pattern
 */
function detectCustomHook(chunk: CodeResult): DetectedPattern | null {
	const symbol = chunk.symbol;
	const body = chunk.body;

	// Heuristics: название начинается с "use" и содержит React hooks
	if (
		symbol.startsWith("use") &&
		(body.includes("useState") ||
			body.includes("useEffect") ||
			body.includes("useCallback") ||
			body.includes("useMemo"))
	) {
		return {
			pattern: "CustomHook",
			type: "react",
			symbol: chunk.symbol,
			path: chunk.path,
			confidence: 0.9,
			description: "Custom React Hook for reusable logic",
		};
	}

	return null;
}

/**
 * Детектировать Magic Numbers anti-pattern
 */
function detectMagicNumbers(chunk: CodeResult): DetectedAntiPattern | null {
	const body = chunk.body;

	// Найти числа в коде (кроме 0, 1, -1, 100)
	const numberMatches = body.match(/\b\d{2,}\b/g);

	if (numberMatches && numberMatches.length > 3) {
		// Много чисел в коде
		const uniqueNumbers = new Set(
			numberMatches.filter((n) => !["100", "1000"].includes(n))
		);

		if (uniqueNumbers.size > 2) {
			return {
				antiPattern: "MagicNumbers",
				symbol: chunk.symbol,
				path: chunk.path,
				severity: "medium",
				confidence: 0.7,
				description: `Found ${uniqueNumbers.size} magic numbers - extract to named constants`,
			};
		}
	}

	return null;
}

/**
 * Детектировать Long Parameter List anti-pattern
 */
function detectLongParameterList(chunk: CodeResult): DetectedAntiPattern | null {
	// Парсим metadata для параметров
	try {
		if (chunk.metadata) {
			const metadata = JSON.parse(chunk.metadata);
			if (metadata.parameters && metadata.parameters.length > 5) {
				return {
					antiPattern: "LongParameterList",
					symbol: chunk.symbol,
					path: chunk.path,
					severity: metadata.parameters.length > 7 ? "high" : "medium",
					confidence: 0.9,
					description: `${metadata.parameters.length} parameters - consider using options object`,
				};
			}
		}
	} catch {
		// Ignore parse errors
	}

	return null;
}

/**
 * Детектировать Deep Nesting anti-pattern
 */
function detectDeepNesting(chunk: CodeResult): DetectedAntiPattern | null {
	const body = chunk.body;
	const lines = body.split("\n");

	let maxIndent = 0;

	for (const line of lines) {
		const indent = line.search(/\S/);
		if (indent > 0 && indent > maxIndent) {
			maxIndent = indent;
		}
	}

	// Определить размер одного уровня отступа (2 или 4 пробела)
	const indentSize = body.includes("\t") ? 4 : 2;
	const nestingLevel = Math.floor(maxIndent / indentSize);

	// Если вложенность > 6 уровней
	if (nestingLevel > 6) {
		return {
			antiPattern: "DeepNesting",
			symbol: chunk.symbol,
			path: chunk.path,
			severity: nestingLevel > 8 ? "high" : "medium",
			confidence: 0.8,
			description: `Deep nesting (${nestingLevel} levels) - extract nested logic`,
		};
	}

	return null;
}

/**
 * Выполнить pattern detection на массиве chunks
 */
export function detectPatterns(chunks: CodeResult[]): PatternDetectionReport {
	const patterns: DetectedPattern[] = [];
	const antiPatterns: DetectedAntiPattern[] = [];

	log.info(`Detecting patterns in ${chunks.length} symbols`);

	for (const chunk of chunks) {
		// Architectural patterns
		const singleton = detectSingleton(chunk);
		if (singleton) patterns.push(singleton);

		const factory = detectFactory(chunk);
		if (factory) patterns.push(factory);

		const observer = detectObserver(chunk);
		if (observer) patterns.push(observer);

		const builder = detectBuilder(chunk);
		if (builder) patterns.push(builder);

		// React patterns
		if (chunk.language === "typescript" || chunk.language === "javascript") {
			const hoc = detectHOC(chunk);
			if (hoc) patterns.push(hoc);

			const renderProps = detectRenderProps(chunk);
			if (renderProps) patterns.push(renderProps);

			const compound = detectCompoundComponents(chunk);
			if (compound) patterns.push(compound);

			const customHook = detectCustomHook(chunk);
			if (customHook) patterns.push(customHook);
		}

		// Anti-patterns
		const magicNumbers = detectMagicNumbers(chunk);
		if (magicNumbers) antiPatterns.push(magicNumbers);

		const longParams = detectLongParameterList(chunk);
		if (longParams) antiPatterns.push(longParams);

		const deepNesting = detectDeepNesting(chunk);
		if (deepNesting) antiPatterns.push(deepNesting);
	}

	log.info(
		`Found ${patterns.length} patterns and ${antiPatterns.length} anti-patterns`
	);

	return { patterns, antiPatterns };
}

/**
 * Форматировать pattern для отображения
 */
export function formatPattern(pattern: DetectedPattern): string {
	const emoji = pattern.type === "architectural" ? "🏗️" : "⚛️";
	const confidence = (pattern.confidence * 100).toFixed(0);
	return `${emoji} ${pattern.pattern} in ${pattern.symbol} (${confidence}% confidence)`;
}

/**
 * Форматировать anti-pattern для отображения
 */
export function formatAntiPattern(antiPattern: DetectedAntiPattern): string {
	const emoji =
		antiPattern.severity === "high"
			? "🔴"
			: antiPattern.severity === "medium"
				? "🟡"
				: "🟢";
	return `${emoji} ${antiPattern.antiPattern} in ${antiPattern.symbol}`;
}
