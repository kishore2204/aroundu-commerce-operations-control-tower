package com.lbos.finance.service;
import java.math.BigDecimal; import java.time.*; import java.util.*;
import org.springframework.stereotype.Service; import org.springframework.transaction.annotation.Transactional;
import com.lbos.finance.dto.*; import com.lbos.finance.entity.*; import com.lbos.finance.exception.*; import com.lbos.finance.integration.client.*; import com.lbos.finance.integration.dto.*; import com.lbos.finance.repository.*;
@Service @Transactional
public class NotificationServiceImpl implements NotificationService {
    private final NotificationRepository notificationRepository;
    private final PaymentTransactionRepository paymentTransactionRepository;
    private final OrderServiceClient orderServiceClient; private final IdentityServiceClient identityServiceClient; private final CatalogServiceClient catalogServiceClient; private final LogisticsServiceClient logisticsServiceClient; private final OperationsServiceClient operationsServiceClient;
    public NotificationServiceImpl(NotificationRepository notificationRepository, PaymentTransactionRepository paymentTransactionRepository, OrderServiceClient orderServiceClient, IdentityServiceClient identityServiceClient, CatalogServiceClient catalogServiceClient, LogisticsServiceClient logisticsServiceClient, OperationsServiceClient operationsServiceClient) {
        this.notificationRepository=notificationRepository; this.paymentTransactionRepository=paymentTransactionRepository; this.orderServiceClient=orderServiceClient; this.identityServiceClient=identityServiceClient; this.catalogServiceClient=catalogServiceClient; this.logisticsServiceClient=logisticsServiceClient; this.operationsServiceClient=operationsServiceClient;
    }
    @Override public Notification createNotification(NotificationRequest request) { Notification entity = new Notification();
        UserAccountResponse recipientAccount = identityServiceClient.getUserAccount(request.userAccountId()); if (!"ACTIVE".equals(recipientAccount.accountStatus())) throw new BusinessRuleException("Notification recipient is inactive");
        entity.setUserAccountId(request.userAccountId()); entity.setRole(request.role()); entity.setNotificationType(request.notificationType()); entity.setReferenceType(request.referenceType()); entity.setReferenceId(request.referenceId()); entity.setTitle(request.title()); entity.setMessage(request.message()); entity.setRead(false); entity.setSentAt(LocalDateTime.now());
        return notificationRepository.save(entity); }
    @Override public List<Notification> getAllNotifications() { return notificationRepository.findAll(); }
    @Override public Notification getNotificationById(Long id) { return notificationRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Notification not found: " + id)); }
    @Override public Notification updateNotification(Long id, NotificationRequest request) { Notification existingEntity = getNotificationById(id); Notification newlyMappedEntity = createWithoutSaving(request); copyMutableValues(newlyMappedEntity, existingEntity); return notificationRepository.save(existingEntity); }
    private Notification createWithoutSaving(NotificationRequest request) { Notification entity = new Notification(); UserAccountResponse recipientAccount = identityServiceClient.getUserAccount(request.userAccountId()); if (!"ACTIVE".equals(recipientAccount.accountStatus())) throw new BusinessRuleException("Notification recipient is inactive");
        entity.setUserAccountId(request.userAccountId()); entity.setRole(request.role()); entity.setNotificationType(request.notificationType()); entity.setReferenceType(request.referenceType()); entity.setReferenceId(request.referenceId()); entity.setTitle(request.title()); entity.setMessage(request.message()); entity.setRead(false); entity.setSentAt(LocalDateTime.now()); return entity; }
    private void copyMutableValues(Notification sourceEntity, Notification targetEntity) {
        try { for (var field : Notification.class.getDeclaredFields()) { if (field.isAnnotationPresent(jakarta.persistence.Id.class)) continue; field.setAccessible(true); field.set(targetEntity, field.get(sourceEntity)); } } catch (IllegalAccessException exception) { throw new IllegalStateException("Unable to update Notification", exception); }
    }
    @Override public Notification markNotificationRead(Long id) { Notification existingEntity = getNotificationById(id); existingEntity.setRead(true); return notificationRepository.save(existingEntity); }
    @Override public List<Notification> markAllNotificationsRead(UUID userAccountId) { List<Notification> recipientNotifications = notificationRepository.findByUserAccountId(userAccountId); for (Notification notification : recipientNotifications) { notification.setRead(true); } return notificationRepository.saveAll(recipientNotifications); }
    @Override public List<Notification> getNotificationsByUserAccountId(UUID userAccountId) { return notificationRepository.findByUserAccountId(userAccountId); }
    @Override public void deleteNotification(Long id) { notificationRepository.delete(getNotificationById(id)); }
}
