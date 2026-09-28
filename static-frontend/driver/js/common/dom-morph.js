/*
 * DOM morphing - U.morph(target, html) updates the page in place after every change, so focus, caret,
 * scroll position and open <select>s survive a re-render (what Angular's change detection gives for free).
 */
(function () {
  'use strict';

  const U = window.U;

  function keyOf(node) {
    if (node.nodeType !== 1) return null;
    return node.getAttribute('data-key') || node.id || null;
  }

  function sameNode(a, b) {
    if (a.nodeType !== b.nodeType) return false;
    if (a.nodeType !== 1) return true;
    if (a.tagName !== b.tagName) return false;
    const ka = keyOf(a);
    const kb = keyOf(b);
    if (ka || kb) return ka === kb;
    if (a.tagName === 'INPUT') {
      const special = (t) => ['checkbox', 'radio', 'file'].includes((t || 'text').toLowerCase());
      const ta = a.getAttribute('type');
      const tb = b.getAttribute('type');
      if ((special(ta) || special(tb)) && ta !== tb) return false;
    }
    return true;
  }

  function syncAttributes(from, to) {
    const toAttrs = to.attributes;
    for (let i = 0; i < toAttrs.length; i++) {
      const { name, value } = toAttrs[i];
      if (from.getAttribute(name) !== value) from.setAttribute(name, value);
    }
    const fromAttrs = from.attributes;
    for (let i = fromAttrs.length - 1; i >= 0; i--) {
      const name = fromAttrs[i].name;
      if (!to.hasAttribute(name)) from.removeAttribute(name);
    }
  }

  /* the form state the new markup asks for - read BEFORE its children are moved into the live DOM */
  function desiredFormState(to) {
    const tag = to.tagName;
    if (tag === 'INPUT') {
      const type = (to.getAttribute('type') || 'text').toLowerCase();
      if (type === 'checkbox' || type === 'radio') return { checked: to.hasAttribute('checked') };
      if (type === 'file') return null;
      return { value: to.getAttribute('value') ?? '' };
    }
    if (tag === 'TEXTAREA') return { value: to.value };
    if (tag === 'SELECT') {
      const options = Array.from(to.options);
      const selected = options.find((o) => o.hasAttribute('selected'));
      return { value: selected ? selected.value : options[0] ? options[0].value : '', select: true };
    }
    return null;
  }

  function applyFormState(from, desired) {
    if (!desired) return;
    if ('checked' in desired) {
      if (from.checked !== desired.checked) from.checked = desired.checked;
    } else if (desired.select) {
      if (!from.multiple && from.value !== desired.value) from.value = desired.value;
    } else if (from.value !== desired.value) {
      from.value = desired.value;
    }
  }

  function morphNode(from, to) {
    if (from.nodeType === 3 || from.nodeType === 8) {
      if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue;
      return;
    }
    if (from.hasAttribute('data-static')) return; // subtree managed outside the renderer
    const desired = desiredFormState(to);
    syncAttributes(from, to);
    if (from.tagName !== 'TEXTAREA') morphChildren(from, to);
    applyFormState(from, desired);
  }

  function morphChildren(from, to) {
    let f = from.firstChild;
    let t = to.firstChild;
    while (t) {
      const nextT = t.nextSibling;
      if (!f) {
        from.appendChild(t);
        t = nextT;
        continue;
      }
      if (sameNode(f, t)) {
        morphNode(f, t);
        f = f.nextSibling;
        t = nextT;
        continue;
      }
      // keyed match further along the live list?
      const key = keyOf(t);
      let match = null;
      if (key) {
        for (let n = f.nextSibling; n; n = n.nextSibling) {
          if (keyOf(n) === key && sameNode(n, t)) { match = n; break; }
        }
      } else if (f.nextSibling && sameNode(f.nextSibling, t) && !(t.nextSibling && sameNode(f, t.nextSibling))) {
        // a node was removed from the live list
        match = f.nextSibling;
      }
      if (match) {
        while (f !== match) {
          const next = f.nextSibling;
          from.removeChild(f);
          f = next;
        }
        morphNode(f, t);
        f = f.nextSibling;
      } else {
        from.insertBefore(t, f);
      }
      t = nextT;
    }
    while (f) {
      const next = f.nextSibling;
      from.removeChild(f);
      f = next;
    }
  }

  const parser = document.createElement('template');
  U.morph = function (target, html) {
    parser.innerHTML = U.valueToHtml(html);
    const fragment = parser.content;
    // morph the target's children to the fragment's children
    const wrapper = document.createElement(target.tagName);
    wrapper.appendChild(fragment);
    morphChildren(target, wrapper);
    // a bound <select> shows exactly its control's value - blank when no option matches (like Angular)
    target.querySelectorAll('select[data-value]').forEach((select) => {
      const value = select.getAttribute('data-value');
      if (select.value !== value) select.value = value;
    });
  };

})();
