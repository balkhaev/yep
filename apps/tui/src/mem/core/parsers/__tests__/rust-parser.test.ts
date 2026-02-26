// @ts-nocheck
import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { RustParser } from "../rust-parser.ts";

describe("RustParser", () => {
	const parser = new RustParser();
	const fixturePath = join(import.meta.dir, "fixtures", "rust", "sample.rs");

	it("should parse Rust file", async () => {
		const result = await parser.parse(fixturePath);
		expect(result.length).toBeGreaterThan(0);
	});

	it("should extract functions with parameters", async () => {
		const result = await parser.parse(fixturePath);
		const simpleFunc = result.find((s) => s.name === "simple_function");

		expect(simpleFunc).toBeDefined();
		expect(simpleFunc?.symbolType).toBe("function");
		expect(simpleFunc?.metadata?.parameters).toHaveLength(1);
		expect(simpleFunc?.metadata?.parameters?.[0]?.name).toBe("name");
		expect(simpleFunc?.metadata?.parameters?.[0]?.type).toBe("&str");
		expect(simpleFunc?.metadata?.returnType).toContain("String");
		expect(simpleFunc?.metadata?.visibility).toBe("public");
	});

	it("should extract generic functions", async () => {
		const result = await parser.parse(fixturePath);
		const genericFunc = result.find((s) => s.name === "generic_function");

		expect(genericFunc).toBeDefined();
		expect(genericFunc?.metadata?.genericParams).toHaveLength(1);
		expect(genericFunc?.metadata?.genericParams?.[0]?.name).toBe("T");
		expect(genericFunc?.metadata?.genericParams?.[0]?.constraint).toContain(
			"Display"
		);
	});

	it("should extract functions with lifetimes", async () => {
		const result = await parser.parse(fixturePath);
		const lifetimeFunc = result.find((s) => s.name === "with_lifetime");

		expect(lifetimeFunc).toBeDefined();
		expect(lifetimeFunc?.metadata?.genericParams).toBeDefined();
		expect(
			lifetimeFunc?.metadata?.genericParams?.some((g) => g.name === "'a")
		).toBe(true);
	});

	it("should extract structs", async () => {
		const result = await parser.parse(fixturePath);
		const userStruct = result.find((s) => s.name === "User");

		expect(userStruct).toBeDefined();
		expect(userStruct?.symbolType).toBe("class");
		expect(userStruct?.metadata?.visibility).toBe("public");
		expect(userStruct?.jsDoc).toContain("User struct");
	});

	it("should extract generic structs", async () => {
		const result = await parser.parse(fixturePath);
		const container = result.find((s) => s.name === "Container");

		expect(container).toBeDefined();
		expect(container?.metadata?.genericParams).toHaveLength(1);
		expect(container?.metadata?.genericParams?.[0]?.name).toBe("T");
	});

	it("should extract methods from impl blocks", async () => {
		const result = await parser.parse(fixturePath);

		const newMethod = result.find((s) => s.name === "User.new");
		expect(newMethod).toBeDefined();
		expect(newMethod?.symbolType).toBe("method");
		expect(newMethod?.metadata?.visibility).toBe("public");

		const getNameMethod = result.find((s) => s.name === "User.get_name");
		expect(getNameMethod).toBeDefined();
		expect(getNameMethod?.metadata?.returnType).toContain("str");

		const setAgeMethod = result.find((s) => s.name === "User.set_age");
		expect(setAgeMethod).toBeDefined();
		expect(setAgeMethod?.metadata?.parameters).toHaveLength(1);
	});

	it("should detect visibility modifiers", async () => {
		const result = await parser.parse(fixturePath);

		const publicFunc = result.find((s) => s.name === "simple_function");
		expect(publicFunc?.metadata?.visibility).toBe("public");

		const privateMethod = result.find((s) => s.name === "User.internal_helper");
		expect(privateMethod?.metadata?.visibility).toBe("private");
	});

	it("should extract traits", async () => {
		const result = await parser.parse(fixturePath);
		const processorTrait = result.find((s) => s.name === "Processor");

		expect(processorTrait).toBeDefined();
		expect(processorTrait?.symbolType).toBe("interface");
		expect(processorTrait?.metadata?.visibility).toBe("public");
		expect(processorTrait?.metadata?.language?.rustTrait).toBe(true);
	});

	it("should extract trait implementations", async () => {
		const result = await parser.parse(fixturePath);
		const processMethod = result.find((s) => s.name === "User.process");

		expect(processMethod).toBeDefined();
		expect(processMethod?.metadata?.language?.rustTraitImpl).toContain(
			"Processor"
		);
	});

	it("should extract enums", async () => {
		const result = await parser.parse(fixturePath);
		const statusEnum = result.find((s) => s.name === "Status");

		expect(statusEnum).toBeDefined();
		expect(statusEnum?.symbolType).toBe("enum");
		expect(statusEnum?.metadata?.visibility).toBe("public");
	});

	it("should extract enum methods", async () => {
		const result = await parser.parse(fixturePath);
		const isActiveMethod = result.find((s) => s.name === "Status.is_active");

		expect(isActiveMethod).toBeDefined();
		expect(isActiveMethod?.symbolType).toBe("method");
	});

	it("should extract constants", async () => {
		const result = await parser.parse(fixturePath);
		const constants = result.filter((s) => s.symbolType === "constant");

		expect(constants.length).toBeGreaterThan(0);
		const maxRetries = constants.find((c) => c.name === "MAX_RETRIES");
		expect(maxRetries).toBeDefined();
		expect(maxRetries?.metadata?.visibility).toBe("public");
	});

	it("should extract static variables", async () => {
		const result = await parser.parse(fixturePath);
		const statics = result.filter((s) => s.symbolType === "variable");

		expect(statics.length).toBeGreaterThan(0);
		const counter = statics.find((v) => v.name === "COUNTER");
		expect(counter).toBeDefined();
		expect(counter?.metadata?.language?.rustStatic).toBe(true);
	});

	it("should extract type aliases", async () => {
		const result = await parser.parse(fixturePath);
		const resultType = result.find((s) => s.name === "Result");

		expect(resultType).toBeDefined();
		expect(resultType?.symbolType).toBe("type");
		expect(resultType?.metadata?.visibility).toBe("public");
		expect(resultType?.metadata?.genericParams).toHaveLength(1);
	});

	it("should extract async functions", async () => {
		const result = await parser.parse(fixturePath);
		const asyncFunc = result.find((s) => s.name === "async_function");

		expect(asyncFunc).toBeDefined();
		expect(asyncFunc?.metadata?.isAsync).toBe(true);
	});

	it("should extract doc comments", async () => {
		const result = await parser.parse(fixturePath);
		const simpleFunc = result.find((s) => s.name === "simple_function");

		expect(simpleFunc?.jsDoc).toContain("Simple function");
	});
});
