import { formatCurrency } from "./calc";
import { formatPercentage } from "./number-format";
import type { ProjectionRow } from "./api";
import type { Account, Plan, SpendingRow } from "./schemas";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function makeTable(headers: string[], rows: Array<Array<string | number>>): string {
  const headerRow = `<tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>`;
  const bodyRows = rows
    .map(
      (cells) =>
        `<tr>${cells
          .map((cell) => `<td>${typeof cell === "number" ? cell : escapeHtml(cell)}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  return `<table>${headerRow}${bodyRows}</table>`;
}

function summarizeSavings(accounts: Account[]): string {
  if (!accounts.length) return "No accounts configured";
  return accounts
    .map((account, index) => {
      const label = `${account.label || "Account"} (#${index + 1})`;
      if (!account.contributions.length) {
        return `${label}: no scheduled contributions`;
      }
      const rows = account.contributions
        .map((row) => {
          const years = row.years ?? "until next breakpoint/retirement";
          return `From age ${row.fromAge}, ${formatCurrency(row.base)} per year, growth ${formatPercentage(row.growthRate)}, years ${years}`;
        })
        .join("; ");
      return `${label}: ${rows}`;
    })
    .join("<br/>");
}

function spendingRowLabel(row: SpendingRow, startAge: number, inflation: number): string {
  const endAge = row.years ? row.fromAge + row.years : undefined;
  const yearsAhead = Math.max(row.fromAge - startAge, 0);
  const futureValue = row.annualSpending * Math.pow(1 + inflation, yearsAhead);
  const rangeLabel = endAge ? `Age ${row.fromAge}-${endAge}` : `Age ${row.fromAge}+`;
  return `${rangeLabel}: ${formatCurrency(row.annualSpending)} / yr today ≈ ${formatCurrency(futureValue)} nominal`;
}

function makeProjectionTable(rows: ProjectionRow[]): string {
  const headers = [
    "Age",
    "Contribution",
    "Spending (min)",
    "Spending (avg)",
    "Spending (max)",
    "Savings (min)",
    "Savings (avg)",
    "Savings (max)",
  ];

  const body = rows.map((row) => [
    row.age,
    formatCurrency(row.contribution),
    formatCurrency(row.spending.min),
    formatCurrency(row.spending.avg),
    formatCurrency(row.spending.max),
    formatCurrency(row.savings.min),
    formatCurrency(row.savings.avg),
    formatCurrency(row.savings.max),
  ]);

  return makeTable(headers, body);
}

export function exportPlanToExcel(plan: Plan, rows: ProjectionRow[]): void {
  if (!rows.length) {
    throw new Error("No projection data to export. Run a calculation first.");
  }

  const growthBand = {
    min: plan.investmentGrowthRate - plan.investmentGrowthMargin,
    avg: plan.investmentGrowthRate,
    max: plan.investmentGrowthRate + plan.investmentGrowthMargin,
  };

  const inflationBand = {
    min: Math.max(plan.inflationRate - plan.inflationMargin, 0),
    avg: plan.inflationRate,
    max: plan.inflationRate + plan.inflationMargin,
  };

  const basics = makeTable(
    ["Basic Information", "Value"],
    [
      ["Current Age", plan.startAge],
      ["Retirement Age", plan.retireAge],
      ["Current Savings", formatCurrency(plan.initialBalance ?? 0)],
      ["Desired Annual Retirement Spending", formatCurrency(plan.startingRetirementSpending ?? 0)],
    ],
  );

  const assumptions = makeTable(
    ["Growth Assumptions", "Value"],
    [
      ["Annual Inflation", formatPercentage(plan.inflationRate)],
      ["Inflation Error Margin", formatPercentage(plan.inflationMargin)],
      ["Investment Growth Rate", formatPercentage(plan.investmentGrowthRate)],
      ["Investment Error Margin", formatPercentage(plan.investmentGrowthMargin)],
    ],
  );

  const savingsSummary = makeTable(
    ["Edit Savings Progression", "Details"],
    [[`Accounts (${plan.accounts.length || 0})`, summarizeSavings(plan.accounts)]],
  );

  const spendingRows =
    plan.spendingSchedule.length === 0
      ? [["Schedule", "No retirement spending overrides"]]
      : plan.spendingSchedule
          .slice()
          .sort((a, b) => a.fromAge - b.fromAge)
          .map((row, index) => [
            `Edit Retirement Spending (${index + 1})`,
            spendingRowLabel(row, plan.startAge, plan.inflationRate),
          ]);
  const spendingTable = makeTable(["Edit Retirement Spending", "Details"], spendingRows);

  const calculations = makeTable(
    ["Calculations", "min", "avg", "max"],
    [
      [
        "Growth",
        formatPercentage(growthBand.min),
        formatPercentage(growthBand.avg),
        formatPercentage(growthBand.max),
      ],
      [
        "Inflation",
        formatPercentage(inflationBand.min),
        formatPercentage(inflationBand.avg),
        formatPercentage(inflationBand.max),
      ],
    ],
  );

  const projectionTable = makeProjectionTable(rows);

  const html = `
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Projection Export</title>
    <style>
      body { font-size: 10pt; }
      table { border-collapse: collapse; margin: 8px 0; }
      th, td { padding: 2px 4px; }
    </style>
  </head>
  <body>
    <div>Detailed Compound Interest Calculator Export</div>
    <div>Snapshot of your current inputs, assumptions, and full projection timeline.</div>
    ${basics}
    ${assumptions}
    ${savingsSummary}
    ${spendingTable}
    ${calculations}
    <div>Full Projection (all years)</div>
    ${projectionTable}
  </body>
</html>
  `;

  const blob = new Blob([html], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "projection-export.xlsx";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
