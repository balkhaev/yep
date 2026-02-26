// @ts-nocheck
import type { TextChunk } from "@opentui/core";
import { bold, createCliRenderer, dim, StyledText, t } from "@opentui/core";
import { createRoot, useKeyboard, useRenderer } from "@opentui/react";
// @ts-expect-error react types resolved via opentui reconciler
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	doCodeSearch,
	doDiff,
	doSearch,
	loadCodeInsights,
	loadCodeRelations,
	loadCodeStats,
	loadRecentSessions,
	loadStats,
} from "./tui/helpers";
import { COLORS, SEMANTIC } from "./tui/theme";
import type { MemStats, View } from "./tui/types";
import CodeSearchView from "./tui/views/CodeSearchView";
import DiffView from "./tui/views/DiffView";
import InsightsView from "./tui/views/InsightsView";
import SearchView from "./tui/views/SearchView";
import StatusView from "./tui/views/StatusView";

function s(...chunks: TextChunk[]): StyledText {
	return new StyledText(chunks);
}

const TAB_VIEWS: View[] = ["search", "code", "status", "diff", "insights"];
const TAB_LABELS: Record<View, string> = {
	search: "Search",
	code: "Code",
	status: "Status",
	diff: "Diff",
	insights: "Insights",
};

let resolveExit: ((action: string | null) => void) | null = null;

function StatusBar({ stats }: { stats: MemStats | null }) {
	if (!stats) {
		return <text content={s(dim("loading…"))} height={1} />;
	}
	if (!stats.initialized) {
		return (
			<text
				content={s(
					t`${SEMANTIC.warning}not initialized — run yep enable${COLORS.reset}`
				)}
				height={1}
			/>
		);
	}
	const dot = stats.hasTable
		? `${SEMANTIC.success}●${COLORS.reset}`
		: `${SEMANTIC.warning}○${COLORS.reset}`;
	return (
		<text
			content={s(
				t`${dot} ${dim(stats.provider)} ${dim("·")} ${dim(stats.embeddingModel)} ${dim("·")} ${SEMANTIC.primary}${String(stats.totalChunks)}${COLORS.reset} ${dim("chunks")}`
			)}
			height={1}
		/>
	);
}

function TabBar({ active }: { active: View }) {
	const parts: TextChunk[] = [];
	for (const view of TAB_VIEWS) {
		if (parts.length > 0) {
			parts.push(dim("  "));
		}
		if (view === active) {
			parts.push(
				t`${SEMANTIC.primary}${bold(` ${TAB_LABELS[view]} `)}${COLORS.reset}`
			);
		} else {
			parts.push(dim(` ${TAB_LABELS[view]} `));
		}
	}
	return (
		<box paddingX={1} paddingY={0}>
			<text content={s(...parts)} height={1} />
		</box>
	);
}

function HelpBar({ hints }: { hints: string }) {
	return (
		<box paddingTop={0} paddingX={1}>
			<text content={s(dim(hints))} height={1} />
		</box>
	);
}

function App() {
	const [view, setView] = useState<View>("search");
	const [stats, setStats] = useState<MemStats | null>(null);
	const [detail, setDetail] = useState<number | null>(null);
	const [diffHasSubState, setDiffHasSubState] = useState(false);
	const diffResetRef = useRef<(() => void) | null>(null);
	const renderer = useRenderer();

	useEffect(() => {
		loadStats().then(setStats);
	}, []);

	const handleDiffSubState = useCallback((hasState: boolean) => {
		setDiffHasSubState(hasState);
	}, []);

	const handleEscape = useCallback(() => {
		if (detail !== null) {
			setDetail(null);
			return;
		}
		if (view === "diff" && diffHasSubState) {
			diffResetRef.current?.();
			return;
		}
		renderer.destroy();
		resolveExit?.(null);
	}, [detail, view, diffHasSubState, renderer]);

	const handleTabSwitch = useCallback(
		(shift: boolean) => {
			const dir = shift ? -1 : 1;
			const idx = TAB_VIEWS.indexOf(view);
			const next = TAB_VIEWS[(idx + dir + TAB_VIEWS.length) % TAB_VIEWS.length];
			if (next) {
				setDetail(null);
				setView(next);
			}
		},
		[view]
	);

	const handleCtrlAction = useCallback(
		(name: string) => {
			const actions: Record<string, string> = {
				s: "sync",
				w: "watch",
				r: "reset",
			};
			const action = actions[name];
			if (action) {
				renderer.destroy();
				resolveExit?.(action);
			}
		},
		[renderer]
	);

	useKeyboard((key) => {
		if (key.name === "escape") {
			handleEscape();
			return;
		}
		if (key.name === "tab" && !key.ctrl && !key.meta) {
			handleTabSwitch(key.shift === true);
			return;
		}
		if (key.ctrl && key.name) {
			handleCtrlAction(key.name);
		}
	});

	const helpText = useMemo(() => {
		if (detail !== null) {
			return "↑↓ scroll · esc back";
		}
		if (view === "diff" && diffHasSubState) {
			return "↑↓ scroll · esc back · tab/shift+tab switch";
		}
		if (view === "insights") {
			return "←→ tabs · ↑↓ scroll · tab/shift+tab switch · esc quit";
		}
		return "tab/shift+tab switch · ^S sync · ^W watch · ^R reset · esc quit";
	}, [detail, view, diffHasSubState]);

	return (
		<box flexDirection="column" flexGrow={1}>
			<box border borderStyle="rounded" flexDirection="column" paddingX={1}>
				<ascii-font font="tiny" text="yep" />
				<StatusBar stats={stats} />
			</box>

			<TabBar active={view} />

			<box flexDirection="column" flexGrow={1}>
				{view === "search" && (
					<SearchView
						detail={detail}
						onDetail={setDetail}
						onSearch={doSearch}
					/>
				)}
				{view === "code" && (
					<CodeSearchView
						detail={detail}
						onCodeSearch={doCodeSearch}
						onDetail={setDetail}
						onLoadRelations={loadCodeRelations}
					/>
				)}
				{view === "status" && (
					<StatusView
						onLoadCodeStats={loadCodeStats}
						onLoadInsights={loadCodeInsights}
						onLoadRecentSessions={loadRecentSessions}
						stats={stats}
					/>
				)}
				{view === "diff" && (
					<DiffView
						detail={detail}
						files={stats?.topFiles ?? []}
						onDetail={setDetail}
						onDoDiff={doDiff}
						onSubStateChange={handleDiffSubState}
						resetRef={diffResetRef}
					/>
				)}
				{view === "insights" && <InsightsView />}
			</box>

			<HelpBar hints={helpText} />
		</box>
	);
}

function restoreTerminal(): void {
	if (process.stdin.isTTY && process.stdin.setRawMode) {
		process.stdin.setRawMode(false);
	}
	process.stdin.pause();
	process.stdout.write("\x1b[?25h");
	process.stdout.write("\x1b[?1049l");
}

export async function renderTuiApp(): Promise<string | null> {
	const exitPromise = new Promise<string | null>((resolve) => {
		resolveExit = resolve;
	});
	const renderer = await createCliRenderer();
	createRoot(renderer).render(<App />);
	const result = await exitPromise;
	restoreTerminal();
	return result;
}
