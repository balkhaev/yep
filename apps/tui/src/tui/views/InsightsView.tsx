// @ts-nocheck
import type { TextChunk } from "@opentui/core";
import { bold, dim, StyledText, t } from "@opentui/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Breadcrumbs, EmptyState, KeyHint } from "../components/ui";
import { loadCodeInsights } from "../helpers";
import { COLORS, SEMANTIC } from "../theme";
import type { CodeInsights, InsightsTab } from "../types";
import CoChangeTab from "./insights/CoChangeTab";
import ComplexityTab from "./insights/ComplexityTab";
import DependenciesTab from "./insights/DependenciesTab";
import DirectoriesTab from "./insights/DirectoriesTab";
import OverviewTab from "./insights/OverviewTab";
import PatternsTab from "./insights/PatternsTab";
import QualityTab from "./insights/QualityTab";
import RiskTab from "./insights/RiskTab";
import TrendsTab from "./insights/TrendsTab";

const INSIGHTS_TABS = [
	{ id: "overview" as const, label: "Overview" },
	{ id: "trends" as const, label: "Trends" },
	{ id: "risk" as const, label: "Risk" },
	{ id: "complexity" as const, label: "Complexity" },
	{ id: "dependencies" as const, label: "Dependencies" },
	{ id: "quality" as const, label: "Quality" },
	{ id: "patterns" as const, label: "Patterns" },
	{ id: "cochange" as const, label: "Co-Change" },
	{ id: "directories" as const, label: "Directories" },
];

function s(...chunks: TextChunk[]): StyledText {
	return new StyledText(chunks);
}

function InsightsTabBar({
	active,
	onChange,
}: {
	active: InsightsTab;
	onChange: (tab: InsightsTab) => void;
}) {
	const parts: TextChunk[] = [];

	for (const tab of INSIGHTS_TABS) {
		if (parts.length > 0) {
			parts.push(dim("  "));
		}

		if (tab.id === active) {
			parts.push(bold(t`${SEMANTIC.primary}${tab.label}${COLORS.reset}`));
		} else {
			parts.push(dim(tab.label));
		}
	}

	return (
		<box flexDirection="column" paddingBottom={1}>
			<text content={s(...parts)} height={1} />
		</box>
	);
}

export default function InsightsView() {
	const [activeTab, setActiveTab] = useState<InsightsTab>("overview");
	const [insights, setInsights] = useState<CodeInsights | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setLoading(true);
		setError(null);

		loadCodeInsights()
			.then((data) => {
				setInsights(data);
				setLoading(false);
			})
			.catch((err) => {
				setError(err.message || "Failed to load insights");
				setLoading(false);
			});
	}, []);

	const handleTabChange = useCallback((direction: "left" | "right") => {
		setActiveTab((current) => {
			const currentIndex = INSIGHTS_TABS.findIndex((t) => t.id === current);
			let newIndex = currentIndex;

			if (direction === "left") {
				newIndex =
					currentIndex > 0 ? currentIndex - 1 : INSIGHTS_TABS.length - 1;
			} else {
				newIndex =
					currentIndex < INSIGHTS_TABS.length - 1 ? currentIndex + 1 : 0;
			}

			return INSIGHTS_TABS[newIndex].id;
		});
	}, []);

	// Breadcrumbs
	const breadcrumbItems = useMemo(() => {
		const currentTabLabel =
			INSIGHTS_TABS.find((t) => t.id === activeTab)?.label || activeTab;
		return [{ label: "Insights" }, { label: currentTabLabel, active: true }];
	}, [activeTab]);

	// Help hints
	const helpKeys = useMemo(
		() => [
			{ key: "←/→", label: "switch tabs" },
			{ key: "↑↓", label: "scroll" },
			{ key: "esc", label: "back" },
		],
		[]
	);

	// Loading state
	if (loading) {
		return (
			<box flexDirection="column" flexGrow={1}>
				<Breadcrumbs items={breadcrumbItems} />
				<box
					alignItems="center"
					flexDirection="column"
					flexGrow={1}
					justifyContent="center"
				>
					<text
						content={t`${SEMANTIC.primary}◐${COLORS.reset} ${dim("Loading insights...")}`}
						height={1}
					/>
				</box>
				<KeyHint keys={helpKeys} />
			</box>
		);
	}

	// Error state
	if (error || !insights) {
		return (
			<box flexDirection="column" flexGrow={1}>
				<Breadcrumbs items={breadcrumbItems} />
				<EmptyState
					action="Run 'yep mem index-code' to generate insights"
					description={error || "No insights available"}
					icon="✗"
					title="Failed to load insights"
				/>
				<KeyHint keys={helpKeys} />
			</box>
		);
	}

	// No data state
	if (insights.totalSymbols === 0) {
		return (
			<box flexDirection="column" flexGrow={1}>
				<Breadcrumbs items={breadcrumbItems} />
				<EmptyState
					action="Run 'yep mem index-code' to get started"
					description="Index your codebase to see insights"
					icon="○"
					title="No code indexed"
				/>
				<KeyHint keys={helpKeys} />
			</box>
		);
	}

	return (
		<box flexDirection="column" flexGrow={1}>
			<Breadcrumbs items={breadcrumbItems} />
			<InsightsTabBar active={activeTab} onChange={setActiveTab} />

			<box flexDirection="column" flexGrow={1} paddingTop={1}>
				{activeTab === "overview" && <OverviewTab insights={insights} />}
				{activeTab === "trends" && <TrendsTab />}
				{activeTab === "risk" && <RiskTab />}
				{activeTab === "complexity" && <ComplexityTab insights={insights} />}
				{activeTab === "dependencies" && (
					<DependenciesTab insights={insights} />
				)}
				{activeTab === "quality" && <QualityTab insights={insights} />}
				{activeTab === "patterns" && <PatternsTab />}
				{activeTab === "cochange" && <CoChangeTab />}
				{activeTab === "directories" && <DirectoriesTab insights={insights} />}
			</box>

			<KeyHint keys={helpKeys} />
		</box>
	);
}
