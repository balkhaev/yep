// @ts-nocheck
import type Parser from "tree-sitter";
import Python from "tree-sitter-python";
import {
	BaseNodeExtractor,
	type NodeExtractor,
	TreeSitterParser,
} from "./tree-sitter-parser.ts";
import type {
	Decorator,
	EnhancedCodeSymbol,
	FunctionParameter,
	SymbolMetadata,
} from "./types.ts";

/**
 * Python парсер на основе Tree-sitter
 */
export class PythonParser extends TreeSitterParser {
	protected getLanguage(): unknown {
		return Python;
	}

	protected getNodeExtractor(): NodeExtractor {
		return new PythonNodeExtractor();
	}
}

/**
 * Extractor для Python AST
 */
class PythonNodeExtractor extends BaseNodeExtractor {
	extractSymbols(
		tree: Parser.Tree,
		filePath: string,
		source: string
	): EnhancedCodeSymbol[] {
		const symbols: EnhancedCodeSymbol[] = [];
		this.visitNode(tree.rootNode, filePath, source, symbols);
		return symbols;
	}

	private visitNode(
		node: Parser.SyntaxNode,
		filePath: string,
		source: string,
		symbols: EnhancedCodeSymbol[]
	): void {
		// Function definition
		if (node.type === "function_definition") {
			const symbol = this.extractFunction(node, filePath, source);
			if (symbol) {
				symbols.push(symbol);
			}
		}

		// Class definition
		if (node.type === "class_definition") {
			const classSymbol = this.extractClass(node, filePath, source);
			if (classSymbol) {
				symbols.push(classSymbol);
			}

			// Извлечь методы класса
			const methods = this.extractClassMethods(
				node,
				classSymbol?.name ?? "",
				filePath,
				source
			);
			symbols.push(...methods);
		}

		// Expression statement на уровне модуля может содержать assignment (константу)
		if (
			node.type === "expression_statement" &&
			node.parent?.type === "module"
		) {
			const assignmentNode = node.children.find((c) => c.type === "assignment");
			if (assignmentNode) {
				const constant = this.extractConstant(assignmentNode, filePath, source);
				if (constant) {
					symbols.push(constant);
				}
			}
		}

		// Рекурсивный обход
		for (const child of node.children) {
			this.visitNode(child, filePath, source, symbols);
		}
	}

	/**
	 * Извлечь функцию
	 */
	private extractFunction(
		node: Parser.SyntaxNode,
		filePath: string,
		source: string
	): EnhancedCodeSymbol | null {
		const nameNode = this.getChild(node, "name");
		if (!nameNode) {
			return null;
		}

		const name = this.getText(nameNode);

		// Параметры
		const parametersNode = this.getChild(node, "parameters");
		const parameters = this.extractParameters(parametersNode, source);

		// Возвращаемый тип (type hint)
		const returnTypeNode = this.getChild(node, "return_type");
		const returnType = returnTypeNode
			? this.getText(returnTypeNode).replace(/^->\s*/, "")
			: undefined;

		// Decorators
		const decorators = this.extractDecorators(node.parent, source);

		// Async
		const bodyText = this.getText(node);
		const isAsync = bodyText.trimStart().startsWith("async def");

		// Docstring
		const docstring = this.extractDocstring(node, source);

		// Calls
		const calls = this.extractCalls(node, source);

		// Imports
		const imports = this.extractImports(node, source);

		const metadata: SymbolMetadata = {
			parameters,
			returnType,
			isAsync,
			decorators: decorators.length > 0 ? decorators : undefined,
			language: {
				pythonDecorators: decorators.map((d) => d.name),
				pythonDocstring: docstring,
			},
		};

		return {
			name,
			symbolType: "function",
			path: filePath,
			startLine: this.getLineNumber(node.startPosition),
			endLine: this.getLineNumber(node.endPosition),
			body: this.truncateBody(this.getText(node)),
			jsDoc: docstring,
			calls,
			imports,
			metadata,
		};
	}

	/**
	 * Извлечь класс
	 */
	private extractClass(
		node: Parser.SyntaxNode,
		filePath: string,
		source: string
	): EnhancedCodeSymbol | null {
		const nameNode = this.getChild(node, "name");
		if (!nameNode) {
			return null;
		}

		const name = this.getText(nameNode);

		// Decorators
		const decorators = this.extractDecorators(node.parent, source);

		// Docstring
		const docstring = this.extractDocstring(node, source);

		// Base classes
		const superclasses = this.getChild(node, "superclasses");
		const baseClasses = superclasses
			? this.getText(superclasses)
					.replace(/[()]/g, "")
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean)
			: [];

