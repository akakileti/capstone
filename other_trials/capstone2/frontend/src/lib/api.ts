import axios from "axios";

import type { ProjectionCase, ProjectionPayload, StoredProjectionRecord } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4050";

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 10_000,
});

export async function fetchProjection(payload: ProjectionPayload): Promise<ProjectionCase[]> {
  const { data } = await client.post<ProjectionCase[]>("/api/calc/accumulation", payload);
  return data;
}

type LatestResponse = StoredProjectionRecord | { payload: null; result: []; createdAt: null };

export async function fetchLatestProjection(): Promise<StoredProjectionRecord | null> {
  const { data } = await client.get<LatestResponse>("/api/calc/latest");
  if (!data || data.payload === null) {
    return null;
  }
  return data;
}
