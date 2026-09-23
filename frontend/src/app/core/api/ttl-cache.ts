import { Observable, catchError, shareReplay, throwError } from 'rxjs';

/*
##################################################################

                                           CR_CHG0030033_Performance_Optimization_3232575_3235381

#####################################################################
*/
/**
 * Tiny in-memory cache for read-only REFERENCE data (product categories, city/zone lists, product
 * image lists) - the kind that changes rarely and is identical for every user. Concurrent callers
 * share one in-flight request and later callers within `ttlMs` reuse its result, so revisiting a
 * page or navigating back no longer re-requests the same list.
 *
 * Never use it for anything user-specific or time-critical (cart, checkout totals, orders,
 * payments, stock, permissions, auth state) - those must always come from the server.
 *
 * A failed load is dropped immediately, so the next call retries instead of replaying the error.
 */
export class TtlCache<K, V> {
  private readonly entries = new Map<K, { expiresAt: number; source: Observable<V> }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 500,
  ) {}

  get(key: K, load: () => Observable<V>): Observable<V> {
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.source;

    if (this.entries.size >= this.maxEntries) this.entries.clear();
    const source: Observable<V> = load().pipe(
      catchError((error) => {
        if (this.entries.get(key)?.source === source) this.entries.delete(key);
        return throwError(() => error);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.entries.set(key, { expiresAt: Date.now() + this.ttlMs, source });
    return source;
  }

  /** Drops everything - call after any write that changes the cached data. */
  clear(): void {
    this.entries.clear();
  }
}
