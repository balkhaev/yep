/**
 * ANSI color codes для терминала
 * Используем True Color (24-bit) для точной передачи цветов
 */

// Базовая функция для создания ANSI escape codes
function rgb(r: number, g: number, b: number): string {
	return `\x1b[38;2;${r};${g};${b}m`;
}

function bgRgb(r: number, g: number, b: number): string {
	return `\x1b[48;2;${r};${g};${b}m`;
}

/**
 * Цветовая палитра согласованная с Desktop приложением
 */
export const COLORS = {
	// Акцентные цвета (primary palette)
	indigo: rgb(99, 102, 241), // #6366f1
	blue: rgb(59, 130, 246), // #3b82f6
	emerald: rgb(16, 185, 129), // #10b981
	amber: rgb(245, 158, 11), // #f59e0b
	pink: rgb(236, 72, 153), // #ec4899
	purple: rgb(168, 85, 247), // #a855f7
	cyan: rgb(6, 182, 212), // #06b6d4
	orange: rgb(249, 115, 22), // #f97316
	red: rgb(239, 68, 68), // #ef4444
	lime: rgb(132, 204, 22), // #84cc16

	// Zinc палитра (grayscale)
	zinc50: rgb(250, 250, 250), // #fafafa
	zinc100: rgb(244, 244, 245), // #f4f4f5
	zinc200: rgb(228, 228, 231), // #e4e4e7
	zinc300: rgb(212, 212, 216), // #d4d4d8
	zinc400: rgb(161, 161, 170), // #a1a1aa
	zinc500: rgb(113, 113, 122), // #71717a
	zinc600: rgb(82, 82, 91), // #52525b
	zinc700: rgb(63, 63, 70), // #3f3f46
	zinc800: rgb(39, 39, 42), // #27272a
	zinc900: rgb(24, 24, 27), // #18181b
	zinc950: rgb(9, 9, 11), // #09090b

	// Утилиты
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	italic: "\x1b[3m",
	underline: "\x1b[4m",
} as const;

/**
 * Background colors
 */
export const BG_COLORS = {
	indigo: bgRgb(99, 102, 241),
	blue: bgRgb(59, 130, 246),
	emerald: bgRgb(16, 185, 129),
	amber: bgRgb(245, 158, 11),
	red: bgRgb(239, 68, 68),

	zinc800: bgRgb(39, 39, 42),
	zinc900: bgRgb(24, 24, 27),
	zinc950: bgRgb(9, 9, 11),
} as const;

/**
 * Семантические цвета для различных контекстов
 */
export const SEMANTIC = {
	// Primary actions и акценты
	primary: COLORS.indigo,

	// Состояния
	success: COLORS.emerald,
	warning: COLORS.amber,
	error: COLORS.red,
	info: COLORS.blue,

	// Текстовые уровни
	text: COLORS.zinc100, // Основной текст
	muted: COLORS.zinc500, // Приглушенный текст
	subtle: COLORS.zinc600, // Едва заметный текст
	disabled: COLORS.zinc700, // Отключенный текст

	// Границы и разделители
	border: COLORS.zinc800,
	divider: COLORS.zinc700,
} as const;

/**
 * Иконки для различных типов символов кода
 */
export const SYMBOL_ICONS = {
	function: "ƒ", // Function
	method: "ƒ", // Method (same as function)
	class: "C", // Class
	interface: "I", // Interface
	type: "T", // Type
	enum: "E", // Enum
	component: "◇", // Component (diamond)
	variable: "v", // Variable
	constant: "k", // Constant (from "konstant")
	module: "M", // Module
	namespace: "N", // Namespace
	property: "p", // Property
	field: "f", // Field
} as const;

/**
 * Цвета для различных типов символов (согласовано с GUI)
 */
