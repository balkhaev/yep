import { openai } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";
import { createOllama } from "ollama-ai-provider-v2";
import {
	getEmbeddingModel,
	getOllamaBaseUrl,
	getProvider,
} from "../lib/config.ts";

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

export async function embedText(text: string): Promise<number[]> {
	const { embedding } = await embed({
		model: resolveModel(),
		value: text,
		maxRetries: MAX_RETRIES,
	});
	return embedding;
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

	const { embeddings } = await embedMany({
		model: resolveModel(),
		values: texts,
		maxRetries: MAX_RETRIES,
	});

	progress?.onBatchComplete?.(texts.length, texts.length);
	return embeddings;
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
