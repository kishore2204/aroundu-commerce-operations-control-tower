package com.lbos.finance.repository;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.lbos.finance.entity.CustomerInvoice;
public interface CustomerInvoiceRepository extends JpaRepository<CustomerInvoice, UUID> { }
