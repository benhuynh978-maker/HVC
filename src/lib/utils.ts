import clsx, { type ClassValue } from 'clsx'
import type { Member, Role, StaffProfile } from '../types'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

/* ------------------------------------------------------------------ */
/* Vai trò — 2 giao diện: Admin (admin + coordinator) vs Nhân viên      */
/* ------------------------------------------------------------------ */

/** Trưởng ban / Điều phối viên — dùng giao diện quản trị đầy đủ. */
export function isAdminRole(role: Role): boolean {
  return role !== 'member'
}

/** Thành viên — người trực tiếp trực ca, dùng giao diện nhân viên. */
export function isStaffRole(role: Role): boolean {
  return role === 'member'
}

/**
 * Type guard: thành viên có hồ sơ trực ca hay không. Dùng để lọc danh sách
 * trước khi đưa vào thuật toán xếp lịch / pool dự bị / điểm bán ngoài —
 * sau khi lọc, TypeScript tự hiểu `.staff` luôn tồn tại.
 */
export function hasStaffProfile(m: Member): m is Member & { staff: StaffProfile } {
  return !!m.staff
}

/* ------------------------------------------------------------------ */
/* Ngày tháng — dùng chuỗi 'YYYY-MM-DD' làm khoá, tránh lệch múi giờ.   */
/* ------------------------------------------------------------------ */

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s: string, n: number): string {
  const d = parseISODate(s)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

/** Thứ trong tuần theo quy ước 1 = Thứ 2 … 7 = Chủ nhật. */
export function dowOf(s: string): number {
  const js = parseISODate(s).getDay()
  return js === 0 ? 7 : js
}

/** Ngày Thứ 2 của tuần chứa ngày đã cho. */
export function weekStartOf(s: string): string {
  return addDays(s, -(dowOf(s) - 1))
}

export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

export function today(): string {
  return toISODate(new Date())
}

export function tomorrow(): string {
  return addDays(today(), 1)
}

export function formatDate(s: string): string {
  const d = parseISODate(s)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function formatDateLong(s: string): string {
  const d = parseISODate(s)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export function formatWeekRange(weekStart: string): string {
  return `${formatDate(weekStart)} – ${formatDate(addDays(weekStart, 6))}`
}

export function relativeDayLabel(s: string): string {
  const diff = Math.round(
    (parseISODate(s).getTime() - parseISODate(today()).getTime()) / 86400000,
  )
  if (diff === 0) return 'Hôm nay'
  if (diff === 1) return 'Ngày mai'
  if (diff === -1) return 'Hôm qua'
  if (diff > 1) return `Còn ${diff} ngày`
  return `${-diff} ngày trước`
}

/* ------------------------------------------------------------------ */
/* Ca trực                                                             */
/* ------------------------------------------------------------------ */

export function shiftId(date: string, code: string) {
  return `${date}__${code}`
}

export function parseShiftId(id: string) {
  const [date, code] = id.split('__')
  return { date, code }
}

export function slotKey(dow: number, code: string) {
  return `${dow}-${code}`
}

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Hai khoảng thời gian trong cùng một ngày có giao nhau không. */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return minutesOf(aStart) < minutesOf(bEnd) && minutesOf(bStart) < minutesOf(aEnd)
}

/* ------------------------------------------------------------------ */
/* Linh tinh                                                           */
/* ------------------------------------------------------------------ */

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase()
}

const AVATAR_PALETTE = [
  'bg-brand-500',
  'bg-violet-500',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-teal-500',
  'bg-indigo-500',
]

export function avatarColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}

export function pct(n: number, digits = 0): string {
  return `${n.toFixed(digits)}%`
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

/** Bộ sinh số ngẫu nhiên có hạt giống — để dữ liệu mẫu ổn định giữa các lần chạy. */
export function makeRng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function pickSome<T>(arr: T[], n: number, rnd: () => number): T[] {
  const copy = [...arr]
  const out: T[] = []
  while (out.length < n && copy.length) {
    out.push(copy.splice(Math.floor(rnd() * copy.length), 1)[0])
  }
  return out
}
