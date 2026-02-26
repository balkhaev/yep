# API Reference

Технический справочник для разработчиков, расширяющих YEP.

## Graph Store

**File:** `apps/tui/src/mem/core/graph-store.ts`

### Types

```typescript
type EdgeType = "calls" | "imports" | "extends" | "implements";

interface GraphEdge {
  id: string;              // "source:target:type"
  source: string;          // Symbol name
  target: string;          // Symbol name
  edgeType: EdgeType;
  sourceFile: string;
  targetFile?: string;
  count: number;           // Number of occurrences
  commit: string;
  lastModified: string;
}
```

### Functions

```typescript
// Insert edges (batch operation)
async function insertGraphEdges(edges: GraphEdge[]): Promise<number>

// Query edges
async function getIncomingEdges(symbolName: string, edgeType?: EdgeType): Promise<GraphQueryResult[]>
async function getOutgoingEdges(symbolName: string, edgeType?: EdgeType): Promise<GraphQueryResult[]>
async function getCallerCount(symbolName: string): Promise<number>

// Build edges from calls string (CSV format)
function buildGraphEdgesFromCalls(
  symbolName: string,
  filePath: string,
  calls: string,
  imports: string,
  commit: string,
  lastModified: string
): GraphEdge[]

// Cleanup
async function deleteGraphEdgesByFile(filePath: string): Promise<void>
```

**Note:** LanceDB filtering limitations - use in-memory filtering for complex queries.

---

## PageRank

**File:** `apps/tui/src/mem/core/pagerank.ts`

### Algorithm Parameters

```typescript
const DAMPING_FACTOR = 0.85;
const MAX_ITERATIONS = 20;
const CONVERGENCE_THRESHOLD = 0.0001;
```

### Functions

```typescript
// Compute PageRank for all symbols
async function computePageRank(): Promise<Map<string, number>>

// Get top N symbols by PageRank
async function getTopPageRankSymbols(limit: number): Promise<Array<{symbol: string, score: number}>>

// Normalize scores to 0-1 range
function normalizePageRankScores(scores: Map<string, number>): Map<string, number>

// Cached version (5 min TTL)
async function getCachedPageRank(): Promise<Map<string, number>>

// Invalidate cache
function invalidatePageRankCache(): void
```

**Performance:** Converges in 3-5 iterations for typical codebases (<10ms).

---

## Git Metadata

**File:** `apps/tui/src/mem/core/git-metadata.ts`

### Types

```typescript
interface GitMetadata {
  authorCount: number;
  changeCount: number;
  lastChangeDate: string;     // ISO string
  recentCommits?: string[];   // Last 5 commit hashes
}
```

### Functions

```typescript
// Get metadata for file
async function getGitMetadataForFile(filePath: string): Promise<GitMetadata | null>

// Get metadata for line range (precise tracking)
async function getGitMetadataForLines(
  filePath: string,
  startLine: number,
  endLine: number
): Promise<GitMetadata | null>

// Batch extraction
async function getGitMetadataForFiles(filePaths: string[]): Promise<Map<string, GitMetadata | null>>

// Utilities
async function isGitAvailable(): Promise<boolean>
async function getGitRelativePath(absolutePath: string): Promise<string | null>
```

**Notes:**
- All git commands executed from git root
- Returns null if git unavailable (graceful degradation)
- File paths must be relative to git root

---

## Metrics Store

**File:** `apps/tui/src/mem/core/metrics-store.ts`

### Types

```typescript
interface MetricsSnapshot {
  // Meta
  id: string;
  timestamp: string;
  commit: string;

  // Metrics
  totalSymbols: number;
  totalFiles: number;
  avgComplexity: number;
  avgSymbolsPerFile: number;
  documentationCoverage: number;
  deadCodeCount: number;
  duplicateSymbolCount: number;

  // Serialized arrays
  topComplexSymbols: string;  // JSON
  godSymbols: string;         // JSON

  // Computed
  healthScore: number;        // 0-100

  // Trends
  complexityTrend?: "up" | "down" | "stable";
  deadCodeTrend?: "up" | "down" | "stable";
  docCoverageTrend?: "up" | "down" | "stable";
}
```

### Functions

```typescript
// Initialize
async function initMetricsStore(): Promise<void>
async function metricsTableExists(): Promise<boolean>

// Capture snapshot
async function captureSnapshot(insights: CodeInsights, commit: string): Promise<void>

// Query
async function getLatestSnapshot(): Promise<MetricsSnapshot | null>
async function getSnapshotHistory(limit?: number): Promise<MetricsSnapshot[]>

// Cleanup
async function cleanOldSnapshots(daysToKeep?: number): Promise<number>
async function clearMetricsStore(): Promise<void>
```

