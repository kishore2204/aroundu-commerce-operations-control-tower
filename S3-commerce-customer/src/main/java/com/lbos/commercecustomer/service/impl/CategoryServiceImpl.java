package com.lbos.commercecustomer.service.impl; import com.lbos.commercecustomer.dto.request.CategoryRequest;import com.lbos.commercecustomer.dto.response.*;import com.lbos.commercecustomer.entity.*;import com.lbos.commercecustomer.enums.CategoryStatus;import com.lbos.commercecustomer.exception.*;import com.lbos.commercecustomer.mapper.CommerceMapper;import com.lbos.commercecustomer.repository.*;import com.lbos.commercecustomer.service.CategoryService;import java.util.*;import org.springframework.data.domain.*;import org.springframework.stereotype.Service;import org.springframework.transaction.annotation.*; @Service public class CategoryServiceImpl implements CategoryService {private final ProductCategoryRepository repo;private final ProductRepository products;private final CommerceMapper map;public CategoryServiceImpl(ProductCategoryRepository r,ProductRepository p,CommerceMapper m){repo=r;products=p;map=m;}private ProductCategory getE(Long id){return repo.findById(id).orElseThrow(()->new ResourceNotFoundException("Category not found"));}private CategoryStatus parseStatus(String s){if(s==null||s.isBlank())return CategoryStatus.ACTIVE;try{return CategoryStatus.valueOf(s.trim().toUpperCase());}catch(IllegalArgumentException ex){throw new BusinessValidationException("Unsupported category status '"+s+"'");}}@Transactional public CategoryResponse create(CategoryRequest r){if(repo.existsByNameIgnoreCase(r.name().trim()))throw new DuplicateResourceException("Category already exists");var category=new ProductCategory();category.setName(r.name().trim());category.setDescription(r.description());category.setStatus(r.status());return map.category(repo.save(category));}@Transactional(readOnly=true) public CategoryResponse get(Long id){return map.category(getE(id));}@Transactional(readOnly=true) public PageResponse<CategoryResponse> search(String q,String s,int p,int z){var categoryPage=repo.findByNameContainingIgnoreCaseAndStatus(q==null?"":q,parseStatus(s),PageRequest.of(p,z));return new PageResponse<>(categoryPage.map(map::category).getContent(),p,z,categoryPage.getTotalElements(),categoryPage.getTotalPages());}@Transactional public CategoryResponse update(Long id,CategoryRequest r){var category=getE(id);category.setName(r.name().trim());category.setDescription(r.description());category.setStatus(r.status());return map.category(repo.save(category));}@Transactional public void delete(Long id){var category=getE(id);if(products.findAll().stream().anyMatch(product->product.getCategory().getId().equals(id)))throw new BusinessValidationException("Category is referenced by products");repo.delete(category);}@Transactional(readOnly=true) public List<CategoryResponse> active(){return repo.findByStatusOrderByNameAsc(CategoryStatus.ACTIVE).stream().map(map::category).toList();}

    @Transactional public CategoryResolution resolveByName(String rawName, boolean createIfMissing) {
        String name = rawName == null ? "" : rawName.trim().replaceAll("\\s+", " ");
        if (name.isEmpty()) throw new BusinessValidationException("Category name is required");
        if (name.length() > 100) throw new BusinessValidationException("Category name must be at most 100 characters");
        var existing = repo.findFirstByNameIgnoreCase(name);
        if (existing.isPresent()) return resolutionOf(existing.get(), false);
        if (!createIfMissing) throw new ResourceNotFoundException("Category '" + name + "' does not exist");
        var category = new ProductCategory();
        category.setName(name);
        category.setStatus(CategoryStatus.ACTIVE);
        try {
            return resolutionOf(repo.saveAndFlush(category), true);
        } catch (org.springframework.dao.DataIntegrityViolationException raced) {
            // another request created the same name a moment ago: use that one instead of failing
            return resolutionOf(repo.findFirstByNameIgnoreCase(name).orElseThrow(() -> raced), false);
        }
    }

    private CategoryResolution resolutionOf(ProductCategory category, boolean created) {
        if (category.getStatus() != CategoryStatus.ACTIVE)
            throw new BusinessValidationException("Category '" + category.getName() + "' exists but is inactive. Activate it first or choose another category.");
        return new CategoryResolution(map.category(category), created);
    }}