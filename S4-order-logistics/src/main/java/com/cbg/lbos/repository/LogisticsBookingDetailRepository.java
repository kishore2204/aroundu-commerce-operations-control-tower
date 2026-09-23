package com.cbg.lbos.repository;

import com.cbg.lbos.entity.LogisticsBookingDetail;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LogisticsBookingDetailRepository
        extends JpaRepository<LogisticsBookingDetail, Long> {
}
