// ANSI color codes
export const ANSI = {
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	red: "\x1b[31m",
	cyan: "\x1b[36m",
	blue: "\x1b[34m",
	magenta: "\x1b[35m",
	reset: "\x1b[0m",
} as const;

// Color functions
export function bold(s: string): string {
	return `${ANSI.bold}${s}${ANSI.reset}`;
}

export function dim(s: string): string {
	return `${ANSI.dim}${s}${ANSI.reset}`;
}

export function green(s: string): string {
	return `${ANSI.green}${s}${ANSI.reset}`;
}

export function yellow(s: string): string {
	return `${ANSI.yellow}${s}${ANSI.reset}`;
}

export function red(s: string): string {
	return `${ANSI.red}${s}${ANSI.reset}`;
}

export function cyan(s: string): string {
	return `${ANSI.cyan}${s}${ANSI.reset}`;
}

export function blue(s: string): string {
	return `${ANSI.blue}${s}${ANSI.reset}`;
}

export function magenta(s: string): string {
	return `${ANSI.magenta}${s}${ANSI.reset}`;
}

// Formatting functions
export function truncate(s: string, max: number): string {
	return s.length > max ? `${s.slice(0, max)}...` : s;
}

export function formatMs(ms: number): string {
	if (ms < 1) {
		return "<1ms";
	}
	if (ms < 1000) {
		return `${Math.round(ms)}ms`;
	}
	return `${(ms / 1000).toFixed(2)}s`;
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes}B`;
	}
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(2)}KB`;
	}
	if (bytes < 1024 * 1024 * 1024) {
		return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
	}
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}

// Severity indicators
export function severityIcon(severity: "error" | "warning" | "info"): string {
	if (severity === "error") {
		return red("✗");
	}
	if (severity === "warning") {
		return yellow("⚠");
	}
	return cyan("ℹ");
}

// Language detection from file extension
export function detectFileLanguage(filePath: string): string {
	const ext = filePath.slice(filePath.lastIndexOf("."));
	const langMap: Record<string, string> = {
		".ts": "TypeScript",
		".tsx": "TypeScript",
		".js": "JavaScript",
		".jsx": "JavaScript",
		".py": "Python",
		".go": "Go",
		".rs": "Rust",
		".java": "Java",
		".cpp": "C++",
		".c": "C",
		".h": "C",
		".hpp": "C++",
		".cs": "C#",
		".rb": "Ruby",
		".php": "PHP",
		".swift": "Swift",
		".kt": "Kotlin",
		".scala": "Scala",
		".md": "Markdown",
		".json": "JSON",
		".yaml": "YAML",
		".yml": "YAML",
		".toml": "TOML",
	};
	return langMap[ext] ?? "Unknown";
}

// Progress bar
export function progressBar(
	current: number,
	total: number,
	width = 40
): string {
	const percentage = Math.min(100, Math.max(0, (current / total) * 100));
	const filled = Math.round((width * percentage) / 100);
	const empty = width - filled;
	const bar = "█".repeat(filled) + "░".repeat(empty);
	return `${cyan(bar)} ${percentage.toFixed(1)}%`;
}

// Table formatter helper
export function padRight(str: string, width: number): string {
	// Remove ANSI codes for length calculation
	const cleanStr = str.replace(/\x1b\[[0-9;]*m/g, "");
	const padding = Math.max(0, width - cleanStr.length);
	return str + " ".repeat(padding);
}

export function padLeft(str: string, width: number): string {
	// Remove ANSI codes for length calculation
	const cleanStr = str.replace(/\x1b\[[0-9;]*m/g, "");
	const padding = Math.max(0, width - cleanStr.length);
	return " ".repeat(padding) + str;
}

// Status messages
export function success(message: string): string {
	return `${green("✓")} ${message}`;
}

export function error(message: string): string {
	return `${red("✗")} ${message}`;
}

export function warning(message: string): string {
	return `${yellow("⚠")} ${message}`;
}

export function info(message: string): string {
	return `${cyan("ℹ")} ${message}`;
}

// Spinner frames for loading animations
export const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
