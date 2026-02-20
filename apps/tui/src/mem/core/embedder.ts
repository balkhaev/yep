import { openai } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";

const EMBEDDING_MODEL = openai.embeddingModel("text-embedding-3-small");
const MAX_RETRIES = 3;

export async function embedText(text: string): Promise<number[]> {
	const { embedding } = await embed({
		model: EMBEDDING_MODEL,
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
		model: EMBEDDING_MODEL,
		values: texts,
		maxRetries: MAX_RETRIES,
	});

	progress?.onBatchComplete?.(texts.length, texts.length);

	return embeddings;
}
