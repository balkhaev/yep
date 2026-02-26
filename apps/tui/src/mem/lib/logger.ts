import {
	error as errorIcon,
	info as infoIcon,
	success as successIcon,
	warning as warningIcon,
} from "./cli-utils.ts";

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

let minLevel: LogLevel = (process.env.YEP_LOG_LEVEL as LogLevel) ?? "info";
const isQuiet = process.env.YEP_QUIET === "1";
const isVerbose = process.env.YEP_VERBOSE === "1";

export function setLogLevel(level: LogLevel): void {
	minLevel = level;
}

function shouldLog(level: LogLevel): boolean {
	return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
}

function formatEntry(
	level: LogLevel,
	module: string,
	message: string,
	meta?: Record<string, unknown>
): string {
	const ts = new Date().toISOString();
	const base = `${ts} [${level.toUpperCase()}] [${module}] ${message}`;
	if (meta && Object.keys(meta).length > 0) {
		return `${base} ${JSON.stringify(meta)}`;
	}
	return base;
}

export interface Logger {
	debug(message: string, meta?: Record<string, unknown>): void;
	error(message: string, meta?: Record<string, unknown>): void;
	info(message: string, meta?: Record<string, unknown>): void;
	warn(message: string, meta?: Record<string, unknown>): void;
}

export function createLogger(module: string): Logger {
	return {
		debug(message, meta) {
			if (shouldLog("debug")) {
				console.debug(formatEntry("debug", module, message, meta));
			}
		},
		info(message, meta) {
			if (shouldLog("info")) {
				console.info(formatEntry("info", module, message, meta));
			}
		},
		warn(message, meta) {
			if (shouldLog("warn")) {
				console.warn(formatEntry("warn", module, message, meta));
			}
		},
		error(message, meta) {
			if (shouldLog("error")) {
				console.error(formatEntry("error", module, message, meta));
			}
		},
	};
}

// CLI Logger for user-facing output
export interface CliLogger {
	error(message: string): void;
	info(message: string): void;
	log(message: string): void;
	progress(message: string): void;
	success(message: string): void;
	warning(message: string): void;
}

export function createCliLogger(): CliLogger {
	return {
		success(message: string): void {
			if (!isQuiet) {
				console.log(successIcon(message));
			}
		},
		info(message: string): void {
			if (!isQuiet) {
				console.log(infoIcon(message));
			}
		},
		warning(message: string): void {
			if (!isQuiet) {
				console.log(warningIcon(message));
			}
		},
		error(message: string): void {
			// Errors are always shown, even in quiet mode
			console.error(errorIcon(message));
		},
		progress(message: string): void {
			if (!isQuiet && isVerbose) {
				console.log(message);
			}
		},
		log(message: string): void {
			if (!isQuiet) {
				console.log(message);
			}
		},
	};
}
