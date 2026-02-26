// @ts-nocheck
import { readFileSync } from "node:fs";
import ts from "typescript";
import { BaseParser } from "./base-parser.ts";
import type {
	Decorator,
	EnhancedCodeSymbol,
	FunctionParameter,
	GenericParameter,
	SymbolMetadata,
	SymbolType,
} from "./types.ts";

const MAX_BODY_LENGTH = 3000;
const UPPER_START_RE = /^[A-Z]/;
const JSX_EXT_RE = /\.[jt]sx$/;
const WRAPPER_RE = /(?:memo|forwardRef|lazy)$/;
const HOOK_RE = /^use[A-Z]/;

/**
 * Улучшенный TypeScript/JavaScript парсер с расширенными метаданными
 */
export class TypeScriptAstParser extends BaseParser {
	protected async doParse(filePath: string): Promise<EnhancedCodeSymbol[]> {
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

		const importMap = this.extractImportsMap(sourceFile);
		const symbols: EnhancedCodeSymbol[] = [];

		for (const stmt of sourceFile.statements) {
			// Обработка обычных деклараций
			const symbolType = this.getSymbolType(stmt, sourceFile);
			if (symbolType) {
				const symbol = this.extractSymbol(
					stmt,
					sourceFile,
					importMap,
					symbolType
				);
				if (symbol) {
					symbols.push(symbol);

					// Извлечь методы класса
					if (symbolType === "class" && ts.isClassDeclaration(stmt)) {
						symbols.push(
							...this.extractClassMethods(
								stmt,
								symbol.name,
								sourceFile,
								importMap
							)
						);
					}
				}
			}

			// Обработка констант (export const)
			if (ts.isVariableStatement(stmt)) {
				const constant = this.extractConstant(stmt, sourceFile, importMap);
				if (constant) {
					symbols.push(constant);
				}

				// Обработка custom hooks
				const hook = this.extractCustomHook(stmt, sourceFile, importMap);
				if (hook) {
					symbols.push(hook);
				}
			}
		}

		return symbols;
	}

	private isJsxFile(fileName: string): boolean {
		return JSX_EXT_RE.test(fileName);
	}

	private isComponentLike(
		node: ts.FunctionDeclaration,
		sourceFile: ts.SourceFile
	): boolean {
		const name = node.name?.getText(sourceFile) ?? "";
		return UPPER_START_RE.test(name) && this.isJsxFile(sourceFile.fileName);
	}

