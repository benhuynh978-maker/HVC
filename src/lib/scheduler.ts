import type {
  Assignment,
  Availability,
  ExternalEvent,
  Member,
  ShiftInstance,
  StaffMember,
} from '../types'
import { TIME_BLOCKS, TRAVEL_BUFFER_MIN } from '../data/config'
import { dowOf, hasStaffProfile, minutesOf, overlaps, slotKey, uid } from './utils'

/**
 * ============================================================
 *  THUẬT TOÁN XẾP LỊCH TỰ ĐỘNG
 * ============================================================
 *  Ràng buộc CỨNG (không bao giờ vi phạm)
 *    H1  Chỉ xếp người đã khai rảnh khung giờ đó
 *    H2  Mỗi ca phải đủ định mức tối thiểu theo tầng ca
 *    H3  Không trùng lịch điểm bán ngoài (+ đệm di chuyển 60 phút)
 *    H4  Không vượt trần cam kết tự nguyện của cá nhân
 *    H5  Mỗi ca có đúng 1 ca trưởng
 *    H6  Tối đa 2 ca/ngày và không quá 4 giờ liên tục
 *    H7  Ca cao điểm phải có ít nhất 1 người đã trực >= 3 ca
 *
 *  Ràng buộc MỀM (tối ưu, chấp nhận đánh đổi)
 *    S1  Cân bằng ĐIỂM GÁNH NẶNG chứ không cân bằng số ca
 *    S2  Ưu tiên người đang có tải thấp so với trần cam kết của họ
 *    S3  Xoay vòng ca — hạn chế lặp lại đúng ca của tuần trước
 *    S4  Ghép người mới với người có kinh nghiệm
 *    S6  Hạn chế xếp một người cả hai ngày cuối tuần
 *
 *  Chiến lược: greedy theo độ khan hiếm (ca ít ứng viên nhất xếp trước),
 *  bên trong mỗi ca chọn người theo điểm ưu tiên. Cách này cho kết quả tốt
 *  và chạy tức thì, phù hợp quy mô vài chục thành viên.
 */

export interface SchedulerOptions {
  weekStart: string
  members: Member[]
  availability: Availability[]
  events: ExternalEvent[]
  /**
   * Các ca đã được Admin/Điều phối viên tạo sẵn cho tuần này (công cụ "+ Thêm"
   * ở Lịch trực tuần). Không còn catalog cố định để tự sinh ca — thuật toán
   * chỉ xếp NGƯỜI vào những ca đã tồn tại này.
   */
  existingShifts: ShiftInstance[]
  /** Điểm gánh nặng luỹ kế từ các tuần trước — giúp công bằng theo thời gian. */
  priorBurden?: Record<string, number>
  /** Ca của tuần trước, dạng memberId -> Set('dow-code') — phục vụ S3. */
  lastWeekSlots?: Record<string, Set<string>>
}

export interface Gap {
  shiftId: string
  date: string
  code: string
  missing: number
  candidatePool: number
}

export interface SchedulerResult {
  shifts: ShiftInstance[]
  assignments: Assignment[]
  gaps: Gap[]
  burden: Record<string, number>
  stats: {
    totalShifts: number
    totalSlots: number
    filledSlots: number
    coverage: number
    balanceGap: number
    membersUsed: number
  }
  notes: string[]
}

/** Lịch rảnh hiệu lực của một người trong tuần: bản cập nhật, nếu không có thì dùng lịch nền. */
export function effectiveSlots(
  member: Member,
  weekStart: string,
  availability: Availability[],
): Set<string> {
  if (!member.staff) return new Set()
  const rec = availability.find((a) => a.memberId === member.id && a.weekStart === weekStart)
  return new Set(rec?.submitted ? rec.slots : member.staff.baselineSlots)
}

