package com.example.lbos.service;

import com.example.lbos.client.S5FleetClient;
import com.example.lbos.dto.VerificationQueueDTO;
import com.example.lbos.entity.FleetOwner;
import com.example.lbos.exception.FleetOwnerNotFoundException;
import com.example.lbos.exception.ForbiddenActionException;
import com.example.lbos.repository.FleetOwnerRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class FleetOwnerAssetServiceImpl implements FleetOwnerAssetService {

    private final FleetOwnerRepository fleetOwnerRepository;
    private final VerificationQueueService verificationQueueService;
    private final S5FleetClient s5FleetClient;

    public FleetOwnerAssetServiceImpl(FleetOwnerRepository fleetOwnerRepository,
            VerificationQueueService verificationQueueService, S5FleetClient s5FleetClient) {
        this.fleetOwnerRepository = fleetOwnerRepository;
        this.verificationQueueService = verificationQueueService;
        this.s5FleetClient = s5FleetClient;
    }

    @Override
    @Transactional
    public AddDriverResult addDriver(UUID fleetOwnerId, AddDriverCommand command) {
        FleetOwner fleetOwner = requireVerifiedActiveFleetOwner(fleetOwnerId);

        S5FleetClient.DriverCreationResponse created = s5FleetClient.createDriver(
                new S5FleetClient.DriverCreationRequest(fleetOwnerId, command.userAccountId(), command.cityId(),
                        command.licenseNumber(), command.licenseExpiryDate()));

        VerificationQueueDTO queue = openVerificationQueue("DRIVER", created.driverId(), fleetOwner.getZoneId(),
                command.submittedByAccountId());

        return new AddDriverResult(created.driverId(), queue.getVerificationQueueId(), queue.getVerificationStatus());
    }

    @Override
    @Transactional
    public AddVehicleResult addVehicle(UUID fleetOwnerId, AddVehicleCommand command) {
        FleetOwner fleetOwner = requireVerifiedActiveFleetOwner(fleetOwnerId);

        S5FleetClient.VehicleCreationResponse created = s5FleetClient.createVehicle(
                new S5FleetClient.VehicleCreationRequest(fleetOwnerId, command.registrationNumber(),
                        command.vehicleType(), command.make(), command.model(), command.modelYear(),
                        command.capacityKg()));

        VerificationQueueDTO queue = openVerificationQueue("VEHICLE", created.vehicleId(), fleetOwner.getZoneId(),
                command.submittedByAccountId());

        return new AddVehicleResult(created.vehicleId(), queue.getVerificationQueueId(), queue.getVerificationStatus());
    }

    /**
     * Only a verified, active fleet owner may onboard drivers/vehicles under themselves - an
     * unverified fleet owner has no business adding operational assets yet.
     */
    private FleetOwner requireVerifiedActiveFleetOwner(UUID fleetOwnerId) {
        FleetOwner fleetOwner = fleetOwnerRepository.findById(fleetOwnerId)
                .orElseThrow(() -> new FleetOwnerNotFoundException("FleetOwner not found with id: " + fleetOwnerId));
        if (!"VERIFIED".equalsIgnoreCase(fleetOwner.getProfileStatus())
                || !"ACTIVE".equalsIgnoreCase(fleetOwner.getOwnerStatus())) {
            throw new ForbiddenActionException(
                    "Fleet owner must be verified and active before adding drivers or vehicles (currently profileStatus="
                            + fleetOwner.getProfileStatus() + ", ownerStatus=" + fleetOwner.getOwnerStatus() + ")");
        }
        return fleetOwner;
    }

    /*
     * Opens the queue at DOCUMENTS_SUBMITTED. The caller must upload the required real
     * DRIVING_LICENSE/INSURANCE file and then invoke the common submit-for-verification
     * endpoint. Dispatching before the file exists produces an unreviewable queue entry.
     */
    private VerificationQueueDTO openVerificationQueue(String subjectType, UUID subjectId, UUID zoneId,
            UUID submittedByAccountId) {
        VerificationQueueDTO queue = new VerificationQueueDTO();
        queue.setSubjectType(subjectType);
        queue.setSubjectId(subjectId);
        queue.setZoneId(zoneId);
        queue.setIsActive(true);
        queue.setVerificationStatus("DOCUMENTS_SUBMITTED");
        queue.setSubmittedByAccountId(submittedByAccountId);
        return verificationQueueService.createVerificationQueue(queue);
    }
}
