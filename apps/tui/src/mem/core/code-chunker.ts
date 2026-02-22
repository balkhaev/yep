import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { parseFileWithTsCompiler } from "./ts-parser.ts";

export interface CodeSymbol {
	body: string;
	calls: string[];
	endLine: number;
	imports: string[];
	jsDoc: string;
	name: string;
	path: string;
	startLine: number;
	symbolType:
		| "function"
		| "class"
		| "method"
		| "interface"
		| "type"
		| "enum"
		| "component";
}

export interface CodeChunk {
	body: string;
	calls: string;
	embeddingText: string;
	id: string;
	imports: string;
	language: string;
	lastModified: string;
	path: string;
	summary: string;
	symbol: string;
	symbolType: string;
}

const LANG_BY_EXT: Record<string, string> = {
	".ts": "typescript",
	".tsx": "typescript",
	".js": "javascript",
	".jsx": "javascript",
	".py": "python",
	".go": "go",
	".rs": "rust",
};

const MAX_BODY_LENGTH = 3000;
const MAX_EMBEDDING_LENGTH = 4000;

const FUNCTION_RE = /^(export\s+)?(async\s+)?function\s+(\w+)/;
const EXPORT_DEFAULT_FUNC_RE =
	/^export\s+default\s+(async\s+)?function\s+(\w+)/;
const ARROW_RE =
	/^(export\s+)?(const|let)\s+(\w+)\s*=\s*(async\s+)?(\([^)]*\)|[a-zA-Z_]\w*)\s*(?::\s*[^=]+)?\s*=>/;
const FUNC_EXPRESSION_RE =
	/^(export\s+)?(const|let)\s+(\w+)\s*=\s*(async\s+)?function/;
