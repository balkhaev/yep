import { readFileSync } from "node:fs";
import ts from "typescript";
import type { CodeSymbol } from "./code-chunker.ts";

const MAX_BODY_LENGTH = 3000;
const UPPER_START_RE = /^[A-Z]/;
const JSX_EXT_RE = /\.[jt]sx$/;
const WRAPPER_RE = /(?:memo|forwardRef|lazy)$/;

function isJsxFile(fileName: string): boolean {
	return JSX_EXT_RE.test(fileName);
}

function isComponentLike(
	node: ts.FunctionDeclaration,
	sourceFile: ts.SourceFile
): boolean {
	const name = node.name?.getText(sourceFile) ?? "";
	return UPPER_START_RE.test(name) && isJsxFile(sourceFile.fileName);
}

function classifyVariableStatement(
	node: ts.VariableStatement,
	sourceFile: ts.SourceFile
): CodeSymbol["symbolType"] | null {
	const decl = node.declarationList.declarations[0];
	if (!decl?.initializer) {
		return null;
	}

	if (
		ts.isArrowFunction(decl.initializer) ||
		ts.isFunctionExpression(decl.initializer)
	) {
		const name = decl.name.getText(sourceFile);
		if (UPPER_START_RE.test(name) && isJsxFile(sourceFile.fileName)) {
			return "component";
		}
		return "function";
	}

	if (ts.isCallExpression(decl.initializer)) {
		const callText = decl.initializer.expression.getText(sourceFile);
		if (WRAPPER_RE.test(callText)) {
			return "component";
		}
	}

	return null;
}

function getSymbolType(
	node: ts.Node,
	sourceFile: ts.SourceFile
): CodeSymbol["symbolType"] | null {
	if (ts.isFunctionDeclaration(node)) {
		return isComponentLike(node, sourceFile) ? "component" : "function";
	}
	if (ts.isVariableStatement(node)) {
		return classifyVariableStatement(node, sourceFile);
	}
	if (ts.isClassDeclaration(node)) {
		return "class";
	}
	if (ts.isInterfaceDeclaration(node)) {
		return "interface";
	}
	if (ts.isTypeAliasDeclaration(node)) {
		return "type";
	}
	if (ts.isEnumDeclaration(node)) {
		return "enum";
	}
	return null;
}

function getName(node: ts.Node, sourceFile: ts.SourceFile): string | null {
	if (
		ts.isFunctionDeclaration(node) ||
		ts.isClassDeclaration(node) ||
		ts.isInterfaceDeclaration(node) ||
		ts.isTypeAliasDeclaration(node) ||
		ts.isEnumDeclaration(node)
	) {
		return node.name?.getText(sourceFile) ?? null;
	}
	if (ts.isVariableStatement(node)) {
		const decl = node.declarationList.declarations[0];
		if (decl) {
			return decl.name.getText(sourceFile);
		}
	}
	return null;
}

