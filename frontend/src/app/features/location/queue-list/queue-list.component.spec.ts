import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { QueueListComponent } from './queue-list.component';
import { VerificationQueueService } from '../../../core/services/verification-queue.service';
import { RetailerService } from '../../../core/services/retailer.service';
import { FleetOwnerService } from '../../../core/services/fleet-owner.service';
import { AuthService } from '../../../core/auth/auth.service';
import { VerificationQueue } from '../../../core/models/verification.model';

describe('QueueListComponent', () => {
  function entry(id: string, createdAt: string): VerificationQueue {
    return {
      verificationQueueId: id,
      subjectType: 'RETAILER',
      subjectId: 'subject-1',
      zoneId: null,
      isActive: true,
      submittedByAccountId: 'acct-1',
      reviewedByAccountId: null,
      verificationStatus: 'SENT_TO_LOCATION_MANAGER',
      rejectionReason: null,
      suspensionReason: null,
      deletionReason: null,
      createdAt,
      updatedAt: createdAt,
    };
  }

  function setup(byStatusResult: VerificationQueue[] = [], allResult: VerificationQueue[] = []) {
    const byStatus = jasmine.createSpy().and.returnValue(of(byStatusResult));
    const all = jasmine.createSpy().and.returnValue(of(allResult));
    TestBed.configureTestingModule({
      imports: [QueueListComponent],
      providers: [
        { provide: VerificationQueueService, useValue: { byStatus, all } },
        { provide: AuthService, useValue: { role: () => null } },
        { provide: RetailerService, useValue: { get: () => of(null) } },
        { provide: FleetOwnerService, useValue: { get: () => of(null) } },
        provideRouter([]),
      ],
    });
    const fixture = TestBed.createComponent(QueueListComponent);
    return { fixture, byStatus, all };
  }

  it('should create', () => {
    const { fixture } = setup();
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('loads entries for the default status filter, newest first', () => {
    const older = entry('q1', '2026-01-01T00:00:00Z');
    const newer = entry('q2', '2026-02-01T00:00:00Z');
    const { fixture, byStatus } = setup([older, newer]);
    fixture.detectChanges();

    expect(byStatus).toHaveBeenCalledWith('SENT_TO_LOCATION_MANAGER');
    expect(fixture.componentInstance.entries().map((e) => e.verificationQueueId)).toEqual(['q2', 'q1']);
  });

  it('re-loads via all() when the status filter is switched to ALL', () => {
    const { fixture, all } = setup([], [entry('q3', '2026-03-01T00:00:00Z')]);
    fixture.detectChanges();

    fixture.componentInstance.statusControl.setValue('ALL');

    expect(all).toHaveBeenCalled();
    expect(fixture.componentInstance.entries().map((e) => e.verificationQueueId)).toEqual(['q3']);
  });
});
