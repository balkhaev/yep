export const CHART_COLORS = {
	indigo: "#6366f1",
	blue: "#3b82f6",
	emerald: "#10b981",
	amber: "#f59e0b",
	pink: "#ec4899",
	purple: "#a855f7",
	cyan: "#06b6d4",
	orange: "#f97316",
	red: "#ef4444",
	lime: "#84cc16",
} as const;

export const PALETTE = [
	CHART_COLORS.indigo,
	CHART_COLORS.emerald,
	CHART_COLORS.amber,
	CHART_COLORS.pink,
	CHART_COLORS.blue,
	CHART_COLORS.purple,
	CHART_COLORS.cyan,
	CHART_COLORS.orange,
	CHART_COLORS.red,
	CHART_COLORS.lime,
];

export const TYPE_CHART_COLORS: Record<string, string> = {
	function: CHART_COLORS.blue,
	class: CHART_COLORS.purple,
	component: CHART_COLORS.emerald,
	interface: CHART_COLORS.amber,
	type: CHART_COLORS.pink,
};

export const LANG_CHART_COLORS: Record<string, string> = {
	typescript: CHART_COLORS.blue,
	javascript: CHART_COLORS.amber,
	python: CHART_COLORS.emerald,
	go: CHART_COLORS.cyan,
	rust: CHART_COLORS.orange,
};

export const TOOLTIP_STYLE = {
	contentStyle: {
		background: "rgb(24 24 27 / 0.95)",
		border: "1px solid rgb(63 63 70 / 0.4)",
		borderRadius: "12px",
		padding: "8px 12px",
		fontSize: "12px",
		color: "#d4d4d8",
		backdropFilter: "blur(8px)",
		boxShadow: "0 8px 32px rgb(0 0 0 / 0.4)",
	},
	itemStyle: { color: "#a1a1aa", fontSize: "11px", padding: "2px 0" },
	labelStyle: { color: "#e4e4e7", fontWeight: 600, marginBottom: "4px" },
} as const;
