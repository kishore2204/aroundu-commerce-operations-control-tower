package com.lbos.finance.service;

import java.util.List;
import java.util.UUID;

import com.lbos.finance.dto.CustomerRefundRequest;
import com.lbos.finance.dto.CustomerRefundUpdateRequest;
import com.lbos.finance.dto.RefundEligibilityResponse;
import com.lbos.finance.entity.CustomerRefund;

public interface CustomerRefundService {
    CustomerRefund createCustomerRefund(CustomerRefundRequest request);
    List<CustomerRefund> getAllCustomerRefunds();
    CustomerRefund getCustomerRefundById(UUID id);

    /** Refund requests already logged against a given support ticket. */
    List<CustomerRefund> getByTicket(UUID customerTicketId);

    /** Server-side eligibility and remaining refundable values for one ticket. */
    RefundEligibilityResponse getEligibilityByTicket(UUID customerTicketId);

    /** Only refundReference/reason are mutable, and only while REQUESTED. */
    CustomerRefund updateCustomerRefund(UUID id, CustomerRefundUpdateRequest request);

    CustomerRefund approveRefund(UUID id);
    CustomerRefund rejectRefund(UUID id, String reason);
    CustomerRefund completeRefund(UUID id);

    /** Only a still-REQUESTED (unprocessed) refund request may be withdrawn/deleted. */
    void deleteCustomerRefund(UUID id);
}
