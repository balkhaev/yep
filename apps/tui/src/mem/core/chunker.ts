import type { ParsedCheckpoint, SessionTranscriptEntry } from "./parser.ts";

export interface SolutionChunk {
	checkpointId: string;
	diffSummary: string;
	embeddingText: string;
	id: string;
	metadata: {
		agent: string;
		confidence?: number;
		filesChanged: string[];
		language?: string;
		scope?: string;
		source?: string;
		symbols?: string[];
		timestamp: string;
		tokensUsed: number;
		version?: number;
	};
	prompt: string;
	response: string;
	sessionIndex: number;
	summary?: string;
}

const MAX_RESPONSE_LENGTH = 4000;
const MAX_DIFF_LENGTH = 1500;
const MAX_EMBEDDING_TEXT_LENGTH = 5000;
const MAX_SYMBOLS = 30;

const FILE_PATTERN =
	/(?:^|\s)([\w/.-]*\/[\w/.-]+\.(?:ts|tsx|js|jsx|json|md|css|html|py|go|rs))/g;

const FALSE_POSITIVE_FILES = new Set([
	"node.js",
	"next.js",
	"vue.js",
	"nuxt.js",
	"react.js",
	"angular.js",
	"express.js",
	"bun.js",
	"deno.js",
]);

const SYSTEM_TAG_RE =
	/<(?:system_reminder|user_info|rules|agent_skills|open_and_recently_viewed_files|git_status|agent_transcripts|always_applied_workspace_rules?|always_applied_workspace_rule|available_skills|agent_skill|mcp_file_system|mcp_file_system_servers?|mcp_file_system_server|terminal_files_information|tone_and_style|tool_calling|making_code_changes|citing_code|inline_line_numbers|task_management|committing-changes-with-git|creating-pull-requests|managing-long-running-commands|linter_errors|no_thinking_in_code_or_commands|mode_selection|mermaid_syntax|other-common-operations)[^>]*>[\s\S]*?<\/[^>]+>/gi;

const FILE_TREE_LINE_RE =
	/^[ │├└─\s]*[\w/.-]+\.(ts|tsx|js|jsx|json|md|css|py|go|rs)\s*$/;

export function cleanPrompt(raw: string): string {
	let text = raw.replace(SYSTEM_TAG_RE, "");

	const lines = text.split("\n");
	const kept: string[] = [];
	let consecutivePathLines = 0;

	for (const line of lines) {
		if (FILE_TREE_LINE_RE.test(line.trim())) {
			consecutivePathLines++;
			if (consecutivePathLines > 3) {
				continue;
			}
		} else {
			consecutivePathLines = 0;
		}
		kept.push(line);
	}

	text = kept
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();

	return text || raw.slice(0, 500);
}

const SYMBOL_EXTRACT_RE =
	/(?:export\s+)?(?:async\s+)?(?:function|class|interface|type|const|let)\s+(\w{3,})/g;
const DIFF_ADDED_LINE_RE =
	/^\+\s*(?:export\s+)?(?:async\s+)?(?:function|class|interface|type|const|let)\s+(\w{3,})/gm;

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
				prompt: cleanPrompt(pendingUserMessages.join("\n\n")),
				response: content,
			});
			pendingUserMessages.length = 0;
		}
	}

	return pairs;
}

const DIFF_INDICATORS = ["diff", "+++", "---"];
const CODE_CHANGE_INDICATORS = [
	"Write to file",
	"Created file",
	"Modified file",
	"old_string",
	"new_string",
	"StrReplace",
	"Wrote to",
	"Updated file",
];

function looksLikeCodeChange(content: string): boolean {
	for (const indicator of DIFF_INDICATORS) {
		if (content.includes(indicator)) {
			return true;
		}
	}
	for (const indicator of CODE_CHANGE_INDICATORS) {
		if (content.includes(indicator)) {
			return true;
		}
	}
	return false;
}

function extractDiffFromTranscript(
	transcript: SessionTranscriptEntry[]
): string {
	const diffs: string[] = [];

	for (const entry of transcript) {
		if (entry.role !== "tool" && entry.role !== "assistant") {
			continue;
		}

		const content = typeof entry.content === "string" ? entry.content : "";
		if (!content) {
			continue;
		}

		if (entry.role === "tool" && looksLikeCodeChange(content)) {
			diffs.push(content.slice(0, MAX_DIFF_LENGTH));
			continue;
		}

		if (entry.role === "assistant") {
			const lines = content.split("\n");
			const changeLines: string[] = [];
			for (const line of lines) {
				if (
					/^[+-]\s*(?:export\s+)?(?:async\s+)?(?:function|class|interface|type|const|let|import)\s/.test(
						line
					)
				) {
					changeLines.push(line);
				}
			}
			if (changeLines.length > 0) {
				diffs.push(changeLines.join("\n").slice(0, MAX_DIFF_LENGTH));
			}
		}
	}

	return diffs.join("\n").slice(0, MAX_DIFF_LENGTH * 2);
}

