import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { QueueDetailComponent } from './queue-detail.component';
import { VerificationQueueService } from '../../../core/services/verification-queue.service';
import { VerificationDocumentService } from '../../../core/services/verification-document.service';
import { RetailerService } from '../../../core/services/retailer.service';
import { FleetOwnerService } from '../../../core/services/fleet-owner.service';
import { AuthService } from '../../../core/auth/auth.service';
import { VerificationQueue } from '../../../core/models/verification.model';

describe('QueueDetailComponent', () => {
  const queue: VerificationQueue = {
    verificationQueueId: 'q1',
    subjectType: 'DRIVER',
    subjectId: 'subject-1',
    zoneId: null,
    isActive: true,
    submittedByAccountId: 'acct-2',
    reviewedByAccountId: null,
    verificationStatus: 'SENT_TO_LOCATION_MANAGER',
    rejectionReason: null,
    suspensionReason: null,
    deletionReason: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  function setup() {
    const get = jasmine.createSpy().and.returnValue(of(queue));
    const processResult = jasmine.createSpy().and.returnValue(of(undefined));
    TestBed.configureTestingModule({
      imports: [QueueDetailComponent],
      providers: [
        { provide: VerificationQueueService, useValue: { get, processResult } },
        { provide: VerificationDocumentService, useValue: { byQueue: () => of([]) } },
        { provide: RetailerService, useValue: { get: () => of(null) } },
        { provide: FleetOwnerService, useValue: { get: () => of(null) } },
        { provide: AuthService, useValue: { role: () => null, userAccountId: () => 'acct-1' } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'q1' }) } } },
      ],
    });
    const fixture = TestBed.createComponent(QueueDetailComponent);
    return { fixture, processResult };
  }

  it('should create', () => {
    const { fixture } = setup();
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('approves by calling processResult with the loaded queue id', () => {
    const { fixture, processResult } = setup();
    fixture.detectChanges();

    fixture.componentInstance.approve();

    expect(processResult).toHaveBeenCalledWith('q1', 'APPROVED', undefined);
  });

  it('does not reject without a reason, and rejects with the reason once provided', () => {
    const { fixture, processResult } = setup();
    fixture.detectChanges();

    fixture.componentInstance.reject();
    expect(processResult).not.toHaveBeenCalled();

    fixture.componentInstance.reasonControl.setValue('Missing documents');
    fixture.componentInstance.reject();

    expect(processResult).toHaveBeenCalledWith('q1', 'REJECTED', 'Missing documents');
  });
});
