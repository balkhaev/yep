import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { api } from "@/api";

const NAV_ITEMS = [
	{ to: "/", label: "Dashboard", icon: "grid", end: true },
	{ to: "/insights", label: "Insights", icon: "chart", end: false },
	{ to: "/search", label: "Search", icon: "search", end: false },
	{ to: "/code", label: "Code", icon: "code", end: false },
	{ to: "/sync", label: "Sync", icon: "refresh", end: false },
	{ to: "/diff", label: "Timeline", icon: "clock", end: false },
	{ to: "/settings", label: "Settings", icon: "settings", end: false },
];

const svgProps = {
	"aria-hidden": "true" as const,
	className: "h-4 w-4",
	fill: "currentColor",
	viewBox: "0 0 16 16",
};

function NavIcon({ name }: { name: string }) {
	const icons: Record<string, ReactNode> = {
		grid: (
			<svg {...svgProps}>
				<path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3z" />
			</svg>
		),
		search: (
			<svg {...svgProps}>
				<path
					clipRule="evenodd"
					d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"
					fillRule="evenodd"
				/>
			</svg>
		),
		refresh: (
			<svg {...svgProps}>
				<path
					clipRule="evenodd"
					d="M13.836 2.477a.75.75 0 0 1 .75.75v3.182a.75.75 0 0 1-.75.75h-3.182a.75.75 0 0 1 0-1.5h1.37l-.84-.841a4.5 4.5 0 0 0-7.08.932.75.75 0 0 1-1.3-.75 6 6 0 0 1 9.44-1.242l.842.84V3.227a.75.75 0 0 1 .75-.75Zm-.911 7.5A.75.75 0 0 1 13.199 11a6 6 0 0 1-9.44 1.241l-.84-.84v1.371a.75.75 0 0 1-1.5 0V9.591a.75.75 0 0 1 .75-.75H5.35a.75.75 0 0 1 0 1.5H3.98l.841.841a4.5 4.5 0 0 0 7.08-.932.75.75 0 0 1 1.025-.273Z"
					fillRule="evenodd"
				/>
			</svg>
		),
		code: (
			<svg {...svgProps}>
				<path
					clipRule="evenodd"
					d="M4.72 3.22a.75.75 0 0 1 1.06 1.06L2.06 8l3.72 3.72a.75.75 0 1 1-1.06 1.06L.47 8.53a.75.75 0 0 1 0-1.06l4.25-4.25Zm6.56 0a.75.75 0 1 0-1.06 1.06L13.94 8l-3.72 3.72a.75.75 0 1 0 1.06 1.06l4.25-4.25a.75.75 0 0 0 0-1.06l-4.25-4.25Z"
					fillRule="evenodd"
				/>
			</svg>
		),
		chart: (
			<svg {...svgProps}>
				<path d="M1.5 14.25a.75.75 0 0 1 0-1.5h13a.75.75 0 0 1 0 1.5h-13Z" />
				<path d="M3 11.5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h1.5a1 1 0 0 1 1 1v2.5a1 1 0 0 1-1 1H3Zm4 0a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h1.5a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H7Zm4 0a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h1.5a1 1 0 0 1 1 1v8.5a1 1 0 0 1-1 1H11Z" />
			</svg>
		),
		clock: (
			<svg {...svgProps}>
				<path
					clipRule="evenodd"
					d="M1 8a7 7 0 1 1 14 0A7 7 0 0 1 1 8Zm7.75-4.25a.75.75 0 0 0-1.5 0V8c0 .414.336.75.75.75h3.25a.75.75 0 0 0 0-1.5h-2.5v-3.5Z"
					fillRule="evenodd"
				/>
			</svg>
		),
		settings: (
			<svg {...svgProps}>
				<path
					clipRule="evenodd"
					d="M6.955 1.45A.5.5 0 0 1 7.452 1h1.096a.5.5 0 0 1 .497.45l.17 1.699c.484.12.94.312 1.356.562l1.321-.916a.5.5 0 0 1 .67.033l.774.775a.5.5 0 0 1 .034.67l-.916 1.32c.25.417.44.873.561 1.357l1.699.17a.5.5 0 0 1 .45.497v1.096a.5.5 0 0 1-.45.497l-1.699.17c-.12.484-.312.94-.562 1.356l.916 1.321a.5.5 0 0 1-.033.67l-.775.774a.5.5 0 0 1-.67.033l-1.32-.916c-.417.25-.873.44-1.357.561l-.17 1.699a.5.5 0 0 1-.497.45H7.452a.5.5 0 0 1-.497-.45l-.17-1.699a4.973 4.973 0 0 1-1.356-.562l-1.321.916a.5.5 0 0 1-.67-.033l-.774-.775a.5.5 0 0 1-.034-.67l.916-1.32a4.971 4.971 0 0 1-.561-1.357l-1.699-.17A.5.5 0 0 1 1 8.548V7.452a.5.5 0 0 1 .45-.497l1.699-.17c.12-.484.312-.94.562-1.356l-.916-1.321a.5.5 0 0 1 .033-.67l.775-.774a.5.5 0 0 1 .67-.033l1.32.916c.417-.25.873-.44 1.357-.561l.17-1.699ZM8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
					fillRule="evenodd"
				/>
			</svg>
		),
	};
	return <>{icons[name]}</>;
}