const REACT_WRAPPER_RE =
	/^(export\s+)?(const|let)\s+(\w+)\s*=\s*(?:React\.)?(?:memo|forwardRef|lazy)\s*\(/;
const MULTILINE_ARROW_START_RE = /^(export\s+)?(const|let)\s+(\w+)\s*[=:]/;
const CLASS_RE = /^(export\s+)?(abstract\s+)?class\s+(\w+)/;
const INTERFACE_RE = /^(export\s+)?interface\s+(\w+)/;
const TYPE_RE = /^(export\s+)?type\s+(\w+)/;
const ENUM_RE = /^(export\s+)?(const\s+)?enum\s+(\w+)/;
const METHOD_NAME_RE = /^(\w+)\s*[(<]/;
const CLASS_MODIFIER_RE =
	/^(public|private|protected|static|abstract|override|readonly|async|get|set)\s+/g;
const JSDOC_START_RE = /^\s*\/\*\*/;
const JSDOC_END_RE = /\*\//;
const COMMENT_RE = /^\s*\/\//;
const UPPER_RE = /[A-Z]/;
const JSDOC_STRIP_RE = /\/\*\*|\*\/|\s*\*\s?/g;
const COMMENT_STRIP_RE = /^\/\/\s?/;
const TSX_EXT_RE = /\.[jt]sx$/;

const IMPORT_NAMED_RE = /import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["']/g;
const IMPORT_DEFAULT_RE = /import\s+(\w+)\s+from\s+["']([^"']+)["']/g;
const CALL_RE = /\b([a-zA-Z_]\w{2,})\s*\(/g;
const AS_SPLIT_RE = /\s+as\s+/;

const JS_KEYWORDS = new Set([
	"if",
	"for",
	"while",
	"switch",
	"catch",
	"return",
	"throw",
	"new",
	"typeof",
	"instanceof",
	"void",
	"delete",
	"await",
	"import",
	"export",
	"from",
	"const",
	"let",
	"var",
	"function",
	"class",
	"interface",
	"type",
	"enum",
	"extends",
	"implements",
	"async",
	"yield",
	"super",
	"this",
	"true",
	"false",
	"null",
	"undefined",
	"try",
	"finally",
	"else",
	"case",
	"break",
	"continue",
	"default",
	"debugger",
	"with",
	"static",
	"abstract",
	"public",
	"private",
	"protected",
	"readonly",
	"override",
	"declare",
	"require",
	"module",
	"exports",
	"console",
	"process",
	"Array",
	"Object",
	"String",
	"Number",
	"Boolean",
	"Map",
	"Set",
	"Promise",
	"Error",
	"Math",
	"JSON",
	"Date",
	"RegExp",
	"Symbol",
	"parseInt",
	"parseFloat",
	"isNaN",
	"setTimeout",
	"setInterval",
	"clearTimeout",
]);

function detectLanguage(filePath: string): string {
	return LANG_BY_EXT[extname(filePath)] ?? "unknown";
}

interface FileImports {
	byName: Map<string, string>;
}

function extractFileImports(content: string): FileImports {
	const byName = new Map<string, string>();
	for (const m of content.matchAll(IMPORT_NAMED_RE)) {
		const names = (m[1] ?? "").split(",");
		const source = m[2] ?? "";
		for (const raw of names) {
			const name = raw.trim().split(AS_SPLIT_RE).pop()?.trim();
			if (name) {
				byName.set(name, source);
			}
		}
	}
	for (const m of content.matchAll(IMPORT_DEFAULT_RE)) {
		const name = m[1] ?? "";
		const source = m[2] ?? "";
		if (name) {
			byName.set(name, source);
		}
	}
	return { byName };
}

function extractCallsFromBody(body: string, ownName: string): string[] {
	const calls = new Set<string>();
	for (const m of body.matchAll(CALL_RE)) {
		const name = m[1] ?? "";
		if (name && name !== ownName && !JS_KEYWORDS.has(name)) {
			calls.add(name);
		}
	}
	return [...calls].slice(0, 30);
}

function resolveImportsForSymbol(
	body: string,
	calls: string[],
	fileImports: FileImports
): string[] {
	const resolved: string[] = [];
	for (const call of calls) {
		const source = fileImports.byName.get(call);
		if (source) {
			resolved.push(`${call}:${source}`);
		}
	}
	for (const [name, source] of fileImports.byName) {
		if (
			body.includes(name) &&
			!resolved.some((r) => r.startsWith(`${name}:`))
		) {
			resolved.push(`${name}:${source}`);
		}
	}
	return resolved.slice(0, 30);
}

function findBlockEnd(lines: string[], startIdx: number): number {
	let depth = 0;
	let found = false;
	for (let i = startIdx; i < lines.length; i++) {
		const line = lines[i] ?? "";
		for (const ch of line) {
			if (ch === "{") {
				depth++;
				found = true;
			} else if (ch === "}") {
				depth--;
				if (found && depth === 0) {
					return i;
				}
			}
		}
	}
	return Math.min(startIdx + 50, lines.length - 1);
}

function findTypeEnd(lines: string[], startIdx: number): number {
	let depth = 0;
	for (let i = startIdx; i < lines.length; i++) {
		const line = lines[i] ?? "";
		for (const ch of line) {
			if (ch === "{") {
				depth++;
			} else if (ch === "}") {
				depth--;
				if (depth === 0) {
					return i;
				}
			}
		}
		if (depth === 0 && line.includes(";")) {
			return i;
		}
	}
	return Math.min(startIdx + 30, lines.length - 1);
}

function extractJsDoc(lines: string[], lineIdx: number): string {
	const docLines: string[] = [];
	let i = lineIdx - 1;

	while (i >= 0 && COMMENT_RE.test(lines[i] ?? "")) {
		docLines.unshift((lines[i] ?? "").trim().replace(COMMENT_STRIP_RE, ""));
		i--;
	}
	if (docLines.length > 0) {
		return docLines.join("\n");
	}

	i = lineIdx - 1;
	while (i >= 0) {
		const line = lines[i] ?? "";
		if (JSDOC_END_RE.test(line)) {
			const blockLines: string[] = [];
			for (let j = i; j >= 0; j--) {
				blockLines.unshift((lines[j] ?? "").trim());
				if (JSDOC_START_RE.test(lines[j] ?? "")) {
					break;
				}
			}
			return blockLines.join("\n").replace(JSDOC_STRIP_RE, " ").trim();
		}
		if (line.trim() !== "") {
			break;
		}
		i--;
	}

	return "";
}

interface SymbolMatch {
	name: string;
	nameIdx: number;
	symbolType: CodeSymbol["symbolType"];
}

function matchSymbol(trimmed: string): SymbolMatch | null {
	const matchers: Array<{
		nameIdx: number;
		re: RegExp;
		symbolType: CodeSymbol["symbolType"];
	}> = [
		{ re: EXPORT_DEFAULT_FUNC_RE, symbolType: "function", nameIdx: 2 },
		{ re: FUNCTION_RE, symbolType: "function", nameIdx: 3 },
		{ re: ARROW_RE, symbolType: "function", nameIdx: 3 },
		{ re: FUNC_EXPRESSION_RE, symbolType: "function", nameIdx: 3 },
		{ re: REACT_WRAPPER_RE, symbolType: "component", nameIdx: 3 },
		{ re: CLASS_RE, symbolType: "class", nameIdx: 3 },
		{ re: INTERFACE_RE, symbolType: "interface", nameIdx: 2 },
		{ re: TYPE_RE, symbolType: "type", nameIdx: 2 },
		{ re: ENUM_RE, symbolType: "enum", nameIdx: 3 },
	];

	for (const m of matchers) {
		const match = trimmed.match(m.re);
		if (match) {
			const name = match[m.nameIdx];
			if (name) {
				return { name, symbolType: m.symbolType, nameIdx: m.nameIdx };
			}
		}
	}
	return null;
}

const STRINGS_AND_REGEX_RE =
	/(['"`])(?:(?!\1)[^\\]|\\.)*?\1|\/(?:[^/\\]|\\.)+\/[gimsuy]*/g;

function hasTopLevelArrow(line: string): boolean {
	const stripped = line.replace(STRINGS_AND_REGEX_RE, "");
	let depth = 0;
	let prev = "";
	for (const ch of stripped) {
		if (ch === "(" || ch === "[") {
			depth++;
		} else if (ch === ")" || ch === "]") {
			depth--;
		} else if (ch === ">" && prev === "=" && depth === 0) {
			return true;
		}
		prev = ch;
	}
	return false;
}

const VALID_ARROW_RHS_RE =
	/=\s*(?:async\s+)?(?:\(|<|[a-zA-Z_]\w*\s*(?:=>|,|\)))/;

function tryMatchMultilineArrow(
	lines: string[],
	lineIdx: number
): SymbolMatch | null {
	const trimmed = (lines[lineIdx] ?? "").trimStart();
	const start = trimmed.match(MULTILINE_ARROW_START_RE);
	if (!start) {
		return null;
	}
	const name = start[3];
	if (!name) {
		return null;
	}
	if (trimmed.includes(";") || trimmed.endsWith(",")) {
		return null;
	}

	const eqIdx = trimmed.indexOf("=");
	if (eqIdx !== -1) {
		const rhs = trimmed.slice(eqIdx);
		if (!VALID_ARROW_RHS_RE.test(rhs)) {
			return null;
		}
	}

	const lookahead = Math.min(lineIdx + 8, lines.length);
	for (let j = lineIdx; j < lookahead; j++) {
		const line = lines[j] ?? "";
		if (hasTopLevelArrow(line)) {
			return { name, symbolType: "function", nameIdx: 3 };
		}
		if (j > lineIdx && (line.trim() === "" || line.includes(";"))) {
			break;
		}
	}
	return null;
}

function extractClassMethods(
	className: string,
	body: string,
	classStartLine: number,
	filePath: string,
	fileImports: FileImports
): CodeSymbol[] {
	const methods: CodeSymbol[] = [];
	const bodyLines = body.split("\n");

	for (let i = 1; i < bodyLines.length; i++) {
		const trimmed = (bodyLines[i] ?? "").trimStart();
		if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*")) {
			continue;
		}

		const stripped = trimmed
			.replace(CLASS_MODIFIER_RE, "")
			.replace(CLASS_MODIFIER_RE, "");

		const methodMatch = stripped.match(METHOD_NAME_RE);
		if (!methodMatch) {
			continue;
		}
		const methodName = methodMatch[1] ?? "";
		if (
			!methodName ||
			JS_KEYWORDS.has(methodName) ||
			methodName === "constructor"
		) {
			continue;
		}

		const methodEnd = findBlockEnd(bodyLines, i);
		const methodBody = bodyLines
			.slice(i, methodEnd + 1)
			.join("\n")
			.slice(0, MAX_BODY_LENGTH);
		const jsDoc = extractJsDoc(bodyLines, i);
		const calls = extractCallsFromBody(methodBody, methodName);
		const imports = resolveImportsForSymbol(methodBody, calls, fileImports);

		methods.push({
			name: `${className}.${methodName}`,
			symbolType: "method",
			path: filePath,
			startLine: classStartLine + i,
			endLine: classStartLine + methodEnd,
			body: methodBody,
			jsDoc,
			calls,
			imports,
		});

		i = methodEnd;
	}

	return methods;
}

const TS_JS_EXTS = new Set([".ts", ".tsx", ".js", ".jsx"]);

export function parseFileSymbols(filePath: string): CodeSymbol[] {
	const language = detectLanguage(filePath);
	if (language === "unknown") {
		return [];
	}

	const ext = extname(filePath);
	if (TS_JS_EXTS.has(ext)) {
		try {
			return parseFileWithTsCompiler(filePath);
		} catch {
			// fall through to regex parser
		}
	}

	return parseFileSymbolsRegex(filePath);
}

function parseFileSymbolsRegex(filePath: string): CodeSymbol[] {
	const content = readFileSync(filePath, "utf-8");
	const lines = content.split("\n");
	const symbols: CodeSymbol[] = [];
	const language = detectLanguage(filePath);

	const fileImports = extractFileImports(content);
	const isTsx = TSX_EXT_RE.test(filePath);

	for (let i = 0; i < lines.length; i++) {
		const trimmed = (lines[i] ?? "").trimStart();
		if (trimmed.endsWith(",")) {
			continue;
		}
		let matched = matchSymbol(trimmed);

		if (!matched) {
			matched = tryMatchMultilineArrow(lines, i);
		}
		if (!matched) {
			continue;
		}

		let { symbolType } = matched;
		const { name } = matched;

		if (
			language === "typescript" &&
			symbolType === "function" &&
			isTsx &&
			UPPER_RE.test(name[0] ?? "")
		) {
			symbolType = "component";
		}

		const endLine =
			symbolType === "type" || symbolType === "enum"
				? findTypeEnd(lines, i)
				: findBlockEnd(lines, i);
		const jsDoc = extractJsDoc(lines, i);
		const body = lines
			.slice(i, endLine + 1)
			.join("\n")
			.slice(0, MAX_BODY_LENGTH);

		const calls = extractCallsFromBody(body, name);
		const imports = resolveImportsForSymbol(body, calls, fileImports);

		symbols.push({
			name,
			symbolType,
			path: filePath,
			startLine: i + 1,
			endLine: endLine + 1,
			body,
			jsDoc,
			calls,
			imports,
		});

		if (symbolType === "class") {
			const classMethods = extractClassMethods(
				name,
				body,
				i,
				filePath,
				fileImports
			);
			symbols.push(...classMethods);
		}
	}

	return symbols;
}

function buildCodeEmbeddingText(sym: CodeSymbol): string {
	const parts = [`${sym.symbolType} ${sym.name} in ${basename(sym.path)}`];
	if (sym.jsDoc) {
		parts.push(sym.jsDoc.slice(0, 300));
	}
	if (sym.calls.length > 0) {
		parts.push(`calls: ${sym.calls.join(", ")}`);
	}
	if (sym.imports.length > 0) {
		parts.push(`imports: ${sym.imports.join(", ")}`);
	}
	parts.push(sym.body.slice(0, 1800));
	return parts.join("\n\n").slice(0, MAX_EMBEDDING_LENGTH);
}

export function chunkFileSymbols(
	filePath: string,
	lastModified: string
): CodeChunk[] {
	const symbols = parseFileSymbols(filePath);
	const language = detectLanguage(filePath);

	return symbols.map((sym) => ({
		id: `${sym.path}:${sym.name}:${sym.startLine}`,
		path: sym.path,
		symbol: sym.name,
		symbolType: sym.symbolType,
		language,
		body: sym.body,
		summary: sym.jsDoc
			? sym.jsDoc.slice(0, 200)
			: `${sym.symbolType} ${sym.name}`,
		embeddingText: buildCodeEmbeddingText(sym),
		lastModified,
		calls: sym.calls.join(","),
		imports: sym.imports.join(","),
	}));
}
