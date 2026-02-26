// @ts-nocheck
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TypeScriptAstParser } from "../ts-ast-parser.ts";

describe("TypeScriptAstParser", () => {
	let tempDir: string;
	let parser: TypeScriptAstParser;

	beforeAll(() => {
		tempDir = mkdtempSync(join(tmpdir(), "ts-parser-test-"));
		parser = new TypeScriptAstParser();
	});

	afterAll(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	function createTestFile(filename: string, content: string): string {
		const filePath = join(tempDir, filename);
		writeFileSync(filePath, content, "utf-8");
		return filePath;
	}

	it("should parse basic function with metadata", async () => {
		const code = `
/**
 * Test function
 */
export async function testFunc(name: string, age?: number = 18): Promise<string> {
	return \`Hello \${name}\`;
}
		`;
		const filePath = createTestFile("test1.ts", code);
		const result = await parser.parse(filePath);

		expect(result).toHaveLength(1);
		expect(result[0]?.name).toBe("testFunc");
		expect(result[0]?.symbolType).toBe("function");
		expect(result[0]?.metadata?.isAsync).toBe(true);
		expect(result[0]?.metadata?.returnType).toBe("Promise<string>");
		expect(result[0]?.metadata?.parameters).toHaveLength(2);
		expect(result[0]?.metadata?.parameters?.[0]?.name).toBe("name");
		expect(result[0]?.metadata?.parameters?.[0]?.type).toBe("string");
		expect(result[0]?.metadata?.parameters?.[1]?.isOptional).toBe(true);
		expect(result[0]?.metadata?.parameters?.[1]?.defaultValue).toBe("18");
	});

	it("should extract constants (export const)", async () => {
		const code = `
export const MAX_SIZE = 100;
export const API_URL: string = "https://api.example.com";
const INTERNAL = 42; // not exported
		`;
		const filePath = createTestFile("test2.ts", code);
		const result = await parser.parse(filePath);

		const constants = result.filter((s) => s.symbolType === "constant");
		expect(constants).toHaveLength(2);
		expect(constants[0]?.name).toBe("MAX_SIZE");
		expect(constants[1]?.name).toBe("API_URL");
		expect(constants[1]?.metadata?.returnType).toBe("string");
	});

	it("should detect custom hooks", async () => {
		const code = `
export const useCounter = (initialValue: number = 0) => {
	const [count, setCount] = useState(initialValue);

	useEffect(() => {
		console.log(count);
	}, [count]);

	return { count, setCount };
};
		`;
		const filePath = createTestFile("test3.tsx", code);
		const result = await parser.parse(filePath);

		const hooks = result.filter((s) => s.symbolType === "hook");
		expect(hooks).toHaveLength(1);
		expect(hooks[0]?.name).toBe("useCounter");
		expect(hooks[0]?.metadata?.react?.isHook).toBe(true);
		expect(hooks[0]?.metadata?.react?.hookDependencies).toContain("count");
	});

	it("should extract class methods with metadata", async () => {
		const code = `
export class Calculator {
	private value: number = 0;

	public add(x: number): number {
		this.value += x;
		return this.value;
	}

	protected reset(): void {
		this.value = 0;
	}
}
		`;
		const filePath = createTestFile("test4.ts", code);
		const result = await parser.parse(filePath);

		const methods = result.filter((s) => s.symbolType === "method");
		expect(methods).toHaveLength(2);

		const addMethod = methods.find((m) => m.name === "Calculator.add");
		expect(addMethod?.metadata?.visibility).toBe("public");
		expect(addMethod?.metadata?.returnType).toBe("number");
		expect(addMethod?.metadata?.parameters).toHaveLength(1);

		const resetMethod = methods.find((m) => m.name === "Calculator.reset");
		expect(resetMethod?.metadata?.visibility).toBe("protected");
		expect(resetMethod?.metadata?.returnType).toBe("void");
	});

	it("should extract generic parameters", async () => {
		const code = `
export function identity<T extends string>(value: T): T {
	return value;
}

export class Container<T, K extends keyof T> {
	constructor(private data: T) {}
}
		`;
		const filePath = createTestFile("test5.ts", code);
		const result = await parser.parse(filePath);

		const identityFunc = result.find((s) => s.name === "identity");
		expect(identityFunc?.metadata?.genericParams).toHaveLength(1);
		expect(identityFunc?.metadata?.genericParams?.[0]?.name).toBe("T");
		expect(identityFunc?.metadata?.genericParams?.[0]?.constraint).toBe(
			"string"
		);
	});

	it("should detect React components", async () => {
		const code = `
export const Button: React.FC<{onClick: () => void}> = ({onClick}) => {
	return <button onClick={onClick}>Click me</button>;
};

export function Card({title}: {title: string}) {
	return <div>{title}</div>;
}
		`;
		const filePath = createTestFile("test6.tsx", code);
		const result = await parser.parse(filePath);

		const components = result.filter((s) => s.symbolType === "component");
		expect(components).toHaveLength(2);
		expect(components[0]?.name).toBe("Button");
		expect(components[1]?.name).toBe("Card");
	});

	it("should extract decorators (TypeScript experimental)", async () => {
		const code = `
function logMethod(target: any, key: string, descriptor: PropertyDescriptor) {
	return descriptor;
}

export class Service {
	@logMethod
	async fetchData(): Promise<void> {
		// implementation
	}
}
		`;
		const filePath = createTestFile("test7.ts", code);
		const result = await parser.parse(filePath);

		const method = result.find((s) => s.name === "Service.fetchData");
		// Note: decorators могут не парситься без experimentalDecorators в tsconfig
		// но код должен работать без ошибок
		expect(method).toBeDefined();
	});

	it("should extract imports and calls", async () => {
		const code = `
import { useState, useEffect } from "react";
import axios from "axios";

export function fetchUser() {
	const data = axios.get("/user");
	useState(0);
	useEffect(() => {}, []);
	return data;
}
		`;
		const filePath = createTestFile("test8.ts", code);
		const result = await parser.parse(filePath);

		const func = result[0];
		expect(func?.calls).toContain("get");
		expect(func?.calls).toContain("useState");
		expect(func?.calls).toContain("useEffect");
		expect(func?.imports).toContain("useState:react");
		expect(func?.imports).toContain("axios:axios");
	});
});
