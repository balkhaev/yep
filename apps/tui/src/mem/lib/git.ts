const CHECKPOINTS_BRANCH = "entire/checkpoints/v1";

interface GitCommit {
	date: string;
	hash: string;
	subject: string;
}

async function exec(cmd: string): Promise<string> {
	const proc = Bun.spawn(["sh", "-c", cmd], {
		stdout: "pipe",
		stderr: "pipe",
	});
	const output = await new Response(proc.stdout).text();
	const exitCode = await proc.exited;
	if (exitCode !== 0) {
		const stderr = await new Response(proc.stderr).text();
		throw new Error(`Command failed (${exitCode}): ${cmd}\n${stderr}`);
	}
	return output.trim();
}

export async function checkpointBranchExists(): Promise<boolean> {
	try {
		await exec(`git rev-parse --verify ${CHECKPOINTS_BRANCH} 2>/dev/null`);
		return true;
	} catch {
		return false;
	}
}

export async function getCheckpointCommits(
	sinceCommit?: string | null
): Promise<GitCommit[]> {
	const range = sinceCommit
		? `${sinceCommit}..${CHECKPOINTS_BRANCH}`
		: CHECKPOINTS_BRANCH;

	const format = "%H%n%s%n%aI";
	const output = await exec(
		`git log --format="${format}" --reverse ${range} 2>/dev/null || true`
	);

	if (!output) {
		return [];
	}

	const lines = output.split("\n");
	const commits: GitCommit[] = [];

	for (let i = 0; i + 2 < lines.length; i += 3) {
		const hash = lines[i];
		const subject = lines[i + 1];
		const date = lines[i + 2];
		if (hash && subject && date) {
			commits.push({ hash, subject, date });
		}
	}

	return commits;
}

export async function getCommitFiles(commitHash: string): Promise<string[]> {
	const output = await exec(
		`git diff-tree --no-commit-id --name-only -r ${commitHash}`
	);
	return output ? output.split("\n").filter(Boolean) : [];
}

export function getFileAtCommit(
	commitHash: string,
	filePath: string
): Promise<string> {
	return exec(`git show ${commitHash}:${filePath}`);
}

export function getCommitDiff(commitHash: string): Promise<string> {
	return exec(`git diff-tree -p ${commitHash}`);
}

export async function getLatestCheckpointCommit(): Promise<string | null> {
	try {
		return await exec(`git rev-parse ${CHECKPOINTS_BRANCH}`);
	} catch {
		return null;
	}
}
