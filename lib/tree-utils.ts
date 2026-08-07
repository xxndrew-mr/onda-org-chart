/**
 * Helper murni untuk memproses pohon organisasi.
 * File ini aman di-import dari komponen client (tidak menyentuh env/API).
 */

import type { DeptNode, Person } from './types';

export type PersonWithDept = Person & { deptName: string; deptPath: string[] };

export function flattenPeople(node: DeptNode): PersonWithDept[] {
  const out: PersonWithDept[] = [];
  const walk = (n: DeptNode) => {
    for (const m of n.members) out.push({ ...m, deptName: n.name, deptPath: n.path });
    n.children.forEach(walk);
  };
  walk(node);
  return out;
}

export function flattenDepartments(node: DeptNode): DeptNode[] {
  const out: DeptNode[] = [];
  const walk = (n: DeptNode) => {
    out.push(n);
    n.children.forEach(walk);
  };
  walk(node);
  return out;
}

export function findNode(node: DeptNode, id: string): DeptNode | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

/** Rantai id dari root sampai ke node target (inklusif). */
export function pathToNode(root: DeptNode, id: string): string[] {
  const chain: string[] = [];
  const walk = (n: DeptNode): boolean => {
    chain.push(n.id);
    if (n.id === id) return true;
    for (const c of n.children) if (walk(c)) return true;
    chain.pop();
    return false;
  };
  walk(root);
  return chain;
}

/** Kumpulkan id semua node yang levelnya < maxLevel (untuk auto-expand awal). */
export function idsUpToLevel(node: DeptNode, maxLevel: number): string[] {
  const out: string[] = [];
  const walk = (n: DeptNode) => {
    if (n.level < maxLevel) {
      out.push(n.id);
      n.children.forEach(walk);
    }
  };
  walk(node);
  return out;
}

/** Kumpulkan id semua node yang levelnya >= minLevel (untuk auto-collapse bagan). */
export function idsFromLevel(node: DeptNode, minLevel: number): string[] {
  const out: string[] = [];
  const walk = (n: DeptNode) => {
    if (n.level >= minLevel && n.children.length > 0) out.push(n.id);
    n.children.forEach(walk);
  };
  walk(node);
  return out;
}

export function allDeptIds(node: DeptNode): string[] {
  return flattenDepartments(node).map((n) => n.id);
}

/**
 * Bangun pohon bagan untuk SATU departemen: kartu departemen di puncak,
 * sub-departemen dan kotak per orang di bawahnya. Kepala departemen tidak
 * dibuatkan kotak sendiri karena sudah tampil di kartu departemennya.
 */
export function buildDeptChart(dept: DeptNode, level = 0): DeptNode {
  const memberNodes: DeptNode[] = dept.members
    .filter((m) => m.id !== dept.leader?.id)
    .map((m) => ({
      id: `person:${m.id}:${dept.id}`,
      name: m.name,
      parentId: dept.id,
      level: level + 1,
      path: [...dept.path, m.name],
      leader: undefined,
      members: [m],
      children: [],
      totalHeadcount: 1,
      totalSubDepartments: 0,
      colorIndex: dept.colorIndex,
      kind: 'person' as const,
    }));

  return {
    ...dept,
    level,
    children: [...dept.children.map((c) => buildDeptChart(c, level + 1)), ...memberNodes],
  };
}

export function normalize(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
}
