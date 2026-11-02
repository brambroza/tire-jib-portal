export const IMAGE_VECTOR_SIZE = 1024;

export function buildImageVectorFromBuffer(arrayBuffer: ArrayBuffer): number[] {
  const bytes = new Uint8Array(arrayBuffer);
  const vector = new Array<number>(IMAGE_VECTOR_SIZE).fill(0);
  if (bytes.length === 0) return vector;

  for (let i = 0; i < bytes.length; i += 1) {
    const index = i % IMAGE_VECTOR_SIZE;
    const centered = (bytes[i] - 127.5) / 127.5;
    vector[index] += centered;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(norm) || norm === 0) return vector;
  return vector.map((value) => value / norm);
}

export function parseVectorValue(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map((item) => Number(item)).filter((item) => Number.isFinite(item));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return [];
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item));
  }
  return [];
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