function getJsDoc(node: ts.Node, sourceFile: ts.SourceFile): string {
	const fullText = sourceFile.getFullText();
	const ranges = ts.getLeadingCommentRanges(fullText, node.getFullStart());
	if (!ranges || ranges.length === 0) {
		return "";
	}

	const last = ranges.at(-1);
	if (!last) {
		return "";
	}
	const comment = fullText.slice(last.pos, last.end);

	if (comment.startsWith("/**")) {
		return comment
			.replace(/\/\*\*|\*\//g, "")
			.replace(/^\s*\*\s?/gm, "")
			.trim();
	}
	if (comment.startsWith("//")) {
		return comment.replace(/^\/\/\s?/gm, "").trim();
	}
	return "";
}

function extractCalls(
	node: ts.Node,
	sourceFile: ts.SourceFile,
	ownName: string
): string[] {
	const calls = new Set<string>();

	function visit(n: ts.Node) {
		if (ts.isCallExpression(n)) {
			const expr = n.expression;
			let name: string | null = null;

			if (ts.isIdentifier(expr)) {
				name = expr.getText(sourceFile);
			} else if (ts.isPropertyAccessExpression(expr)) {
				name = expr.name.getText(sourceFile);
			}

			if (name && name !== ownName && name.length > 2) {
				calls.add(name);
			}
		}
		ts.forEachChild(n, visit);
	}

	visit(node);
	return [...calls].slice(0, 30);
}

function extractImportsMap(sourceFile: ts.SourceFile): Map<string, string> {
	const importMap = new Map<string, string>();

	for (const stmt of sourceFile.statements) {
		if (!ts.isImportDeclaration(stmt)) {
			continue;
		}
		const module = (stmt.moduleSpecifier as ts.StringLiteral).text;
		const clause = stmt.importClause;
		if (!clause) {
			continue;
		}

		if (clause.name) {
			importMap.set(clause.name.getText(sourceFile), module);
		}
		if (clause.namedBindings) {
			if (ts.isNamedImports(clause.namedBindings)) {
				for (const spec of clause.namedBindings.elements) {
					const localName = spec.name.getText(sourceFile);
					importMap.set(localName, module);
				}
			} else if (ts.isNamespaceImport(clause.namedBindings)) {
				importMap.set(clause.namedBindings.name.getText(sourceFile), module);
			}
		}
	}

	return importMap;
}

function resolveImports(
	calls: string[],
	body: string,
	importMap: Map<string, string>
): string[] {
	const resolved: string[] = [];
	const added = new Set<string>();

	for (const call of calls) {
		const source = importMap.get(call);
		if (source && !added.has(call)) {
			resolved.push(`${call}:${source}`);
			added.add(call);
		}
	}

	for (const [name, source] of importMap) {
		if (body.includes(name) && !added.has(name)) {
			resolved.push(`${name}:${source}`);
			added.add(name);
		}
	}

	return resolved.slice(0, 30);
}

function extractClassMethods(
	classNode: ts.ClassDeclaration,
	className: string,
	sourceFile: ts.SourceFile,
	importMap: Map<string, string>
): CodeSymbol[] {
	const methods: CodeSymbol[] = [];

	for (const member of classNode.members) {
		if (!(ts.isMethodDeclaration(member) && member.name)) {
			continue;
		}

		const methodName = member.name.getText(sourceFile);
		const fullName = `${className}.${methodName}`;
		const start = sourceFile.getLineAndCharacterOfPosition(
			member.getStart(sourceFile)
		);
		const end = sourceFile.getLineAndCharacterOfPosition(member.getEnd());
		const body = member.getText(sourceFile).slice(0, MAX_BODY_LENGTH);
		const jsDoc = getJsDoc(member, sourceFile);
		const calls = extractCalls(member, sourceFile, methodName);
		const imports = resolveImports(calls, body, importMap);

		methods.push({
			name: fullName,
			symbolType: "method",
			path: sourceFile.fileName,
			startLine: start.line + 1,
			endLine: end.line + 1,
			body,
			jsDoc,
			calls,
			imports,
		});
	}

	return methods;
}

export function parseFileWithTsCompiler(filePath: string): CodeSymbol[] {
	const content = readFileSync(filePath, "utf-8");
	const sourceFile = ts.createSourceFile(
		filePath,
		content,
		ts.ScriptTarget.Latest,
		true,
		filePath.endsWith(".tsx") || filePath.endsWith(".jsx")
			? ts.ScriptKind.TSX
			: ts.ScriptKind.TS
	);

	const importMap = extractImportsMap(sourceFile);
	const symbols: CodeSymbol[] = [];

	for (const stmt of sourceFile.statements) {
		const symbolType = getSymbolType(stmt, sourceFile);
		if (!symbolType) {
			continue;
		}

		const name = getName(stmt, sourceFile);
		if (!name) {
			continue;
		}

		const start = sourceFile.getLineAndCharacterOfPosition(
			stmt.getStart(sourceFile)
		);
		const end = sourceFile.getLineAndCharacterOfPosition(stmt.getEnd());
		const body = stmt.getText(sourceFile).slice(0, MAX_BODY_LENGTH);
		const jsDoc = getJsDoc(stmt, sourceFile);
		const calls = extractCalls(stmt, sourceFile, name);
		const imports = resolveImports(calls, body, importMap);

		symbols.push({
			name,
			symbolType,
			path: filePath,
			startLine: start.line + 1,
			endLine: end.line + 1,
			body,
			jsDoc,
			calls,
			imports,
		});

		if (symbolType === "class" && ts.isClassDeclaration(stmt)) {
			symbols.push(...extractClassMethods(stmt, name, sourceFile, importMap));
		}
	}

	return symbols;
}
