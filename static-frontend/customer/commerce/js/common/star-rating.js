/*
 * <app-star-rating> - port of src/app/shared/star-rating/star-rating.component.*
 */
(function () {
  'use strict';

  const html = U.html;

  window.StarRating = function (rating, count = null, showCount = true, hostClass = '') {
    const value = rating ?? 0;
    const rounded = Math.round(value);
    return html`
      <app-star-rating class="${hostClass}"><span class="inline-flex items-center gap-0.5" aria-label="${value + ' out of 5 stars'}">
        ${U.each([1, 2, 3, 4, 5], (i) => html`<i class="${U.cls('star text-[13px]', { 'fa-solid': i <= rounded, 'fa-regular': i > rounded, 'fa-star': true, filled: i <= rounded, 'text-amber-400': i <= rounded, 'text-slate-300': i > rounded })}"></i>`)}
      </span>
      ${showCount && count != null ? html`<span class="text-xs text-slate-500 ml-1">(${count})</span>` : ''}</app-star-rating>`;
  };
})();
