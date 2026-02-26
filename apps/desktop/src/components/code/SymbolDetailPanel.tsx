import { useState } from "react";
import type { CodeInsights, SymbolContext } from "@/api";
import { Spinner } from "@/components/LoadingState";
import { FadeInUp } from "@/components/Motion";
import HistoryTab from "./tabs/HistoryTab";
import MetricsTab from "./tabs/MetricsTab";
import OverviewTab from "./tabs/OverviewTab";
import RelationsTab from "./tabs/RelationsTab";
import SourceTab from "./tabs/SourceTab";
import TabBar from "./TabBar";

interface SymbolDetailPanelProps {
	context: SymbolContext | null;
	insights: CodeInsights | null;
	loading: boolean;
	onNavigateToHistory: (path: string) => void;
	onSelectSymbol: (name: string) => void;
}

export default function SymbolDetailPanel({
	context,
	insights,
	loading,
	onNavigateToHistory,
	onSelectSymbol,
}: SymbolDetailPanelProps) {
	const [activeTab, setActiveTab] = useState("overview");

	if (loading) {
		return (
			<div className="w-1/2">
				<div className="flex h-32 items-center justify-center">
					<Spinner />
				</div>
			</div>
		);
	}

	if (!context) {
		return (
			<div className="w-1/2">
				<div className="card p-5">
					<p className="text-sm text-zinc-500">Symbol not found in index</p>
				</div>
			</div>
		);
	}

	const { definition } = context;
	const hasRelations =
		context.callers.length > 0 ||
		context.callees.length > 0 ||
		context.importers.length > 0;

	// Найти метрики из insights
	const complexity = insights?.topComplexSymbols.find(
		(s) => s.symbol === definition.symbol && s.path === definition.path
	);
	const isDead = insights?.deadCode.some(
		(s) => s.symbol === definition.symbol && s.path === definition.path
	);
	const duplication = insights?.duplicateClusters.find((cluster) =>
		cluster.symbols.some(
			(s) => s.symbol === definition.symbol && s.path === definition.path
		)
	);

	const tabs = [
		{ id: "overview", label: "Overview" },
		{
			badge: hasRelations
				? context.callers.length +
					context.callees.length +
					context.importers.length
				: undefined,
			id: "relations",
			label: "Relations",
		},
		{ id: "source", label: "Source" },
		{ id: "history", label: "History" },
		{ id: "metrics", label: "Metrics" },
	];

	return (
		<div className="w-1/2">
			<FadeInUp className="card overflow-hidden">
				<TabBar activeTab={activeTab} onChange={setActiveTab} tabs={tabs} />

				<div className="max-h-[70vh] overflow-y-auto p-5">
					{activeTab === "overview" && (
						<OverviewTab
							context={context}
							onNavigateToHistory={onNavigateToHistory}
						/>
					)}
					{activeTab === "relations" && (
						<RelationsTab context={context} onSelectSymbol={onSelectSymbol} />
					)}
					{activeTab === "source" && <SourceTab definition={definition} />}
					{activeTab === "history" && <HistoryTab path={definition.path} />}
					{activeTab === "metrics" && (
						<MetricsTab
							complexity={complexity}
							definition={definition}
							duplication={duplication}
							isDead={isDead}
						/>
					)}
				</div>
			</FadeInUp>
		</div>
	);
}
