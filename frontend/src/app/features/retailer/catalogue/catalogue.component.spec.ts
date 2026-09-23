import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { RetailerCatalogueComponent } from './catalogue.component';
import { CatalogueService } from '../../../core/services/catalogue.service';
import { CategoryService } from '../../../core/services/category.service';
import { Product } from '../../../core/models/product.model';
import { ProductCategory } from '../../../core/models/category.model';

describe('RetailerCatalogueComponent', () => {
  const product: Product = {
    id: 1,
    name: 'Rice 5kg',
    sku: 'RICE-5KG',
    categoryId: 2,
    categoryName: 'Groceries',
    retailerId: 'r1',
    retailerName: 'Fresh Mart',
    retailerStatus: 'VERIFIED',
    retailerLatitude: 12.9,
    retailerLongitude: 77.5,
    unitPrice: 250,
    stock: 40,
    status: 'ACTIVE',
    inventoryStatus: 'HEALTHY',
    description: 'Premium rice, 5kg pack.',
    qualityFlag: null,
    lowStockThreshold: 5,
    weightKg: 5,
  };

  const category: ProductCategory = { id: 2, name: 'Groceries', description: null, status: 'ACTIVE' };

  function setup(overrides: {
    search?: jasmine.Spy;
    create?: jasmine.Spy;
    update?: jasmine.Spy;
    duplicate?: jasmine.Spy;
    remove?: jasmine.Spy;
    active?: jasmine.Spy;
  } = {}) {
    const catalogueServiceSpy = {
      search: overrides.search ?? jasmine.createSpy().and.returnValue(of({ items: [product], page: 0, size: 50, totalElements: 1, totalPages: 1 })),
      create: overrides.create ?? jasmine.createSpy().and.returnValue(of(product)),
      update: overrides.update ?? jasmine.createSpy().and.returnValue(of(product)),
      duplicate: overrides.duplicate ?? jasmine.createSpy().and.returnValue(of(product)),
      remove: overrides.remove ?? jasmine.createSpy().and.returnValue(of(undefined)),
    };
    const categoryServiceSpy = {
      active: overrides.active ?? jasmine.createSpy().and.returnValue(of([category])),
    };
    TestBed.configureTestingModule({
      imports: [RetailerCatalogueComponent],
      providers: [
        { provide: CatalogueService, useValue: catalogueServiceSpy },
        { provide: CategoryService, useValue: categoryServiceSpy },
      ],
    });

    const fixture = TestBed.createComponent(RetailerCatalogueComponent);
    return { fixture, catalogueServiceSpy, categoryServiceSpy };
  }

  it('should create', () => {
    const { fixture } = setup();
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('loads products and categories on init', () => {
    const { fixture, catalogueServiceSpy, categoryServiceSpy } = setup();
    fixture.detectChanges();

    expect(categoryServiceSpy.active).toHaveBeenCalled();
    expect(catalogueServiceSpy.search).toHaveBeenCalledWith({ q: undefined, page: 0, size: 50 });
    expect(fixture.componentInstance.products()).toEqual([product]);
    expect(fixture.componentInstance.categories()).toEqual([category]);
  });

  it('shows the empty state when there are no products', () => {
    const search = jasmine.createSpy().and.returnValue(of({ items: [], page: 0, size: 50, totalElements: 0, totalPages: 0 }));
    const { fixture } = setup({ search });
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('app-empty-state'))).not.toBeNull();
  });

  it('does not submit the create form when required fields are missing', () => {
    const { fixture, catalogueServiceSpy } = setup();
    fixture.detectChanges();

    fixture.componentInstance.startCreate();
    fixture.componentInstance.save();

    expect(catalogueServiceSpy.create).not.toHaveBeenCalled();
    expect(fixture.componentInstance.form.invalid).toBeTrue();
  });

  it('creates a new product with the form values and reloads the list', () => {
    const { fixture, catalogueServiceSpy } = setup();
    fixture.detectChanges();

    fixture.componentInstance.startCreate();
    fixture.componentInstance.form.setValue({
      name: 'Wheat 5kg',
      sku: 'WHEAT-5KG',
      categoryId: 2,
      unitPrice: 200,
      stock: 10,
      status: 'ACTIVE',
      description: 'Premium wheat, 5kg pack.',
      lowStockThreshold: null,
      weightKg: 2.5,
    });

    fixture.componentInstance.save();

    expect(catalogueServiceSpy.create).toHaveBeenCalledWith({
      name: 'Wheat 5kg',
      sku: 'WHEAT-5KG',
      categoryId: 2,
      unitPrice: 200,
      stock: 10,
      status: 'ACTIVE',
      description: 'Premium wheat, 5kg pack.',
      lowStockThreshold: null,
      weightKg: 2.5,
    });
    expect(fixture.componentInstance.showForm()).toBeFalse();
  });

  it('updates an existing product when editing', () => {
    const { fixture, catalogueServiceSpy } = setup();
    fixture.detectChanges();

    fixture.componentInstance.startEdit(product);
    fixture.componentInstance.save();

    expect(catalogueServiceSpy.update).toHaveBeenCalledWith(product.id, {
      name: product.name,
      sku: product.sku,
      categoryId: product.categoryId,
      unitPrice: product.unitPrice,
      stock: product.stock,
      status: product.status,
      description: product.description,
      lowStockThreshold: product.lowStockThreshold,
      weightKg: 5,
    });
  });

  it('surfaces an error message when saving fails', () => {
    const create = jasmine.createSpy().and.returnValue(throwError(() => ({ status: 400 })));
    const { fixture } = setup({ create });
    fixture.detectChanges();
    fixture.componentInstance.startCreate();
    fixture.componentInstance.form.setValue({
      name: 'Wheat 5kg',
      sku: 'WHEAT-5KG',
      categoryId: 2,
      unitPrice: 200,
      stock: 10,
      status: 'ACTIVE',
      description: 'Premium wheat, 5kg pack.',
      lowStockThreshold: null,
      weightKg: null,
    });

    fixture.componentInstance.save();

    expect(fixture.componentInstance.saving()).toBeFalse();
    expect(fixture.componentInstance.formError()).toBeTruthy();
  });

  it('duplicates a product and shows a confirmation toast', () => {
    const { fixture, catalogueServiceSpy } = setup();
    fixture.detectChanges();

    fixture.componentInstance.duplicate(product);

    expect(catalogueServiceSpy.duplicate).toHaveBeenCalledWith(product.id);
    expect(fixture.componentInstance.toastMessage()).toBe('Product duplicated');
  });

  it('removes a product and reloads the list', () => {
    const { fixture, catalogueServiceSpy } = setup();
    fixture.detectChanges();
    catalogueServiceSpy.search.calls.reset();

    fixture.componentInstance.remove(product);

    expect(catalogueServiceSpy.remove).toHaveBeenCalledWith(product.id);
    expect(catalogueServiceSpy.search).toHaveBeenCalled();
  });
});
