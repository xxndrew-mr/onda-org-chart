'use client';

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import Avatar from './Avatar';
import { useSmoothWheel } from './useSmoothWheel';
import { familyColor } from '@/lib/colors';
import type { DeptNode, Person } from '@/lib/types';

/** Anak lebih banyak dari ini → susun dalam kolom, bukan satu baris melebar */
const COLUMN_THRESHOLD = 6;
/** Perkiraan jumlah kartu per kolom saat menghitung jumlah kolom */
const COLUMN_ITEM_TARGET = 6;
const MAX_COLUMNS = 5;

/**
 * - `tree`: pohon klasik atas-bawah (root, Commissioner, Direksi, baris kecil)
 * - `list`: daftar gantung di dalam kolom — dipakai saat anak sangat banyak
 */
type Variant = 'tree' | 'list';

interface ChartNodeProps {
  node: DeptNode;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  /** Dipanggil saat kartu orang diklik (profilnya tampil di banner) */
  onSelectPerson: (person: Person) => void;
  selectedId: string;
  /** `${person.id}:${departmentId}` orang yang sedang dipilih (untuk ring) */
  selectedPersonKey?: string;
  variant: Variant;
  depth?: number;
}

/**
 * Bobot subtree berdasar jumlah SELURUH kartu (mengabaikan state collapse).
 * Sengaja stabil: kalau bobot ikut state collapse, batas kolom bergeser tiap
 * kali toggle diklik dan kartu (beserta tombolnya) lompat ke kolom lain.
 */
function subtreeWeight(node: DeptNode): number {
  return 1 + node.children.reduce((sum, c) => sum + subtreeWeight(c), 0);
}

/**
 * Bagi anak-anak menjadi beberapa kolom berurutan dengan tinggi seimbang.
 * Urutan alfabetis dipertahankan: atas→bawah lalu kolom berikutnya.
 */
function splitIntoColumns(children: DeptNode[]): DeptNode[][] {
  const columnCount = Math.min(
    MAX_COLUMNS,
    Math.max(2, Math.ceil(children.length / COLUMN_ITEM_TARGET)),
  );
  const weights = children.map((c) => subtreeWeight(c));
  let remainingWeight = weights.reduce((a, b) => a + b, 0);

  const columns: DeptNode[][] = [];
  let current: DeptNode[] = [];
  let acc = 0;

  for (let i = 0; i < children.length; i++) {
    current.push(children[i]);
    acc += weights[i];
    remainingWeight -= weights[i];
    const remainingItems = children.length - i - 1;
    const remainingColumns = columnCount - columns.length - 1;
    // Target dihitung ulang dari sisa bobot supaya kolom terakhir tidak kempis
    const target = (acc + remainingWeight) / (remainingColumns + 1);
    if (columns.length < columnCount - 1 && acc >= target && remainingItems >= remainingColumns) {
      columns.push(current);
      current = [];
      acc = 0;
    }
  }
  if (current.length > 0) columns.push(current);
  return columns;
}

