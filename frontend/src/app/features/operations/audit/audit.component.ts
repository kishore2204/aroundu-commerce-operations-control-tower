import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { AuditLogService } from '../../../core/services/audit-log.service';
import { AuditLog } from '../../../core/models/audit-log.model';
import { formatAuditAction, formatAuditModule } from '../../../core/api/audit-action.util';

@Component({
  selector: 'app-operations-audit',
  standalone: true,
  imports: [DatePipe, EmptyStateComponent],
  templateUrl: './audit.component.html',
  styleUrl: './audit.component.css',
})
export class OperationsAuditComponent implements OnInit {
  readonly logs = signal<AuditLog[]>([]);
  readonly loading = signal(true);

  /** What the screen and CSV show: the business action and module, never the stored HTTP
   *  method / API path / ids (those stay in the log itself). Computed once per load. */
  readonly rows = computed(() =>
    this.logs().map((log) => ({
      auditLogId: log.auditLogId,
      action: formatAuditAction(log),
      module: formatAuditModule(log),
      performedAt: log.performedAt,
      ipAddress: log.ipAddress,
    })),
  );

  constructor(private readonly auditLogService: AuditLogService) {}

  ngOnInit(): void {
    this.auditLogService.list().subscribe({
      next: (logs) => {
        this.logs.set(logs.sort((a, b) => b.performedAt.localeCompare(a.performedAt)));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Client-side CSV export (Excel opens .csv natively) - no server-side export endpoint
   *  exists, and the full log list is already in memory from ngOnInit. */
  exportCsv(): void {
    const header = ['Action', 'Source module', 'Performed at', 'IP address'];
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = this.rows().map((row) =>
      [row.action, row.module, row.performedAt, row.ipAddress || ''].map(escape).join(','),
    );
    const csv = [header.map(escape).join(','), ...rows].join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
