import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getStorePath } from "../lib/config.ts";

export interface GoldenEntry {
	expectedIds?: string[];
	expectedKeywords: string[];
	query: string;
}

const GOLDEN_FILE = "golden.json";

function goldenPath(): string {
	const dir = join(getStorePath(), "..");
	return join(dir, "eval", GOLDEN_FILE);
}

function ensureDir(dir: string): void {
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
}

export function loadGoldenSet(): GoldenEntry[] {
	const path = goldenPath();
	if (!existsSync(path)) {
		return [];
	}
	try {
		return JSON.parse(readFileSync(path, "utf-8")) as GoldenEntry[];
	} catch {
		return [];
	}
}

export function saveGoldenSet(entries: GoldenEntry[]): void {
	const path = goldenPath();
	const dir = join(path, "..");
	ensureDir(dir);
	writeFileSync(path, JSON.stringify(entries, null, "\t"));
}

const TEMPLATE: GoldenEntry[] = [
	{
		query: "How does user authentication work?",
		expectedKeywords: ["auth", "login", "middleware", "token"],
	},
	{
		query: "Where is the database schema defined?",
		expectedKeywords: ["prisma", "schema", "migration", "model"],
	},
	{
		query: "How to add a new API endpoint?",
		expectedKeywords: ["route", "handler", "hono", "api"],
	},
];

export function initGoldenSet(): void {
	const path = goldenPath();
	if (existsSync(path)) {
		return;
	}
	saveGoldenSet(TEMPLATE);
}