		return {
			name,
			symbolType: "class",
			path: filePath,
			startLine: this.getLineNumber(node.startPosition),
			endLine: this.getLineNumber(node.endPosition),
			body: this.truncateBody(this.getText(node)),
			jsDoc: docstring,
			calls: [],
			imports: baseClasses.length > 0 ? baseClasses : [],
			metadata: {
				decorators: decorators.length > 0 ? decorators : undefined,
				language: {
					pythonDecorators: decorators.map((d) => d.name),
					pythonDocstring: docstring,
				},
			},
		};
	}

	/**
	 * Извлечь методы класса
	 */
	private extractClassMethods(
		classNode: Parser.SyntaxNode,
		className: string,
		filePath: string,
		source: string
	): EnhancedCodeSymbol[] {
		const methods: EnhancedCodeSymbol[] = [];

		// Найти body класса
		const bodyNode = this.getChild(classNode, "body");
		if (!bodyNode) {
			return methods;
		}

		// Найти все function_definition внутри body
		for (const child of bodyNode.children) {
			if (child.type === "function_definition") {
				const nameNode = this.getChild(child, "name");
				if (!nameNode) {
					continue;
				}

				const methodName = this.getText(nameNode);
				const fullName = `${className}.${methodName}`;

				// Параметры
				const parametersNode = this.getChild(child, "parameters");
				const parameters = this.extractParameters(parametersNode, source);

				// Возвращаемый тип
				const returnTypeNode = this.getChild(child, "return_type");
				const returnType = returnTypeNode
					? this.getText(returnTypeNode).replace(/^->\s*/, "")
					: undefined;

				// Decorators
				const decorators = this.extractDecorators(child.parent, source);

				// Async
				const bodyText = this.getText(child);
				const isAsync = bodyText.trimStart().startsWith("async def");

				// Docstring
				const docstring = this.extractDocstring(child, source);

				// Calls
				const calls = this.extractCalls(child, source);

				// Visibility (Python convention: _private, __very_private)
				let visibility: "public" | "private" | "protected" = "public";
				if (methodName.startsWith("__") && !methodName.endsWith("__")) {
					visibility = "private";
				} else if (methodName.startsWith("_")) {
					visibility = "protected";
				}

				const metadata: SymbolMetadata = {
					parameters,
					returnType,
					isAsync,
					visibility,
					decorators: decorators.length > 0 ? decorators : undefined,
					language: {
						pythonDecorators: decorators.map((d) => d.name),
						pythonDocstring: docstring,
					},
				};

				methods.push({
					name: fullName,
					symbolType: "method",
					path: filePath,
					startLine: this.getLineNumber(child.startPosition),
					endLine: this.getLineNumber(child.endPosition),
					body: this.truncateBody(this.getText(child)),
					jsDoc: docstring,
					calls,
					imports: [],
					metadata,
				});
			}
		}

		return methods;
	}

	/**
	 * Извлечь константу (module-level assignment)
	 */
	private extractConstant(
		node: Parser.SyntaxNode,
		filePath: string,
		source: string
	): EnhancedCodeSymbol | null {
		// Получить left side (имя переменной)
		// В Python это первый identifier child
		const leftNode = node.children.find((c) => c.type === "identifier");
		if (!leftNode) {
			return null;
		}

		const name = this.getText(leftNode);

		// По соглашению Python: UPPER_CASE = константа
		if (name !== name.toUpperCase()) {
			return null;
		}

		// Получить тип (если есть type hint)
		const typeNode = this.getChild(node, "type");
		const returnType = typeNode ? this.getText(typeNode) : undefined;

		return {
			name,
			symbolType: "constant",
			path: filePath,
			startLine: this.getLineNumber(node.startPosition),
			endLine: this.getLineNumber(node.endPosition),
			body: this.truncateBody(this.getText(node)),
			jsDoc: "",
			calls: [],
			imports: [],
			metadata: {
				returnType,
				isExported: true, // Python exports всё на module level
			},
		};
	}

	/**
	 * Извлечь параметры функции
	 */
	private extractParameters(
		parametersNode: Parser.SyntaxNode | null,
		source: string
	): FunctionParameter[] {
		if (!parametersNode) {
			return [];
		}

		const params: FunctionParameter[] = [];

		for (const child of parametersNode.children) {
			// Пропустить скобки и запятые
			if (child.type === "(" || child.type === ")" || child.type === ",") {
				continue;
			}

			if (child.type === "identifier") {
				// Простой параметр без типа
				const name = this.getText(child);
				// Пропустить self и cls (Python convention)
				if (name === "self" || name === "cls") {
					continue;
				}
				params.push({ name });
			} else if (child.type === "typed_parameter") {
				// Параметр с type hint
				// Имя - это первый identifier в children (не field name)
				const nameNode = child.children.find((c) => c.type === "identifier");
				const name = nameNode ? this.getText(nameNode) : "";

				// Пропустить self и cls (Python convention)
				if (name === "self" || name === "cls") {
					continue;
				}

				const typeNode = this.getChild(child, "type");
				params.push({
					name,
					type: typeNode ? this.getText(typeNode) : undefined,
				});
			} else if (child.type === "default_parameter") {
				// Параметр с дефолтным значением
				const nameNode = child.children.find((c) => c.type === "identifier");
				const name = nameNode ? this.getText(nameNode) : "";

				// Пропустить self и cls
				if (name === "self" || name === "cls") {
					continue;
				}

				const valueNode = this.getChild(child, "value");
				params.push({
					name,
					isOptional: true,
					defaultValue: valueNode ? this.getText(valueNode) : undefined,
				});
			} else if (child.type === "typed_default_parameter") {
				// Параметр с типом и дефолтом
				const nameNode = child.children.find((c) => c.type === "identifier");
				const name = nameNode ? this.getText(nameNode) : "";

				// Пропустить self и cls
				if (name === "self" || name === "cls") {
					continue;
				}

				const typeNode = this.getChild(child, "type");
				const valueNode = this.getChild(child, "value");
				params.push({
					name,
					type: typeNode ? this.getText(typeNode) : undefined,
					isOptional: true,
					defaultValue: valueNode ? this.getText(valueNode) : undefined,
				});
			}
		}

		return params;
	}

	/**
	 * Извлечь decorators
	 */
	private extractDecorators(
		node: Parser.SyntaxNode | null,
		source: string
	): Decorator[] {
		const decorators: Decorator[] = [];

		// В Python decorators идут перед function/class в decorated_definition
		if (node?.type !== "decorated_definition") {
			return decorators;
		}

		for (const child of node.children) {
			if (child.type === "decorator") {
				const decoratorText = this.getText(child).replace(/^@/, "");
				decorators.push({ name: decoratorText });
			}
		}

		return decorators;
	}

	/**
	 * Извлечь docstring
	 */
	private extractDocstring(node: Parser.SyntaxNode, source: string): string {
		// Первый expression_statement с string в body функции
		const bodyNode = this.getChild(node, "body");
		if (!bodyNode) {
			return "";
		}

		const firstChild = bodyNode.children[0];
		if (firstChild?.type === "expression_statement") {
			const stringNode = firstChild.children[0];
			if (stringNode?.type === "string") {
				// Убрать кавычки и форматирование
				return this.getText(stringNode)
					.replace(/^["']{1,3}|["']{1,3}$/g, "")
					.trim();
			}
		}

		return "";
	}

	/**
	 * Извлечь вызовы функций
	 */
	private extractCalls(node: Parser.SyntaxNode, source: string): string[] {
		const calls = new Set<string>();
		const callNodes = this.findNodesOfType(node, "call");

		for (const callNode of callNodes) {
			const functionNode = this.getChild(callNode, "function");
			if (functionNode) {
				if (functionNode.type === "identifier") {
					calls.add(this.getText(functionNode));
				} else if (functionNode.type === "attribute") {
					const attrNode = this.getChild(functionNode, "attribute");
					if (attrNode) {
						calls.add(this.getText(attrNode));
					}
				}
			}
		}

		return Array.from(calls).slice(0, 30);
	}

	/**
	 * Извлечь импорты
	 */
	private extractImports(node: Parser.SyntaxNode, source: string): string[] {
		const imports: string[] = [];
		const importNodes = this.findNodesOfType(node, "import_statement");
		const importFromNodes = this.findNodesOfType(node, "import_from_statement");

		for (const importNode of importNodes) {
			const nameNode = this.getChild(importNode, "name");
			if (nameNode) {
				imports.push(this.getText(nameNode));
			}
		}

		for (const importNode of importFromNodes) {
			const moduleNode = this.getChild(importNode, "module_name");
			const nameNode = this.getChild(importNode, "name");
			if (moduleNode && nameNode) {
				imports.push(`${this.getText(nameNode)}:${this.getText(moduleNode)}`);
			}
		}

		return imports.slice(0, 30);
	}
}
