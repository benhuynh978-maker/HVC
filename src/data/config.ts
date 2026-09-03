import type { MemberGroup, Skill, AttendanceStatus, ShiftTier, TimeBlock } from '../types'

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

/**
 * Ca trực không còn là catalog cố định — Admin/Điều phối viên tự tạo từng ca
 * riêng cho từng ngày ngay tại "Lịch trực tuần" (xem `createShift` trong
 * store). Phần dưới đây chỉ còn các hằng số dùng chung: khung giờ để thành
 * viên khai lịch rảnh, và hệ số quy đổi điểm gánh nặng.
 */

/** 4 khung giờ cố định trong ngày — dùng ở "Lịch rảnh của tôi" thay cho việc khai theo mã ca cụ thể. */
export const TIME_BLOCKS: { value: TimeBlock; label: string; start: string; end: string }[] = [
  { value: 'morning', label: 'Sáng', start: '06:00', end: '11:00' },
  { value: 'midday', label: 'Trưa', start: '11:00', end: '13:00' },
  { value: 'afternoon', label: 'Chiều', start: '13:00', end: '18:00' },
  { value: 'evening', label: 'Tối', start: '18:00', end: '22:00' },
]

export const TIME_BLOCK_LABEL: Record<TimeBlock, string> = Object.fromEntries(
  TIME_BLOCKS.map((b) => [b.value, b.label]),
) as Record<TimeBlock, string>

/** Tra khung giờ chứa một mốc "HH:MM" — dùng để so ca cụ thể với lịch rảnh đã khai theo khung. */
export function blockOf(hhmm: string): TimeBlock {
  const [h, m] = hhmm.split(':').map(Number)
  const mins = h * 60 + m
  for (const b of TIME_BLOCKS) {
    const [bh, bm] = b.start.split(':').map(Number)
    const [eh, em] = b.end.split(':').map(Number)
    if (mins >= bh * 60 + bm && mins < eh * 60 + em) return b.value
  }
  return TIME_BLOCKS[TIME_BLOCKS.length - 1].value
}

/** Hệ số điểm gánh nặng theo giờ, phân theo tầng ca — dùng để tự tính `weight` khi Admin tạo ca, không bắt nhập số trừu tượng. */
export const WEIGHT_PER_HOUR: Record<ShiftTier, number> = {
  peak: 0.6,
  normal: 0.5,
  low: 0.4,
}

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
  TC: 'Ban Tài chính chiến lược',
  NS: 'Ban Nhân sự',
  TT: 'Ban Truyền thông',
  DD: 'Ban Đạo diễn nghệ thuật',
  DN: 'Ban Đối ngoại',
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
