import type { ParsedCheckpoint, SessionTranscriptEntry } from "./parser.ts";

export interface SolutionChunk {
	checkpointId: string;
	diffSummary: string;
	embeddingText: string;
	id: string;
	metadata: {
		agent: string;
		timestamp: string;
		filesChanged: string[];
		tokensUsed: number;
	};
	prompt: string;
	response: string;
	sessionIndex: number;
}

const MAX_RESPONSE_LENGTH = 2000;
const MAX_DIFF_LENGTH = 1000;
const MAX_EMBEDDING_TEXT_LENGTH = 4000;

const FILE_PATTERN =
	/(?:^|\s)([\w/.-]+\.(?:ts|tsx|js|jsx|json|md|css|html|py|go|rs))/g;

function extractConversationPairs(
	transcript: SessionTranscriptEntry[]
): Array<{ prompt: string; response: string }> {
	const pairs: Array<{ prompt: string; response: string }> = [];
	const pendingUserMessages: string[] = [];

	for (const entry of transcript) {
		const content =
			typeof entry.content === "string"
				? entry.content
				: JSON.stringify(entry.content);

		if (entry.role === "user") {
			pendingUserMessages.push(content);
		} else if (entry.role === "assistant" && pendingUserMessages.length > 0) {
			pairs.push({
				prompt: pendingUserMessages.join("\n\n"),
				response: content,
			});
			pendingUserMessages.length = 0;
		}
	}

	return pairs;
}

function extractDiffFromTranscript(
	transcript: SessionTranscriptEntry[]
): string {
	const diffs: string[] = [];

	for (const entry of transcript) {
		if (entry.role !== "tool") {
			continue;
		}

		const content = typeof entry.content === "string" ? entry.content : "";

		if (
			content.includes("diff") ||
			content.includes("+++") ||
			content.includes("---")
		) {
			diffs.push(content.slice(0, MAX_DIFF_LENGTH));
		}
	}

	return diffs.join("\n").slice(0, MAX_DIFF_LENGTH);
}

function extractFilesChanged(transcript: SessionTranscriptEntry[]): string[] {
	const files = new Set<string>();

	for (const entry of transcript) {
		const content = typeof entry.content === "string" ? entry.content : "";

		const filePatterns = content.match(FILE_PATTERN);
		if (filePatterns) {
			for (const f of filePatterns) {
				files.add(f.trim());
			}
		}
	}

	return [...files].slice(0, 20);
}

function truncate(text: string, maxLen: number): string {
	if (text.length <= maxLen) {
		return text;
	}
	return `${text.slice(0, maxLen)}...`;
}

function buildEmbeddingText(
	prompt: string,
	response: string,
	diffSummary: string
): string {
	const parts = [`Question: ${prompt}`, `Answer: ${truncate(response, 1500)}`];
	if (diffSummary) {
		parts.push(`Changes: ${truncate(diffSummary, 500)}`);
	}
	return parts.join("\n\n").slice(0, MAX_EMBEDDING_TEXT_LENGTH);
}

export function chunkCheckpoint(checkpoint: ParsedCheckpoint): SolutionChunk[] {
	const chunks: SolutionChunk[] = [];

	for (const session of checkpoint.sessions) {
		const pairs = extractConversationPairs(session.transcript);
		const diffSummary = extractDiffFromTranscript(session.transcript);
		const filesChanged = extractFilesChanged(session.transcript);

		const agent = (session.metadata.agent as string | undefined) ?? "unknown";
		const timestamp =
			(checkpoint.metadata.timestamp as string | undefined) ?? "";
		const tokensUsed = session.metadata.tokenUsage?.totalTokens ?? 0;

		if (pairs.length === 0 && session.prompts) {
			chunks.push({
				id: `${checkpoint.id}-${session.sessionIndex}-0`,
				checkpointId: checkpoint.id,
				sessionIndex: session.sessionIndex,
				prompt: session.prompts,
				response: "",
				diffSummary,
				metadata: { agent, timestamp, filesChanged, tokensUsed },
				embeddingText: buildEmbeddingText(session.prompts, "", diffSummary),
			});
			continue;
		}

		for (const [i, pair] of pairs.entries()) {
			const response = truncate(pair.response, MAX_RESPONSE_LENGTH);

			chunks.push({
				id: `${checkpoint.id}-${session.sessionIndex}-${i}`,
				checkpointId: checkpoint.id,
				sessionIndex: session.sessionIndex,
				prompt: pair.prompt,
				response,
				diffSummary: i === 0 ? diffSummary : "",
				metadata: { agent, timestamp, filesChanged, tokensUsed },
				embeddingText: buildEmbeddingText(
					pair.prompt,
					response,
					i === 0 ? diffSummary : ""
				),
			});
		}
	}

	return chunks;
}

export function chunkCheckpoints(
	checkpoints: ParsedCheckpoint[]
): SolutionChunk[] {
	return checkpoints.flatMap(chunkCheckpoint);
}
