package com.cbg.lbos.service;

import org.springframework.stereotype.Component;
import com.cbg.lbos.entity.AssignmentStatus;
import com.cbg.lbos.entity.OperationsManager;
import com.cbg.lbos.entity.UserAccount;
import com.cbg.lbos.exception.ConflictException;
import com.cbg.lbos.repository.OperationsManagerRepository;
import com.cbg.lbos.repository.UserAccountRepository;

/**
 * Keeps {@code UserAccount.accountStatus} and {@code OperationsManager.assignmentStatus} of the same person in
 * step, whichever side is changed (Accounts screen, internal account-status API, or the Operations Manager
 * assignment APIs).
 *
 * <pre>
 *   ACTIVE      &lt;-&gt; ACTIVE      (a deactivated / suspended side is switched back on)
 *   INACTIVE    &lt;-&gt; INACTIVE    (the other side is switched off, also when it was suspended)
 *   SUSPENDED   &lt;-&gt; SUSPENDED   (the other side is suspended - SUSPENDED is never flattened into INACTIVE)
 *   TRANSFERRED  -&gt; nothing      (a transfer is a business event of the assignment, not an access state; it is
 *                                 never overwritten by an account change and never changes the account)
 * </pre>
 *
 * Every state except ACTIVE blocks the person's access ({@code LoginEligibilityService}, which the API Gateway also
 * asks for tokens already in circulation).
 *
 * The two directions never call each other: each one writes the other side's field directly, inside the
 * caller's transaction, so there is no recursion and both changes commit (or roll back) together.
 */
@Component
public class OperationsManagerStatusSync {

    private static final String ACTIVE = "ACTIVE";
    private static final String INACTIVE = "INACTIVE";
    private static final String SUSPENDED = "SUSPENDED";

    private final OperationsManagerRepository operationsManagerRepository;
    private final UserAccountRepository userAccountRepository;

    public OperationsManagerStatusSync(OperationsManagerRepository operationsManagerRepository,
                                       UserAccountRepository userAccountRepository) {
        this.operationsManagerRepository = operationsManagerRepository;
        this.userAccountRepository = userAccountRepository;
    }

    /** The account's status was just changed: mirror it onto the account holder's Operations Manager assignment, if any. */
    public void accountStatusChanged(UserAccount account) {
        if (account == null || account.getId() == null) return;
        OperationsManager assignment = operationsManagerRepository.findByUserAccountId(account.getId()).orElse(null);
        if (assignment == null) return;
        AssignmentStatus current = assignment.getAssignmentStatus();
        if (current == AssignmentStatus.TRANSFERRED) return;
        String status = account.getAccountStatus();
        AssignmentStatus target = null;
        if (ACTIVE.equalsIgnoreCase(status)) {
            if (current != AssignmentStatus.ACTIVE) {
                requireCityFree(assignment);
                target = AssignmentStatus.ACTIVE;
            }
        } else if (INACTIVE.equalsIgnoreCase(status)) {
            if (current != AssignmentStatus.INACTIVE) target = AssignmentStatus.INACTIVE;
        } else if (SUSPENDED.equalsIgnoreCase(status)) {
            if (current != AssignmentStatus.SUSPENDED) target = AssignmentStatus.SUSPENDED;
        }
        if (target != null) {
            assignment.setAssignmentStatus(target);
            operationsManagerRepository.save(assignment);
        }
    }

    /** The assignment's status was just changed: mirror it onto the Operations Manager's user account. */
    public void assignmentStatusChanged(OperationsManager assignment) {
        if (assignment == null || assignment.getUserAccount() == null || assignment.getAssignmentStatus() == null) return;
        UserAccount account = assignment.getUserAccount();
        String target = switch (assignment.getAssignmentStatus()) {
            case ACTIVE -> ACTIVE;
            case INACTIVE -> INACTIVE;
            case SUSPENDED -> SUSPENDED;
            case TRANSFERRED -> null;
        };
        if (target == null || target.equalsIgnoreCase(account.getAccountStatus())) return;
        // only the access states are mirrored; an account in any other state (e.g. a not-yet-verified one) is left alone
        String current = account.getAccountStatus();
        if (ACTIVE.equalsIgnoreCase(current) || INACTIVE.equalsIgnoreCase(current) || SUSPENDED.equalsIgnoreCase(current)) {
            account.setAccountStatus(target);
            userAccountRepository.save(account);
        }
    }

    /** One city may only ever have one ACTIVE Operations Manager - the same rule the assignment APIs enforce. */
    private void requireCityFree(OperationsManager assignment) {
        operationsManagerRepository.findFirstByCityIdAndAssignmentStatus(assignment.getCity().getId(), AssignmentStatus.ACTIVE)
                .filter(existing -> !existing.getId().equals(assignment.getId()))
                .ifPresent(existing -> {
                    throw new ConflictException("City already has an active operations manager");
                });
    }
}
