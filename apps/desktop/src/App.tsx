import { Route, Routes } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import Layout from "@/components/Layout";
import Code from "@/pages/Code";
import Dashboard from "@/pages/Dashboard";
import Diff from "@/pages/Diff";
import Insights from "@/pages/Insights";
import Search from "@/pages/Search";
import Settings from "@/pages/Settings";
import Sync from "@/pages/Sync";

export default function App() {
	return (
		<ErrorBoundary>
			<Layout>
				<Routes>
					<Route element={<Dashboard />} path="/" />
					<Route element={<Insights />} path="/insights" />
					<Route element={<Search />} path="/search" />
					<Route element={<Code />} path="/code" />
					<Route element={<Sync />} path="/sync" />
					<Route element={<Diff />} path="/diff" />
					<Route element={<Settings />} path="/settings" />
				</Routes>
			</Layout>
		</ErrorBoundary>
	);
}
