// @ts-nocheck
import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { PythonParser } from "../python-parser.ts";

describe("PythonParser", () => {
	const parser = new PythonParser();
	const fixturePath = join(import.meta.dir, "fixtures", "python", "sample.py");

	it("should parse Python file", async () => {
		const result = await parser.parse(fixturePath);
		expect(result.length).toBeGreaterThan(0);
	});

	it("should extract functions with type hints", async () => {
		const result = await parser.parse(fixturePath);
		const simpleFunc = result.find((s) => s.name === "simple_function");

		expect(simpleFunc).toBeDefined();
		expect(simpleFunc?.symbolType).toBe("function");
		expect(simpleFunc?.metadata?.parameters).toHaveLength(1);
		expect(simpleFunc?.metadata?.parameters?.[0]?.name).toBe("name");
		expect(simpleFunc?.metadata?.parameters?.[0]?.type).toBe("str");
		expect(simpleFunc?.metadata?.returnType).toBe("str");
		expect(simpleFunc?.jsDoc).toContain("Simple function");
	});

	it("should detect async functions", async () => {
		const result = await parser.parse(fixturePath);
		const asyncFunc = result.find((s) => s.name === "async_function");

		expect(asyncFunc).toBeDefined();
		expect(asyncFunc?.metadata?.isAsync).toBe(true);
		expect(asyncFunc?.metadata?.returnType).toBe("dict");
		expect(asyncFunc?.metadata?.parameters).toHaveLength(2);
		expect(asyncFunc?.metadata?.parameters?.[1]?.isOptional).toBe(true);
		expect(asyncFunc?.metadata?.parameters?.[1]?.defaultValue).toBe("30");
	});

	it("should extract decorators", async () => {
		const result = await parser.parse(fixturePath);
		const decorated = result.find((s) => s.name === "decorated_function");

		expect(decorated).toBeDefined();
		expect(decorated?.metadata?.decorators).toBeDefined();
		expect(decorated?.metadata?.decorators?.length).toBeGreaterThan(0);
		expect(decorated?.metadata?.language?.pythonDecorators).toContain(
			"staticmethod"
		);
	});

	it("should extract classes", async () => {
		const result = await parser.parse(fixturePath);
		const calculator = result.find((s) => s.name === "Calculator");

		expect(calculator).toBeDefined();
		expect(calculator?.symbolType).toBe("class");
		expect(calculator?.jsDoc).toContain("Calculator class");
	});

	it("should extract class methods with visibility", async () => {
		const result = await parser.parse(fixturePath);

		const addMethod = result.find((s) => s.name === "Calculator.add");
		expect(addMethod).toBeDefined();
		expect(addMethod?.symbolType).toBe("method");
		expect(addMethod?.metadata?.visibility).toBe("public");
		expect(addMethod?.metadata?.returnType).toBe("int");

		const protectedMethod = result.find(
			(s) => s.name === "Calculator._internal_helper"
		);
		expect(protectedMethod?.metadata?.visibility).toBe("protected");

		const privateMethod = result.find(
			(s) => s.name === "Calculator.__private_method"
		);
		expect(privateMethod?.metadata?.visibility).toBe("private");
	});

	it("should extract constants", async () => {
		const result = await parser.parse(fixturePath);
		const constants = result.filter((s) => s.symbolType === "constant");

		expect(constants.length).toBeGreaterThan(0);
		const maxRetries = constants.find((c) => c.name === "MAX_RETRIES");
		expect(maxRetries).toBeDefined();
	});

	it("should handle complex type hints", async () => {
		const result = await parser.parse(fixturePath);
		const processMethod = result.find(
			(s) => s.name === "DataProcessor.process"
		);

		expect(processMethod).toBeDefined();
		expect(processMethod?.metadata?.isAsync).toBe(true);
		expect(processMethod?.metadata?.parameters?.[0]?.type).toBe("List[str]");
		expect(processMethod?.metadata?.returnType).toBe("Optional[dict]");
	});

	it("should extract base classes", async () => {
		const result = await parser.parse(fixturePath);
		const dataProcessor = result.find((s) => s.name === "DataProcessor");

		expect(dataProcessor).toBeDefined();
		expect(dataProcessor?.imports).toContain("BaseProcessor");
	});
});
