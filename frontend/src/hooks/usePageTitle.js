import { useEffect } from 'react';

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · VenU` : 'VenU — Venue Booking';
    return () => { document.title = 'VenU — Venue Booking'; };
  }, [title]);
}
