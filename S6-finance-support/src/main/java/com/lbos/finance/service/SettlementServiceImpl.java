package com.lbos.finance.service;
import java.math.BigDecimal; import java.time.*; import java.util.*;
import org.springframework.stereotype.Service; import org.springframework.transaction.annotation.Transactional;
import com.lbos.finance.dto.*; import com.lbos.finance.entity.*; import com.lbos.finance.exception.*; import com.lbos.finance.integration.client.*; import com.lbos.finance.integration.dto.*; import com.lbos.finance.repository.*;

/**
 * grossAmount is capped at the payment transaction's own amount (previously trusted
 * verbatim, so a settlement could pay out more than the customer ever paid), and at most one
 * settlement is now allowed per payment transaction (previously nothing stopped calling
 * POST /api/settlements twice for the same transaction and double-paying an operations
 * manager). Status now only advances via completeSettlement() - a generic PUT can no longer
 * reset an already-completed settlement's status/completedAt back to PENDING/null.
 */
@Service @Transactional
public class SettlementServiceImpl implements SettlementService {
    private final SettlementRepository settlementRepository;
    private final PaymentTransactionRepository paymentTransactionRepository;
    private final PaymentTransactionService paymentTransactionService;
    private final OrderServiceClient orderServiceClient; private final IdentityServiceClient identityServiceClient; private final CatalogServiceClient catalogServiceClient; private final LogisticsServiceClient logisticsServiceClient; private final OperationsServiceClient operationsServiceClient;
    private final PartnerServiceClient partnerServiceClient;
    public SettlementServiceImpl(SettlementRepository settlementRepository, PaymentTransactionRepository paymentTransactionRepository, PaymentTransactionService paymentTransactionService, OrderServiceClient orderServiceClient, IdentityServiceClient identityServiceClient, CatalogServiceClient catalogServiceClient, LogisticsServiceClient logisticsServiceClient, OperationsServiceClient operationsServiceClient, PartnerServiceClient partnerServiceClient) {
        this.partnerServiceClient=partnerServiceClient;
        this.settlementRepository=settlementRepository; this.paymentTransactionRepository=paymentTransactionRepository; this.paymentTransactionService=paymentTransactionService; this.orderServiceClient=orderServiceClient; this.identityServiceClient=identityServiceClient; this.catalogServiceClient=catalogServiceClient; this.logisticsServiceClient=logisticsServiceClient; this.operationsServiceClient=operationsServiceClient;
    }

    @Override public Settlement createSettlement(SettlementRequest request) {
        Settlement entity = new Settlement();
        PaymentTransaction paymentTransaction = paymentTransactionRepository.findById(request.paymentTransactionId()).orElseThrow(() -> new ResourceNotFoundException("Payment transaction not found"));
        if (request.operationsManagerId() != null) { OperationsManagerResponse operationsManagerResponse = operationsServiceClient.getOperationsManager(request.operationsManagerId()); if (!"ACTIVE".equals(operationsManagerResponse.assignmentStatus())) throw new BusinessRuleException("Operations manager is not active"); }
        if (!"SUCCESS".equals(paymentTransaction.getPaymentStatus()) || !"RELEASED".equals(paymentTransaction.getEscrowStatus())) throw new BusinessRuleException("Settlement requires successful payment and released escrow");
        if (settlementRepository.existsByPaymentTransactionId(request.paymentTransactionId())) throw new BusinessRuleException("A settlement already exists for payment transaction " + request.paymentTransactionId());
        if (request.grossAmount().compareTo(paymentTransaction.getAmount()) > 0) throw new BusinessRuleException("Gross amount " + request.grossAmount() + " exceeds the payment transaction amount of " + paymentTransaction.getAmount());
        if (request.feeAmount().compareTo(request.grossAmount()) > 0) throw new BusinessRuleException("Fee amount cannot exceed the gross amount");

        entity.setOperationsManagerId(request.operationsManagerId()); entity.setPaymentTransactionId(request.paymentTransactionId()); entity.setSettlementReference(request.settlementReference()); entity.setGrossAmount(request.grossAmount()); entity.setFeeAmount(request.feeAmount()); entity.setNetAmount(request.grossAmount().subtract(request.feeAmount())); entity.setSettlementStatus("PENDING"); entity.setSettlementDate(request.settlementDate()); entity.setCreatedAt(OffsetDateTime.now());
        return settlementRepository.save(entity);
    }

    @Override public List<Settlement> getAllSettlements() { List<Settlement> all = settlementRepository.findAll(); resolvePayeeNames(all); return all; }
    @Override public Settlement getSettlementById(UUID id) { Settlement settlement = findSettlement(id); resolvePayeeNames(List.of(settlement)); return settlement; }

