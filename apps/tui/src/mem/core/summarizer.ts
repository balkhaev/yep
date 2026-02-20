import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

const SUMMARIZER_MODEL = openai("gpt-4o-mini");
const MAX_INPUT_LENGTH = 6000;

function truncateForSummary(text: string): string {
	return text.length > MAX_INPUT_LENGTH
		? `${text.slice(0, MAX_INPUT_LENGTH)}...`
		: text;
}

export async function summarizeChunk(
	prompt: string,
	response: string,
	diffSummary: string
): Promise<string> {
	const input = [
		`User prompt: ${truncateForSummary(prompt)}`,
		response ? `Agent response: ${truncateForSummary(response)}` : "",
		diffSummary ? `Code changes: ${truncateForSummary(diffSummary)}` : "",
	]
		.filter(Boolean)
		.join("\n\n");

	try {
		const { text } = await generateText({
			model: SUMMARIZER_MODEL,
			maxOutputTokens: 200,
			temperature: 0,
			system:
				"Summarize this AI coding session in 2-3 sentences. Focus on: what problem was solved, what approach was taken, and what files/technologies were involved. Be specific and concise. Output only the summary, no preamble.",
			prompt: input,
		});
		return text.trim();
	} catch {
		return buildFallbackSummary(prompt, response, diffSummary);
	}
}

function buildFallbackSummary(
	prompt: string,
	response: string,
	diffSummary: string
): string {
	const parts = [`Question: ${prompt}`];
	if (response) {
		parts.push(`Answer: ${response.slice(0, 1500)}`);
	}
	if (diffSummary) {
		parts.push(`Changes: ${diffSummary.slice(0, 500)}`);
	}
	return parts.join("\n\n").slice(0, 4000);
}

export async function summarizeChunks(
	chunks: Array<{
		prompt: string;
		response: string;
		diffSummary: string;
	}>,
	onProgress?: (completed: number, total: number) => void
): Promise<string[]> {
	const summaries: string[] = [];
	const PARALLEL = 5;

	for (let i = 0; i < chunks.length; i += PARALLEL) {
		const batch = chunks.slice(i, i + PARALLEL);
		const results = await Promise.all(
			batch.map((c) => summarizeChunk(c.prompt, c.response, c.diffSummary))
		);
		summaries.push(...results);
		onProgress?.(Math.min(i + batch.length, chunks.length), chunks.length);
	}

	return summaries;
}
