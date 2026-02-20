import { openai } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";
import { getEmbeddingModel } from "../lib/config.ts";

const MAX_RETRIES = 3;

function resolveModel() {
	const modelName = getEmbeddingModel();
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
	const { embeddings } = await embedMany({
		model: resolveModel(),
		values: texts,
		maxRetries: MAX_RETRIES,
	});

	progress?.onBatchComplete?.(texts.length, texts.length);

	return embeddings;
}