	private classifyVariableStatement(
		node: ts.VariableStatement,
		sourceFile: ts.SourceFile
	): SymbolType | null {
		const decl = node.declarationList.declarations[0];
		if (!decl?.initializer) {
			return null;
		}

		if (
			ts.isArrowFunction(decl.initializer) ||
			ts.isFunctionExpression(decl.initializer)
		) {
			const name = decl.name.getText(sourceFile);
			if (UPPER_START_RE.test(name) && this.isJsxFile(sourceFile.fileName)) {
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

	private getSymbolType(
		node: ts.Node,
		sourceFile: ts.SourceFile
	): SymbolType | null {
		if (ts.isFunctionDeclaration(node)) {
			return this.isComponentLike(node, sourceFile) ? "component" : "function";
		}
		if (ts.isVariableStatement(node)) {
			return this.classifyVariableStatement(node, sourceFile);
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

	private getName(node: ts.Node, sourceFile: ts.SourceFile): string | null {
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

	private getJsDoc(node: ts.Node, sourceFile: ts.SourceFile): string {
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

	private extractCallsFromNode(
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

	private extractImportsMap(sourceFile: ts.SourceFile): Map<string, string> {
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

	private resolveImports(
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

	/**
	 * Извлечь метаданные для функции
	 */
	private extractFunctionMetadata(
		node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
		sourceFile: ts.SourceFile
	): SymbolMetadata {
		const metadata: SymbolMetadata = {};

		// Parameters
		if (node.parameters && node.parameters.length > 0) {
			metadata.parameters = this.extractParameters(node.parameters, sourceFile);
		}

		// Return type
		if (node.type) {
			metadata.returnType = node.type.getText(sourceFile);
		}

		// Async flag
		const modifiers = ts.canHaveModifiers(node)
			? ts.getModifiers(node)
			: undefined;
		metadata.isAsync = modifiers?.some(
			(m) => m.kind === ts.SyntaxKind.AsyncKeyword
		);

		// Visibility
		if (modifiers) {
			metadata.visibility = this.extractVisibility(modifiers);
		}

		// Generic parameters
		if ("typeParameters" in node && node.typeParameters) {
			metadata.genericParams = this.extractGenerics(
				node.typeParameters,
				sourceFile
			);
		}

		// Decorators
		if (ts.canHaveDecorators(node)) {
			const decorators = ts.getDecorators(node);
			if (decorators && decorators.length > 0) {
				metadata.decorators = this.extractDecorators(decorators, sourceFile);
			}
		}

		return metadata;
	}

	/**
	 * Извлечь параметры функции
	 */
	private extractParameters(
		parameters: ts.NodeArray<ts.ParameterDeclaration>,
		sourceFile: ts.SourceFile
	): FunctionParameter[] {
		return parameters.map((param) => ({
			name: param.name.getText(sourceFile),
			type: param.type?.getText(sourceFile),
			isOptional: !!param.questionToken,
			defaultValue: param.initializer?.getText(sourceFile),
		}));
	}

	/**
	 * Извлечь generic параметры
	 */
	private extractGenerics(
		typeParameters: ts.NodeArray<ts.TypeParameterDeclaration>,
		sourceFile: ts.SourceFile
	): GenericParameter[] {
		return typeParameters.map((tp) => ({
			name: tp.name.getText(sourceFile),
			constraint: tp.constraint?.getText(sourceFile),
		}));
	}

	/**
	 * Извлечь visibility модификатор
	 */
	private extractVisibility(
		modifiers: readonly ts.Modifier[]
	): "public" | "private" | "protected" | undefined {
		for (const mod of modifiers) {
			if (mod.kind === ts.SyntaxKind.PublicKeyword) {
				return "public";
			}
			if (mod.kind === ts.SyntaxKind.PrivateKeyword) {
				return "private";
			}
			if (mod.kind === ts.SyntaxKind.ProtectedKeyword) {
				return "protected";
			}
		}
		return undefined;
	}

	/**
	 * Извлечь decorators
	 */
	private extractDecorators(
		decorators: readonly ts.Decorator[],
		sourceFile: ts.SourceFile
	): Decorator[] {
		return decorators.map((dec) => {
			const expr = dec.expression;

			if (ts.isIdentifier(expr)) {
				return { name: expr.getText(sourceFile) };
			}

			if (ts.isCallExpression(expr)) {
				const name = expr.expression.getText(sourceFile);
				const args = expr.arguments.map((arg) => arg.getText(sourceFile));
				return { name, arguments: args };
			}

			return { name: expr.getText(sourceFile) };
		});
	}

	/**
	 * Извлечь hook dependencies (для useEffect, useMemo, useCallback)
	 */
	private extractHookDependencies(
		node: ts.Node,
		sourceFile: ts.SourceFile
	): string[] {
		const deps: string[] = [];

		const visit = (n: ts.Node) => {
			if (ts.isCallExpression(n)) {
				const callName = n.expression.getText(sourceFile);
				if (["useEffect", "useMemo", "useCallback"].includes(callName)) {
					const depsArg = n.arguments[1];
					if (depsArg && ts.isArrayLiteralExpression(depsArg)) {
						for (const elem of depsArg.elements) {
							deps.push(elem.getText(sourceFile));
						}
					}
				}
			}
			ts.forEachChild(n, visit);
		};

		visit(node);
		return [...new Set(deps)];
	}

	/**
	 * Извлечь символ из statement
	 */
	private extractSymbol(
		stmt: ts.Statement,
		sourceFile: ts.SourceFile,
		importMap: Map<string, string>,
		symbolType: SymbolType
	): EnhancedCodeSymbol | null {
		const name = this.getName(stmt, sourceFile);
		if (!name) {
			return null;
		}

		const start = sourceFile.getLineAndCharacterOfPosition(
			stmt.getStart(sourceFile)
		);
		const end = sourceFile.getLineAndCharacterOfPosition(stmt.getEnd());
		const body = stmt.getText(sourceFile).slice(0, MAX_BODY_LENGTH);
		const jsDoc = this.getJsDoc(stmt, sourceFile);
		const calls = this.extractCallsFromNode(stmt, sourceFile, name);
		const imports = this.resolveImports(calls, body, importMap);

		let metadata: SymbolMetadata = {};

		// Извлечь метаданные для функций
		if (ts.isFunctionDeclaration(stmt)) {
			metadata = this.extractFunctionMetadata(stmt, sourceFile);
		} else if (ts.isVariableStatement(stmt)) {
			const decl = stmt.declarationList.declarations[0];
			if (
				decl?.initializer &&
				(ts.isArrowFunction(decl.initializer) ||
					ts.isFunctionExpression(decl.initializer))
			) {
				metadata = this.extractFunctionMetadata(decl.initializer, sourceFile);
			}
		}

		return {
			name,
			symbolType,
			path: sourceFile.fileName,
			startLine: start.line + 1,
			endLine: end.line + 1,
			body,
			jsDoc,
			calls,
			imports,
			metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
		};
	}

	/**
	 * Извлечь константу (export const)
	 */
	private extractConstant(
		stmt: ts.VariableStatement,
		sourceFile: ts.SourceFile,
		importMap: Map<string, string>
	): EnhancedCodeSymbol | null {
		const decl = stmt.declarationList.declarations[0];
		if (!decl) {
			return null;
		}

		// Проверить наличие export modifier
		const modifiers = ts.canHaveModifiers(stmt)
			? ts.getModifiers(stmt)
			: undefined;
		const hasExport = modifiers?.some(
			(m) => m.kind === ts.SyntaxKind.ExportKeyword
		);

		// Проверить const (не let/var)
		const isConst = stmt.declarationList.flags & ts.NodeFlags.Const;

		if (!(hasExport && isConst)) {
			return null;
		}

		// Пропустить функции (они обрабатываются отдельно)
		if (
			decl.initializer &&
			(ts.isArrowFunction(decl.initializer) ||
				ts.isFunctionExpression(decl.initializer))
		) {
			return null;
		}

		const name = decl.name.getText(sourceFile);
		const start = sourceFile.getLineAndCharacterOfPosition(
			stmt.getStart(sourceFile)
		);
		const end = sourceFile.getLineAndCharacterOfPosition(stmt.getEnd());
		const body = stmt.getText(sourceFile).slice(0, MAX_BODY_LENGTH);
		const jsDoc = this.getJsDoc(stmt, sourceFile);
		const calls = this.extractCallsFromNode(stmt, sourceFile, name);
		const imports = this.resolveImports(calls, body, importMap);

		return {
			name,
			symbolType: "constant",
			path: sourceFile.fileName,
			startLine: start.line + 1,
			endLine: end.line + 1,
			body,
			jsDoc,
			calls,
			imports,
			metadata: {
				isExported: true,
				returnType: decl.type?.getText(sourceFile),
			},
		};
	}

	/**
	 * Извлечь custom hook (use*)
	 */
	private extractCustomHook(
		stmt: ts.VariableStatement,
		sourceFile: ts.SourceFile,
		importMap: Map<string, string>
	): EnhancedCodeSymbol | null {
		const decl = stmt.declarationList.declarations[0];
		if (!decl?.initializer) {
			return null;
		}

		const name = decl.name.getText(sourceFile);

		// Custom hook: имя начинается с "use" + CamelCase
		if (!HOOK_RE.test(name)) {
			return null;
		}

		// Должно быть функцией
		if (
			!(
				ts.isArrowFunction(decl.initializer) ||
				ts.isFunctionExpression(decl.initializer)
			)
		) {
			return null;
		}

		const start = sourceFile.getLineAndCharacterOfPosition(
			stmt.getStart(sourceFile)
		);
		const end = sourceFile.getLineAndCharacterOfPosition(stmt.getEnd());
		const body = decl.initializer.getText(sourceFile).slice(0, MAX_BODY_LENGTH);
		const jsDoc = this.getJsDoc(stmt, sourceFile);
		const calls = this.extractCallsFromNode(decl.initializer, sourceFile, name);
		const imports = this.resolveImports(calls, body, importMap);

		// Извлечь hook dependencies
		const hookDependencies = this.extractHookDependencies(
			decl.initializer,
			sourceFile
		);

		const metadata = this.extractFunctionMetadata(decl.initializer, sourceFile);
		metadata.react = {
			isHook: true,
			hookDependencies,
		};

		const modifiers = ts.canHaveModifiers(stmt)
			? ts.getModifiers(stmt)
			: undefined;
		metadata.isExported = modifiers?.some(
			(m) => m.kind === ts.SyntaxKind.ExportKeyword
		);

		return {
			name,
			symbolType: "hook",
			path: sourceFile.fileName,
			startLine: start.line + 1,
			endLine: end.line + 1,
			body,
			jsDoc,
			calls,
			imports,
			metadata,
		};
	}

	/**
	 * Извлечь методы класса
	 */
	private extractClassMethods(
		classNode: ts.ClassDeclaration,
		className: string,
		sourceFile: ts.SourceFile,
		importMap: Map<string, string>
	): EnhancedCodeSymbol[] {
		const methods: EnhancedCodeSymbol[] = [];

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
			const jsDoc = this.getJsDoc(member, sourceFile);
			const calls = this.extractCallsFromNode(member, sourceFile, methodName);
			const imports = this.resolveImports(calls, body, importMap);

			const metadata = this.extractFunctionMetadata(member, sourceFile);

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
				metadata,
			});
		}

		return methods;
	}
}
