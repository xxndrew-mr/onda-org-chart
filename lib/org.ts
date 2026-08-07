import {
  fetchAllDepartments,
  fetchDepartment,
  fetchUsersForDepartments,
  fetchUsersInDepartment,
  larkConfig,
} from './lark';
import type { DeptNode, LarkDepartment, LarkUser, OrgStats, Person } from './types';

/* ============================================================
 *  Mapping Lark → model UI
 * ========================================================== */

function toPerson(user: LarkUser, departmentId: string, leaderId?: string): Person {
  return {
    id: user.open_id,
    name: user.name,
    enName: user.en_name || undefined,
    jobTitle: user.job_title || undefined,
    email: user.enterprise_email || user.email || undefined,
    avatar: user.avatar?.avatar_240 || user.avatar?.avatar_72 || undefined,
    employeeNo: user.employee_no || undefined,
    city: user.city || undefined,
    isLeader: Boolean(leaderId && user.open_id === leaderId),
    isTenantManager: user.is_tenant_manager || undefined,
    departmentId,
  };
}

/** Urut: leader dulu, lalu yang punya job title, lalu alfabetis. */
function sortMembers(a: Person, b: Person): number {
  if (a.isLeader !== b.isLeader) return a.isLeader ? -1 : 1;
  const aHasTitle = Boolean(a.jobTitle);
  const bHasTitle = Boolean(b.jobTitle);
  if (aHasTitle !== bHasTitle) return aHasTitle ? -1 : 1;
  return a.name.localeCompare(b.name, 'id');
}

/* ============================================================
 *  Restruktur governance
 *
 *  Data Lark menaruh semua departemen sejajar di bawah root.
 *  Untuk bagan, kita susun ulang: Commissioner → Direksi →
 *  departemen inti, tanpa mengubah data di Lark.
 * ========================================================== */

const DIREKSI_RE = /^(direksi|direktur|board of directors?|bod)$/i;
const KOMISARIS_RE = /^(commissioner|komisaris|dewan komisaris|board of commissioners?)$/i;
const STAF_KOMISARIS_RE = /(commissioner|komisaris)/i;

function restructureGovernance(root: DeptNode): { direksi?: DeptNode; commissioner?: DeptNode } {
  const direksi = root.children.find((c) => DIREKSI_RE.test(c.name.trim()));
  if (!direksi) return {};

  const commissioner = root.children.find((c) => KOMISARIS_RE.test(c.name.trim()));
  const stafKomisaris = root.children.filter(
    (c) => c !== direksi && c !== commissioner && STAF_KOMISARIS_RE.test(c.name),
  );
  const coreDepts = root.children.filter(
    (c) => c !== direksi && c !== commissioner && !stafKomisaris.includes(c),
  );

  direksi.children.push(...coreDepts);
  for (const d of coreDepts) d.parentId = direksi.id;

  if (commissioner) {
    commissioner.children.push(...stafKomisaris, direksi);
    for (const d of [...stafKomisaris, direksi]) d.parentId = commissioner.id;
    root.children = [commissioner];
  } else {
    root.children = [...stafKomisaris, direksi];
  }

  return { direksi, commissioner };
}

/**
 * Tandai tiap "keluarga" departemen (anak langsung dari Direksi/Commissioner)
 * dengan indeks warna yang diwariskan ke seluruh sub-departemennya.
 */
function assignColorIndexes(root: DeptNode, spineIds: Set<string>): void {
  let nextIndex = 0;

  const stamp = (node: DeptNode, index: number): void => {
    node.colorIndex = index;
    for (const child of node.children) stamp(child, index);
  };

  const walkSpine = (node: DeptNode): void => {
    for (const child of node.children) {
      if (spineIds.has(child.id)) walkSpine(child);
      else stamp(child, nextIndex++);
    }
  };

  walkSpine(root);
}

/* ============================================================
 *  Bangun pohon organisasi
 * ========================================================== */

