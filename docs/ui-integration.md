# UI Integration Guide

## Обзор

Все расширенные функции аналитики кода (Фазы 7-12) полностью интегрированы в пользовательские интерфейсы YEP:
- **TUI** (Terminal User Interface) - текстовый интерфейс
- **Desktop GUI** - графическое приложение на Tauri

## TUI Integration

### Новые вкладки в Insights View

Добавлены 4 новые вкладки в `/apps/tui/src/tui/views/InsightsView.tsx`:

1. **Trends** - Визуализация трендов метрик
2. **Risk** - Bug risk analysis с высокорисковыми символами
3. **Patterns** - Обнаруженные паттерны и anti-patterns
4. **Co-Change** - Temporal coupling analysis

### Компоненты

Все компоненты находятся в `/apps/tui/src/tui/views/insights/`:

- `TrendsTab.tsx` - ASCII визуализация трендов, emoji индикаторы
- `RiskTab.tsx` - Таблица high-risk symbols с факторами риска
- `PatternsTab.tsx` - Список паттернов с confidence scores
- `CoChangeTab.tsx` - Пары файлов с coupling strength

### Навигация

Переключение между вкладками: `←/→` стрелки

Каждая вкладка загружает данные через API endpoints:
```
GET /api/trends?days=30
GET /api/risk-analysis?limit=20
GET /api/patterns
GET /api/co-change?days=90
```

## Desktop GUI Integration

### Новые компоненты

Созданы полноценные React компоненты в `/apps/desktop/src/components/insights/`:

#### 1. TrendsTab.tsx
**Функции:**
- Карточки метрик с area charts (Health Score, Complexity, Documentation, Dead Code)
- Combined LineChart с метриками за период
- Trend indicators (Improving/Degrading/Stable/Volatile)
- Anomaly detection alerts
- Predictions (если доступны)

**Технологии:**
- Recharts (LineChart, AreaChart)
- React Query для загрузки данных
- Framer Motion для анимаций

**Визуализации:**
```tsx
- 4 MetricCard с mini area charts
- 1 Combined LineChart (health, documentation, complexity)
- Color-coded trends (green=improving, red=degrading, amber=volatile)
```

#### 2. RiskTab.tsx
**Функции:**
- Summary cards (Critical/High/Medium/Low/Average)
- Top risk factors с progress bars
- Список high-risk symbols с детализацией
- Top 3 contributing factors для каждого символа

**Цветовая схема:**
- Critical: red-500
- High: orange-500
- Medium: amber-500
- Low: emerald-500

**Факторы риска (с весами):**
```
Complexity (25%)
Change Frequency (20%)
Author Churn (15%)
Line Count (15%)
Test Coverage (15%)
Documentation (10%)
```

#### 3. PatternsTab.tsx
**Функции:**
- Summary cards (Good Patterns, Anti-Patterns, Architectural, React)
- Список обнаруженных паттернов с confidence bars
- Список anti-patterns с рекомендациями
- Info box с объяснениями

**Detected Patterns:**
- Architectural: Singleton 🔒, Factory 🏭, Observer 👁️, Builder 🔨, etc.
- React: Custom Hook 🪝, HOC ⚛️, Render Props 📦, Compound Component 🧩

**Anti-Patterns:**
- Magic Numbers 🔢
- Long Parameter List 📝
- Deep Nesting 📐
- God Object 👑

#### 4. CoChangeTab.tsx
**Функции:**
- Header с total commits
- Statistics cards (Total Pairs, Very Strong, Strong, Moderate)
- Список coupling pairs с confidence bars
- Info box с рекомендациями

**Coupling Levels:**
- Very Strong (>80%): red - critical coupling, требует рефакторинга
- Strong (>60%): orange - review coupled files при изменениях
- Moderate (>40%): amber - учитывать при тестировании

**Метрики:**
```
Support = changeCount / totalCommits
Confidence = changeCount / file1Changes
```

### Интеграция в Insights.tsx

Обновлён `/apps/desktop/src/pages/Insights.tsx`:

```tsx
import TrendsTab from "@/components/insights/TrendsTab";
import RiskTab from "@/components/insights/RiskTab";
import PatternsTab from "@/components/insights/PatternsTab";
import CoChangeTab from "@/components/insights/CoChangeTab";

// Render:
{activeTab === "trends" && <TrendsTab />}
{activeTab === "risk" && <RiskTab />}
{activeTab === "patterns" && <PatternsTab />}
{activeTab === "cochange" && <CoChangeTab />}
```

### Общие стили и компоненты

Все новые компоненты используют:

**UI Components:**
- `LoadingMessage` - loading state с spinner
- `FadeInUp` - fade-in animation wrapper
- Card layout (`className="card p-6"`)

**Charts:**
- Recharts библиотека (LineChart, AreaChart)
- Theme colors из `@/components/charts/theme`
- Glassmorphism tooltips (`TOOLTIP_STYLE_GLASS`)

**Responsive Design:**
```tsx
grid-cols-1 md:grid-cols-2 lg:grid-cols-4
// Mobile: 1 column
// Tablet: 2 columns
// Desktop: 4 columns
```

## API Endpoints

Все новые вкладки используют следующие API endpoints из `/apps/tui/src/mem/commands/api.ts`:

### GET /api/trends
**Query params:**
- `days` (optional, default: 30) - период анализа

