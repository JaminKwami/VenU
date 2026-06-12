import { useEffect, useRef } from 'react';

/*
 * Scroll reveal for elements carrying the global `.reveal` class.
 * IntersectionObserver adds `.in`; a safety timeout force-shows anything
 * still hidden after 1.5s so content can never be stuck invisible
 * (matches the handoff's initReveals contract).
 */
export function useReveal(deps = []) {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = root.classList?.contains('reveal')
      ? [root, ...root.querySelectorAll('.reveal')]
      : [...root.querySelectorAll('.reveal')];
    if (!els.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    els.forEach((el) => io.observe(el));

    const safety = setTimeout(() => {
      els.forEach((el) => el.classList.add('in'));
    }, 1500);

    return () => { io.disconnect(); clearTimeout(safety); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}
