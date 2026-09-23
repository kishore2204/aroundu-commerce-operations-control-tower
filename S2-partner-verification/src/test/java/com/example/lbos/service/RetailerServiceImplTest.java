package com.example.lbos.service;

import com.example.lbos.repository.RetailerRepository;
import com.example.lbos.dto.RetailerDTO;
import com.example.lbos.entity.Retailer;
import com.example.lbos.exception.RetailerNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RetailerServiceImplTest {

    @Mock
    private RetailerRepository retailerRepository;

    @InjectMocks
    private RetailerServiceImpl retailerService;

    private Retailer retailer;
    private RetailerDTO retailerDTO;
    private final UUID retailerId = UUID.randomUUID();
    private final UUID cityId = UUID.fromString("33333333-3333-3333-3333-333333333333");

    @BeforeEach
    void setUp() {
        retailer = new Retailer();
        retailer.setRetailerId(retailerId);
        retailer.setUserAccountId(UUID.fromString("11111111-1111-1111-1111-111111111111"));
        retailer.setOperationsManagerId(UUID.fromString("22222222-2222-2222-2222-222222222222"));
        retailer.setCityId(cityId);
        retailer.setLongitude(new BigDecimal("78.1234567"));
        retailer.setLatitude(new BigDecimal("11.2345678"));
        retailer.setBusinessName("ABC Retail Store");
        retailer.setRegistrationNumber("REG12345");
        retailer.setGstNumber("33ABCDE1234F1Z5");
        retailer.setRetailerStatus("ACTIVE");

        retailerDTO = new RetailerDTO();
        retailerDTO.setUserAccountId(retailer.getUserAccountId());
        retailerDTO.setOperationsManagerId(retailer.getOperationsManagerId());
        retailerDTO.setCityId(retailer.getCityId());
        retailerDTO.setLongitude(retailer.getLongitude());
        retailerDTO.setLatitude(retailer.getLatitude());
        retailerDTO.setBusinessName(retailer.getBusinessName());
        retailerDTO.setRegistrationNumber(retailer.getRegistrationNumber());
        retailerDTO.setGstNumber(retailer.getGstNumber());
        retailerDTO.setRetailerStatus(retailer.getRetailerStatus());
    }

    @Test
    void createRetailerTest() {
        when(retailerRepository.save(any(Retailer.class))).thenReturn(retailer);

        RetailerDTO result = retailerService.createRetailer(retailerDTO);

        assertNotNull(result);
        assertEquals(retailer.getBusinessName(), result.getBusinessName());
        verify(retailerRepository, times(1)).save(any(Retailer.class));
    }

    @Test
    void createRejectsAnInvalidGstinOrRegistrationNumberWithTheClearMessage() {
        for (String gst : new String[] { "ABCDE1234F", "33ABCDE1234F1", "33ABCDE1234F1Z55", "33ABCDE1234F@Z5" }) {
            retailerDTO.setGstNumber(gst);
            IllegalArgumentException failure = assertThrows(IllegalArgumentException.class, () -> retailerService.createRetailer(retailerDTO));
            assertEquals("Enter a valid 15-character GSTIN.", failure.getMessage(), gst);
        }
        retailerDTO.setGstNumber("33ABCDE1234F1Z5");
        for (String registration : new String[] { "REG1234", "REG#12345", "R".repeat(26) }) {
            retailerDTO.setRegistrationNumber(registration);
            IllegalArgumentException failure = assertThrows(IllegalArgumentException.class, () -> retailerService.createRetailer(retailerDTO));
            assertEquals("Enter a valid shop registration number using 8 to 25 letters, numbers, /, or -.", failure.getMessage(), registration);
        }
        verify(retailerRepository, never()).save(any(Retailer.class));
    }

    @Test
    void createAcceptsLowerCaseGstinAndRegistrationWithSpacesAfterNormalisation() {
        retailerDTO.setGstNumber(" 33abcde1234f1z5 ");
        retailerDTO.setRegistrationNumber(" mh/shop/2026 /1234 ");
        when(retailerRepository.save(any(Retailer.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RetailerDTO result = retailerService.createRetailer(retailerDTO);

        assertEquals("33ABCDE1234F1Z5", result.getGstNumber());
        assertEquals("MH/SHOP/2026/1234", result.getRegistrationNumber());
    }

    @Test
    void updateChecksAChangedIdentifierButNotAValueThatIsAlreadyStored() {
        retailer.setGstNumber("LEGACYGST");          // stored before the rules existed
        retailer.setRegistrationNumber("OLD-1");     // ditto
        when(retailerRepository.findById(retailerId)).thenReturn(Optional.of(retailer));
        when(retailerRepository.save(any(Retailer.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // an unrelated edit resends the stored values: it goes through
        retailerDTO.setGstNumber("legacygst");
        retailerDTO.setRegistrationNumber("old-1");
        assertEquals("LEGACYGST", retailerService.updateRetailer(retailerId, retailerDTO).getGstNumber());

        // changing the value applies the rule
        retailerDTO.setGstNumber("NOT-A-GSTIN");
        assertThrows(IllegalArgumentException.class, () -> retailerService.updateRetailer(retailerId, retailerDTO));
        retailerDTO.setGstNumber("LEGACYGST");
        retailerDTO.setRegistrationNumber("bad#reg");
        assertThrows(IllegalArgumentException.class, () -> retailerService.updateRetailer(retailerId, retailerDTO));

        // a valid new value is accepted
        retailerDTO.setGstNumber("33ABCDE1234F1Z5");
        retailerDTO.setRegistrationNumber("TN-REG-2026-4421");
        assertEquals("TN-REG-2026-4421", retailerService.updateRetailer(retailerId, retailerDTO).getRegistrationNumber());
    }

    @Test
    void getRetailerByIdTest() {
        when(retailerRepository.findById(retailerId)).thenReturn(Optional.of(retailer));

        RetailerDTO result = retailerService.getRetailerById(retailerId);

        assertNotNull(result);
        assertEquals(retailerId, result.getRetailerId());
        verify(retailerRepository, times(1)).findById(retailerId);
    }

    @Test
    void getRetailerByIdNotFoundTest() {
        when(retailerRepository.findById(retailerId)).thenReturn(Optional.empty());

        assertThrows(RetailerNotFoundException.class, () -> retailerService.getRetailerById(retailerId));
        verify(retailerRepository, times(1)).findById(retailerId);
    }

    @Test
    void getRetailerByUserAccountIdTest() {
        when(retailerRepository.findByUserAccountId(retailer.getUserAccountId())).thenReturn(Optional.of(retailer));

        RetailerDTO result = retailerService.getRetailerByUserAccountId(retailer.getUserAccountId());

        assertNotNull(result);
        assertEquals(retailerId, result.getRetailerId());
    }

    @Test
    void getRetailerByUserAccountIdNotFoundTest() {
        UUID unknownUserAccountId = UUID.randomUUID();
        when(retailerRepository.findByUserAccountId(unknownUserAccountId)).thenReturn(Optional.empty());

        assertThrows(RetailerNotFoundException.class, () -> retailerService.getRetailerByUserAccountId(unknownUserAccountId));
    }

    @Test
    void getAllRetailersTest() {
        when(retailerRepository.findAll()).thenReturn(Arrays.asList(retailer));

        List<RetailerDTO> result = retailerService.getAllRetailers();

        assertEquals(1, result.size());
        verify(retailerRepository, times(1)).findAll();
    }

    @Test
    void updateRetailerTest() {
        when(retailerRepository.findById(retailerId)).thenReturn(Optional.of(retailer));
        when(retailerRepository.save(any(Retailer.class))).thenReturn(retailer);

        RetailerDTO updateData = new RetailerDTO();
        updateData.setBusinessName("Updated Business Name");

        RetailerDTO result = retailerService.updateRetailer(retailerId, updateData);

        assertNotNull(result);
        verify(retailerRepository, times(1)).findById(retailerId);
        verify(retailerRepository, times(1)).save(any(Retailer.class));
    }

    @Test
    void deleteRetailerTest() {
        when(retailerRepository.existsById(retailerId)).thenReturn(true);
        doNothing().when(retailerRepository).deleteById(retailerId);

        retailerService.deleteRetailer(retailerId);

        verify(retailerRepository, times(1)).existsById(retailerId);
        verify(retailerRepository, times(1)).deleteById(retailerId);
    }

    @Test
    void deleteRetailerNotFoundTest() {
        when(retailerRepository.existsById(retailerId)).thenReturn(false);

        assertThrows(RetailerNotFoundException.class, () -> retailerService.deleteRetailer(retailerId));
        verify(retailerRepository, times(1)).existsById(retailerId);
        verify(retailerRepository, never()).deleteById(retailerId);
    }

    @Test
    void getRetailersByCityTest() {
        when(retailerRepository.findByCityId(cityId)).thenReturn(Arrays.asList(retailer));

        List<RetailerDTO> result = retailerService.getRetailersByCity(cityId);

        assertEquals(1, result.size());
        verify(retailerRepository, times(1)).findByCityId(cityId);
    }

    @Test
    void getRetailersByStatusTest() {
        when(retailerRepository.findByRetailerStatus("ACTIVE")).thenReturn(Arrays.asList(retailer));

        List<RetailerDTO> result = retailerService.getRetailersByStatus("ACTIVE");

        assertEquals(1, result.size());
        verify(retailerRepository, times(1)).findByRetailerStatus("ACTIVE");
    }

    @Test
    void searchRetailersTest() {
        when(retailerRepository.findByBusinessNameContainingIgnoreCase("ABC")).thenReturn(Arrays.asList(retailer));

        List<RetailerDTO> result = retailerService.searchRetailers("ABC");

        assertEquals(1, result.size());
        verify(retailerRepository, times(1)).findByBusinessNameContainingIgnoreCase("ABC");
    }
}
