import type { ShiftDef, MemberGroup, Skill, AttendanceStatus } from '../types'

/**
 * Toàn bộ tham số vận hành nằm ở một chỗ duy nhất.
 * Đổi khung ca / định mức / hệ số công bằng chỉ cần sửa file này.
 */

export const WEEKDAYS = [1, 2, 3, 4, 5]
export const WEEKEND = [6, 7]

export const DAY_LABELS: Record<number, string> = {
  1: 'Thứ 2',
  2: 'Thứ 3',
  3: 'Thứ 4',
  4: 'Thứ 5',
  5: 'Thứ 6',
  6: 'Thứ 7',
  7: 'Chủ nhật',
}

export const DAY_SHORT: Record<number, string> = {
  1: 'T2',
  2: 'T3',
  3: 'T4',
  4: 'T5',
  5: 'T6',
  6: 'T7',
  7: 'CN',
}

/** Khung ca chuẩn — khớp với Đề mục 2 của bài làm. */
export const SHIFTS: ShiftDef[] = [
  {
    code: 'A',
    name: 'Trước giờ vào lớp',
    start: '06:30',
    end: '07:30',
    tier: 'peak',
    minStaff: 3,
    standbyNeeded: 0,
    days: WEEKDAYS,
    weight: 1.3 * 1.25,
    hours: 1,
  },
  {
    code: 'B',
    name: 'Tiết 1–2',
    start: '07:30',
    end: '09:30',
    tier: 'low',
    minStaff: 1,
    standbyNeeded: 1,
    days: WEEKDAYS,
    weight: 0.75,
    hours: 2,
  },
  {
    code: 'C',
    name: 'Ra chơi giữa buổi',
    start: '09:30',
    end: '11:00',
    tier: 'peak',
    minStaff: 3,
    standbyNeeded: 0,
    days: WEEKDAYS,
    weight: 1.25,
    hours: 1.5,
  },
  {
    code: 'D',
    name: 'Tan học sáng / nghỉ trưa',
    start: '11:00',
    end: '13:00',
    tier: 'peak',
    minStaff: 3,
    standbyNeeded: 0,
    days: WEEKDAYS,
    weight: 1.25,
    hours: 2,
  },
  {
    code: 'E',
    name: 'Tiết học buổi chiều',
    start: '13:00',
    end: '15:00',
    tier: 'low',
    minStaff: 1,
    standbyNeeded: 1,
    days: WEEKDAYS,
    weight: 0.75,
    hours: 2,
  },
  {
    code: 'F',
    name: 'Tan học chiều',
    start: '15:00',
    end: '17:30',
    tier: 'peak',
    minStaff: 3,
    standbyNeeded: 0,
    days: WEEKDAYS,
    weight: 1.25,
    hours: 2.5,
  },
  {
    code: 'W1',
    name: 'Sáng cuối tuần',
    start: '08:00',
    end: '10:30',
    tier: 'normal',
    minStaff: 2,
    standbyNeeded: 0,
    days: WEEKEND,
    weight: 1.5,
    hours: 2.5,
  },
  {
    code: 'W2',
    name: 'Trưa cuối tuần',
    start: '10:30',
    end: '13:00',
    tier: 'normal',
    minStaff: 2,
    standbyNeeded: 0,
    days: WEEKEND,
    weight: 1.5,
    hours: 2.5,
  },
  {
    code: 'W3',
    name: 'Chiều cuối tuần',
    start: '13:00',
    end: '16:00',
    tier: 'normal',
    minStaff: 2,
    standbyNeeded: 0,
    days: WEEKEND,
    weight: 1.5,
    hours: 3,
  },
]

export const SHIFT_MAP: Record<string, ShiftDef> = Object.fromEntries(
  SHIFTS.map((s) => [s.code, s]),
)

export const TIER_LABEL: Record<string, string> = {
  peak: 'Cao điểm',
  normal: 'Thường',
  low: 'Thấp điểm',
}

export const TIER_STYLE: Record<string, { dot: string; chip: string; bar: string }> = {
  peak: {
    dot: 'bg-brand-500',
    chip: 'bg-brand-50 text-brand-700 border border-brand-100',
    bar: 'bg-brand-500',
  },
  normal: {
    dot: 'bg-amber-500',
    chip: 'bg-amber-50 text-amber-700 border border-amber-100',
    bar: 'bg-amber-500',
  },
  low: {
    dot: 'bg-emerald-500',
    chip: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    bar: 'bg-emerald-500',
  },
}

export const GROUP_LABEL: Record<MemberGroup, string> = {
  HS: 'Học sinh',
  SV: 'Sinh viên',
  DL: 'Người đi làm',
}

export const SKILL_LABEL: Record<Skill, string> = {
  cashier: 'Thu ngân',
  sales: 'Bán hàng',
  logistics: 'Hậu cần',
  media: 'Truyền thông',
}

export const ROLE_LABEL: Record<string, string> = {
  admin: 'Trưởng ban Nhân sự',
  coordinator: 'Điều phối viên',
  member: 'Thành viên',
}

/** Điểm uy tín cộng/trừ theo từng trạng thái — khớp bảng 3.3 của bài làm. */
export const RELIABILITY_DELTA: Record<AttendanceStatus, number> = {
  none: 0,
  ontime: 2,
  late_minor: 0,
  late_major: -3,
  absent_notified: 0,
  absent_no_notice: -12,
}

export const PICKUP_BONUS = 5

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  none: 'Chưa ghi nhận',
  ontime: 'Đúng giờ',
  late_minor: 'Trễ nhẹ (1–10 phút)',
  late_major: 'Trễ nặng (>10 phút)',
  absent_notified: 'Vắng có báo trước',
  absent_no_notice: 'Vắng không báo',
}

export const ATTENDANCE_STYLE: Record<AttendanceStatus, string> = {
  none: 'bg-ink-100 text-ink-500',
  ontime: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  late_minor: 'bg-amber-50 text-amber-700 border border-amber-100',
  late_major: 'bg-orange-50 text-orange-700 border border-orange-100',
  absent_notified: 'bg-sky-50 text-sky-700 border border-sky-100',
  absent_no_notice: 'bg-rose-50 text-rose-700 border border-rose-100',
}

/** Ngưỡng cảnh báo sớm — mục 3.8 của bài làm. */
export const KPI_TARGET = {
  onTime: { goal: 92, alert: 85 },
  emptyShifts: { goal: 0, alert: 1 },
  noNotice: { goal: 5, alert: 8 },
  advanceNotice: { goal: 85, alert: 70 },
  swapMatched: { goal: 95, alert: 85 },
  balanceGap: { goal: 20, alert: 35 },
} as const

/** Hạn xác nhận ca ngày mai (giờ trong ngày). */
export const CONFIRM_DEADLINE_HOUR = 22

/** Đệm di chuyển trước/sau sự kiện điểm bán ngoài (phút) — ràng buộc cứng H3. */
export const TRAVEL_BUFFER_MIN = 60

export const AVAILABILITY_RATIO = 2 // quy tắc "khai gấp đôi"

/** Ngày khởi động project — mốc bắt đầu cho kỳ "Cả mùa" ở Tổng quan Nhân viên. */
export const PROJECT_START_DATE = '2026-08-01'
