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
| `yep` | Interactive TUI |

### Automatic Code Indexing

Code indexing is fully automatic — you never need to run it manually:

- **`yep sync`** indexes code after syncing sessions (post-commit hook)
- **`yep enable`** runs initial code index during setup
- **`yep gui`** re-indexes in background when stale

Supports TypeScript, JavaScript, Python, Go, Rust. Extracts functions, classes, interfaces, types, React components with call graphs and import tracking. Incremental — only re-indexes files changed since the last commit.

### Web GUI

```bash
yep gui              # opens http://localhost:3838
yep gui --port 4000  # custom port
```

Dashboard with search, code browser, sync, file timeline, settings, and **code insights** — dead code detection, most connected symbols, complexity hotspots, language/type distribution.

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

**Session indexing** — parse Entire checkpoints → chunk into prompt/response pairs with diffs → LLM summaries → embed → store in LanceDB. Local sessions tracked by content hash (updated, not duplicated).

**Code indexing** — walk project files → regex-based symbol extraction with call/import graphs → embed → store in separate `code_symbols` table. Incremental by git commit.

**Retrieval** — embed query → vector + full-text search in parallel → reciprocal rank fusion → rerank (recency, file overlap, keyword density, symbol matching) → deduplicate (cosine >0.95) → top-K results.

## Architecture

```text
.yep-mem/
├── vectors/         LanceDB (solutions + code_symbols tables)
├── cache/           Embedding + search result caches
├── eval/            Golden question set for quality eval
└── config.json      Provider, models, sync state
```

## Built With

[LanceDB](https://lancedb.com) · [AI SDK](https://ai-sdk.dev) · [Entire](https://entire.io) · [Ollama](https://ollama.com) · [MCP](https://modelcontextprotocol.io) · [Lefthook](https://github.com/evilmartians/lefthook) · [Bun](https://bun.sh)

---

<details>
<summary>Monorepo development</summary>

```text
yep/
├── apps/
│   ├── desktop/     React web GUI (Vite + TailwindCSS)
│   └── tui/         CLI + MCP server + API (Bun + Hono + LanceDB)
├── bin/yep          Entry point
└── scripts/
    └── install.sh   Installer
```

```bash
bun install
bun run dev           # all apps
bun run build:gui     # build GUI assets into apps/tui/gui-dist
```

Code quality: `bun x ultracite fix` (Biome).

</details>
