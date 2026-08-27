import { useMemo, useState } from 'react'
import {
  CalendarX2,
  CheckCircle2,
  Clock3,
  Crown,
  HelpCircle,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { Badge, Button, Callout, Card, CardHeader, EmptyState, Modal, PageHeader } from '../components/ui'
import { DayHeader, ScoreRing, ShiftTag, TierLegend, WeekNav } from '../components/shared'
import {
  ATTENDANCE_LABEL,
  ATTENDANCE_STYLE,
  CONFIRM_DEADLINE_HOUR,
  SHIFTS,
  SHIFT_MAP,
  TIER_STYLE,
} from '../data/config'
import {
  cn,
  dowOf,
  formatDateLong,
  parseShiftId,
  relativeDayLabel,
  today,
  weekDays,
  weekStartOf,
} from '../lib/utils'
import type { Assignment } from '../types'

/**
 * "Ca của tôi" — bảng lưới Ngày × Ca giống cấu trúc "Lịch trực tuần", nhưng
 * CHỈ hiển thị ca của chính người đăng nhập — không hiện tên/avatar ai khác.
 * Đây vẫn là nơi thực thi cơ chế XÁC NHẬN D-1 (mục 3.5 của kế hoạch), giờ
 * kích hoạt bằng cách bấm vào ô của mình thay vì một hàng trong danh sách.
 */
export function MyShifts() {
  const user = useStore((s) => s.data.members.find((m) => m.id === s.userId)!)
  const data = useStore((s) => s.data)
  const confirmAssignment = useStore((s) => s.confirmAssignment)
  const declineAssignment = useStore((s) => s.declineAssignment)

  const t = today()
  const [weekStart, setWeekStart] = useState(weekStartOf(t))
  const days = weekDays(weekStart)

  const [openCell, setOpenCell] = useState<{ date: string; code: string } | null>(null)
  const [declineTarget, setDeclineTarget] = useState<Assignment | null>(null)
  const [reason, setReason] = useState('')

  /** Toàn bộ ca sắp tới của tôi (không giới hạn theo tuần đang xem) — phục vụ banner nhắc hạn. */
  const mine = useMemo(() => {
    return data.assignments
      .filter((a) => a.memberId === user.id)
      .map((a) => ({ a, ...parseShiftId(a.shiftId) }))
      .filter((x) => x.date >= t)
      .sort((x, y) => x.date.localeCompare(y.date))
  }, [data.assignments, user.id, t])

  const needsConfirm = mine.filter((x) => x.a.confirmStatus === 'pending')

  /** Tra cứu nhanh: ca của tôi tại 1 ô Ngày×Mã ca, trong toàn bộ dữ liệu (không chỉ tuần đang xem). */
  const myAssignmentAt = (date: string, code: string) =>
    data.assignments.find(
      (a) => a.memberId === user.id && a.shiftId === `${date}__${code}` && a.confirmStatus !== 'declined',
    ) ??
    // Vẫn hiện được ca đã báo không trực, để không "biến mất" khỏi lưới của chính mình
    data.assignments.find((a) => a.memberId === user.id && a.shiftId === `${date}__${code}`)

  const weekHasAny = days.some((d) => SHIFTS.some((def) => myAssignmentAt(d, def.code)))

  const hourNow = new Date().getHours()
  const deadlinePassed = hourNow >= CONFIRM_DEADLINE_HOUR

  const openDetail = (date: string, code: string) => {
    setWeekStart(weekStartOf(date))
    setOpenCell({ date, code })
  }

  const detailAssignment = openCell ? myAssignmentAt(openCell.date, openCell.code) : undefined
  const detailDef = openCell ? SHIFT_MAP[openCell.code] : undefined
  const isToday = openCell?.date === t
  const isPast = !!openCell && openCell.date < t

  const openDecline = (a: Assignment) => {
    setOpenCell(null)
    setDeclineTarget(a)
    setReason('')
  }

  const submitConfirm = (assignmentId: string) => {
    confirmAssignment(assignmentId)
    setOpenCell(null)
  }

  const submitDecline = () => {
    if (!declineTarget) return
    declineAssignment(declineTarget.id, reason.trim() || 'Không nêu lý do')
    setDeclineTarget(null)
  }

  return (
    <>
      <PageHeader
        title="Ca của tôi"
        desc="Bảng lịch chỉ hiển thị ca của riêng bạn — không thấy ca của người khác. Bấm vào một ô để xác nhận hoặc báo không trực được."
        action={<ScoreRingCard reliability={user.staff?.reliability ?? 0} />}
      />

      {needsConfirm.length > 0 && (
        <Callout
          tone={deadlinePassed ? 'danger' : 'brand'}
          icon={<Clock3 size={16} />}
          title={`${needsConfirm.length} ca đang chờ bạn xác nhận`}
          className="mb-6"
        >
          <p>
            Hạn xác nhận là <strong>{CONFIRM_DEADLINE_HOUR}:00 tối hôm trước ngày trực</strong>. Sau
            giờ này, ca của bạn sẽ chuyển sang trạng thái "rủi ro" và điều phối viên sẽ chủ động gọi
            xác minh.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {needsConfirm.map(({ a, date, code }) => (
              <button key={a.id} data-testid="my-shift-banner-chip" onClick={() => openDetail(date, code)} className="cursor-pointer">
                <ShiftTag code={code} />
              </button>
            ))}
          </div>
        </Callout>
      )}

      <Card className="overflow-hidden animate-fade-up">
        <CardHeader
          title={`Tuần ${formatDateLong(weekStart)} – ${formatDateLong(days[6])}`}
          desc={weekHasAny ? 'Bấm vào ô có màu để xem chi tiết và xác nhận' : 'Bạn không có ca nào trong tuần này'}
          action={<WeekNav weekStart={weekStart} onChange={setWeekStart} />}
        />
        <div className="overflow-x-auto border-t border-ink-100">
          <div className="min-w-[880px]">
            <div className="grid grid-cols-[108px_repeat(7,1fr)] border-b border-ink-100 bg-ink-50/60 px-3 py-2.5">
              <div />
              {days.map((d) => (
                <DayHeader key={d} date={d} />
              ))}
            </div>

            {SHIFTS.map((def) => (
              <div
                key={def.code}
                className="grid grid-cols-[108px_repeat(7,1fr)] items-stretch border-b border-ink-50 px-3 py-2 last:border-0"
              >
                <div className="flex items-center gap-1.5 pr-2">
                  <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TIER_STYLE[def.tier].dot)} />
                  <div className="min-w-0">
                    <p className="truncate text-[11.5px] font-bold text-ink-700">{def.code}</p>
                    <p className="truncate text-[9.5px] text-ink-400">
                      {def.start}–{def.end}
                    </p>
                  </div>
                </div>

                {days.map((d) => {
                  const applicable = def.days.includes(dowOf(d))
                  const a = applicable ? myAssignmentAt(d, def.code) : undefined

                  if (!applicable || !a) {
                    return <div key={d} className="mx-0.5 my-0.5 rounded-lg" />
                  }

                  const dayIsPast = d < t
                  const icon = dayIsPast ? attendanceIcon(a) : confirmIcon(a)

                  return (
                    <button
                      key={d}
                      data-testid="my-shift-cell"
                      onClick={() => openDetail(d, def.code)}
                      className={cn(
                        'mx-0.5 my-0.5 flex flex-col items-center justify-center gap-1 rounded-lg border px-1 py-2 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-sm',
                        TIER_STYLE[def.tier].chip,
                      )}
                    >
                      {a.isLead && <Crown size={10} className="text-amber-500" />}
                      {icon}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-ink-100 px-5 py-3.5">
          <TierLegend />
        </div>
      </Card>

      {mine.length === 0 && (
        <Card className="mt-5">
          <EmptyState
            icon={<CalendarX2 size={22} />}
            title="Bạn chưa có ca nào sắp tới"
            desc="Có thể lịch tuần sau chưa được công bố, hoặc bạn chưa được xếp vào ca nào. Hãy cập nhật lịch rảnh để hệ thống xếp bạn vào tuần kế tiếp."
          />
        </Card>
      )}

      {/* Modal chi tiết 1 ô — xem trạng thái + hành động, chỉ ca của chính mình */}
      <Modal
        open={!!openCell}
        onClose={() => setOpenCell(null)}
        title={openCell ? `Ca ${openCell.code} · ${relativeDayLabel(openCell.date)}` : ''}
        desc={detailDef ? `${detailDef.name} · ${formatDateLong(openCell!.date)}` : ''}
      >
        {detailAssignment && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <ShiftTag code={openCell!.code} />
              {detailAssignment.isLead && (
                <Badge tone="warn">
                  <Crown size={11} /> Ca trưởng
                </Badge>
              )}
            </div>

            {isPast ? (
              <span className={cn('chip', ATTENDANCE_STYLE[detailAssignment.attendance])}>
                {ATTENDANCE_LABEL[detailAssignment.attendance]}
              </span>
            ) : (
              <StatusPill a={detailAssignment} />
            )}

            {!isPast && !isToday && detailAssignment.confirmStatus === 'pending' && (
              <div className="flex gap-2">
                <Button size="sm" variant="danger" onClick={() => openDecline(detailAssignment)}>
                  <XCircle size={14} /> Không thể trực
                </Button>
                <Button size="sm" variant="success" onClick={() => submitConfirm(detailAssignment.id)}>
                  <CheckCircle2 size={14} /> Xác nhận
                </Button>
              </div>
            )}
            {!isPast && !isToday && detailAssignment.confirmStatus === 'confirmed' && (
              <Button size="sm" variant="ghost" onClick={() => openDecline(detailAssignment)} className="text-ink-400">
                Đổi ý? Báo không trực được
              </Button>
            )}
            {isToday && (
              <p className="text-[12px] text-ink-400">Ca đang diễn ra hôm nay — không thể thay đổi qua hệ thống.</p>
            )}
          </div>
        )}
      </Modal>

      {/* Modal nhập lý do không trực được — giữ nguyên cơ chế cũ */}
      <Modal
        open={!!declineTarget}
        onClose={() => setDeclineTarget(null)}
        title="Báo không trực được ca này"
        desc="Không sao cả — điều quan trọng nhất là bạn báo sớm. Ca sẽ được mở ngay cho danh sách dự bị."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeclineTarget(null)}>
              Quay lại
            </Button>
            <Button variant="danger" onClick={submitDecline}>
              Xác nhận không trực được
            </Button>
          </>
        }
      >
        {declineTarget && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ShiftTag code={parseShiftId(declineTarget.shiftId).code} />
              <span className="text-[13px] font-semibold text-ink-600">
                {relativeDayLabel(parseShiftId(declineTarget.shiftId).date)}
              </span>
            </div>
            <div>
              <label className="label mb-1.5 block">Lý do (không bắt buộc)</label>
              <textarea
                className="input min-h-[84px] resize-none"
                placeholder="Ví dụ: trùng lịch kiểm tra giữa kỳ..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <Callout tone="success" icon={<ShieldCheck size={14} />}>
              Vì bạn báo trước hạn nên <strong>không có bất kỳ hệ quả tiêu cực nào</strong>. Đây
              chính là hành xử được hệ thống khuyến khích.
            </Callout>
          </div>
        )}
      </Modal>
    </>
  )
}

function ScoreRingCard({ reliability }: { reliability: number }) {
  return (
    <Card className="flex items-center gap-3 px-4 py-2.5">
      <ScoreRing value={reliability} size={38} />
      <div>
        <p className="text-[11px] font-semibold text-ink-400">Điểm uy tín</p>
        <p className="text-[12.5px] font-bold text-ink-800">Chỉ mình bạn thấy</p>
      </div>
    </Card>
  )
}

function StatusPill({ a }: { a: Assignment }) {
  if (a.confirmStatus === 'confirmed')
    return (
      <Badge tone="success">
        <CheckCircle2 size={12} /> Đã xác nhận
      </Badge>
    )
  if (a.confirmStatus === 'declined')
    return (
      <Badge tone="neutral" className="text-ink-400">
        <XCircle size={12} /> Đã báo không trực
      </Badge>
    )
  return (
    <Badge tone="warn">
      <HelpCircle size={12} /> Chờ xác nhận
    </Badge>
  )
}

/** Icon nhỏ trong ô lưới cho ca TƯƠNG LAI — theo trạng thái xác nhận D-1. */
function confirmIcon(a: Assignment) {
  if (a.confirmStatus === 'confirmed') return <CheckCircle2 size={15} className="text-emerald-600" />
  if (a.confirmStatus === 'declined') return <XCircle size={15} className="text-ink-400" />
  return <Clock3 size={15} className="text-amber-600" />
}

/** Icon nhỏ trong ô lưới cho ca ĐÃ QUA — theo trạng thái điểm danh. */
function attendanceIcon(a: Assignment) {
  switch (a.attendance) {
    case 'ontime':
      return <CheckCircle2 size={15} className="text-emerald-600" />
    case 'late_minor':
    case 'late_major':
      return <Clock3 size={15} className="text-amber-600" />
    case 'absent_notified':
      return <HelpCircle size={15} className="text-sky-600" />
    case 'absent_no_notice':
      return <XCircle size={15} className="text-rose-600" />
    default:
      return <HelpCircle size={15} className="text-ink-300" />
  }
}
