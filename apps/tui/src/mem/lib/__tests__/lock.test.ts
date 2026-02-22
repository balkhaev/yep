import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { acquireSyncLock, releaseSyncLock, withSyncLock } from "../lock.ts";

const ORIGINAL_CWD = process.cwd();
const TMP_PROJECT = join(import.meta.dir, ".tmp-lock-project");

beforeAll(() => {
	mkdirSync(join(TMP_PROJECT, ".yep-mem"), { recursive: true });
	process.chdir(TMP_PROJECT);
});

afterEach(() => {
	releaseSyncLock();
});

afterAll(() => {
	process.chdir(ORIGINAL_CWD);
	rmSync(TMP_PROJECT, { recursive: true, force: true });
});

describe("acquireSyncLock", () => {
	it("acquires lock when no lock exists", () => {
		expect(acquireSyncLock()).toBe(true);
	});

	it("rejects second lock from same process", () => {
		acquireSyncLock();
		// Same PID, so the lock is considered held by us - not stale
		// The function should still return false because a lock exists and is alive
		const second = acquireSyncLock();
		// Since the PID is alive, this should return false
		expect(second).toBe(false);
	});

	it("releases and re-acquires", () => {
		acquireSyncLock();
		releaseSyncLock();
		expect(acquireSyncLock()).toBe(true);
	});
});

describe("withSyncLock", () => {
	it("executes function and releases lock", async () => {
		const result = await withSyncLock(async () => "done");
		expect(result).toBe("done");
		expect(acquireSyncLock()).toBe(true);
	});

	it("releases lock on error", async () => {
		try {
			await withSyncLock(async () => {
				throw new Error("fail");
			});
		} catch {
			// expected
		}
		expect(acquireSyncLock()).toBe(true);
	});

	it("rejects concurrent lock attempts", async () => {
		let released = false;
		const first = withSyncLock(async () => {
			await new Promise((r) => setTimeout(r, 50));
			released = true;
			return "first";
		});

		await new Promise((r) => setTimeout(r, 10));
		await expect(withSyncLock(async () => "second")).rejects.toThrow(
			"Another sync operation"
		);

		const result = await first;
		expect(result).toBe("first");
		expect(released).toBe(true);
	});
});
