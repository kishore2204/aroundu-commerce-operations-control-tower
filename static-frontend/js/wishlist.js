/* Your wishlist - port of features/wishlist/wishlist.component.* */
window.WishlistPage = {
  tag: 'app-wishlist',
  init() {
    this.state = U.state({ items: [], loading: true, loadError: null, busy: false });
    this.load();
  },
  load() {
    const s = this.state;
    s.loading = true;
    s.loadError = null;
    WishlistService.list(0, 50).then((page) => { s.items = page.items; s.loading = false; }, (err) => { s.loading = false; s.loadError = U.extractErrorMessage(err, 'Could not load your wishlist.'); });
  },
  remove(id) {
    const s = this.state;
    s.busy = true;
    WishlistService.remove(id).then(() => { s.busy = false; this.load(); }, (err) => { s.busy = false; Toast.show(U.extractErrorMessage(err), 'error'); });
  },
  render() {
    const html = U.html;
    const s = this.state;
    return html`
<h1 class="mb-4 text-2xl font-extrabold text-slate-900">Your wishlist</h1>

${s.loading ? html`<div class="flex justify-center py-10"><div class="spinner"></div></div>`
  : s.loadError ? EmptyState({ icon: 'error_outline', title: 'Could not load your wishlist', subtitle: s.loadError, content: html`<button type="button" class="btn-outline mt-3" onclick="Page.load()">Retry</button>` })
  : s.items.length === 0 ? html`
  ${EmptyState({ icon: 'favorite_border', title: 'Your wishlist is empty', subtitle: 'Save products you love for later.' })}
  <div class="mt-4 flex justify-center">
    <a class="btn-primary" href="${Nav.href('/products')}">Browse products</a>
  </div>` : html`
  <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
    ${U.each(s.items, (item) => html`
      <div class="flex flex-col gap-2" data-key="${item.id}">
        ${ProductCard(item.product)}
        <div class="flex justify-end">
          <button type="button" class="btn-icon text-rose-500 hover:bg-rose-50 hover:text-rose-600" ${U.dis(s.busy)} onclick="Page.remove(${U.arg(item.id)})" aria-label="Remove">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>`)}
  </div>`}`;
  },
};
