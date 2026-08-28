import { useMemo, useState } from 'react'
import {
  Camera,
  CheckCircle2,
  Clock3,
  MessageSquareWarning,
  ShieldAlert,
  ShieldOff,
  UserRoundCheck,
  UserX,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { Callout, Card, CardHeader, EmptyState, PageHeader, Segmented } from '../components/ui'
import { AvatarStack, ShiftTag, WeekNav } from '../components/shared'
import { ATTENDANCE_LABEL, ATTENDANCE_STYLE, RELIABILITY_DELTA } from '../data/config'
import { cn, formatDateLong, today, weekDays, weekStartOf } from '../lib/utils'
import type { AttendanceStatus } from '../types'

const OPTIONS: { value: AttendanceStatus; label: string; icon: typeof CheckCircle2 }[] = [
  { value: 'ontime', label: 'Đúng giờ', icon: CheckCircle2 },
  { value: 'late_minor', label: 'Trễ nhẹ', icon: Clock3 },
  { value: 'late_major', label: 'Trễ nặng', icon: ShieldAlert },
  { value: 'absent_notified', label: 'Vắng có báo', icon: MessageSquareWarning },
  { value: 'absent_no_notice', label: 'Vắng không báo', icon: ShieldOff },
]

/**
 * Điểm danh — nơi ca trưởng / điều phối viên ghi nhận trạng thái theo bảng 3.3.
 * Mỗi lựa chọn tự động cộng/trừ điểm uy tín (RELIABILITY_DELTA) và cập nhật
 * ngay 4 chỉ số ở Tổng quan / Báo cáo.
 */
export function Attendance() {
  const data = useStore((s) => s.data)
  const setAttendance = useStore((s) => s.setAttendance)
  const isManager = useStore((s) => s.isManager)()

  const t = today()
  const [date, setDate] = useState(t)
  const [scope, setScope] = useState<'today' | 'week'>('today')

  const week = weekStartOf(date)
  const days = weekDays(week)

  const memberMap = useMemo(
    () => Object.fromEntries(data.members.map((m) => [m.id, m])),
    [data.members],
  )

  const rows = useMemo(() => {
    const targetDates = scope === 'today' ? [date] : days
    return data.shifts
      .filter((s) => targetDates.includes(s.date) && s.status === 'published')
      .map((s) => {
        const list = data.assignments
          .filter((a) => a.shiftId === s.id && a.confirmStatus !== 'declined')
          .map((a) => ({ a, member: memberMap[a.memberId] }))
          .filter((x) => x.member)
        return { shift: s, list }
      })
      .sort((a, b) => (a.shift.date + a.shift.start).localeCompare(b.shift.date + b.shift.start))
  }, [data.shifts, data.assignments, memberMap, scope, date, days])

  const canEdit = isManager

  return (
    <>
      <PageHeader
        title="Điểm danh"
        desc="Ghi nhận trạng thái có mặt cho từng ca. Mỗi trạng thái tự động cộng/trừ điểm uy tín và cập nhật các chỉ số vận hành theo thời gian thực."
        action={
          <div className="flex items-center gap-2">
            <Segmented
              value={scope}
              onChange={setScope}
              options={[
                { value: 'today', label: 'Một ngày' },
                { value: 'week', label: 'Cả tuần' },
              ]}
            />
          </div>
        }
      />

      {!canEdit && (
        <Callout tone="info" icon={<UserRoundCheck size={15} />} className="mb-5">
          Bạn đang xem ở chế độ chỉ đọc. Chỉ Ca trưởng, Điều phối viên hoặc Trưởng ban Nhân sự mới
          có quyền ghi nhận điểm danh.
        </Callout>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        {scope === 'today' ? (
          <div className="flex flex-wrap gap-1.5">
            {days.map((d) => (
              <button
                key={d}
                onClick={() => setDate(d)}
                className={cn(
                  'rounded-xl border px-3.5 py-2 text-[12.5px] font-bold transition-all',
                  d === date
                    ? 'border-brand-300 bg-brand-50 text-brand-700 shadow-ring'
                    : 'border-ink-200 bg-white text-ink-500 hover:border-ink-300',
                  d === t && d !== date && 'ring-1 ring-brand-200',
                )}
              >
                {formatDateLong(d).slice(0, 5)}
                {d === t && <span className="ml-1 text-brand-400">•</span>}
              </button>
            ))}
          </div>
        ) : (
          <WeekNav weekStart={week} onChange={(w) => setDate(w)} />
        )}
      </div>

      <div className="space-y-4">
        {rows.length === 0 && (
          <Card>
            <EmptyState
              icon={<UserX size={22} />}
              title="Không có ca nào trong khoảng thời gian này"
              desc="Chọn ngày khác, hoặc kiểm tra xem lịch tuần đã được công bố chưa."
            />
          </Card>
        )}

        {rows.map(({ shift, list }) => (
          <Card key={shift.id} className="overflow-hidden animate-fade-up">
            <CardHeader
              icon={<ShiftTag shift={shift} showTime={false} />}
              title={`${shift.name} · ${shift.start}–${shift.end}`}
              desc={`${formatDateLong(shift.date)} · ${list.length} người được phân công`}
            />
            <div className="divide-y divide-ink-100 border-t border-ink-100">
              {list.map(({ a, member }) => (
                <div key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <AvatarStack members={[member]} max={1} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-ink-900">
                      {member.name}
                      {a.isLead && <span className="ml-1.5 text-[11px] font-bold text-amber-600">· Ca trưởng</span>}
                    </p>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className={cn('chip', ATTENDANCE_STYLE[a.attendance])}>
                        {ATTENDANCE_LABEL[a.attendance]}
                        {RELIABILITY_DELTA[a.attendance] !== 0 && (
                          <span className="ml-1 font-extrabold">
                            {RELIABILITY_DELTA[a.attendance] > 0 ? '+' : ''}
                            {RELIABILITY_DELTA[a.attendance]}
                          </span>
                        )}
                      </span>
                      {a.selfCheckInVerified && (
                        <span className="chip border border-sky-100 bg-sky-50 text-sky-700" title="Đã tự điểm danh qua camera">
                          <Camera size={11} /> Ảnh
                        </span>
                      )}
                    </span>
                  </div>

                  {canEdit && (
                    <div className="flex flex-wrap gap-1">
                      {OPTIONS.map((o) => {
                        const Icon = o.icon
                        const active = a.attendance === o.value
                        return (
                          <button
                            key={o.value}
                            onClick={() => setAttendance(a.id, o.value)}
                            title={o.label}
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-lg border transition-all duration-150',
                              active
                                ? cn(ATTENDANCE_STYLE[o.value], 'scale-105 shadow-sm')
                                : 'border-ink-200 text-ink-300 hover:border-ink-300 hover:text-ink-500',
                            )}
                          >
                            <Icon size={14} />
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  )
}
