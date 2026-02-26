# Advanced Features

Расширенные возможности YEP для анализа и мониторинга качества кода.

## Graph Dependencies & PageRank

**Граф зависимостей** отслеживает связи между символами кода (вызовы, импорты, наследование).

**PageRank** вычисляет популярность символов на основе количества вызовов:
- Высокий PageRank = много входящих связей = критичный символ
- Используется в ranking для повышения релевантности поиска

**API:**
```typescript
import { getIncomingEdges, getOutgoingEdges } from "./core/graph-store.ts";
import { computePageRank } from "./core/pagerank.ts";

// Кто вызывает этот символ
const callers = await getIncomingEdges("myFunction", "calls");

// Кого вызывает этот символ
const callees = await getOutgoingEdges("myFunction", "calls");

// PageRank для всех символов
const scores = await computePageRank(); // Map<symbol, score>
```

**Storage:** LanceDB таблица `code_graph` с GraphEdge записями.

---

## Git Metadata Integration

Автоматическое извлечение git истории для каждого символа при индексации.

**Данные:**
- `gitChangeCount` - количество изменений
- `gitAuthorCount` - количество уникальных авторов
- `gitLastChangeDate` - дата последнего изменения

**Использование:**
```typescript
// Данные доступны в CodeResult после индексации
const results = await searchCode("myFunction");
const result = results[0];

console.log(`Changes: ${result.chunk.gitChangeCount}`);
console.log(`Authors: ${result.chunk.gitAuthorCount}`);
console.log(`Last change: ${result.chunk.gitLastChangeDate}`);
```

**Применение:** bug risk scoring, freshness ranking, team collaboration analysis.

---

## Metrics Snapshots & Trends

Автоматическое сохранение снапшотов метрик после каждой индексации.

**Health Score (0-100):**
- Complexity penalty (max -30)
- Documentation penalty (max -25)
- Dead code penalty (max -20)
- Duplicate code penalty (max -15)
- God symbols penalty (max -10)

**Trend Detection:**
- `improving` - метрика улучшается (>5% change)
- `degrading` - метрика ухудшается
- `stable` - изменение <5%
- `volatile` - высокая волатильность (stdDev >30%)

**CLI:**
```bash
yep trends           # За последние 30 дней
yep trends --days=90 # За последние 90 дней
```

**API:**
```typescript
import { getSnapshotHistory } from "./core/metrics-store.ts";
import { buildTrendsReport } from "./core/trends.ts";

const snapshots = await getSnapshotHistory(30);
const report = buildTrendsReport(snapshots);

console.log(`Health trend: ${report.healthScore.trend}`);
console.log(`Recommendations: ${report.recommendations.length}`);
```

**Storage:** LanceDB таблица `code_metrics` с MetricsSnapshot записями.

---

## Bug Risk Scoring

Предиктивный анализ рисков багов на основе 6 факторов.

**Risk Factors:**
- Complexity (25%) - высокая сложность
- Change Frequency (20%) - частые изменения
- Author Churn (15%) - много авторов
- Line Count (15%) - большой размер
- Test Coverage (15%) - низкое покрытие
- Documentation (10%) - отсутствие документации

**Risk Levels:**
- 🟢 Low (0-40)
- 🟡 Medium (40-60)
- 🟠 High (60-80)
- 🔴 Critical (80-100)

**API:**
```typescript
import { computeBugRiskScore, findHighRiskSymbols } from "./core/risk-analysis.ts";

// Для одного символа
const risk = computeBugRiskScore(codeResult);
console.log(`Risk: ${risk.score}/100 (${risk.riskLevel})`);

// Топ рисковых символов
const highRisk = findHighRiskSymbols(allSymbols, 20);
for (const { chunk, risk } of highRisk) {
  console.log(`${chunk.symbol}: ${risk.score}/100`);
}
```

**Рекомендации:** автоматически генерируются для каждого высокого риска.

---

## Co-Change Analysis

Анализ файлов меняющихся вместе (temporal coupling).

**Метрики:**
- **Support** - процент коммитов где оба файла менялись
- **Confidence** - P(file2 changes | file1 changes)

**API:**
```typescript
import { analyzeCoChange, getRelatedFiles } from "./core/co-change-analysis.ts";

// Анализ за 90 дней
const report = await analyzeCoChange(90, 0.01, 0.3);

// Файлы связанные с данным
const related = getRelatedFiles("src/api.ts", report);
for (const { file, confidence } of related) {
  console.log(`${file}: ${(confidence * 100).toFixed(0)}% confidence`);
}
```

**Применение:** code review рекомендации, test priority, refactoring decisions.

---

## Pattern Detection

Heuristic-based обнаружение паттернов и anti-patterns.

**Architectural Patterns:**
- 🏗️ Singleton, Factory, Observer, Builder

**React Patterns:**
- ⚛️ HOC, Render Props, Compound Components, Custom Hooks

**Anti-Patterns:**
- 🔴 Long Parameter List (>5 params)
- 🟡 Deep Nesting (>6 levels)
- 🟡 Magic Numbers

**API:**
```typescript
import { detectPatterns } from "./core/pattern-detection.ts";

const report = detectPatterns(codeSymbols);

console.log(`Patterns: ${report.patterns.length}`);
console.log(`Anti-patterns: ${report.antiPatterns.length}`);

for (const pattern of report.patterns) {
  console.log(`${pattern.pattern} in ${pattern.symbol} (${pattern.confidence})`);
}
```

**Применение:** code review, architecture documentation, refactoring opportunities.

---

## Multi-Signal Ranking

7-сигнальная система ранжирования для поиска.

**Signals:**
- Vector similarity (35%)
- Full-text search (20%)
- Exact match (15%)
- Popularity/PageRank (15%)
- Freshness (5%)
- Complexity (5%)
- Context proximity (5%)

**Автоматическая интеграция:** все поиски используют multi-signal ranking.

**Exact Match Variants:**
- Full match (1.0)
- Prefix match (0.8)
- Contains match (0.5)
- CamelCase initials (0.6)

---

## Performance

**Indexing:**
- Git metadata: +10-15% время индексации
- Metrics snapshot: +2-3% время индексации
- Overall: ~15% медленнее но с значительно больше данных

**Search:**
- Multi-signal ranking: +5ms latency
- PageRank computation: кэшируется (5 мин TTL)
- Risk scoring: on-demand (не влияет на поиск)

**Storage:**
- code_graph: ~100 bytes/edge
- code_metrics: ~2KB/snapshot
- Monthly: ~60KB snapshots (1 snapshot/day)

---

## Best Practices

**Git Metadata:**
- Требует git репозиторий
- Относительные пути от git root
- Graceful degradation если git недоступен

**Metrics Snapshots:**
- Автоматический capture после индексации
- Cleanup старых снапшотов (>90 дней)
- Use trends для отслеживания прогресса

**Risk Analysis:**
- Focus на critical/high risk символы
- Apply рекомендации приоритетно
- Re-index после рефакторинга для обновления scores

**Co-Change Analysis:**
- Минимум 30 дней истории для значимых результатов
- Adjust support/confidence thresholds под размер проекта
- Use при планировании рефакторинга больших модулей

**Pattern Detection:**
- Heuristics могут давать false positives
- Проверяйте confidence scores
- Use как starting point для code review