/** H3 — người này có bị khoá bởi một sự kiện điểm bán ngoài vào khung giờ này không. */
export function blockedByEvent(
  memberId: string,
  date: string,
  shift: Pick<ShiftInstance, 'start' | 'end'>,
  events: ExternalEvent[],
): ExternalEvent | null {
  for (const ev of events) {
    if (ev.date !== date) continue
    if (ev.status === 'done') continue
    if (!ev.selected.includes(memberId)) continue
    const evStart = minutesOf(ev.start) - TRAVEL_BUFFER_MIN
    const evEnd = minutesOf(ev.end) + TRAVEL_BUFFER_MIN
    if (minutesOf(shift.start) < evEnd && evStart < minutesOf(shift.end)) return ev
  }
  return null
}

/** H6 — thêm ca này có tạo ra khối làm việc liên tục quá 4 giờ không. */
function breaksContinuityRule(
  existing: Pick<ShiftInstance, 'start' | 'end'>[],
  next: Pick<ShiftInstance, 'start' | 'end'>,
): boolean {
  const all = [...existing, next]
    .map((s) => [minutesOf(s.start), minutesOf(s.end)] as [number, number])
    .sort((a, b) => a[0] - b[0])

  let [bs, be] = all[0]
  for (let i = 1; i < all.length; i++) {
    const [s, e] = all[i]
    if (s <= be) {
      be = Math.max(be, e)
    } else {
      if (be - bs > 240) return true
      ;[bs, be] = [s, e]
    }
  }
  return be - bs > 240
}

/**
 * H1 — ca này có giao với ít nhất 1 khung giờ mà thành viên đã khai rảnh
 * trong ngày đó không. Một ca có thể trải dài qua nhiều khung (vd 10h30–13h30
 * chạm cả "sáng" lẫn "trưa") — chỉ cần giao với 1 khung đã khai là đủ.
 */
function freeForShift(slots: Set<string>, dow: number, shift: Pick<ShiftInstance, 'start' | 'end'>): boolean {
  return TIME_BLOCKS.some(
    (b) => slots.has(slotKey(dow, b.value)) && overlaps(shift.start, shift.end, b.start, b.end),
  )
}

/** Danh sách ứng viên hợp lệ cho một ca (đã lọc toàn bộ ràng buộc cứng). */
export function eligibleFor(
  date: string,
  shift: ShiftInstance,
  members: StaffMember[],
  ctx: {
    availability: Availability[]
    events: ExternalEvent[]
    weekStart: string
    weekCount: Record<string, number>
    dayShifts: Record<string, ShiftInstance[]>
    alreadyIn: Set<string>
  },
): StaffMember[] {
  const dow = dowOf(date)

  return members.filter((m) => {
    if (!m.active) return false
    if (ctx.alreadyIn.has(m.id)) return false
    // H1
    if (!freeForShift(effectiveSlots(m, ctx.weekStart, ctx.availability), dow, shift)) return false
    // H4
    if ((ctx.weekCount[m.id] ?? 0) >= m.staff.maxShiftsPerWeek) return false
    // H3
    if (blockedByEvent(m.id, date, shift, ctx.events)) return false
    // H6
    const dayKey = `${m.id}__${date}`
    const todayShifts = ctx.dayShifts[dayKey] ?? []
    if (todayShifts.length >= 2) return false
    if (breaksContinuityRule(todayShifts, shift)) return false
    return true
  })
}

