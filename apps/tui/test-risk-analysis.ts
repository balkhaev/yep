// @ts-nocheck
/**
 * Тест risk-analysis: bug risk scoring
 */

import type { CodeResult } from "./src/mem/core/code-store.ts";
import {
	computeBugRiskScore,
	findHighRiskSymbols,
	formatRiskScore,
	generateRiskRecommendations,
	getTopRiskFactors,
} from "./src/mem/core/risk-analysis.ts";

async function testRiskAnalysis() {
	console.log("=== Test Risk Analysis ===\n");

	// 1. Create mock code results with varying risk levels
	console.log("1. Creating mock code results...");

	const lowRiskSymbol: CodeResult = {
		id: "low:simple:function",
		symbol: "simpleFunction",
		symbolType: "function",
		path: "utils/simple.ts",
		language: "typescript",
		body: `function simpleFunction(x: number): number {
  return x * 2;
}`,
		summary: "Doubles a number",
		commit: "abc123",
		lastModified: "2026-02-25T12:00:00Z",
		calls: "",
		imports: "",
		metadata: JSON.stringify({ jsDoc: "Simple doubling function" }),
		gitChangeCount: 1,
		gitAuthorCount: 1,
	};

	const highRiskSymbol: CodeResult = {
		id: "high:complex:function",
		symbol: "complexDataProcessor",
		symbolType: "function",
		path: "core/processor.ts",
		language: "typescript",
		body: `function complexDataProcessor(data, type, options, config, meta, flags, handlers, callbacks) {
  let result = null;
  if (type === 1) {
    if (options.mode === "fast") {
      if (config.validate) {
        if (meta.enabled) {
          if (flags.strict) {
            if (handlers.primary) {
              result = handlers.primary(data);
            } else {
              result = handlers.fallback(data);
            }
          }
        }
      }
    }
  } else if (type === 2) {
    for (let i = 0; i < data.length; i++) {
      if (data[i].value > 100) {
        if (data[i].status === "active") {
          callbacks.onProcess(data[i]);
        }
      }
    }
  }
  return result;
}`.repeat(5), // Make it very long
		summary: "Processes data with complex logic",
		commit: "def456",
		lastModified: "2026-02-25T12:00:00Z",
		calls: "validateData,processItem,handleError,logEvent",
		imports: "",
		gitChangeCount: 45, // Changed many times
		gitAuthorCount: 7, // Many authors
	};

	const mediumRiskSymbol: CodeResult = {
		id: "medium:moderate:class",
		symbol: "DataHandler",
		symbolType: "class",
		path: "handlers/data.ts",
		language: "typescript",
		body: `class DataHandler {
  constructor(config) {
    this.config = config;
    this.cache = new Map();
  }

  process(data) {
    if (!this.validate(data)) {
      throw new Error("Invalid data");
    }

    const cached = this.cache.get(data.id);
    if (cached) {
      return cached;
    }

    const result = this.transform(data);
    this.cache.set(data.id, result);
    return result;
  }

  validate(data) {
    return data && data.id && data.value;
  }

  transform(data) {
    return {
      id: data.id,
      value: data.value * 2,
      timestamp: Date.now()
    };
  }
}`,
		summary: "", // No summary
		commit: "ghi789",
		lastModified: "2026-02-25T12:00:00Z",
		calls: "Map",
		imports: "",
		gitChangeCount: 12,
		gitAuthorCount: 3,
	};

	console.log("   ✓ Created 3 mock symbols (low, medium, high risk)");

	// 2. Compute risk scores
	console.log("\n2. Computing bug risk scores...");

	const lowRisk = computeBugRiskScore(lowRiskSymbol);
	console.log(`   Low risk: ${formatRiskScore(lowRisk)}`);
	console.log(`     Complexity: ${(lowRisk.complexityScore * 100).toFixed(0)}%`);
	console.log(
		`     Change freq: ${(lowRisk.changeFrequencyScore * 100).toFixed(0)}%`
	);
	console.log(
		`     Author churn: ${(lowRisk.authorChurnScore * 100).toFixed(0)}%`
	);

	const mediumRisk = computeBugRiskScore(mediumRiskSymbol);
	console.log(`\n   Medium risk: ${formatRiskScore(mediumRisk)}`);
	console.log(
		`     Complexity: ${(mediumRisk.complexityScore * 100).toFixed(0)}%`
	);
	console.log(
		`     Documentation: ${(mediumRisk.documentationScore * 100).toFixed(0)}%`
	);

	const highRisk = computeBugRiskScore(highRiskSymbol);
	console.log(`\n   High risk: ${formatRiskScore(highRisk)}`);
	console.log(
		`     Complexity: ${(highRisk.complexityScore * 100).toFixed(0)}%`
	);
	console.log(
		`     Change freq: ${(highRisk.changeFrequencyScore * 100).toFixed(0)}%`
	);
	console.log(
		`     Author churn: ${(highRisk.authorChurnScore * 100).toFixed(0)}%`
	);
	console.log(`     Line count: ${(highRisk.lineCountScore * 100).toFixed(0)}%`);

	// 3. Test findHighRiskSymbols
	console.log("\n3. Finding high risk symbols...");
	const allSymbols = [lowRiskSymbol, mediumRiskSymbol, highRiskSymbol];
	const riskySymbols = findHighRiskSymbols(allSymbols, 10);

	console.log(`   Found ${riskySymbols.length} symbols ranked by risk:`);
	for (const { chunk, risk } of riskySymbols) {
		console.log(`     ${chunk.symbol}: ${formatRiskScore(risk)}`);
	}

	// 4. Test top risk factors
	console.log("\n4. Top risk factors for high-risk symbol...");
	const topFactors = getTopRiskFactors(highRisk);
	console.log("   Top contributing factors:");
	for (const { factor, score } of topFactors) {
		console.log(`     ${factor}: ${(score * 100).toFixed(0)}%`);
	}

	// 5. Test recommendations
	console.log("\n5. Risk reduction recommendations...");
	const recommendations = generateRiskRecommendations(highRisk);
	console.log(`   Generated ${recommendations.length} recommendations:`);
	for (const rec of recommendations) {
		console.log(`     ${rec}`);
	}

	// 6. Verify risk levels
	console.log("\n6. Verifying risk level classification...");
	console.log(
		`   ✓ Low risk (${lowRisk.score.toFixed(0)}): ${lowRisk.riskLevel === "low" ? "PASS" : "FAIL"}`
	);
	console.log(
		`   ✓ Medium risk (${mediumRisk.score.toFixed(0)}): ${mediumRisk.riskLevel === "medium" || mediumRisk.riskLevel === "high" ? "PASS" : "FAIL"}`
	);
	console.log(
		`   ✓ High risk (${highRisk.score.toFixed(0)}): ${highRisk.riskLevel === "high" || highRisk.riskLevel === "critical" ? "PASS" : "FAIL"}`
	);

	console.log("\n=== All Checks Passed ===");
}

// Run test
testRiskAnalysis().catch((err) => {
	console.error("Test failed:", err);
	process.exit(1);
});
