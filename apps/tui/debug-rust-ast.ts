// @ts-nocheck
import { readFileSync } from "fs";
import Parser from "tree-sitter";
import Rust from "tree-sitter-rust";

const parser = new Parser();
parser.setLanguage(Rust);

const source = readFileSync(
	"/Users/balkhaev/mycode/yep/apps/tui/src/mem/core/parsers/__tests__/fixtures/rust/sample.rs",
	"utf-8"
);
const tree = parser.parse(source);

function findNode(
	node: Parser.SyntaxNode,
	predicate: (n: Parser.SyntaxNode) => boolean
): Parser.SyntaxNode | null {
	if (predicate(node)) {
		return node;
	}
	for (const child of node.children) {
		const found = findNode(child, predicate);
		if (found) {
			return found;
		}
	}
	return null;
}

// Найти Container struct
const container = findNode(tree.rootNode, (n) => {
	if (n.type === "struct_item") {
		const nameNode = n.children.find((c) => c.type === "type_identifier");
		return nameNode?.text === "Container";
	}
	return false;
});

if (container) {
	console.log("\n=== Container struct AST ===");
	console.log("Children:");
	container.children.forEach((child, i) => {
		console.log(`  [${i}] ${child.type}: "${child.text.slice(0, 50)}"`);
	});

	const typeParams = container.children.find(
		(c) => c.type === "type_parameters"
	);
	if (typeParams) {
		console.log("\n=== type_parameters found ===");
		console.log("Children:");
		typeParams.children.forEach((child, i) => {
			console.log(`  [${i}] ${child.type}: "${child.text}"`);
		});
	} else {
		console.log("\n!!! type_parameters NOT FOUND !!!");
	}
}

// Найти Result type alias
const resultType = findNode(tree.rootNode, (n) => {
	if (n.type === "type_item") {
		const nameNode = n.children.find((c) => c.type === "type_identifier");
		return nameNode?.text === "Result";
	}
	return false;
});

if (resultType) {
	console.log("\n=== Result type alias AST ===");
	console.log("Children:");
	resultType.children.forEach((child, i) => {
		console.log(`  [${i}] ${child.type}: "${child.text.slice(0, 50)}"`);
	});

	const typeParams = resultType.children.find(
		(c) => c.type === "type_parameters"
	);
	if (typeParams) {
		console.log("\n=== type_parameters found ===");
		console.log("Children:");
		typeParams.children.forEach((child, i) => {
			console.log(`  [${i}] ${child.type}: "${child.text}"`);
		});
	} else {
		console.log("\n!!! type_parameters NOT FOUND !!!");
	}
}
