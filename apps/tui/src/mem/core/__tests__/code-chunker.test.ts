// @ts-nocheck
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chunkFileSymbols, parseFileSymbols } from "../code-chunker.ts";

const TMP_DIR = join(import.meta.dir, ".tmp-test-fixtures");

function writeFixture(name: string, content: string): string {
	const path = join(TMP_DIR, name);
	writeFileSync(path, content);
	return path;
}

beforeAll(() => {
	mkdirSync(TMP_DIR, { recursive: true });
});

afterAll(() => {
	rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("parseFileSymbols", () => {
	it("extracts a simple exported function", () => {
		const path = writeFixture(
			"simple.ts",
			`export function greet(name: string): string {
	return "hello " + name;
}
`
		);

		const symbols = await parseFileSymbols(path);
		expect(symbols.length).toBe(1);
		expect(symbols[0]!.name).toBe("greet");
		expect(symbols[0]!.symbolType).toBe("function");
		expect(symbols[0]!.startLine).toBe(1);
		expect(symbols[0]!.body).toContain("return");
	});

	it("extracts async arrow functions", async () => {
		const path = writeFixture(
			"arrow.ts",
			`export const fetchData = async (url: string) => {
	const res = await fetch(url);
	return res.json();
};
`
		);

		const symbols = await parseFileSymbols(path);
		expect(symbols.length).toBe(1);
		expect(symbols[0]!.name).toBe("fetchData");
		expect(symbols[0]!.symbolType).toBe("function");
	});

	it("extracts classes and their methods", () => {
		const path = writeFixture(
			"class.ts",
			`export class UserService {
	private name: string;

	constructor(name: string) {
		this.name = name;
	}

	getName(): string {
		return this.name;
	}

	async fetchProfile(id: number) {
		return fetch("/user/" + id);
	}
}
`
		);

		const symbols = parseFileSymbols(path);
		const classSymbol = symbols.find((s) => s.name === "UserService");
		expect(classSymbol).toBeDefined();
		expect(classSymbol!.symbolType).toBe("class");

		const getNameMethod = symbols.find((s) => s.name === "UserService.getName");
		expect(getNameMethod).toBeDefined();
		expect(getNameMethod!.symbolType).toBe("method");

		const fetchMethod = symbols.find(
			(s) => s.name === "UserService.fetchProfile"
		);
		expect(fetchMethod).toBeDefined();
	});

	it("extracts interfaces and types", () => {
		const path = writeFixture(
			"types.ts",
			`export interface User {
	id: number;
	name: string;
	email: string;
}

export type UserRole = "admin" | "user" | "guest";
`
		);

		const symbols = parseFileSymbols(path);
		const iface = symbols.find((s) => s.name === "User");
		expect(iface).toBeDefined();
		expect(iface!.symbolType).toBe("interface");

		const typeAlias = symbols.find((s) => s.name === "UserRole");
		expect(typeAlias).toBeDefined();
		expect(typeAlias!.symbolType).toBe("type");
	});

	it("extracts enums", () => {
		const path = writeFixture(
			"enums.ts",
			`export enum Direction {
	Up = "UP",
	Down = "DOWN",
	Left = "LEFT",
	Right = "RIGHT",
}

export const enum Status {
	Active,
	Inactive,
}
`
		);

		const symbols = parseFileSymbols(path);
		expect(symbols.find((s) => s.name === "Direction")).toBeDefined();
		expect(symbols.find((s) => s.name === "Status")).toBeDefined();
	});

	it("detects React components in tsx files", () => {
		const path = writeFixture(
			"Component.tsx",
			`import { useState } from "react";

export function Dashboard() {
	const [count, setCount] = useState(0);
	return <div>{count}</div>;
}

export const Header = () => {
	return <header>Hello</header>;
};
`
		);

		const symbols = parseFileSymbols(path);
		const dashboard = symbols.find((s) => s.name === "Dashboard");
		expect(dashboard).toBeDefined();
		expect(dashboard!.symbolType).toBe("component");

		const header = symbols.find((s) => s.name === "Header");
		expect(header).toBeDefined();
		expect(header!.symbolType).toBe("component");
	});

	it("extracts JSDoc comments", () => {
		const path = writeFixture(
			"documented.ts",
			`/**
 * Computes the sum of two numbers.
 * @param a - first number
 * @param b - second number
 */
export function add(a: number, b: number): number {
	return a + b;
}
`
		);

		const symbols = parseFileSymbols(path);
		expect(symbols[0]!.jsDoc).toContain("Computes the sum");
	});

	it("extracts function calls from body", () => {
		const path = writeFixture(
			"calls.ts",
			`import { validate } from "./utils";
import { transform } from "./transform";

export function process(data: string) {
	const valid = validate(data);
	return transform(valid);
}
`
		);

		const symbols = parseFileSymbols(path);
		const proc = symbols.find((s) => s.name === "process");
		expect(proc).toBeDefined();
		expect(proc!.calls).toContain("validate");
		expect(proc!.calls).toContain("transform");
	});

	it("resolves imports for symbols", () => {
		const path = writeFixture(
			"imports.ts",
			`import { readFile } from "node:fs";
import { join } from "node:path";

export function loadConfig(dir: string) {
	const path = join(dir, "config.json");
	return readFile(path, "utf-8");
}
`
		);

		const symbols = parseFileSymbols(path);
		const load = symbols.find((s) => s.name === "loadConfig");
		expect(load).toBeDefined();
		expect(load!.imports.some((i) => i.includes("join"))).toBe(true);
		expect(load!.imports.some((i) => i.includes("readFile"))).toBe(true);
	});

	it("returns empty for unknown file extensions", () => {
		const path = writeFixture("data.txt", "hello world");
		const symbols = parseFileSymbols(path);
		expect(symbols).toEqual([]);
	});

	it("handles React.memo wrapped components", () => {
		const path = writeFixture(
			"memo.tsx",
			`import React from "react";

export const MemoList = React.memo(function MemoList({ items }: { items: string[] }) {
	return <ul>{items.map(i => <li key={i}>{i}</li>)}</ul>;
});
`
		);

		const symbols = parseFileSymbols(path);
		const memoList = symbols.find((s) => s.name === "MemoList");
		expect(memoList).toBeDefined();
		expect(memoList!.symbolType).toBe("component");
	});

	it("handles export default function", () => {
		const path = writeFixture(
			"default.ts",
			`export default function main() {
	console.log("main");
}
`
		);

		const symbols = parseFileSymbols(path);
		expect(symbols.length).toBe(1);
		expect(symbols[0]!.name).toBe("main");
	});
});

describe("chunkFileSymbols", () => {
	it("produces CodeChunk objects with correct fields", () => {
		const path = writeFixture(
			"chunk-test.ts",
			`export function hello() {
	return "world";
}
`
		);

		const chunks = chunkFileSymbols(path, "2025-01-01");
		expect(chunks.length).toBe(1);
		const chunk = chunks[0]!;
		expect(chunk.symbol).toBe("hello");
		expect(chunk.language).toBe("typescript");
		expect(chunk.lastModified).toBe("2025-01-01");
		expect(chunk.id).toContain("hello");
		expect(chunk.embeddingText).toContain("hello");
		expect(chunk.embeddingText).toContain("function");
	});

	it("returns empty for files with no symbols", () => {
		const path = writeFixture(
			"empty.ts",
			`// just a comment
const x = 42;
`
		);

		const chunks = chunkFileSymbols(path, "2025-01-01");
		expect(chunks.length).toBe(0);
	});
});
