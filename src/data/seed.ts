import type {
  AppData,
  Availability,
  AttendanceStatus,
  ExternalEvent,
  Member,
  MemberGroup,
  Skill,
} from '../types'
import { SHIFTS, SHIFT_MAP } from './config'
import { runScheduler } from '../lib/scheduler'
import {
  addDays,
  dowOf,
  hasStaffProfile,
  makeRng,
  parseShiftId,
  pickSome,
  slotKey,
  today,
  uid,
  weekStartOf,
} from '../lib/utils'

/**
 * Dữ liệu mẫu — đủ giống thật để mọi màn hình đều có nội dung ngay khi mở lần đầu:
 *  · tuần trước  : đã trực xong, có đầy đủ dữ liệu điểm danh
 *  · tuần này    : đã công bố, các ngày đã qua có điểm danh, ngày mai đang chờ xác nhận
 *  · tuần sau    : CHƯA xếp — để người dùng tự bấm "Xếp lịch tự động" và xem thuật toán chạy
 */

const NAMES: [string, MemberGroup, string][] = [
  ['Nguyễn Minh Anh', 'SV', 'ĐH Sư phạm'],
  ['Trần Bảo Ngọc', 'HS', '11A1'],
  ['Lê Hoàng Khoa', 'HS', '11A2'],
  ['Phạm Thuỳ Lan', 'HS', '10A3'],
  ['Vũ Đức Tuấn', 'SV', 'ĐH Bách khoa'],
  ['Đặng Hà My', 'HS', '12A1'],
  ['Bùi Quang Duy', 'HS', '11B2'],
  ['Hoàng Thảo Vy', 'HS', '10A1'],
  ['Ngô Gia Phúc', 'HS', '12A4'],
  ['Đỗ Thanh Linh', 'HS', '11A5'],
  ['Lý Nam Sơn', 'SV', 'ĐH Kinh tế'],
  ['Phan Kim Thảo', 'HS', '10A2'],
  ['Trịnh Hoài An', 'HS', '11A3'],
  ['Dương Nhật Huy', 'HS', '12A2'],
  ['Cao Mỹ Duyên', 'HS', '10A4'],
  ['Đinh Trọng Nghĩa', 'DL', 'Cựu HV'],
  ['Tạ Khánh Vân', 'HS', '11A1'],
  ['Mai Tiến Đạt', 'HS', '12A3'],
  ['Chu Bích Hạnh', 'SV', 'ĐH Ngoại thương'],
  ['Hồ Minh Quân', 'HS', '10A5'],
  ['Lâm Yến Nhi', 'HS', '11B1'],
  ['Võ Anh Kiệt', 'HS', '12A5'],
  ['Trương Diệu Linh', 'HS', '10A1'],
  ['Nguyễn Bá Lộc', 'DL', 'Cựu HV'],
  ['Phùng Thu Trang', 'HS', '11A4'],
  ['Đoàn Hữu Thắng', 'HS', '12B1'],
  ['Huỳnh Ái Vy', 'HS', '10A3'],
  ['Lương Chí Bảo', 'SV', 'ĐH Y Dược'],
  ['Tô Ngọc Mai', 'HS', '11A2'],
  ['Kiều Đăng Khôi', 'HS', '12A1'],
  ['Nguyễn Hải Yến', 'HS', '10A2'],
  ['Trần Sỹ Nguyên', 'DL', 'Cựu HV'],
  ['Đỗ Hồng Nhung', 'HS', '11B3'],
  ['Phạm Gia Hân', 'HS', '10A4'],
]

const ALL_SKILLS: Skill[] = ['cashier', 'sales', 'logistics', 'media']

function slugEmail(name: string, i: number) {
  const noAccent = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
  const parts = noAccent.split(/\s+/)
  const last = parts[parts.length - 1]
  const initialsPart = parts.slice(0, -1).map((p) => p[0]).join('')
  return `${last}${initialsPart}${i === 0 ? '' : ''}@hvc.vn`
}

