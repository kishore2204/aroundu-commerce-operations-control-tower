/*
 * App - mounts the page into <app-root> and re-renders it after every state change (change detection):
 * App.update(), U.state(), U.onEscape(), and the component instance registry (U.component / U.destroy / U.$).
 */
(function () {
  'use strict';

  const U = window.U;

  const App = (window.App = {
    root: null,
    renderFn: null,
    scheduled: false,
    afterRender: [],
    escapeHandlers: [],
    mount(root, renderFn) {
      this.root = root;
      this.renderFn = renderFn;
      this.render();
    },
    update() {
      if (this.scheduled || !this.renderFn) return;
      this.scheduled = true;
      queueMicrotask(() => {
        this.scheduled = false;
        this.render();
      });
    },
    render() {
      if (!this.renderFn) return;
      U.morph(this.root, this.renderFn());
      // [indeterminate] is a DOM property with no attribute: data-indeterminate="true|false" carries it
      this.root.querySelectorAll('input[data-indeterminate]').forEach((el) => { el.indeterminate = el.getAttribute('data-indeterminate') === 'true'; });
      const hooks = this.afterRender.splice(0);
      hooks.forEach((fn) => fn());
    },
    /* run once after the next render (e.g. focus an element that just appeared) */
    nextRender(fn) {
      this.afterRender.push(fn);
      this.update();
    },
  });

  /* A state object that re-renders the app whenever one of its properties is assigned (signal-like). */
  U.state = function (initial) {
    return new Proxy(initial, {
      set(target, prop, value) {
        if (target[prop] !== value) {
          target[prop] = value;
          App.update();
        }
        return true;
      },
    });
  };

  /* Any user interaction may change state held outside U.state - re-render after it (zone-like). */
  // (a macrotask, so the browser's default action - e.g. a label checking its radio - has completed first)
  ['click', 'input', 'change', 'keydown', 'keyup', 'submit', 'focusin', 'focusout'].forEach((type) => {
    document.addEventListener(type, () => setTimeout(() => App.update(), 0), false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      App.escapeHandlers.slice().forEach((fn) => fn(event));
      App.update();
    }
  });
  U.onEscape = (fn) => App.escapeHandlers.push(fn);

  /* registry for component instances referenced from inline handlers: U.$('card-12').add() */
  U.registry = {};
  U.$ = (key) => U.registry[key];

  /* instance registry: created (and initialised) once per key, dropped with U.destroy(key) */
  U.component = function (key, factory) {
    if (!U.registry[key]) {
      const instance = factory();
      instance.key = key;
      instance.ref = `U.$('${key}')`;
      U.registry[key] = instance;
      if (instance.init) instance.init();
    }
    return U.registry[key];
  };
  U.destroy = function (key) {
    const instance = U.registry[key];
    if (instance && instance.destroy) instance.destroy();
    delete U.registry[key];
  };
})();
