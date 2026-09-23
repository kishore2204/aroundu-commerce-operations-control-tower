import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { FieldHintComponent } from '../../../shared/field-hint/field-hint.component';
import { CatalogueService } from '../../../core/services/catalogue.service';
import { CategoryService } from '../../../core/services/category.service';
import { extractErrorMessage } from '../../../core/api/http-error.util';
import { Product } from '../../../core/models/product.model';
import { ProductCategory } from '../../../core/models/category.model';
import { BulkConflict, BulkDecision, BulkUploadResult } from '../../../core/models/bulk-upload.model';
import { BulkConflictDialogComponent } from './bulk-conflict-dialog.component';
import { BulkResultDialogComponent } from './bulk-result-dialog.component';
import { IntegerOnlyDirective } from '../../../shared/input-rules/integer-only.directive';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-retailer-catalogue',
  standalone: true,
  imports: [IntegerOnlyDirective, FieldHintComponent, CurrencyPipe, ReactiveFormsModule, EmptyStateComponent, BulkConflictDialogComponent, BulkResultDialogComponent, ConfirmDialogComponent],
  templateUrl: './catalogue.component.html',
  styleUrl: './catalogue.component.css',
})
export class RetailerCatalogueComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly products = signal<Product[]>([]);
  readonly categories = signal<ProductCategory[]>([]);
  readonly loading = signal(true);
  readonly showForm = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly toastMessage = signal<string | null>(null);
  readonly selectedImageFiles = signal<File[]>([]);
  /** The product awaiting a delete confirmation - deleting a product is not undoable from this screen. */
  readonly pendingDelete = signal<Product | null>(null);
  readonly deleting = signal(false);

  // Bulk upload: upload -> (conflict dialog, only if existing products differ) -> result dialog.
  readonly bulkBusy = signal(false);
  readonly bulkError = signal<string | null>(null);
  readonly bulkConflicts = signal<BulkConflict[] | null>(null);
  readonly bulkResult = signal<BulkUploadResult | null>(null);
  /** Which rejected-products file is being prepared (null = none). */
  readonly bulkDownloading = signal<'xlsx' | 'csv' | null>(null);
  /** The file being processed - re-sent together with the retailer's decisions. */
  private bulkFile: File | null = null;

  readonly searchControl = this.fb.nonNullable.control('');
  readonly categoryFilterControl = this.fb.nonNullable.control<number | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(80)]],
    sku: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9_-]{3,20}$/)]],
    categoryId: [null as number | null, [Validators.required]],
    unitPrice: [0, [Validators.required, Validators.min(0.01)]],
    stock: [0, [Validators.min(0)]],
    status: ['ACTIVE', [Validators.required]],
    description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(300)]],
    lowStockThreshold: [null as number | null],
    weightKg: [null as number | null, [Validators.min(0.001), Validators.max(999999.999)]],
  });

  constructor(
    private readonly catalogueService: CatalogueService,
    private readonly categoryService: CategoryService,
  ) {}

  ngOnInit(): void {
    this.loadCategories();
    this.searchControl.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => this.load());
    this.categoryFilterControl.valueChanges.subscribe(() => this.load());
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.catalogueService
      .search({
        q: this.searchControl.value || undefined,
        categoryId: this.categoryFilterControl.value ?? undefined,
        page: 0,
        size: 50,
      })
      .subscribe({
      next: (page) => {
        this.products.set(page.items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private showToast(message: string): void {
    this.toastMessage.set(message);
    setTimeout(() => this.toastMessage.set(null), 3000);
  }

  // ---------------------------------------------------------------- bulk upload

  onBulkFileChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = ''; // lets the same file be chosen again after a correction
    if (!file || this.bulkBusy()) return;
    this.bulkFile = file;
    this.runBulkUpload();
  }

  /** First call has no decisions: existing products with different data come back as conflicts and
   *  nothing is written. Once the retailer has decided, the same file is sent again with them. */
  private runBulkUpload(decisions?: Record<string, BulkDecision>): void {
    if (!this.bulkFile) return;
    this.bulkBusy.set(true);
    this.bulkError.set(null);
    this.catalogueService.bulkUpload(this.bulkFile, decisions).subscribe({
      next: (result) => {
        this.bulkBusy.set(false);
        if (result.status === 'NEEDS_DECISIONS') {
          this.bulkConflicts.set(result.conflicts);
          return;
        }
        this.bulkConflicts.set(null);
        this.bulkFile = null;
        this.bulkResult.set(result);
        this.load();
      },
      error: (err) => {
        this.bulkBusy.set(false);
        this.bulkConflicts.set(null);
        this.bulkFile = null;
        this.bulkError.set(extractErrorMessage(err, 'The file could not be uploaded. Please try again.'));
      },
    });
  }

  onConflictsConfirmed(decisions: Record<string, BulkDecision>): void {
    this.runBulkUpload(decisions);
  }

  /** Cancelling changes nothing - the file was only parsed, never applied. */
  onConflictsCancelled(): void {
    this.bulkConflicts.set(null);
    this.bulkFile = null;
  }

  closeBulkResult(): void {
    this.bulkResult.set(null);
  }

  downloadBulkTemplate(format: 'xlsx' | 'csv'): void {
    this.catalogueService.bulkTemplate(format).subscribe({
      next: (blob) => this.saveFile(blob, `product-upload-template.${format}`),
      error: () => this.showToast('Could not download the template. Please try again.'),
    });
  }

  /** Both formats are made by the server from the very same rejected rows (and are what the Rejection Log shows). */
  downloadRejectedProducts(format: 'xlsx' | 'csv' = 'xlsx'): void {
    const rows = this.bulkResult()?.rejectedRows ?? [];
    if (rows.length === 0 || this.bulkDownloading()) return;
    this.bulkDownloading.set(format);
    this.catalogueService.bulkRejectedReport(rows, format).subscribe({
      next: (blob) => {
        this.bulkDownloading.set(null);
        this.saveFile(blob, `rejected-products.${format}`);
      },
      error: () => {
        this.bulkDownloading.set(null);
        this.showToast('Could not prepare the rejected products file. Please try again.');
      },
    });
  }

  private saveFile(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  /** Categories are read from the server every time (never the shared cache): a category the admin just added or
   *  switched off must show up - or disappear - the next time the retailer opens the product form. */
  private loadCategories(): void {
    this.categoryService.activeFresh().subscribe({ next: (c) => this.categories.set(c), error: () => {} });
  }

  /** Editing a product whose category has been switched off: it keeps that category, but it is not offered as a choice. */
  keptCategoryInactive(): boolean {
    const id = this.form.controls.categoryId.value;
    return this.editingId() !== null && id !== null && this.categories().length > 0 && !this.categories().some((c) => c.id === id);
  }

  startCreate(): void {
    this.loadCategories();
    this.editingId.set(null);
    this.form.reset({
      name: '',
      sku: '',
      categoryId: null,
      unitPrice: 0,
      stock: 0,
      status: 'ACTIVE',
      description: '',
      lowStockThreshold: null,
      weightKg: null,
    });
    this.selectedImageFiles.set([]);
    this.formError.set(null);
    this.showForm.set(true);
  }

  startEdit(product: Product): void {
    this.loadCategories();
    this.editingId.set(product.id);
    this.form.reset({
      name: product.name,
      sku: product.sku,
      categoryId: product.categoryId,
      unitPrice: product.unitPrice,
      stock: product.stock,
      status: product.status,
      description: product.description,
      lowStockThreshold: product.lowStockThreshold,
      weightKg: product.weightKg ?? null,
    });
    this.selectedImageFiles.set([]);
    this.formError.set(null);
    this.showForm.set(true);
  }

  onImagesSelected(event: Event): void {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    this.selectedImageFiles.set(files.slice(0, 8));
  }

  cancelForm(): void {
    this.showForm.set(false);
  }

  save(): void {
    if (this.saving() || this.form.invalid) return;
    this.saving.set(true);
    this.formError.set(null);
    const { name, sku, categoryId, unitPrice, stock, status, description, lowStockThreshold, weightKg } = this.form.getRawValue();
    const request = { name, sku, categoryId: categoryId!, unitPrice, stock, status, description, lowStockThreshold, weightKg };
    const id = this.editingId();
    const call = id ? this.catalogueService.update(id, request) : this.catalogueService.create(request);
    call
      .pipe(
        switchMap((product) => {
          const files = this.selectedImageFiles();
          return files.length > 0 ? this.catalogueService.uploadImages(product.id, files) : of([]);
        }),
      )
      .subscribe({
      next: () => {
        this.saving.set(false);
        this.selectedImageFiles.set([]);
        this.showForm.set(false);
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(extractErrorMessage(err, 'Could not save this product.'));
      },
    });
  }

  duplicate(product: Product): void {
    this.catalogueService.duplicate(product.id).subscribe({
      next: () => {
        this.showToast('Product duplicated');
        this.load();
      },
      error: (err) => this.showToast(extractErrorMessage(err)),
    });
  }

  /** Opens the confirmation dialog instead of deleting immediately. */
  remove(product: Product): void {
    this.pendingDelete.set(product);
  }

  confirmDelete(): void {
    const product = this.pendingDelete();
    if (!product || this.deleting()) return;
    this.deleting.set(true);
    this.catalogueService.remove(product.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.pendingDelete.set(null);
        this.showToast('Product deleted.');
        this.load();
      },
      error: (err) => {
        this.deleting.set(false);
        this.pendingDelete.set(null);
        this.showToast(extractErrorMessage(err, 'Could not delete this product.'));
      },
    });
  }

  cancelDelete(): void {
    if (this.deleting()) return;
    this.pendingDelete.set(null);
  }
}
