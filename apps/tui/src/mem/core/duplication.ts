import type { Table } from "@lancedb/lancedb";
import { createLogger } from "../lib/logger.ts";
import { LSHIndex } from "../lib/lsh.ts";

const log = createLogger("duplication");

export interface DuplicateCluster {
	similarity: number;
	symbols: Array<{ path: string; symbol: string; symbolType: string }>;
}

interface VectorRow {
	body: string;
	id: string;
	path: string;
	symbol: string;
	symbolType: string;
	vector: number[];
}

const MIN_BODY_LINES = 5;
const SIMILARITY_THRESHOLD = 0.92;
const MAX_CANDIDATES = 200;

function cosine(a: number[], b: number[]): number {
	let dot = 0;
	let magA = 0;
	let magB = 0;
	for (let i = 0; i < a.length; i++) {
		const ai = a[i] ?? 0;
		const bi = b[i] ?? 0;
		dot += ai * bi;
		magA += ai * ai;
		magB += bi * bi;
	}
	const denom = Math.sqrt(magA) * Math.sqrt(magB);
	return denom === 0 ? 0 : dot / denom;
}

export async function findDuplicateClusters(
	table: Table
): Promise<DuplicateCluster[]> {
	let rows: VectorRow[];
	try {
		rows = (await table
			.query()
			.select(["id", "symbol", "symbolType", "path", "body", "vector"])
			.limit(MAX_CANDIDATES)
			.toArray()) as VectorRow[];
	} catch (err) {
		log.warn("Failed to query for duplicates", { error: String(err) });
		return [];
	}

	const candidates = rows.filter(
		(r) => r.body && r.body.split("\n").length >= MIN_BODY_LINES
	);

	if (candidates.length === 0) {
		return [];
	}

	// Build LSH index for fast similarity search
	const dimensions = candidates[0]?.vector.length ?? 0;
	const lshIndex = new LSHIndex<number>(dimensions);

	// Add all candidates to LSH index
	for (let i = 0; i < candidates.length; i++) {
		const candidate = candidates[i];
		if (candidate?.vector) {
			lshIndex.add(candidate.vector, i);
		}
	}

	const clustered = new Set<string>();
	const clusters: DuplicateCluster[] = [];

	for (let i = 0; i < candidates.length; i++) {
		const a = candidates[i];
		if (!a || clustered.has(a.id)) {
			continue;
		}

		const group: DuplicateCluster["symbols"] = [
			{ symbol: a.symbol, path: a.path, symbolType: a.symbolType },
		];
		let maxSim = 0;

		// Use LSH to find candidate duplicates
		const similarIndices = lshIndex.findSimilar(
			a.vector,
			SIMILARITY_THRESHOLD,
			cosine
		);

		// Check LSH candidates with exact cosine similarity
		for (const j of similarIndices) {
			if (j <= i) {
				continue; // Skip self and already processed
			}

			const b = candidates[j];
			if (!b || clustered.has(b.id)) {
				continue;
			}
			if (a.symbol === b.symbol && a.path === b.path) {
				continue;
			}

			const sim = cosine(a.vector, b.vector);
			if (sim >= SIMILARITY_THRESHOLD) {
				group.push({
					symbol: b.symbol,
					path: b.path,
					symbolType: b.symbolType,
				});
				maxSim = Math.max(maxSim, sim);
				clustered.add(b.id);
			}
		}

		if (group.length > 1) {
			clustered.add(a.id);
			clusters.push({
				symbols: group,
				similarity: Math.round(maxSim * 100) / 100,
			});
		}
	}

	return clusters.sort((a, b) => b.symbols.length - a.symbols.length);
}
