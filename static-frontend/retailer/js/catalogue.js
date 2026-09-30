/* Retailer catalogue - port of features/retailer/catalogue/catalogue.component.* (single product create / edit, images, duplicate, delete). */
(function () {
  window.RetailerCataloguePage = {
    tag: 'app-retailer-catalogue',
    init() {
      this.state = U.state({
        products: [],
        categories: [],
        loading: true,
        showForm: false,
        editingId: null,
        saving: false,
        formError: null,
        toastMessage: null,
        selectedImageFiles: [],
        pendingDelete: null,
        deleting: false,
        search: '',
        categoryFilter: null,
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
        (page) => {
          if (sequence !== this.loadSequence) return;
          s.products = page.items;
          s.loading = false;
        },
        () => {
          if (sequence === this.loadSequence) s.loading = false;
        },
      );
    },
    showToast(message) {
      this.state.toastMessage = message;
      setTimeout(() => {
        this.state.toastMessage = null;
      }, 3000);
    },
    loadCategories() {
      CategoryService.activeFresh().then(
        (c) => {
          this.state.categories = c;
        },
        () => {},
      );
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
      s.selectedImageFiles = [];
      s.formError = null;
      s.showForm = true;
    },
    onImagesSelected(input) {
      this.state.selectedImageFiles = Array.from(input.files || []).slice(0, 8);
    },
    cancelForm() {
      this.state.showForm = false;
    },
    save() {
      const s = this.state;
      if (s.saving || this.form.invalid) return;
      s.saving = true;
      s.formError = null;
      const v = this.form.getRawValue();
      const request = {
        name: v.name,
        sku: v.sku,
        categoryId: v.categoryId,
        unitPrice: v.unitPrice,
        stock: v.stock,
        status: v.status,
        description: v.description,
        lowStockThreshold: v.lowStockThreshold,
        weightKg: v.weightKg,
      };
      const id = s.editingId;
      const call = id ? CatalogueService.update(id, request) : CatalogueService.create(request);
      call
        .then((product) => (s.selectedImageFiles.length > 0 ? CatalogueService.uploadImages(product.id, s.selectedImageFiles) : []))
        .then(
          () => {
            s.saving = false;
            s.selectedImageFiles = [];
            s.showForm = false;
            this.load();
          },
          (err) => {
            s.saving = false;
            s.formError = U.extractErrorMessage(err, 'Could not save this product.');
          },
        );
    },
    duplicate(id) {
      CatalogueService.duplicate(id).then(
        () => {
          this.showToast('Product duplicated');
          this.load();
        },
        (err) => this.showToast(U.extractErrorMessage(err)),
      );
    },
    remove(id) {
      this.state.pendingDelete = this.state.products.find((p) => p.id === id) || null;
    },
    confirmDelete() {
      const s = this.state;
      const product = s.pendingDelete;
      if (!product || s.deleting) return;
      s.deleting = true;
      CatalogueService.remove(product.id).then(
        () => {
          s.deleting = false;
          s.pendingDelete = null;
          this.showToast('Product deleted.');
          this.load();
        },
        (err) => {
          s.deleting = false;
          s.pendingDelete = null;
          this.showToast(U.extractErrorMessage(err, 'Could not delete this product.'));
        },
      );
    },
    cancelDelete() {
      if (!this.state.deleting) this.state.pendingDelete = null;
    },
    render() {
      const s = this.state;
      const f = this.form.controls;
      const F = 'Page.form';
      const product = s.pendingDelete;
      return U.tpl('catalogue', [
        !s.showForm ? U.tpl('catalogue-1') : '',
        s.toastMessage ? U.tpl('catalogue-2', [s.toastMessage]) : '',
        s.showForm
          ? U.tpl('catalogue-3', [
              s.editingId ? 'Edit product' : 'New product',
              U.bind(F, 'name', f.name),
              FieldHint('sku'),
              U.bind(F, 'sku', f.sku),
              U.bindSelect(F, 'categoryId', f.categoryId, { parse: 'Number' }),
              this.keptCategoryInactive() ? U.tpl('catalogue-3-1', [f.categoryId.value]) : '',
              U.each(s.categories, (category) => U.tpl('catalogue-3-2', [category.id, category.name])),
              FieldHint('price'),
              U.bind(F, 'unitPrice', f.unitPrice),
              !s.editingId ? U.tpl('catalogue-3-3', [FieldHint('stock'), U.bind(F, 'stock', f.stock)]) : '',
              U.bindSelect(F, 'status', f.status),
              F,
              F,
              f.description.value,
              FieldHint('lowStock'),
              U.bind(F, 'lowStockThreshold', f.lowStockThreshold),
              FieldHint('weight'),
              U.bind(F, 'weightKg', f.weightKg),
              f.weightKg.invalid ? U.tpl('catalogue-3-4') : U.tpl('catalogue-3-5'),
              s.selectedImageFiles.length > 0
                ? U.tpl('catalogue-3-6', [U.each(s.selectedImageFiles, (file) => U.tpl('catalogue-3-6-1', [file.name]))])
                : '',
              s.formError ? U.tpl('catalogue-3-7', [s.formError]) : '',
              U.dis(this.form.invalid || s.saving),
              s.editingId ? 'Save changes' : 'Create product',
            ])
          : U.tpl('catalogue-4', [
              s.search,
              s.categoryFilter === null ? 'null' : s.categoryFilter,
              U.each(s.categories, (category) => U.tpl('catalogue-4-1', [category.id, category.name])),
              s.loading
                ? U.tpl('catalogue-4-2')
                : s.products.length === 0
                  ? EmptyState({ icon: 'inventory_2', title: 'No products yet', subtitle: 'Add your first product to get started.' })
                  : U.tpl('catalogue-4-3', [
                      U.each(s.products, (p) =>
                        U.tpl('catalogue-4-3-1', [
                          p.id,
                          p.name,
                          U.clsMore({ 'badge-active': p.status !== 'DRAFT', 'badge-inactive': p.status === 'DRAFT' }),
                          p.status,
                          p.sku,
                          p.categoryName,
                          p.stock,
                          U.currency(p.unitPrice, 'INR'),
                          p.id,
                          p.id,
                          p.id,
                        ]),
                      ),
                    ]),
            ]),
        product
          ? ConfirmDialog({
              key: 'delete-product',
              title: 'Delete this product?',
              message: 'Delete ' + product.name + ' (SKU ' + product.sku + ')? This cannot be undone.',
              confirmLabel: 'Delete',
              busyLabel: 'Deleting...',
              danger: true,
              busy: s.deleting,
              onConfirm: () => this.confirmDelete(),
              onCancel: () => this.cancelDelete(),
            })
          : '',
      ]);
    },
  };
})();
