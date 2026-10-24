import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Ensures that on any route or search param navigation,
 * the window and body are scrolled back to the top (top: 0),
 * preventing pages (like /service?tab=kids) from opening at the bottom/footer.
 */
export default function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    // Reset scroll to top immediately on navigation
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.body.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, search]);

  return null;
}
