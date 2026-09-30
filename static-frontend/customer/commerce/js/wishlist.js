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
    WishlistService.list(0, 50).then(
      (page) => {
        s.items = page.items;
        s.loading = false;
      },
      (err) => {
        s.loading = false;
        s.loadError = U.extractErrorMessage(err, 'Could not load your wishlist.');
      },
    );
  },
  remove(id) {
    const s = this.state;
    s.busy = true;
    WishlistService.remove(id).then(
      () => {
        s.busy = false;
        this.load();
      },
      (err) => {
        s.busy = false;
        Toast.show(U.extractErrorMessage(err), 'error');
      },
    );
  },
  render() {
    const s = this.state;
    return U.tpl('wishlist', [
      s.loading
        ? U.tpl('wishlist-1')
        : s.loadError
          ? EmptyState({
              icon: 'error_outline',
              title: 'Could not load your wishlist',
              subtitle: s.loadError,
              content: U.tpl('wishlist-2'),
            })
          : s.items.length === 0
            ? U.tpl('wishlist-3', [
                EmptyState({ icon: 'favorite_border', title: 'Your wishlist is empty', subtitle: 'Save products you love for later.' }),
                Nav.href('/products'),
              ])
            : U.tpl('wishlist-4', [
                U.each(s.items, (item) => U.tpl('wishlist-4-1', [item.id, ProductCard(item.product), U.dis(s.busy), U.arg(item.id)])),
              ]),
    ]);
  },
};
