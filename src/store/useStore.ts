import { create } from 'zustand'
import type { AppData, Assignment, AttendanceStatus, LogEntry, Member, SwapRequest } from '../types'
import { clearSession, db, loadOrSeed, readSession, resetToSeed, saveSession } from '../lib/db'
import { runScheduler, standbyPoolFor } from '../lib/scheduler'
import { computeBurden } from '../lib/metrics'
import { PICKUP_BONUS, RELIABILITY_DELTA, SHIFT_MAP } from '../data/config'
import {
  addDays,
  clamp,
  dowOf,
  parseShiftId,
  shiftId as makeShiftId,
  slotKey,
  uid,
  weekStartOf,
} from '../lib/utils'

export interface Toast {
  id: string
  kind: 'success' | 'error' | 'info'
  title: string
  desc?: string
}

const EMPTY: AppData = {
  version: 1,
  members: [],
  availability: [],
  shifts: [],
  assignments: [],
  swaps: [],
  events: [],
  logs: [],
}

interface Store {
  ready: boolean
  data: AppData
  userId: string | null
  toasts: Toast[]

  init: () => Promise<void>
  persist: () => void

  /* Xác thực */
  login: (email: string, password: string) => { ok: boolean; error?: string }
  logout: () => void
  currentUser: () => Member | null
  isManager: () => boolean

  /* Giao diện */
  toast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
  log: (kind: LogEntry['kind'], text: string, memberId?: string) => void
  resetDemo: () => Promise<void>

  /* Lịch rảnh */
  saveAvailability: (memberId: string, weekStart: string, slots: string[], note: string) => void

  /* Xếp lịch */
  generateWeek: (weekStart: string) => ReturnType<typeof runScheduler>
  publishWeek: (weekStart: string) => void
  clearWeek: (weekStart: string) => void

  /* Xác nhận D-1 */
  confirmAssignment: (assignmentId: string) => void
  declineAssignment: (assignmentId: string, reason: string) => void

  /* Đổi ca & dự bị */
  standbyPool: (date: string, code: string) => Member[]
  claimShift: (shiftId: string, memberId: string, swapId?: string) => void
  requestSwap: (assignmentId: string, reason: string) => void
  resolveSwap: (swapId: string, status: 'approved' | 'rejected' | 'cancelled') => void

  /* Điểm danh */
  setAttendance: (assignmentId: string, status: AttendanceStatus) => void

  /* Điểm bán ngoài */
  applyToEvent: (eventId: string, memberId: string) => void
  withdrawFromEvent: (eventId: string, memberId: string) => void
  setEventSelection: (eventId: string, selected: string[], standby: string[]) => void
  lockEvent: (eventId: string) => void
}

