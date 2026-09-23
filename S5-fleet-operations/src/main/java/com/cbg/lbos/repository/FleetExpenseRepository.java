package com.cbg.lbos.repository;

import com.cbg.lbos.entity.*;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface FleetExpenseRepository extends JpaRepository<FleetExpense, UUID> {
	List<FleetExpense> findByFleetOwnerId(UUID fleetOwnerId);
}
