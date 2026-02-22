import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";

const LOCK_FILE = "sync.lock";
const STALE_LOCK_MS = 5 * 60 * 1000;

function getLockDir(): string {
	return join(process.cwd(), ".yep-mem");
}

function getLockPath(): string {
	return join(getLockDir(), LOCK_FILE);
}

interface LockInfo {
	pid: number;
	ts: number;
}

function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

function isLockStale(lock: LockInfo): boolean {
	if (Date.now() - lock.ts > STALE_LOCK_MS) {
		return true;
	}
	return !isProcessAlive(lock.pid);
}

export function acquireSyncLock(): boolean {
	const lockPath = getLockPath();
	const dir = getLockDir();

	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}

	if (existsSync(lockPath)) {
		try {
			const raw = readFileSync(lockPath, "utf-8");
			const lock = JSON.parse(raw) as LockInfo;
			if (!isLockStale(lock)) {
				return false;
			}
		} catch {
			// Corrupted lock file — treat as stale
		}
	}

	const info: LockInfo = { pid: process.pid, ts: Date.now() };
	writeFileSync(lockPath, JSON.stringify(info));
	return true;
}

export function releaseSyncLock(): void {
	const lockPath = getLockPath();
	try {
		if (existsSync(lockPath)) {
			const raw = readFileSync(lockPath, "utf-8");
			const lock = JSON.parse(raw) as LockInfo;
			if (lock.pid === process.pid) {
				rmSync(lockPath, { force: true });
			}
		}
	} catch {
		rmSync(lockPath, { force: true });
	}
}

export async function withSyncLock<T>(fn: () => Promise<T>): Promise<T> {
	if (!acquireSyncLock()) {
		throw new Error(
			"Another sync operation is in progress. Wait or remove .yep-mem/sync.lock"
		);
	}

	try {
		return await fn();
	} finally {
		releaseSyncLock();
	}
}