export async function buildOrgTree(): Promise<{
  root: DeptNode;
  stats: OrgStats;
  deptLevel: number;
}> {
  const rootId = larkConfig.rootDepartmentId;

  // 1. Semua departemen turunan (rekursif)
  const departments = await fetchAllDepartments(rootId);

  // 2. Anggota per departemen — termasuk anggota langsung di root
  const deptIds = departments.map((d) => d.open_department_id);
  const [usersByDept, rootMembersRaw, rootDeptInfo] = await Promise.all([
    fetchUsersForDepartments(deptIds),
    fetchUsersInDepartment(rootId).catch(() => [] as LarkUser[]),
    rootId === '0' ? Promise.resolve(null) : fetchDepartment(rootId),
  ]);

  // 3. Index user global — dipakai untuk mencari nama leader
  const userIndex = new Map<string, LarkUser>();
  for (const list of usersByDept.values()) {
    for (const u of list) userIndex.set(u.open_id, u);
  }
  for (const u of rootMembersRaw) userIndex.set(u.open_id, u);

  // 4. Bikin node untuk tiap departemen
  const nodeById = new Map<string, DeptNode>();

  const makeNode = (dept: LarkDepartment): DeptNode => {
    const members = (usersByDept.get(dept.open_department_id) ?? [])
      .map((u) => toPerson(u, dept.open_department_id, dept.leader_user_id))
      .sort(sortMembers);

    let leader = members.find((m) => m.isLeader);

    // Leader kadang tidak terdaftar sebagai anggota langsung departemennya
    if (!leader && dept.leader_user_id) {
      const raw = userIndex.get(dept.leader_user_id);
      if (raw) leader = { ...toPerson(raw, dept.open_department_id, dept.leader_user_id), isLeader: true };
    }

    return {
      id: dept.open_department_id,
      name: dept.name,
      enName: dept.i18n_name?.en_us || undefined,
      parentId: dept.parent_department_id || rootId,
      level: 0,
      path: [],
      leader,
      members,
      children: [],
      totalHeadcount: 0,
      totalSubDepartments: 0,
    };
  };

  for (const dept of departments) {
    nodeById.set(dept.open_department_id, makeNode(dept));
  }

  // 5. Node root (perusahaan / departemen induk yang dipilih)
  const root: DeptNode = {
    id: rootId,
    name: rootDeptInfo?.name || larkConfig.orgName,
    enName: rootDeptInfo?.i18n_name?.en_us || undefined,
    parentId: null,
    level: 0,
    path: [],
    leader: undefined,
    members: rootMembersRaw.map((u) => toPerson(u, rootId, rootDeptInfo?.leader_user_id)).sort(sortMembers),
    children: [],
    totalHeadcount: 0,
    totalSubDepartments: 0,
  };

  if (rootDeptInfo?.leader_user_id) {
    const raw = userIndex.get(rootDeptInfo.leader_user_id);
    if (raw) root.leader = { ...toPerson(raw, rootId, rootDeptInfo.leader_user_id), isLeader: true };
  }

  nodeById.set(rootId, root);

  // 6. Sambungkan parent ↔ child. Parent yang tidak ketemu digantung ke root.
  for (const node of nodeById.values()) {
    if (node.id === rootId) continue;
    const parent = (node.parentId && nodeById.get(node.parentId)) || root;
    parent.children.push(node);
  }

  // 7. Susun ulang: Commissioner → Direksi → departemen inti
  const { direksi, commissioner } = restructureGovernance(root);

  // 8. Hitung level, path, headcount, dan urutkan anak-anaknya
  const seen = new Set<string>();

  const finalize = (node: DeptNode, level: number, path: string[]): void => {
    if (seen.has(node.id)) {
      // Proteksi kalau data Lark punya siklus parent yang aneh
      node.children = [];
      return;
    }
    seen.add(node.id);

    node.level = level;
    node.path = [...path, node.name];

    node.children.sort((a, b) => a.name.localeCompare(b.name, 'id'));
    for (const child of node.children) finalize(child, level + 1, node.path);

    node.totalSubDepartments =
      node.children.length + node.children.reduce((sum, c) => sum + c.totalSubDepartments, 0);
  };

  finalize(root, 0, []);

  // Headcount dihitung UNIK per subtree: satu orang yang terdaftar di beberapa
  // departemen (Lark mengizinkan ini) hanya dihitung sekali per ancestor,
  // supaya angka kartu konsisten dengan chip "karyawan" di header.
  const countUniqueHeadcount = (node: DeptNode): Set<string> => {
    const ids = new Set(node.members.map((m) => m.id));
    for (const child of node.children) {
      for (const id of countUniqueHeadcount(child)) ids.add(id);
    }
    node.totalHeadcount = ids.size;
    return ids;
  };
  countUniqueHeadcount(root);

  // 9. Warna per keluarga departemen (di luar jalur root–Commissioner–Direksi)
  const spineIds = new Set<string>([root.id]);
  if (commissioner) spineIds.add(commissioner.id);
  if (direksi) spineIds.add(direksi.id);
  assignColorIndexes(root, spineIds);

  // 10. Statistik
  const uniquePeople = new Set<string>();
  let maxDepth = 0;
  let departmentsWithoutLeader = 0;

  const walk = (node: DeptNode) => {
    maxDepth = Math.max(maxDepth, node.level);
    if (node.id !== rootId && !node.leader) departmentsWithoutLeader += 1;
    for (const m of node.members) uniquePeople.add(m.id);
    for (const c of node.children) walk(c);
  };
  walk(root);

  const stats: OrgStats = {
    totalDepartments: nodeById.size - 1, // root tidak dihitung sebagai departemen
    totalPeople: uniquePeople.size,
    maxDepth,
    departmentsWithoutLeader,
  };

  // Level tempat departemen inti berada (anak langsung Direksi)
  const deptLevel = direksi ? direksi.level + 1 : 1;

  return { root, stats, deptLevel };
}
