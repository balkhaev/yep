import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { chunkFileSymbols } from "../core/code-chunker.ts";
import {
	deleteCodeChunksByPaths,
	ensureCodeFtsIndex,
	getCodeInsights,
	getIndexedCodePaths,
	initCodeStore,
	insertCodeChunks,
} from "../core/code-store.ts";
import { embedTexts } from "../core/embedder.ts";
import {
	getGitMetadataForFile,
	getGitRelativePath,
	isGitAvailable,
} from "../core/git-metadata.ts";
import { captureSnapshot } from "../core/metrics-store.ts";
import {
	ensureProviderReady,
	readConfig,
	updateConfig,
} from "../lib/config.ts";
import { requireInit } from "../lib/guards.ts";

const CODE_EXTENSIONS = new Set([
	".ts",
	".tsx",
	".js",
	".jsx",
	".py",
	".go",
	".rs",
]);

const IGNORE_DIRS = new Set([
	"node_modules",
	".git",
	".next",
	"dist",
	"build",
	".yep-mem",
	".entire",
	"coverage",
	".turbo",
	".cache",
]);

async function getCurrentCommit(): Promise<string> {
	const proc = Bun.spawn(["git", "rev-parse", "HEAD"], {
		stdout: "pipe",
		stderr: "pipe",
	});
	const output = await new Response(proc.stdout).text();
	await proc.exited;
	return output.trim();
}

async function getFileModifiedTime(filePath: string): Promise<string> {
	try {
		const stats = await stat(filePath);
		return stats.mtime.toISOString();
	} catch {
		return new Date().toISOString();
	}
}

async function walkDirectory(dir: string, root: string): Promise<string[]> {
	const results: string[] = [];
	let entries: string[];
	try {
		entries = await readdir(dir);
	} catch {
		return results;
	}

	for (const entry of entries) {
		if (IGNORE_DIRS.has(entry) || entry.startsWith(".")) {
			continue;
		}
		const fullPath = join(dir, entry);
		let stats;
		try {
			stats = await stat(fullPath);
		} catch {
			continue;
		}
		if (stats.isDirectory()) {
			results.push(...(await walkDirectory(fullPath, root)));
		} else if (stats.isFile()) {
			const ext = fullPath.slice(fullPath.lastIndexOf("."));
			if (CODE_EXTENSIONS.has(ext)) {
				results.push(relative(root, fullPath));
			}
		}
	}
	return results;
}

async function getChangedFiles(
	sinceCommit: string | null
): Promise<Set<string> | null> {
	if (!sinceCommit) {
		return null;
	}
	try {
		const proc = Bun.spawn(
			["git", "diff", "--name-only", sinceCommit, "HEAD"],
			{ stdout: "pipe", stderr: "pipe" }
		);
		const output = await new Response(proc.stdout).text();
		await proc.exited;
		return new Set(output.trim().split("\n").filter(Boolean));
	} catch {
		return null;
	}
}

export interface CodeIndexProgress {
	filesFound: number;
	filesProcessed: number;
	filesToIndex: number;
	symbolsIndexed: number;
}

export type ProgressCallback = (
	message: string,
	progress?: Partial<CodeIndexProgress>
) => void;

export interface CodeIndexResult {
	skipped: boolean;
	totalFiles: number;
	totalSymbols: number;
}

