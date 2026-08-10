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
    <div data-lenis-prevent className="thin-scroll h-full overflow-auto rounded-2xl border border-line bg-paper p-5">
      <p className="mb-4 text-sm text-ink-2">
        Hasil untuk <span className="font-semibold text-ink">&ldquo;{query}&rdquo;</span> —{' '}
        {departments.length} departemen, {people.length} orang
      </p>

      {empty && (
        <div className="rounded-xl border border-dashed border-line px-4 py-12 text-center text-sm text-muted">
          Tidak ada yang cocok. Coba kata kunci lain.
        </div>
      )}

      {departments.length > 0 && (
        <section className="mb-7">
          <h3 className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            Departemen
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((dept) => (
              <button
                key={dept.id}
                type="button"
                onClick={() => onSelect(dept.id)}
                className="rounded-xl border border-line bg-paper px-3 py-2.5 text-left transition hover:border-grid hover:bg-mist"
              >
                <p className="truncate text-sm font-medium text-ink">{dept.name}</p>
                <p className="truncate text-[11px] text-muted">{dept.path.join(' / ')}</p>
                <p className="mt-0.5 font-mono text-[10px] font-bold tracking-[0.12em] text-ink-2">{dept.totalHeadcount} orang</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {people.length > 0 && (
        <section>
          <h3 className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Orang</h3>
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
