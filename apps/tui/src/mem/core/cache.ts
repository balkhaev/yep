import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getStorePath } from "../lib/config.ts";

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

function getCacheDir(): string {
	const dir = join(getStorePath(), "..", "cache");
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	return dir;
}

function hashKey(text: string): string {
	return createHash("sha256").update(text).digest("hex").slice(0, 24);
}

function readCacheFile<T>(path: string): CacheData<T> {
	if (!existsSync(path)) {
		return { entries: {} };
	}
	try {
		return JSON.parse(readFileSync(path, "utf-8")) as CacheData<T>;
	} catch {
		return { entries: {} };
	}
}

function writeCacheFile<T>(path: string, data: CacheData<T>): void {
	writeFileSync(path, JSON.stringify(data));
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

export function getCachedEmbedding(text: string): number[] | null {
	const key = hashKey(text);
	const data = readCacheFile<EmbeddingCacheEntry>(embeddingCachePath());
	const entry = data.entries[key];
	if (entry?.vector) {
		return entry.vector;
	}
	return null;
}

export function setCachedEmbedding(text: string, vector: number[]): void {
	const path = embeddingCachePath();
	const data = readCacheFile<EmbeddingCacheEntry>(path);
	const key = hashKey(text);
	data.entries[key] = { vector, ts: Date.now() };
	data.entries = evictLRU(data.entries, MAX_EMBEDDING_ENTRIES);
	writeCacheFile(path, data);
}

export function getCachedSearch(queryHash: string): unknown[] | null {
	const data = readCacheFile<SearchCacheEntry>(searchCachePath());
	const entry = data.entries[queryHash];
	if (!entry) {
		return null;
	}
	if (Date.now() - entry.ts > SEARCH_TTL_MS) {
		return null;
	}
	return entry.results;
}

export function setCachedSearch(queryHash: string, results: unknown[]): void {
	const path = searchCachePath();
	const data = readCacheFile<SearchCacheEntry>(path);
	data.entries[queryHash] = { results, ts: Date.now() };
	data.entries = evictLRU(data.entries, MAX_SEARCH_ENTRIES);
	writeCacheFile(path, data);
}

export function buildSearchCacheKey(
	queryText: string,
	topK: number,
	filter: Record<string, unknown>
): string {
	const raw = JSON.stringify({ queryText, topK, filter });
	return hashKey(raw);
}

export function clearCache(): void {
	const dir = getCacheDir();
	for (const file of ["embeddings.json", "search-results.json"]) {
		const path = join(dir, file);
		if (existsSync(path)) {
			writeFileSync(path, JSON.stringify({ entries: {} }));
		}
	}
}
