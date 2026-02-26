// @ts-nocheck
import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
	buildSearchCacheKey,
	clearCache,
	getCachedEmbedding,
	getCachedSearch,
	setCachedEmbedding,
	setCachedSearch,
} from "../cache.ts";

const ORIGINAL_CWD = process.cwd();
const TMP_PROJECT = join(import.meta.dir, ".tmp-cache-project");

beforeAll(() => {
	mkdirSync(join(TMP_PROJECT, ".yep-mem", "vectors"), { recursive: true });
	process.chdir(TMP_PROJECT);
});

afterEach(async () => {
	await clearCache();
});

afterAll(() => {
	process.chdir(ORIGINAL_CWD);
	rmSync(TMP_PROJECT, { recursive: true, force: true });
});

describe("embedding cache", () => {
	it("returns null for unknown text", async () => {
		expect(await getCachedEmbedding("unknown text")).toBeNull();
	});

	it("stores and retrieves embeddings", async () => {
		const vec = [0.1, 0.2, 0.3];
		await setCachedEmbedding("test text", vec);
		const cached = await getCachedEmbedding("test text");
		expect(cached).toEqual(vec);
	});

	it("returns null after cache is cleared", async () => {
		await setCachedEmbedding("persist test", [1, 2, 3]);
		await clearCache();
		expect(await getCachedEmbedding("persist test")).toBeNull();
	});

	it("handles LRU eviction", async () => {
		for (let i = 0; i < 210; i++) {
			await setCachedEmbedding(`entry-${i}`, [i]);
		}
		// After eviction, cache should contain at most 200 entries
		// The most recent entries should survive
		expect(await getCachedEmbedding("entry-209")).toEqual([209]);
		expect(await getCachedEmbedding("entry-200")).toEqual([200]);
	});
});

describe("search cache", () => {
	it("returns null for unknown query hash", async () => {
		expect(await getCachedSearch("nonexistent")).toBeNull();
	});

	it("stores and retrieves search results", async () => {
		const results = [{ id: "1", score: 0.9 }];
		await setCachedSearch("query-hash", results);
		const cached = await getCachedSearch("query-hash");
		expect(cached).toEqual(results);
	});

	it("returns null after clearing", async () => {
		await setCachedSearch("clear-test", [{ id: "x" }]);
		await clearCache();
		expect(await getCachedSearch("clear-test")).toBeNull();
	});
});

describe("buildSearchCacheKey", () => {
	it("produces consistent keys for same inputs", () => {
		const key1 = buildSearchCacheKey("query", 5, { agent: "cursor" });
		const key2 = buildSearchCacheKey("query", 5, { agent: "cursor" });
		expect(key1).toBe(key2);
	});

	it("produces different keys for different inputs", () => {
		const key1 = buildSearchCacheKey("query1", 5, {});
		const key2 = buildSearchCacheKey("query2", 5, {});
		expect(key1).not.toBe(key2);
	});

	it("returns a 24-char hex string", () => {
		const key = buildSearchCacheKey("test", 3, {});
		expect(key.length).toBe(24);
		expect(/^[0-9a-f]{24}$/.test(key)).toBe(true);
	});
});
