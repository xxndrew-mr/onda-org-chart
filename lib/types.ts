/**
 * Tipe data mentah dari Lark Open API (contact/v3)
 * dan tipe data yang dipakai di UI.
 */

// ---------- Raw Lark payloads ----------

export interface LarkI18nName {
  zh_cn?: string;
  ja_jp?: string;
  en_us?: string;
}

export interface LarkDepartment {
  /** ID departemen custom yang di-set admin (opsional) */
  department_id?: string;
  /** ID unik permanen — ini yang kita pakai sebagai key */
  open_department_id: string;
  name: string;
  i18n_name?: LarkI18nName;
  parent_department_id: string;
  leader_user_id?: string;
  /** Jumlah anggota langsung (tidak termasuk sub-departemen) */
  member_count?: number;
  order?: string;
  status?: { is_deleted?: boolean };
}

export interface LarkUserDepartmentPath {
  department_id?: string;
  department_name?: { name?: string; i18n_name?: LarkI18nName };
  department_path?: {
    department_ids?: string[];
    department_path_name?: { name?: string; i18n_name?: LarkI18nName };
  };
}

export interface LarkUser {
  open_id: string;
  union_id?: string;
  user_id?: string;
  name: string;
  en_name?: string;
  nickname?: string;
  email?: string;
  enterprise_email?: string;
  mobile?: string;
  job_title?: string;
  employee_no?: string;
  gender?: number; // 0 unknown, 1 male, 2 female
  avatar?: {
    avatar_72?: string;
    avatar_240?: string;
    avatar_640?: string;
    avatar_origin?: string;
  };
  status?: {
    is_frozen?: boolean;
    is_resigned?: boolean;
    is_activated?: boolean;
    is_exited?: boolean;
    is_unjoin?: boolean;
  };
  leader_user_id?: string;
  department_ids?: string[];
  city?: string;
  country?: string;
  is_tenant_manager?: boolean;
  employee_type?: number;
  join_time?: number;
}

// ---------- Tipe untuk UI ----------

export interface Person {
  id: string;
  name: string;
  enName?: string;
  jobTitle?: string;
  email?: string;
  avatar?: string;
  employeeNo?: string;
  city?: string;
  isLeader: boolean;
  isTenantManager?: boolean;
  departmentId: string;
}

export interface DeptNode {
  id: string;
  name: string;
  enName?: string;
  parentId: string | null;
  /** Kedalaman: 0 = root perusahaan */
  level: number;
  /** Path nama dari root, mis. ["PT Onda", "Sales", "Sales Jakarta"] */
  path: string[];
  leader?: Person;
  members: Person[];
  children: DeptNode[];
  /** Total orang termasuk semua sub-departemen */
  totalHeadcount: number;
  /** Total sub-departemen (rekursif) */
  totalSubDepartments: number;
  /**
   * Indeks warna keluarga departemen — sama untuk satu departemen inti
   * beserta seluruh sub-nya. Kosong untuk jalur root/Commissioner/Direksi.
   */
  colorIndex?: number;
  /** Diisi 'person' untuk node orang buatan UI pada bagan per departemen */
  kind?: 'person';
}

export interface OrgStats {
  totalDepartments: number;
  totalPeople: number;
  maxDepth: number;
  departmentsWithoutLeader: number;
}

export interface OrgResponse {
  ok: true;
  root: DeptNode;
  stats: OrgStats;
  /** Level tempat departemen inti berada (anak langsung Direksi) */
  deptLevel: number;
  generatedAt: string;
  cached: boolean;
  source: 'lark';
}

export interface OrgErrorResponse {
  ok: false;
  error: string;
  hint?: string;
  code?: number | string;
}
