package com.lbos.finance.controller;
import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import com.lbos.finance.dto.CustomerInvoiceRequest; import com.lbos.finance.entity.CustomerInvoice; import com.lbos.finance.service.CustomerInvoiceService;
@RestController @RequestMapping("/api/customer-invoices")
public class CustomerInvoiceController {
    private final CustomerInvoiceService customerInvoiceService;
    public CustomerInvoiceController(CustomerInvoiceService customerInvoiceService) { this.customerInvoiceService = customerInvoiceService; }
    @PostMapping public CustomerInvoice createCustomerInvoice(@Valid @RequestBody CustomerInvoiceRequest request) { return customerInvoiceService.createCustomerInvoice(request); }
    @GetMapping public List<CustomerInvoice> getAllCustomerInvoices() { return customerInvoiceService.getAllCustomerInvoices(); }
    @GetMapping("/{id}") public CustomerInvoice getCustomerInvoiceById(@PathVariable UUID id) { return customerInvoiceService.getCustomerInvoiceById(id); }
    @PutMapping("/{id}") public CustomerInvoice updateCustomerInvoice(@PathVariable UUID id, @Valid @RequestBody CustomerInvoiceRequest request) { return customerInvoiceService.updateCustomerInvoice(id, request); }
    @DeleteMapping("/{id}") public void deleteCustomerInvoice(@PathVariable UUID id) { customerInvoiceService.deleteCustomerInvoice(id); }
}
