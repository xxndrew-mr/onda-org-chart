'use client';

import { useState } from 'react';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
  // width/height eksplisit supaya tidak ada layout shift (CLS)
  const dimension = { width: size, height: size };

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        style={dimension}
        onError={() => setFailed(true)}
        className={`shrink-0 rounded-full object-cover ring-1 ring-line ${className}`}
      />
    );
  }

  return (
    <div
      style={{ ...dimension, fontSize: Math.max(10, Math.round(size * 0.32)) }}
      className={`flex shrink-0 items-center justify-center rounded-full bg-mist font-mono font-bold text-ink-2 ring-1 ring-line ${className}`}
      aria-label={name}
    >
      {initials(name)}
    </div>
  );
}
