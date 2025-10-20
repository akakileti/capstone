export function formatPercentage(value: number, options: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat(undefined, {
    style: "percent",
    maximumFractionDigits: 1,
    ...options,
  }).format(value);
}
