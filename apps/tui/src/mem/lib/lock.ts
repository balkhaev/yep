import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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

export async function acquireSyncLock(): Promise<boolean> {
	const lockPath = getLockPath();
	const dir = getLockDir();

	try {
		await access(dir);
	} catch {
		await mkdir(dir, { recursive: true });
	}

	try {
		await access(lockPath);
		const raw = await readFile(lockPath, "utf-8");
		const lock = JSON.parse(raw) as LockInfo;
		if (!isLockStale(lock)) {
			return false;
		}
	} catch {
		// Lock file doesn't exist or is corrupted — treat as stale
	}

	const info: LockInfo = { pid: process.pid, ts: Date.now() };
	await writeFile(lockPath, JSON.stringify(info));
	return true;
}

export async function releaseSyncLock(): Promise<void> {
	const lockPath = getLockPath();
	try {
		await access(lockPath);
		const raw = await readFile(lockPath, "utf-8");
		const lock = JSON.parse(raw) as LockInfo;
		if (lock.pid === process.pid) {
			await rm(lockPath, { force: true });
		}
	} catch {
		await rm(lockPath, { force: true });
	}
}

export async function withSyncLock<T>(fn: () => Promise<T>): Promise<T> {
	if (!(await acquireSyncLock())) {
		throw new Error(
			"Another sync operation is in progress. Wait or remove .yep-mem/sync.lock"
		);
	}

	try {
		return await fn();
	} finally {
		await releaseSyncLock();
	}
}
