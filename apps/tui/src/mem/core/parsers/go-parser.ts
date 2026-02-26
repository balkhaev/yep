// @ts-nocheck
import type Parser from "tree-sitter";
import Go from "tree-sitter-go";
import {
	BaseNodeExtractor,
	type NodeExtractor,
	TreeSitterParser,
} from "./tree-sitter-parser.ts";
import type {
	EnhancedCodeSymbol,
	FunctionParameter,
	SymbolMetadata,
} from "./types.ts";

/**
 * Go парсер на основе Tree-sitter
 */
export class GoParser extends TreeSitterParser {
	protected getLanguage(): unknown {
		return Go;
	}

	protected getNodeExtractor(): NodeExtractor {
		return new GoNodeExtractor();
	}
}

/**
 * Extractor для Go AST
 */
class GoNodeExtractor extends BaseNodeExtractor {
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
		// Function declaration
		if (node.type === "function_declaration") {
			const symbol = this.extractFunction(node, filePath, source);
			if (symbol) {
				symbols.push(symbol);
			}
		}

		// Method declaration
		if (node.type === "method_declaration") {
			const symbol = this.extractMethod(node, filePath, source);
			if (symbol) {
				symbols.push(symbol);
			}
		}

		// Type declaration (struct, interface, alias)
		if (node.type === "type_declaration") {
			const typeSymbols = this.extractTypeDeclaration(node, filePath, source);
			symbols.push(...typeSymbols);
		}

		// Const declaration
		if (node.type === "const_declaration") {
			const constants = this.extractConstants(node, filePath, source);
			symbols.push(...constants);
		}

		// Var declaration
		if (node.type === "var_declaration") {
			const variables = this.extractVariables(node, filePath, source);
			symbols.push(...variables);
		}

