import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

interface HistoryEntry {
	params: Record<string, string>;
	path: string;
	timestamp: number;
	title: string;
}

interface NavigationHistory {
	currentIndex: number;
	entries: HistoryEntry[];
}

export function useNavigationHistory() {
	const location = useLocation();
	const navigate = useNavigate();

	const [history, setHistory] = useState<NavigationHistory>(() => {
		const stored = sessionStorage.getItem("yep-navigation-history");
		return stored ? JSON.parse(stored) : { entries: [], currentIndex: -1 };
	});

	// Добавление текущей страницы в историю
	useEffect(() => {
		const params = Object.fromEntries(new URLSearchParams(location.search));
		const title = getPageTitle(location.pathname, params);

		// Проверка дубликата (не добавлять если та же страница)
		if (
			history.entries[history.currentIndex]?.path === location.pathname &&
			JSON.stringify(history.entries[history.currentIndex]?.params) ===
				JSON.stringify(params)
		) {
			return;
		}

		const newEntry: HistoryEntry = {
			path: location.pathname,
			params,
			title,
			timestamp: Date.now(),
		};

		// Обрезать forward history если пользователь пошел в другую сторону
		const newEntries = history.entries.slice(0, history.currentIndex + 1);
		newEntries.push(newEntry);

		// Ограничить историю до 50 записей
		if (newEntries.length > 50) {
			newEntries.shift();
		}

		const newHistory = {
			entries: newEntries,
			currentIndex: newEntries.length - 1,
		};

		setHistory(newHistory);
		sessionStorage.setItem(
			"yep-navigation-history",
			JSON.stringify(newHistory)
		);
	}, [location, history.currentIndex, history.entries]);

	// Методы навигации
	const goBack = useCallback(() => {
		if (history.currentIndex > 0) {
			const newIndex = history.currentIndex - 1;
			const entry = history.entries[newIndex];

			setHistory((prev) => ({ ...prev, currentIndex: newIndex }));

			// Построить URL с параметрами
			const search = new URLSearchParams(entry.params).toString();
			navigate(`${entry.path}${search ? `?${search}` : ""}`);
		}
	}, [history, navigate]);

	const goForward = useCallback(() => {
		if (history.currentIndex < history.entries.length - 1) {
			const newIndex = history.currentIndex + 1;
			const entry = history.entries[newIndex];

			setHistory((prev) => ({ ...prev, currentIndex: newIndex }));

			const search = new URLSearchParams(entry.params).toString();
			navigate(`${entry.path}${search ? `?${search}` : ""}`);
		}
	}, [history, navigate]);

	const canGoBack = history.currentIndex > 0;
	const canGoForward = history.currentIndex < history.entries.length - 1;

	const getPreviousEntry = (): HistoryEntry | null => {
		return canGoBack ? history.entries[history.currentIndex - 1] : null;
	};

	const getNextEntry = (): HistoryEntry | null => {
		return canGoForward ? history.entries[history.currentIndex + 1] : null;
	};

	return {
		goBack,
		goForward,
		canGoBack,
		canGoForward,
		getPreviousEntry,
		getNextEntry,
		history,
	};
}

// Helper функции
function getPageTitle(path: string, params: Record<string, string>): string {
	if (path === "/") {
		return "Dashboard";
	}
	if (path === "/insights") {
		const tab = params.tab;
		return tab ? `Insights: ${tab}` : "Insights";
	}
	if (path === "/search") {
		const query = params.q;
		return query ? `Search: ${query}` : "Search";
	}
	if (path === "/code") {
		if (params.symbol) {
			return `Code: ${params.symbol}`;
		}
		if (params.file) {
			return `Code: ${params.file}`;
		}
		return "Code";
	}
	if (path === "/diff") {
		const file = params.file;
		return file ? `Timeline: ${file}` : "Timeline";
	}
	if (path === "/sync") {
		return "Sync";
	}
	if (path === "/settings") {
		return "Settings";
	}
	return "Unknown";
}
