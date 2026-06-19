import { useEffect, useState } from 'react';

/*
 * Returns true when the viewport is at or below the mobile breakpoint (≤900px).
 * The mobile-first layout activates below this width; the desktop sidebar
 * layout stays for screens ≥901px.
 */
const QUERY = '(max-width: 900px)';

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    setIsMobile(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isMobile;
}
