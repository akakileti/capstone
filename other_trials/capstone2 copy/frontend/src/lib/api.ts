import axios from "axios";

export async function fetchProjection(payload: any) {
  const { data } = await axios.post(
    "http://127.0.0.1:5050/api/calc/accumulation",
    payload,
    { headers: { "Content-Type": "application/json" } }
  );
  return data; // ProjectionCase[]
}
