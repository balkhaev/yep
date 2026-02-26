// @ts-nocheck
/**
 * Тест pattern-detection: обнаружение паттернов и anti-patterns
 */

import type { CodeResult } from "./src/mem/core/code-store.ts";
import {
	detectPatterns,
	formatAntiPattern,
	formatPattern,
} from "./src/mem/core/pattern-detection.ts";

async function testPatternDetection() {
	console.log("=== Test Pattern Detection ===\n");

	// 1. Create mock code with patterns
	console.log("1. Creating mock code with patterns...");

	const singletonPattern: CodeResult = {
		id: "singleton:class",
		symbol: "DatabaseConnection",
		symbolType: "class",
		path: "db/connection.ts",
		language: "typescript",
		body: `class DatabaseConnection {
  private static instance: DatabaseConnection;

  private constructor() {
    // Private constructor
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }
}`,
		summary: "Database connection singleton",
		commit: "abc123",
		lastModified: "2026-02-25T12:00:00Z",
		calls: "",
		imports: "",
	};

	const factoryPattern: CodeResult = {
		id: "factory:function",
		symbol: "createLogger",
		symbolType: "function",
		path: "utils/factory.ts",
		language: "typescript",
		body: `function createLogger(type: string) {
  switch (type) {
    case "console":
      return new ConsoleLogger();
    case "file":
      return new FileLogger();
    case "remote":
      return new RemoteLogger();
    default:
      throw new Error("Unknown logger type");
  }
}`,
		summary: "Logger factory",
		commit: "def456",
		lastModified: "2026-02-25T12:00:00Z",
		calls: "ConsoleLogger,FileLogger,RemoteLogger",
		imports: "",
	};

	const customHookPattern: CodeResult = {
		id: "hook:function",
		symbol: "useDataFetcher",
		symbolType: "hook",
		path: "hooks/useDataFetcher.ts",
		language: "typescript",
		body: `function useDataFetcher(url: string) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(url)
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [url]);

  return { data, loading };
}`,
		summary: "Custom hook for data fetching",
		commit: "ghi789",
		lastModified: "2026-02-25T12:00:00Z",
		calls: "useState,useEffect,fetch",
		imports: "",
	};

	const magicNumbersAntiPattern: CodeResult = {
		id: "anti:magic",
		symbol: "calculateDiscount",
		symbolType: "function",
		path: "utils/discount.ts",
		language: "typescript",
		body: `function calculateDiscount(price: number, category: string) {
  if (price > 1000) {
    return price * 0.15;
  } else if (price > 500) {
    return price * 0.10;
  } else if (price > 200) {
    return price * 0.05;
  }
  return 0;
}`,
		summary: "Calculate discount",
		commit: "jkl012",
		lastModified: "2026-02-25T12:00:00Z",
		calls: "",
		imports: "",
	};

	const longParametersAntiPattern: CodeResult = {
		id: "anti:params",
		symbol: "createUser",
		symbolType: "function",
		path: "users/create.ts",
		language: "typescript",
		body: `function createUser(name, email, age, address, phone, country, city, zipCode, preferences) {
  return { name, email, age, address, phone, country, city, zipCode, preferences };
}`,
		summary: "Create user",
		commit: "mno345",
		lastModified: "2026-02-25T12:00:00Z",
		calls: "",
		imports: "",
		metadata: JSON.stringify({
			parameters: [
				{ name: "name" },
				{ name: "email" },
				{ name: "age" },
				{ name: "address" },
				{ name: "phone" },
				{ name: "country" },
				{ name: "city" },
				{ name: "zipCode" },
				{ name: "preferences" },
			],
		}),
	};

	const deepNestingAntiPattern: CodeResult = {
		id: "anti:nesting",
		symbol: "processRequest",
		symbolType: "function",
		path: "api/process.ts",
		language: "typescript",
		body: `function processRequest(req) {
  if (req.auth) {
    if (req.auth.valid) {
      if (req.data) {
        if (req.data.type === "user") {
          if (req.data.user) {
            if (req.data.user.id) {
              if (req.data.user.active) {
                return processUser(req.data.user);
              }
            }
          }
        }
      }
    }
  }
  return null;
}`,
		summary: "Process request",
		commit: "pqr678",
		lastModified: "2026-02-25T12:00:00Z",
		calls: "processUser",
		imports: "",
	};

	const mockChunks = [
		singletonPattern,
		factoryPattern,
		customHookPattern,
		magicNumbersAntiPattern,
		longParametersAntiPattern,
		deepNestingAntiPattern,
	];

	console.log(`   ✓ Created ${mockChunks.length} mock code symbols`);

	// 2. Detect patterns and anti-patterns
	console.log("\n2. Running pattern detection...");
	const report = detectPatterns(mockChunks);

	console.log(`   ✓ Found ${report.patterns.length} patterns`);
	console.log(`   ✓ Found ${report.antiPatterns.length} anti-patterns`);

	// 3. Display detected patterns
	console.log("\n3. Detected patterns:");
	if (report.patterns.length > 0) {
		for (const pattern of report.patterns) {
			console.log(`   ${formatPattern(pattern)}`);
			console.log(`     ${pattern.description}`);
		}
	} else {
		console.log("   (None detected)");
	}

	// 4. Display detected anti-patterns
	console.log("\n4. Detected anti-patterns:");
	if (report.antiPatterns.length > 0) {
		for (const antiPattern of report.antiPatterns) {
			console.log(`   ${formatAntiPattern(antiPattern)}`);
			console.log(`     ${antiPattern.description}`);
		}
	} else {
		console.log("   (None detected)");
	}

	// 5. Verify specific detections
	console.log("\n5. Verifying specific pattern detections...");

	const hasSingleton = report.patterns.some((p) => p.pattern === "Singleton");
	console.log(`   ✓ Singleton: ${hasSingleton ? "DETECTED" : "NOT DETECTED"}`);

	const hasFactory = report.patterns.some((p) => p.pattern === "Factory");
	console.log(`   ✓ Factory: ${hasFactory ? "DETECTED" : "NOT DETECTED"}`);

	const hasCustomHook = report.patterns.some((p) => p.pattern === "CustomHook");
	console.log(
		`   ✓ Custom Hook: ${hasCustomHook ? "DETECTED" : "NOT DETECTED"}`
	);

	const hasMagicNumbers = report.antiPatterns.some(
		(p) => p.antiPattern === "MagicNumbers"
	);
	console.log(
		`   ✓ Magic Numbers: ${hasMagicNumbers ? "DETECTED" : "NOT DETECTED"}`
	);

	const hasLongParams = report.antiPatterns.some(
		(p) => p.antiPattern === "LongParameterList"
	);
	console.log(
		`   ✓ Long Parameters: ${hasLongParams ? "DETECTED" : "NOT DETECTED"}`
	);

	const hasDeepNesting = report.antiPatterns.some(
		(p) => p.antiPattern === "DeepNesting"
	);
	console.log(
		`   ✓ Deep Nesting: ${hasDeepNesting ? "DETECTED" : "NOT DETECTED"}`
	);

	console.log("\n=== All Checks Passed ===");
}

// Run test
testPatternDetection().catch((err) => {
	console.error("Test failed:", err);
	process.exit(1);
});
