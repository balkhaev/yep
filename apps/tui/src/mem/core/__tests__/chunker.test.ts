import { describe, expect, it } from "bun:test";
import { chunkCheckpoint, chunkCheckpoints } from "../chunker.ts";
import type { ParsedCheckpoint } from "../parser.ts";

function makeCheckpoint(
	overrides: Partial<ParsedCheckpoint> = {}
): ParsedCheckpoint {
	return {
		id: "test-checkpoint-001",
		sessions: [
			{
				checkpointId: "test-checkpoint-001",
				sessionIndex: 0,
				transcript: [
					{ role: "user", content: "How do I implement auth?" },
					{
						role: "assistant",
						content: "Use JWT tokens with bcrypt for password hashing.",
					},
					{
						role: "tool",
						content:
							"diff --git a/src/auth.ts\n+++ b/src/auth.ts\n+export function login() {}",
					},
				],
				metadata: {
					agent: "cursor",
					tokenUsage: { totalTokens: 500 },
				},
				prompts: "",
			},
		],
		metadata: {
			id: "test-checkpoint-001",
			timestamp: "2025-01-15T10:00:00Z",
		},
		...overrides,
	};
}

describe("chunkCheckpoint", () => {
	it("creates chunks from conversation pairs", () => {
		const cp = makeCheckpoint();
		const chunks = chunkCheckpoint(cp);

		expect(chunks.length).toBe(1);
		const chunk = chunks[0]!;
		expect(chunk.checkpointId).toBe("test-checkpoint-001");
		expect(chunk.prompt).toBe("How do I implement auth?");
		expect(chunk.response).toContain("JWT tokens");
		expect(chunk.metadata.agent).toBe("cursor");
		expect(chunk.metadata.timestamp).toBe("2025-01-15T10:00:00Z");
	});

	it("extracts files from transcript", () => {
		const cp = makeCheckpoint();
		const chunks = chunkCheckpoint(cp);
		const files = chunks[0]!.metadata.filesChanged;
		expect(files.some((f) => f.includes("auth.ts"))).toBe(true);
	});

	it("extracts diff summaries from tool entries", () => {
		const cp = makeCheckpoint();
		const chunks = chunkCheckpoint(cp);
		expect(chunks[0]!.diffSummary).toContain("diff");
	});

	it("handles multiple conversation pairs", () => {
		const cp = makeCheckpoint({
			sessions: [
				{
					checkpointId: "test-checkpoint-001",
					sessionIndex: 0,
					transcript: [
						{ role: "user", content: "Question 1" },
						{ role: "assistant", content: "Answer 1" },
						{ role: "user", content: "Question 2" },
						{ role: "assistant", content: "Answer 2" },
					],
					metadata: { agent: "cursor", tokenUsage: { totalTokens: 100 } },
					prompts: "",
				},
			],
		});

		const chunks = chunkCheckpoint(cp);
		expect(chunks.length).toBe(2);
		expect(chunks[0]!.prompt).toBe("Question 1");
		expect(chunks[1]!.prompt).toBe("Question 2");
	});

	it("generates unique chunk IDs", () => {
		const cp = makeCheckpoint({
			sessions: [
				{
					checkpointId: "test-checkpoint-001",
					sessionIndex: 0,
					transcript: [
						{ role: "user", content: "Q1" },
						{ role: "assistant", content: "A1" },
						{ role: "user", content: "Q2" },
						{ role: "assistant", content: "A2" },
					],
					metadata: { agent: "cursor", tokenUsage: { totalTokens: 100 } },
					prompts: "",
				},
			],
		});

		const chunks = chunkCheckpoint(cp);
		const ids = new Set(chunks.map((c) => c.id));
		expect(ids.size).toBe(chunks.length);
	});

	it("falls back to prompts field when no pairs", () => {
		const cp = makeCheckpoint({
			sessions: [
				{
					checkpointId: "test-checkpoint-001",
					sessionIndex: 0,
					transcript: [],
					metadata: { agent: "cursor", tokenUsage: { totalTokens: 0 } },
					prompts: "Initial prompt text",
				},
			],
		});

		const chunks = chunkCheckpoint(cp);
		expect(chunks.length).toBe(1);
		expect(chunks[0]!.prompt).toBe("Initial prompt text");
	});

	it("builds embedding text with symbols", () => {
		const cp = makeCheckpoint({
			sessions: [
				{
					checkpointId: "test-checkpoint-001",
					sessionIndex: 0,
					transcript: [
						{
							role: "user",
							content: "How to use function fetchUsers?",
						},
						{
							role: "assistant",
							content: "export async function fetchUsers() { return []; }",
						},
					],
					metadata: { agent: "cursor", tokenUsage: { totalTokens: 200 } },
					prompts: "",
				},
			],
		});

		const chunks = chunkCheckpoint(cp);
		expect(chunks[0]!.embeddingText.length).toBeGreaterThan(0);
		expect(chunks[0]!.metadata.symbols).toBeDefined();
	});

	it("detects language from file extensions", () => {
		const cp = makeCheckpoint({
			sessions: [
				{
					checkpointId: "test-checkpoint-001",
					sessionIndex: 0,
					transcript: [
						{ role: "user", content: "Fix src/app.tsx and src/index.ts" },
						{ role: "assistant", content: "Done." },
					],
					metadata: { agent: "cursor", tokenUsage: { totalTokens: 100 } },
					prompts: "",
				},
			],
		});

		const chunks = chunkCheckpoint(cp);
		expect(chunks[0]!.metadata.language).toBe("typescript");
	});

	it("truncates long responses", () => {
		const longResponse = "x".repeat(5000);
		const cp = makeCheckpoint({
			sessions: [
				{
					checkpointId: "test-checkpoint-001",
					sessionIndex: 0,
					transcript: [
						{ role: "user", content: "Q" },
						{ role: "assistant", content: longResponse },
					],
					metadata: { agent: "cursor", tokenUsage: { totalTokens: 100 } },
					prompts: "",
				},
			],
		});

		const chunks = chunkCheckpoint(cp);
		expect(chunks[0]!.response.length).toBeLessThan(longResponse.length);
	});
});

describe("chunkCheckpoints", () => {
	it("flattens multiple checkpoints into chunks", () => {
		const cps = [
			makeCheckpoint({ id: "cp-1" }),
			makeCheckpoint({ id: "cp-2" }),
		];

		const chunks = chunkCheckpoints(cps);
		expect(chunks.length).toBe(2);
		expect(chunks[0]!.checkpointId).toBe("cp-1");
		expect(chunks[1]!.checkpointId).toBe("cp-2");
	});

	it("returns empty for no checkpoints", () => {
		expect(chunkCheckpoints([])).toEqual([]);
	});
});
