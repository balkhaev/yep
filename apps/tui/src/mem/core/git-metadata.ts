// @ts-nocheck
/**
 * git-metadata.ts - Извлечение git истории для символов кода
 *
 * Использует git log для получения:
 * - changeCount: количество изменений символа
 * - authorCount: количество уникальных авторов
 * - lastChangeDate: дата последнего изменения
 * - recentCommits: список недавних коммитов (опционально)
 *
 * Для точного отслеживания использует git log -L с диапазоном строк.
 */

import { createLogger } from "../lib/logger.ts";

const log = createLogger("git-metadata");

/**
 * Git метаданные для символа кода
 */
export interface GitMetadata {
	authorCount: number;
	changeCount: number;
	lastChangeDate: string; // ISO string
	recentCommits?: string[]; // Последние 5 commit hashes
}

/**
 * Получить git метаданные для диапазона строк в файле
 *
 * @param filePath - Путь к файлу (относительно git root)
 * @param startLine - Начальная строка (1-indexed)
 * @param endLine - Конечная строка (1-indexed)
 * @returns Git метаданные или null если недоступно
 */
export async function getGitMetadataForLines(
	filePath: string,
	startLine: number,
	endLine: number
): Promise<GitMetadata | null> {
	try {
		// Get git root to execute commands from there
		const gitRoot = await getGitRoot();
		if (!gitRoot) {
			return null;
		}

		// git log -L для отслеживания истории диапазона строк
		// Формат: --pretty=format:%H|%an|%ai для парсинга
		const proc = Bun.spawn(
			[
				"git",
				"log",
				"-L",
				`${startLine},${endLine}:${filePath}`,
				"--pretty=format:%H|%an|%ai",
				"--no-patch",
			],
			{
				stdout: "pipe",
				stderr: "pipe",
				cwd: gitRoot,
			}
		);

		const output = await new Response(proc.stdout).text();
		const exitCode = await proc.exited;

		if (exitCode !== 0 || !output.trim()) {
			// Файл может быть не в git или диапазон не найден
			return null;
		}

		// Парсинг результата
		const lines = output.trim().split("\n");
		const commits: Array<{
			author: string;
			date: string;
			hash: string;
		}> = [];

		for (const line of lines) {
			if (!line.includes("|")) continue;
			const [hash, author, date] = line.split("|");
			if (hash && author && date) {
				commits.push({ hash: hash.trim(), author: author.trim(), date: date.trim() });
			}
		}

		if (commits.length === 0) {
			return null;
		}

		// Вычислить метрики
		const changeCount = commits.length;
		const uniqueAuthors = new Set(commits.map((c) => c.author));
		const authorCount = uniqueAuthors.size;
		const lastChangeDate = commits[0].date; // Первый коммит - последний по времени
		const recentCommits = commits.slice(0, 5).map((c) => c.hash);

		return {
			changeCount,
			authorCount,
			lastChangeDate,
			recentCommits,
		};
	} catch (err) {
		log.warn("Failed to get git metadata", { error: err, filePath });
		return null;
	}
}

/**
 * Получить git root директорию
 */
async function getGitRoot(): Promise<string | null> {
	try {
		const proc = Bun.spawn(
			["git", "rev-parse", "--show-toplevel"],
			{
				stdout: "pipe",
				stderr: "pipe",
				cwd: process.cwd(),
			}
		);

		const output = await new Response(proc.stdout).text();
		const exitCode = await proc.exited;

		if (exitCode !== 0 || !output.trim()) {
			return null;
		}

		return output.trim();
	} catch {
		return null;
	}
}

/**
 * Получить git метаданные для всего файла
 *
 * Более быстрая альтернатива когда не нужна точность по строкам
 *
 * @param filePath - Путь к файлу (относительно git root)
 * @returns Git метаданные или null если недоступно
 */
