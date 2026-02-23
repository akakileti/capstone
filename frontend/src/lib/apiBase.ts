const rawBase = import.meta.env.VITE_API_BASE_URL?.trim();

if (import.meta.env.PROD && (!rawBase || rawBase.length === 0)) {
  throw new Error("VITE_API_BASE_URL is not set");
}

// Strip a trailing slash to keep URL joins predictable.
export const API_BASE_URL = rawBase ? rawBase.replace(/\/$/, "") : "";
