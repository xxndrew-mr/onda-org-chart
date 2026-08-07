'use client';

import { familyColor } from '@/lib/colors';
import type { DeptNode } from '@/lib/types';

interface DeptTreeProps {
  node: DeptNode;
  selectedId: string;
  expanded: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  depth?: number;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-90' : ''}`}
      fill="currentColor"
      aria-hidden
    >
      <path d="M7 5l6 5-6 5V5z" />
    </svg>
  );
}

export default function DeptTree({
  node,
  selectedId,
  expanded,
  onSelect,
  onToggle,
  depth = 0,
}: DeptTreeProps) {
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.id);
  const isSelected = selectedId === node.id;
  const fam = familyColor(node.colorIndex);

  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded-lg pr-2 text-sm transition ${
          isSelected ? 'bg-brand-50 text-brand-800' : 'hover:bg-slate-100'
        }`}
        style={{ paddingLeft: depth * 14 + 4 }}
      >
        <button
          type="button"
          onClick={() => hasChildren && onToggle(node.id)}
          className={`flex h-6 w-5 items-center justify-center rounded ${
            hasChildren ? 'text-slate-400 hover:text-slate-700' : 'invisible'
          }`}
          aria-label={isOpen ? 'Tutup' : 'Buka'}
          aria-expanded={hasChildren ? isOpen : undefined}
        >
          <Chevron open={isOpen} />
        </button>

        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 py-1.5 text-left"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {fam && <span className={`h-2 w-2 shrink-0 rounded-full ${fam.dot}`} aria-hidden />}
            <span className={`truncate ${isSelected ? 'font-semibold' : ''}`}>{node.name}</span>
          </span>
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${
              isSelected ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'
            }`}
            title={`${node.totalHeadcount} orang (termasuk sub-departemen)`}
          >
            {node.totalHeadcount}
          </span>
        </button>
      </div>

      {hasChildren && isOpen && (
        <div className="border-l border-slate-200" style={{ marginLeft: depth * 14 + 13 }}>
          <div style={{ marginLeft: -(depth * 14 + 13) }}>
            {node.children.map((child) => (
              <DeptTree
                key={child.id}
                node={child}
                selectedId={selectedId}
                expanded={expanded}
                onSelect={onSelect}
                onToggle={onToggle}
                depth={depth + 1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
