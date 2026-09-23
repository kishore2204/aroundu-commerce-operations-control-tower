import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import {
  CurrentUser, UpdateCurrentUserRequest,
  CustomerRegistrationRequest,
  ForgotPasswordResponse,
  LoginRequest,
  LoginResponse,
  ResetPasswordRequest,
  Role,
} from '../models/user.model';

const STORAGE_KEY = 'aroundu.session';

interface StoredSession {
  accessToken: string;
  role: Role;
  userAccountId: string;
  email: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly session = signal<StoredSession | null>(this.readStoredSession());

  readonly accessToken = computed(() => this.session()?.accessToken ?? null);
  readonly role = computed(() => this.session()?.role ?? null);
  readonly userAccountId = computed(() => this.session()?.userAccountId ?? null);
  readonly email = computed(() => this.session()?.email ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly isCustomer = computed(() => this.role() === 'CUSTOMER');

  constructor(private readonly http: HttpClient) {}

  login(request: LoginRequest): Observable<LoginResponse> {
    this.logout();
    return this.http.post<LoginResponse>('/api/v1/auth/login', request).pipe(
      tap((response) => this.storeSession(response)),
    );
  }

  registerCustomer(request: CustomerRegistrationRequest): Observable<unknown> {
    return this.http.post('/api/v1/auth/register/customer', request);
  }

  register(request: import('../models/user.model').PublicRegistrationRequest): Observable<unknown> {
    return this.http.post('/api/v1/auth/register', request);
  }

  forgotPassword(email: string): Observable<ForgotPasswordResponse> {
    return this.http.post<ForgotPasswordResponse>('/api/v1/auth/forgot-password', { email });
  }

  resetPassword(request: ResetPasswordRequest): Observable<unknown> {
    return this.http.post('/api/v1/auth/reset-password', request);
  }


  fetchCurrentUser(): Observable<CurrentUser> {
    return this.http.get<CurrentUser>('/api/v1/users/me');
  }

  updateCurrentUser(request: UpdateCurrentUserRequest): Observable<CurrentUser> {
    return this.http.put<CurrentUser>('/api/v1/users/me', request);
  }

  logout(): void {
    this.session.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  private storeSession(response: LoginResponse): void {
    const session: StoredSession = {
      accessToken: response.accessToken,
      role: response.role,
      userAccountId: response.userAccountId,
      email: response.email,
    };
    this.session.set(session);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  private readStoredSession(): StoredSession | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as StoredSession) : null;
    } catch {
      return null;
    }
  }
}
