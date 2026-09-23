package com.lbos.finance.controller;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import com.lbos.finance.dto.CustomerRefundRequest;
import com.lbos.finance.dto.CustomerRefundUpdateRequest;
import com.lbos.finance.dto.RefundEligibilityResponse;
import com.lbos.finance.entity.CustomerRefund;
import com.lbos.finance.service.CustomerRefundService;
@RestController @RequestMapping("/api/customer-refunds")
public class CustomerRefundController {
    private final CustomerRefundService customerRefundService;
    public CustomerRefundController(CustomerRefundService customerRefundService) { this.customerRefundService = customerRefundService; }
    @PostMapping public CustomerRefund createCustomerRefund(@Valid @RequestBody CustomerRefundRequest request) { return customerRefundService.createCustomerRefund(request); }
    @GetMapping public List<CustomerRefund> getAllCustomerRefunds() { return customerRefundService.getAllCustomerRefunds(); }
    @GetMapping("/{id}") public CustomerRefund getCustomerRefundById(@PathVariable UUID id) { return customerRefundService.getCustomerRefundById(id); }
    @GetMapping("/by-ticket/{customerTicketId}") public List<CustomerRefund> getByTicket(@PathVariable UUID customerTicketId) { return customerRefundService.getByTicket(customerTicketId); }
    @GetMapping("/eligibility/by-ticket/{customerTicketId}")
    public RefundEligibilityResponse getEligibilityByTicket(@PathVariable UUID customerTicketId) {
        return customerRefundService.getEligibilityByTicket(customerTicketId);
    }
    @PutMapping("/{id}") public CustomerRefund updateCustomerRefund(@PathVariable UUID id, @RequestBody CustomerRefundUpdateRequest request) { return customerRefundService.updateCustomerRefund(id, request); }
    @PostMapping("/{id}/approve") public CustomerRefund approve(@PathVariable UUID id) { return customerRefundService.approveRefund(id); }
    @PostMapping("/{id}/reject") public CustomerRefund reject(@PathVariable UUID id, @RequestBody(required = false) Map<String, String> body) { return customerRefundService.rejectRefund(id, body == null ? null : body.get("reason")); }
    @PostMapping("/{id}/complete") public CustomerRefund complete(@PathVariable UUID id) { return customerRefundService.completeRefund(id); }
    @DeleteMapping("/{id}") public void deleteCustomerRefund(@PathVariable UUID id) { customerRefundService.deleteCustomerRefund(id); }
}
