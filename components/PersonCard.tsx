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
      className={`flex items-center gap-3 rounded-xl border border-line bg-paper transition hover:border-grid ${
        compact ? 'p-2.5' : 'p-3'
      }`}
    >
      <Avatar name={person.name} src={person.avatar} size={compact ? 34 : 42} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium text-ink">{person.name}</p>
          {person.isLeader && (
            <span className="badge badge-blue">
              Head
            </span>
          )}
        </div>

        {person.jobTitle && <p className="truncate text-xs text-ink-2">{person.jobTitle}</p>}

        {subtitle && <p className="truncate text-[11px] text-muted">{subtitle}</p>}

        {!compact && person.email && (
          <a
            href={`mailto:${person.email}`}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5 block truncate text-[11px] text-blue hover:underline"
          >
            {person.email}
          </a>
        )}
      </div>
    </div>
  );
}
