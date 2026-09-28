/* Not available for your account yet - port of features/unavailable/unavailable.component.* */
window.UnavailablePage = {
  tag: 'app-unavailable',
  render() {
    return U.tpl('unavailable', [Nav.href('/login')]);
  },
};
