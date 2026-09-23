package com.lbos.finance.service;
import java.util.List;
import java.util.UUID;
import com.lbos.finance.dto.CustomerInvoiceRequest;
import com.lbos.finance.entity.CustomerInvoice;
public interface CustomerInvoiceService {
    CustomerInvoice createCustomerInvoice(CustomerInvoiceRequest request);
    List<CustomerInvoice> getAllCustomerInvoices();
    CustomerInvoice getCustomerInvoiceById(UUID id);
    CustomerInvoice updateCustomerInvoice(UUID id, CustomerInvoiceRequest request);
    void deleteCustomerInvoice(UUID id);
}