export async function runCodeIndex(
	onProgress?: ProgressCallback
): Promise<CodeIndexResult> {
	const log = onProgress ?? (() => undefined);
	const root = process.cwd();
	const config = readConfig();
	const currentCommit = await getCurrentCommit();

	log("Indexing code symbols...");

	await initCodeStore();

	const changedFiles = await getChangedFiles(
		config.lastCodeIndexCommit ?? null
	);
	const allFiles = await walkDirectory(root, root);

	const filesToIndex =
		changedFiles !== null
			? allFiles.filter((f) => changedFiles.has(f))
			: allFiles;

	if (filesToIndex.length === 0) {
		log("No changed files to index.");
		return { totalFiles: 0, totalSymbols: 0, skipped: true };
	}

	log(`Found ${allFiles.length} code files, ${filesToIndex.length} to index`, {
		filesFound: allFiles.length,
		filesToIndex: filesToIndex.length,
	});

	const indexedPaths = await getIndexedCodePaths();
	let totalChunks = 0;
	let totalFiles = 0;
	const BATCH_SIZE = 20;

	// Check git availability once
	const gitAvailable = await isGitAvailable();
	if (gitAvailable) {
		log("Git available - will extract git metadata");
	}

	for (let i = 0; i < filesToIndex.length; i += BATCH_SIZE) {
		const batch = filesToIndex.slice(i, i + BATCH_SIZE);
		const allBatchChunks: import("../core/code-chunker.ts").CodeChunk[] = [];
		const pathsToDelete: string[] = [];

		// Collect paths to delete and chunks to insert
		for (const relPath of batch) {
			const fullPath = join(root, relPath);
			const lastModified = await getFileModifiedTime(fullPath);

			try {
				const chunks = await chunkFileSymbols(fullPath, lastModified);
				if (chunks.length === 0) {
					continue;
				}

				// Extract git metadata for the file
				if (gitAvailable) {
					const gitRelativePath = await getGitRelativePath(fullPath);
					if (gitRelativePath) {
						const gitMeta = await getGitMetadataForFile(gitRelativePath);
						if (gitMeta) {
							// Enrich all chunks from this file with git metadata
							for (const chunk of chunks) {
								chunk.gitChangeCount = gitMeta.changeCount;
								chunk.gitAuthorCount = gitMeta.authorCount;
								chunk.gitLastChangeDate = gitMeta.lastChangeDate;
							}
						}
					}
				}

				if (indexedPaths.has(fullPath)) {
					pathsToDelete.push(fullPath);
				}

				allBatchChunks.push(...chunks);
				totalFiles++;
			} catch {
				// skip files that can't be parsed
			}
		}

		// Batch delete old chunks (single SQL query for all paths)
		if (pathsToDelete.length > 0) {
			await deleteCodeChunksByPaths(pathsToDelete);
		}

		if (allBatchChunks.length > 0) {
			const texts = allBatchChunks.map((c) => c.embeddingText);
			const vectors = await embedTexts(texts, {
				onBatchComplete(completed, total) {
					log(`Embedding ${completed}/${total}...`);
				},
			});
			const inserted = await insertCodeChunks(
				allBatchChunks,
				vectors,
				currentCommit
			);
			totalChunks += inserted;
		}

		const processed = Math.min(i + BATCH_SIZE, filesToIndex.length);
		log(`${processed}/${filesToIndex.length} files`, {
			filesProcessed: processed,
			symbolsIndexed: totalChunks,
		});
	}

	await ensureCodeFtsIndex();
	updateConfig({ lastCodeIndexCommit: currentCommit });

	// Capture metrics snapshot after indexing
	log("Capturing metrics snapshot...");
	try {
		const insights = await getCodeInsights();
		if (insights) {
			await captureSnapshot(insights, currentCommit);
			log("Metrics snapshot captured");
		}
	} catch (err) {
		log(`Failed to capture metrics snapshot: ${err}`);
		// Don't fail the indexing if snapshot fails
	}

	log(`Indexed ${totalChunks} symbols from ${totalFiles} files`);
	return { totalFiles, totalSymbols: totalChunks, skipped: false };
}

export async function indexCodeCommand(): Promise<void> {
	requireInit();
	ensureProviderReady();

	const result = await runCodeIndex((msg) =>
		console.log(`[code-index] ${msg}`)
	);

	if (result.skipped) {
		return;
	}

	console.log(
		`\n[done] Indexed ${result.totalSymbols} symbols from ${result.totalFiles} files`
	);
}
