/*
 * Forms - a small ReactiveForms equivalent: U.control / U.group (FormControl / FormGroup), the validators V.*
 * and the U.bind / U.bindSelect helpers that wire an <input> or <select> to its control.
 */
(function () {
  'use strict';

  const U = window.U;

  const V = (window.V = {
    required: (c) => {
      const v = c.value;
      return v == null || (typeof v === 'string' && v.length === 0) || (Array.isArray(v) && v.length === 0) ? { required: true } : null;
    },
    requiredTrue: (c) => (c.value === true ? null : { required: true }),
    email: (c) => {
      const v = c.value;
      if (v == null || v === '') return null;
      const EMAIL = /^(?=.{1,254}$)(?=.{1,64}@)[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      return EMAIL.test(v) ? null : { email: true };
    },
    minLength: (min) => (c) => {
      const v = c.value;
      if (v == null || v.length === undefined || v.length === 0) return null;
      return v.length < min ? { minlength: { requiredLength: min, actualLength: v.length } } : null;
    },
    maxLength: (max) => (c) => {
      const v = c.value;
      return v != null && v.length !== undefined && v.length > max ? { maxlength: { requiredLength: max, actualLength: v.length } } : null;
    },
    min: (min) => (c) => {
      const v = c.value;
      if (v == null || v === '' || isNaN(parseFloat(v))) return null;
      return parseFloat(v) < min ? { min: { min, actual: v } } : null;
    },
    max: (max) => (c) => {
      const v = c.value;
      if (v == null || v === '' || isNaN(parseFloat(v))) return null;
      return parseFloat(v) > max ? { max: { max, actual: v } } : null;
    },
    pattern: (pattern) => {
      let regex;
      if (typeof pattern === 'string') regex = new RegExp('^' + pattern.replace(/^\^/, '').replace(/\$$/, '') + '$');
      else regex = pattern;
      return (c) => {
        const v = c.value;
        if (v == null || v === '') return null;
        return regex.test(String(v)) ? null : { pattern: { requiredPattern: String(regex), actualValue: v } };
      };
    },
  });

  class FormControl {
    constructor(value, validators = [], opts = {}) {
      this.initial = value;
      this._value = value;
      this.validators = Array.isArray(validators) ? validators : [validators];
      this.touched = false;
      this.dirty = false;
      this.disabled = !!opts.disabled;
      this.nonNullable = !!opts.nonNullable;
      this.parent = null;
    }
    get value() { return this._value; }
    set value(v) { this.setValue(v); }
    setValue(v) { this._value = v; this.manualErrors = null; App.update(); }
    patchValue(v) { this.setValue(v); }
    reset(v) {
      this._value = v !== undefined ? v : (this.nonNullable ? this.initial : null);
      this.touched = false;
      this.dirty = false;
      App.update();
    }
    setErrors(errors) { this.manualErrors = errors; App.update(); }
    get errors() {
      if (this.disabled) return null;
      let errors = this.manualErrors ? Object.assign({}, this.manualErrors) : null;
      for (const fn of this.validators) {
        const e = fn(this);
        if (e) errors = Object.assign(errors || {}, e);
      }
      return errors;
    }
    hasError(key) { const e = this.errors; return !!(e && e[key]); }
    getError(key) { const e = this.errors; return e ? e[key] : null; }
    get valid() { return this.disabled || !this.errors; }
    get invalid() { return !this.valid; }
    get untouched() { return !this.touched; }
    get pristine() { return !this.dirty; }
    markAsTouched() { this.touched = true; App.update(); }
    markAsUntouched() { this.touched = false; App.update(); }
    markAsDirty() { this.dirty = true; App.update(); }
    markAsPristine() { this.dirty = false; App.update(); }
    markAllAsTouched() { this.markAsTouched(); }
    setValidators(validators) { this.validators = Array.isArray(validators) ? validators : validators ? [validators] : []; }
    addValidators(validators) { this.validators = this.validators.concat(validators); }
    clearValidators() { this.validators = []; }
    updateValueAndValidity() { App.update(); }
    disable() { this.disabled = true; App.update(); }
    enable() { this.disabled = false; App.update(); }
    get enabled() { return !this.disabled; }
    /* from an <input>/<select>/<textarea> */
    input(el) {
      let v;
      if (el.type === 'checkbox') v = el.checked;
      else if (el.type === 'number') v = el.value === '' ? null : parseFloat(el.value);
      else v = el.value;
      this._value = v;
      this.manualErrors = null;
      this.dirty = true;
      App.update();
    }
    blur() { this.touched = true; App.update(); }
  }

  class FormGroup {
    constructor(controls, validators = []) {
      this.controls = controls;
      this.validators = Array.isArray(validators) ? validators : [validators];
      for (const c of Object.values(controls)) c.parent = this;
    }
    get value() {
      const out = {};
      for (const [k, c] of Object.entries(this.controls)) if (!c.disabled) out[k] = c.value;
      return out;
    }
    getRawValue() {
      const out = {};
      for (const [k, c] of Object.entries(this.controls)) out[k] = c instanceof FormGroup ? c.getRawValue() : c.value;
      return out;
    }
    get(name) { return this.controls[name]; }
    get errors() {
      let errors = null;
      for (const fn of this.validators) {
        const e = fn(this);
        if (e) errors = Object.assign(errors || {}, e);
      }
      return errors;
    }
    hasError(key, path) { if (path) return this.controls[path].hasError(key); const e = this.errors; return !!(e && e[key]); }
    get valid() { return !this.errors && Object.values(this.controls).every((c) => c.valid); }
    get invalid() { return !this.valid; }
    get touched() { return Object.values(this.controls).some((c) => c.touched); }
    get dirty() { return Object.values(this.controls).some((c) => c.dirty); }
    get pristine() { return !this.dirty; }
    markAllAsTouched() { Object.values(this.controls).forEach((c) => c.markAllAsTouched()); App.update(); }
    markAsPristine() { Object.values(this.controls).forEach((c) => c.markAsPristine()); }
    markAsUntouched() { Object.values(this.controls).forEach((c) => c.markAsUntouched()); }
    patchValue(values) {
      for (const [k, v] of Object.entries(values || {})) if (this.controls[k]) {
        if (this.controls[k] instanceof FormGroup) this.controls[k].patchValue(v);
        else this.controls[k].setValue(v);
      }
    }
    setValue(values) { this.patchValue(values); }
    reset(values) {
      for (const [k, c] of Object.entries(this.controls)) c.reset(values ? values[k] : undefined);
    }
  }

  U.FormControl = FormControl;
  U.FormGroup = FormGroup;
  U.control = (value, validators, opts) => new FormControl(value, validators, opts);
  U.group = (controls, validators) => new FormGroup(controls, validators);

  /*
   * Attribute string for a form control bound element (the equivalent of formControlName/ngModel):
   *   <input ${U.bind('Page.form', 'email')}>   ->  value + input/blur handlers
   */
  U.bind = function (formPath, name, control) {
    const ctrl = control;
    const ref = `${formPath}.controls['${name}']`;
    let value = ctrl ? ctrl.value : '';
    const attrs = [];
    if (value !== null && value !== undefined && typeof value !== 'boolean') attrs.push(`value="${U.esc(value)}"`);
    if (value === true) attrs.push('checked');
    if (ctrl && ctrl.disabled) attrs.push('disabled');
    attrs.push(`oninput="${ref}.input(this)"`);
    attrs.push(`onchange="${ref}.input(this)"`);
    attrs.push(`onblur="${ref}.blur()"`);
    return U.raw(attrs.join(' '));
  };

  /*
   * A <select> bound to a control (formControlName): shows exactly the control's value (blank when no option
   * matches, as Angular does). `parse` converts the option's string value (e.g. Number for [ngValue]="id").
   *   <select ${U.bindSelect('Page.form', 'rating', ctrl, { parse: 'Number', onchange: 'Page.x()' })}>
   */
  U.bindSelect = function (formPath, name, control, opts = {}) {
    const ref = `${formPath}.controls['${name}']`;
    const value = control ? control.value : '';
    const parse = opts.parse ? `(this.value === 'null' ? null : ${opts.parse}(this.value))` : 'this.value';
    const attrs = [
      `data-value="${U.esc(value === null || value === undefined ? 'null' : value)}"`,
      `onchange="${ref}.setValue(${parse}); ${ref}.markAsDirty(); ${opts.onchange || ''}"`,
      `onblur="${ref}.blur()"`,
    ];
    if (control && control.disabled) attrs.push('disabled');
    return U.raw(attrs.join(' '));
  };

  /* <option> list helper: selected attribute set on the option equal to `current` */
  U.sel = (current, value) => (String(current ?? '') === String(value ?? '') ? 'selected' : '');
  U.chk = (flag) => (flag ? 'checked' : '');
  U.dis = (flag) => (flag ? 'disabled' : '');

})();
