import { useCallback, useEffect, useState } from "react";
import { api, type MemConfig } from "@/api";
import AnimatedNumber from "@/components/charts/AnimatedNumber";

function ProviderIcon({ provider }: { provider: string }) {
	if (provider === "openai") {
		return (
			<div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10">
				<svg
					className="h-4 w-4 text-emerald-400"
					fill="currentColor"
					viewBox="0 0 24 24"
				>
					<path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364l2.0201-1.1638a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.4091-.6813zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0974-2.3616l2.603-1.5018 2.6032 1.5018v3.0036l-2.6032 1.5018-2.603-1.5018z" />
				</svg>
			</div>
		);
	}
	return (
		<div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-700/30">
			<span className="font-bold text-xs text-zinc-400">OL</span>
		</div>
	);
}

export default function Settings() {
	const [config, setConfig] = useState<MemConfig | null>(null);
	const [stats, setStats] = useState<{
		totalChunks: number;
		totalSymbols: number;
	} | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);

	const [provider, setProvider] = useState<"openai" | "ollama">("openai");
	const [embeddingModel, setEmbeddingModel] = useState("");
	const [summarizerModel, setSummarizerModel] = useState("");
	const [apiKey, setApiKey] = useState("");
	const [ollamaUrl, setOllamaUrl] = useState("");

	const [resetConfirm, setResetConfirm] = useState(false);
	const [resetting, setResetting] = useState(false);
	const [resetResult, setResetResult] = useState<string | null>(null);

	useEffect(() => {
		Promise.all([
			api.config.get(),
			api.status().catch(() => null),
			api.code.stats().catch(() => null),
		])
			.then(([c, s, cs]) => {
				setConfig(c);
				setProvider(c.provider);
				setEmbeddingModel(c.embeddingModel ?? "");
				setSummarizerModel(c.summarizerModel ?? "");
				setApiKey(c.openaiApiKey ?? "");
				setOllamaUrl(c.ollamaBaseUrl ?? "");
				if (s || cs) {
					setStats({
						totalChunks: s?.stats?.totalChunks ?? 0,
						totalSymbols: cs?.totalSymbols ?? 0,
					});
				}
			})
			.catch((e) => setError(e instanceof Error ? e.message : String(e)))
			.finally(() => setLoading(false));
	}, []);

	const handleSave = useCallback(async () => {
		setSaving(true);
		setSaved(false);
		setError(null);

		try {
			const updated = await api.config.update({
				provider,
				embeddingModel: embeddingModel || null,
				summarizerModel: summarizerModel || null,
				openaiApiKey: apiKey || null,
				ollamaBaseUrl: ollamaUrl || null,
			});
			setConfig(updated);
			setSaved(true);
			setTimeout(() => setSaved(false), 3000);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Save failed");
		} finally {
			setSaving(false);
		}
	}, [provider, embeddingModel, summarizerModel, apiKey, ollamaUrl]);

	const handleReset = useCallback(async () => {
		setResetting(true);
		setResetResult(null);

		try {
			const res = await api.reset(false);
			setResetResult(res.message);
			setResetConfirm(false);
		} catch (err) {
			setResetResult(err instanceof Error ? err.message : "Reset failed");
		} finally {
			setResetting(false);
		}
	}, []);

	if (loading) {
		return (
			<div className="flex h-64 items-center justify-center">
				<div className="flex items-center gap-3 text-sm text-zinc-500">
					<div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-400" />
					Loading configuration...
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-8">
			<div className="fade-in-up">
				<h1 className="font-bold text-2xl tracking-tight">Settings</h1>
				<p className="mt-1 text-sm text-zinc-500">
					Configure your AI provider and models
				</p>
			</div>

			{error && (
				<div className="card border-red-900/30 bg-red-950/20 p-4 text-red-400 text-sm">
					{error}
				</div>
			)}

			<div className="card fade-in-up stagger-1 p-6">
				<div className="mb-5 flex items-center gap-3">
					<ProviderIcon provider={provider} />
					<div>
						<h2 className="font-semibold text-sm text-zinc-200">
							Provider Configuration
						</h2>
						<p className="text-xs text-zinc-600">
							{provider === "openai"
								? "Cloud-based embedding and summarization"
								: "Local models via Ollama"}
						</p>
					</div>
				</div>

				<div className="grid grid-cols-2 gap-5">
					<label className="space-y-2">
						<span className="font-semibold text-[11px] text-zinc-600 uppercase tracking-widest">
							Provider
						</span>
						<select
							className="input"
							onChange={(e) =>
								setProvider(e.target.value as "openai" | "ollama")
							}
							value={provider}
						>
							<option value="openai">OpenAI</option>
							<option value="ollama">Ollama</option>
						</select>
					</label>

					<label className="space-y-2">
						<span className="font-semibold text-[11px] text-zinc-600 uppercase tracking-widest">
							Embedding Model
						</span>
						<input
							className="input"
							onChange={(e) => setEmbeddingModel(e.target.value)}
							placeholder={
								provider === "openai"
									? "text-embedding-3-small"
									: "nomic-embed-text"
							}
							type="text"
							value={embeddingModel}
						/>
						<p className="text-[10px] text-zinc-600">
							{provider === "openai"
								? "Recommended: text-embedding-3-small"
								: "Recommended: nomic-embed-text"}
						</p>
					</label>

					<label className="space-y-2">
						<span className="font-semibold text-[11px] text-zinc-600 uppercase tracking-widest">
							Summarizer Model
						</span>
						<input
							className="input"
							onChange={(e) => setSummarizerModel(e.target.value)}
							placeholder={
								provider === "openai" ? "gpt-4o-mini" : "llama3.1:8b"
							}
							type="text"
							value={summarizerModel}
						/>
						<p className="text-[10px] text-zinc-600">
							{provider === "openai"
								? "Recommended: gpt-4o-mini"
								: "Recommended: llama3.1:8b"}
						</p>
					</label>

					{provider === "openai" ? (
						<label className="space-y-2">
							<span className="font-semibold text-[11px] text-zinc-600 uppercase tracking-widest">
								OpenAI API Key
							</span>
							<input
								className="input font-mono"
								onChange={(e) => setApiKey(e.target.value)}
								placeholder="sk-..."
								type="password"
								value={apiKey}
							/>
						</label>
					) : (
						<label className="space-y-2">
							<span className="font-semibold text-[11px] text-zinc-600 uppercase tracking-widest">
								Ollama Base URL
							</span>
							<input
								className="input font-mono"
								onChange={(e) => setOllamaUrl(e.target.value)}
								placeholder="http://localhost:11434/api"
								type="text"
								value={ollamaUrl}
							/>
						</label>
					)}
				</div>

				<div className="mt-6 flex items-center gap-3 border-zinc-800/40 border-t pt-5">
					<button
						className="btn-primary"
						disabled={saving}
						onClick={handleSave}
						type="button"
					>
						{saving ? "Saving..." : "Save Changes"}
					</button>
					{saved && (
						<span className="flex items-center gap-1.5 text-emerald-400 text-sm">
							<svg
								className="h-3.5 w-3.5"
								fill="currentColor"
								viewBox="0 0 16 16"
							>
								<path
									clipRule="evenodd"
									d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
									fillRule="evenodd"
								/>
							</svg>
							Saved
						</span>
					)}
				</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				{config && (
					<div className="card fade-in-up stagger-2 p-6">
						<h2 className="mb-4 font-semibold text-sm text-zinc-200">Info</h2>
						<dl className="space-y-3">
							<div className="flex items-center justify-between text-sm">
								<dt className="text-zinc-500">Created</dt>
								<dd className="text-zinc-300">
									{config.createdAt || "unknown"}
								</dd>
							</div>
							<div className="flex items-center justify-between text-sm">
								<dt className="text-zinc-500">Last indexed commit</dt>
								<dd className="font-mono text-xs text-zinc-300">
									{config.lastIndexedCommit ?? "never"}
								</dd>
							</div>
							<div className="flex items-center justify-between text-sm">
								<dt className="text-zinc-500">Scope</dt>
								<dd className="text-zinc-300">{config.scope || "default"}</dd>
							</div>
						</dl>
					</div>
				)}

				{stats && (
					<div className="card fade-in-up stagger-3 p-6">
						<h2 className="mb-4 font-semibold text-sm text-zinc-200">
							Storage
						</h2>
						<div className="flex items-center gap-8">
							<div className="text-center">
								<div className="font-bold text-2xl text-zinc-100 tabular-nums">
									<AnimatedNumber value={stats.totalChunks} />
								</div>
								<div className="mt-1 text-xs text-zinc-500">Chunks</div>
							</div>
							<div className="h-8 w-px bg-zinc-800" />
							<div className="text-center">
								<div className="font-bold text-2xl text-zinc-100 tabular-nums">
									<AnimatedNumber value={stats.totalSymbols} />
								</div>
								<div className="mt-1 text-xs text-zinc-500">Symbols</div>
							</div>
						</div>
					</div>
				)}
			</div>

			<div className="card fade-in-up stagger-4 border-red-900/20 bg-red-950/5 p-6">
				<h2 className="mb-1 font-semibold text-red-400 text-sm">Danger Zone</h2>
				<p className="mb-4 text-sm text-zinc-500">
					Drop the vector store and recreate it empty. All indexed data will be
					lost.
				</p>

				{resetConfirm ? (
					<div className="flex items-center gap-3">
						<button
							className="rounded-xl bg-red-600 px-5 py-2.5 font-medium text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
							disabled={resetting}
							onClick={handleReset}
							type="button"
						>
							{resetting ? "Resetting..." : "Confirm Reset"}
						</button>
						<button
							className="btn-ghost"
							onClick={() => setResetConfirm(false)}
							type="button"
						>
							Cancel
						</button>
					</div>
				) : (
					<button
						className="btn-danger"
						onClick={() => setResetConfirm(true)}
						type="button"
					>
						Reset Memory Store
					</button>
				)}

				{resetResult && (
					<p className="mt-4 text-sm text-zinc-400">{resetResult}</p>
				)}
			</div>
		</div>
	);
}
