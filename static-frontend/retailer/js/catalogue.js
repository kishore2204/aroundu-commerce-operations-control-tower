/* Retailer catalogue - port of features/retailer/catalogue/catalogue.component.* (single product create / edit, images, duplicate, delete). */
(function () {
  const html = U.html;
  window.RetailerCataloguePage = {
    tag: 'app-retailer-catalogue',
    init() {
      this.state = U.state({
        products: [], categories: [], loading: true, showForm: false, editingId: null, saving: false, formError: null, toastMessage: null,
        selectedImageFiles: [], pendingDelete: null, deleting: false, search: '', categoryFilter: null,
      });
      this.loadSequence = 0;
      this.form = U.group({
        name: U.control('', [V.required, V.minLength(3), V.maxLength(80)], { nonNullable: true }),
        sku: U.control('', [V.required, V.pattern(/^[A-Za-z0-9_-]{3,20}$/)], { nonNullable: true }),
        categoryId: U.control(null, [V.required], { nonNullable: true }),
        unitPrice: U.control(0, [V.required, V.min(0.01)], { nonNullable: true }),
        stock: U.control(0, [V.min(0)], { nonNullable: true }),
        status: U.control('ACTIVE', [V.required], { nonNullable: true }),
        description: U.control('', [V.required, V.minLength(10), V.maxLength(300)], { nonNullable: true }),
        lowStockThreshold: U.control(null, [], { nonNullable: true }),
        weightKg: U.control(null, [V.min(0.001), V.max(999999.999)], { nonNullable: true }),
      });
      this.loadCategories();
      this.load();
    },
    /* searchControl.valueChanges.pipe(map(trim), debounceTime(300), distinctUntilChanged()) */
    searchChanged(value) {
      this.state.search = value;
      clearTimeout(this.debounce);
      const trimmed = value.trim();
      this.debounce = setTimeout(() => {
        if (trimmed === (this.lastSearch ?? '')) return;
        this.lastSearch = trimmed;
        this.load();
      }, 300);
    },
    categoryFilterChanged(value) {
      this.state.categoryFilter = value === 'null' ? null : Number(value);
      this.load();
    },
    load() {
      const s = this.state;
      const sequence = ++this.loadSequence;
      s.loading = true;
      CatalogueService.search({ q: s.search.trim() || undefined, categoryId: s.categoryFilter ?? undefined, page: 0, size: 50 }).then(
        (page) => { if (sequence !== this.loadSequence) return; s.products = page.items; s.loading = false; },
        () => { if (sequence === this.loadSequence) s.loading = false; },
      );
    },
    showToast(message) {
      this.state.toastMessage = message;
      setTimeout(() => { this.state.toastMessage = null; }, 3000);
    },
    loadCategories() {
      CategoryService.activeFresh().then((c) => { this.state.categories = c; }, () => {});
    },
    keptCategoryInactive() {
      const s = this.state;
      const id = this.form.controls.categoryId.value;
      return s.editingId !== null && id !== null && s.categories.length > 0 && !s.categories.some((c) => c.id === id);
    },
    startCreate() {
      const s = this.state;
      this.loadCategories();
      s.editingId = null;
      this.form.reset({ name: '', sku: '', categoryId: null, unitPrice: 0, stock: 0, status: 'ACTIVE', description: '', lowStockThreshold: null, weightKg: null });
      s.selectedImageFiles = [];
      s.formError = null;
      s.showForm = true;
    },
    startEdit(id) {
      const s = this.state;
      const product = s.products.find((p) => p.id === id);
      this.loadCategories();
      s.editingId = product.id;
      this.form.reset({
        name: product.name, sku: product.sku, categoryId: product.categoryId, unitPrice: product.unitPrice, stock: product.stock, status: product.status,
        description: product.description, lowStockThreshold: product.lowStockThreshold, weightKg: product.weightKg ?? null,
      });
      s.selectedImageFiles = [];
      s.formError = null;
      s.showForm = true;
    },
    onImagesSelected(input) { this.state.selectedImageFiles = Array.from(input.files || []).slice(0, 8); },
    cancelForm() { this.state.showForm = false; },
    save() {
      const s = this.state;
      if (s.saving || this.form.invalid) return;
      s.saving = true;
      s.formError = null;
      const v = this.form.getRawValue();
      const request = { name: v.name, sku: v.sku, categoryId: v.categoryId, unitPrice: v.unitPrice, stock: v.stock, status: v.status, description: v.description, lowStockThreshold: v.lowStockThreshold, weightKg: v.weightKg };
      const id = s.editingId;
      const call = id ? CatalogueService.update(id, request) : CatalogueService.create(request);
      call.then((product) => (s.selectedImageFiles.length > 0 ? CatalogueService.uploadImages(product.id, s.selectedImageFiles) : []))
        .then(() => { s.saving = false; s.selectedImageFiles = []; s.showForm = false; this.load(); },
          (err) => { s.saving = false; s.formError = U.extractErrorMessage(err, 'Could not save this product.'); });
    },
    duplicate(id) {
      CatalogueService.duplicate(id).then(() => { this.showToast('Product duplicated'); this.load(); }, (err) => this.showToast(U.extractErrorMessage(err)));
    },
    remove(id) { this.state.pendingDelete = this.state.products.find((p) => p.id === id) || null; },
    confirmDelete() {
      const s = this.state;
      const product = s.pendingDelete;
      if (!product || s.deleting) return;
      s.deleting = true;
      CatalogueService.remove(product.id).then(
        () => { s.deleting = false; s.pendingDelete = null; this.showToast('Product deleted.'); this.load(); },
        (err) => { s.deleting = false; s.pendingDelete = null; this.showToast(U.extractErrorMessage(err, 'Could not delete this product.')); },
      );
    },
    cancelDelete() { if (!this.state.deleting) this.state.pendingDelete = null; },
    render() {
      const s = this.state;
      const f = this.form.controls;
      const F = 'Page.form';
      const product = s.pendingDelete;
      return html`<div class="flex items-center justify-between mb-5">
  <h1 class="text-2xl font-bold text-slate-900">Catalogue</h1>
  ${!s.showForm ? html`
    <div class="flex flex-wrap items-center justify-end gap-2">
      <button type="button" class="btn-primary" onclick="Page.startCreate()">
        <i class="fa-solid fa-plus"></i> New product
      </button>
    </div>` : ''}
</div>

${s.toastMessage ? html`
  <div class="fixed top-4 right-4 z-50 card px-4 py-3 text-sm font-medium text-slate-800 shadow-card-hover animate-fade-in">
    ${s.toastMessage}
  </div>` : ''}

${s.showForm ? html`
  <div class="card max-w-2xl">
    <h2 class="text-lg font-semibold text-slate-900 mb-4">${s.editingId ? 'Edit product' : 'New product'}</h2>
    <form novalidate onsubmit="event.preventDefault(); Page.save()">
      <div class="form-grid">
        <div class="form-group full-width">
          <label class="form-label req-mark">Name</label>
          <input class="input" name="name" ${U.bind(F, 'name', f.name)} />
        </div>
        <div class="form-group">
          <label class="form-label req-mark">SKU${FieldHint('sku')}</label>
          <input class="input" name="sku" ${U.bind(F, 'sku', f.sku)} placeholder="RICE-5KG" />
          <span class="text-xs text-slate-400">Letters, numbers, - and _ only</span>
        </div>
        <div class="form-group">
          <label class="form-label req-mark">Category</label>
          <select class="select" name="categoryId" ${U.bindSelect(F, 'categoryId', f.categoryId, { parse: 'Number' })}>
            ${this.keptCategoryInactive() ? html`<option value="${f.categoryId.value}" disabled>Current category (no longer active)</option>` : ''}
            ${U.each(s.categories, (category) => html`<option value="${category.id}">${category.name}</option>`)}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label req-mark">Unit price${FieldHint('price')}</label>
          <input class="input" type="number" name="unitPrice" ${U.bind(F, 'unitPrice', f.unitPrice)} step="0.01" />
        </div>
        ${!s.editingId ? html`
          <div class="form-group">
            <label class="form-label req-mark">Initial stock${FieldHint('stock')}</label>
            <input class="input" type="number" min="0" step="1" data-integer-only name="stock" ${U.bind(F, 'stock', f.stock)} />
          </div>` : ''}
        <div class="form-group">
          <label class="form-label req-mark">Status</label>
          <select class="select" name="status" ${U.bindSelect(F, 'status', f.status)}>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
          </select>
        </div>
        <div class="form-group full-width">
          <label class="form-label req-mark">Description</label>
          <textarea class="input" name="description" rows="3" oninput="${F}.controls['description'].input(this)" onblur="${F}.controls['description'].blur()">${f.description.value}</textarea>
          <span class="text-xs text-slate-400">10-300 characters</span>
        </div>
        <div class="form-group">
          <label class="form-label">Low stock threshold (optional)${FieldHint('lowStock')}</label>
          <input class="input" type="number" min="0" step="1" data-integer-only name="lowStockThreshold" ${U.bind(F, 'lowStockThreshold', f.lowStockThreshold)} />
        </div>
        <div class="form-group">
          <label class="form-label">Weight (kg) (optional)${FieldHint('weight')}</label>
          <input class="input" type="number" min="0.001" step="0.001" name="weightKg" ${U.bind(F, 'weightKg', f.weightKg)} placeholder="1" />
          ${f.weightKg.invalid ? html`<span class="text-xs text-rose-600">Weight must be a positive number in kg.</span>`
            : html`<span class="text-xs text-slate-400">Weight of one unit in kg. Leave blank for 1 kg.</span>`}
        </div>
        <div class="form-group full-width">
          <label class="form-label">Product images</label>
          <input class="input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onchange="Page.onImagesSelected(this)" />
          <span class="text-xs text-slate-400">Up to 8 images. The first selected image is used as the customer-facing thumbnail.</span>
          ${s.selectedImageFiles.length > 0 ? html`
            <div class="mt-2 flex flex-wrap gap-2">
              ${U.each(s.selectedImageFiles, (file) => html`<span class="badge badge-active">${file.name}</span>`)}
            </div>` : ''}
        </div>
      </div>

      ${s.formError ? html`<p class="text-sm text-rose-600 mb-3">${s.formError}</p>` : ''}
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-outline" onclick="Page.cancelForm()">Cancel</button>
        <button type="submit" class="btn-primary" ${U.dis(this.form.invalid || s.saving)}>
          ${s.editingId ? 'Save changes' : 'Create product'}
        </button>
      </div>
    </form>
  </div>` : html`
  <div class="mb-4 flex flex-wrap gap-3">
    <div class="max-w-sm relative flex-1 min-w-[200px]">
      <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
      <input class="input pl-9" name="search" value="${s.search}" oninput="Page.searchChanged(this.value)" placeholder="Search my products..." />
    </div>
    <select class="select max-w-[220px]" name="categoryFilter" data-value="${s.categoryFilter === null ? 'null' : s.categoryFilter}" onchange="Page.categoryFilterChanged(this.value)">
      <option value="null">All categories</option>
      ${U.each(s.categories, (category) => html`<option value="${category.id}">${category.name}</option>`)}
    </select>
  </div>

  ${s.loading ? html`<div class="flex justify-center py-12"><div class="spinner"></div></div>`
    : s.products.length === 0 ? EmptyState({ icon: 'inventory_2', title: 'No products yet', subtitle: 'Add your first product to get started.' }) : html`
    <div class="table-card">
      <table class="custom-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>SKU / Category</th>
            <th>Stock</th>
            <th>Price</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${U.each(s.products, (p) => html`
            <tr data-key="${p.id}">
              <td>
                <div class="flex items-center gap-2">
                  <span class="font-medium text-slate-800">${p.name}</span>
                  <span class="${U.cls('badge', { 'badge-active': p.status !== 'DRAFT', 'badge-inactive': p.status === 'DRAFT' })}">
                    ${p.status}
                  </span>
                </div>
              </td>
              <td class="text-slate-500">${p.sku} - ${p.categoryName}</td>
              <td>${p.stock}</td>
              <td class="font-semibold text-slate-900">${U.currency(p.unitPrice, 'INR')}</td>
              <td>
                <div class="flex items-center gap-1 justify-end">
                  <button type="button" class="btn-icon" onclick="Page.startEdit(${p.id})" aria-label="Edit"><i class="fa-solid fa-pen"></i></button>
                  <button type="button" class="btn-icon" onclick="Page.duplicate(${p.id})" aria-label="Duplicate"><i class="fa-solid fa-copy"></i></button>
                  <button type="button" class="btn-icon" onclick="Page.remove(${p.id})" aria-label="Delete"><i class="fa-solid fa-trash-can"></i></button>
                </div>
              </td>
            </tr>`)}
        </tbody>
      </table>
    </div>`}`}

${product ? ConfirmDialog({
  key: 'delete-product', title: 'Delete this product?',
  message: 'Delete ' + product.name + ' (SKU ' + product.sku + ')? This cannot be undone.',
  confirmLabel: 'Delete', busyLabel: 'Deleting...', danger: true, busy: s.deleting,
  onConfirm: () => this.confirmDelete(), onCancel: () => this.cancelDelete(),
}) : ''}`;
    },
  };
})();
