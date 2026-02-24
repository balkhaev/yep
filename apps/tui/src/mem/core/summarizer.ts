import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { createOllama } from "ollama-ai-provider-v2";
import {
	getOllamaBaseUrl,
	getProvider,
	getSummarizerModel,
} from "../lib/config.ts";
import { createLogger } from "../lib/logger.ts";
import { withRetry } from "../lib/retry.ts";

const log = createLogger("summarizer");

const MAX_INPUT_LENGTH = 8000;

const SYSTEM_PROMPT = `Summarize this AI coding session in 2-3 sentences using this structure:
1. TASK: What the developer asked for (the actual coding task, ignore system/editor context)
2. APPROACH: How it was solved (techniques, patterns, libraries used)
3. SCOPE: Key files and symbols affected

Be specific — mention actual function names, file paths, and technologies. Skip generic filler.

Examples of good summaries:
- "Added JWT authentication to the Express API. Created auth middleware in src/middleware/auth.ts using jsonwebtoken, added login/register endpoints in src/routes/auth.ts, and protected all /api routes."
- "Fixed infinite re-render in the Dashboard component caused by missing useMemo on the filtered data. Updated src/pages/Dashboard.tsx to memoize the expensive computation and added proper deps to useEffect."
- "Refactored database queries from raw SQL to Prisma ORM. Migrated 12 query functions in src/db/queries.ts, created schema.prisma with User/Post/Comment models, and updated all service files to use the new client."

Output ONLY the summary text, no labels, no markdown, no preamble.`;

function resolveModel() {
	const provider = getProvider();
	const modelName = getSummarizerModel();

	if (provider === "ollama") {
		const ollamaProvider = createOllama({ baseURL: getOllamaBaseUrl() });
		return ollamaProvider(modelName);
	}

	return openai(modelName);
}

export function truncateForSummary(
	text: string,
	maxLen = MAX_INPUT_LENGTH
): string {
	if (text.length <= maxLen) {
		return text;
	}
	const headSize = Math.floor(maxLen * 0.6);
	const tailSize = maxLen - headSize - 20;
	return `${text.slice(0, headSize)}\n\n[...truncated...]\n\n${text.slice(-tailSize)}`;
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
		return await withRetry(
			async () => {
				const { text } = await generateText({
					model: resolveModel(),
					maxOutputTokens: 200,
					temperature: 0,
					system: SYSTEM_PROMPT,
					prompt: input,
				});
				return text.trim();
			},
			{
				attempts: 3,
				onRetry: (err, attempt) => {
					log.warn(`Summarize retry ${attempt}`, {
						error: err instanceof Error ? err.message : String(err),
					});
				},
			}
		);
	} catch {
		return buildFallbackSummary(prompt, response, diffSummary);
	}
}

function extractFirstMeaningfulLine(text: string, maxLen = 200): string {
	const lines = text
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);
	for (const line of lines) {
		if (line.length > 15 && !line.startsWith("<") && !line.startsWith("```")) {
			return line.length > maxLen ? `${line.slice(0, maxLen)}...` : line;
		}
	}
	return lines[0]?.slice(0, maxLen) ?? "";
}

export function buildFallbackSummary(
	prompt: string,
	response: string,
	diffSummary: string
): string {
	const question = extractFirstMeaningfulLine(prompt, 300);
	const answer = extractFirstMeaningfulLine(response, 500);

	const parts: string[] = [];
	if (question) {
		parts.push(`Task: ${question}`);
	}
	if (answer) {
		parts.push(`Approach: ${answer}`);
	}
	if (diffSummary) {
		const files = [
			...diffSummary.matchAll(
				/(?:^|\s)([\w/.-]+\.(?:ts|tsx|js|jsx|py|go|rs))/g
			),
		]
			.map((m) => m[1])
			.filter(Boolean);
		if (files.length > 0) {
			parts.push(`Files: ${[...new Set(files)].slice(0, 5).join(", ")}`);
		}
	}

	return parts.join(". ").slice(0, 500) || prompt.slice(0, 300);
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
	const provider = getProvider();
	const parallel = provider === "ollama" ? 2 : 5;

	for (let i = 0; i < chunks.length; i += parallel) {
		const batch = chunks.slice(i, i + parallel);
		const results = await Promise.all(
			batch.map((c) => summarizeChunk(c.prompt, c.response, c.diffSummary))
		);
		summaries.push(...results);
		onProgress?.(Math.min(i + batch.length, chunks.length), chunks.length);
	}

	return summaries;
}
