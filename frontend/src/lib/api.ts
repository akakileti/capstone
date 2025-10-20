import { projectBalances, type ProjectionCase } from "./calc";
import type { Plan } from "./schemas";

export async function runProjection(plan: Plan): Promise<ProjectionCase[]> {
  // Later: switch this to an axios POST to the Flask API.
  return projectBalances(plan);
}
