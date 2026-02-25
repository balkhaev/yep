#!/usr/bin/env bun

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const type = process.argv[2] as "patch" | "minor" | "major";

if (!["patch", "minor", "major"].includes(type)) {
	console.error("Usage: bun scripts/bump-version.ts <patch|minor|major>");
	process.exit(1);
}

const pkgPath = resolve(import.meta.dir, "../package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

const [major, minor, patch] = pkg.version.split(".").map(Number);

let newVersion: string;
switch (type) {
	case "major":
		newVersion = `${major + 1}.0.0`;
		break;
	case "minor":
		newVersion = `${major}.${minor + 1}.0`;
		break;
	case "patch":
		newVersion = `${major}.${minor}.${patch + 1}`;
		break;
}

pkg.version = newVersion;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log(`${pkg.name} v${newVersion}`);