    private record Payee(UUID id, String businessName) {}

    /** The caller's own retailer / fleet-owner profile, looked up by their user account id (the JWT subject); null when they have none. */
    private Payee resolvePayee(String payeeType, UUID userAccountId) {
        try {
            if ("RETAILER".equals(payeeType)) {
                var retailer = partnerServiceClient.getRetailerByUser(userAccountId);
                return retailer == null || retailer.retailerId() == null ? null : new Payee(retailer.retailerId(), retailer.businessName());
            }
            if ("FLEET_OWNER".equals(payeeType)) {
                var owner = partnerServiceClient.getFleetOwnerByUser(userAccountId);
                return owner == null || owner.fleetOwnerId() == null ? null : new Payee(owner.fleetOwnerId(), owner.businessName());
            }
            return null;
        } catch (feign.FeignException failure) {
            if (failure.status() == 404) return null;
            throw failure;
        }
    }

    /**
     * Only the caller's own rows are read (one indexed lookup on payee_type + payee_id) instead of every settlement on
     * the platform, and their display name is already known from the profile lookup, so no per-payee name call is needed.
     */
    @Override @Transactional(readOnly = true)
    public List<Settlement> getSettlementsForPartner(String payeeType, UUID userAccountId) {
        Payee payee = resolvePayee(payeeType, userAccountId);
        if (payee == null) return List.of();
        List<Settlement> mine = settlementRepository.findByPayeeTypeAndPayeeId(payeeType, payee.id());
        String name = payee.businessName() == null || payee.businessName().isBlank() ? UNKNOWN_PAYEE_NAME : payee.businessName();
        mine.forEach(settlement -> settlement.setPayeeName(name));
        return mine;
    }

