/*
 * <app-star-rating> - port of src/app/shared/star-rating/star-rating.component.*
 */
(function () {
  'use strict';

  window.StarRating = function (rating, count = null, showCount = true, hostClass = '') {
    const value = rating ?? 0;
    const rounded = Math.round(value);
    return U.tpl('star-rating', [
      hostClass,
      value + ' out of 5 stars',
      U.each([1, 2, 3, 4, 5], (i) =>
        U.tpl('star-rating-1', [
          U.clsMore({
            'fa-solid': i <= rounded,
            'fa-regular': i > rounded,
            'fa-star': true,
            filled: i <= rounded,
            'text-amber-400': i <= rounded,
            'text-slate-300': i > rounded,
          }),
        ]),
      ),
      showCount && count != null ? U.tpl('star-rating-2', [count]) : '',
    ]);
  };
})();
