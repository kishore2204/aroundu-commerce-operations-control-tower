package com.lbos.commercecustomer.service.comprehensive;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.data.domain.*;
import com.lbos.commercecustomer.client.*;
import com.lbos.commercecustomer.dto.client.finance.*;
import com.lbos.commercecustomer.dto.client.order.*;
import com.lbos.commercecustomer.dto.client.partner.*;
import com.lbos.commercecustomer.dto.client.platform.*;
import com.lbos.commercecustomer.dto.request.*;
import com.lbos.commercecustomer.dto.response.*;
import com.lbos.commercecustomer.entity.*;
import com.lbos.commercecustomer.enums.*;
import com.lbos.commercecustomer.exception.*;
import com.lbos.commercecustomer.mapper.CommerceMapper;
import com.lbos.commercecustomer.repository.*;
import com.lbos.commercecustomer.service.impl.*;
class CustomerServiceComprehensiveTest {
CustomerProfileRepository repo;ContextSupport ctx;CustomerServiceImpl service;
@BeforeEach void setup(){repo=mock(CustomerProfileRepository.class);ctx=mock(ContextSupport.class);service=new CustomerServiceImpl(repo,new CommerceMapper(),ctx);}
@Test void createPositiveUsesAuthenticatedAccountNotTheRequestBody(){UUID authenticated=UUID.randomUUID();UUID spoofed=UUID.randomUUID();when(ctx.currentUserAccountId()).thenReturn(authenticated);when(repo.save(any())).thenAnswer(invocation->{CustomerProfile profile=invocation.getArgument(0);profile.setId(UUID.randomUUID());return profile;});assertEquals(authenticated,service.create(new CreateCustomerRequest(spoofed,LocalDate.of(2000,1,1))).userAccountId());}
@Test void createNegativeDuplicate(){when(ctx.currentUserAccountId()).thenReturn(UUID.randomUUID());when(repo.existsByUserAccountId(any())).thenReturn(true);assertThrows(DuplicateResourceException.class,()->service.create(new CreateCustomerRequest(UUID.randomUUID(),null)));}
@Test void createBoundaryNullBirthDate(){when(repo.save(any())).thenAnswer(invocation->invocation.getArgument(0));assertNull(service.create(new CreateCustomerRequest(UUID.randomUUID(),null)).dateOfBirth());}
@Test void mePositiveMapsResolvedCustomer(){var profile=customer();when(ctx.customer()).thenReturn(profile);assertEquals(profile.getId(),service.me().id());}
@Test void updatePositiveChangesDate(){var profile=customer();when(ctx.customer()).thenReturn(profile);when(repo.save(profile)).thenReturn(profile);LocalDate newDate=LocalDate.of(1999,12,31);assertEquals(newDate,service.update(new UpdateCustomerRequest(newDate)).dateOfBirth());}
@Test void updateBoundaryNullDobAllowed(){var profile=customer();profile.setProfileStatus("ACTIVE");when(ctx.customer()).thenReturn(profile);when(repo.save(profile)).thenReturn(profile);assertEquals("ACTIVE",service.update(new UpdateCustomerRequest(null)).profileStatus());}
@Test void deletePositiveDeletesResolvedProfile(){var profile=customer();when(ctx.customer()).thenReturn(profile);service.deleteMe();verify(repo).delete(profile);}
@Test void searchBoundaryEmptyPage(){when(repo.findAll(any(Pageable.class))).thenReturn(Page.empty());assertTrue(service.search(null,0,20).items().isEmpty());}
private CustomerProfile customer(){var profile=new CustomerProfile();profile.setId(UUID.randomUUID());profile.setUserAccountId(UUID.randomUUID());return profile;}
}