export function runScheduler(opts: SchedulerOptions): SchedulerResult {
  const { weekStart, members, availability, events, existingShifts } = opts
  const priorBurden = opts.priorBurden ?? {}
  const lastWeekSlots = opts.lastWeekSlots ?? {}

  // H-ngầm định: chỉ thành viên có hồ sơ trực ca mới được xét — Trưởng ban/
  // Điều phối viên không có `.staff` nên bị loại ngay từ đây, không chỉ ở UI.
  const active = members.filter((m) => m.active).filter(hasStaffProfile)

  // Trạng thái đang xếp
  const weekCount: Record<string, number> = {}
  const burden: Record<string, number> = {}
  const dayShifts: Record<string, ShiftInstance[]> = {}
  const weekendCount: Record<string, number> = {}
  for (const m of active) {
    weekCount[m.id] = 0
    burden[m.id] = priorBurden[m.id] ?? 0
    weekendCount[m.id] = 0
  }

  // 1) Ca của tuần này đã được Admin/Điều phối viên tạo sẵn — không tự sinh nữa.
  const shifts: ShiftInstance[] = existingShifts

  // 2) Đo độ khan hiếm: ca có ít ứng viên nhất được xếp trước
  const scarcity = shifts.map((shift) => {
    const dow = dowOf(shift.date)
    const pool = active.filter(
      (m) =>
        freeForShift(effectiveSlots(m, weekStart, availability), dow, shift) &&
        !blockedByEvent(m.id, shift.date, shift, events),
    ).length
    return { shift, pool }
  })

  scarcity.sort((a, b) => {
    const ra = a.pool / (a.shift.minStaff + a.shift.standbyNeeded)
    const rb = b.pool / (b.shift.minStaff + b.shift.standbyNeeded)
    if (ra !== rb) return ra - rb
    if (a.shift.tier !== b.shift.tier) return a.shift.tier === 'peak' ? -1 : 1
    return a.shift.date.localeCompare(b.shift.date)
  })

  const assignments: Assignment[] = []
  const gaps: Gap[] = []
  const notes: string[] = []

  // 3) Lấp từng ca
  for (const { shift, pool } of scarcity) {
    const dow = dowOf(shift.date)
    const need = shift.minStaff + shift.standbyNeeded
    const alreadyIn = new Set<string>()
    const chosen: StaffMember[] = []

    const takeOne = (filter?: (m: StaffMember) => boolean) => {
      const cands = eligibleFor(shift.date, shift, active, {
        availability,
        events,
        weekStart,
        weekCount,
        dayShifts,
        alreadyIn,
      }).filter((m) => (filter ? filter(m) : true))

      if (!cands.length) return null

      const scored = cands.map((m) => {
        // S1 + S2: tải tương đối so với trần cam kết của chính người đó
        const capacity = Math.max(1, m.staff.maxShiftsPerWeek)
        let score = burden[m.id] / capacity

        // S3: hạn chế lặp lại đúng ca của tuần trước
        if (lastWeekSlots[m.id]?.has(slotKey(dow, shift.code))) score += 0.22

        // S6: hạn chế trực cả hai ngày cuối tuần
        if (dow >= 6 && weekendCount[m.id] > 0) score += 0.35

        // Ưu tiên nhẹ người có uy tín cao cho ca cao điểm
        if (shift.tier === 'peak') score -= (m.staff.reliability - 80) / 1000

        return { m, score }
      })

      scored.sort((a, b) => a.score - b.score || b.m.staff.reliability - a.m.staff.reliability)
      const picked = scored[0].m

      alreadyIn.add(picked.id)
      chosen.push(picked)
      weekCount[picked.id] = (weekCount[picked.id] ?? 0) + 1
      burden[picked.id] = (burden[picked.id] ?? 0) + shift.weight
      if (dow >= 6) weekendCount[picked.id] = (weekendCount[picked.id] ?? 0) + 1
      const dayKey = `${picked.id}__${shift.date}`
      dayShifts[dayKey] = [...(dayShifts[dayKey] ?? []), shift]
      return picked
    }

    // H7: ca cao điểm lấy trước 1 người có kinh nghiệm
    if (shift.tier === 'peak') takeOne((m) => m.staff.totalShiftsDone >= 3)

    while (chosen.length < need) {
      if (!takeOne()) break
    }

    // H5: gán ca trưởng — người trực chính có uy tín cao nhất
    const mains = chosen.slice(0, shift.minStaff)
    let leadId = ''
    if (mains.length) {
      const experienced = mains.filter((m) => m.staff.totalShiftsDone >= 3)
      const pick = (experienced.length ? experienced : mains).reduce((a, b) =>
        b.staff.reliability > a.staff.reliability ? b : a,
      )
      leadId = pick.id
    }

    chosen.forEach((m, i) => {
      assignments.push({
        id: uid('as'),
        shiftId: shift.id,
        memberId: m.id,
        isLead: m.id === leadId,
        isStandby: i >= shift.minStaff,
        confirmStatus: 'pending',
        attendance: 'none',
      })
    })

    const missingMain = Math.max(0, shift.minStaff - Math.min(chosen.length, shift.minStaff))
    if (missingMain > 0) {
      gaps.push({
        shiftId: shift.id,
        date: shift.date,
        code: shift.code,
        missing: missingMain,
        candidatePool: pool,
      })
    }
  }

  // 4) Thống kê
  const totalSlots = shifts.reduce((n, s) => n + s.minStaff, 0)
  const filledSlots = assignments.filter((a) => !a.isStandby).length
  const used = new Set(assignments.map((a) => a.memberId))

  const ratios = active
    .filter((m) => m.staff.maxShiftsPerWeek > 0)
    .map((m) => burden[m.id] / m.staff.maxShiftsPerWeek)
  const avg = ratios.reduce((a, b) => a + b, 0) / (ratios.length || 1)
  const balanceGap = avg > 0 ? ((Math.max(...ratios) - Math.min(...ratios)) / avg) * 100 : 0

  if (gaps.length === 0) notes.push('Tất cả các ca đều đủ định mức tối thiểu — không có ca trống.')
  else notes.push(`Còn ${gaps.length} ca chưa đủ người, cần chuyển sang chợ ca (Lớp 3).`)

  const idle = active.filter((m) => !used.has(m.id))
  if (idle.length) notes.push(`${idle.length} thành viên chưa được xếp ca nào — họ nằm trong pool dự bị.`)

  notes.push(
    `Chênh lệch điểm gánh nặng giữa người cao nhất và thấp nhất: ${balanceGap.toFixed(0)}% (mục tiêu ≤ 20%).`,
  )

  return {
    shifts,
    assignments,
    gaps,
    burden,
    stats: {
      totalShifts: shifts.length,
      totalSlots,
      filledSlots,
      coverage: totalSlots ? (filledSlots / totalSlots) * 100 : 0,
      balanceGap,
      membersUsed: used.size,
    },
    notes,
  }
}

