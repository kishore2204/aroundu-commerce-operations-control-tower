import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ExpenseType, FleetExpense } from '../models/fleet-expense.model';

export interface CreateExpenseRequest {
  fleetOwnerId?: string;
  vehicleId?: string | null;
  driverId?: string | null;
  expenseType: ExpenseType;
  amount: number;
  expenseDate: string;
}

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  constructor(private readonly http: HttpClient) {}

  /** This fleet owner's own expenses (GET /api/expenses/mine?fleetOwnerId=). */
  mine(fleetOwnerId: string): Observable<FleetExpense[]> {
    const params = new HttpParams().set('fleetOwnerId', fleetOwnerId);
    return this.http.get<FleetExpense[]>('/api/expenses/mine', { params });
  }

  /** Records a new expense - a FLEET_MANAGER or the DRIVER who incurred it (e.g. fuel, toll
   *  during a trip) can both call this; it then shows up in the fleet owner's /fleet/expenses. */
  create(request: CreateExpenseRequest): Observable<FleetExpense> {
    return this.http.post<FleetExpense>('/api/expenses', request);
  }

  /** Uploads/replaces the proof-of-expense file (receipt photo/PDF, max 10MB) for an expense. */
  uploadProof(expenseId: string, file: File): Observable<FleetExpense> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<FleetExpense>(`/api/expenses/${expenseId}/proof`, formData);
  }

  /** Raw proof file bytes - fetched through HttpClient so the auth interceptor attaches the JWT. */
  proofFileBlob(expenseId: string): Observable<Blob> {
    return this.http.get(`/api/expenses/${expenseId}/proof`, { responseType: 'blob' });
  }

  /** Fleet owner accepts the expense for reimbursement. */
  approve(expenseId: string): Observable<FleetExpense> {
    return this.http.patch<FleetExpense>(`/api/expenses/${expenseId}/approve`, {});
  }

  reject(expenseId: string): Observable<FleetExpense> {
    return this.http.patch<FleetExpense>(`/api/expenses/${expenseId}/reject`, {});
  }
}
