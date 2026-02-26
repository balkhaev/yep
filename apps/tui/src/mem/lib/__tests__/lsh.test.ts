// @ts-nocheck
import { describe, expect, it } from "bun:test";
import { buildLSHIndex, LSHIndex } from "../lsh.ts";

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

function normalize(vec: number[]): number[] {
	const mag = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
	return mag === 0 ? vec : vec.map((v) => v / mag);
}

describe("LSH Index", () => {
	it("finds identical vectors", () => {
		const index = new LSHIndex<string>(3);
		const vec1 = [1, 2, 3];
		const vec2 = [1, 2, 3];

		index.add(vec1, "first");
		const similar = index.findSimilar(vec2, 0.99, cosineSimilarity);

		expect(similar).toContain("first");
	});

	it("finds similar vectors", () => {
		const index = new LSHIndex<string>(3);
		const vec1 = normalize([1, 2, 3]);
		const vec2 = normalize([1.1, 2.1, 2.9]); // Very similar

		index.add(vec1, "similar");
		const results = index.findSimilar(vec2, 0.95, cosineSimilarity);

		expect(results.length).toBeGreaterThan(0);
	});

	it("does not find dissimilar vectors", () => {
		const index = new LSHIndex<string>(3);
		const vec1 = [1, 0, 0];
		const vec2 = [0, 1, 0]; // Orthogonal

		index.add(vec1, "first");
		const similar = index.findSimilar(vec2, 0.5, cosineSimilarity);

		expect(similar).not.toContain("first");
	});

	it("handles multiple vectors", () => {
		const index = new LSHIndex<number>(3);

		index.add([1, 0, 0], 0);
		index.add([0, 1, 0], 1);
		index.add([0, 0, 1], 2);
		index.add([1.1, 0, 0], 3); // Similar to first

		const similar = index.findSimilar([1, 0, 0], 0.9, cosineSimilarity);

		expect(similar).toContain(0);
		expect(similar).toContain(3);
		expect(similar.length).toBe(2);
	});

	it("clears index", () => {
		const index = new LSHIndex<string>(3);
		index.add([1, 2, 3], "data");

		index.clear();

		const results = index.findSimilar([1, 2, 3], 0.99, cosineSimilarity);
		expect(results.length).toBe(0);
	});

	it("works with high-dimensional vectors", () => {
		const dim = 128;
		const index = new LSHIndex<string>(dim);

		const vec1 = Array.from({ length: dim }, (_, i) => Math.cos(i));
		const vec2 = Array.from({ length: dim }, (_, i) => Math.cos(i + 0.1));

		index.add(vec1, "high-dim");
		const similar = index.findSimilar(vec2, 0.9, cosineSimilarity);

		expect(similar).toContain("high-dim");
	});

	it("handles edge case: zero vector", () => {
		const index = new LSHIndex<string>(3);
		const zero = [0, 0, 0];
		const nonzero = [1, 2, 3];

		index.add(nonzero, "data");
		const results = index.findSimilar(zero, 0.5, cosineSimilarity);

		// Zero vector has no similarity with any vector
		expect(results.length).toBe(0);
	});
});

describe("buildLSHIndex", () => {
	it("builds index from vectors and data", () => {
		const vectors = [
			[1, 0, 0],
			[0, 1, 0],
			[0, 0, 1],
		];
		const data = ["a", "b", "c"];

		const index = buildLSHIndex(vectors, data);
		const similar = index.findSimilar([1, 0, 0], 0.99, cosineSimilarity);

		expect(similar).toContain("a");
	});

	it("handles empty inputs", () => {
		const index = buildLSHIndex<string>([], []);
		const results = index.findSimilar([1, 2, 3], 0.5, cosineSimilarity);

		expect(results.length).toBe(0);
	});
});
