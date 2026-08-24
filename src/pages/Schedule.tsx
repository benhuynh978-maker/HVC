import { useMemo, useState } from 'react'
import { Crown, LayoutGrid } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Badge, Card, EmptyState, Modal, PageHeader } from '../components/ui'
import { AvatarStack, DayHeader, TierLegend, WeekNav } from '../components/shared'
import { SHIFT_MAP, SHIFTS, TIER_STYLE } from '../data/config'
import { cn, dowOf, formatDateLong, weekDays, weekStartOf, today } from '../lib/utils'
import { isUnderStaffed, presentCount } from '../lib/metrics'

/**
 * Lịch trực tuần — bảng Ca × Ngày. Ô nào tô nhạt là ca không áp dụng
 * cho ngày đó (ví dụ ca cuối tuần không có ở thứ 2). Bấm vào một ô đã
 * xếp người để xem chi tiết đội trực và trạng thái xác nhận.
 */
export function Schedule() {
  const data = useStore((s) => s.data)
  const [weekStart, setWeekStart] = useState(weekStartOf(today()))
  const [openCell, setOpenCell] = useState<{ date: string; code: string } | null>(null)

  const days = weekDays(weekStart)
  const memberMap = useMemo(
    () => Object.fromEntries(data.members.map((m) => [m.id, m])),
    [data.members],
  )

  const weekShifts = useMemo(
    () => data.shifts.filter((s) => weekStartOf(s.date) === weekStart),
    [data.shifts, weekStart],
  )
  const published = weekShifts.some((s) => s.status === 'published')

  const cellFor = (date: string, code: string) => weekShifts.find((s) => s.date === date && s.code === code)

  const detail = openCell ? cellFor(openCell.date, openCell.code) : null
  const detailAssignments = detail
    ? data.assignments.filter((a) => a.shiftId === detail.id)
    : []

  return (
    <>
      <PageHeader
        title="Lịch trực tuần"
        desc="Bảng ca theo tuần — tô màu theo tầng nhu cầu, huy hiệu vương miện đánh dấu ca trưởng."
        action={
          <div className="flex items-center gap-2">
            <WeekNav weekStart={weekStart} onChange={setWeekStart} />
          </div>
        }
      />

      {!weekShifts.length ? (
        <Card>
          <EmptyState
            icon={<LayoutGrid size={22} />}
            title="Tuần này chưa có lịch"
            desc='Vào mục "Xếp lịch tự động" để tạo bản nháp, sau đó công bố cho toàn ban.'
          />
        </Card>
      ) : (
        <>
          {!published && (
            <div className="mb-4">
              <Badge tone="warn">Đây là bản nháp — chưa công bố cho thành viên</Badge>
            </div>
          )}

          <Card className="overflow-hidden animate-fade-up">
            <div className="overflow-x-auto">
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
                      const shift = cellFor(d, def.code)
                      if (!applicable || !shift) {
                        return <div key={d} className="mx-0.5 my-0.5 rounded-lg" />
                      }
                      const assigns = data.assignments.filter((a) => a.shiftId === shift.id && !a.isStandby)
                      const members = assigns.map((a) => memberMap[a.memberId]).filter(Boolean)
                      const lead = memberMap[assigns.find((a) => a.isLead)?.memberId ?? '']
                      const under = isUnderStaffed(shift, data.assignments)

                      return (
                        <button
                          key={d}
                          onClick={() => setOpenCell({ date: d, code: def.code })}
                          className={cn(
                            'mx-0.5 my-0.5 flex flex-col items-center justify-center gap-1 rounded-lg border px-1 py-2 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-sm',
                            under
                              ? 'border-rose-200 bg-rose-50/60'
                              : 'border-ink-100 bg-white hover:border-brand-200',
                          )}
                        >
                          <AvatarStack members={members} max={3} size="xs" />
                          <div className="flex items-center gap-1">
                            {lead && <Crown size={9} className="text-amber-500" />}
                            <span
                              className={cn(
                                'text-[10px] font-bold tabular-nums',
                                under ? 'text-rose-600' : 'text-ink-500',
                              )}
                            >
                              {presentCount(shift, data.assignments)}/{def.minStaff}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-5 py-3.5">
              <TierLegend />
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-rose-500">
                <span className="h-2 w-2 rounded-full bg-rose-400" /> Dưới định mức
              </span>
            </div>
          </Card>
        </>
      )}

      <Modal
        open={!!openCell}
        onClose={() => setOpenCell(null)}
        title={openCell ? `Ca ${openCell.code} · ${formatDateLong(openCell.date)}` : ''}
        desc={openCell ? SHIFT_MAP[openCell.code]?.name : ''}
      >
        {detail && (
          <div className="space-y-2.5">
            {detailAssignments.length === 0 && (
              <p className="py-6 text-center text-[13px] text-ink-400">Chưa có ai được phân công vào ca này.</p>
            )}
            {detailAssignments.map((a) => {
              const m = memberMap[a.memberId]
              if (!m) return null
              return (
                <div key={a.id} className="flex items-center gap-3 rounded-xl border border-ink-100 p-3">
                  <AvatarStack members={[m]} max={1} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-ink-900">
                      {m.name}
                      {a.isLead && <span className="ml-1.5 text-[11px] font-bold text-amber-600">· Ca trưởng</span>}
                      {a.isStandby && <span className="ml-1.5 text-[11px] font-bold text-ink-400">· Dự bị tại chỗ</span>}
                    </p>
                    <p className="text-[11px] text-ink-400">
                      {a.confirmStatus === 'confirmed'
                        ? 'Đã xác nhận'
                        : a.confirmStatus === 'declined'
                          ? 'Đã báo không trực được'
                          : 'Chờ xác nhận'}
                    </p>
                  </div>
                  <Badge tone={a.confirmStatus === 'confirmed' ? 'success' : a.confirmStatus === 'declined' ? 'neutral' : 'warn'}>
                    {a.confirmStatus === 'confirmed' ? 'OK' : a.confirmStatus === 'declined' ? 'Vắng' : 'Chờ'}
                  </Badge>
                </div>
              )
            })}
          </div>
        )}
      </Modal>
    </>
  )
}