export const SYMBOL_COLORS = {
	function: COLORS.blue, // #3b82f6
	method: COLORS.blue,
	class: COLORS.purple, // #a855f7
	interface: COLORS.amber, // #f59e0b
	type: COLORS.pink, // #ec4899
	enum: COLORS.orange, // #f97316
	component: COLORS.emerald, // #10b981
	variable: COLORS.cyan, // #06b6d4
	constant: COLORS.lime, // #84cc16
	module: COLORS.indigo, // #6366f1
	namespace: COLORS.purple,
	property: COLORS.cyan,
	field: COLORS.zinc400,
} as const;

/**
 * Цвета для различных языков программирования
 */
export const LANGUAGE_COLORS = {
	typescript: COLORS.blue, // #3b82f6
	javascript: COLORS.amber, // #f59e0b
	python: COLORS.emerald, // #10b981
	go: COLORS.cyan, // #06b6d4
	rust: COLORS.orange, // #f97316
	java: COLORS.red, // #ef4444
	csharp: COLORS.purple, // #a855f7
	ruby: COLORS.red,
	php: COLORS.purple,
	swift: COLORS.orange,
	kotlin: COLORS.purple,
	default: COLORS.zinc400,
} as const;

/**
 * Индикаторы здоровья кода
 */
export const HEALTH_COLORS = {
	excellent: COLORS.emerald, // 90-100%
	good: COLORS.lime, // 70-89%
	fair: COLORS.amber, // 50-69%
	poor: COLORS.orange, // 30-49%
	critical: COLORS.red, // 0-29%
} as const;

/**
 * Получить цвет здоровья на основе процента
 */
export function getHealthColor(percentage: number): string {
	if (percentage >= 90) {
		return HEALTH_COLORS.excellent;
	}
	if (percentage >= 70) {
		return HEALTH_COLORS.good;
	}
	if (percentage >= 50) {
		return HEALTH_COLORS.fair;
	}
	if (percentage >= 30) {
		return HEALTH_COLORS.poor;
	}
	return HEALTH_COLORS.critical;
}

/**
 * Utility функция для цветного текста с сбросом
 */
export function colorize(text: string, color: string): string {
	return `${color}${text}${COLORS.reset}`;
}

/**
 * Создать progress bar с цветовым индикатором
 */
export function progressBar(value: number, max = 100, width = 20): string {
	const percentage = Math.min(100, Math.max(0, (value / max) * 100));
	const filled = Math.round((percentage / 100) * width);
	const empty = width - filled;

	const color = getHealthColor(percentage);
	const bar = "█".repeat(filled) + "░".repeat(empty);

	return `${color}${bar}${COLORS.reset}`;
}

/**
 * Форматировать число с цветом в зависимости от значения
 */
export function formatNumber(
	value: number,
	options?: {
		suffix?: string;
		good?: number;
		bad?: number;
	}
): string {
	const { suffix = "", good, bad } = options ?? {};

	let color = COLORS.zinc100;
	if (good !== undefined && value >= good) {
		color = SEMANTIC.success;
	} else if (bad !== undefined && value >= bad) {
		color = SEMANTIC.warning;
	} else if (bad !== undefined && value < bad) {
		color = SEMANTIC.error;
	}

	return colorize(`${value}${suffix}`, color);
}

/**
 * Создать badge с фоновым цветом
 */
export function badge(
	text: string,
	variant: "primary" | "success" | "warning" | "error" | "muted" = "muted"
): string {
	const colorMap = {
		primary: { bg: BG_COLORS.indigo, fg: COLORS.zinc100 },
		success: { bg: BG_COLORS.emerald, fg: COLORS.zinc950 },
		warning: { bg: BG_COLORS.amber, fg: COLORS.zinc950 },
		error: { bg: BG_COLORS.red, fg: COLORS.zinc100 },
		muted: { bg: BG_COLORS.zinc800, fg: COLORS.zinc400 },
	};

	const { bg, fg } = colorMap[variant];
	return `${bg}${fg} ${text} ${COLORS.reset}`;
}
