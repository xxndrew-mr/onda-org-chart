'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Avatar from './Avatar';
import ChartView from './ChartView';
import DeptTree from './DeptTree';
import DetailPanel from './DetailPanel';
import OndaLogo from './OndaLogo';
import ScopePicker from './ScopePicker';
import SearchResults from './SearchResults';
import ThemeToggle from './ThemeToggle';
import { useReveal } from './useReveal';
import { familyColor } from '@/lib/colors';
import {
  allDeptIds,
  buildDeptChart,
  findNode,
  flattenDepartments,
  flattenPeople,
  idsFromLevel,
  idsUpToLevel,
  normalize,
  pathToNode,
} from '@/lib/tree-utils';
import type { DeptNode, OrgErrorResponse, OrgResponse, Person } from '@/lib/types';

type ViewMode = 'chart' | 'list';

/** Kunci localStorage untuk mengingat susunan buka/tutup bagan antar-kunjungan.
 *  Naikkan versi bila struktur node bagan berubah (simpanan lama diabaikan). */
const COLLAPSED_STORAGE_KEY = 'onda-org-chart:collapsed:v2';
type LoadState =
  | { status: 'loading' }
  | { status: 'error'; error: string; hint?: string; code?: number | string }
  | { status: 'ready'; data: OrgResponse };

