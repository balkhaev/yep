# yep

Persistent memory for AI coding agents. Every session, every symbol — searchable.

Built on [Entire](https://entire.io) for session capture, [LanceDB](https://lancedb.com) for vector search, [MCP](https://modelcontextprotocol.io) for agent integration.

```text
  you code with an agent
           ↓
  Entire captures the session as a Git checkpoint
           ↓
  post-commit hook triggers yep sync
           ↓
  transcripts → summaries → embeddings → vector store
  code files → symbols → embeddings → code index
           ↓
  next task: agent calls search_all via MCP
           ↓
  relevant sessions + code → agent context
```

## Quick Start

```bash
bunx yep-mem enable
```

```bash
npx yep-mem enable        # npm
pnpm dlx yep-mem enable   # pnpm
```

This does everything: creates the vector store, enables Entire, sets up the post-commit hook, registers the MCP server in Cursor, installs agent rules, indexes existing checkpoints and code symbols. After this, memory works automatically.

### Providers

**OpenAI** (default) — requires `OPENAI_API_KEY` (env, `.yep-mem/config.json`, or `.cursor/mcp.json`).

**Ollama** (local, free) — no API key, fully offline:

```bash
ollama pull nomic-embed-text && ollama pull llama3.1:8b
YEP_PROVIDER=ollama bunx yep-mem enable
```

| | OpenAI | Ollama |
|---|---|---|
| Embedding | `text-embedding-3-small` (1536d) | `nomic-embed-text` (768d) |
| Summarizer | `gpt-4o-mini` | `llama3.1:8b` |
| API key | Required | No |

## Commands

| Command | Description |
|---|---|
| `yep enable` | Full setup: vector store, hooks, MCP, agent rules, initial index |
| `yep sync` | Index new checkpoints + re-index changed code (auto via post-commit) |
| `yep index-code` | Index code symbols (functions, classes, types) |
| `yep search "..."` | Search past solutions |
| `yep context "..."` | Output context for piping into prompts |
| `yep diff <file>` | Memory timeline for a file |
| `yep watch` | Auto-sync on file changes |
| `yep status` | Health check: chunks, config, sync state |
| `yep reset` | Drop vector store (`--reindex` to rebuild) |
| `yep serve` | Start MCP server (auto-started by Cursor) |
| `yep api` | Start HTTP API server |
| `yep gui` | Web dashboard in the browser |
| `yep eval` | Search quality A/B evaluation |
| `yep debug` | Debug tools for code index and search |
| `yep` | Interactive TUI |

### Automatic Code Indexing

Code indexing is fully automatic — you never need to run it manually:

- **`yep sync`** indexes code after syncing sessions (post-commit hook)
- **`yep enable`** runs initial code index during setup
- **`yep gui`** re-indexes in background when stale

Supports TypeScript, JavaScript, Python, Go, Rust. Uses the **TypeScript Compiler API** for TS/JS/TSX/JSX files (exact AST parsing), with a regex fallback for other languages. Extracts functions, classes, interfaces, types, React components with call graphs and import tracking. Incremental — only re-indexes files changed since the last commit.

### Desktop App

A native desktop app built with [Tauri 2](https://tauri.app):

```bash
cd apps/desktop
bun run tauri:dev     # development
bun run tauri:build   # production build
```

Dashboard with search, code browser, sync, file timeline, settings, and **code insights** — dead code detection, most connected symbols, complexity hotspots, language/type distribution.

### Web GUI

```bash
yep gui              # opens http://localhost:3838
yep gui --port 4000  # custom port
```

Same interface as the desktop app, served directly from the CLI.

## MCP Tools

Agents in Cursor (or any MCP client) get these tools automatically:

| Tool | What it does |
|---|---|
| `search_solutions` | Find relevant past sessions. Hybrid search (vector + BM25 + RRF) with reranking. |
| `search_all` | Unified search across sessions AND code symbols. |
| `symbol_context` | 360° view: definition, callers, callees, importers, related sessions. |
| `detect_changes` | Git diff → affected symbols → blast radius → related sessions. |
| `mem_stats` | Vector store health, chunk count, code index stats. |

Resources: `memory://summary`, `memory://symbols`, `memory://files`, `memory://recent`

Prompts: `pre_task` (search before work), `pre_commit` (check blast radius before commit)

Agent rules are installed at `.cursor/rules/yep-memory.mdc` — agents automatically search memory before tasks, check symbol context before edits, detect changes before commits.

## How It Works

**Session indexing** — parse Entire checkpoints → chunk into prompt/response pairs with diffs → LLM summaries → embed → store in LanceDB. Local sessions tracked by content hash (updated, not duplicated). Sync is protected by a file-based lock to prevent concurrent corruption.

**Code indexing** — walk project files → TypeScript Compiler API for TS/JS (regex fallback for Python/Go/Rust) → symbol extraction with call/import graphs → embed → store in separate `code_symbols` table. Incremental by git commit.

**Retrieval** — embed query → vector + full-text search in parallel → reciprocal rank fusion → rerank (recency, file overlap, keyword density, symbol matching) → deduplicate (cosine >0.95) → top-K results.

**Error handling** — structured logging with levels and module context, exponential backoff with jitter for embedding API retries, retryable error detection (rate limits, timeouts, 5xx).

## Architecture

```text
yep/
├── apps/
│   ├── desktop/          Tauri 2 desktop app (React 19, TailwindCSS, TanStack Query)
│   ├── tui/              CLI + MCP server + HTTP API (Bun, Hono, LanceDB)
│   └── server/           AI inference server (Hono, Gemini)
├── packages/
│   ├── config/           Shared TypeScript configuration
│   ├── db/               Prisma client (libSQL/Turso)
│   └── env/              Environment variable validation (Zod)
└── .github/
    └── workflows/        CI (lint, types, test, build) + Release (npm + Tauri)
```

```text
.yep-mem/
├── vectors/         LanceDB (solutions + code_symbols tables)
├── cache/           Embedding + search result caches
├── eval/            Golden question set for quality eval
├── sync.lock        File lock for sync atomicity
└── config.json      Provider, models, sync state
```

## Built With

[LanceDB](https://lancedb.com) · [AI SDK](https://ai-sdk.dev) · [Entire](https://entire.io) · [Ollama](https://ollama.com) · [MCP](https://modelcontextprotocol.io) · [Tauri](https://tauri.app) · [TanStack Query](https://tanstack.com/query) · [Bun](https://bun.sh) · [Turborepo](https://turbo.build)

---

<details>
<summary>Development</summary>

```bash
bun install
bun run dev           # all apps
bun run build         # build everything
bun run test          # run all tests
bun run build:gui     # build GUI assets into apps/tui/gui-dist
bun run check         # lint (Biome via Ultracite)
bun run fix           # auto-fix lint issues
```

### Testing

```bash
bun run test                        # all tests via Turborepo
cd apps/tui && bun test src/        # TUI tests only
```

67 unit tests covering core modules: code chunker, chunker, cache, store utilities, file locking.

### Releasing

Releases are automated via GitHub Actions:

1. Tag a version: `git tag v0.2.0 && git push --tags`
2. CI publishes `yep-mem` to npm
3. CI builds Tauri desktop binaries for macOS (arm64 + x64), Linux, Windows
4. Draft GitHub release is created with binaries attached

The desktop app includes auto-update support via the Tauri updater plugin.

### Code Quality

- **Biome** + **Ultracite** for linting and formatting
- **Lefthook** pre-commit hooks
- **Strict TypeScript** (`strictNullChecks`, `noUncheckedIndexedAccess`)
- **Dependabot** for automated dependency updates

</details>
