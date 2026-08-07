/**
 * Cache in-memory sederhana dengan TTL.
 *
 * Catatan deployment: kalau nanti di-deploy serverless (Vercel) dengan banyak
 * instance, tiap instance punya cache-nya sendiri. Itu masih oke untuk data
 * struktur organisasi yang jarang berubah. Kalau butuh cache bersama,
 * ganti implementasi di sini dengan Redis/Upstash tanpa mengubah pemanggilnya.
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();

export function getCached<T>(key: string): T | null {
  const entry = store.get(key) as Entry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function setCached<T>(key: string, value: T, ttlSeconds: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export function clearCache(key?: string): void {
  if (key) store.delete(key);
  else store.clear();
}
