'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * Smooth scroll berinersia untuk kontainer ber-overflow: wheel tidak langsung
 * melompat, tapi meluncur halus (lerp) ke target — rasa "premium" ala situs
 * modern. Ctrl+wheel sengaja dilewatkan (dipakai untuk zoom bagan), dan pada
 * prefers-reduced-motion perilaku scroll dibiarkan native.
 *
 * Mengembalikan ref berisi fungsi sync() — panggil saat scroll diubah manual
 * (mis. mulai drag-to-pan) supaya animasi tidak melawan posisi baru.
 */
export function useSmoothWheel(ref: RefObject<HTMLElement | null>) {
  const syncRef = useRef<() => void>(() => {});

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let targetX = el.scrollLeft;
    let targetY = el.scrollTop;
    let raf = 0;
    let running = false;

    const clampTargets = () => {
      targetX = Math.max(0, Math.min(targetX, el.scrollWidth - el.clientWidth));
      targetY = Math.max(0, Math.min(targetY, el.scrollHeight - el.clientHeight));
    };

    const step = () => {
      const dx = targetX - el.scrollLeft;
      const dy = targetY - el.scrollTop;
      el.scrollLeft += dx * 0.16;
      el.scrollTop += dy * 0.16;
      if (Math.abs(dx) > 0.6 || Math.abs(dy) > 0.6) {
        raf = requestAnimationFrame(step);
      } else {
        el.scrollLeft = targetX;
        el.scrollTop = targetY;
        running = false;
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // ctrl+wheel = zoom bagan, jangan diintersep
      e.preventDefault();
      // Saat tidak sedang meluncur, ambil posisi aktual dulu — posisi bisa
      // berubah di luar hook (drag-to-pan, scrollbar, scrollTo)
      if (!running) {
        targetX = el.scrollLeft;
        targetY = el.scrollTop;
      }
      const multiplier = e.deltaMode === 1 ? 16 : 1; // deltaMode line → piksel
      targetX += (e.shiftKey ? e.deltaY : e.deltaX) * multiplier;
      targetY += (e.shiftKey ? 0 : e.deltaY) * multiplier;
      clampTargets();
      if (!running) {
        running = true;
        raf = requestAnimationFrame(step);
      }
    };

    syncRef.current = () => {
      cancelAnimationFrame(raf);
      running = false;
      targetX = el.scrollLeft;
      targetY = el.scrollTop;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      cancelAnimationFrame(raf);
      syncRef.current = () => {};
    };
  }, [ref]);

  return syncRef;
}