**Health Score Formula:**
```
Base: 100
- Complexity penalty: max -30 (avgComplexity > 15)
- Documentation penalty: max -25 (coverage < 0.3)
- Dead code penalty: max -20 (ratio > 0.1)
- Duplicate penalty: max -15 (ratio > 0.1)
- God symbols penalty: max -10 (count > 10)
= Final Score (0-100)
```

---

## Trends Analysis

**File:** `apps/tui/src/mem/core/trends.ts`

### Types

```typescript
type TrendType = "improving" | "degrading" | "stable" | "volatile";

interface TrendAnalysis {
  current: number;
  previous: number;
  change: number;           // Percent change
  changeAbsolute: number;
  min: number;
  max: number;
  velocity: number;         // Average rate of change
  prediction?: number;      // Linear regression
  trend: TrendType;
}

interface TrendsReport {
  period: string;
  totalSymbols: TrendAnalysis;
  avgComplexity: TrendAnalysis;
  documentationCoverage: TrendAnalysis;
  deadCodeCount: TrendAnalysis;
  duplicateSymbolCount: TrendAnalysis;
  healthScore: TrendAnalysis;
  anomalies: string[];
  recommendations: string[];
}
```

### Functions

```typescript
// Build report from snapshots
function buildTrendsReport(snapshots: MetricsSnapshot[]): TrendsReport

// Formatting
function formatTrend(trend: TrendAnalysis, unit?: string): string
function getTrendsSummary(report: TrendsReport): string
```

**Trend Classification:**
- `improving`: >5% change in better direction
- `degrading`: >5% change in worse direction
- `stable`: <5% change
- `volatile`: stdDev > 30% of mean

**Anomaly Detection:**
- Complexity spike: >20% change
- Dead code spike: >50% increase
- Health score drop: -15 points

---

## Risk Analysis

**File:** `apps/tui/src/mem/core/risk-analysis.ts`

### Types

```typescript
interface BugRiskScore {
  score: number;                    // 0-100
  riskLevel: "low" | "medium" | "high" | "critical";

  // Component scores (0-1)
  complexityScore: number;
  changeFrequencyScore: number;
  authorChurnScore: number;
  lineCountScore: number;
  testCoverageScore: number;
  documentationScore: number;
}

interface CodeResultWithRisk {
  chunk: CodeResult;
  risk: BugRiskScore;
}
```

### Functions

```typescript
// Compute risk
function computeBugRiskScore(chunk: CodeResult, testCoveragePercent?: number): BugRiskScore

// Find high risk
function findHighRiskSymbols(chunks: CodeResult[], limit?: number): CodeResultWithRisk[]

// Analysis
function getTopRiskFactors(risk: BugRiskScore): Array<{factor: string, score: number}>
function generateRiskRecommendations(risk: BugRiskScore): string[]

// Formatting
function formatRiskScore(risk: BugRiskScore): string

// Summary
interface RiskSummary {
  totalSymbols: number;
  avgRiskScore: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

function computeRiskSummary(riskySymbols: CodeResultWithRisk[]): RiskSummary
```

### Weights

```typescript
export const RISK_WEIGHTS = {
  complexity: 0.25,
  changeFrequency: 0.20,
  authorChurn: 0.15,
  lineCount: 0.15,
  testCoverage: 0.15,
  documentation: 0.10,
};
```

---

## Co-Change Analysis

**File:** `apps/tui/src/mem/core/co-change-analysis.ts`

### Types

```typescript
interface CoChangePair {
  file1: string;
  file2: string;
  changeCount: number;        // Times changed together
  support: number;            // 0-1, % of commits
  confidence: number;         // 0-1, P(file2 | file1)
  recentCommits: string[];    // Last 5 commits
}

interface CoChangeReport {
  totalCommits: number;
  pairs: CoChangePair[];
}
```

### Functions

```typescript
// Analyze git history
async function analyzeCoChange(
  daysBack?: number,         // Default: 90
  minSupport?: number,       // Default: 0.01 (1%)
  minConfidence?: number     // Default: 0.3 (30%)
): Promise<CoChangeReport>

// Query
function getRelatedFiles(targetFile: string, report: CoChangeReport): Array<{file: string, confidence: number}>

// Recommendations
function generateCoChangeRecommendations(file: string, report: CoChangeReport, topN?: number): string[]

// Formatting
function formatCoChangePair(pair: CoChangePair): string
```

**Algorithm:**
1. Extract git log (--name-only)
2. Build co-change matrix (file pairs in each commit)
3. Compute support = changeCount / totalCommits
4. Compute confidence = changeCount / file1Changes
5. Filter by thresholds

---

## Pattern Detection

**File:** `apps/tui/src/mem/core/pattern-detection.ts`

### Types

