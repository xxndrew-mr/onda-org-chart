'use client';

import { useEffect, useRef } from 'react';

/**
 * Reveal-on-scroll: elemen fade + naik saat masuk viewport.
 * Pakai: const ref = useReveal<HTMLDivElement>(120); lalu <div ref={ref}>.
 * Nonaktif otomatis saat prefers-reduced-motion.
 */
export function useReveal<T extends HTMLElement>(staggerMs = 0) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('reveal-in');
      return;
    }

    el.classList.add('reveal');
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            window.setTimeout(() => el.classList.add('reveal-in'), staggerMs);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.14 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [staggerMs]);

  return ref;
}
