// @ts-nocheck
import { describe, expect, it } from "bun:test";
import {
	analyzeQuery,
	detectQueryIntent,
	getWeightsForQuery,
	type QueryIntent,
} from "../query-intent.ts";

describe("detectQueryIntent", () => {
	it("detects recent_change intent", () => {
		expect(detectQueryIntent("What changed in the last session?")).toBe(
			"recent_change"
		);
		expect(detectQueryIntent("Show me recent updates")).toBe("recent_change");
		expect(detectQueryIntent("Latest modifications")).toBe("recent_change");
		expect(detectQueryIntent("What was updated today?")).toBe("recent_change");
	});

	it("detects how_it_works intent", () => {
		expect(detectQueryIntent("How does authentication work?")).toBe(
			"how_it_works"
		);
		expect(detectQueryIntent("Explain the routing mechanism")).toBe(
			"how_it_works"
		);
		expect(detectQueryIntent("What is the caching strategy?")).toBe(
			"how_it_works"
		);
		expect(detectQueryIntent("How to implement pagination")).toBe(
			"how_it_works"
		);
	});

	it("detects find_code intent", () => {
		expect(detectQueryIntent("Find the login function")).toBe("find_code");
		expect(detectQueryIntent("Where is UserController class?")).toBe(
			"find_code"
		);
		expect(detectQueryIntent("Locate handleRequest method")).toBe("find_code");
		expect(detectQueryIntent("Search for authentication component")).toBe(
			"find_code"
		);
	});

	it("detects debug intent", () => {
		expect(detectQueryIntent("Why does the login fail?")).toBe("debug");
		expect(detectQueryIntent("Fix the authentication error")).toBe("debug");
		expect(detectQueryIntent("Debug the error in the code")).toBe("debug");
		expect(detectQueryIntent("Solve this bug problem")).toBe("debug");
	});

	it("returns default for ambiguous queries", () => {
		expect(detectQueryIntent("authentication")).toBe("default");
		expect(detectQueryIntent("user management")).toBe("default");
		expect(detectQueryIntent("database")).toBe("default");
	});

	it("handles short queries appropriately", () => {
		// Short queries with 1 pattern match should use that intent
		expect(detectQueryIntent("recent changes")).toBe("recent_change");
		expect(detectQueryIntent("how it works")).toBe("how_it_works");
		expect(detectQueryIntent("find code")).toBe("find_code");

		// Very short queries with no clear pattern
		expect(detectQueryIntent("auth")).toBe("default");
	});
});

describe("getWeightsForQuery", () => {
	it("returns recent_change weights for recency queries", () => {
		const weights = getWeightsForQuery("What changed recently?");
		expect(weights.recency).toBe(0.5); // High recency weight
		expect(weights.keywordDensity).toBe(0.2); // Lower keyword weight
	});

	it("returns how_it_works weights for explanation queries", () => {
		const weights = getWeightsForQuery("How does routing work?");
		expect(weights.keywordDensity).toBe(0.5); // High keyword weight
		expect(weights.symbolMatch).toBe(0.3);
		expect(weights.recency).toBe(0.05); // Low recency weight
	});

	it("returns find_code weights for code search queries", () => {
		const weights = getWeightsForQuery("Find UserController class");
		expect(weights.symbolMatch).toBe(0.5); // High symbol weight
		expect(weights.recency).toBe(0.05); // Low recency weight
	});

	it("returns debug weights for error queries", () => {
		const weights = getWeightsForQuery("Why does it crash?");
		expect(weights.fileOverlap).toBe(0.3); // High file overlap
		expect(weights.keywordDensity).toBe(0.3);
		expect(weights.recency).toBe(0.2);
	});

	it("returns default weights for ambiguous queries", () => {
		const weights = getWeightsForQuery("authentication system");
		expect(weights.recency).toBe(0.15);
		expect(weights.fileOverlap).toBe(0.25);
		expect(weights.keywordDensity).toBe(0.35);
		expect(weights.symbolMatch).toBe(0.25);
	});
});

describe("analyzeQuery", () => {
	it("returns both intent and weights", () => {
		const analysis = analyzeQuery("What changed last week?");
		expect(analysis.intent).toBe("recent_change");
		expect(analysis.weights.recency).toBe(0.5);
	});

	it("provides correct analysis for different intents", () => {
		const queries: Array<{ query: string; expectedIntent: QueryIntent }> = [
			{ query: "recent updates", expectedIntent: "recent_change" },
			{ query: "how it works", expectedIntent: "how_it_works" },
			{ query: "find function", expectedIntent: "find_code" },
			{ query: "fix error", expectedIntent: "debug" },
		];

		for (const { query, expectedIntent } of queries) {
			const analysis = analyzeQuery(query);
			expect(analysis.intent).toBe(expectedIntent);
			expect(analysis.weights).toBeDefined();
		}
	});
});
