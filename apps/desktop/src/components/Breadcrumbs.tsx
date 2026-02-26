import { ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";

interface BreadcrumbItem {
	label: string;
	path?: string;
}

export default function Breadcrumbs() {
	const location = useLocation();
	const [searchParams] = useSearchParams();

	// Parse location into breadcrumb items
	const items: BreadcrumbItem[] = [];

	// Add home
	if (location.pathname !== "/") {
		items.push({ label: "Home", path: "/" });
	}

	// Parse pathname segments
	const pathSegments = location.pathname.split("/").filter(Boolean);

	// Map path segments to labels
	const segmentLabels: Record<string, string> = {
		dashboard: "Dashboard",
		insights: "Insights",
		search: "Search",
		code: "Code",
		sync: "Sync",
		settings: "Settings",
	};

	for (let i = 0; i < pathSegments.length; i++) {
		const segment = pathSegments[i];
		const label = segmentLabels[segment] ?? segment;
		const path = "/" + pathSegments.slice(0, i + 1).join("/");

		// Don't add link for current page
		if (i === pathSegments.length - 1) {
			items.push({ label });
		} else {
			items.push({ label, path });
		}
	}

	// Add sub-navigation from search params
	const tab = searchParams.get("tab");
	if (tab) {
		const tabLabels: Record<string, string> = {
			overview: "Overview",
			complexity: "Complexity",
			dependencies: "Dependencies",
			quality: "Quality",
			directories: "Directories",
		};
		items.push({ label: tabLabels[tab] ?? tab });
	}

	// Add file/symbol from search params for Code and Diff pages
	const file = searchParams.get("file");
	const symbol = searchParams.get("symbol");

	if (location.pathname === "/code") {
		if (symbol) {
			items.push({ label: symbol });
		} else if (file) {
			// Показать сокращенный путь если длинный
			const fileParts = file.split("/");
			if (fileParts.length > 3) {
				items.push({
					label: `${fileParts[0]}/.../${fileParts.slice(-2).join("/")}`,
				});
			} else {
				items.push({ label: file });
			}
		}
	}

	if (location.pathname === "/diff" && file) {
		items.push({ label: file.split("/").pop() || file });
	}

	if (items.length === 0) {
		return null;
	}

	return (
		<nav
			aria-label="Breadcrumb"
			className="flex items-center space-x-2 text-sm text-zinc-400"
		>
			{items.map((item, i) => (
				<Fragment key={i}>
					{i > 0 && <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />}
					{item.path ? (
						<Link
							className="transition-colors duration-200 hover:text-zinc-200"
							to={item.path}
						>
							{item.label}
						</Link>
					) : (
						<span className="font-medium text-zinc-300">{item.label}</span>
					)}
				</Fragment>
			))}
		</nav>
	);
}