```typescript
interface DetectedPattern {
  pattern: "Singleton" | "Factory" | "Observer" | "Builder" |
           "HOC" | "RenderProps" | "CompoundComponents" | "CustomHook";
  type: "architectural" | "react";
  symbol: string;
  path: string;
  confidence: number;      // 0-1
  description: string;
}

interface DetectedAntiPattern {
  antiPattern: "MagicNumbers" | "LongParameterList" | "DeepNesting" |
               "GodClass" | "LongMethod" | "DuplicateCode";
  symbol: string;
  path: string;
  severity: "low" | "medium" | "high";
  confidence: number;
  description: string;
}

interface PatternDetectionReport {
  patterns: DetectedPattern[];
  antiPatterns: DetectedAntiPattern[];
}
```

### Functions

```typescript
// Detect all patterns
function detectPatterns(chunks: CodeResult[]): PatternDetectionReport

// Formatting
function formatPattern(pattern: DetectedPattern): string
function formatAntiPattern(antiPattern: DetectedAntiPattern): string
```

### Detection Heuristics

**Singleton:**
- Private constructor/static
- getInstance method
- Static instance field
- Min confidence: 0.5

**Factory:**
- Name contains "factory" or "create"
- Returns new instances
- Switch/if for type selection
- Min confidence: 0.5

**Custom Hook:**
- Name starts with "use"
- Contains React hooks
- Confidence: 0.9 (high precision)

**Magic Numbers:**
- >3 numbers in code
- Excludes common values (0, 1, 100, 1000)
- Confidence: 0.7

**Long Parameters:**
- >5 parameters from metadata
- Confidence: 0.9

**Deep Nesting:**
- >6 levels of indentation
- Auto-detects indent size (2 or 4 spaces)
- Confidence: 0.8

---

## Enriched Embeddings

**File:** `apps/tui/src/mem/core/enriched-embedding.ts`

### Functions

```typescript
// Build enriched embedding text
async function buildEnrichedEmbeddingText(
  sym: CodeSymbol,
  includeGraphContext?: boolean
): Promise<string>

// Sync version (no graph context)
function buildSimpleEmbeddingText(sym: CodeSymbol): string

// Batch processing
async function buildEnrichedEmbeddingsForSymbols(
  symbols: CodeSymbol[],
  includeGraph?: boolean
): Promise<string[]>
```

**Structure:**
```
type name
file: path/to/file.ts
directory: path/to
signature: async function myFunc(x: number): Promise<void>
docs: JSDoc content
used by: caller1, caller2, caller3
calls: callee1, callee2, callee3
[code body]
```

**Max length:** 4000 characters

---

## Multi-Signal Ranking

**File:** `apps/tui/src/mem/core/ranking.ts`

### Types

```typescript
interface RankingSignals {
  vectorScore: number;          // 0-1
  ftsScore: number;             // 0-1
  exactMatchScore: number;      // 0-1
  popularityScore: number;      // 0-1
  freshnessScore: number;       // 0-1
  complexityScore: number;      // 0-1
  contextScore: number;         // 0-1
}

interface RankedResult {
  chunk: CodeResult;
  finalScore: number;           // Weighted sum
  signals: RankingSignals;
}

interface SearchContext {
  currentFile?: string;
  currentDirectory?: string;
}
```

### Functions

```typescript
// Compute signals
async function computeRankingSignals(
  chunk: CodeResult,
  query: string,
  vectorScore: number,
  ftsScore: number,
  context?: SearchContext
): Promise<RankingSignals>

// Compute final score
function computeFinalScore(signals: RankingSignals): number

// Re-rank results
async function rerankSearchResults(
  results: Array<{chunk: CodeResult, score: number}>,
  query: string,
  context?: SearchContext
): Promise<RankedResult[]>
```

### Weights

```typescript
export const RANKING_WEIGHTS = {
  vectorScore: 0.35,
  ftsScore: 0.20,
  exactMatch: 0.15,
  popularityScore: 0.15,
  freshnessScore: 0.05,
  complexityScore: 0.05,
  contextScore: 0.05,
};
```

---

## Integration Points

### Automatic Triggers

**After code indexing:**
1. Graph edges created/updated (code-store.ts)
2. PageRank cache invalidated (graph-store.ts)
3. Metrics snapshot captured (index-code.ts)
4. Insights cache invalidated (code-store.ts)

**During search:**
1. Vector search executed (embedder.ts)
2. FTS search executed (code-store.ts)
3. Results ranked with multi-signal (ranking.ts)
4. PageRank scores applied (cached)

**Manual triggers:**
- `yep trends` - trends analysis
- Risk/pattern/co-change APIs - on-demand

### Cache Management

**PageRank:** 5-minute in-memory cache, invalidated on insert/delete
**Insights:** Per-session cache, invalidated on insert/delete
**Metrics:** Persistent in LanceDB, no cache
**Co-Change:** No cache, computes on-demand

### Error Handling

All modules use graceful degradation:
- Git unavailable → no git metadata (continues)
- Graph unavailable → no PageRank boost (continues)
- Metrics unavailable → no trends (continues)

No critical failures from analytics features.