/** Sinh lịch rảnh nền theo nhóm đối tượng — mỗi nhóm có nhịp sinh hoạt khác nhau. */
function baselineFor(group: MemberGroup, cap: number, rnd: () => number): string[] {
  const weekdayPeak = ['A', 'C', 'D', 'F']
  const weekdayLow = ['B', 'E']
  const weekendCodes = ['W1', 'W2', 'W3']
  const slots = new Set<string>()

  const target = Math.max(4, Math.round(cap * 2.4)) // quy tắc "khai gấp đôi"

  const pools: { dow: number; code: string; w: number }[] = []
  for (let dow = 1; dow <= 5; dow++) {
    for (const c of weekdayPeak) {
      const w = group === 'HS' ? 1 : group === 'SV' ? 0.5 : 0.15
      pools.push({ dow, code: c, w: c === 'A' ? w * 0.6 : w })
    }
    for (const c of weekdayLow) {
      const w = group === 'HS' ? 0.35 : group === 'SV' ? 1 : 0.2
      pools.push({ dow, code: c, w })
    }
  }
  for (const dow of [6, 7]) {
    for (const c of weekendCodes) {
      const w = group === 'DL' ? 1.4 : group === 'SV' ? 0.8 : 0.55
      pools.push({ dow, code: c, w })
    }
  }

  let guard = 0
  while (slots.size < target && guard++ < 600) {
    const p = pools[Math.floor(rnd() * pools.length)]
    if (rnd() < p.w * 0.55) slots.add(slotKey(p.dow, p.code))
  }
  return [...slots]
}

function buildMembers(): Member[] {
  const rnd = makeRng(20260823)
  return NAMES.map((entry, i) => {
    const [name, group, unit] = entry
    const role = i === 0 ? 'admin' : i === 1 || i === 4 ? 'coordinator' : 'member'
    const cap = group === 'DL' ? 2 : group === 'SV' ? 3 : 2 + Math.floor(rnd() * 3)
    const done = Math.floor(rnd() * 14)

    const base: Member = {
      id: `m${String(i + 1).padStart(2, '0')}`,
      name,
      email: slugEmail(name, i),
      password: 'hvc2026',
      role,
      group,
      unit,
      phone: `09${String(10000000 + Math.floor(rnd() * 89999999)).slice(0, 8)}`,
      active: true,
      joinedAt: '2026-08-01',
    }

    // Trưởng ban / Điều phối viên không trực ca dưới bất kỳ hình thức nào —
    // không có hồ sơ trực ca, nên không khai lịch rảnh, không bị xếp ca.
    if (role !== 'member') return base

    return {
      ...base,
      staff: {
        maxShiftsPerWeek: cap,
        skills: pickSome(ALL_SKILLS, 1 + Math.floor(rnd() * 2), rnd),
        reliability: Math.round(72 + rnd() * 26),
        parentConsent: group === 'DL' || group === 'SV' ? true : rnd() > 0.25,
        canTravel: rnd() > 0.35,
        baselineSlots: baselineFor(group, cap, rnd),
        totalShiftsDone: done,
      },
    }
  })
}

function buildAvailability(members: Member[], weeks: string[]): Availability[] {
  const rnd = makeRng(77123)
  const out: Availability[] = []
  // Trưởng ban/Điều phối viên không có hồ sơ trực ca — không khai lịch rảnh.
  const staffMembers = members.filter(hasStaffProfile)
  for (const w of weeks) {
    for (const m of staffMembers) {
      // ~82% thành viên cập nhật lịch rảnh mỗi tuần (lớp rolling)
      const submitted = rnd() < 0.82
      let slots = [...m.staff.baselineSlots]
      if (submitted) {
        // Bỏ bớt vài khung do lịch học/lịch làm thay đổi, thêm lại vài khung khác
        slots = slots.filter(() => rnd() > 0.18)
        const extra = baselineFor(m.group, 1, rnd)
        for (const s of extra) if (rnd() > 0.6) slots.push(s)
        slots = [...new Set(slots)]
      }
      out.push({
        memberId: m.id,
        weekStart: w,
        slots,
        note: submitted && rnd() > 0.9 ? 'Tuần này em có bài kiểm tra, xin nhận ít ca hơn.' : '',
        updatedAt: new Date().toISOString(),
        submitted,
      })
    }
  }
  return out
}

function rollAttendance(rnd: () => number, quality: number): AttendanceStatus {
  const r = rnd()
  // quality 1 = tốt (tuần này), 0 = kém hơn (tuần trước)
  const ontime = 0.84 + quality * 0.08
  const lateMinor = ontime + 0.07
  const lateMajor = lateMinor + 0.03
  const absNoti = lateMajor + 0.035
  if (r < ontime) return 'ontime'
  if (r < lateMinor) return 'late_minor'
  if (r < lateMajor) return 'late_major'
  if (r < absNoti) return 'absent_notified'
  return 'absent_no_notice'
}

