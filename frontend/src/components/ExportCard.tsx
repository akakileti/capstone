import { useMemo } from "react";

import { exportPlanToExcel } from "../lib/exportExcel";
import type { ProjectionRow } from "../lib/api";
import type { Plan } from "../lib/schemas";

interface ExportCardProps {
  plan: Plan;
  rows: ProjectionRow[];
  loading?: boolean;
}

export function ExportCard({ plan, rows, loading }: ExportCardProps) {
  const disabled = loading || rows.length === 0;
  const helperText = useMemo(() => {
    if (loading) return "Crunching numbers… export will unlock when ready.";
    if (!rows.length) return "Generate a projection to enable export.";
    return "Download every year and calculation as an Excel file.";
  }, [loading, rows.length]);

  const handleExport = () => {
    if (disabled) return;
    try {
      exportPlanToExcel(plan, rows);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  };

  return (
    <section className="rounded-3xl border border-slate-300 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Export</h3>
          <p className="text-xs text-slate-500">{helperText}</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={disabled}
          className="rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Export to Excel
        </button>
      </div>
    </section>
  );
}
