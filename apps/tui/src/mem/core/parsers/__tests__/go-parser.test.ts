// @ts-nocheck
import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { GoParser } from "../go-parser.ts";

describe("GoParser", () => {
	const parser = new GoParser();
	const fixturePath = join(import.meta.dir, "fixtures", "go", "sample.go");

	it("should parse Go file", async () => {
		const result = await parser.parse(fixturePath);
		expect(result.length).toBeGreaterThan(0);
	});

	it("should extract functions with parameters", async () => {
		const result = await parser.parse(fixturePath);
		const simpleFunc = result.find((s) => s.name === "SimpleFunction");

		expect(simpleFunc).toBeDefined();
		expect(simpleFunc?.symbolType).toBe("function");
		expect(simpleFunc?.metadata?.parameters).toHaveLength(1);
		expect(simpleFunc?.metadata?.parameters?.[0]?.name).toBe("name");
		expect(simpleFunc?.metadata?.parameters?.[0]?.type).toBe("string");
		expect(simpleFunc?.metadata?.returnType).toBe("string");
		expect(simpleFunc?.metadata?.isExported).toBe(true);
	});

	it("should extract functions with multiple return values", async () => {
		const result = await parser.parse(fixturePath);
		const complexFunc = result.find((s) => s.name === "ComplexFunction");

		expect(complexFunc).toBeDefined();
		expect(complexFunc?.metadata?.parameters).toHaveLength(3);
		expect(complexFunc?.metadata?.parameters?.[0]?.name).toBe("ctx");
		expect(complexFunc?.metadata?.parameters?.[0]?.type).toContain("Context");
		expect(complexFunc?.metadata?.returnType).toContain("string");
		expect(complexFunc?.metadata?.returnType).toContain("error");
	});

	it("should extract structs", async () => {
		const result = await parser.parse(fixturePath);
		const userStruct = result.find((s) => s.name === "User");

		expect(userStruct).toBeDefined();
		expect(userStruct?.symbolType).toBe("class"); // struct as class
		expect(userStruct?.metadata?.isExported).toBe(true);
	});

	it("should extract methods with receiver", async () => {
		const result = await parser.parse(fixturePath);

		const getNameMethod = result.find((s) => s.name === "User.GetName");
		expect(getNameMethod).toBeDefined();
		expect(getNameMethod?.symbolType).toBe("method");
		expect(getNameMethod?.metadata?.isExported).toBe(true);
		expect(getNameMethod?.metadata?.returnType).toBe("string");
		expect(getNameMethod?.metadata?.language?.goReceiver).toContain("*User");
		expect(getNameMethod?.metadata?.language?.goReceiverPointer).toBe(true);

		const setAgeMethod = result.find((s) => s.name === "User.SetAge");
		expect(setAgeMethod?.metadata?.language?.goReceiverPointer).toBe(false);
	});

	it("should detect exported vs unexported", async () => {
		const result = await parser.parse(fixturePath);

		const exported = result.find((s) => s.name === "User.GetName");
		expect(exported?.metadata?.isExported).toBe(true);

		const unexported = result.find((s) => s.name === "User.privateMethod");
		expect(unexported?.metadata?.isExported).toBe(false);
	});

	it("should extract interfaces", async () => {
		const result = await parser.parse(fixturePath);
		const serviceInterface = result.find((s) => s.name === "Service");

		expect(serviceInterface).toBeDefined();
		expect(serviceInterface?.symbolType).toBe("interface");
		expect(serviceInterface?.metadata?.isExported).toBe(true);
	});

	it("should extract constants", async () => {
		const result = await parser.parse(fixturePath);
		const constants = result.filter((s) => s.symbolType === "constant");

		expect(constants.length).toBeGreaterThan(0);
		const maxRetries = constants.find((c) => c.name === "MaxRetries");
		expect(maxRetries).toBeDefined();
		expect(maxRetries?.metadata?.isExported).toBe(true);
	});

	it("should extract variables", async () => {
		const result = await parser.parse(fixturePath);
		const variables = result.filter((s) => s.symbolType === "variable");

		expect(variables.length).toBeGreaterThan(0);
		const counter = variables.find((v) => v.name === "counter");
		expect(counter).toBeDefined();
		expect(counter?.metadata?.returnType).toBe("int");
		expect(counter?.metadata?.isExported).toBe(false); // lowercase
	});

	it("should extract type aliases", async () => {
		const result = await parser.parse(fixturePath);
		const resultType = result.find((s) => s.name === "Result");

		expect(resultType).toBeDefined();
		expect(resultType?.symbolType).toBe("type");
		expect(resultType?.metadata?.isExported).toBe(true);
	});

	it("should extract doc comments", async () => {
		const result = await parser.parse(fixturePath);
		const simpleFunc = result.find((s) => s.name === "SimpleFunction");

		expect(simpleFunc?.jsDoc).toContain("basic function");
	});
});