/* ------------------------------------------------------------------ */

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function StatChip({ label, value }: { label: string; value: number | string }) {
  // Angka menghitung naik saat pertama tampil (dilewati bila reduced-motion)
  const [display, setDisplay] = useState<number | string>(typeof value === 'number' ? 0 : value);

  useEffect(() => {
    if (typeof value !== 'number') {
      setDisplay(value);
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-mono text-lg font-bold leading-none tabular-nums text-white">
        {display}
      </span>
      <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-white/60">
        {label}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function OrgExplorer({ orgName }: { orgName: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  const [view, setView] = useState<ViewMode>('chart');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  /** true = zoom otomatis menyesuaikan lebar layar (tanpa scroll horizontal) */
  const [fitMode, setFitMode] = useState(true);
  /** '' = bagan seluruh organisasi; selain itu = id departemen yang dibagankan */
  const [scopeId, setScopeId] = useState('');
  /** Orang yang kartunya diklik di bagan — profilnya tampil di banner */
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  /** Departemen yang kartunya diklik di bagan — infonya tampil di banner */
  const [bannerDeptId, setBannerDeptId] = useState<string | null>(null);
  /** Drawer menu mobile (presentasi saja) */
  const [menuOpen, setMenuOpen] = useState(false);

  const mastheadRef = useReveal<HTMLElement>();
  const mainRef = useReveal<HTMLElement>(120);

  const selectedIdRef = useRef('');
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  /* ---------------- data loading ---------------- */

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setState({ status: 'loading' });

    try {
      const res = await fetch(`/api/org${refresh ? '?refresh=1' : ''}`, { cache: 'no-store' });
      const json = (await res.json()) as OrgResponse | OrgErrorResponse;

      if (!json.ok) {
        setState({ status: 'error', error: json.error, hint: json.hint, code: json.code });
        return;
      }

      setState({ status: 'ready', data: json });
      setSelectedId((current) => current || json.root.id);
      const deptLevel = Math.max(2, json.deptLevel || 2);
      const nextExpanded = new Set(idsUpToLevel(json.root, deptLevel));

      // Susunan buka/tutup bagan diingat antar-kunjungan (localStorage).
      // Kalau belum ada simpanan: default ringkas — hanya root + departemen
      // level atas yang terlihat, semua cabang tertutup.
      let nextCollapsed: Set<string> | null = null;
      try {
        const saved = localStorage.getItem(COLLAPSED_STORAGE_KEY);
        if (saved) {
          const validIds = new Set(allDeptIds(json.root));
          nextCollapsed = new Set(
            (JSON.parse(saved) as string[]).filter((id) => validIds.has(id)),
          );
        }
      } catch {
        // Simpanan korup → pakai default
      }
      if (!nextCollapsed) {
        // Default ringkas dihitung dari pohon bagan (termasuk node orang),
        // supaya departemen yang hanya punya anggota pun ikut tertutup
        nextCollapsed = new Set(idsFromLevel(buildDeptChart(json.root), 1));
      }

      // Jalur node yang sedang dipilih tetap dibuka supaya seleksi tidak
      // "hilang" setelah sinkron ulang.
      const currentSelected = selectedIdRef.current;
      if (currentSelected) {
        for (const id of pathToNode(json.root, currentSelected)) {
          nextExpanded.add(id);
          nextCollapsed.delete(id);
        }
      } else {
        // Kunjungan awal: langsung buka bagan PT Onda Mega Integra 4 lapis
        // (dicari berdasarkan nama supaya tahan terhadap perubahan id di Lark)
        const target = flattenDepartments(json.root).find((c) =>
          /onda\s*mega\s*integra/i.test(c.name),
        );
        if (target) {
          const scopedTree = buildDeptChart(target);
          for (const id of allDeptIds(target)) nextCollapsed.delete(id);
          for (const id of idsFromLevel(scopedTree, 3)) nextCollapsed.add(id);
          setScopeId(target.id);
          setSelectedId(target.id);
        }
      }
      setExpanded(nextExpanded);
      setCollapsed(nextCollapsed);
    } catch (error) {
      setState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Gagal memuat data.',
        hint: 'Pastikan server Next.js berjalan dan endpoint /api/org bisa diakses.',
      });
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Simpan susunan buka/tutup setiap kali berubah — jadi tampilan yang
  // ditinggalkan user kembali sama saat web dibuka lagi
  useEffect(() => {
    if (state.status !== 'ready') return;
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(Array.from(collapsed)));
    } catch {
      // localStorage penuh/di-blok → abaikan, cuma kenyamanan
    }
  }, [collapsed, state.status]);

  /* ---------------- derived ---------------- */

  const root: DeptNode | null = state.status === 'ready' ? state.data.root : null;

  const allPeople = useMemo(() => (root ? flattenPeople(root) : []), [root]);
  const allDepartments = useMemo(() => (root ? flattenDepartments(root) : []), [root]);

  /** Departemen yang bisa dibagankan sendiri (di luar jalur governance) */
  const scopeOptions = useMemo(
    () => allDepartments.filter((d) => d.colorIndex !== undefined),
    [allDepartments],
  );

  /** Node departemen asli yang sedang dibagankan (untuk banner judul) */
  const scopedDept = useMemo(
    () => (root && scopeId ? findNode(root, scopeId) : null),
    [root, scopeId],
  );

  /** Departemen tempat orang yang sedang dipilih (untuk banner profil) */
  const selectedPersonDept = useMemo(
    () => (root && selectedPerson ? findNode(root, selectedPerson.departmentId) : null),
    [root, selectedPerson],
  );

  /** Departemen yang diklik di bagan (untuk banner info departemen) */
  const bannerDept = useMemo(
    () => (root && bannerDeptId ? findNode(root, bannerDeptId) : null),
    [root, bannerDeptId],
  );

  /**
   * Pohon yang dirender bagan: seluruh organisasi, atau satu departemen.
   * Keduanya lewat buildDeptChart supaya SETIAP departemen yang punya anggota
   * bisa diexpand untuk melihat kartu orang-orangnya.
   */
  const chartRoot = useMemo(() => {
    if (!root) return null;
    return buildDeptChart(scopedDept ?? root);
  }, [root, scopedDept]);

  const selectedNode = useMemo(
    () => (root ? findNode(root, selectedId) ?? root : null),
    [root, selectedId],
  );

  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length >= 2;

  const searchResults = useMemo(() => {
    if (!isSearching) return { people: [], departments: [] };
    const q = normalize(trimmedQuery);

    const people = allPeople
      .filter((p) =>
        [p.name, p.enName, p.jobTitle, p.email, p.employeeNo, p.deptName]
          .filter(Boolean)
          .some((field) => normalize(String(field)).includes(q)),
      )
      .slice(0, 120);

    const departments = allDepartments
      .filter((d) => normalize(d.name).includes(q) || (d.enName ? normalize(d.enName).includes(q) : false))
      .slice(0, 60);

    return { people, departments };
  }, [isSearching, trimmedQuery, allPeople, allDepartments]);

  /* ---------------- handlers ---------------- */

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedId(id);
      setQuery('');
      if (root) {
        const chain = pathToNode(root, id);
        setExpanded((prev) => new Set([...Array.from(prev), ...chain]));
        setCollapsed((prev) => {
          const next = new Set(prev);
          chain.forEach((nodeId) => next.delete(nodeId));
          return next;
        });
      }
      if (view === 'chart') setView('list');
    },
    [root, view],
  );

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleChartSelect = useCallback(
    (id: string) => {
      setSelectedId(id);
      setSelectedPerson(null);
      setBannerDeptId(id);
      if (root) {
        const chain = pathToNode(root, id);
        setExpanded((prev) => new Set([...Array.from(prev), ...chain]));
      }
    },
    [root],
  );

  const handleSelectPerson = useCallback((person: Person) => {
    setSelectedPerson(person);
    setBannerDeptId(null);
  }, []);

  const handleZoomStep = useCallback((delta: number) => {
    setFitMode(false);
    setZoom((z) => Math.max(0.3, Math.min(1.6, Math.round((z + delta) * 10) / 10)));
  }, []);

  const handleScopeChange = useCallback(
    (id: string) => {
      setScopeId(id);
      setSelectedPerson(null);
      setBannerDeptId(null);
      if (!root) return;
      if (id) {
        // Bagan departemen dibuka default 4 lapis: level 0-2 terbuka,
        // level 3 terlihat tapi tertutup (bisa diexpand manual)
        const dept = findNode(root, id);
        if (dept) {
          const scopedTree = buildDeptChart(dept);
          setCollapsed((prev) => {
            const next = new Set(prev);
            for (const deptId of allDeptIds(dept)) next.delete(deptId);
            for (const collapsedId of idsFromLevel(scopedTree, 3)) next.add(collapsedId);
            return next;
          });
          setSelectedId(id);
        }
      } else {
        // Kembali ke "Seluruh organisasi" selalu mulai dari tampilan ringkas
        setCollapsed(new Set(idsFromLevel(buildDeptChart(root), 1)));
      }
    },
    [root],
  );

  /* ---------------- render ---------------- */

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <div className="flex items-center gap-3 text-muted">
          <Spinner />
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em]">
            Menarik data dari Lark…
          </span>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper p-6">
        <div className="panel w-full max-w-lg border-l-[3px] border-l-danger p-6">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-danger">
            Error — koneksi Lark
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold leading-tight tracking-[-0.02em] text-ink">
            Gagal memuat struktur organisasi
          </h1>
          <p className="mt-3 text-sm text-ink-2">{state.error}</p>
          {state.hint && (
            <p className="hairline mt-4 pt-3 font-mono text-[11px] leading-relaxed text-ink-2">
              {state.hint}
            </p>
          )}
          {state.code !== undefined && (
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              Kode: {String(state.code)}
            </p>
          )}
          <div className="mt-6 flex gap-2">
            <button type="button" onClick={() => void load()} className="pill pill-primary">
              Coba lagi <span className="arrow">↗</span>
            </button>
            <a href="/api/health" target="_blank" rel="noreferrer" className="pill">
              Cek koneksi
            </a>
          </div>
        </div>
      </div>
    );
  }

  const { data } = state;

  /* Kontrol toolbar — dipakai di baris desktop DAN drawer mobile */
  const viewTabs = (
    <div className="flex shrink-0 rounded-full border border-line p-0.5">
      {(['chart', 'list'] as ViewMode[]).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => {
            setView(mode);
            setQuery('');
          }}
          className={`rounded-full px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] transition ${
            view === mode && !isSearching ? 'bg-blue text-paper' : 'text-ink-2 hover:bg-mist'
          }`}
        >
          {mode === 'chart' ? 'Bagan' : 'Daftar'}
        </button>
      ))}
    </div>
  );

  const chartControls = view === 'chart' && !isSearching && (
    <div className="flex flex-wrap items-center gap-1.5">
      <ScopePicker root={data.root} value={scopeId} onChange={handleScopeChange} />
      <button
        type="button"
        onClick={() => {
          setFitMode(false);
          setZoom((z) => Math.max(0.3, Math.round((z - 0.1) * 10) / 10));
        }}
        className="pill h-9 w-9 p-0"
        aria-label="Perkecil"
      >
        −
      </button>
      <span className="w-11 text-center font-mono text-[11px] font-bold tabular-nums text-muted">
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        onClick={() => {
          setFitMode(false);
          setZoom((z) => Math.min(1.6, Math.round((z + 0.1) * 10) / 10));
        }}
        className="pill h-9 w-9 p-0"
        aria-label="Perbesar"
      >
        +
      </button>
      <button
        type="button"
        onClick={() => setFitMode(true)}
        title="Sesuaikan bagan dengan lebar layar"
        className={`pill h-9 ${fitMode ? 'pill-primary' : ''}`}
      >
        Pas layar
      </button>
      <button
        type="button"
        onClick={() => chartRoot && setCollapsed(new Set(idsFromLevel(chartRoot, 1)))}
        className="pill h-9"
      >
        Tutup
      </button>
      <button type="button" onClick={() => setCollapsed(new Set())} className="pill h-9">
        Buka
      </button>
    </div>
  );

  const listControls = view === 'list' && !isSearching && (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => root && setExpanded(new Set(allDeptIds(root)))}
        className="pill h-9"
      >
        Buka semua
      </button>
      <button
        type="button"
        onClick={() => root && setExpanded(new Set([root.id]))}
        className="pill h-9"
      >
        Tutup semua
      </button>
    </div>
  );

  const actions = (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={() => window.print()} className="pill h-9">
        Cetak
      </button>
      <button
        type="button"
        onClick={() => void load(true)}
        disabled={refreshing}
        className="pill pill-primary h-9 disabled:opacity-60"
      >
        {refreshing && <Spinner />}
        {refreshing ? 'Menyinkron…' : 'Sinkron ulang'}
        {!refreshing && <span className="arrow">↗</span>}
      </button>
    </div>
  );

  return (
    <div className="print-h-auto flex h-screen flex-col bg-paper">
      {/* ---------- Masthead brand bar (biru Onda) ---------- */}
      <header ref={mastheadRef} className="no-print bg-[#005DA6] px-5 py-3">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-x-8 gap-y-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-token border border-white/20 bg-white p-1">
              <OndaLogo className="h-full w-full" />
            </div>
            <h1 className="truncate font-display text-2xl font-bold leading-none tracking-[-0.02em] text-white">
              {data.root.name || orgName}
            </h1>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-white/60 lg:inline">
              {new Date(data.generatedAt).toLocaleString('id-ID', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
              {data.cached && ' · cache'}
            </span>
          </div>

          <div className="flex items-center gap-6">
            <StatChip label="Departemen" value={data.stats.totalDepartments} />
            <StatChip label="Karyawan" value={data.stats.totalPeople} />
            <StatChip label="Level" value={data.stats.maxDepth} />
          </div>
        </div>
      </header>

      {/* ---------- Navbar hairline ---------- */}
      <div className="no-print sticky top-0 z-40 border-b border-line bg-paper">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2.5 px-5 py-2.5">
          <div className="relative min-w-[180px] flex-1">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama, jabatan, email, atau departemen…"
              className="field h-10 pl-10"
            />
            <svg
              viewBox="0 0 20 20"
              className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-muted"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden
            >
              <circle cx="9" cy="9" r="5.5" />
              <path d="m13.5 13.5 3.5 3.5" strokeLinecap="round" />
            </svg>
          </div>

          {viewTabs}

          {/* Desktop: kontrol inline */}
          <div className="hidden flex-wrap items-center gap-2.5 md:flex">
            <span aria-hidden className="hidden h-6 w-px bg-line lg:block" />
            {chartControls}
            {listControls}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <div className="hidden items-center gap-1.5 md:flex">
              <span aria-hidden className="mr-1 hidden h-6 w-px bg-line lg:block" />
              {actions}
            </div>
            <ThemeToggle />
            {/* Mobile: hamburger yang morph jadi X */}
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'}
              className="pill h-9 w-9 p-0 md:hidden"
            >
              <span className="relative block h-[11px] w-4" aria-hidden>
                <span
                  className={`absolute left-0 top-0 block h-px w-full bg-current transition-transform duration-300 ${
                    menuOpen ? 'translate-y-[5px] rotate-45' : ''
                  }`}
                />
                <span
                  className={`absolute bottom-0 left-0 block h-px w-full bg-current transition-transform duration-300 ${
                    menuOpen ? '-translate-y-[5px] -rotate-45' : ''
                  }`}
                />
              </span>
            </button>
          </div>
        </div>

        {/* Drawer mobile: grid-rows 0fr -> 1fr, inert saat tertutup */}
        <div
          className="grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] md:hidden"
          style={{ gridTemplateRows: menuOpen ? '1fr' : '0fr' }}
        >
          <div
            inert={!menuOpen}
            className={`overflow-hidden transition-opacity duration-300 ${
              menuOpen ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div className="flex flex-col items-start gap-3 border-t border-line px-5 py-4">
              {chartControls}
              {listControls}
              {actions}
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Body ---------- */}
      <main ref={mainRef} className="mx-auto min-h-0 w-full max-w-[1600px] flex-1 p-5">
        <div key={isSearching ? 'search' : view} className="anim-fade h-full">
        {isSearching ? (
          <div className="h-full">
            <SearchResults
              query={trimmedQuery}
              people={searchResults.people}
              departments={searchResults.departments}
              onSelect={handleSelect}
            />
          </div>
        ) : view === 'chart' ? (
          <div className="print-h-auto flex h-full flex-col gap-3">
            {selectedPerson && (
              <div
                key={`${selectedPerson.id}:${selectedPerson.departmentId}`}
                className={`anim-fade panel flex flex-wrap items-center gap-x-4 gap-y-2 border-l-[3px] px-4 py-2.5 ${
                  familyColor(selectedPersonDept?.colorIndex)?.bar ?? 'border-l-blue'
                }`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={selectedPerson.name} src={selectedPerson.avatar} size={38} />
                  <div className="min-w-0">
                    {/* Path lengkap terlalu panjang untuk banner — cukup entitas
                        induknya; jalur penuh tersedia sebagai tooltip */}
                    <p
                      className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted"
                      title={selectedPersonDept?.path.slice(1).join(' / ')}
                    >
                      Profil Karyawan
                      {selectedPersonDept && selectedPersonDept.path.length > 1 && (
                        <> · {selectedPersonDept.path[1]}</>
                      )}
                    </p>
                    <div className="flex min-w-0 items-baseline gap-2">
                      <h2 className="truncate font-display text-base font-bold leading-tight tracking-[-0.02em] text-ink">
                        {selectedPerson.name}
                      </h2>
                      {selectedPerson.isLeader && <span className="badge badge-blue">Head</span>}
                      {selectedPerson.enName &&
                        selectedPerson.enName.trim().toLowerCase() !==
                          selectedPerson.name.trim().toLowerCase() && (
                          <span className="hidden truncate text-xs text-muted sm:inline">
                            ({selectedPerson.enName})
                          </span>
                        )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  {selectedPerson.jobTitle && (
                    <span className="badge max-w-[200px] truncate">{selectedPerson.jobTitle}</span>
                  )}
                  {selectedPersonDept && (
                    <span
                      className="badge max-w-[220px] truncate"
                      title={selectedPersonDept.path.slice(1).join(' / ')}
                    >
                      {selectedPersonDept.name}
                    </span>
                  )}
                  {selectedPerson.email && (
                    <a
                      href={`mailto:${selectedPerson.email}`}
                      className="badge badge-blue max-w-[220px] truncate normal-case hover:underline"
                    >
                      {selectedPerson.email}
                    </a>
                  )}
                  {selectedPerson.employeeNo && (
                    <span className="badge">NIK {selectedPerson.employeeNo}</span>
                  )}
                  {selectedPerson.city && <span className="badge">{selectedPerson.city}</span>}
                  <button
                    type="button"
                    onClick={() => setSelectedPerson(null)}
                    aria-label="Tutup profil"
                    className="pill no-print ml-1 h-7 w-7 p-0"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* Banner info departemen — muncul saat kartu departemen diklik */}
            {!selectedPerson && bannerDept && bannerDept.id !== scopeId && (
              <div
                key={bannerDept.id}
                className={`anim-fade panel flex flex-wrap items-center gap-x-5 gap-y-2 border-l-[3px] px-4 py-2.5 ${
                  familyColor(bannerDept.colorIndex)?.bar ?? 'border-l-blue'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted"
                    title={bannerDept.path.slice(1).join(' / ')}
                  >
                    Departemen
                    {bannerDept.path.length > 2 && <> · {bannerDept.path.slice(1, -1).join(' / ')}</>}
                  </p>
                  <h2 className="truncate font-display text-base font-bold leading-tight tracking-[-0.02em] text-ink">
                    {bannerDept.name}
                  </h2>
                </div>

                {bannerDept.leader && (
                  <div className="flex items-center gap-2">
                    <Avatar
                      name={bannerDept.leader.name}
                      src={bannerDept.leader.avatar}
                      size={34}
                    />
                    <div className="min-w-0">
                      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-muted">
                        Kepala
                      </p>
                      <p className="truncate text-sm font-medium text-ink">
                        {bannerDept.leader.name}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <span className="badge badge-blue">{bannerDept.totalHeadcount} orang</span>
                  {bannerDept.totalSubDepartments > 0 && (
                    <span className="badge">{bannerDept.totalSubDepartments} sub-departemen</span>
                  )}
                  {bannerDept.leader?.email && (
                    <a
                      href={`mailto:${bannerDept.leader.email}`}
                      className="badge max-w-[200px] truncate normal-case hover:underline"
                    >
                      {bannerDept.leader.email}
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => handleScopeChange(bannerDept.id)}
                    className="pill no-print h-8"
                  >
                    Lihat bagan <span className="arrow">↗</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBannerDeptId(null)}
                    aria-label="Tutup info departemen"
                    className="pill no-print h-7 w-7 p-0"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {!selectedPerson && !(bannerDept && bannerDept.id !== scopeId) && scopedDept && (
              <div
                className={`panel flex flex-wrap items-center gap-x-6 gap-y-2 border-l-[3px] px-5 py-3 ${
                  familyColor(scopedDept.colorIndex)?.bar ?? 'border-l-blue'
                }`}
              >
                <div className="min-w-0">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                    <span className="text-blue">
                      {String(
                        Math.max(1, scopeOptions.findIndex((d) => d.id === scopedDept.id) + 1),
                      ).padStart(2, '0')}
                    </span>{' '}
                    — Struktur Organisasi · {data.root.name} ·{' '}
                    {new Date(data.generatedAt).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                  </p>
                  <h2 className="truncate font-display text-xl font-bold tracking-[-0.02em] text-ink">
                    {scopedDept.name}
                  </h2>
                </div>

                {scopedDept.leader && (
                  <div className="flex items-center gap-2">
                    <Avatar
                      name={scopedDept.leader.name}
                      src={scopedDept.leader.avatar}
                      size={34}
                    />
                    <div>
                      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                        Kepala Departemen
                      </p>
                      <p className="text-sm font-medium text-ink">{scopedDept.leader.name}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1.5">
                  <span className="badge badge-blue tabular-nums">
                    {scopedDept.totalHeadcount} orang
                  </span>
                  {scopedDept.totalSubDepartments > 0 && (
                    <span className="badge tabular-nums">
                      {scopedDept.totalSubDepartments} sub-departemen
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleScopeChange('')}
                  className="pill no-print ml-auto h-9"
                >
                  ← Seluruh organisasi
                </button>
              </div>
            )}

            <div className="min-h-0 flex-1">
              <ChartView
                root={chartRoot ?? data.root}
                collapsed={collapsed}
                onToggle={toggleCollapse}
                onSelect={handleChartSelect}
                onSelectPerson={handleSelectPerson}
                selectedId={selectedId}
                selectedPersonKey={
                  selectedPerson
                    ? `${selectedPerson.id}:${selectedPerson.departmentId}`
                    : undefined
                }
                zoom={zoom}
                fitMode={fitMode}
                onEffectiveZoom={setZoom}
                onZoomStep={handleZoomStep}
                hideRoot={!scopeId}
              />
            </div>
          </div>
        ) : (
          <div className="print-h-auto grid h-full grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
            <aside
              data-lenis-prevent
              className="thin-scroll no-print overflow-auto rounded-2xl border border-line bg-paper p-3"
            >
              <DeptTree
                node={data.root}
                selectedId={selectedId}
                expanded={expanded}
                onSelect={handleSelect}
                onToggle={toggleExpand}
              />
            </aside>

            {selectedNode && <DetailPanel node={selectedNode} onSelect={handleSelect} />}
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
