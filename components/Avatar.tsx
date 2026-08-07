'use client';

import { useState } from 'react';

const PALETTE = [
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
  'bg-emerald-100 text-emerald-700',
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
  'bg-teal-100 text-teal-700',
  'bg-orange-100 text-orange-700',
  'bg-indigo-100 text-indigo-700',
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

interface AvatarProps {
  name: string;
  src?: string;
  /** Ukuran piksel */
  size?: number;
  className?: string;
}

export default function Avatar({ name, src, size = 40, className = '' }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const dimension = { width: size, height: size };

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        style={dimension}
        onError={() => setFailed(true)}
        className={`shrink-0 rounded-full object-cover ring-1 ring-slate-200 ${className}`}
      />
    );
  }

  return (
    <div
      style={{ ...dimension, fontSize: Math.max(11, Math.round(size * 0.36)) }}
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ring-1 ring-slate-200 ${colorFor(name)} ${className}`}
      aria-label={name}
    >
      {initials(name)}
    </div>
  );
}