function buildEvents(thisWeek: string, nextWeek: string, members: Member[]): ExternalEvent[] {
  const eligible = members
    .filter(hasStaffProfile)
    .filter((m) => m.staff.canTravel && m.staff.parentConsent && m.staff.reliability >= 80)
  const rnd = makeRng(9911)
  const chosen = pickSome(eligible, 5, rnd).map((m) => m.id)
  const applicants = pickSome(eligible, 11, makeRng(4242)).map((m) => m.id)

  return [
    {
      id: 'ev1',
      name: 'Hội chợ Xuân — Nhà Văn hoá Thanh niên',
      location: 'Nhà Văn hoá Thanh niên, Q.1',
      date: addDays(thisWeek, 5),
      start: '08:00',
      end: '15:00',
      needed: 6,
      note: 'Gian hàng đồ ăn nhẹ + nước. Cần 1 thủ quỹ, 1 hậu cần, 4 bán hàng.',
      status: 'locked',
      applicants: [...new Set([...chosen, ...applicants])],
      selected: chosen,
      standby: pickSome(
        eligible.filter((m) => !chosen.includes(m.id)),
        2,
        makeRng(313),
      ).map((m) => m.id),
    },
    {
      id: 'ev2',
      name: 'Ngày hội CLB — Sân trường THPT Chuyên Hùng Vương',
      location: 'Sân trường (khu vực sảnh A)',
      date: addDays(nextWeek, 6),
      start: '07:30',
      end: '11:30',
      needed: 5,
      note: 'Bán tại chỗ trong khuôn viên trường, không cần di chuyển xa.',
      status: 'open',
      applicants: pickSome(eligible, 9, makeRng(555)).map((m) => m.id),
      selected: [],
      standby: [],
    },
    {
      id: 'ev3',
      name: 'Đêm nhạc gây quỹ — Sân khấu ngoài trời',
      location: 'Công viên Lê Văn Tám',
      date: addDays(nextWeek, 12),
      start: '16:00',
      end: '20:00',
      needed: 8,
      note: 'Sự kiện lớn nhất mùa. Ưu tiên thành viên có kinh nghiệm và đã có xác nhận phụ huynh.',
      status: 'open',
      applicants: pickSome(eligible, 6, makeRng(778)).map((m) => m.id),
      selected: [],
      standby: [],
    },
  ]
}

