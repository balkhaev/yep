// @ts-nocheck
import { describe, expect, it } from "bun:test";

/**
 * Tests for pure utility functions extracted from store.ts.
 * The DB-dependent functions (insertChunks, searchSolutions, etc.)
 * require a LanceDB connection and are better suited for integration tests.
 * Here we test the algorithmic/pure logic that can be unit-tested in isolation.
 */

function cosineSimilarity(a: number[], b: number[]): number {
	let dot = 0;
	let normA = 0;
	let normB = 0;
	for (let i = 0; i < a.length; i++) {
		const av = a[i] ?? 0;
		const bv = b[i] ?? 0;
		dot += av * bv;
		normA += av * av;
		normB += bv * bv;
	}
	const denom = Math.sqrt(normA) * Math.sqrt(normB);
	return denom === 0 ? 0 : dot / denom;
}

function computeRecencyBoost(timestamp: string): number {
	if (!timestamp) {
		return 0;
	}
	const ts = new Date(timestamp).getTime();
	if (Number.isNaN(ts)) {
		return 0;
	}
	const ageDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
	const HALF_LIFE = 14;
	return Math.exp((-Math.LN2 * ageDays) / HALF_LIFE);
}

function computeFileOverlap(
	filesChanged: string,
	filterFiles: string[]
): number {
	if (filterFiles.length === 0 || !filesChanged) {
		return 0;
	}
	const stored = filesChanged.toLowerCase();
	let matches = 0;
	for (const f of filterFiles) {
		if (stored.includes(f.toLowerCase())) {
			matches++;
		}
	}
	return matches / filterFiles.length;
}

const TOKEN_SPLIT_RE = /[\s/.,;:!?()[\]{}<>'"=+\-*&#@|\\`~^]+/;

function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.split(TOKEN_SPLIT_RE)
		.filter((t) => t.length > 2);
}

function escapeSql(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/'/g, "''").replace(/\0/g, "");
}

const RRF_K = 60;

function mergeWithRRF(
	vectorResults: Array<{ id: string }>,
	ftsResults: Array<{ id: string }>,
	limit: number
): Array<{ id: string; score: number }> {
	const scores = new Map<string, { score: number; id: string }>();

	for (const [rank, row] of vectorResults.entries()) {
		const entry = scores.get(row.id) ?? { score: 0, id: row.id };
		entry.score += 1 / (RRF_K + rank + 1);
		scores.set(row.id, entry);
	}

	for (const [rank, row] of ftsResults.entries()) {
		const entry = scores.get(row.id) ?? { score: 0, id: row.id };
		entry.score += 1 / (RRF_K + rank + 1);
		scores.set(row.id, entry);
	}

	return [...scores.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

describe("cosineSimilarity", () => {
	it("returns 1 for identical vectors", () => {
		const v = [1, 2, 3];
		expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
	});

	it("returns 0 for orthogonal vectors", () => {
		expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
	});

	it("returns -1 for opposite vectors", () => {
		expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 5);
	});

	it("returns 0 for zero vectors", () => {
		expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
	});

	it("handles high-dimensional vectors", () => {
		const a = Array.from({ length: 1536 }, (_, i) => Math.sin(i));
		const b = Array.from({ length: 1536 }, (_, i) => Math.sin(i));
		expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5);
	});
});

describe("computeRecencyBoost", () => {
	it("returns ~1 for very recent timestamps", () => {
		const now = new Date().toISOString();
		expect(computeRecencyBoost(now)).toBeCloseTo(1, 1);
	});

	it("returns ~0.5 for timestamps 14 days ago (half-life)", () => {
		const twoWeeksAgo = new Date(
			Date.now() - 14 * 24 * 60 * 60 * 1000
		).toISOString();
		expect(computeRecencyBoost(twoWeeksAgo)).toBeCloseTo(0.5, 1);
	});

	it("returns 0 for empty timestamp", () => {
		expect(computeRecencyBoost("")).toBe(0);
	});

	it("returns 0 for invalid timestamp", () => {
		expect(computeRecencyBoost("not-a-date")).toBe(0);
	});

	it("approaches 0 for very old timestamps", () => {
		const old = new Date("2020-01-01").toISOString();
		expect(computeRecencyBoost(old)).toBeLessThan(0.01);
	});
});

describe("computeFileOverlap", () => {
	it("returns 0 for empty filter", () => {
		expect(computeFileOverlap("file1.ts,file2.ts", [])).toBe(0);
	});

	it("returns 0 for empty filesChanged", () => {
		expect(computeFileOverlap("", ["file1.ts"])).toBe(0);
	});

	it("returns 1 when all filter files match", () => {
		expect(
			computeFileOverlap("src/a.ts,src/b.ts", ["src/a.ts", "src/b.ts"])
		).toBe(1);
	});

	it("returns partial overlap ratio", () => {
		expect(
			computeFileOverlap("src/a.ts,src/b.ts", ["src/a.ts", "src/c.ts"])
		).toBe(0.5);
	});

	it("is case-insensitive", () => {
		expect(computeFileOverlap("SRC/App.tsx", ["src/app.tsx"])).toBe(1);
	});
});

describe("tokenize", () => {
	it("splits text into lowercase tokens", () => {
		const tokens = tokenize("Hello World FooBar");
		expect(tokens).toContain("hello");
		expect(tokens).toContain("world");
		expect(tokens).toContain("foobar");
	});

	it("filters out short tokens (<=2 chars)", () => {
		const tokens = tokenize("I am a big test");
		expect(tokens).not.toContain("am");
		expect(tokens).not.toContain("a");
		expect(tokens).toContain("big");
		expect(tokens).toContain("test");
	});

	it("splits on various delimiters", () => {
		const tokens = tokenize("path/to/file.ts");
		expect(tokens).toContain("path");
		expect(tokens).toContain("file");
	});
});

describe("escapeSql", () => {
	it("escapes single quotes", () => {
		expect(escapeSql("it's")).toBe("it''s");
	});

	it("escapes backslashes", () => {
		expect(escapeSql("a\\b")).toBe("a\\\\b");
	});

	it("removes null bytes", () => {
		expect(escapeSql("a\0b")).toBe("ab");
	});

	it("handles clean strings", () => {
		expect(escapeSql("hello world")).toBe("hello world");
	});
});

describe("mergeWithRRF", () => {
	it("merges results from two sources", () => {
		const vector = [{ id: "a" }, { id: "b" }];
		const fts = [{ id: "b" }, { id: "c" }];
		const merged = mergeWithRRF(vector, fts, 10);

		expect(merged.find((r) => r.id === "b")!.score).toBeGreaterThan(
			merged.find((r) => r.id === "a")!.score
		);
	});

	it("ranks shared results higher", () => {
		const vector = [{ id: "shared" }, { id: "only-vec" }];
		const fts = [{ id: "shared" }, { id: "only-fts" }];
		const merged = mergeWithRRF(vector, fts, 10);
		expect(merged[0]!.id).toBe("shared");
	});

	it("respects limit", () => {
		const vector = Array.from({ length: 20 }, (_, i) => ({ id: `v${i}` }));
		const fts = Array.from({ length: 20 }, (_, i) => ({ id: `f${i}` }));
		const merged = mergeWithRRF(vector, fts, 5);
		expect(merged.length).toBe(5);
	});

	it("handles empty inputs", () => {
		expect(mergeWithRRF([], [], 10)).toEqual([]);
		expect(mergeWithRRF([{ id: "a" }], [], 10).length).toBe(1);
	});
});
