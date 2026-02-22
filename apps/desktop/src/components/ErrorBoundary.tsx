import { Component, type PropsWithChildren } from "react";

interface State {
	error: Error | null;
}

// biome-ignore lint: Error Boundaries require class components in React
export default class ErrorBoundary extends Component<PropsWithChildren, State> {
	state: State = { error: null };

	static getDerivedStateFromError(error: Error): State {
		return { error };
	}

	render() {
		const { error } = this.state;
		if (!error) {
			return this.props.children;
		}

		return (
			<div className="flex h-screen items-center justify-center bg-zinc-950 p-8">
				<div className="max-w-md rounded-2xl border border-zinc-800/60 bg-zinc-900/80 p-8 text-center shadow-xl">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10">
						<svg
							aria-hidden="true"
							className="h-6 w-6 text-red-400"
							fill="currentColor"
							viewBox="0 0 16 16"
						>
							<path
								clipRule="evenodd"
								d="M2.343 13.657A8 8 0 1 1 13.657 2.343 8 8 0 0 1 2.343 13.657ZM6.03 4.97a.75.75 0 0 0-1.06 1.06L6.94 8 4.97 9.97a.75.75 0 1 0 1.06 1.06L8 9.06l1.97 1.97a.75.75 0 1 0 1.06-1.06L9.06 8l1.97-1.97a.75.75 0 1 0-1.06-1.06L8 6.94 6.03 4.97Z"
								fillRule="evenodd"
							/>
						</svg>
					</div>
					<h2 className="mb-2 font-semibold text-lg text-zinc-100">
						Something went wrong
					</h2>
					<p className="mb-4 text-sm text-zinc-400">{error.message}</p>
					<pre className="mb-6 max-h-32 overflow-auto rounded-xl bg-zinc-950/80 p-3 text-left font-mono text-[11px] text-zinc-600">
						{error.stack?.split("\n").slice(0, 5).join("\n")}
					</pre>
					<button
						className="rounded-xl bg-indigo-600 px-4 py-2.5 font-medium text-sm text-white transition-colors hover:bg-indigo-500"
						onClick={() => this.setState({ error: null })}
						type="button"
					>
						Try Again
					</button>
				</div>
			</div>
		);
	}
}