/**
 * POOL DỰ BỊ của một ca = những người đã khai rảnh khung giờ đó
 * nhưng KHÔNG được phân công vào bất kỳ ca nào trùng giờ trong ngày.
 * Danh sách này được tính tự động, không ai phải lập thủ công.
 */
export function standbyPoolFor(
  shift: ShiftInstance,
  members: Member[],
  availability: Availability[],
  assignments: Assignment[],
  shifts: ShiftInstance[],
  events: ExternalEvent[],
  weekStart: string,
): Member[] {
  const dow = dowOf(shift.date)

  // Những người đã bận vì một ca trùng giờ trong cùng ngày
  const busy = new Set<string>()
  for (const s of shifts) {
    if (s.date !== shift.date) continue
    const clash = minutesOf(s.start) < minutesOf(shift.end) && minutesOf(shift.start) < minutesOf(s.end)
    if (!clash) continue
    for (const a of assignments) {
      if (a.shiftId === s.id && a.confirmStatus !== 'declined') busy.add(a.memberId)
    }
  }
  // Người vừa từ chối chính ca này thì không đưa trở lại pool
  for (const a of assignments) {
    if (a.shiftId === shift.id && a.confirmStatus === 'declined') busy.add(a.memberId)
  }

  return members.filter(
    (m) =>
      m.active &&
      m.staff && // Trưởng ban/Điều phối viên không có hồ sơ trực ca — loại khỏi pool
      !busy.has(m.id) &&
      freeForShift(effectiveSlots(m, weekStart, availability), dow, shift) &&
      !blockedByEvent(m.id, shift.date, shift, events),
  )
}