function extractFilesChanged(transcript: SessionTranscriptEntry[]): string[] {
	const files = new Set<string>();

	for (const entry of transcript) {
		const content = typeof entry.content === "string" ? entry.content : "";

		const filePatterns = content.match(FILE_PATTERN);
		if (filePatterns) {
			for (const f of filePatterns) {
				const trimmed = f.trim();
				if (!FALSE_POSITIVE_FILES.has(trimmed.toLowerCase())) {
					files.add(trimmed);
				}
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

function extractSymbolsFromText(text: string): string[] {
	const symbols = new Set<string>();
	for (const m of text.matchAll(SYMBOL_EXTRACT_RE)) {
		if (m[1]) {
			symbols.add(m[1]);
		}
	}
	return [...symbols].slice(0, MAX_SYMBOLS);
}

function extractSymbolsFromDiff(diffText: string): string[] {
	const symbols = new Set<string>();
	for (const m of diffText.matchAll(DIFF_ADDED_LINE_RE)) {
		if (m[1]) {
			symbols.add(m[1]);
		}
	}
	return [...symbols].slice(0, MAX_SYMBOLS);
}

function extractAllSymbols(
	transcript: SessionTranscriptEntry[],
	prompt: string,
	response: string,
	diffSummary: string
): string[] {
	const all = new Set<string>();

	for (const sym of extractSymbolsFromText(prompt)) {
		all.add(sym);
	}
	for (const sym of extractSymbolsFromText(response)) {
		all.add(sym);
	}
	for (const sym of extractSymbolsFromDiff(diffSummary)) {
		all.add(sym);
	}

	for (const entry of transcript) {
		if (entry.role !== "assistant" && entry.role !== "tool") {
			continue;
		}
		const content = typeof entry.content === "string" ? entry.content : "";
		for (const sym of extractSymbolsFromText(content.slice(0, 5000))) {
			all.add(sym);
		}
	}

	return [...all].slice(0, MAX_SYMBOLS);
}

function detectLanguage(filesChanged: string[]): string {
	const extCounts = new Map<string, number>();
	for (const f of filesChanged) {
		const dot = f.lastIndexOf(".");
		if (dot >= 0) {
			const ext = f.slice(dot);
			extCounts.set(ext, (extCounts.get(ext) ?? 0) + 1);
		}
	}
	let topExt = "";
	let topCount = 0;
	for (const [ext, count] of extCounts) {
		if (count > topCount) {
			topExt = ext;
			topCount = count;
		}
	}
	const langMap: Record<string, string> = {
		".ts": "typescript",
		".tsx": "typescript",
		".js": "javascript",
		".jsx": "javascript",
		".py": "python",
		".go": "go",
		".rs": "rust",
	};
	return langMap[topExt] ?? "";
}

function buildEmbeddingText(
	prompt: string,
	response: string,
	diffSummary: string,
	symbols: string[]
): string {
	const parts: string[] = [];
	if (symbols.length > 0) {
		parts.push(`Symbols: ${symbols.join(", ")}`);
	}
	parts.push(`Question: ${prompt}`, `Answer: ${truncate(response, 1500)}`);
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
		const language = detectLanguage(filesChanged);

		if (pairs.length === 0 && session.prompts) {
			const cleaned = cleanPrompt(session.prompts);
			const symbols = extractAllSymbols(
				session.transcript,
				cleaned,
				"",
				diffSummary
			);
			chunks.push({
				id: `${checkpoint.id}-${session.sessionIndex}-0`,
				checkpointId: checkpoint.id,
				sessionIndex: session.sessionIndex,
				prompt: cleaned,
				response: "",
				diffSummary,
				metadata: {
					agent,
					timestamp,
					filesChanged,
					tokensUsed,
					symbols,
					language,
				},
				embeddingText: buildEmbeddingText(cleaned, "", diffSummary, symbols),
			});
			continue;
		}

		for (const [i, pair] of pairs.entries()) {
			const response = truncate(pair.response, MAX_RESPONSE_LENGTH);
			const diff = i === 0 ? diffSummary : "";
			const symbols = extractAllSymbols(
				session.transcript,
				pair.prompt,
				response,
				diff
			);

			chunks.push({
				id: `${checkpoint.id}-${session.sessionIndex}-${i}`,
				checkpointId: checkpoint.id,
				sessionIndex: session.sessionIndex,
				prompt: pair.prompt,
				response,
				diffSummary: diff,
				metadata: {
					agent,
					timestamp,
					filesChanged,
					tokensUsed,
					symbols,
					language,
				},
				embeddingText: buildEmbeddingText(pair.prompt, response, diff, symbols),
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
