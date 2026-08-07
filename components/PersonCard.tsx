'use client';

import Avatar from './Avatar';
import type { Person } from '@/lib/types';

interface PersonCardProps {
  person: Person;
  subtitle?: string;
  compact?: boolean;
}

export default function PersonCard({ person, subtitle, compact = false }: PersonCardProps) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-slate-200 bg-white transition hover:border-brand-300 hover:shadow-sm ${
        compact ? 'p-2.5' : 'p-3'
      }`}
    >
      <Avatar name={person.name} src={person.avatar} size={compact ? 34 : 42} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-slate-900">{person.name}</p>
          {person.isLeader && (
            <span className="shrink-0 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
              Head
            </span>
          )}
        </div>

        {person.jobTitle && <p className="truncate text-xs text-slate-600">{person.jobTitle}</p>}

        {subtitle && <p className="truncate text-[11px] text-slate-400">{subtitle}</p>}

        {!compact && person.email && (
          <a
            href={`mailto:${person.email}`}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5 block truncate text-[11px] text-brand-600 hover:underline"
          >
            {person.email}
          </a>
        )}
      </div>
    </div>
  );
}
