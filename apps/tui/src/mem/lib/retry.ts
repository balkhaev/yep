import { createLogger } from "./logger.ts";

const log = createLogger("retry");

export interface RetryOptions {
	attempts?: number;
	baseDelayMs?: number;
	maxDelayMs?: number;
	onRetry?: (error: unknown, attempt: number) => void;
}

const DEFAULTS: Required<Omit<RetryOptions, "onRetry">> = {
	attempts: 3,
	baseDelayMs: 1000,
	maxDelayMs: 10_000,
};

function computeDelay(attempt: number, base: number, max: number): number {
	const delay = base * 2 ** (attempt - 1);
	const jitter = delay * 0.2 * Math.random();
	return Math.min(delay + jitter, max);
}

function isRetryable(error: unknown): boolean {
	if (error instanceof Error) {
		const msg = error.message.toLowerCase();
		if (msg.includes("rate limit") || msg.includes("429")) {
			return true;
		}
		if (msg.includes("timeout") || msg.includes("econnreset")) {
			return true;
		}
		if (msg.includes("503") || msg.includes("502") || msg.includes("500")) {
			return true;
		}
		if (msg.includes("network") || msg.includes("fetch failed")) {
			return true;
		}
	}
	return false;
}

export async function withRetry<T>(
	fn: () => Promise<T>,
	options?: RetryOptions
): Promise<T> {
	const { attempts, baseDelayMs, maxDelayMs } = { ...DEFAULTS, ...options };
	let lastError: unknown;

	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;

			if (attempt === attempts || !isRetryable(error)) {
				throw error;
			}

			const delay = computeDelay(attempt, baseDelayMs, maxDelayMs);
			log.warn(
				`Attempt ${attempt}/${attempts} failed, retrying in ${Math.round(delay)}ms`,
				{
					error: error instanceof Error ? error.message : String(error),
				}
			);

			options?.onRetry?.(error, attempt);
			await new Promise((r) => setTimeout(r, delay));
		}
	}

	throw lastError;
}
