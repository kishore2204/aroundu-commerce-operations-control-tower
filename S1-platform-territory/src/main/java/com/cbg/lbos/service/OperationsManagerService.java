package com.cbg.lbos.service;

import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.cbg.lbos.dto.OperationsManagerDtos.*;
import com.cbg.lbos.entity.*;
import com.cbg.lbos.exception.*;
import com.cbg.lbos.repository.*;

@Service
@Transactional
public class OperationsManagerService {
    private final OperationsManagerRepository operationsManagerRepository;
    private final UserAccountRepository userAccountRepository;
    private final CityRepository cityRepository;
    private final OperationsManagerStatusSync statusSync;

    public OperationsManagerService(OperationsManagerRepository operationsManagerRepository,
                                    UserAccountRepository userAccountRepository,
                                    CityRepository cityRepository,
                                    OperationsManagerStatusSync statusSync) {
        this.statusSync = statusSync;
        this.operationsManagerRepository = operationsManagerRepository;
        this.userAccountRepository = userAccountRepository;
        this.cityRepository = cityRepository;
    }

    public Response create(CreateRequest request) {
        if (operationsManagerRepository.existsByUserAccountId(request.userAccountId()))
            throw new ConflictException("User already has an operations-manager profile");
        UserAccount userAccount = userAccountRepository.findById(request.userAccountId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        if (!"ACTIVE".equalsIgnoreCase(userAccount.getAccountStatus()))
            throw new ConflictException("User inactive");
        AssignmentStatus assignmentStatus = request.assignmentStatus() == null ? AssignmentStatus.ACTIVE : request.assignmentStatus();
        if (assignmentStatus == AssignmentStatus.ACTIVE) {
            requireCityNotAlreadyManaged(request.cityId(), null);
        }
        OperationsManager operationsManager = new OperationsManager();
        operationsManager.setUserAccount(userAccount);
        operationsManager.setCity(findActiveCity(request.cityId()));
        operationsManager.setAssignmentStatus(assignmentStatus);
        operationsManager.setAssignedAt(request.assignedAt() == null ? OffsetDateTime.now() : request.assignedAt());
        OperationsManager saved = operationsManagerRepository.save(operationsManager);
        statusSync.assignmentStatusChanged(saved);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public Response get(UUID id) { return toResponse(findOperationsManager(id)); }

    @Transactional(readOnly = true)
    public Response byUser(UUID userAccountId) {
        OperationsManager operationsManager = operationsManagerRepository.findByUserAccountId(userAccountId)
                .orElseThrow(() -> new ResourceNotFoundException("Manager not found"));
        return toResponse(operationsManager);
    }

    /** Same filters plus a free-text search (name, email, phone, city) - all filtering and paging happens in the query. */
    @Transactional(readOnly = true)
    public Page<Response> list(UUID cityId, AssignmentStatus assignmentStatus, String search, Pageable pageable) {
        String trimmed = search == null ? "" : search.trim().toLowerCase();
        if (trimmed.isEmpty()) return list(cityId, assignmentStatus, pageable);
        return operationsManagerRepository.search(cityId, assignmentStatus, "%" + trimmed + "%", pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Page<Response> list(UUID cityId, AssignmentStatus assignmentStatus, Pageable pageable) {
        if (cityId != null && assignmentStatus != null)
            return operationsManagerRepository.findByCityIdAndAssignmentStatus(cityId, assignmentStatus, pageable).map(this::toResponse);
        if (cityId != null) return operationsManagerRepository.findByCityId(cityId, pageable).map(this::toResponse);
        if (assignmentStatus != null) return operationsManagerRepository.findByAssignmentStatus(assignmentStatus, pageable).map(this::toResponse);
        return operationsManagerRepository.findAll(pageable).map(this::toResponse);
    }

    public Response update(UUID id, UpdateRequest request) {
        OperationsManager operationsManager = findOperationsManager(id);
        if (request.assignmentStatus() == AssignmentStatus.ACTIVE) {
            requireCityNotAlreadyManaged(request.cityId(), id);
        }
        AssignmentStatus previousStatus = operationsManager.getAssignmentStatus();
        operationsManager.setCity(findActiveCity(request.cityId()));
        operationsManager.setAssignmentStatus(request.assignmentStatus());
        // only a real status change is mirrored - editing the city must not re-activate a suspended account
        if (previousStatus != request.assignmentStatus()) statusSync.assignmentStatusChanged(operationsManager);
        return toResponse(operationsManager);
    }

    public Response reassign(UUID id, ReassignCityRequest request) {
        OperationsManager operationsManager = findOperationsManager(id);
        requireCityNotAlreadyManaged(request.cityId(), id);
        operationsManager.setCity(findActiveCity(request.cityId()));
        operationsManager.setAssignmentStatus(AssignmentStatus.ACTIVE);
        operationsManager.setAssignedAt(OffsetDateTime.now());
        OperationsManager saved = operationsManagerRepository.save(operationsManager);
        statusSync.assignmentStatusChanged(saved);
        return toResponse(saved);
    }

    public Response status(UUID id, StatusRequest request) {
        OperationsManager operationsManager = findOperationsManager(id);
        if (request.status() == AssignmentStatus.ACTIVE) {
            requireCityNotAlreadyManaged(operationsManager.getCity().getId(), id);
        }
        operationsManager.setAssignmentStatus(request.status());
        OperationsManager saved = operationsManagerRepository.save(operationsManager);
        statusSync.assignmentStatusChanged(saved);
        return toResponse(saved);
    }

    public void delete(UUID id) {
        OperationsManager operationsManager = findOperationsManager(id);
        operationsManager.setAssignmentStatus(AssignmentStatus.INACTIVE);
        statusSync.assignmentStatusChanged(operationsManager);
    }

    @Transactional(readOnly = true)
    public Summary summary() {
        return new Summary(operationsManagerRepository.count(),
                operationsManagerRepository.countByAssignmentStatus(AssignmentStatus.ACTIVE),
                operationsManagerRepository.countByAssignmentStatus(AssignmentStatus.INACTIVE),
                operationsManagerRepository.countByAssignmentStatus(AssignmentStatus.SUSPENDED),
                operationsManagerRepository.countByAssignmentStatus(AssignmentStatus.TRANSFERRED));
    }

    @Transactional(readOnly = true)
    public InternalAssignment getInternalAssignment(UUID id) {
        OperationsManager operationsManager = findOperationsManager(id);
        AssignmentStatus assignmentStatus = operationsManager.getAssignmentStatus();
        return new InternalAssignment(operationsManager.getId(), operationsManager.getUserAccount().getId(),
                operationsManager.getCity().getId(), assignmentStatus, assignmentStatus == AssignmentStatus.ACTIVE);
    }

    @Transactional(readOnly = true)
    public InternalAssignment resolve(UUID userAccountId) {
        OperationsManager operationsManager = operationsManagerRepository.findByUserAccountId(userAccountId)
                .orElseThrow(() -> new ResourceNotFoundException("Manager not found"));
        AssignmentStatus assignmentStatus = operationsManager.getAssignmentStatus();
        return new InternalAssignment(operationsManager.getId(), userAccountId, operationsManager.getCity().getId(), assignmentStatus, assignmentStatus == AssignmentStatus.ACTIVE);
    }

    @Transactional(readOnly = true)
    public InternalAssignment activeCity(UUID cityId) {
        OperationsManager operationsManager = operationsManagerRepository.findFirstByCityIdAndAssignmentStatus(cityId, AssignmentStatus.ACTIVE)
                .orElseThrow(() -> new ResourceNotFoundException("No active manager"));
        return new InternalAssignment(operationsManager.getId(), operationsManager.getUserAccount().getId(), cityId, operationsManager.getAssignmentStatus(), true);
    }

    @Transactional(readOnly = true)
    public ValidationResponse validate(UUID operationsManagerId, UUID cityId) {
        OperationsManager operationsManager = operationsManagerRepository.findById(operationsManagerId).orElse(null);
        if (operationsManager == null) return new ValidationResponse(false, "Operations manager does not exist");
        if (operationsManager.getAssignmentStatus() != AssignmentStatus.ACTIVE) return new ValidationResponse(false, "Assignment is not ACTIVE");
        if (!operationsManager.getCity().getId().equals(cityId)) return new ValidationResponse(false, "Operations manager is not assigned to the requested city");
        return new ValidationResponse(true, "Valid active city assignment");
    }

    private OperationsManager findOperationsManager(UUID id) {
        return operationsManagerRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Manager not found"));
    }

    /** One city must have at most one ACTIVE Operations Manager - previously unenforced, so
     *  create/update/reassign/status could all freely put a second OM ACTIVE in a city already
     *  managed by someone else. excludingOperationsManagerId lets an OM's own update/reassign
     *  to a city they already actively manage pass (not a conflict with themselves). */
    private void requireCityNotAlreadyManaged(UUID cityId, UUID excludingOperationsManagerId) {
        operationsManagerRepository.findFirstByCityIdAndAssignmentStatus(cityId, AssignmentStatus.ACTIVE)
                .filter(existing -> !existing.getId().equals(excludingOperationsManagerId))
                .ifPresent(existing -> {
                    throw new ConflictException("City already has an active operations manager");
                });
    }

    private City findActiveCity(UUID cityId) {
        City city = cityRepository.findById(cityId).orElseThrow(() -> new ResourceNotFoundException("City not found"));
        if (!Boolean.TRUE.equals(city.getIsActive())) throw new ConflictException("Cannot assign inactive city");
        return city;
    }

    private Response toResponse(OperationsManager operationsManager) {
        UserAccount userAccount = operationsManager.getUserAccount();
        String displayName = (userAccount.getFirstName() + " " + userAccount.getLastName()).trim();
        return new Response(operationsManager.getId(), userAccount.getId(), displayName, userAccount.getEmail(),
                operationsManager.getCity().getId(), operationsManager.getCity().getCityName(), operationsManager.getAssignmentStatus(),
                operationsManager.getAssignedAt(), operationsManager.getUpdatedAt(), operationsManager.getVersion());
    }
}
