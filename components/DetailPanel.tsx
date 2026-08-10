'use client';

import { useRef } from 'react';
import PersonCard from './PersonCard';
import { useSmoothWheel } from './useSmoothWheel';
import type { DeptNode } from '@/lib/types';

interface DetailPanelProps {
  node: DeptNode;
  onSelect: (id: string) => void;
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-line bg-mist px-3 py-2">
      <p className="font-mono text-lg font-semibold tabular-nums text-ink">{value}</p>
      <p className="text-[11px] text-ink-2">{label}</p>
    </div>
  );
}

export default function DetailPanel({ node, onSelect }: DetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useSmoothWheel(panelRef);

  return (
    <div
      ref={panelRef}
      data-lenis-prevent
      className="thin-scroll print-full h-full overflow-auto rounded-2xl border border-line bg-paper"
    >
      <div className="sticky top-0 z-10 border-b border-line bg-paper px-5 py-4">
        <nav className="mb-1 flex flex-wrap items-center gap-1 text-[11px] text-muted">
          {node.path.map((name, i) => (
            <span key={`${name}-${i}`} className="flex items-center gap-1">
              {i > 0 && <span>/</span>}
              <span className={i === node.path.length - 1 ? 'text-ink-2' : ''}>{name}</span>
            </span>
          ))}
        </nav>

        <h2 className="text-xl font-bold text-ink">{node.name}</h2>
        {node.enName && <p className="text-xs text-ink-2">{node.enName}</p>}
      </div>

      <div className="space-y-6 p-5">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Anggota langsung" value={node.members.length} />
          <Stat label="Total (dgn sub-dept)" value={node.totalHeadcount} />
          <Stat label="Sub-departemen" value={node.totalSubDepartments} />
        </div>

        {node.leader && (
          <section>
            <h3 className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
              Kepala Departemen
            </h3>
            <PersonCard person={node.leader} />
          </section>
        )}

        {node.children.length > 0 && (
          <section>
            <h3 className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
              Sub-departemen ({node.children.length})
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {node.children.map((child) => (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => onSelect(child.id)}
                  className="rounded-xl border border-line bg-paper px-3 py-2.5 text-left transition hover:border-grid hover:bg-mist"
                >
                  <p className="truncate text-sm font-medium text-ink">{child.name}</p>
                  <p className="text-[11px] text-ink-2">
                    {child.totalHeadcount} orang
                    {child.children.length > 0 && ` · ${child.children.length} sub`}
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}

        <section>
          <h3 className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            Anggota Langsung ({node.members.length})
          </h3>

          {node.members.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-sm text-muted">
              Tidak ada anggota yang terdaftar langsung di departemen ini.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {node.members.map((person) => (
                <PersonCard key={person.id} person={person} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
