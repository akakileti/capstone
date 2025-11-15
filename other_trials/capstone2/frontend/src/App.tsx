import { useEffect, useMemo, useState } from "react";

import { ChartPanel } from "./components/ChartPanel";
import Sidebar from "./components/Sidebar";
import { fetchLatestProjection, fetchProjection } from "./lib/api";
import { formatCurrency } from "./lib/calc";
import type {
  BasicInfo,
  Breakpoint,
  GrowthAssumptions,
  ProjectionCase,
  ProjectionPayload,
  SavingsPlan,
} from "./lib/types";
import "./App.css";

const BASIC_DEFAULTS: BasicInfo = {
  currentAge: 30,
  retirementAge: 65,
  currentSavings: 30000,
  retirementSpendingRaw: 40000,
};

const GROWTH_DEFAULTS: GrowthAssumptions = {
  annualInflation: 0.03,
  inflationErrorMargin: 0.02,
  investmentReturnRate: 0.06,
  investmentReturnErrorMargin: 0.02,
};

const BREAKPOINT_DEFAULTS: Breakpoint[] = [
  { fromAge: 30, base: 6000, changeYoY: 0.03, years: 35 },
];

function App() {
  const [basicInfo, setBasicInfo] = useState<BasicInfo>(BASIC_DEFAULTS);
  const [growthAssumptions, setGrowthAssumptions] =
    useState<GrowthAssumptions>(GROWTH_DEFAULTS);
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>(BREAKPOINT_DEFAULTS);

  const [projectionCases, setProjectionCases] = useState<ProjectionCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    fetchLatestProjection()
      .then((record) => {
        if (ignore || !record) return;
        if (record.payload.basicInfo) {
          setBasicInfo(record.payload.basicInfo);
        }
        if (record.payload.growthAssumptions) {
          setGrowthAssumptions(record.payload.growthAssumptions);
        }
        if (record.payload.savingsPlan?.breakpoints?.length) {
          setBreakpoints(record.payload.savingsPlan.breakpoints);
        }
        if (record.result?.length) {
          setProjectionCases(record.result);
        }
      })
      .catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, []);

  const savingsPlan: SavingsPlan = useMemo(
    () => ({
      breakpoints: breakpoints.map((row) => ({
        fromAge: row.fromAge,
        base: row.base,
        changeYoY: row.changeYoY,
        ...(typeof row.years === "number" ? { years: row.years } : {}),
      })),
    }),
    [breakpoints]
  );

  const payload: ProjectionPayload = useMemo(
    () => ({
      basicInfo,
      growthAssumptions,
      savingsPlan,
      yearsAfterRetirement: 30,
      spendingChangeYoY: 0,
    }),
    [basicInfo, growthAssumptions, savingsPlan]
  );

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      setLoading(true);
      setError(null);
      fetchProjection(payload)
        .then((result) => {
          if (cancelled) return;
          setProjectionCases(result);
        })
        .catch((err) => {
          if (cancelled) return;
          const message =
            err?.response?.data?.message ?? "Unable to calculate projection. Please try again.";
          setError(message);
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [payload]);

  const warnings = useMemo(() => {
    const next: string[] = [];
    if (basicInfo.retirementAge <= basicInfo.currentAge) {
      next.push("retirement age must be higher than current age.");
    }
    if (breakpoints.length === 0) {
      next.push("add at least one contribution breakpoint for more realistic projections.");
    }
    return next;
  }, [basicInfo.currentAge, basicInfo.retirementAge, breakpoints.length]);

  const formattedFirstWithdrawal = useMemo(() => {
    const yearsToRetirement = Math.max(basicInfo.retirementAge - basicInfo.currentAge, 0);
    const firstNominal =
      basicInfo.retirementSpendingRaw *
      Math.pow(1 + growthAssumptions.annualInflation, yearsToRetirement);
    return formatCurrency(firstNominal || 0);
  }, [basicInfo, growthAssumptions]);

  const totalScheduledContribution = useMemo(() => {
    const total = breakpoints.reduce((sum, row, index) => {
      const years = resolveYearsForRow(row, breakpoints[index + 1], basicInfo.retirementAge);
      if (!years) return sum;
      let subtotal = 0;
      for (let i = 0; i < years; i += 1) {
        subtotal += row.base * Math.pow(1 + row.changeYoY, i);
      }
      return sum + subtotal;
    }, 0);
    return formatCurrency(Math.round(total));
  }, [breakpoints, basicInfo.retirementAge]);

  const handleBasicInfoChange = (field: keyof BasicInfo, value: number) => {
    setBasicInfo((prev) => ({ ...prev, [field]: value }));
  };

  const handleGrowthChange = (field: keyof GrowthAssumptions, value: number) => {
    setGrowthAssumptions((prev) => ({ ...prev, [field]: value }));
  };

  const handleBreakpointChange = <K extends keyof Breakpoint>(
    index: number,
    field: K,
    value: Breakpoint[K]
  ) => {
    setBreakpoints((prev) =>
      prev.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row))
    );
  };

  const handleAddBreakpoint = () => {
    setBreakpoints((prev) => {
      const last = prev[prev.length - 1];
      const nextFromAge = Math.min(
        (last ? last.fromAge + (last.years ?? 5) : basicInfo.currentAge + 5),
        basicInfo.retirementAge
      );
      return [
        ...prev,
        {
          fromAge: nextFromAge,
          base: last ? Math.round(last.base * (1 + last.changeYoY)) : 5000,
          changeYoY: last ? last.changeYoY : 0.02,
          years: 5,
        },
      ];
    });
  };

  const handleRemoveBreakpoint = (index: number) => {
    setBreakpoints((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  };

  return (
    <div className="app-shell">
      <div className="app-content">
        <Sidebar
          basicInfo={basicInfo}
          growthAssumptions={growthAssumptions}
          breakpoints={breakpoints}
          onBasicInfoChange={handleBasicInfoChange}
          onGrowthChange={handleGrowthChange}
          onBreakpointChange={handleBreakpointChange}
          onAddBreakpoint={handleAddBreakpoint}
          onRemoveBreakpoint={handleRemoveBreakpoint}
          formattedFirstWithdrawal={formattedFirstWithdrawal}
          totalScheduledContribution={totalScheduledContribution}
        />

        <main className="chart-area">
          <ChartPanel cases={projectionCases} warnings={warnings} loading={loading} error={error} />
          <footer className="disclaimer">
            Educational illustration only. Adapt the assumptions to match your financial plan.
          </footer>
        </main>
      </div>
    </div>
  );
}

function resolveYearsForRow(current: Breakpoint, nextRow: Breakpoint | undefined, retirementAge: number) {
  if (typeof current.years === "number") {
    return current.years;
  }
  if (nextRow) {
    return Math.max(nextRow.fromAge - current.fromAge, 0);
  }
  return Math.max(retirementAge - current.fromAge, 0);
}

export default App;
