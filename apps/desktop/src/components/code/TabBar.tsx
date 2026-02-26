import { motion } from "framer-motion";

interface Tab {
	badge?: number | string;
	id: string;
	label: string;
}

interface TabBarProps {
	activeTab: string;
	onChange: (tabId: string) => void;
	tabs: Tab[];
}

export default function TabBar({ tabs, activeTab, onChange }: TabBarProps) {
	return (
		<div className="flex gap-1 border-zinc-800/40 border-b px-5 py-2">
			{tabs.map((tab) => (
				<button
					className={`relative px-3 py-2 font-medium text-xs transition-colors ${
						activeTab === tab.id
							? "text-zinc-100"
							: "text-zinc-500 hover:text-zinc-300"
					}`}
					key={tab.id}
					onClick={() => onChange(tab.id)}
					type="button"
				>
					<span className="relative z-10 flex items-center gap-1.5">
						{tab.label}
						{tab.badge !== undefined && (
							<span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
								{tab.badge}
							</span>
						)}
					</span>
					{activeTab === tab.id && (
						<motion.div
							className="absolute inset-0 rounded-lg bg-zinc-800/60"
							layoutId="activeTab"
							transition={{ type: "spring", duration: 0.5, bounce: 0.2 }}
						/>
					)}
				</button>
			))}
		</div>
	);
}
