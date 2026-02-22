type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

let minLevel: LogLevel = (process.env.YEP_LOG_LEVEL as LogLevel) ?? "info";

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