export const useStore = create<Store>((set, get) => ({
  ready: false,
  data: EMPTY,
  userId: null,
  toasts: [],

  async init() {
    const data = await loadOrSeed()
    const sid = readSession()
    const valid = sid && data.members.some((m) => m.id === sid) ? sid : null
    set({ data, userId: valid, ready: true })
  },

  persist() {
    void db.save(get().data)
  },

  /* ---------------------------------------------------------------- */
  login(email, password) {
    const data = get().data
    const m = data.members.find(
      (x) => x.email.toLowerCase() === email.trim().toLowerCase() && x.active,
    )
    if (!m) return { ok: false, error: 'Không tìm thấy tài khoản với email này.' }
    if (m.password !== password) return { ok: false, error: 'Mật khẩu chưa đúng.' }
    saveSession(m.id)
    set({ userId: m.id })
    return { ok: true }
  },

  logout() {
    clearSession()
    set({ userId: null })
  },

  currentUser() {
    const { data, userId } = get()
    return data.members.find((m) => m.id === userId) ?? null
  },

  isManager() {
    const u = get().currentUser()
    return u?.role === 'admin' || u?.role === 'coordinator'
  },

  /* ---------------------------------------------------------------- */
  toast(t) {
    const id = uid('t')
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }))
    setTimeout(() => get().dismissToast(id), 4200)
  },

  dismissToast(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },

  log(kind, text, memberId) {
    set((s) => ({
      data: {
        ...s.data,
        logs: [
          { id: uid('lg'), at: new Date().toISOString(), kind, text, memberId },
          ...s.data.logs,
        ].slice(0, 80),
      },
    }))
  },

  async resetDemo() {
    const data = await resetToSeed()
    set({ data })
    get().toast({ kind: 'info', title: 'Đã khôi phục dữ liệu mẫu' })
  },

  /* ---------------------------------------------------------------- */
  saveAvailability(memberId, weekStart, slots, note) {
    set((s) => {
      const rest = s.data.availability.filter(
        (a) => !(a.memberId === memberId && a.weekStart === weekStart),
      )
      return {
        data: {
          ...s.data,
          availability: [
            ...rest,
            { memberId, weekStart, slots, note, updatedAt: new Date().toISOString(), submitted: true },
          ],
        },
      }
    })
    get().persist()
    get().toast({
      kind: 'success',
      title: 'Đã lưu lịch rảnh',
      desc: `${slots.length} khung giờ cho tuần ${weekStart}.`,
    })
  },

  /* ---------------------------------------------------------------- */
  generateWeek(weekStart) {
    const { data } = get()
    const prevWeek = addDays(weekStart, -7)

    // Ca của tuần trước, phục vụ ràng buộc mềm S3 (xoay vòng ca)
    const lastWeekSlots: Record<string, Set<string>> = {}
    for (const s of data.shifts.filter((x) => weekStartOf(x.date) === prevWeek)) {
      for (const a of data.assignments.filter((x) => x.shiftId === s.id)) {
        if (!lastWeekSlots[a.memberId]) lastWeekSlots[a.memberId] = new Set()
        lastWeekSlots[a.memberId].add(slotKey(dowOf(s.date), s.code))
      }
    }

    const result = runScheduler({
      weekStart,
      members: data.members,
      availability: data.availability,
      events: data.events,
      priorBurden: computeBurden(data, prevWeek),
      lastWeekSlots,
    })

    const keepShiftIds = new Set(
      data.shifts.filter((s) => weekStartOf(s.date) === weekStart).map((s) => s.id),
    )

    set((s) => ({
      data: {
        ...s.data,
        shifts: [
          ...s.data.shifts.filter((x) => weekStartOf(x.date) !== weekStart),
          ...result.shifts,
        ],
        assignments: [
          ...s.data.assignments.filter((a) => !keepShiftIds.has(a.shiftId)),
          ...result.assignments,
        ],
      },
    }))
    get().persist()
    get().log(
      result.gaps.length ? 'warn' : 'success',
      `Đã xếp lịch nháp tuần ${weekStart}: ${result.shifts.length} ca, ${result.assignments.length} lượt phân công, ${result.gaps.length} ca còn hở.`,
    )
    return result
  },

  publishWeek(weekStart) {
    set((s) => ({
      data: {
        ...s.data,
        shifts: s.data.shifts.map((x) =>
          weekStartOf(x.date) === weekStart ? { ...x, status: 'published' } : x,
        ),
      },
    }))
    get().persist()
    get().log('success', `Đã công bố lịch trực tuần ${weekStart} tới toàn bộ thành viên.`)
    get().toast({
      kind: 'success',
      title: 'Đã công bố lịch tuần',
      desc: 'Thành viên có thể xem lịch và bắt đầu xác nhận ca.',
    })
  },

  clearWeek(weekStart) {
    const ids = new Set(
      get().data.shifts.filter((s) => weekStartOf(s.date) === weekStart).map((s) => s.id),
    )
    set((s) => ({
      data: {
        ...s.data,
        shifts: s.data.shifts.filter((x) => weekStartOf(x.date) !== weekStart),
        assignments: s.data.assignments.filter((a) => !ids.has(a.shiftId)),
      },
    }))
    get().persist()
    get().toast({ kind: 'info', title: 'Đã xoá lịch nháp của tuần này' })
  },

  /* ---------------------------------------------------------------- */
  confirmAssignment(assignmentId) {
    set((s) => ({
      data: {
        ...s.data,
        assignments: s.data.assignments.map((a) =>
          a.id === assignmentId ? { ...a, confirmStatus: 'confirmed' } : a,
        ),
      },
    }))
    get().persist()
    get().toast({ kind: 'success', title: 'Đã xác nhận ca', desc: 'Hẹn gặp bạn ở Phòng Thanh niên!' })
  },

  declineAssignment(assignmentId, reason) {
    const a = get().data.assignments.find((x) => x.id === assignmentId)
    if (!a) return
    const member = get().data.members.find((m) => m.id === a.memberId)

    set((s) => ({
      data: {
        ...s.data,
        assignments: s.data.assignments.map((x) =>
          x.id === assignmentId
            ? { ...x, confirmStatus: 'declined', declineReason: reason }
            : x,
        ),
        swaps: [
          {
            id: uid('sw'),
            type: 'release' as const,
            assignmentId,
            fromMemberId: a.memberId,
            reason,
            status: 'open' as const,
            createdAt: new Date().toISOString(),
          },
          ...s.data.swaps,
        ],
      },
    }))
    get().persist()

    const { date, code } = parseShiftId(a.shiftId)
    const pool = get().standbyPool(date, code)
    get().log(
      'warn',
      `${member?.name ?? 'Thành viên'} báo không trực được ca ${code} ngày ${date}. Đã mở cho ${pool.length} người dự bị.`,
      a.memberId,
    )
    get().toast({
      kind: 'info',
      title: 'Đã ghi nhận — không có hệ quả tiêu cực',
      desc: `Ca đã được mở cho ${pool.length} người dự bị rảnh khung giờ này.`,
    })
  },

  /* ---------------------------------------------------------------- */
  standbyPool(date, code) {
    const { data } = get()
    return standbyPoolFor(
      date,
      code,
      data.members,
      data.availability,
      data.assignments,
      data.shifts,
      data.events,
      weekStartOf(date),
    )
  },

  claimShift(shiftId, memberId, swapId) {
    const { data } = get()
    const shift = data.shifts.find((s) => s.id === shiftId)
    if (!shift) return
    const def = SHIFT_MAP[shift.code]
    const member = data.members.find((m) => m.id === memberId)
    if (!member) return

    const already = data.assignments.some(
      (a) => a.shiftId === shiftId && a.memberId === memberId && a.confirmStatus !== 'declined',
    )
    if (already) {
      get().toast({ kind: 'error', title: 'Bạn đã có mặt trong ca này rồi' })
      return
    }

    const newAssignment: Assignment = {
      id: uid('as'),
      shiftId,
      memberId,
      isLead: false,
      isStandby: false,
      confirmStatus: 'confirmed',
      attendance: 'none',
      pickedUp: true,
    }

    set((s) => ({
      data: {
        ...s.data,
        assignments: [...s.data.assignments, newAssignment],
        members: s.data.members.map((m) =>
          m.id === memberId && m.staff
            ? { ...m, staff: { ...m.staff, reliability: clamp(m.staff.reliability + PICKUP_BONUS, 0, 100) } }
            : m,
        ),
        swaps: swapId
          ? s.data.swaps.map((w) =>
              w.id === swapId
                ? { ...w, status: 'matched', toMemberId: memberId, resolvedAt: new Date().toISOString() }
                : w,
            )
          : s.data.swaps,
      },
    }))
    get().persist()
    get().log(
      'success',
      `${member.name} đã nhận ca ${def?.code ?? shift.code} ngày ${shift.date} từ danh sách dự bị (+${PICKUP_BONUS} điểm uy tín).`,
      memberId,
    )
    get().toast({
      kind: 'success',
      title: 'Đã nhận ca — cảm ơn bạn!',
      desc: `+${PICKUP_BONUS} điểm uy tín. Ca đã được lấp đầy.`,
    })
  },

  requestSwap(assignmentId, reason) {
    const a = get().data.assignments.find((x) => x.id === assignmentId)
    if (!a) return
    set((s) => ({
      data: {
        ...s.data,
        swaps: [
          {
            id: uid('sw'),
            type: 'release' as const,
            assignmentId,
            fromMemberId: a.memberId,
            reason,
            status: 'open' as const,
            createdAt: new Date().toISOString(),
          },
          ...s.data.swaps,
        ],
      },
    }))
    get().persist()
    get().toast({
      kind: 'success',
      title: 'Đã đăng lên chợ ca',
      desc: 'Bạn vẫn giữ trách nhiệm ca này cho tới khi có người bấm nhận.',
    })
  },

  resolveSwap(swapId, status) {
    set((s) => ({
      data: {
        ...s.data,
        swaps: s.data.swaps.map((w) =>
          w.id === swapId ? { ...w, status, resolvedAt: new Date().toISOString() } : w,
        ),
      },
    }))
    get().persist()
  },

  /* ---------------------------------------------------------------- */
  setAttendance(assignmentId, status) {
    const a = get().data.assignments.find((x) => x.id === assignmentId)
    if (!a) return
    const prevDelta = RELIABILITY_DELTA[a.attendance] ?? 0
    const nextDelta = RELIABILITY_DELTA[status] ?? 0

    set((s) => ({
      data: {
        ...s.data,
        assignments: s.data.assignments.map((x) =>
          x.id === assignmentId
            ? {
                ...x,
                attendance: status,
                checkInAt: status === 'ontime' || status.startsWith('late') ? new Date().toISOString() : undefined,
              }
            : x,
        ),
        members: s.data.members.map((m) =>
          m.id === a.memberId && m.staff
            ? { ...m, staff: { ...m.staff, reliability: clamp(m.staff.reliability - prevDelta + nextDelta, 0, 100) } }
            : m,
        ),
      },
    }))
    get().persist()

    if (status === 'absent_no_notice') {
      const member = get().data.members.find((m) => m.id === a.memberId)
      get().log('danger', `Ghi nhận vắng không báo trước: ${member?.name ?? ''}. Kích hoạt thang hệ quả khôi phục — bước 1: trò chuyện riêng để hỏi nguyên nhân.`, a.memberId)
    }
  },

  /* ---------------------------------------------------------------- */
  applyToEvent(eventId, memberId) {
    set((s) => ({
      data: {
        ...s.data,
        events: s.data.events.map((e) =>
          e.id === eventId && !e.applicants.includes(memberId)
            ? { ...e, applicants: [...e.applicants, memberId] }
            : e,
        ),
      },
    }))
    get().persist()
    get().toast({ kind: 'success', title: 'Đã đăng ký nguyện vọng' })
  },

  withdrawFromEvent(eventId, memberId) {
    set((s) => ({
      data: {
        ...s.data,
        events: s.data.events.map((e) =>
          e.id === eventId
            ? {
                ...e,
                applicants: e.applicants.filter((x) => x !== memberId),
                selected: e.selected.filter((x) => x !== memberId),
                standby: e.standby.filter((x) => x !== memberId),
              }
            : e,
        ),
      },
    }))
    get().persist()
    get().toast({ kind: 'info', title: 'Đã rút đăng ký' })
  },

  setEventSelection(eventId, selected, standby) {
    set((s) => ({
      data: {
        ...s.data,
        events: s.data.events.map((e) => (e.id === eventId ? { ...e, selected, standby } : e)),
      },
    }))
    get().persist()
  },

  /**
   * Chốt danh sách điểm bán ngoài → thực thi ràng buộc cứng H3:
   * mọi ca trực phòng trùng giờ (kèm đệm di chuyển) bị gỡ và đẩy sang chợ ca.
   */
  lockEvent(eventId) {
    const { data } = get()
    const ev = data.events.find((e) => e.id === eventId)
    if (!ev) return

    const released: { memberId: string; shiftId: string }[] = []
    const keptAssignments: Assignment[] = []
    const newSwaps: SwapRequest[] = []

    for (const a of data.assignments) {
      const { date, code } = parseShiftId(a.shiftId)
      const def = SHIFT_MAP[code]
      if (!def || date !== ev.date || !ev.selected.includes(a.memberId)) {
        keptAssignments.push(a)
        continue
      }
      const evStart = toMin(ev.start) - 60
      const evEnd = toMin(ev.end) + 60
      const clash = toMin(def.start) < evEnd && evStart < toMin(def.end)
      if (!clash) {
        keptAssignments.push(a)
        continue
      }
      released.push({ memberId: a.memberId, shiftId: a.shiftId })
      newSwaps.push({
        id: uid('sw'),
        type: 'release' as const,
        assignmentId: a.id,
        fromMemberId: a.memberId,
        reason: `Trùng lịch điểm bán ngoài: ${ev.name}`,
        status: 'open' as const,
        createdAt: new Date().toISOString(),
      })
      keptAssignments.push({ ...a, confirmStatus: 'declined', declineReason: 'Đi điểm bán ngoài' })
    }

    set((s) => ({
      data: {
        ...s.data,
        assignments: keptAssignments,
        swaps: [...newSwaps, ...s.data.swaps],
        events: s.data.events.map((e) => (e.id === eventId ? { ...e, status: 'locked' } : e)),
      },
    }))
    get().persist()
    get().log(
      released.length ? 'warn' : 'success',
      released.length
        ? `Đã chốt "${ev.name}". Hệ thống tự khoá ${released.length} ca trực phòng bị trùng và đẩy sang chợ ca.`
        : `Đã chốt "${ev.name}". Không có xung đột nào với lịch trực phòng.`,
    )
    get().toast({
      kind: released.length ? 'info' : 'success',
      title: 'Đã chốt danh sách & khoá lịch',
      desc: released.length
        ? `${released.length} ca trực phòng bị trùng đã được tự động chuyển sang chợ ca.`
        : 'Không phát hiện xung đột giữa hai kênh bán.',
    })
  },
}))

function toMin(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/* Vài selector tiện dụng */
export const useUser = () => useStore((s) => s.data.members.find((m) => m.id === s.userId) ?? null)
export const useData = () => useStore((s) => s.data)
export const useMemberMap = () =>
  useStore((s) => Object.fromEntries(s.data.members.map((m) => [m.id, m])) as Record<string, Member>)

export function shiftIdOf(date: string, code: string) {
  return makeShiftId(date, code)
}
