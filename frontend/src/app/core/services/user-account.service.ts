import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { TtlCache } from '../api/ttl-cache';
import { UserAccount, UserAccountRequest } from '../models/user-account.model';

@Injectable({ providedIn: 'root' })
export class UserAccountService {
  constructor(private readonly http: HttpClient) {}

  /** The full account list is unpaginated and is independently fetched by both the Admin dashboard
   *  (for its role-count chart) and the Accounts screen - a 60s cache means navigating between the
   *  two within that window reuses the same response instead of fetching it twice. Cleared on any
   *  mutation so a create/status-change/delete is reflected on the very next read. */
  private readonly listCache = new TtlCache<'all', UserAccount[]>(60_000);

  /** `fresh` skips the remembered list: the Accounts screen is where an admin checks the CURRENT status of an account, and a
   *  status can be changed by someone else (e.g. a Location Manager blocking a retailer), which this session's own
   *  mutations cannot clear. The dashboard's role counts are fine with the short-lived copy. */
  all(fresh = false): Observable<UserAccount[]> {
    if (fresh) this.listCache.clear();
    return this.listCache.get('all', () => this.http.get<UserAccount[]>('/api/user-accounts'));
  }

  /** Backs the officer search-selects on the Operations Managers / Officers assignment forms - avoids admins needing to type a raw user account UUID. */
  byRole(role: string): Observable<UserAccount[]> {
    return this.http.get<UserAccount[]>(`/api/user-accounts/role/${role}`);
  }

  create(request: UserAccountRequest): Observable<UserAccount> {
    return this.http.post<UserAccount>('/api/user-accounts', request).pipe(tap(() => this.listCache.clear()));
  }

  setStatus(id: string, accountStatus: string): Observable<UserAccount> {
    return this.http.patch<UserAccount>(`/api/user-accounts/${id}/status`, { accountStatus }).pipe(tap(() => this.listCache.clear()));
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`/api/user-accounts/${id}`).pipe(tap(() => this.listCache.clear()));
  }
}
