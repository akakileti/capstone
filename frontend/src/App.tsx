import { useCallback, useEffect, useMemo, useState } from "react";

import CalculatorPage from "./pages/CalculatorPage";
import HomePage from "./pages/HomePage";

type Route = "/" | "/calculator";

const normalizePath = (path: string): Route => {
  if (path === "/calculator") return "/calculator";
  return "/";
};

export default function App() {
  const [path, setPath] = useState<Route>(() => normalizePath(window.location.pathname));

  useEffect(() => {
    const onPopState = () => setPath(normalizePath(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback(
    (next: Route) => {
      const normalized = normalizePath(next);
      if (normalized === path) return;
      window.history.pushState({}, "", normalized);
      setPath(normalized);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [path]
  );

  const navItems = useMemo(
    () => [
      { label: "Home", path: "/" as Route },
      { label: "Calculator", path: "/calculator" as Route },
    ],
    []
  );

  const page = path === "/calculator" ? (
    <CalculatorPage />
  ) : (
    <HomePage onStart={() => navigate("/calculator")} />
  );

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <nav className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold tracking-tight">Retirement Projection Studio</p>
            <p className="text-xs text-slate-500">Plan, compare, and project with multiple growth cases.</p>
          </div>
          <div className="flex items-center gap-3">
            {navItems.map((item) => {
              const isActive = path === item.path;
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={[
                    "rounded-full px-4 py-2 text-sm font-semibold transition",
                    isActive
                      ? "bg-slate-900 text-white shadow"
                      : "text-slate-700 hover:text-slate-900 hover:bg-slate-100",
                  ].join(" ")}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>

        {page}
      </div>
    </div>
  );
}
