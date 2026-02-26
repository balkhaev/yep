import { openai } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";
import { createOllama } from "ollama-ai-provider-v2";
import {
	getEmbeddingModel,
	getOllamaBaseUrl,
	getProvider,
} from "../lib/config.ts";
import { createLogger } from "../lib/logger.ts";
import { withRetry } from "../lib/retry.ts";
import { getCachedEmbedding, setCachedEmbedding } from "./cache.ts";

const log = createLogger("embedder");
const MAX_RETRIES = 3;

function resolveModel() {
	const provider = getProvider();
	const modelName = getEmbeddingModel();

	if (provider === "ollama") {
		const ollamaProvider = createOllama({ baseURL: getOllamaBaseUrl() });
		return ollamaProvider.textEmbeddingModel(modelName);
	}

	return openai.embeddingModel(modelName);
}

async function embedTextRaw(text: string): Promise<number[]> {
	return await withRetry(
		async () => {
			const { embedding } = await embed({
				model: resolveModel(),
				value: text,
				maxRetries: MAX_RETRIES,
			});
			return embedding;
		},
		{
			attempts: 3,
			onRetry: (err, attempt) => {
				log.warn(`Embedding retry ${attempt}`, {
					error: err instanceof Error ? err.message : String(err),
					textLength: text.length,
				});
			},
		}
	);
}

export async function embedText(text: string): Promise<number[]> {
	const cached = await getCachedEmbedding(text);
	if (cached) {
		return cached;
	}
	const vector = await embedTextRaw(text);
	await setCachedEmbedding(text, vector);
	return vector;
}

export interface EmbedProgress {
	onBatchComplete?: (completed: number, total: number) => void;
}

export async function embedTexts(
	texts: string[],
	progress?: EmbedProgress
): Promise<number[][]> {
	const provider = getProvider();

	if (provider === "ollama") {
		return embedTextsSequential(texts, progress);
	}

	const results: number[][] = new Array(texts.length);
	const uncachedIndices: number[] = [];
	const uncachedTexts: string[] = [];

	for (let i = 0; i < texts.length; i++) {
		const text = texts[i];
		if (!text) {
			continue;
		}
		const cached = await getCachedEmbedding(text);
		if (cached) {
			results[i] = cached;
		} else {
			uncachedIndices.push(i);
			uncachedTexts.push(text);
		}
	}

	if (uncachedTexts.length > 0) {
		const { embeddings } = await embedMany({
			model: resolveModel(),
			values: uncachedTexts,
			maxRetries: MAX_RETRIES,
		});

		for (let j = 0; j < uncachedIndices.length; j++) {
			const idx = uncachedIndices[j];
			const vec = embeddings[j];
			const text = uncachedTexts[j];
			if (idx !== undefined && vec && text) {
				results[idx] = vec;
				await setCachedEmbedding(text, vec);
			}
		}
	}

	progress?.onBatchComplete?.(texts.length, texts.length);
	return results;
}

async function embedTextsSequential(
	texts: string[],
	progress?: EmbedProgress
): Promise<number[][]> {
	const results: number[][] = [];
	const BATCH = 10;

	for (let i = 0; i < texts.length; i += BATCH) {
		const batch = texts.slice(i, i + BATCH);
		const batchResults = await Promise.all(batch.map(embedText));
		results.push(...batchResults);
		progress?.onBatchComplete?.(
			Math.min(i + batch.length, texts.length),
			texts.length
		);
	}

	return results;
}
