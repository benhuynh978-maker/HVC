import type { AppData, Assignment, ShiftInstance, StaffMember } from '../types'
import { PROJECT_START_DATE } from '../data/config'
import {
  addDays,
  formatDateLong,
  hasStaffProfile,
  parseISODate,
  parseShiftId,
  toISODate,
  today,
  weekStartOf,
} from './utils'

/**
 * Tính đúng 4 chỉ số của Nhiệm vụ 1 + 3 chỉ số bổ sung của Phần C.
 * Đây là nơi duy nhất định nghĩa công thức, để mọi màn hình đều nói cùng một con số.
 */

export interface WeekMetrics {
  weekStart: string
  /** Tỷ lệ có mặt đúng giờ (%). */
  onTimeRate: number
  /** Số ca không đạt định mức tối thiểu. */
  emptyShifts: number
  /** Tỷ lệ vắng không báo trước (%). */
  noNoticeRate: number
  /** Số lượt xin đổi ca. */
  swapCount: number
  /** Tỷ lệ đổi ca khớp thành công (%). */
  swapMatchedRate: number
  /** Tỷ lệ báo trước ≥24h trên tổng số lượt vắng (%). */
  advanceNoticeRate: number
  /** Tỷ lệ xác nhận D-1 đúng hạn (%). */
  confirmRate: number
  /** Chênh lệch điểm gánh nặng giữa người cao nhất và thấp nhất (%). */
  balanceGap: number
  /** Điểm gánh nặng của từng thành viên. */
  burden: Record<string, number>
  recorded: number
  totalAssignments: number
}

export function shiftsOfWeek(shifts: ShiftInstance[], weekStart: string): ShiftInstance[] {
  return shifts.filter((s) => weekStartOf(s.date) === weekStart)
}

export function assignmentsOfWeek(data: AppData, weekStart: string): Assignment[] {
  const ids = new Set(shiftsOfWeek(data.shifts, weekStart).map((s) => s.id))
  return data.assignments.filter((a) => ids.has(a.shiftId))
}

/** Số người thực tế "được tính là có mặt" cho một ca. */
export function presentCount(shift: ShiftInstance, assignments: Assignment[]): number {
  const t = today()
  const list = assignments.filter((a) => a.shiftId === shift.id && !a.isStandby)
  if (shift.date < t) {
    return list.filter((a) => ['ontime', 'late_minor', 'late_major'].includes(a.attendance)).length
  }
  return list.filter((a) => a.confirmStatus !== 'declined').length
}

export function isUnderStaffed(shift: ShiftInstance, assignments: Assignment[]): boolean {
  return presentCount(shift, assignments) < shift.minStaff
}

export function computeBurden(
  data: AppData,
  weekStart: string,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const m of data.members) out[m.id] = 0
  const shiftMap = Object.fromEntries(data.shifts.map((s) => [s.id, s]))
  for (const a of assignmentsOfWeek(data, weekStart)) {
    const def = shiftMap[a.shiftId]
    if (!def) continue
    let w = def.weight
    if (a.isStandby) w *= 0.4
    if (a.isLead) w += 0.25
    out[a.memberId] = (out[a.memberId] ?? 0) + w
  }
  return out
}

export function computeWeekMetrics(data: AppData, weekStart: string): WeekMetrics {
  const shifts = shiftsOfWeek(data.shifts, weekStart)
  const shiftIds = new Set(shifts.map((s) => s.id))
  const assigns = data.assignments.filter((a) => shiftIds.has(a.shiftId))
  const mains = assigns.filter((a) => !a.isStandby)

  const recordedList = mains.filter((a) => a.attendance !== 'none')
  const recorded = recordedList.length
  const onTime = recordedList.filter((a) => a.attendance === 'ontime').length
  const noNotice = recordedList.filter((a) => a.attendance === 'absent_no_notice').length
  const notified = recordedList.filter((a) => a.attendance === 'absent_notified').length
  const totalAbsent = noNotice + notified

  const emptyShifts = shifts.filter((s) => isUnderStaffed(s, assigns)).length

  const weekSwaps = data.swaps.filter((s) => {
    const a = data.assignments.find((x) => x.id === s.assignmentId)
    return a ? shiftIds.has(a.shiftId) : false
  })
  const matched = weekSwaps.filter((s) => s.status === 'matched' || s.status === 'approved').length

  const pendingD1 = assigns.filter((a) => a.confirmStatus !== 'pending').length

  const burden = computeBurden(data, weekStart)
  const active = data.members
    .filter((m) => m.active)
    .filter(hasStaffProfile)
    .filter((m) => m.staff.maxShiftsPerWeek > 0)
  const ratios = active.map((m) => (burden[m.id] ?? 0) / m.staff.maxShiftsPerWeek)
  const avg = ratios.reduce((a, b) => a + b, 0) / (ratios.length || 1)
  const balanceGap =
    avg > 0 && ratios.length ? ((Math.max(...ratios) - Math.min(...ratios)) / avg) * 100 : 0

  return {
    weekStart,
    onTimeRate: recorded ? (onTime / recorded) * 100 : 0,
    emptyShifts,
    noNoticeRate: recorded ? (noNotice / recorded) * 100 : 0,
    swapCount: weekSwaps.length,
    swapMatchedRate: weekSwaps.length ? (matched / weekSwaps.length) * 100 : 100,
    advanceNoticeRate: totalAbsent ? (notified / totalAbsent) * 100 : 100,
    confirmRate: assigns.length ? (pendingD1 / assigns.length) * 100 : 0,
    balanceGap,
    burden,
    recorded,
    totalAssignments: assigns.length,
  }
}