    @Override @Transactional(readOnly = true)
    public Settlement getSettlementByIdForPartner(UUID id, String payeeType, UUID userAccountId) {
        Settlement settlement = findSettlement(id);
        Payee payee = resolvePayee(payeeType, userAccountId);
        // Someone else's settlement is reported exactly like a missing one, so ids cannot be probed.
        if (payee == null || !payeeType.equals(settlement.getPayeeType()) || !payee.id().equals(settlement.getPayeeId())) {
            throw new ResourceNotFoundException("Settlement not found: " + id);
        }
        settlement.setPayeeName(payee.businessName() == null || payee.businessName().isBlank() ? UNKNOWN_PAYEE_NAME : payee.businessName());
        return settlement;
    }
    private Settlement findSettlement(UUID id) { return settlementRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Settlement not found: " + id)); }

    static final String PLATFORM_PAYEE_NAME = "AroundU Platform";
    static final String UNKNOWN_PAYEE_NAME = "N/A";

    /*
    ##################################################################
    
                                               TK_INC0010080_Settlement_Business_Value_3239886
    
    #####################################################################
    */
    /**
     * Fills the transient payeeName of each settlement so screens can show a business name instead of the internal
     * payeeId: RETAILER / FLEET_OWNER are looked up once per distinct payee through the existing S2 partner client,
     * PLATFORM is "AroundU Platform", and legacy rows or a payee that cannot be resolved are "N/A" (never a UUID).
     */
    private void resolvePayeeNames(Collection<Settlement> settlements) {
        Map<String, String> resolved = new HashMap<>();
        for (Settlement settlement : settlements) {
            String type = settlement.getPayeeType();
            if ("PLATFORM".equals(type)) { settlement.setPayeeName(PLATFORM_PAYEE_NAME); continue; }
            if (settlement.getPayeeId() == null || type == null) { settlement.setPayeeName(UNKNOWN_PAYEE_NAME); continue; }
            settlement.setPayeeName(resolved.computeIfAbsent(type + ":" + settlement.getPayeeId(), key -> lookupBusinessName(type, settlement.getPayeeId())));
        }
    }

    private String lookupBusinessName(String payeeType, UUID payeeId) {
        try {
            String name = switch (payeeType) {
                case "RETAILER" -> partnerServiceClient.getRetailer(payeeId).businessName();
                case "FLEET_OWNER" -> partnerServiceClient.getFleetOwner(payeeId).businessName();
                default -> null;
            };
            return name == null || name.isBlank() ? UNKNOWN_PAYEE_NAME : name;
        } catch (RuntimeException ex) {
            return UNKNOWN_PAYEE_NAME;
        }
    }

    @Override public Settlement updateSettlement(UUID id, SettlementUpdateRequest request) {
        Settlement existing = findSettlement(id);
        if (!"PENDING".equals(existing.getSettlementStatus())) {
            throw new BusinessRuleException("Settlement " + id + " is already " + existing.getSettlementStatus() + " and can no longer be edited");
        }
        if (request.settlementReference() != null) existing.setSettlementReference(request.settlementReference());
        if (request.settlementDate() != null) existing.setSettlementDate(request.settlementDate());
        Settlement saved = settlementRepository.save(existing); resolvePayeeNames(List.of(saved)); return saved;
    }

    @Override public Settlement completeSettlement(UUID id) {
        Settlement existing = findSettlement(id);
        if (!"PENDING".equals(existing.getSettlementStatus())) {
            throw new BusinessRuleException("Settlement " + id + " must be PENDING before it can be completed (currently " + existing.getSettlementStatus() + ")");
        }
        existing.setSettlementStatus("COMPLETED");
        existing.setCompletedAt(OffsetDateTime.now());
        Settlement saved = settlementRepository.save(existing); resolvePayeeNames(List.of(saved)); return saved;
    }

    @Override public void deleteSettlement(UUID id) {
        Settlement existing = findSettlement(id);
        if (!"PENDING".equals(existing.getSettlementStatus())) {
            throw new BusinessRuleException("Only a PENDING settlement may be cancelled; " + id + " is already " + existing.getSettlementStatus());
        }
        settlementRepository.delete(existing);
    }

    @Override public List<Settlement> recordOrderDeliverySettlement(Long orderId) {
        List<PaymentTransaction> transactions = paymentTransactionRepository.findByOrderId(orderId);
        PaymentTransaction payment = transactions.stream()
                .filter(pt -> "SUCCESS".equals(pt.getPaymentStatus()))
                .findFirst().orElse(null);
        if (payment == null) return List.of();
        if ("HELD".equals(payment.getEscrowStatus())) {
            payment = paymentTransactionService.releaseEscrow(payment.getPaymentTransactionId());
        }
        UUID paymentTransactionId = payment.getPaymentTransactionId();

        OrderResponse order = orderServiceClient.getOrderById(orderId);
        List<OrderItemResponse> items = orderServiceClient.getOrderItems(orderId);
        TripResponse trip;
        try { trip = logisticsServiceClient.getTripByOrderId(orderId); } catch (RuntimeException ex) { trip = null; }

        List<Settlement> created = new ArrayList<>();

        Map<UUID, BigDecimal> byRetailer = new LinkedHashMap<>();
        for (OrderItemResponse item : items) {
            byRetailer.merge(item.retailerId(), item.lineTotal(), BigDecimal::add);
        }
        for (Map.Entry<UUID, BigDecimal> entry : byRetailer.entrySet()) {
            if (settlementRepository.existsByPaymentTransactionIdAndPayeeTypeAndPayeeId(paymentTransactionId, "RETAILER", entry.getKey())) continue;
            created.add(settlementRepository.save(payoutSettlement(paymentTransactionId, "RETAILER", entry.getKey(), entry.getValue())));
        }

        if (trip != null && trip.fleetOwnerId() != null) {
            if (!settlementRepository.existsByPaymentTransactionIdAndPayeeTypeAndPayeeId(paymentTransactionId, "FLEET_OWNER", trip.fleetOwnerId())) {
                created.add(settlementRepository.save(payoutSettlement(paymentTransactionId, "FLEET_OWNER", trip.fleetOwnerId(), order.deliveryCharge())));
            }
        }

        if (!settlementRepository.existsByPaymentTransactionIdAndPayeeType(paymentTransactionId, "PLATFORM")) {
            BigDecimal platformAmount = order.platformFeeAmount().add(order.taxAmount());
            created.add(settlementRepository.save(payoutSettlement(paymentTransactionId, "PLATFORM", null, platformAmount)));
        }

        return created;
    }

    private Settlement payoutSettlement(UUID paymentTransactionId, String payeeType, UUID payeeId, BigDecimal grossAmount) {
        Settlement entity = new Settlement();
        entity.setPaymentTransactionId(paymentTransactionId);
        entity.setPayeeType(payeeType);
        entity.setPayeeId(payeeId);
        entity.setSettlementReference(payeeType + "-" + paymentTransactionId);
        entity.setGrossAmount(grossAmount);
        entity.setFeeAmount(BigDecimal.ZERO);
        entity.setNetAmount(grossAmount);
        entity.setSettlementStatus("PENDING");
        entity.setSettlementDate(LocalDate.now());
        entity.setCreatedAt(OffsetDateTime.now());
        return entity;
    }
}
