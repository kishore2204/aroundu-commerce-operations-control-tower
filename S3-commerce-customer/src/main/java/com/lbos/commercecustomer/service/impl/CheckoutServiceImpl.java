package com.lbos.commercecustomer.service.impl;

import com.lbos.commercecustomer.client.FinanceClient;
import com.lbos.commercecustomer.client.OrderLogisticsClient;
import com.lbos.commercecustomer.dto.client.finance.TaxCalculationRequest;
import com.lbos.commercecustomer.dto.client.finance.TaxCalculationResponse;
import com.lbos.commercecustomer.exception.ExternalServiceUnavailableException;
import com.lbos.commercecustomer.repository.ProductCategoryRef;
import com.lbos.commercecustomer.repository.ProductRepository;
import feign.FeignException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import com.lbos.commercecustomer.dto.client.finance.TaxItemRequest;
import com.lbos.commercecustomer.dto.client.order.LineServiceabilityResult;
import com.lbos.commercecustomer.dto.client.order.ServiceabilityRequest;
import com.lbos.commercecustomer.dto.request.CheckoutRequest;
import com.lbos.commercecustomer.dto.response.CartItemResponse;
import com.lbos.commercecustomer.dto.response.CartValidationIssue;
import com.lbos.commercecustomer.dto.response.CheckoutResponse;
import com.lbos.commercecustomer.dto.response.CheckoutRetailerBreakdown;
import com.lbos.commercecustomer.exception.BusinessValidationException;
import com.lbos.commercecustomer.exception.ResourceNotFoundException;
import com.lbos.commercecustomer.repository.CustomerAddressRepository;
import com.lbos.commercecustomer.repository.CustomerProfileRepository;
import com.lbos.commercecustomer.service.CartService;
import com.lbos.commercecustomer.service.CheckoutService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CheckoutServiceImpl implements CheckoutService {
    private static final BigDecimal PLATFORM_FEE_RATE = new BigDecimal("0.02");

    private final CartService cart;
    private final CustomerAddressRepository addresses;
    private final ContextSupport ctx;
    private final OrderLogisticsClient order;
    private final FinanceClient finance;
    private final FeignCallSupport feign;
    private final CustomerProfileRepository customers;
    private final ProductRepository products;

    public CheckoutServiceImpl(CartService cart, CustomerAddressRepository addresses, ContextSupport ctx,
            OrderLogisticsClient order, FinanceClient finance, FeignCallSupport feign, CustomerProfileRepository customers,
            ProductRepository products) {
        this.products = products;
        this.cart = cart;
        this.addresses = addresses;
        this.ctx = ctx;
        this.order = order;
        this.finance = finance;
        this.feign = feign;
        this.customers = customers;
    }

    private static final Pattern MESSAGE_FIELD = Pattern.compile("\"message\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"");

    /**
     * The single tax calculation for a retailer's items, done by S6 from the tax configuration of each product category
     * in the customer's state. There is no fallback rate: when S6 has no applicable configuration (or the tax cannot be
     * calculated at all) checkout is blocked with S6's message instead of silently charging zero or a default.
     */
    private TaxCalculationResponse calculateTax(UUID customerId, UUID cityId, List<TaxItemRequest> taxItems) {
        TaxCalculationResponse result;
        try {
            result = feign.call("lbos-finance", () -> finance.tax(new TaxCalculationRequest(customerId, cityId, taxItems)));
        } catch (ExternalServiceUnavailableException failure) {
            if (failure.getCause() instanceof FeignException rejected && (rejected.status() == 409 || rejected.status() == 422)) {
                throw new BusinessValidationException(taxRejectionMessage(rejected), rejected);
            }
            throw failure;
        }
        if (result == null || result.taxAmount() == null) {
            throw new BusinessValidationException("Tax could not be calculated for this order, so checkout cannot continue");
        }
        return result;
    }

    private static String taxRejectionMessage(FeignException rejected) {
        String body = rejected.contentUTF8();
        Matcher matcher = body == null ? null : MESSAGE_FIELD.matcher(body);
        return matcher != null && matcher.find() ? matcher.group(1).replace("\\\"", "\"") : "No applicable tax configuration found for this order";
    }

    /**
     * Prepares checkout using existing S4 serviceability and S6 tax APIs. A per-retailer breakdown
     * is returned so multi-shop orders can be created with the exact value of their own items
     * instead of dividing a combined total blindly. No pricing is calculated in Angular.
     *
     * Read-only: a preview must never change stored state. The customer's checkout screen calls
     * this at least twice per real checkout (once on load, once again right before payment - see
     * CheckoutComponent), and a customer can call it any number of times just by reloading the
     * page, so persisting a reward-points balance change here would credit/debit points on every
     * preview instead of once per completed order - see confirm() for the actual commit.
     */
    @Override
    @Transactional(readOnly = true)
    public CheckoutResponse prepare(CheckoutRequest request) {
        return compute(request, false);
    }

    /**
     * Same computation as prepare(), called exactly once by CheckoutComponent right after every
     * retailer order from this checkout has actually been created (and before the cart is
     * cleared) - this is the only place a reward-points balance change is persisted. Recomputes
     * from the live cart rather than trusting a client-supplied total, for the same reason
     * prepare() itself never trusts a stale summary: stock/pricing can change between preview and
     * purchase.
     */
    @Override
    @Transactional
    public CheckoutResponse confirm(CheckoutRequest request) {
        return compute(request, true);
    }

    private CheckoutResponse compute(CheckoutRequest request, boolean commitPoints) {
        var customer = ctx.customer();
        var address = addresses.findByIdAndCustomerId(request.addressId(), customer.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Address not found"));
        var validation = cart.validate();
        if (!validation.valid()) {
            throw new BusinessValidationException("Cart is not valid for checkout: "
                    + validation.issues().stream().map(CartValidationIssue::message).reduce((a, b) -> a + "; " + b).orElse(""));
        }
        var cartResponse = validation.cart();
        var productIds = cartResponse.items().stream().map(CartItemResponse::productId).toList();
        var serviceability = feign.call("lbos-order", () -> order.serviceability(
                new ServiceabilityRequest(customer.getId(), address.getId(), address.getCityId(), address.getZoneId(), productIds)));
        List<LineServiceabilityResult> serviceabilityLines = serviceability == null || serviceability.lines() == null
                ? List.of() : serviceability.lines();
        boolean serviceable = serviceability != null && serviceability.serviceable();

        // One query for every line's category - S6 prices each product category with its own tax configuration.
        Map<Long, Long> categoryByProduct = products.findCategoryRefsByProductIds(productIds).stream()
                .collect(Collectors.toMap(ProductCategoryRef::productId, ProductCategoryRef::categoryId, (a, b) -> a));

        Map<UUID, List<CartItemResponse>> itemsByRetailer = new LinkedHashMap<>();
        for (CartItemResponse item : cartResponse.items()) {
            itemsByRetailer.computeIfAbsent(item.retailerId(), ignored -> new ArrayList<>()).add(item);
        }

        List<CheckoutRetailerBreakdown> rawBreakdowns = new ArrayList<>();
        BigDecimal aggregateTax = BigDecimal.ZERO;
        BigDecimal aggregateDelivery = BigDecimal.ZERO;
        BigDecimal aggregatePlatformFee = BigDecimal.ZERO;

        for (var entry : itemsByRetailer.entrySet()) {
            UUID retailerId = entry.getKey();
            List<CartItemResponse> retailerItems = entry.getValue();
            BigDecimal subtotal = retailerItems.stream().map(CartItemResponse::lineTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
            var taxItems = retailerItems.stream()
                    .map(item -> new TaxItemRequest(item.productId(), categoryByProduct.get(item.productId()), item.quantity(), item.unitPrice()))
                    .toList();
            BigDecimal tax = calculateTax(customer.getId(), address.getCityId(), taxItems).taxAmount();
            BigDecimal delivery = serviceabilityLines.stream()
                    .filter(line -> retailerId.equals(line.retailerId()) && line.serviceable() && line.deliveryCharge() != null)
                    .map(LineServiceabilityResult::deliveryCharge).findFirst().orElse(BigDecimal.ZERO);
            BigDecimal platformFee = subtotal.multiply(PLATFORM_FEE_RATE).setScale(2, RoundingMode.HALF_UP);
            BigDecimal preDiscount = subtotal.add(tax).add(delivery).add(platformFee);
            rawBreakdowns.add(new CheckoutRetailerBreakdown(retailerId, retailerItems, subtotal, tax, delivery, platformFee,
                    BigDecimal.ZERO, preDiscount));
            aggregateTax = aggregateTax.add(tax);
            aggregateDelivery = aggregateDelivery.add(delivery);
            aggregatePlatformFee = aggregatePlatformFee.add(platformFee);
        }

        BigDecimal orderValue = cartResponse.subtotal().add(aggregateTax).add(aggregateDelivery).add(aggregatePlatformFee);
        BigDecimal requestedPoints = request.redeemPoints() == null ? BigDecimal.ZERO : request.redeemPoints();
        if (requestedPoints.signum() < 0) throw new BusinessValidationException("redeemPoints cannot be negative");
        BigDecimal redemptionCap = orderValue.multiply(new BigDecimal("0.50"));
        BigDecimal pointsRedeemed = requestedPoints.min(customer.getRewardPointsBalance()).min(redemptionCap);
        BigDecimal grandTotal = orderValue.subtract(pointsRedeemed).max(BigDecimal.ZERO);

        List<CheckoutRetailerBreakdown> breakdowns = new ArrayList<>();
        BigDecimal discountAllocated = BigDecimal.ZERO;
        for (int index = 0; index < rawBreakdowns.size(); index++) {
            CheckoutRetailerBreakdown raw = rawBreakdowns.get(index);
            BigDecimal discount;
            if (pointsRedeemed.signum() == 0 || orderValue.signum() == 0) {
                discount = BigDecimal.ZERO;
            } else if (index == rawBreakdowns.size() - 1) {
                discount = pointsRedeemed.subtract(discountAllocated);
            } else {
                discount = pointsRedeemed.multiply(raw.grandTotal()).divide(orderValue, 2, RoundingMode.HALF_UP);
                discountAllocated = discountAllocated.add(discount);
            }
            breakdowns.add(new CheckoutRetailerBreakdown(raw.retailerId(), raw.items(), raw.subtotal(), raw.tax(),
                    raw.deliveryCharge(), raw.platformFee(), discount, raw.grandTotal().subtract(discount)));
        }

        BigDecimal pointsEarned = grandTotal.multiply(PLATFORM_FEE_RATE).setScale(2, RoundingMode.HALF_UP);
        // Shown to the customer either way ("you'll earn X points, new balance Y") - only
        // actually persisted when this is the one real confirm() call for a completed checkout.
        BigDecimal newBalance = customer.getRewardPointsBalance().subtract(pointsRedeemed).add(pointsEarned);
        if (commitPoints) {
            customer.setRewardPointsBalance(newBalance);
            customers.save(customer);
        }

        return new CheckoutResponse(address.getId(), cartResponse.items(), cartResponse.subtotal(), aggregateTax, aggregateDelivery,
                aggregatePlatformFee, grandTotal, serviceable, pointsRedeemed, pointsEarned, newBalance, serviceabilityLines, breakdowns);
    }
}