export function buildSeed(): AppData {
  const t = today()
  const tomorrowStr = addDays(t, 1)
  const thisWeek = weekStartOf(t)
  const lastWeek = addDays(thisWeek, -7)
  const nextWeek = addDays(thisWeek, 7)
  // "Ngày mai" có thể rơi sang tuần kế tiếp (khi hôm nay là Chủ nhật) nên tuần
  // kế tiếp cũng phải được công bố sẵn — nếu không cơ chế xác nhận D-1 sẽ
  // không có dữ liệu để minh hoạ. Tuần xa hơn nữa thì CHƯA xếp, để dành cho
  // người dùng tự trải nghiệm "Xếp lịch tự động".
  const futureWeek = addDays(thisWeek, 14)

  const members = buildMembers()
  const availability = buildAvailability(members, [lastWeek, thisWeek, nextWeek, futureWeek])
  const events = buildEvents(thisWeek, nextWeek, members)

  // --- Tuần trước: đã trực xong ---
  const prev = runScheduler({
    weekStart: lastWeek,
    members,
    availability,
    events,
  })
  prev.shifts.forEach((s) => (s.status = 'published'))

  const rndPrev = makeRng(101)
  prev.assignments.forEach((a) => {
    a.confirmStatus = 'confirmed'
    a.attendance = a.isStandby ? 'none' : rollAttendance(rndPrev, 0)
  })

  // --- Tuần này: đã công bố ---
  const lastWeekSlots: Record<string, Set<string>> = {}
  for (const a of prev.assignments) {
    const { date, code } = parseShiftId(a.shiftId)
    if (!lastWeekSlots[a.memberId]) lastWeekSlots[a.memberId] = new Set()
    lastWeekSlots[a.memberId].add(slotKey(dowOf(date), code))
  }

  const cur = runScheduler({
    weekStart: thisWeek,
    members,
    availability,
    events,
    priorBurden: {},
    lastWeekSlots,
  })
  cur.shifts.forEach((s) => (s.status = 'published'))

  // --- Tuần kế tiếp: cũng đã công bố (để "ngày mai" luôn có dữ liệu) ---
  const curWeekSlots: Record<string, Set<string>> = {}
  for (const s of cur.shifts) {
    for (const a of cur.assignments.filter((x) => x.shiftId === s.id)) {
      if (!curWeekSlots[a.memberId]) curWeekSlots[a.memberId] = new Set()
      curWeekSlots[a.memberId].add(slotKey(dowOf(s.date), s.code))
    }
  }

  const next = runScheduler({
    weekStart: nextWeek,
    members,
    availability,
    events,
    priorBurden: cur.burden,
    lastWeekSlots: curWeekSlots,
  })
  next.shifts.forEach((s) => (s.status = 'published'))

  const rndCur = makeRng(202)
  const applyTimelineStatus = (assignment: (typeof cur.assignments)[number]) => {
    const { date } = parseShiftId(assignment.shiftId)
    if (date < t) {
      assignment.confirmStatus = 'confirmed'
      assignment.attendance = assignment.isStandby ? 'none' : rollAttendance(rndCur, 1)
    } else if (date === t) {
      assignment.confirmStatus = 'confirmed'
      assignment.attendance = 'none'
    } else if (date === tomorrowStr) {
      // Ngày mai: mô phỏng đúng trạng thái của cơ chế xác nhận D-1
      const r = rndCur()
      assignment.confirmStatus = r < 0.55 ? 'confirmed' : r < 0.88 ? 'pending' : 'declined'
      if (assignment.confirmStatus === 'declined') assignment.declineReason = 'Trùng lịch học thêm'
      assignment.attendance = 'none'
    } else {
      assignment.confirmStatus = 'pending'
      assignment.attendance = 'none'
    }
  }
  cur.assignments.forEach(applyTimelineStatus)
  next.assignments.forEach(applyTimelineStatus)

  // --- Vài yêu cầu đổi ca đang mở ---
  const allUpcoming = [...cur.assignments, ...next.assignments]
  const swaps = allUpcoming
    .filter((a) => a.confirmStatus === 'declined')
    .slice(0, 3)
    .map((a) => ({
      id: uid('sw'),
      type: 'release' as const,
      assignmentId: a.id,
      fromMemberId: a.memberId,
      reason: a.declineReason ?? 'Bận việc cá nhân',
      status: 'open' as const,
      createdAt: new Date().toISOString(),
    }))

  const shifts = [...prev.shifts, ...cur.shifts, ...next.shifts]
  const assignments = [...prev.assignments, ...cur.assignments, ...next.assignments]

  // Cập nhật số ca đã trực để cột "kinh nghiệm" phản ánh đúng dữ liệu
  for (const m of members) {
    if (!m.staff) continue
    m.staff.totalShiftsDone += assignments.filter(
      (a) => a.memberId === m.id && a.attendance !== 'none' && a.attendance !== 'absent_no_notice',
    ).length
  }

  const logs = [
    {
      id: uid('lg'),
      at: new Date().toISOString(),
      kind: 'success' as const,
      text: `Đã công bố lịch trực tuần ${thisWeek} — ${cur.shifts.length} ca, ${cur.assignments.length} lượt phân công.`,
    },
    {
      id: uid('lg'),
      at: new Date(Date.now() - 3600_000).toISOString(),
      kind: 'warn' as const,
      text: `Có ${allUpcoming.filter((a) => a.confirmStatus === 'declined').length} lượt báo không trực được cho ngày mai — đã mở cho pool dự bị.`,
    },
    {
      id: uid('lg'),
      at: new Date(Date.now() - 7200_000).toISOString(),
      kind: 'info' as const,
      text: 'Cổng cập nhật lịch rảnh tuần sau đã đóng. 82% thành viên đã cập nhật.',
    },
  ]

  return {
    version: 1,
    members,
    availability,
    shifts,
    assignments,
    swaps,
    events,
    logs,
  }
}

export const SHIFT_CODES = SHIFTS.map((s) => s.code)
export { SHIFT_MAP }
