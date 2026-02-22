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

afterEach(() => {
	clearCache();
});

afterAll(() => {
	process.chdir(ORIGINAL_CWD);
	rmSync(TMP_PROJECT, { recursive: true, force: true });
});

describe("embedding cache", () => {
	it("returns null for unknown text", () => {
		expect(getCachedEmbedding("unknown text")).toBeNull();
	});

	it("stores and retrieves embeddings", () => {
		const vec = [0.1, 0.2, 0.3];
		setCachedEmbedding("test text", vec);
		const cached = getCachedEmbedding("test text");
		expect(cached).toEqual(vec);
	});

	it("returns null after cache is cleared", () => {
		setCachedEmbedding("persist test", [1, 2, 3]);
		clearCache();
		expect(getCachedEmbedding("persist test")).toBeNull();
	});

	it("handles LRU eviction", () => {
		for (let i = 0; i < 210; i++) {
			setCachedEmbedding(`entry-${i}`, [i]);
		}
		// After eviction, cache should contain at most 200 entries
		// The most recent entries should survive
		expect(getCachedEmbedding("entry-209")).toEqual([209]);
		expect(getCachedEmbedding("entry-200")).toEqual([200]);
	});
});

describe("search cache", () => {
	it("returns null for unknown query hash", () => {
		expect(getCachedSearch("nonexistent")).toBeNull();
	});

	it("stores and retrieves search results", () => {
		const results = [{ id: "1", score: 0.9 }];
		setCachedSearch("query-hash", results);
		const cached = getCachedSearch("query-hash");
		expect(cached).toEqual(results);
	});

	it("returns null after clearing", () => {
		setCachedSearch("clear-test", [{ id: "x" }]);
		clearCache();
		expect(getCachedSearch("clear-test")).toBeNull();
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
