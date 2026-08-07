'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Avatar from './Avatar';
import ChartView from './ChartView';
import DeptTree from './DeptTree';
import DetailPanel from './DetailPanel';
import HeroBackground from './HeroBackground';
import SearchResults from './SearchResults';
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
import type { DeptNode, OrgErrorResponse, OrgResponse } from '@/lib/types';

type ViewMode = 'chart' | 'list';
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
    <div className="rounded-lg bg-white/10 px-3 py-1.5 backdrop-blur-sm">
      <span className="text-sm font-semibold tabular-nums text-white">{display}</span>
      <span className="ml-1.5 text-[11px] text-brand-100">{label}</span>
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
      // Buka jalur governance sampai departemen inti; sub-departemen mulai tertutup.
      // Jalur node yang sedang dipilih tetap dibuka supaya seleksi tidak "hilang"
      // setelah sinkron ulang.
      const deptLevel = Math.max(2, json.deptLevel || 2);
      const nextExpanded = new Set(idsUpToLevel(json.root, deptLevel));
      const nextCollapsed = new Set(idsFromLevel(json.root, deptLevel));
      const currentSelected = selectedIdRef.current;
      if (currentSelected) {
        for (const id of pathToNode(json.root, currentSelected)) {
          nextExpanded.add(id);
          nextCollapsed.delete(id);
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

  /* ---------------- derived ---------------- */

  const root: DeptNode | null = state.status === 'ready' ? state.data.root : null;
  const deptLevel = state.status === 'ready' ? Math.max(2, state.data.deptLevel || 2) : 2;

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

  /** Pohon yang dirender bagan: seluruh organisasi, atau satu departemen */
  const chartRoot = useMemo(() => {
    if (!root) return null;
    return scopedDept ? buildDeptChart(scopedDept) : root;
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
      if (root) {
        const chain = pathToNode(root, id);
        setExpanded((prev) => new Set([...Array.from(prev), ...chain]));
      }
    },
    [root],
  );

  const handleZoomStep = useCallback((delta: number) => {
    setFitMode(false);
    setZoom((z) => Math.max(0.3, Math.min(1.6, Math.round((z + delta) * 10) / 10)));
  }, []);

  const handleScopeChange = useCallback(
    (id: string) => {
      setScopeId(id);
      if (id && root) {
        // Bagan departemen dibuka penuh: batalkan collapse untuk subtree-nya
        const dept = findNode(root, id);
        if (dept) {
          setCollapsed((prev) => {
            const next = new Set(prev);
            for (const deptId of allDeptIds(dept)) next.delete(deptId);
            return next;
          });
          setSelectedId(id);
        }
      }
    },
    [root],
  );

  /* ---------------- render ---------------- */

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <Spinner />
          <span className="text-sm">Menarik data dari Lark…</span>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-bold text-rose-700">Gagal memuat struktur organisasi</h1>
          <p className="mt-2 text-sm text-slate-700">{state.error}</p>
          {state.hint && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">💡 {state.hint}</p>
          )}
          {state.code !== undefined && (
            <p className="mt-3 text-[11px] text-slate-400">Kode error: {String(state.code)}</p>
          )}
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Coba lagi
            </button>
            <a
              href="/api/health"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cek koneksi Lark
            </a>
          </div>
        </div>
      </div>
    );
  }

  const { data } = state;

  return (
    <div className="print-h-auto flex h-screen flex-col">
      {/* ---------- Header ---------- */}
      <header className="no-print relative overflow-hidden bg-gradient-to-r from-brand-700 to-brand-500 px-5 pb-12 pt-6 text-white">
        <HeroBackground />
        <div className="relative mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4">
          <div className="anim-rise">
            <h1 className="text-2xl font-bold tracking-tight">{data.root.name || orgName}</h1>
            <p className="mt-0.5 text-xs text-brand-100">
              Struktur organisasi · sinkron dari Lark ·{' '}
              {new Date(data.generatedAt).toLocaleString('id-ID', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
              {data.cached && ' (cache)'}
            </p>
          </div>

          <div className="anim-rise anim-rise-1 flex flex-wrap items-center gap-2">
            <StatChip label="departemen" value={data.stats.totalDepartments} />
            <StatChip label="karyawan" value={data.stats.totalPeople} />
            <StatChip label="level" value={data.stats.maxDepth} />
          </div>
        </div>
      </header>

      {/* ---------- Floating navbar ---------- */}
      <div className="no-print sticky top-3 z-40 -mt-7 px-5">
        <div className="anim-rise anim-rise-2 mx-auto flex max-w-[1600px] flex-wrap items-center gap-2.5 rounded-2xl border border-slate-200/70 bg-white/90 px-4 py-2.5 shadow-lg shadow-slate-900/10 backdrop-blur-md">
          <div className="relative min-w-[200px] flex-1">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama, jabatan, email, atau departemen…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
            />
            <svg
              viewBox="0 0 20 20"
              className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400"
              fill="currentColor"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 103.39 9.84l3.63 3.64a.75.75 0 101.06-1.06l-3.63-3.64A5.5 5.5 0 009 3.5zM5 9a4 4 0 118 0 4 4 0 01-8 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          <div className="flex rounded-lg border border-slate-300 p-0.5">
            {(['chart', 'list'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setView(mode);
                  setQuery('');
                }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  view === mode && !isSearching
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {mode === 'chart' ? 'Bagan' : 'Daftar'}
              </button>
            ))}
          </div>

          {view === 'chart' && !isSearching && (
            <div className="flex flex-wrap items-center gap-1">
              <span aria-hidden className="mx-1 hidden h-6 w-px bg-slate-200 lg:block" />
              <select
                value={scopeId}
                onChange={(e) => handleScopeChange(e.target.value)}
                className="max-w-[220px] rounded-lg border border-slate-300 py-1.5 pl-2 pr-7 text-sm text-slate-700 outline-none transition focus:border-brand-400"
                aria-label="Cakupan bagan"
              >
                <option value="">Seluruh organisasi</option>
                {scopeOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {'   '.repeat(Math.max(0, d.level - deptLevel))}
                    {d.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setFitMode(false);
                  setZoom((z) => Math.max(0.3, Math.round((z - 0.1) * 10) / 10));
                }}
                className="h-8 w-8 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
                aria-label="Perkecil"
              >
                −
              </button>
              <span className="w-12 text-center text-xs tabular-nums text-slate-500">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => {
                  setFitMode(false);
                  setZoom((z) => Math.min(1.6, Math.round((z + 0.1) * 10) / 10));
                }}
                className="h-8 w-8 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
                aria-label="Perbesar"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setFitMode(true)}
                title="Sesuaikan bagan dengan lebar layar"
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  fitMode
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Pas layar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!root) return;
                  if (scopeId && chartRoot) setCollapsed(new Set(idsFromLevel(chartRoot, 1)));
                  else setCollapsed(new Set(idsFromLevel(root, Math.max(1, deptLevel - 1))));
                }}
                className="ml-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Tutup semua
              </button>
              <button
                type="button"
                onClick={() => setCollapsed(new Set())}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Buka semua
              </button>
            </div>
          )}

          {view === 'list' && !isSearching && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => root && setExpanded(new Set(allDeptIds(root)))}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Buka semua
              </button>
              <button
                type="button"
                onClick={() => root && setExpanded(new Set([root.id]))}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Tutup semua
              </button>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            <span aria-hidden className="mr-0.5 hidden h-6 w-px bg-slate-200 lg:block" />
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cetak
            </button>
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {refreshing && <Spinner />}
              {refreshing ? 'Menyinkron…' : 'Sinkron ulang'}
            </button>
          </div>
        </div>
      </div>

      {/* ---------- Body ---------- */}
      <main className="mx-auto min-h-0 w-full max-w-[1600px] flex-1 p-5">
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
            {scopedDept && (
              <div
                className={`flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-slate-200 border-l-4 bg-white px-5 py-3 shadow-sm ${
                  familyColor(scopedDept.colorIndex)?.bar ?? 'border-l-brand-600'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">
                    Struktur Organisasi · {data.root.name} ·{' '}
                    {new Date(data.generatedAt).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                  </p>
                  <h2 className="truncate text-lg font-bold text-slate-900">{scopedDept.name}</h2>
                </div>

                {scopedDept.leader && (
                  <div className="flex items-center gap-2">
                    <Avatar
                      name={scopedDept.leader.name}
                      src={scopedDept.leader.avatar}
                      size={34}
                    />
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">
                        Kepala Departemen
                      </p>
                      <p className="text-sm font-semibold text-slate-800">
                        {scopedDept.leader.name}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={`rounded-full px-2.5 py-1 font-semibold tabular-nums ${
                      familyColor(scopedDept.colorIndex)?.chip ?? 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {scopedDept.totalHeadcount} orang
                  </span>
                  {scopedDept.totalSubDepartments > 0 && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold tabular-nums text-slate-600">
                      {scopedDept.totalSubDepartments} sub-departemen
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleScopeChange('')}
                  className="no-print ml-auto rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
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
                selectedId={selectedId}
                zoom={zoom}
                fitMode={fitMode}
                onEffectiveZoom={setZoom}
                onZoomStep={handleZoomStep}
              />
            </div>
          </div>
        ) : (
          <div className="print-h-auto grid h-full grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
            <aside className="thin-scroll no-print overflow-auto rounded-2xl border border-slate-200 bg-white p-3">
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
