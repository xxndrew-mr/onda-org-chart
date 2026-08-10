'use client';

import { ReactLenis } from 'lenis/react';
import { useEffect, useState } from 'react';

/**
 * Smooth-scroll global (Lenis). Kontainer scroll internal (bagan, panel)
 * dikecualikan lewat atribut data-lenis-prevent di masing-masing elemen.
 * Saat prefers-reduced-motion, smoothing wheel dimatikan.
 */
export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    setReduceMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  return (
    <ReactLenis root options={{ duration: 1.1, smoothWheel: !reduceMotion }}>
      {children}
    </ReactLenis>
  );
}