/** Bảng xếp hạng ghi nhận đóng góp — chỉ vinh danh nhóm dẫn đầu. Chỉ nhân viên có mặt ở đây (Trưởng ban/ĐPV không trực ca). */
export interface Contribution {
  member: StaffMember
  shifts: number
  hours: number
  burden: number
  onTime: number
  pickedUp: number
}

export function computeContributions(data: AppData, weeks: string[]): Contribution[] {
  const weekSet = new Set(weeks)
  const weekShifts = data.shifts.filter((s) => weekSet.has(weekStartOf(s.date)))
  const shiftIds = new Set(weekShifts.map((s) => s.id))
  const shiftMap = Object.fromEntries(weekShifts.map((s) => [s.id, s]))

  return data.members
    .filter((m) => m.active)
    .filter(hasStaffProfile)
    .map((m) => {
      const list = data.assignments.filter((a) => a.memberId === m.id && shiftIds.has(a.shiftId))
      let hours = 0
      let burden = 0
      for (const a of list) {
        const def = shiftMap[a.shiftId]
        if (!def) continue
        hours += def.hours
        burden += (a.isStandby ? def.weight * 0.4 : def.weight) + (a.isLead ? 0.25 : 0)
      }
      return {
        member: m,
        shifts: list.length,
        hours,
        burden,
        onTime: list.filter((a) => a.attendance === 'ontime').length,
        pickedUp: list.filter((a) => a.pickedUp).length,
      }
    })
    .sort((a, b) => b.burden - a.burden)
}

/** Đánh giá một chỉ số so với mục tiêu / ngưỡng báo động. */
export type KpiState = 'good' | 'warn' | 'bad'

export function kpiState(
  value: number,
  goal: number,
  alert: number,
  higherIsBetter: boolean,
): KpiState {
  if (higherIsBetter) {
    if (value >= goal) return 'good'
    if (value >= alert) return 'warn'
    return 'bad'
  }
  if (value <= goal) return 'good'
  if (value < alert) return 'warn'
  return 'bad'
}

/* ------------------------------------------------------------------ */
/* Tổng quan Nhân viên — 4 chỉ số cá nhân theo kỳ tự chọn               */
/* Xem docs/THIET-KE-HE-THONG.md mục 5 để biết định nghĩa chi tiết.     */
/* ------------------------------------------------------------------ */

export type StatPeriod = 'week' | 'month' | 'season'

export interface PeriodRange {
  period: StatPeriod
  from: string
  to: string
  label: string
}

export function periodRange(period: StatPeriod, anchor: string): PeriodRange {
  if (period === 'week') {
    const from = weekStartOf(anchor)
    const to = addDays(from, 6)
    return { period, from, to, label: `Tuần ${formatDateLong(from)} – ${formatDateLong(to)}` }
  }
  if (period === 'month') {
    const d = parseISODate(anchor)
    const from = toISODate(new Date(d.getFullYear(), d.getMonth(), 1))
    const to = toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0))
    return { period, from, to, label: `Tháng ${d.getMonth() + 1}/${d.getFullYear()}` }
  }
  return {
    period,
    from: PROJECT_START_DATE,
    to: anchor,
    label: `Từ đầu mùa (${formatDateLong(PROJECT_START_DATE)})`,
  }
}

export interface PersonalCounters extends PeriodRange {
  /** Số ca đi trễ (trễ nhẹ + trễ nặng gộp lại). */
  late: number
  /** Số ca nghỉ CÓ báo trước. */
  excusedAbsence: number
  /** Số ca báo KHÔNG phép (không báo trước). */
  unauthorizedAbsence: number
  /** Số ca đã đổi chủ — gồm cả ca đã nhả thành công lẫn ca đã nhận từ người khác. */
  swapCount: number
  totalShifts: number
}

export function computePersonalCounters(
  data: AppData,
  memberId: string,
  period: StatPeriod,
): PersonalCounters {
  const range = periodRange(period, today())
  const { from, to } = range

  const mine = data.assignments.filter((a) => {
    if (a.memberId !== memberId) return false
    const { date } = parseShiftId(a.shiftId)
    return date >= from && date <= to
  })

  const late = mine.filter((a) => a.attendance === 'late_minor' || a.attendance === 'late_major').length
  const excusedAbsence = mine.filter((a) => a.attendance === 'absent_notified').length
  const unauthorizedAbsence = mine.filter((a) => a.attendance === 'absent_no_notice').length
  const pickedUp = mine.filter((a) => a.pickedUp).length

  const released = data.swaps.filter((sw) => {
    if (sw.fromMemberId !== memberId) return false
    if (sw.status !== 'matched' && sw.status !== 'approved') return false
    const a = data.assignments.find((x) => x.id === sw.assignmentId)
    if (!a) return false
    const { date } = parseShiftId(a.shiftId)
    return date >= from && date <= to
  }).length

  return {
    ...range,
    late,
    excusedAbsence,
    unauthorizedAbsence,
    swapCount: pickedUp + released,
    totalShifts: mine.length,
  }
}
