// @ts-nocheck
import type Parser from "tree-sitter";
import Rust from "tree-sitter-rust";
import {
	BaseNodeExtractor,
	type NodeExtractor,
	TreeSitterParser,
} from "./tree-sitter-parser.ts";
import type {
	EnhancedCodeSymbol,
	FunctionParameter,
	GenericParameter,
	SymbolMetadata,
} from "./types.ts";

/**
 * Rust парсер на основе Tree-sitter
 */
export class RustParser extends TreeSitterParser {
	protected getLanguage(): unknown {
		return Rust;
	}

	protected getNodeExtractor(): NodeExtractor {
		return new RustNodeExtractor();
	}
}

/**
 * Extractor для Rust AST
 */
class RustNodeExtractor extends BaseNodeExtractor {
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
		symbols: EnhancedCodeSymbol[],
		skipFunctions = false
	): void {
		// Function declaration (пропускаем если внутри impl block)
		if (node.type === "function_item" && !skipFunctions) {
			const symbol = this.extractFunction(node, filePath, source);
			if (symbol) {
				symbols.push(symbol);
			}
		}

		// Struct declaration
		if (node.type === "struct_item") {
			const symbol = this.extractStruct(node, filePath, source);
			if (symbol) {
				symbols.push(symbol);
			}
		}

		// Enum declaration
		if (node.type === "enum_item") {
			const symbol = this.extractEnum(node, filePath, source);
			if (symbol) {
				symbols.push(symbol);
			}
		}

		// Trait declaration
		if (node.type === "trait_item") {
			const symbol = this.extractTrait(node, filePath, source);
			if (symbol) {
				symbols.push(symbol);
			}
		}

		// Impl block
		if (node.type === "impl_item") {
			const methods = this.extractImplBlock(node, filePath, source);
			symbols.push(...methods);
			// Не делаем рекурсивный обход внутри impl - уже обработали
			return;
		}

		// Const declaration
		if (node.type === "const_item") {
			const symbol = this.extractConstant(node, filePath, source);
			if (symbol) {
				symbols.push(symbol);
			}
		}

		// Static declaration
		if (node.type === "static_item") {
			const symbol = this.extractStatic(node, filePath, source);
			if (symbol) {
				symbols.push(symbol);
			}
		}

		// Type alias
		if (node.type === "type_item") {
			const symbol = this.extractTypeAlias(node, filePath, source);
			if (symbol) {
				symbols.push(symbol);
			}
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

		// Visibility
		const visibility = this.extractVisibility(node);

		// Parameters
		const parametersNode = this.getChild(node, "parameters");
		const parameters = this.extractParameters(parametersNode, source);

		// Return type
		const returnTypeNode = this.getChild(node, "return_type");
		const returnType = returnTypeNode
			? this.getText(returnTypeNode).replace(/^->\\s*/, "")
			: undefined;

		// Generics
		const genericParams = this.extractGenerics(node, source);

		// Async - проверяем наличие ключевого слова async
		const bodyText = this.getText(node);
		const isAsync =
			bodyText.trimStart().startsWith("pub async") ||
			bodyText.trimStart().startsWith("async");

		// Doc comment
		const docComment = this.extractDocComment(node, source);

		// Calls
		const calls = this.extractCalls(node, source);

		const metadata: SymbolMetadata = {
			parameters,
			returnType,
			isAsync,
			visibility,
			isExported: visibility === "public",
			genericParams: genericParams.length > 0 ? genericParams : undefined,
			language: {
				rustDocComment: docComment,
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
			imports: [],
			metadata,
		};
	}

	/**
	 * Извлечь struct
	 */
	private extractStruct(
		node: Parser.SyntaxNode,
		filePath: string,
		source: string
	): EnhancedCodeSymbol | null {
		const nameNode = this.getChild(node, "name");
		if (!nameNode) {
			return null;
		}

		const name = this.getText(nameNode);

		// Visibility
		const visibility = this.extractVisibility(node);

		// Generics
		const genericParams = this.extractGenerics(node, source);

		// Doc comment
		const docComment = this.extractDocComment(node, source);

		return {
			name,
			symbolType: "class",
			path: filePath,
			startLine: this.getLineNumber(node.startPosition),
			endLine: this.getLineNumber(node.endPosition),
			body: this.truncateBody(this.getText(node)),
			jsDoc: docComment,
			calls: [],
			imports: [],
			metadata: {
				visibility,
				isExported: visibility === "public",
				genericParams: genericParams.length > 0 ? genericParams : undefined,
				language: {
					rustDocComment: docComment,
				},
			},
		};
	}

	/**
	 * Извлечь enum
	 */
	private extractEnum(
		node: Parser.SyntaxNode,
		filePath: string,
		source: string
	): EnhancedCodeSymbol | null {
		const nameNode = this.getChild(node, "name");
		if (!nameNode) {
			return null;
		}

		const name = this.getText(nameNode);

		// Visibility
		const visibility = this.extractVisibility(node);

		// Generics
		const genericParams = this.extractGenerics(node, source);

		// Doc comment
		const docComment = this.extractDocComment(node, source);

		return {
			name,
			symbolType: "enum",
			path: filePath,
			startLine: this.getLineNumber(node.startPosition),
			endLine: this.getLineNumber(node.endPosition),
			body: this.truncateBody(this.getText(node)),
			jsDoc: docComment,
			calls: [],
			imports: [],
			metadata: {
				visibility,
				isExported: visibility === "public",
				genericParams: genericParams.length > 0 ? genericParams : undefined,
				language: {
					rustDocComment: docComment,
				},
			},
		};
	}

	/**
	 * Извлечь trait
	 */
	private extractTrait(
		node: Parser.SyntaxNode,
		filePath: string,
		source: string
	): EnhancedCodeSymbol | null {
		const nameNode = this.getChild(node, "name");
		if (!nameNode) {
			return null;
		}

		const name = this.getText(nameNode);

		// Visibility
		const visibility = this.extractVisibility(node);

		// Generics
		const genericParams = this.extractGenerics(node, source);

		// Doc comment
		const docComment = this.extractDocComment(node, source);

		return {
			name,
			symbolType: "interface",
			path: filePath,
			startLine: this.getLineNumber(node.startPosition),
			endLine: this.getLineNumber(node.endPosition),
			body: this.truncateBody(this.getText(node)),
			jsDoc: docComment,
			calls: [],
			imports: [],
			metadata: {
				visibility,
				isExported: visibility === "public",
				genericParams: genericParams.length > 0 ? genericParams : undefined,
				language: {
					rustDocComment: docComment,
					rustTrait: true,
				},
			},
		};
	}

	/**
	 * Извлечь методы из impl block
	 */
	private extractImplBlock(
		node: Parser.SyntaxNode,
		filePath: string,
		source: string
	): EnhancedCodeSymbol[] {
		const symbols: EnhancedCodeSymbol[] = [];

		// Получить тип для impl (struct/trait)
		// impl Type { } - type_identifier
		// impl<T> Type<T> { } - generic_type
		// impl Trait for Type { } - ищем после "for"

		let typeNode: Parser.SyntaxNode | null = null;
		let traitName: string | undefined;

		// Проверить есть ли "for" (impl Trait for Type)
		const forIndex = node.children.findIndex((c) => c.type === "for");
		if (forIndex !== -1) {
			// Trait - это перед "for"
			const traitNode = node.children.find(
				(c, i) =>
					i < forIndex &&
					(c.type === "type_identifier" || c.type === "generic_type")
			);
			traitName = traitNode ? this.getText(traitNode) : undefined;

			// Type - это после "for"
			typeNode =
				node.children.find(
					(c, i) =>
						i > forIndex &&
						(c.type === "type_identifier" || c.type === "generic_type")
				) ?? null;
		} else {
			// Обычный impl Type { }
			typeNode =
				node.children.find(
					(c) => c.type === "type_identifier" || c.type === "generic_type"
				) ?? null;
		}

		if (!typeNode) {
			return symbols;
		}

		const typeName = this.getText(typeNode);

		// Найти все function_item в impl block
		const bodyNode = node.children.find((c) => c.type === "declaration_list");

		if (!bodyNode) {
			return symbols;
		}

		for (const child of bodyNode.children) {
			if (child.type === "function_item") {
				const nameNode = this.getChild(child, "name");
				if (!nameNode) {
					continue;
				}

				const methodName = this.getText(nameNode);
				const fullName = `${typeName}.${methodName}`;

				// Visibility
				const visibility = this.extractVisibility(child);

				// Parameters
				const parametersNode = this.getChild(child, "parameters");
				const parameters = this.extractParameters(parametersNode, source);

				// Return type
				const returnTypeNode = this.getChild(child, "return_type");
				const returnType = returnTypeNode
					? this.getText(returnTypeNode).replace(/^->\\s*/, "")
					: undefined;

				// Generics
				const genericParams = this.extractGenerics(child, source);

				// Async
				const funcBodyText = this.getText(child);
				const isAsync =
					funcBodyText.trimStart().startsWith("pub async") ||
					funcBodyText.trimStart().startsWith("async");

				// Doc comment
				const docComment = this.extractDocComment(child, source);

				// Calls
				const calls = this.extractCalls(child, source);

				const metadata: SymbolMetadata = {
					parameters,
					returnType,
					isAsync,
					visibility,
					isExported: visibility === "public",
					genericParams: genericParams.length > 0 ? genericParams : undefined,
					language: {
						rustDocComment: docComment,
						rustTraitImpl: traitName,
					},
				};

				symbols.push({
					name: fullName,
					symbolType: "method",
					path: filePath,
					startLine: this.getLineNumber(child.startPosition),
					endLine: this.getLineNumber(child.endPosition),
					body: this.truncateBody(this.getText(child)),
					jsDoc: docComment,
					calls,
					imports: traitName ? [traitName] : [],
					metadata,
				});
			}
		}

		return symbols;
	}

	/**
	 * Извлечь constant
	 */
	private extractConstant(
		node: Parser.SyntaxNode,
		filePath: string,
		source: string
	): EnhancedCodeSymbol | null {
		const nameNode = this.getChild(node, "name");
		if (!nameNode) {
			return null;
		}

		const name = this.getText(nameNode);

		// Visibility
		const visibility = this.extractVisibility(node);

		// Type
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
				visibility,
				isExported: visibility === "public",
				returnType,
			},
		};
	}

	/**
	 * Извлечь static
	 */
	private extractStatic(
		node: Parser.SyntaxNode,
		filePath: string,
		source: string
	): EnhancedCodeSymbol | null {
		const nameNode = this.getChild(node, "name");
		if (!nameNode) {
			return null;
		}

		const name = this.getText(nameNode);

		// Visibility
		const visibility = this.extractVisibility(node);

		// Type
		const typeNode = this.getChild(node, "type");
		const returnType = typeNode ? this.getText(typeNode) : undefined;

		return {
			name,
			symbolType: "variable",
			path: filePath,
			startLine: this.getLineNumber(node.startPosition),
			endLine: this.getLineNumber(node.endPosition),
			body: this.truncateBody(this.getText(node)),
			jsDoc: "",
			calls: [],
			imports: [],
			metadata: {
				visibility,
				isExported: visibility === "public",
				returnType,
				language: {
					rustStatic: true,
				},
			},
		};
	}

	/**
	 * Извлечь type alias
	 */
	private extractTypeAlias(
		node: Parser.SyntaxNode,
		filePath: string,
		source: string
	): EnhancedCodeSymbol | null {
		const nameNode = this.getChild(node, "name");
		if (!nameNode) {
			return null;
		}

		const name = this.getText(nameNode);

		// Visibility
		const visibility = this.extractVisibility(node);

		// Generics
		const genericParams = this.extractGenerics(node, source);

		// Doc comment
		const docComment = this.extractDocComment(node, source);

		return {
			name,
			symbolType: "type",
			path: filePath,
			startLine: this.getLineNumber(node.startPosition),
			endLine: this.getLineNumber(node.endPosition),
			body: this.truncateBody(this.getText(node)),
			jsDoc: docComment,
			calls: [],
			imports: [],
			metadata: {
				visibility,
				isExported: visibility === "public",
				genericParams: genericParams.length > 0 ? genericParams : undefined,
				language: {
					rustDocComment: docComment,
				},
			},
		};
	}

	/**
	 * Извлечь visibility (pub, pub(crate), private)
	 */
	private extractVisibility(
		node: Parser.SyntaxNode
	): "public" | "private" | "protected" | "internal" {
		// Найти visibility_modifier
		const visibilityNode = node.children.find(
			(c) => c.type === "visibility_modifier"
		);

		if (!visibilityNode) {
			return "private";
		}

		const visText = this.getText(visibilityNode);

		if (visText === "pub") {
			return "public";
		}
		if (visText.includes("pub(crate)")) {
			return "internal";
		}
		if (visText.includes("pub(super)")) {
			return "protected";
		}

		return "private";
	}

	/**
	 * Извлечь generic parameters
	 */
	private extractGenerics(
		node: Parser.SyntaxNode,
		source: string
	): GenericParameter[] {
		const generics: GenericParameter[] = [];

		// Найти type_parameters в children
		const typeParamsNode = node.children.find(
			(c) => c.type === "type_parameters"
		);
		if (!typeParamsNode) {
			return generics;
		}

		// Найти все type_parameter, constrained_type_parameter, lifetime, type_identifier
		for (const child of typeParamsNode.children) {
			if (child.type === "type_identifier") {
				// Простейший generic: <T> (прямой type_identifier без wrapper)
				const name = this.getText(child);
				generics.push({ name, constraint: undefined });
			} else if (child.type === "type_parameter") {
				// Простой generic без constraint: <T>
				const nameNode = child.children.find(
					(c) => c.type === "type_identifier"
				);
				if (!nameNode) {
					continue;
				}

				const name = this.getText(nameNode);
				generics.push({ name, constraint: undefined });
			} else if (child.type === "constrained_type_parameter") {
				// Generic с constraint: <T: Display>
				const nameNode = child.children.find(
					(c) => c.type === "type_identifier"
				);
				if (!nameNode) {
					continue;
				}

				const name = this.getText(nameNode);

				// Trait bounds (после :)
				const boundsNode = child.children.find(
					(c) => c.type === "trait_bounds"
				);
				const constraint = boundsNode ? this.getText(boundsNode) : undefined;

				generics.push({ name, constraint });
			} else if (child.type === "lifetime") {
				// Lifetime: <'a>
				const name = this.getText(child);
				generics.push({ name, constraint: "lifetime" });
			}
		}

		return generics;
	}

	/**
	 * Извлечь parameters
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
			if (child.type === "parameter") {
				// Найти pattern (имя) и type
				const patternNode = this.getChild(child, "pattern");
				const typeNode = this.getChild(child, "type");

				if (!patternNode) {
					continue;
				}

				// Если pattern - это self, &self, &mut self - пропускаем
				const patternText = this.getText(patternNode);
				if (
					patternText === "self" ||
					patternText === "&self" ||
					patternText === "&mut self"
				) {
					continue;
				}

				// Получить имя из pattern
				const identNode = patternNode.children.find(
					(c) => c.type === "identifier"
				);
				const name = identNode ? this.getText(identNode) : patternText;

				const type = typeNode ? this.getText(typeNode) : undefined;

				params.push({ name, type });
			} else if (child.type === "self_parameter") {
			}
		}

		return params;
	}

	/**
	 * Извлечь doc comment (///)
	 */
	private extractDocComment(node: Parser.SyntaxNode, source: string): string {
		// В Rust doc comments могут быть атрибутами (#[doc = ...]) или line comments (///)
		// Ищем в children самого узла attribute_item с doc
		for (const child of node.children) {
			if (child.type === "attribute_item") {
				const text = this.getText(child);
				if (text.includes("doc")) {
					return text
						.replace(/^#\[doc\s*=\s*"?/, "")
						.replace(/"?\]$/, "")
						.trim();
				}
			}
		}

		// Fallback: простой поиск по строкам source перед node
		const startLine = node.startPosition.row;
		if (startLine === 0) {
			return "";
		}

		const lines = source.split("\n");
		const comments: string[] = [];

		// Собрать все /// комментарии перед этой строкой
		// Пропускать пустые строки и атрибуты (#[...])
		for (let i = startLine - 1; i >= 0; i--) {
			const line = lines[i]?.trim();
			if (!line) {
				continue;
			}

			// Пропустить атрибуты (#[derive], #[test], etc)
			if (line.startsWith("#[")) {
				continue;
			}

			if (line.startsWith("///")) {
				comments.unshift(line.replace(/^\/\/\/\s?/, ""));
			} else if (!line.startsWith("//")) {
				// Не комментарий - останавливаемся
				break;
			}
		}

		return comments.join("\n");
	}

	/**
	 * Извлечь calls
	 */
	private extractCalls(node: Parser.SyntaxNode, source: string): string[] {
		const calls = new Set<string>();
		const callNodes = this.findNodesOfType(node, "call_expression");

		for (const callNode of callNodes) {
			const functionNode = this.getChild(callNode, "function");
			if (functionNode) {
				if (functionNode.type === "identifier") {
					calls.add(this.getText(functionNode));
				} else if (functionNode.type === "field_expression") {
					const fieldNode = this.getChild(functionNode, "field");
					if (fieldNode) {
						calls.add(this.getText(fieldNode));
					}
				}
			}
		}

		return Array.from(calls).slice(0, 30);
	}
}