const SIDEBAR_STORAGE_KEY = "yep-sidebar-expanded";

export default function Layout({ children }: { children: ReactNode }) {
	const [connected, setConnected] = useState(false);
	const [expanded, setExpanded] = useState(() => {
		const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
		return stored !== null ? stored === "true" : true;
	});

	useEffect(() => {
		localStorage.setItem(SIDEBAR_STORAGE_KEY, String(expanded));
	}, [expanded]);

	useEffect(() => {
		let active = true;
		const check = () => {
			api
				.health()
				.then(() => active && setConnected(true))
				.catch(() => active && setConnected(false));
		};
		check();
		const id = setInterval(check, 5000);
		return () => {
			active = false;
			clearInterval(id);
		};
	}, []);

	return (
		<div className="flex h-screen">
			<motion.aside
				animate={{ width: expanded ? 224 : 72 }}
				className="relative flex flex-col border-zinc-800/40 border-r bg-zinc-900/30"
				transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
			>
				{/* Header */}
				<div
					className={`flex items-center gap-2.5 px-5 pt-7 pb-4 ${expanded ? "" : "justify-center px-3"}`}
				>
					<div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-indigo-500/20 shadow-lg">
						<span className="font-bold text-white text-xs">Y</span>
					</div>
					<AnimatePresence mode="wait">
						{expanded && (
							<motion.span
								animate={{ opacity: 1, x: 0 }}
								className="font-semibold tracking-tight"
								exit={{ opacity: 0, x: -10 }}
								initial={{ opacity: 0, x: -10 }}
								transition={{ duration: 0.2 }}
							>
								yep-mem
							</motion.span>
						)}
					</AnimatePresence>
					{expanded && (
						<motion.span
							animate={{ scale: connected ? 1 : 0.9, opacity: 1 }}
							className={`ml-auto h-2 w-2 rounded-full transition-colors ${connected ? "bg-emerald-400 shadow-[0_0_8px_rgb(52,211,153,0.5)]" : "bg-zinc-600"}`}
							initial={{ scale: 0.9, opacity: 0.5 }}
							transition={{ duration: 0.3 }}
						/>
					)}
				</div>

				{/* Nav */}
				<nav className="flex-1 space-y-0.5 px-3 py-2">
					{expanded && (
						<p className="mb-2 px-3 font-semibold text-[10px] text-zinc-600 uppercase tracking-widest">
							Menu
						</p>
					)}
					{NAV_ITEMS.map((item) => (
						<NavLink
							className={({ isActive }) =>
								`flex items-center ${expanded ? "gap-3 px-3" : "justify-center px-0"} relative overflow-hidden rounded-xl py-2.5 font-medium text-[13px] transition-all duration-200 ${
									isActive
										? "text-white"
										: "text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300"
								}`
							}
							end={item.end}
							key={item.to}
							to={item.to}
						>
							{({ isActive }) => (
								<>
									{isActive && (
										<motion.div
											className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-600/90 to-indigo-500/80"
											layoutId="activeTab"
											style={{
												boxShadow: "0 0 20px rgba(99, 102, 241, 0.3)",
											}}
											transition={{
												type: "spring",
												bounce: 0.2,
												duration: 0.6,
											}}
										/>
									)}
									<span className="relative z-10 flex items-center gap-3">
										<NavIcon name={item.icon} />
										<AnimatePresence mode="wait">
											{expanded && (
												<motion.span
													animate={{ opacity: 1, x: 0 }}
													exit={{ opacity: 0, x: -10 }}
													initial={{ opacity: 0, x: -10 }}
													transition={{ duration: 0.2 }}
												>
													{item.label}
												</motion.span>
											)}
										</AnimatePresence>
									</span>
								</>
							)}
						</NavLink>
					))}
				</nav>

				{/* Footer */}
				<div
					className={`border-zinc-800/40 border-t ${expanded ? "px-5" : "px-3"} py-4`}
				>
					{expanded ? (
						<div className="flex items-center gap-2 text-xs text-zinc-600">
							<span
								className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500 shadow-[0_0_6px_rgb(16,185,129,0.5)]" : "bg-zinc-600"}`}
							/>
							{connected ? "Connected" : "Disconnected"}
						</div>
					) : (
						<div className="flex justify-center">
							<span
								className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500 shadow-[0_0_8px_rgb(16,185,129,0.6)]" : "bg-zinc-600"}`}
							/>
						</div>
					)}
				</div>

				{/* Toggle button */}
				<button
					className="absolute top-7 -right-3 z-20 rounded-full border border-zinc-700 bg-zinc-800 p-1.5 text-zinc-400 shadow-lg transition-all duration-200 hover:bg-zinc-700 hover:text-zinc-200"
					onClick={() => setExpanded(!expanded)}
					type="button"
				>
					{expanded ? (
						<ChevronLeft className="h-3.5 w-3.5" />
					) : (
						<ChevronRight className="h-3.5 w-3.5" />
					)}
				</button>
			</motion.aside>

			<main className="flex-1 overflow-y-auto bg-zinc-950">
				<div className="mx-auto max-w-7xl px-8 py-8">{children}</div>
			</main>
		</div>
	);
}