export async function getGitMetadataForFile(
	filePath: string
): Promise<GitMetadata | null> {
	try {
		// Get git root to execute commands from there
		const gitRoot = await getGitRoot();
		if (!gitRoot) {
			return null;
		}

		// git log для всего файла
		const proc = Bun.spawn(
			[
				"git",
				"log",
				"--follow",
				"--pretty=format:%H|%an|%ai",
				"--",
				filePath,
			],
			{
				stdout: "pipe",
				stderr: "pipe",
				cwd: gitRoot,
			}
		);

		const output = await new Response(proc.stdout).text();
		const stderr = await new Response(proc.stderr).text();
		const exitCode = await proc.exited;

		if (exitCode !== 0) {
			return null;
		}

		if (!output.trim()) {
			return null;
		}

		// Парсинг результата
		const lines = output.trim().split("\n");
		const commits: Array<{
			author: string;
			date: string;
			hash: string;
		}> = [];

		for (const line of lines) {
			if (!line.includes("|")) continue;
			const [hash, author, date] = line.split("|");
			if (hash && author && date) {
				commits.push({ hash: hash.trim(), author: author.trim(), date: date.trim() });
			}
		}

		if (commits.length === 0) {
			return null;
		}

		const changeCount = commits.length;
		const uniqueAuthors = new Set(commits.map((c) => c.author));
		const authorCount = uniqueAuthors.size;
		const lastChangeDate = commits[0].date;
		const recentCommits = commits.slice(0, 5).map((c) => c.hash);

		return {
			changeCount,
			authorCount,
			lastChangeDate,
			recentCommits,
		};
	} catch (err) {
		log.warn("Failed to get git metadata for file", { error: err, filePath });
		return null;
	}
}

/**
 * Batch извлечение git метаданных для нескольких файлов
 *
 * Более эффективно чем множественные вызовы getGitMetadataForFile
 *
 * @param filePaths - Массив путей к файлам
 * @returns Map путь → метаданные (null если недоступно)
 */
export async function getGitMetadataForFiles(
	filePaths: string[]
): Promise<Map<string, GitMetadata | null>> {
	const results = new Map<string, GitMetadata | null>();

	// Обрабатываем файлы параллельно батчами по 10
	const BATCH_SIZE = 10;
	for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
		const batch = filePaths.slice(i, i + BATCH_SIZE);
		const batchResults = await Promise.all(
			batch.map(async (path) => ({
				metadata: await getGitMetadataForFile(path),
				path,
			}))
		);

		for (const { path, metadata } of batchResults) {
			results.set(path, metadata);
		}
	}

	return results;
}

/**
 * Проверить доступность git репозитория
 *
 * @returns true если текущая директория - git репозиторий
 */
export async function isGitAvailable(): Promise<boolean> {
	try {
		const proc = Bun.spawn(["git", "rev-parse", "--git-dir"], {
			stdout: "pipe",
			stderr: "pipe",
			cwd: process.cwd(),
		});

		const exitCode = await proc.exited;
		return exitCode === 0;
	} catch {
		return false;
	}
}

/**
 * Получить относительный путь файла от git root
 *
 * @param absolutePath - Абсолютный путь к файлу
 * @returns Относительный путь от git root или null
 */
export async function getGitRelativePath(
	absolutePath: string
): Promise<string | null> {
	try {
		// Получить git root
		const rootProc = Bun.spawn(
			["git", "rev-parse", "--show-toplevel"],
			{
				stdout: "pipe",
				stderr: "pipe",
				cwd: process.cwd(),
			}
		);

		const rootOutput = await new Response(rootProc.stdout).text();
		const rootExitCode = await rootProc.exited;

		if (rootExitCode !== 0 || !rootOutput.trim()) {
			return null;
		}

		const gitRoot = rootOutput.trim();

		// Вычислить относительный путь
		if (absolutePath.startsWith(gitRoot)) {
			const relativePath = absolutePath.slice(gitRoot.length + 1);
			return relativePath;
		}

		return null;
	} catch {
		return null;
	}
}
