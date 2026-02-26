// @ts-nocheck
import { describe, expect, it } from "bun:test";
import { BaseParser } from "../base-parser.ts";
import type { EnhancedCodeSymbol } from "../types.ts";

// Простая имплементация для тестов
class TestParser extends BaseParser {
	protected async doParse(_filePath: string): Promise<EnhancedCodeSymbol[]> {
		return [
			{
				name: "testFunction",
				symbolType: "function",
				path: _filePath,
				startLine: 1,
				endLine: 5,
				body: "function testFunction() { return 42; }",
				jsDoc: "Test function",
				calls: [],
				imports: [],
			},
		];
	}
}

describe("BaseParser", () => {
	it("should parse file successfully", async () => {
		const parser = new TestParser();
		const result = await parser.parse("test.ts");

		expect(result).toHaveLength(1);
		expect(result[0]?.name).toBe("testFunction");
		expect(result[0]?.symbolType).toBe("function");
	});

	it("should detect language from file extension", async () => {
		const parser = new TestParser();

		// @ts-expect-error - accessing protected method for testing
		expect(parser.detectLanguage("file.ts")).toBe("typescript");
		// @ts-expect-error
		expect(parser.detectLanguage("file.py")).toBe("python");
		// @ts-expect-error
		expect(parser.detectLanguage("file.go")).toBe("go");
		// @ts-expect-error
		expect(parser.detectLanguage("file.rs")).toBe("rust");
	});

	it("should truncate body if too long", async () => {
		const parser = new TestParser();
		const longBody = "a".repeat(5000);

		// @ts-expect-error
		const truncated = parser.truncateBody(longBody);

		expect(truncated.length).toBe(3000);
	});

	it("should extract function calls", async () => {
		const parser = new TestParser();
		const code = `
			function myFunc() {
				console.log("test");
				someFunction();
				anotherFunc(42);
			}
		`;

		// @ts-expect-error
		const calls = parser.extractCalls(code, "myFunc");

		expect(calls).toContain("someFunction");
		expect(calls).toContain("anotherFunc");
		expect(calls).not.toContain("console"); // keyword
		expect(calls).not.toContain("myFunc"); // own name
	});

	it("should use fallback parser on error", async () => {
		class FailingParser extends BaseParser {
			protected async doParse(
				_filePath: string
			): Promise<EnhancedCodeSymbol[]> {
				throw new Error("Parse failed");
			}
		}

		const fallbackParser = new TestParser();
		const parser = new FailingParser();
		parser.setFallback(fallbackParser);

		const result = await parser.parse("test.ts");

		// Should return result from fallback
		expect(result).toHaveLength(1);
		expect(result[0]?.name).toBe("testFunction");
	});
});
