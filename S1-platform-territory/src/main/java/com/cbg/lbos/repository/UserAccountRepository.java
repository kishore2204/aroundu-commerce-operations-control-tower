package com.cbg.lbos.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.cbg.lbos.entity.UserAccount;

@Repository
public interface UserAccountRepository
        extends JpaRepository<UserAccount, UUID> {

    Optional<UserAccount> findByEmailIgnoreCase(String email);

    Optional<UserAccount> findByPhoneNumber(String phoneNumber);

    List<UserAccount> findByRoleIgnoreCase(String role);

    List<UserAccount> findByAccountStatusIgnoreCase(
            String accountStatus);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByPhoneNumber(String phoneNumber);

    /** Ids of accounts (of the given roles) whose name, email or phone contains the term - already lower-cased with % wildcards. */
    @org.springframework.data.jpa.repository.Query("select u.id from UserAccount u where upper(u.role) in :roles and "
            + "(lower(u.email) like :term or lower(u.firstName) like :term or lower(u.lastName) like :term or u.phoneNumber like :term)")
    List<UUID> searchIds(@org.springframework.data.repository.query.Param("roles") java.util.Collection<String> roles,
            @org.springframework.data.repository.query.Param("term") String term,
            org.springframework.data.domain.Pageable pageable);
}