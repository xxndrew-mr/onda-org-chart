'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import DeptTree from './DeptTree';
import { findNode, idsUpToLevel, pathToNode } from '@/lib/tree-utils';
import type { DeptNode } from '@/lib/types';

interface ScopePickerProps {
  root: DeptNode;
  /** '' = seluruh organisasi; selain itu id departemen */
  value: string;
  onChange: (id: string) => void;
}

/**
 * Pemilih cakupan bagan berbentuk pohon organisasi (breakdown per organisasi),
 * bukan daftar datar: tiap cabang bisa dibuka/ditutup, lengkap dengan titik
 * warna departemen dan jumlah orang. Menutup otomatis saat klik di luar / Esc.
 */
export default function ScopePicker({ root, value, onChange }: ScopePickerProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  // Setiap kali dibuka: tampilkan level atas + jalur menuju cakupan aktif
  useEffect(() => {
    if (!open) return;
    const initial = new Set(idsUpToLevel(root, 2));
    if (value) for (const id of pathToNode(root, value)) initial.add(id);
    setExpanded(initial);
  }, [open, root, value]);

  // Tutup saat klik di luar atau tekan Esc
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleSelect = useCallback(
    (id: string) => {
      onChange(id === root.id ? '' : id);
      setOpen(false);
    },
    [onChange, root.id],
  );

  const handleToggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const label = value ? (findNode(root, value)?.name ?? 'Seluruh organisasi') : 'Seluruh organisasi';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="tree"
        title="Pilih cakupan bagan"
        className="field flex h-9 w-auto min-w-[190px] max-w-[240px] items-center justify-between gap-2 py-0 text-[13px]"
      >
        <span className="truncate">{label}</span>
        <svg
          viewBox="0 0 12 12"
          className={`h-3 w-3 shrink-0 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <path d="m2.5 4.5 3.5 3.5 3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          data-lenis-prevent
          className="panel thin-scroll absolute left-0 top-full z-50 mt-2 max-h-[380px] w-[320px] overflow-auto p-2 max-md:static max-md:mt-2 max-md:max-h-[300px] max-md:w-full"
        >
          <DeptTree
            node={root}
            selectedId={value || root.id}
            expanded={expanded}
            onSelect={handleSelect}
            onToggle={handleToggle}
          />
        </div>
      )}
    </div>
  );
}
