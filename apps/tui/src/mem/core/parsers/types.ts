import type {
	CodeChunk as BaseCodeChunk,
	CodeSymbol as BaseCodeSymbol,
} from "../code-chunker.ts";

/**
 * Расширенная информация о параметре функции
 */
export interface FunctionParameter {
	defaultValue?: string;
	isOptional?: boolean;
	name: string;
	type?: string;
}

/**
 * Информация о generic параметре
 */
export interface GenericParameter {
	constraint?: string;
	name: string;
}

/**
 * Информация о декораторе/аннотации
 */
export interface Decorator {
	arguments?: string[];
	name: string;
}

/**
 * React-специфичные метаданные
 */
export interface ReactMetadata {
	hookDependencies?: string[];
	isHook?: boolean;
	propsType?: string;
}

/**
 * Язык-специфичные метаданные
 */
export interface LanguageSpecificMetadata {
	goDocComment?: string;

	// Go
	goReceiver?: string;
	goReceiverPointer?: boolean;
	// Python
	pythonDecorators?: string[];
	pythonDocstring?: string;
	rustDocComment?: string;
	rustLifetimes?: string[];
	rustStatic?: boolean;
	rustTrait?: boolean;
	rustTraitImpl?: string;

	// Rust
	rustTraits?: string[];
}

/**
 * Расширенные метаданные для символа кода
 */
export interface SymbolMetadata {
	// Decorators/Annotations
	decorators?: Decorator[];

	// Generic/Template parameters
	genericParams?: GenericParameter[];
	isAsync?: boolean;
	isExported?: boolean;
	isGenerator?: boolean;

	// Language-specific
	language?: LanguageSpecificMetadata;
	modifiers?: string[]; // static, abstract, readonly, etc.
	// Function/Method metadata
	parameters?: FunctionParameter[];

	// React-specific
	react?: ReactMetadata;
	returnType?: string;

	// Visibility & modifiers
	visibility?: "public" | "private" | "protected" | "internal";
}

/**
 * Расширенный тип символа кода с дополнительными метаданными
 */
export interface EnhancedCodeSymbol extends BaseCodeSymbol {
	metadata?: SymbolMetadata;
}

/**
 * Расширенный тип chunk с метаданными
 */
export interface EnhancedCodeChunk extends BaseCodeChunk {
	metadata?: SymbolMetadata;
}

/**
 * Все поддерживаемые типы символов
 */
export type SymbolType =
	| "function"
	| "class"
	| "method"
	| "interface"
	| "type"
	| "enum"
	| "component"
	| "constant"
	| "variable"
	| "hook";
