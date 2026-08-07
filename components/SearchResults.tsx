'use client';

import PersonCard from './PersonCard';
import type { DeptNode } from '@/lib/types';
import type { PersonWithDept } from '@/lib/tree-utils';

interface SearchResultsProps {
  query: string;
  people: PersonWithDept[];
  departments: DeptNode[];
  onSelect: (id: string) => void;
}

export default function SearchResults({ query, people, departments, onSelect }: SearchResultsProps) {
  const empty = people.length === 0 && departments.length === 0;

  return (
    <div className="thin-scroll h-full overflow-auto rounded-2xl border border-slate-200 bg-white p-5">
      <p className="mb-4 text-sm text-slate-500">
        Hasil untuk <span className="font-semibold text-slate-800">&ldquo;{query}&rdquo;</span> —{' '}
        {departments.length} departemen, {people.length} orang
      </p>

      {empty && (
        <div className="rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-400">
          Tidak ada yang cocok. Coba kata kunci lain.
        </div>
      )}

      {departments.length > 0 && (
        <section className="mb-7">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Departemen
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((dept) => (
              <button
                key={dept.id}
                type="button"
                onClick={() => onSelect(dept.id)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-brand-300 hover:bg-brand-50/40"
              >
                <p className="truncate text-sm font-medium text-slate-800">{dept.name}</p>
                <p className="truncate text-[11px] text-slate-400">{dept.path.join(' / ')}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{dept.totalHeadcount} orang</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {people.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Orang</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {people.map((person) => (
              <button
                key={`${person.id}-${person.departmentId}`}
                type="button"
                onClick={() => onSelect(person.departmentId)}
                className="text-left"
              >
                <PersonCard person={person} subtitle={person.deptPath.slice(1).join(' / ') || person.deptName} />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
