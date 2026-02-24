export interface ComplexityResult {
	cognitive: number;
	cyclomatic: number;
	hasDoc: boolean;
}

const NESTING_OPEN_RE = /\b(if|for|while|do|switch|try)\b/;
const NESTING_CLOSE = "}";
const LOGICAL_OP_RE = /&&|\|\|/g;
const TERNARY_RE = /\?\s*[^:?]+\s*:/g;
const CASE_CATCH_RE = /\b(case|catch)\b/;

/**
 * Strips string/template literals and comments so they don't
 * produce false-positive branch matches.
 */
function stripNoise(body: string): string {
	return body
		.replace(/\/\/.*$/gm, "")
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/`(?:[^`\\]|\\.)*`/g, '""')
		.replace(/"(?:[^"\\]|\\.)*"/g, '""')
		.replace(/'(?:[^'\\]|\\.)*'/g, '""');
}

export function calculateComplexity(
	body: string,
	summary: string
): ComplexityResult {
	const clean = stripNoise(body);
	const lines = clean.split("\n");

	let cyclomatic = 1;
	let cognitive = 0;
	let nesting = 0;

	for (const line of lines) {
		const trimmed = line.trimStart();

		if (NESTING_OPEN_RE.test(trimmed)) {
			cognitive += 1 + nesting;
			cyclomatic++;
			nesting++;
		}

		for (const ch of trimmed) {
			if (ch === "{") {
				continue;
			}
			if (ch === NESTING_CLOSE && nesting > 0) {
				nesting--;
			}
		}

		const logicalOps = trimmed.match(LOGICAL_OP_RE);
		if (logicalOps) {
			cyclomatic += logicalOps.length;
			cognitive += logicalOps.length;
		}

		const ternaries = trimmed.match(TERNARY_RE);
		if (ternaries) {
			cyclomatic += ternaries.length;
			cognitive += ternaries.length * (1 + nesting);
		}

		if (CASE_CATCH_RE.test(trimmed)) {
			cyclomatic++;
		}
	}

	const hasDoc =
		summary.length > 0 &&
		summary !== `${body.split("\n")[0]?.trim().split("(")[0]}`;

	return { cyclomatic, cognitive, hasDoc };
}

export interface ComplexityDistribution {
	count: number;
	range: string;
}

const COMPLEXITY_BUCKETS: Array<{ label: string; max: number; min: number }> = [
	{ label: "1-5", min: 1, max: 5 },
	{ label: "6-10", min: 6, max: 10 },
	{ label: "11-20", min: 11, max: 20 },
	{ label: "21+", min: 21, max: Number.POSITIVE_INFINITY },
];

export function buildComplexityDistribution(
	values: number[]
): ComplexityDistribution[] {
	return COMPLEXITY_BUCKETS.map((b) => ({
		range: b.label,
		count: values.filter((v) => v >= b.min && v <= b.max).length,
	}));
}