		// Рекурсивный обход
		for (const child of node.children) {
			this.visitNode(child, filePath, source, symbols);
		}
	}

	/**
	 * Извлечь function
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

		// Parameters
		const parametersNode = this.getChild(node, "parameters");
		const parameters = this.extractParameters(parametersNode, source);

		// Return type
		const resultNode = this.getChild(node, "result");
		const returnType = resultNode ? this.getText(resultNode) : undefined;

		// Comment (Go doc comment)
		const docComment = this.extractDocComment(node, source);

		// Calls
		const calls = this.extractCalls(node, source);

		// Imports
		const imports = this.extractImports(node, source);

		// Exported (starts with uppercase)
		const isExported = /^[A-Z]/.test(name);

		const metadata: SymbolMetadata = {
			parameters,
			returnType,
			isExported,
			language: {
				goDocComment: docComment,
			},
		};

		return {
			name,
			symbolType: "function",
			path: filePath,
			startLine: this.getLineNumber(node.startPosition),
			endLine: this.getLineNumber(node.endPosition),
			body: this.truncateBody(this.getText(node)),
			jsDoc: docComment,
			calls,
			imports,
			metadata,
		};
	}

	/**
	 * Извлечь method (с receiver)
	 */
	private extractMethod(
		node: Parser.SyntaxNode,
		filePath: string,
		source: string
	): EnhancedCodeSymbol | null {
		const nameNode = this.getChild(node, "name");
		if (!nameNode) {
			return null;
		}

		const methodName = this.getText(nameNode);

		// Receiver (например, (u *User))
		const receiverNode = this.getChild(node, "receiver");
		const receiver = receiverNode
			? this.extractReceiver(receiverNode, source)
			: null;

		if (!receiver) {
			return null;
		}

		const fullName = `${receiver.typeName}.${methodName}`;

		// Parameters
		const parametersNode = this.getChild(node, "parameters");
		const parameters = this.extractParameters(parametersNode, source);

		// Return type
		const resultNode = this.getChild(node, "result");
		const returnType = resultNode ? this.getText(resultNode) : undefined;

		// Comment
		const docComment = this.extractDocComment(node, source);

		// Calls
		const calls = this.extractCalls(node, source);

		// Exported
		const isExported = /^[A-Z]/.test(methodName);

		const metadata: SymbolMetadata = {
			parameters,
			returnType,
			isExported,
			language: {
				goReceiver: receiver.text,
				goReceiverPointer: receiver.isPointer,
				goDocComment: docComment,
			},
		};

		return {
			name: fullName,
			symbolType: "method",
			path: filePath,
			startLine: this.getLineNumber(node.startPosition),
			endLine: this.getLineNumber(node.endPosition),
			body: this.truncateBody(this.getText(node)),
			jsDoc: docComment,
			calls,
			imports: [],
			metadata,
		};
	}

	/**
	 * Извлечь type declaration (struct, interface, alias)
	 */
	private extractTypeDeclaration(
		node: Parser.SyntaxNode,
		filePath: string,
		source: string
	): EnhancedCodeSymbol[] {
		const symbols: EnhancedCodeSymbol[] = [];

		// type_spec содержит имя и тип (может быть в type_spec_list)
		let typeSpecs = this.getChildrenOfType(node, "type_spec");

		// Если нет прямых type_spec, искать в type_spec_list
		if (typeSpecs.length === 0) {
			const typeSpecList = node.children.find(
				(c) => c.type === "type_spec_list"
			);
			if (typeSpecList) {
				typeSpecs = typeSpecList.children.filter((c) => c.type === "type_spec");
			}
		}

		// type_alias (type Result = ...) обрабатываем отдельно
		const typeAliases = node.children.filter((c) => c.type === "type_alias");

		for (const spec of typeSpecs) {
			// Имя - это первый type_identifier в spec
			const nameNode = spec.children.find((c) => c.type === "type_identifier");

			if (!nameNode) {
				continue;
			}

			const name = this.getText(nameNode);
			const typeNode = this.getChild(spec, "type");

			if (!typeNode) {
				continue;
			}

			const typeText = typeNode.type;

			// Определить тип символа
			let symbolType: "class" | "interface" | "type" = "type";
			if (typeText === "struct_type") {
				symbolType = "class"; // struct как class
			} else if (typeText === "interface_type") {
				symbolType = "interface";
			}

			// Comment
			const docComment = this.extractDocComment(spec.parent ?? node, source);

			// Exported
			const isExported = /^[A-Z]/.test(name);

			const symbol = {
				name,
				symbolType,
				path: filePath,
				startLine: this.getLineNumber(spec.startPosition),
				endLine: this.getLineNumber(spec.endPosition),
				body: this.truncateBody(this.getText(spec)),
				jsDoc: docComment,
				calls: [],
				imports: [],
				metadata: {
					isExported,
					language: {
						goDocComment: docComment,
					},
				},
			};

			symbols.push(symbol);
		}

		// Обработать type aliases (type Result = ...)
		for (const alias of typeAliases) {
			// Имя - это первый type_identifier в alias
			const nameNode = alias.children.find((c) => c.type === "type_identifier");
			if (!nameNode) {
				continue;
			}

			const name = this.getText(nameNode);

			// Comment
			const docComment = this.extractDocComment(alias.parent ?? node, source);

			// Exported
			const isExported = /^[A-Z]/.test(name);

			symbols.push({
				name,
				symbolType: "type",
				path: filePath,
				startLine: this.getLineNumber(alias.startPosition),
				endLine: this.getLineNumber(alias.endPosition),
				body: this.truncateBody(this.getText(alias)),
				jsDoc: docComment,
				calls: [],
				imports: [],
				metadata: {
					isExported,
					language: {
						goDocComment: docComment,
					},
				},
			});
		}

		return symbols;
	}

	/**
	 * Извлечь constants
	 */
	private extractConstants(
		node: Parser.SyntaxNode,
		filePath: string,
		source: string
	): EnhancedCodeSymbol[] {
		const symbols: EnhancedCodeSymbol[] = [];

		// Найти const_spec (может быть прямо в node или в const_spec_list)
		let constSpecs = this.getChildrenOfType(node, "const_spec");

		// Если нет прямых const_spec, искать в const_spec_list
		if (constSpecs.length === 0) {
			const constSpecList = node.children.find(
				(c) => c.type === "const_spec_list"
			);
			if (constSpecList) {
				constSpecs = constSpecList.children.filter(
					(c) => c.type === "const_spec"
				);
			}
		}

		for (const spec of constSpecs) {
			// Имя - это первый identifier в spec
			const nameNode = spec.children.find((c) => c.type === "identifier");
			if (!nameNode) {
				continue;
			}

			const name = this.getText(nameNode);

			// Type
			const typeNode = this.getChild(spec, "type");
			const returnType = typeNode ? this.getText(typeNode) : undefined;

			// Exported
			const isExported = /^[A-Z]/.test(name);

			symbols.push({
				name,
				symbolType: "constant",
				path: filePath,
				startLine: this.getLineNumber(spec.startPosition),
				endLine: this.getLineNumber(spec.endPosition),
				body: this.truncateBody(this.getText(spec)),
				jsDoc: "",
				calls: [],
				imports: [],
				metadata: {
					returnType,
					isExported,
				},
			});
		}

		return symbols;
	}

	/**
	 * Извлечь variables
	 */
	private extractVariables(
		node: Parser.SyntaxNode,
		filePath: string,
		source: string
	): EnhancedCodeSymbol[] {
		const symbols: EnhancedCodeSymbol[] = [];

		// Найти var_spec (может быть прямо в node или в var_spec_list)
		let varSpecs = this.getChildrenOfType(node, "var_spec");

		// Если нет прямых var_spec, искать в var_spec_list
		if (varSpecs.length === 0) {
			const varSpecList = node.children.find((c) => c.type === "var_spec_list");
			if (varSpecList) {
				// Фильтровать только var_spec из children
				varSpecs = varSpecList.children.filter((c) => c.type === "var_spec");
			}
		}

		for (const spec of varSpecs) {
			// Имя - это первый identifier в spec
			const nameNode = spec.children.find((c) => c.type === "identifier");
			if (!nameNode) {
				continue;
			}

			const name = this.getText(nameNode);

			// Type
			const typeNode = this.getChild(spec, "type");
			const returnType = typeNode ? this.getText(typeNode) : undefined;

			// Exported
			const isExported = /^[A-Z]/.test(name);

			symbols.push({
				name,
				symbolType: "variable",
				path: filePath,
				startLine: this.getLineNumber(spec.startPosition),
				endLine: this.getLineNumber(spec.endPosition),
				body: this.truncateBody(this.getText(spec)),
				jsDoc: "",
				calls: [],
				imports: [],
				metadata: {
					returnType,
					isExported,
				},
			});
		}

		return symbols;
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

		// parameter_declaration содержит имена и тип
		const paramDecls = this.getChildrenOfType(
			parametersNode,
			"parameter_declaration"
		);

		// variadic_parameter_declaration отдельно
		const variadicDecls = this.getChildrenOfType(
			parametersNode,
			"variadic_parameter_declaration"
		);

		for (const decl of paramDecls) {
			const nameNodes = decl.children.filter((c) => c.type === "identifier");
			const typeNode = this.getChild(decl, "type");
			const typeText = typeNode ? this.getText(typeNode) : undefined;

			// В Go может быть несколько параметров с одним типом: func f(a, b int)
			for (const nameNode of nameNodes) {
				const name = this.getText(nameNode);
				params.push({
					name,
					type: typeText,
				});
			}
		}

		// Обработать variadic parameters
		for (const decl of variadicDecls) {
			const nameNodes = decl.children.filter((c) => c.type === "identifier");
			const typeNode = this.getChild(decl, "type");
			const typeText = typeNode ? this.getText(typeNode) : undefined;

			for (const nameNode of nameNodes) {
				const name = this.getText(nameNode);
				params.push({
					name,
					type: typeText ? `...${typeText}` : undefined,
				});
			}
		}

		return params;
	}

	/**
	 * Извлечь receiver из method declaration
	 */
	private extractReceiver(
		receiverNode: Parser.SyntaxNode,
		source: string
	): { text: string; typeName: string; isPointer: boolean } | null {
		// receiver: (u *User) или (u User)
		// Структура: parameter_list с parameter_declaration внутри
		const paramDecl = receiverNode.children.find(
			(c) => c.type === "parameter_declaration"
		);
		if (!paramDecl) {
			return null;
		}

		const typeNode = this.getChild(paramDecl, "type");
		if (!typeNode) {
			return null;
		}

		const typeText = this.getText(typeNode);
		const isPointer = typeText.startsWith("*");
		const typeName = isPointer ? typeText.slice(1) : typeText;

		return {
			text: this.getText(receiverNode),
			typeName,
			isPointer,
		};
	}

	/**
	 * Извлечь doc comment (line or block comments)
	 */
	private extractDocComment(node: Parser.SyntaxNode, source: string): string {
		// В Go doc comments идут перед объявлением
		// Нужно смотреть на предыдущие siblings с типом "comment"
		const parent = node.parent;
		if (!parent) {
			return "";
		}

		const nodeIndex = parent.children.indexOf(node);
		if (nodeIndex === 0) {
			return "";
		}

		const comments: string[] = [];

		// Собрать все комментарии перед этим узлом
		for (let i = nodeIndex - 1; i >= 0; i--) {
			const sibling = parent.children[i];
			if (!sibling) {
				break;
			}

			if (sibling.type === "comment") {
				const commentText = this.getText(sibling)
					.replace(/^\/\/\s?/, "")
					.replace(/^\/\*\s?|\s?\*\/$/g, "")
					.trim();
				comments.unshift(commentText);
			} else if (sibling.type !== "comment") {
				// Если встретили не комментарий, останавливаемся
				break;
			}
		}

		return comments.join("\n");
	}

	/**
	 * Извлечь вызовы функций
	 */
	private extractCalls(node: Parser.SyntaxNode, source: string): string[] {
		const calls = new Set<string>();
		const callNodes = this.findNodesOfType(node, "call_expression");

		for (const callNode of callNodes) {
			const functionNode = this.getChild(callNode, "function");
			if (functionNode) {
				if (functionNode.type === "identifier") {
					calls.add(this.getText(functionNode));
				} else if (functionNode.type === "selector_expression") {
					const fieldNode = this.getChild(functionNode, "field");
					if (fieldNode) {
						calls.add(this.getText(fieldNode));
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
		const importNodes = this.findNodesOfType(node, "import_spec");

		for (const importNode of importNodes) {
			const pathNode = this.getChild(importNode, "path");
			if (pathNode) {
				const importPath = this.getText(pathNode).replace(/^"|"$/g, "");
				imports.push(importPath);
			}
		}

		return imports.slice(0, 30);
	}
}
