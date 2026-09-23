package com.lbos.finance.service;
import java.math.BigDecimal; import java.time.*; import java.util.*;
import org.springframework.stereotype.Service; import org.springframework.transaction.annotation.Transactional;
import com.lbos.finance.dto.*; import com.lbos.finance.entity.*; import com.lbos.finance.exception.*; import com.lbos.finance.integration.client.*; import com.lbos.finance.integration.dto.*; import com.lbos.finance.repository.*;
@Service @Transactional
public class CustomerInvoiceServiceImpl implements CustomerInvoiceService {
    private final CustomerInvoiceRepository customerInvoiceRepository;
    private final PaymentTransactionRepository paymentTransactionRepository;
    private final OrderServiceClient orderServiceClient; private final IdentityServiceClient identityServiceClient; private final CatalogServiceClient catalogServiceClient; private final LogisticsServiceClient logisticsServiceClient; private final OperationsServiceClient operationsServiceClient;
    public CustomerInvoiceServiceImpl(CustomerInvoiceRepository customerInvoiceRepository, PaymentTransactionRepository paymentTransactionRepository, OrderServiceClient orderServiceClient, IdentityServiceClient identityServiceClient, CatalogServiceClient catalogServiceClient, LogisticsServiceClient logisticsServiceClient, OperationsServiceClient operationsServiceClient) {
        this.customerInvoiceRepository=customerInvoiceRepository; this.paymentTransactionRepository=paymentTransactionRepository; this.orderServiceClient=orderServiceClient; this.identityServiceClient=identityServiceClient; this.catalogServiceClient=catalogServiceClient; this.logisticsServiceClient=logisticsServiceClient; this.operationsServiceClient=operationsServiceClient;
    }
    @Override public CustomerInvoice createCustomerInvoice(CustomerInvoiceRequest request) { CustomerInvoice entity = new CustomerInvoice();
        OrderResponse orderResponse = orderServiceClient.getOrderById(request.orderId()); List<OrderItemResponse> orderItems = orderServiceClient.getOrderItems(request.orderId());
        BigDecimal calculatedSubtotal = orderItems.stream().map(OrderItemResponse::lineTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        entity.setOrderId(orderResponse.orderId()); entity.setInvoiceNumber(request.invoiceNumber()); entity.setInvoiceDate(request.invoiceDate()); entity.setSubtotalAmount(calculatedSubtotal); entity.setTaxAmount(request.taxAmount()); entity.setTotalAmount(calculatedSubtotal.add(request.taxAmount())); entity.setInvoiceStatus("ISSUED");
        return customerInvoiceRepository.save(entity); }
    @Override public List<CustomerInvoice> getAllCustomerInvoices() { return customerInvoiceRepository.findAll(); }
    @Override public CustomerInvoice getCustomerInvoiceById(UUID id) { return customerInvoiceRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("CustomerInvoice not found: " + id)); }
    @Override public CustomerInvoice updateCustomerInvoice(UUID id, CustomerInvoiceRequest request) { CustomerInvoice existingEntity = getCustomerInvoiceById(id); CustomerInvoice newlyMappedEntity = createWithoutSaving(request); copyMutableValues(newlyMappedEntity, existingEntity); return customerInvoiceRepository.save(existingEntity); }
    private CustomerInvoice createWithoutSaving(CustomerInvoiceRequest request) { CustomerInvoice entity = new CustomerInvoice(); OrderResponse orderResponse = orderServiceClient.getOrderById(request.orderId()); List<OrderItemResponse> orderItems = orderServiceClient.getOrderItems(request.orderId());
        BigDecimal calculatedSubtotal = orderItems.stream().map(OrderItemResponse::lineTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        entity.setOrderId(orderResponse.orderId()); entity.setInvoiceNumber(request.invoiceNumber()); entity.setInvoiceDate(request.invoiceDate()); entity.setSubtotalAmount(calculatedSubtotal); entity.setTaxAmount(request.taxAmount()); entity.setTotalAmount(calculatedSubtotal.add(request.taxAmount())); entity.setInvoiceStatus("ISSUED"); return entity; }
    private void copyMutableValues(CustomerInvoice sourceEntity, CustomerInvoice targetEntity) {
        try { for (var field : CustomerInvoice.class.getDeclaredFields()) { if (field.isAnnotationPresent(jakarta.persistence.Id.class)) continue; field.setAccessible(true); field.set(targetEntity, field.get(sourceEntity)); } } catch (IllegalAccessException exception) { throw new IllegalStateException("Unable to update CustomerInvoice", exception); }
    }
    @Override public void deleteCustomerInvoice(UUID id) { customerInvoiceRepository.delete(getCustomerInvoiceById(id)); }
}