function ChartBox({
  node,
  collapsed,
  onToggle,
  onSelect,
  onSelectPerson,
  selectedId,
  selectedPersonKey,
  variant,
  depth = 0,
}: ChartNodeProps) {
  const isCollapsed = collapsed.has(node.id);
  const hasChildren = node.children.length > 0;

  const fam = familyColor(node.colorIndex);
  // Tanpa warna keluarga = jalur governance (root / Commissioner / Direksi)
  const solid = !fam;
  const person = node.kind === 'person' ? node.members[0] : undefined;
  const isSelected = person
    ? selectedPersonKey === `${person.id}:${person.departmentId}`
    : selectedId === node.id;
  // Pada bagan per departemen, anak bisa berupa kartu orang — jangan ikut
  // dihitung sebagai "sub" departemen
  const subCount = node.children.filter((c) => c.kind !== 'person').length;

  const width =
    variant === 'list' ? (depth === 0 ? 'w-52' : depth === 1 ? 'w-[176px]' : 'w-[144px]') : 'w-52';
  const skin = fam
    ? `border-slate-200 border-l-4 ${fam.bar} bg-white`
    : person
      ? 'border-slate-200 border-l-4 border-l-slate-400 bg-white'
      : node.level === 0
        ? 'border-brand-700 bg-brand-700'
        : 'border-brand-600 bg-brand-600';

  const card = (
    <button
      type="button"
      onClick={() => (person ? onSelectPerson(person) : onSelect(node.id))}
      className={`${width} rounded-xl border ${skin} ${person ? 'px-3 py-2' : 'px-3 py-2.5'} text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg ${
        isSelected ? 'ring-2 ring-brand-400 ring-offset-2' : ''
      }`}
    >
      {person ? (
        <div className="flex items-center gap-2">
          <Avatar name={person.name} src={person.avatar} size={26} />
          <span className="min-w-0">
            <span
              className="block truncate text-[12px] font-medium text-slate-800"
              title={person.name}
            >
              {person.name}
            </span>
            {person.jobTitle && (
              <span className="block truncate text-[10px] text-slate-500">{person.jobTitle}</span>
            )}
          </span>
        </div>
      ) : (
        <>
          <p
            className={`truncate text-sm font-semibold ${fam ? fam.text : 'text-white'}`}
            title={node.name}
          >
            {node.name}
          </p>

          {node.leader ? (
            <div className="mt-1.5 flex items-center gap-1.5">
              <Avatar name={node.leader.name} src={node.leader.avatar} size={22} />
              <span className={`truncate text-[11px] ${solid ? 'text-brand-50' : 'text-slate-600'}`}>
                {node.leader.name}
              </span>
            </div>
          ) : (
            <p className={`mt-1.5 text-[11px] italic ${solid ? 'text-brand-100' : 'text-slate-400'}`}>
              Belum ada head
            </p>
          )}

          <div className="mt-2 flex items-center gap-1.5 text-[10px]">
            <span
              className={`rounded-full px-1.5 py-0.5 font-semibold tabular-nums ${
                solid ? 'bg-white/15 text-white' : fam ? fam.chip : 'bg-slate-100 text-slate-600'
              }`}
            >
              {node.totalHeadcount} orang
            </span>
            {subCount > 0 && (
              <span className={solid ? 'text-brand-100' : 'text-slate-500'}>· {subCount} sub</span>
            )}
          </div>
        </>
      )}
    </button>
  );

  const toggle = hasChildren && (
    <button
      type="button"
      onClick={() => onToggle(node.id)}
      className={`${
        variant === 'tree' ? '-mt-2' : 'absolute -right-2 top-1/2 -translate-y-1/2'
      } z-10 rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 shadow-sm transition hover:border-brand-400 hover:text-brand-600`}
      aria-expanded={!isCollapsed}
    >
      {isCollapsed ? `+ ${node.children.length}` : '−'}
    </button>
  );

  if (variant === 'list') {
    return (
      <li>
        <div className="relative inline-block">
          {card}
          {toggle}
        </div>

        {hasChildren && !isCollapsed && (
          <ul className="hang-list hang-sub">
            {node.children.map((child) => (
              <ChartBox
                key={child.id}
                node={child}
                collapsed={collapsed}
                onToggle={onToggle}
                onSelect={onSelect}
                onSelectPerson={onSelectPerson}
                selectedId={selectedId}
                selectedPersonKey={selectedPersonKey}
                variant="list"
                depth={depth + 1}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  // Susun kolom bila: cabang departemen banyak, ATAU isinya daftar orang
  // (baris horizontal boros tempat). Beberapa kartu orang di samping cabang
  // departemen yang sedikit tetap boleh sebaris.
  const personChildCount = node.children.length - subCount;
  const useColumns =
    hasChildren &&
    !isCollapsed &&
    (subCount > COLUMN_THRESHOLD ||
      (subCount === 0 && personChildCount > 2) ||
      (personChildCount > 3 && node.children.length > COLUMN_THRESHOLD));

  return (
    <li>
      <div className="inline-flex flex-col items-center">
        {card}
        {toggle}
      </div>

      {hasChildren &&
        !isCollapsed &&
        (useColumns ? (
          <div className="dept-columns">
            <div className="dept-cols-inner">
              {splitIntoColumns(node.children).map((column) => (
                <ul key={column[0].id} className="hang-list dept-col">
                  {column.map((child) => (
                    <ChartBox
                      key={child.id}
                      node={child}
                      collapsed={collapsed}
                      onToggle={onToggle}
                      onSelect={onSelect}
                      onSelectPerson={onSelectPerson}
                      selectedId={selectedId}
                      selectedPersonKey={selectedPersonKey}
                      variant="list"
                      depth={0}
                    />
                  ))}
                </ul>
              ))}
            </div>
          </div>
        ) : (
          <ul className="tree-row">
            {node.children.map((child) => (
              <ChartBox
                key={child.id}
                node={child}
                collapsed={collapsed}
                onToggle={onToggle}
                onSelect={onSelect}
                onSelectPerson={onSelectPerson}
                selectedId={selectedId}
                selectedPersonKey={selectedPersonKey}
                variant="tree"
              />
            ))}
          </ul>
        ))}
    </li>
  );
}

interface ChartViewProps {
  root: DeptNode;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onSelectPerson: (person: Person) => void;
  selectedId: string;
  selectedPersonKey?: string;
  zoom: number;
  /** true = zoom otomatis dihitung supaya bagan pas selebar kontainer */
  fitMode: boolean;
  /** Lapor zoom efektif hasil auto-fit (untuk indikator % di toolbar) */
  onEffectiveZoom: (zoom: number) => void;
  /** Dipanggil saat Ctrl+scroll di kanvas: +0.1 (zoom in) / −0.1 (zoom out) */
  onZoomStep: (delta: number) => void;
  /** true = kartu root disembunyikan; anak-anaknya jadi baris teratas */
  hideRoot?: boolean;
}

/** Lebar cetak yang tersedia: A4 landscape dengan margin 10mm ≈ 1040px CSS */
const PRINT_WIDTH = 1040;

export default function ChartView({
  root,
  collapsed,
  onToggle,
  onSelect,
  onSelectPerson,
  selectedId,
  selectedPersonKey,
  zoom,
  fitMode,
  onEffectiveZoom,
  onZoomStep,
  hideRoot = false,
}: ChartViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const syncSmoothScroll = useSmoothWheel(containerRef);

  // Ctrl+scroll = zoom bagan (menggantikan zoom halaman browser)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      onZoomStep(e.deltaY < 0 ? 0.1 : -0.1);
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [onZoomStep]);

  /** Lebar alami bagan pada zoom 100% (min-width dilepas sementara) */
  const measureNaturalWidth = useCallback(() => {
    const el = treeRef.current;
    if (!el) return 0;
    el.style.setProperty('zoom', '1');
    el.style.minWidth = '0';
    const natural = el.scrollWidth;
    el.style.minWidth = '';
    return natural;
  }, []);

  const applyZoom = useCallback(() => {
    const container = containerRef.current;
    const el = treeRef.current;
    if (!container || !el) return;

    if (!fitMode) {
      el.style.setProperty('zoom', String(zoom));
      return;
    }

    const natural = measureNaturalWidth();
    const style = getComputedStyle(container);
    const avail =
      container.clientWidth -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight) -
      8; // sisa ruang kecil supaya pembulatan zoom tidak memunculkan scrollbar
    // Bagan kecil boleh diperbesar (maks 150%) supaya kanvas tidak terasa kosong
    const fit =
      natural > 0 ? Math.max(0.3, Math.min(1.5, Math.floor((avail / natural) * 100) / 100)) : 1;
    el.style.setProperty('zoom', String(fit));
    onEffectiveZoom(fit);
  }, [fitMode, zoom, measureNaturalWidth, onEffectiveZoom]);

  // Terapkan ulang saat data/collapse berubah, dan saat kontainer berubah ukuran
  useLayoutEffect(() => {
    applyZoom();
  }, [applyZoom, root, collapsed]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => applyZoom());
    observer.observe(container);
    return () => observer.disconnect();
  }, [applyZoom]);

  // Saat cetak: abaikan zoom layar dan kecilkan bagan supaya muat lebar kertas
  useEffect(() => {
    const handleBefore = () => {
      const el = treeRef.current;
      if (!el) return;
      const natural = measureNaturalWidth();
      const fit = natural > 0 ? Math.min(1, PRINT_WIDTH / natural) : 1;
      el.style.setProperty('zoom', String(fit));
    };
    const handleAfter = () => applyZoom();
    window.addEventListener('beforeprint', handleBefore);
    window.addEventListener('afterprint', handleAfter);
    return () => {
      window.removeEventListener('beforeprint', handleBefore);
      window.removeEventListener('afterprint', handleAfter);
    };
  }, [applyZoom, measureNaturalWidth]);

  // Geser bagan dengan drag di area kosong (kartu/tombol tetap bisa diklik)
  const drag = useRef({ active: false, x: 0, y: 0, left: 0, top: 0 });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, a, select')) return;
    const container = containerRef.current;
    if (!container) return;
    syncSmoothScroll.current();
    drag.current = {
      active: true,
      x: e.clientX,
      y: e.clientY,
      left: container.scrollLeft,
      top: container.scrollTop,
    };
    container.setPointerCapture(e.pointerId);
    container.style.cursor = 'grabbing';
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return;
    const container = containerRef.current;
    if (!container) return;
    container.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
    container.scrollTop = drag.current.top - (e.clientY - drag.current.y);
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return;
    drag.current.active = false;
    const container = containerRef.current;
    if (container) {
      container.releasePointerCapture(e.pointerId);
      container.style.cursor = '';
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      className="thin-scroll print-full chart-canvas flex h-full cursor-grab flex-col overflow-auto rounded-2xl border border-slate-200 p-6"
    >
      {/* CSS zoom (bukan transform) supaya layout & centering ikut terskala.
          mx-auto/my-auto (bukan self-center): auto-margin menengahkan konten
          bila muat, tapi jatuh ke tepi kiri bila konten lebih lebar dari
          kontainer — sehingga seluruh bagan tetap terjangkau scroll. Auto
          margin juga mencegah stretch, jadi lebar alami tetap terukur. */}
      <div ref={treeRef} className="chart-tree mx-auto my-auto inline-block min-w-full">
        <ul className="tree-row tree-row--root">
          {hideRoot ? (
            root.children.map((child) => (
              <ChartBox
                key={child.id}
                node={child}
                collapsed={collapsed}
                onToggle={onToggle}
                onSelect={onSelect}
                onSelectPerson={onSelectPerson}
                selectedId={selectedId}
                selectedPersonKey={selectedPersonKey}
                variant="tree"
              />
            ))
          ) : (
            <ChartBox
              node={root}
              collapsed={collapsed}
              onToggle={onToggle}
              onSelect={onSelect}
              onSelectPerson={onSelectPerson}
              selectedId={selectedId}
              selectedPersonKey={selectedPersonKey}
              variant="tree"
            />
          )}
        </ul>
      </div>
    </div>
  );
}
