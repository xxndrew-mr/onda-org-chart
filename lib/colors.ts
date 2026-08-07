/**
 * Palet warna untuk membedakan tiap keluarga departemen di bagan.
 * Class Tailwind harus ditulis literal (bukan dirangkai string) supaya
 * terdeteksi oleh JIT compiler.
 */

export interface FamilyColor {
  /** Garis aksen kiri pada kartu bagan */
  bar: string;
  /** Titik kecil penanda di daftar departemen */
  dot: string;
  /** Warna teks nama departemen */
  text: string;
  /** Chip kecil (headcount) dengan tint warna keluarga */
  chip: string;
}

const FAMILY_COLORS: FamilyColor[] = [
  { bar: 'border-l-sky-500', dot: 'bg-sky-500', text: 'text-sky-900', chip: 'bg-sky-100 text-sky-700' },
  { bar: 'border-l-rose-500', dot: 'bg-rose-500', text: 'text-rose-900', chip: 'bg-rose-100 text-rose-700' },
  { bar: 'border-l-amber-500', dot: 'bg-amber-500', text: 'text-amber-900', chip: 'bg-amber-100 text-amber-700' },
  { bar: 'border-l-emerald-500', dot: 'bg-emerald-500', text: 'text-emerald-900', chip: 'bg-emerald-100 text-emerald-700' },
  { bar: 'border-l-violet-500', dot: 'bg-violet-500', text: 'text-violet-900', chip: 'bg-violet-100 text-violet-700' },
  { bar: 'border-l-orange-500', dot: 'bg-orange-500', text: 'text-orange-900', chip: 'bg-orange-100 text-orange-700' },
  { bar: 'border-l-teal-500', dot: 'bg-teal-500', text: 'text-teal-900', chip: 'bg-teal-100 text-teal-700' },
  { bar: 'border-l-fuchsia-500', dot: 'bg-fuchsia-500', text: 'text-fuchsia-900', chip: 'bg-fuchsia-100 text-fuchsia-700' },
  { bar: 'border-l-lime-600', dot: 'bg-lime-600', text: 'text-lime-900', chip: 'bg-lime-100 text-lime-700' },
  { bar: 'border-l-indigo-500', dot: 'bg-indigo-500', text: 'text-indigo-900', chip: 'bg-indigo-100 text-indigo-700' },
  { bar: 'border-l-pink-500', dot: 'bg-pink-500', text: 'text-pink-900', chip: 'bg-pink-100 text-pink-700' },
  { bar: 'border-l-cyan-600', dot: 'bg-cyan-600', text: 'text-cyan-900', chip: 'bg-cyan-100 text-cyan-700' },
];

export function familyColor(index: number | undefined): FamilyColor | null {
  if (index === undefined || index < 0) return null;
  return FAMILY_COLORS[index % FAMILY_COLORS.length];
}
