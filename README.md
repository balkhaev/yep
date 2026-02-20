# yep

Persistent memory for AI coding agents.

Your agent solves a problem, explains its reasoning, writes the code, and moves on. Next week you hit something similar — and the agent starts from zero. All that context is gone.

yep fixes this. It builds on [Entire](https://entire.io) — a tool that silently records every AI coding session (prompts, responses, tool calls, diffs) and stores them as structured checkpoints in Git. yep takes those checkpoints and turns them into a searchable knowledge base: it parses the transcripts, splits them into semantic chunks, embeds them with OpenAI, and indexes everything into a local [LanceDB](https://lancedb.com) vector store. No server, no cloud — just a directory in your repo.

The loop closes through [MCP](https://modelcontextprotocol.io). Before starting any task, your agent calls `search_solutions` and gets the 5 most relevant past sessions injected into its context. It sees what worked, what was tried, which files were touched. The agent learns from itself.

```text
  you code with an agent
           ↓
  Entire captures the full session as a Git checkpoint
           ↓
  post-commit hook triggers yep sync
           ↓
  transcripts are parsed → chunked → embedded → stored locally
           ↓
  next task: agent calls search_solutions via MCP
           ↓
  top 5 relevant past solutions → agent context
           ↓
  agent starts with knowledge, not from scratch
```

One install, zero config, fully local. The only external call is to OpenAI for embeddings.

## Getting Started

### 1. Install

```bash
./scripts/install.sh
```

Checks for `bun` and `entire`, installs dependencies, symlinks the `yep` command to your PATH.

### 2. Enable

```bash
yep enable
```

One command does everything:

- Creates `.yep-mem/` with a LanceDB vector store
- Runs `entire enable` to start capturing sessions
- Adds a `post-commit` hook (Lefthook) for auto-indexing
- Registers the MCP server in `.cursor/mcp.json`
- Syncs existing checkpoints if any are found

### 3. Set Your API Key

OpenAI API key is required for embeddings. Resolved from three sources in order:

1. `OPENAI_API_KEY` environment variable
2. `.yep-mem/config.json` field `openaiApiKey`
3. `.cursor/mcp.json` under `mcpServers.yep-mem.env.OPENAI_API_KEY`

The `.cursor/mcp.json` file is gitignored — each developer keeps their own key.

## Commands

| Command              | Description                                        |
| -------------------- | -------------------------------------------------- |
| `yep enable`         | Activate Entire + vector memory in this repo       |
| `yep sync`           | Index new checkpoints into the vector store        |
| `yep search "query"` | Search past solutions by semantic similarity       |
| `yep status`         | Show indexed chunks, config health, sync state     |
| `yep reset`          | Drop the vector store (`--reindex` to rebuild)     |
| `yep serve`          | Start MCP server on stdio (auto-started by Cursor) |
| `yep`                | Launch the interactive TUI                         |

## MCP Tools

Agents in Cursor (or any MCP-compatible client) get two tools:

**`search_solutions`** — find relevant past sessions before starting work.

```text
query       string       What you're trying to solve
top_k       number       Results to return (default: 5)
agent       string?      Filter by agent type
files       string[]?    Filter by files involved
```

**`mem_stats`** — check vector store health and indexed chunk count.

The server starts automatically when Cursor reads `.cursor/mcp.json`. For manual use: `yep serve`.

## Built With

- **[LanceDB](https://lancedb.com)** — embedded vector DB, no server, HNSW index
- **[AI SDK](https://ai-sdk.dev)** — OpenAI `text-embedding-3-small` embeddings
- **[Entire](https://entire.io)** — session capture as Git checkpoints
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

| Script                | Description                              |
| --------------------- | ---------------------------------------- |
| `bun run dev`         | Start all apps in development mode       |
| `bun run build`       | Build all apps                           |
| `bun run dev:native`  | Start React Native / Expo dev server     |
| `bun run dev:server`  | Start only the Hono API server           |
| `bun run check-types` | TypeScript type checking across all apps |
| `bun run check`       | Run Biome formatting and linting         |
| `bun run fix`         | Auto-fix Biome issues                    |
| `bun run db:push`     | Push schema changes to database          |
| `bun run db:generate` | Generate Prisma client / types           |
| `bun run db:migrate`  | Run database migrations                  |
| `bun run db:studio`   | Open Prisma Studio UI                    |

## Stack

TypeScript, Hono, React Native + Expo, TailwindCSS + shadcn/ui, Prisma + SQLite/Turso, Turborepo, Biome via [Ultracite](https://github.com/haydenbleasel/ultracite), Bun.

</details>
