import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { ProductListComponent } from './product-list.component';
import { ProductService } from '../../../core/services/product.service';
import { CategoryService } from '../../../core/services/category.service';

describe('ProductListComponent', () => {
  function setup(queryParams: Record<string, string> = {}) {
    const search = jasmine.createSpy().and.returnValue(of({ items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }));
    TestBed.configureTestingModule({
      imports: [ProductListComponent],
      providers: [
        { provide: ProductService, useValue: { search } },
        { provide: CategoryService, useValue: { active: () => of([]) } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } } },
        provideHttpClient(),
      ],
    });
    const fixture = TestBed.createComponent(ProductListComponent);
    fixture.detectChanges();
    return { fixture, search };
  }

  it('pre-fills the search box from a ?q= query param (used by the "Try Another Shop" flow)', () => {
    const { fixture } = setup({ q: 'Rice' });
    expect(fixture.componentInstance.filters.value.q).toBe('Rice');
  });

  it('pre-fills the category filter from a ?categoryId= query param', () => {
    const { fixture } = setup({ categoryId: '3' });
    expect(fixture.componentInstance.filters.value.categoryId).toBe(3);
  });

  it('shows an empty state when no products match', () => {
    const { fixture } = setup();
    expect(fixture.debugElement.query(By.css('app-empty-state'))).not.toBeNull();
  });
});
