const rawBase = import.meta.env.VITE_API_BASE_URL?.trim();
// Strip a trailing slash to keep URL joins predictable.
export const API_BASE_URL = rawBase && rawBase.length > 0 ? rawBase.replace(/\/$/, "") : null;

export const API_CONFIG_ERROR =
  import.meta.env.PROD && !API_BASE_URL ? "VITE_API_BASE_URL is not set" : null;
