# yep

Persistent memory for AI coding agents.

Your agent solves a problem, explains its reasoning, writes the code, and moves on. Next week you hit something similar — and the agent starts from zero. All that context is gone.

yep fixes this. It builds on [Entire](https://entire.io) — a tool that silently records every AI coding session (prompts, responses, tool calls, diffs) and stores them as structured checkpoints in Git. yep takes those checkpoints and turns them into a searchable knowledge base: it parses the transcripts, generates LLM summaries, embeds them into vectors, and indexes everything into a local [LanceDB](https://lancedb.com) store. No server, no cloud — just a directory in your repo.

The loop closes through [MCP](https://modelcontextprotocol.io). Before starting any task, your agent calls `search_solutions` and gets the most relevant past sessions injected into its context. Hybrid search (vector + full-text with reciprocal rank fusion) finds matches by meaning and keywords. Deduplication ensures you get diverse results. The agent learns from itself.

```text
  you code with an agent
           ↓
  Entire captures the full session as a Git checkpoint
           ↓
  post-commit hook triggers yep sync
           ↓
  transcripts → LLM summaries → embeddings → local vector store
           ↓
  next task: agent calls search_solutions via MCP
           ↓
  top 5 relevant past solutions → agent context
           ↓
  agent starts with knowledge, not from scratch
```

One install, zero config, fully local. Works with OpenAI or entirely offline with [Ollama](https://ollama.com).

## Getting Started

```bash
bunx yep-mem enable
```

Run this inside any project. It does everything:

- Creates `.yep-mem/` with a LanceDB vector store
- Runs `entire enable` to start capturing sessions
- Adds a `post-commit` hook (Lefthook) for auto-indexing
- Registers the MCP server in `.cursor/mcp.json`
- Syncs existing checkpoints if any are found
- Auto-detects Ollama if no OpenAI key is found

### Provider Configuration

yep supports two providers:

**OpenAI (default)** — best quality, requires API key:

```bash
export OPENAI_API_KEY=sk-...
yep enable
```

The key is resolved from: `OPENAI_API_KEY` env var → `.yep-mem/config.json` → `.cursor/mcp.json`.

**Ollama (local)** — zero cost, fully offline, no API key needed:

```bash
ollama pull nomic-embed-text
ollama pull llama3.1:8b
YEP_PROVIDER=ollama yep enable
```

Or switch an existing setup by editing `.yep-mem/config.json`:

```json
{
  "provider": "ollama",
  "embeddingModel": "nomic-embed-text",
  "summarizerModel": "llama3.1:8b"
}
```

After switching providers, run `yep reset --reindex` to rebuild the vector store.

| Setting | OpenAI (default) | Ollama |
| --- | --- | --- |
| Embedding model | `text-embedding-3-small` | `nomic-embed-text` |
| Summarizer model | `gpt-4o-mini` | `llama3.1:8b` |
| Vector dimensions | 1536 | 768 |
| Requires API key | Yes | No |
| Requires Ollama | No | Yes (`ollama serve`) |

## Commands

| Command | Description |
| --- | --- |
| `yep enable` | Activate Entire + vector memory in this repo |
| `yep sync` | Index new checkpoints into the vector store |
| `yep search "query"` | Search past solutions by semantic similarity |
| `yep context "query"` | Output relevant context for piping into prompts |
| `yep diff <file>` | Show memory timeline for a specific file |
| `yep watch` | Auto-sync on file changes (fs.watch) |
| `yep status` | Show indexed chunks, config health, sync state |
| `yep reset` | Drop the vector store (`--reindex` to rebuild) |
| `yep serve` | Start MCP server on stdio (auto-started by Cursor) |
| `yep` | Launch the interactive TUI |

### `yep context` — inject memory into prompts

```bash
yep context "add auth middleware" >> system_prompt.md
```

Or use it in Cursor rules:

```text
# .cursor/rules/memory.mdc
Before starting any task, run: yep context "<task description>"
Include the output in your context.
```

### `yep diff` — file history from memory

```bash
yep diff src/auth.ts
```

Shows a timeline of all sessions that touched a file — what was done, when, and by which agent.

### `yep watch` — real-time sync

```bash
yep watch
```

Monitors `.entire/metadata/` for changes and auto-syncs with debouncing. No need to wait for commits — the agent gets fresh context mid-session.

## MCP Integration

Agents in Cursor (or any MCP-compatible client) get two tools and one resource:

**`search_solutions`** — find relevant past sessions before starting work.

```text
query       string       What you're trying to solve
top_k       number       Results to return (default: 5)
agent       string?      Filter by agent type
files       string[]?    Filter by files involved
```

Uses hybrid search (vector similarity + full-text BM25) with reciprocal rank fusion, plus post-retrieval deduplication to ensure diverse results.

**`mem_stats`** — check vector store health, indexed chunk count, and top files.

**`memory://summary`** — MCP resource providing a project memory overview (indexed chunks, active agents, most-touched files). Agents that support MCP resources get this automatically.

The server starts automatically when Cursor reads `.cursor/mcp.json`. For manual use: `yep serve`.

## How It Works

### Indexing Pipeline

1. **Parse** — read checkpoints from `entire/checkpoints/v1` branch and `.entire/metadata/` local sessions
2. **Chunk** — split transcripts into prompt/response pairs with associated diffs and file lists
3. **Summarize** — generate 2-3 sentence LLM summaries per chunk (search representation)
4. **Embed** — vectorize summaries with the configured embedding model
5. **Store** — insert into LanceDB with full-text index for hybrid search

Active local sessions are tracked by content hash — partial transcripts get updated as they grow, not duplicated.

### Retrieval

1. **Embed** the query
2. **Vector search** + **full-text search** in parallel
3. **Reciprocal rank fusion** to merge results
4. **Deduplication** — drop results with >0.95 cosine similarity
5. Return top-K diverse, relevant chunks with summaries and source context

## Built With

- **[LanceDB](https://lancedb.com)** — embedded vector DB, HNSW index, native FTS
- **[AI SDK](https://ai-sdk.dev)** — embeddings and summarization
- **[Entire](https://entire.io)** — session capture as Git checkpoints
- **[Ollama](https://ollama.com)** — optional local model inference
- **[MCP](https://modelcontextprotocol.io)** — stdio transport for agent integration
- **[Lefthook](https://github.com/evilmartians/lefthook)** — post-commit auto-sync
- **[Bun](https://bun.sh)** — runtime

---

<details>
<summary>Monorepo details</summary>

## Project Structure

```text
yep/
├── apps/
│   ├── native/      React Native + Expo mobile app
│   ├── server/      Hono API server
│   └── tui/         Terminal UI + yep CLI (agent memory)
├── packages/
│   ├── config/      Shared configuration
│   ├── db/          Prisma schema, migrations, client
│   └── env/         Environment variable validation
├── bin/yep          CLI entry point
└── scripts/
    └── install.sh   Installer
```

## Development

```bash
bun install
bun run dev
```

Web app at [localhost:3001](http://localhost:3001), API at [localhost:3000](http://localhost:3000), mobile via Expo Go.

## Database

SQLite with Prisma. Update `.env` in `apps/server` with connection details.

```bash
bun run db:local       # Start local SQLite (optional)
bun run db:push        # Apply schema
```

## Scripts

| Script | Description |
| --- | --- |
| `bun run dev` | Start all apps in development mode |
| `bun run build` | Build all apps |
| `bun run dev:native` | Start React Native / Expo dev server |
| `bun run dev:server` | Start only the Hono API server |
| `bun run check-types` | TypeScript type checking across all apps |
| `bun run check` | Run Biome formatting and linting |
| `bun run fix` | Auto-fix Biome issues |
| `bun run db:push` | Push schema changes to database |
| `bun run db:generate` | Generate Prisma client / types |
| `bun run db:migrate` | Run database migrations |
| `bun run db:studio` | Open Prisma Studio UI |

## Stack

TypeScript, Hono, React Native + Expo, TailwindCSS + shadcn/ui, Prisma + SQLite/Turso, Turborepo, Biome via [Ultracite](https://github.com/haydenbleasel/ultracite), Bun.

</details>
