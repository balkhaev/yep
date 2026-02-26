/**
 * Locality-Sensitive Hashing (LSH) for fast approximate similarity search.
 * Uses random hyperplanes to hash vectors into buckets.
 * Reduces O(n²) similarity search to O(n log n) on average.
 */

interface LSHEntry<T> {
	data: T;
	vector: number[];
}

/**
 * Single LSH table using random hyperplanes
 */
class LSHTable<T> {
	private readonly hyperplanes: number[][];
	private readonly buckets: Map<string, LSHEntry<T>[]>;
	private readonly dimensions: number;
	private readonly numPlanes: number;

	constructor(dimensions: number, numPlanes: number) {
		this.dimensions = dimensions;
		this.numPlanes = numPlanes;
		this.hyperplanes = this.generateHyperplanes();
		this.buckets = new Map();
	}

	private generateHyperplanes(): number[][] {
		const planes: number[][] = [];
		for (let i = 0; i < this.numPlanes; i++) {
			const plane: number[] = [];
			for (let j = 0; j < this.dimensions; j++) {
				// Standard normal distribution (mean=0, stddev=1)
				plane.push(this.randomNormal());
			}
			planes.push(plane);
		}
		return planes;
	}

	private randomNormal(): number {
		// Box-Muller transform for standard normal distribution
		const u1 = Math.random();
		const u2 = Math.random();
		return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
	}

	private hash(vector: number[]): string {
		let hash = "";
		for (const plane of this.hyperplanes) {
			let dot = 0;
			for (let i = 0; i < vector.length; i++) {
				dot += (vector[i] ?? 0) * (plane[i] ?? 0);
			}
			hash += dot >= 0 ? "1" : "0";
		}
		return hash;
	}

	add(vector: number[], data: T): void {
		const hashKey = this.hash(vector);
		const bucket = this.buckets.get(hashKey) ?? [];
		bucket.push({ vector, data });
		this.buckets.set(hashKey, bucket);
	}

	getCandidates(vector: number[]): LSHEntry<T>[] {
		const hashKey = this.hash(vector);
		return this.buckets.get(hashKey) ?? [];
	}

	clear(): void {
		this.buckets.clear();
	}
}

/**
 * LSH Index using multiple tables for better recall
 */
export class LSHIndex<T> {
	private readonly tables: LSHTable<T>[];

	/**
	 * @param dimensions - Dimension of vectors
	 * @param numPlanes - Number of hyperplanes per table (hash bits)
	 * @param numTables - Number of independent hash tables
	 */
	constructor(dimensions: number, numPlanes = 16, numTables = 4) {
		this.tables = [];
		for (let i = 0; i < numTables; i++) {
			this.tables.push(new LSHTable<T>(dimensions, numPlanes));
		}
	}

	/**
	 * Add a vector to the index
	 */
	add(vector: number[], data: T): void {
		for (const table of this.tables) {
			table.add(vector, data);
		}
	}

	/**
	 * Find similar vectors using LSH + exact cosine similarity
	 * @param vector - Query vector
	 * @param threshold - Cosine similarity threshold (0-1)
	 * @returns Array of data for vectors above threshold
	 */
	findSimilar(
		vector: number[],
		threshold: number,
		cosineSimilarity: (a: number[], b: number[]) => number
	): T[] {
		// Collect candidates from all tables
		const candidateMap = new Map<T, number[]>();
		for (const table of this.tables) {
			const candidates = table.getCandidates(vector);
			for (const candidate of candidates) {
				// Deduplicate by data (key)
				if (!candidateMap.has(candidate.data)) {
					candidateMap.set(candidate.data, candidate.vector);
				}
			}
		}

		// Filter by exact cosine similarity
		const results: T[] = [];
		for (const [data, candidateVector] of candidateMap) {
			const similarity = cosineSimilarity(vector, candidateVector);
			if (similarity > threshold) {
				results.push(data);
			}
		}

		return results;
	}

	/**
	 * Clear all data from the index
	 */
	clear(): void {
		for (const table of this.tables) {
			table.clear();
		}
	}
}

/**
 * Helper to build LSH index from vectors
 */
export function buildLSHIndex<T>(
	vectors: number[][],
	data: T[],
	dimensions?: number
): LSHIndex<T> {
	const dim = dimensions ?? vectors[0]?.length ?? 0;
	const index = new LSHIndex<T>(dim);

	for (let i = 0; i < vectors.length; i++) {
		const vec = vectors[i];
		const d = data[i];
		if (vec && d !== undefined) {
			index.add(vec, d);
		}
	}

	return index;
}