**Response:**
```typescript
{
  period: { from: string, to: string, days: number },
  healthScore: TrendData,
  complexity: TrendData,
  documentation: TrendData,
  deadCode: TrendData,
  snapshots: MetricsSnapshot[]
}
```

### GET /api/risk-analysis
**Query params:**
- `limit` (optional, default: 20) - количество high-risk символов

**Response:**
```typescript
{
  highRiskSymbols: HighRiskSymbol[],
  summary: {
    totalSymbols: number,
    criticalCount: number,
    highCount: number,
    mediumCount: number,
    lowCount: number,
    avgRiskScore: number,
    topRiskFactors: { factor: string, avgScore: number }[]
  }
}
```

### GET /api/patterns
**Response:**
```typescript
{
  patterns: DetectedPattern[],
  antiPatterns: DetectedPattern[],
  summary: {
    totalPatterns: number,
    totalAntiPatterns: number,
    architecturalCount: number,
    reactCount: number
  }
}
```

### GET /api/co-change
**Query params:**
- `days` (optional, default: 90) - период git history

**Response:**
```typescript
{
  totalCommits: number,
  pairs: CoChangePair[]
}
```

## Запуск приложений

### TUI
```bash
cd apps/tui
bun run dev

# Или скомпилированная версия:
yep mem
```

Навигация: используйте клавиши 1-5 для переключения view, ←/→ для переключения табов в Insights.

### Desktop GUI
```bash
cd apps/desktop

# Development mode:
bun run tauri:dev

# Production build:
bun run tauri:build
```

Навигация: кликайте на вкладки в верхней части экрана.

## Обновление данных

Все вкладки используют React Query с автоматическим обновлением:
- **Trends**: каждые 30 секунд
- **Risk**: каждые 60 секунд
- **Patterns**: каждые 60 секунд
- **Co-Change**: каждые 2 минуты

Данные также обновляются при:
- Переключении вкладок
- Manual refresh (если реализовано)
- После выполнения `yep index-code`

## Troubleshooting

### Пустые вкладки

**Проблема:** Вкладки показывают "No data available"

**Решение:**
1. Убедитесь, что проект проиндексирован: `yep index-code`
2. Для Trends: требуется несколько snapshots. Запустите `yep index-code` несколько раз за несколько дней
3. Для Co-Change: требуется git история. Убедитесь, что проект находится в git репозитории с коммитами

### API errors

**Проблема:** Ошибки загрузки данных

**Решение:**
1. Убедитесь, что API сервер запущен (TUI автоматически запускает при старте)
2. Проверьте порт: по умолчанию `http://localhost:3838`
3. Проверьте логи API: они выводятся в консоль TUI

### Build errors

**Проблема:** Ошибки компиляции Desktop app

**Решение:**
```bash
cd apps/desktop
bun install  # Переустановить зависимости
rm -rf dist node_modules/.cache  # Очистить cache
bun run build  # Пересобрать
```

## Дальнейшее развитие

### Planned improvements:

1. **Interactive Dependency Graph** (Phase 14)
   - D3.js или React Flow визуализация графа зависимостей
   - Zoom, pan, node selection
   - Filter by file type, language, directory

2. **Health Dashboard** (Phase 14)
   - Centralized health score с breakdown
   - Recommendations widget
   - Quick actions (index, cleanup, etc.)

3. **Export functionality**
   - Export trends to CSV/JSON
   - Export risk report to Markdown
   - Export graph to GraphML

4. **Real-time updates**
   - WebSocket для real-time обновлений
   - Watch mode для автоматической переиндексации

5. **Customization**
   - Настраиваемые пороги для risk scoring
   - Кастомизация весов факторов риска
   - Пользовательские паттерны для детекции

## Архитектурные решения

### Разделение логики

- **Core logic** (`/apps/tui/src/mem/core/*`) - business logic, независимая от UI
- **API layer** (`/apps/tui/src/mem/commands/api.ts`) - HTTP endpoints
- **TUI components** (`/apps/tui/src/tui/views/*`) - terminal UI
- **Desktop components** (`/apps/desktop/src/components/*`) - React GUI

### State Management

- **TUI**: useState с локальным состоянием
- **Desktop**: React Query для server state + localStorage для client state

### Типизация

Общие типы определены в:
- `/apps/tui/src/tui/types.ts` - TUI types
- Inline types в Desktop компонентах (рассмотреть вынесение в shared package)

### Performance

- **Lazy loading**: Табы загружают данные только при активации
- **Caching**: React Query кэширует responses
- **Pagination**: Limit на количество возвращаемых записей
- **Debouncing**: Input filters с debounce

## Заключение

Все расширенные функции аналитики полностью доступны как в TUI, так и в Desktop GUI:

✅ **Trends analysis** - визуализация метрик во времени
✅ **Risk scoring** - предиктивный анализ багов
✅ **Pattern detection** - architectural & anti-patterns
✅ **Co-change analysis** - temporal coupling

Пользователи могут выбирать удобный интерфейс в зависимости от предпочтений:
- **TUI** - быстрый, легковесный, keyboard-driven
- **Desktop** - rich visualizations, mouse-driven, более детальный анализ

Оба интерфейса используют одинаковые API endpoints и core logic, обеспечивая consistent experience.
