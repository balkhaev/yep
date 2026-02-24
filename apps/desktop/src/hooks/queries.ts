import { useQuery } from "@tanstack/react-query";
import { api } from "@/api";

export const queryKeys = {
	status: ["status"] as const,
	codeStats: ["code", "stats"] as const,
	codeInsights: ["code", "insights"] as const,
	codeRecommendations: ["code", "recommendations"] as const,
	codeFiles: (limit?: number) => ["code", "files", limit] as const,
	codeSymbols: (type?: string, limit?: number) =>
		["code", "symbols", type, limit] as const,
	recent: (limit?: number) => ["recent", limit] as const,
	diff: (file: string) => ["diff", file] as const,
	config: ["config"] as const,
} as const;

export function useStatus() {
	return useQuery({
		queryKey: queryKeys.status,
		queryFn: () => api.status(),
	});
}

export function useCodeStats() {
	return useQuery({
		queryKey: queryKeys.codeStats,
		queryFn: () => api.code.stats(),
	});
}

export function useCodeInsights() {
	return useQuery({
		queryKey: queryKeys.codeInsights,
		queryFn: () => api.code.insights(),
		staleTime: Number.POSITIVE_INFINITY,
	});
}

export function useCodeRecommendations(enabled = true) {
	return useQuery({
		queryKey: queryKeys.codeRecommendations,
		queryFn: () => api.code.recommendations(),
		enabled,
		staleTime: Number.POSITIVE_INFINITY,
	});
}

export function useCodeFiles(limit?: number) {
	return useQuery({
		queryKey: queryKeys.codeFiles(limit),
		queryFn: () => api.code.files(limit),
	});
}

export function useRecentSessions(limit?: number) {
	return useQuery({
		queryKey: queryKeys.recent(limit),
		queryFn: () => api.recent(limit),
	});
}

export function useDiff(file: string) {
	return useQuery({
		queryKey: queryKeys.diff(file),
		queryFn: () => api.diff(file),
		enabled: !!file,
	});
}
