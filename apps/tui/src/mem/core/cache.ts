import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getStorePath } from "../lib/config.ts";
import { createLogger } from "../lib/logger.ts";

const log = createLogger("cache");

const MAX_EMBEDDING_ENTRIES = 200;
const MAX_SEARCH_ENTRIES = 50;
const SEARCH_TTL_MS = 5 * 60 * 1000;

interface EmbeddingCacheEntry {
	ts: number;
	vector: number[];
}

interface SearchCacheEntry {
	results: unknown[];
	ts: number;
}

interface CacheData<T> {
	entries: Record<string, T>;
}

async function ensureCacheDir(): Promise<string> {
	const dir = join(getStorePath(), "..", "cache");
	try {
		await access(dir);
	} catch {
		await mkdir(dir, { recursive: true });
	}
	return dir;
}

function getCacheDir(): string {
	return join(getStorePath(), "..", "cache");
}

function hashKey(text: string): string {
	return createHash("sha256").update(text).digest("hex").slice(0, 24);
}

async function readCacheFile<T>(path: string): Promise<CacheData<T>> {
	try {
		await access(path);
		const content = await readFile(path, "utf-8");
		return JSON.parse(content) as CacheData<T>;
	} catch (err) {
		log.debug("Failed to read cache file", { path, error: String(err) });
		return { entries: {} };
	}
}

async function writeCacheFile<T>(
	path: string,
	data: CacheData<T>
): Promise<void> {
	await ensureCacheDir();
	await writeFile(path, JSON.stringify(data));
}

function evictLRU<T extends { ts: number }>(
	entries: Record<string, T>,
	maxSize: number
): Record<string, T> {
	const keys = Object.keys(entries);
	if (keys.length <= maxSize) {
		return entries;
	}

	const sorted = keys
		.map((k) => ({ key: k, ts: entries[k]?.ts ?? 0 }))
		.sort((a, b) => b.ts - a.ts);

	const kept: Record<string, T> = {};
	for (const item of sorted.slice(0, maxSize)) {
		const entry = entries[item.key];
		if (entry) {
			kept[item.key] = entry;
		}
	}
	return kept;
}

function embeddingCachePath(): string {
	return join(getCacheDir(), "embeddings.json");
}

function searchCachePath(): string {
	return join(getCacheDir(), "search-results.json");
}

export async function getCachedEmbedding(
	text: string
): Promise<number[] | null> {
	const key = hashKey(text);
	const data = await readCacheFile<EmbeddingCacheEntry>(embeddingCachePath());
	const entry = data.entries[key];
	if (entry?.vector) {
		return entry.vector;
	}
	return null;
}

export async function setCachedEmbedding(
	text: string,
	vector: number[]
): Promise<void> {
	const path = embeddingCachePath();
	const data = await readCacheFile<EmbeddingCacheEntry>(path);
	const key = hashKey(text);
	data.entries[key] = { vector, ts: Date.now() };
	data.entries = evictLRU(data.entries, MAX_EMBEDDING_ENTRIES);
	await writeCacheFile(path, data);
}

export async function getCachedSearch(
	queryHash: string
): Promise<unknown[] | null> {
	const data = await readCacheFile<SearchCacheEntry>(searchCachePath());
	const entry = data.entries[queryHash];
	if (!entry) {
		return null;
	}
	if (Date.now() - entry.ts > SEARCH_TTL_MS) {
		return null;
	}
	return entry.results;
}

export async function setCachedSearch(
	queryHash: string,
	results: unknown[]
): Promise<void> {
	const path = searchCachePath();
	const data = await readCacheFile<SearchCacheEntry>(path);
	data.entries[queryHash] = { results, ts: Date.now() };
	data.entries = evictLRU(data.entries, MAX_SEARCH_ENTRIES);
	await writeCacheFile(path, data);
}

export function buildSearchCacheKey(
	queryText: string,
	topK: number,
	filter: Record<string, unknown>
): string {
	const raw = JSON.stringify({ queryText, topK, filter });
	return hashKey(raw);
}

export async function clearCache(): Promise<void> {
	const dir = getCacheDir();
	for (const file of ["embeddings.json", "search-results.json"]) {
		const path = join(dir, file);
		try {
			await access(path);
			await writeFile(path, JSON.stringify({ entries: {} }));
		} catch {
			// File doesn't exist, skip
		}
	}
}
