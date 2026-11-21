import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// A single-page app keeps the old scroll position when the route changes, so a page opened from
// the bottom of another page would start half way down. Go back to the top whenever the page
// (path) changes. A change of only the search text (?q=) or a #section link keeps its position.
export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
