import { useMemo, useState } from 'react'
import { CalendarPlus, Crown, LayoutGrid, MapPin, Pencil, Plus, Store, Trash2 } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Badge, Button, Card, EmptyState, Modal, PageHeader, Segmented, useConfirm } from '../components/ui'
import { AvatarStack, DayHeader, TierLegend, WeekNav } from '../components/shared'
import { TIER_STYLE } from '../data/config'
import { cn, formatDateLong, weekDays, weekStartOf, today } from '../lib/utils'
import { isUnderStaffed, presentCount } from '../lib/metrics'
import type { ExternalEvent, ShiftInstance, ShiftTier } from '../types'

const TIER_OPTIONS: { value: ShiftTier; label: string }[] = [
  { value: 'peak', label: 'Cao điểm' },
  { value: 'normal', label: 'Thường' },
  { value: 'low', label: 'Thấp điểm' },
]

const AREA_OPTIONS: { value: 'room' | 'external'; label: string }[] = [
  { value: 'room', label: 'Trực phòng' },
  { value: 'external', label: 'Điểm bán ngoài' },
]

/**
 * Lịch trực tuần — bảng Ca × Ngày. Không còn catalog ca cố định: mỗi ca là
 * một ShiftInstance riêng do Admin/Điều phối viên tự tạo cho đúng 1 ngày cụ
 * thể (nút "+ Thêm" ở từng cột ngày). Bảng có 3 chế độ theo tuần đang xem:
 *  · empty     — chưa có ca nào              → chỉ có nút "+ Thêm"
 *  · draft     — đã có ca, chưa xếp người     → vẫn cho Thêm/Sửa/Xoá
 *  · scheduled — đã chạy "Xếp lịch tự động"   → khoá công cụ, chỉ xem
 */
export function Schedule() {
  const data = useStore((s) => s.data)
  const createShift = useStore((s) => s.createShift)
  const updateShift = useStore((s) => s.updateShift)
  const deleteShift = useStore((s) => s.deleteShift)
  const [weekStart, setWeekStart] = useState(weekStartOf(today()))
  const [area, setArea] = useState<'room' | 'external'>('room')
  const [openCell, setOpenCell] = useState<{ shiftId: string } | null>(null)
  const [openEvent, setOpenEvent] = useState<ExternalEvent | null>(null)
  const [formTarget, setFormTarget] = useState<{ date: string; shift?: ShiftInstance } | null>(null)
  const { ask, node } = useConfirm()

  const days = weekDays(weekStart)
  const memberMap = useMemo(
    () => Object.fromEntries(data.members.map((m) => [m.id, m])),
    [data.members],
  )

  /** Điểm bán ngoài trong tuần đang xem — khu vực riêng, không trộn vào lưới ca phòng. */
  const weekEvents = useMemo(
    () => data.events.filter((ev) => weekStartOf(ev.date) === weekStart).sort((a, b) => a.date.localeCompare(b.date)),
    [data.events, weekStart],
  )

  const weekShifts = useMemo(
    () => data.shifts.filter((s) => weekStartOf(s.date) === weekStart),
    [data.shifts, weekStart],
  )
  const published = weekShifts.some((s) => s.status === 'published')

  const weekShiftIds = useMemo(() => new Set(weekShifts.map((s) => s.id)), [weekShifts])
  const hasAssignments = useMemo(
    () => data.assignments.some((a) => weekShiftIds.has(a.shiftId)),
    [data.assignments, weekShiftIds],
  )
  const mode: 'empty' | 'draft' | 'scheduled' =
    weekShifts.length === 0 ? 'empty' : hasAssignments ? 'scheduled' : 'draft'
  const canEditShifts = mode !== 'scheduled'

  /** Hàng động — mỗi hàng là 1 ca duy nhất theo giờ bắt đầu, chỉ hiện ở đúng cột ngày của nó. */
  const rows = useMemo(
    () => [...weekShifts].sort((a, b) => a.start.localeCompare(b.start) || a.date.localeCompare(b.date)),
    [weekShifts],
  )

  const detail = openCell ? weekShifts.find((s) => s.id === openCell.shiftId) : null
  const detailAssignments = detail
    ? data.assignments.filter((a) => a.shiftId === detail.id)
    : []

  const openCreate = (date: string) => setFormTarget({ date })
  const openEdit = (shift: ShiftInstance) => {
    setOpenCell(null)
    setFormTarget({ date: shift.date, shift })
  }

  const submitDelete = (shift: ShiftInstance) => {
    ask(
      'Xoá ca này?',
      `${shift.name} · ${formatDateLong(shift.date)} sẽ bị xoá hoàn toàn. Chỉ xoá được ca chưa có ai được phân công.`,
      () => {
        deleteShift(shift.id)
        setOpenCell(null)
      },
      true,
    )
  }

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

      <div className="mb-5">
        <Segmented options={AREA_OPTIONS} value={area} onChange={setArea} />
      </div>

      {area === 'external' ? (
        weekEvents.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Store size={22} />}
              title="Tuần này chưa có điểm bán ngoài nào"
              desc="Tạo và quản lý ứng viên ở trang &quot;Điểm bán ngoài&quot;."
            />
          </Card>
        ) : (
          <Card className="overflow-hidden animate-fade-up">
            <div className="overflow-x-auto">
              <div className="min-w-[880px]">
                <div className="grid grid-cols-[108px_repeat(7,1fr)] border-b border-ink-100 bg-ink-50/60 px-3 py-2.5">
                  <div />
                  {days.map((d) => (
                    <DayHeader key={d} date={d} />
                  ))}
                </div>

                {weekEvents.map((ev) => {
                  const under = ev.selected.length < ev.needed
                  return (
                    <div
                      key={ev.id}
                      className="grid grid-cols-[108px_repeat(7,1fr)] items-stretch border-b border-ink-50 px-3 py-2 last:border-0"
                    >
                      <div className="flex items-center gap-1.5 pr-2">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                        <div className="min-w-0">
                          <p className="truncate text-[11.5px] font-bold text-ink-700">{ev.name}</p>
                          <p className="truncate text-[9.5px] text-ink-400">
                            {ev.start}–{ev.end}
                          </p>
                        </div>
                      </div>

                      {days.map((d) => {
                        if (d !== ev.date) {
                          return <div key={d} className="mx-0.5 my-0.5 rounded-lg" />
                        }
                        const members = ev.selected.map((id) => memberMap[id]).filter(Boolean)

                        return (
                          <button
                            key={d}
                            onClick={() => setOpenEvent(ev)}
                            className={cn(
                              'mx-0.5 my-0.5 flex flex-col items-center justify-center gap-1 rounded-lg border px-1 py-2 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-sm',
                              under
                                ? 'border-rose-200 bg-rose-50/60'
                                : 'border-ink-100 bg-white hover:border-brand-200',
                            )}
                          >
                            <AvatarStack members={members} max={3} size="xs" />
                            <span
                              className={cn(
                                'text-[10px] font-bold tabular-nums',
                                under ? 'text-rose-600' : 'text-ink-500',
                              )}
                            >
                              {ev.selected.length}/{ev.needed}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-5 py-3.5">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-500">
                <span className="h-2 w-2 rounded-full bg-brand-500" /> Điểm bán ngoài
              </span>
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-rose-500">
                <span className="h-2 w-2 rounded-full bg-rose-400" /> Chưa đủ người cần
              </span>
            </div>
          </Card>
        )
      ) : (
        <>
          {mode === 'draft' && (
            <div className="mb-4">
              <Badge tone="warn">Đã có ca — chưa xếp lịch. Vào "Xếp lịch tự động" khi sẵn sàng.</Badge>
            </div>
          )}
          {mode === 'scheduled' && !published && (
            <div className="mb-4">
              <Badge tone="warn">Đây là bản nháp — chưa công bố cho thành viên</Badge>
            </div>
          )}

          {mode === 'empty' ? (
            <Card>
              <EmptyState
                icon={<LayoutGrid size={22} />}
                title="Tuần này chưa có ca nào"
                desc="Bấm '+ Thêm' bên dưới để tạo ca cho từng ngày, hoặc chuyển sang tuần khác."
              />
              <div className="grid grid-cols-2 gap-2 border-t border-ink-100 p-5 sm:grid-cols-4 lg:grid-cols-7">
                {days.map((d) => (
                  <Button key={d} variant="outline" size="sm" onClick={() => openCreate(d)}>
                    <Plus size={13} /> {formatDateLong(d).slice(0, 5)}
                  </Button>
                ))}
              </div>
            </Card>
          ) : (
            <Card className="overflow-hidden animate-fade-up">
              <div className="overflow-x-auto">
                <div className="min-w-[880px]">
                  <div className="grid grid-cols-[108px_repeat(7,1fr)] border-b border-ink-100 bg-ink-50/60 px-3 py-2.5">
                    <div />
                    {days.map((d) => (
                      <DayHeader key={d} date={d} />
                    ))}
                  </div>

                  {rows.map((shift) => (
                    <div
                      key={shift.id}
                      className="grid grid-cols-[108px_repeat(7,1fr)] items-stretch border-b border-ink-50 px-3 py-2 last:border-0"
                    >
                      <div className="flex items-center gap-1.5 pr-2">
                        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TIER_STYLE[shift.tier].dot)} />
                        <div className="min-w-0">
                          <p className="truncate text-[11.5px] font-bold text-ink-700">{shift.name}</p>
                          <p className="truncate text-[9.5px] text-ink-400">
                            {shift.start}–{shift.end}
                          </p>
                        </div>
                      </div>

                      {days.map((d) => {
                        if (d !== shift.date) {
                          return <div key={d} className="mx-0.5 my-0.5 rounded-lg" />
                        }
                        const assigns = data.assignments.filter((a) => a.shiftId === shift.id && !a.isStandby)
                        const members = assigns.map((a) => memberMap[a.memberId]).filter(Boolean)
                        const lead = memberMap[assigns.find((a) => a.isLead)?.memberId ?? '']
                        const under = isUnderStaffed(shift, data.assignments)

                        return (
                          <button
                            key={d}
                            onClick={() => setOpenCell({ shiftId: shift.id })}
                            className={cn(
                              'mx-0.5 my-0.5 flex flex-col items-center justify-center gap-1 rounded-lg border px-1 py-2 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-sm',
                              under
                                ? 'border-rose-200 bg-rose-50/60'
                                : 'border-ink-100 bg-white hover:border-brand-200',
                            )}
                          >
                            {mode === 'draft' ? (
                              <Pencil size={13} className="text-ink-300" />
                            ) : (
                              <AvatarStack members={members} max={3} size="xs" />
                            )}
                            <div className="flex items-center gap-1">
                              {lead && <Crown size={9} className="text-amber-500" />}
                              <span
                                className={cn(
                                  'text-[10px] font-bold tabular-nums',
                                  under ? 'text-rose-600' : 'text-ink-500',
                                )}
                              >
                                {presentCount(shift, data.assignments)}/{shift.minStaff}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  ))}

                  {canEditShifts && (
                    <div className="grid grid-cols-[108px_repeat(7,1fr)] items-stretch px-3 py-2">
                      <div className="flex items-center pr-2 text-[10.5px] font-bold text-ink-300">Thêm ca</div>
                      {days.map((d) => (
                        <div key={d} className="mx-0.5 my-0.5 flex items-center justify-center">
                          <button
                            onClick={() => openCreate(d)}
                            className="flex h-9 w-full items-center justify-center gap-1 rounded-lg border border-dashed border-ink-200 text-ink-300 transition-all duration-150 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600"
                            aria-label={`Thêm ca ngày ${formatDateLong(d)}`}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-5 py-3.5">
                <TierLegend />
                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-rose-500">
                  <span className="h-2 w-2 rounded-full bg-rose-400" /> Dưới định mức
                </span>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Modal chi tiết 1 ca */}
      <Modal
        open={!!openCell}
        onClose={() => setOpenCell(null)}
        title={detail ? detail.name : ''}
        desc={detail ? `${detail.start}–${detail.end} · ${formatDateLong(detail.date)}` : ''}
        footer={
          detail && canEditShifts ? (
            <>
              <Button variant="danger" onClick={() => submitDelete(detail)}>
                <Trash2 size={14} /> Xoá ca
              </Button>
              <Button variant="outline" onClick={() => openEdit(detail)}>
                <Pencil size={14} /> Sửa ca
              </Button>
            </>
          ) : undefined
        }
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

      {/* Modal chi tiết 1 điểm bán ngoài */}
      <Modal
        open={!!openEvent}
        onClose={() => setOpenEvent(null)}
        title={openEvent?.name ?? ''}
        desc={openEvent ? `${openEvent.start}–${openEvent.end} · ${formatDateLong(openEvent.date)}` : ''}
      >
        {openEvent && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="flex items-center gap-1.5 text-[12.5px] text-ink-500">
                <MapPin size={13} /> {openEvent.location}
              </p>
              <Badge tone={openEvent.status === 'locked' ? 'success' : openEvent.status === 'done' ? 'neutral' : 'info'}>
                {openEvent.status === 'locked' ? 'Đã chốt' : openEvent.status === 'done' ? 'Hoàn tất' : 'Đang mở'}
              </Badge>
            </div>
            <p className="text-[12.5px] text-ink-500">
              Cần <strong className="text-ink-800">{openEvent.needed}</strong> người · {openEvent.selected.length} đã chọn
            </p>
            <div className="space-y-2.5">
              {openEvent.selected.length === 0 && (
                <p className="py-6 text-center text-[13px] text-ink-400">Chưa có ai được chọn cho điểm bán này.</p>
              )}
              {openEvent.selected.map((id) => {
                const m = memberMap[id]
                if (!m) return null
                return (
                  <div key={id} className="flex items-center gap-3 rounded-xl border border-ink-100 p-3">
                    <AvatarStack members={[m]} max={1} size="sm" />
                    <p className="text-[13px] font-bold text-ink-900">{m.name}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal tạo/sửa ca */}
      <ShiftFormModal
        target={formTarget}
        onClose={() => setFormTarget(null)}
        onCreate={createShift}
        onUpdate={updateShift}
      />

      {node}
    </>
  )
}

type CreateShiftFn = (
  date: string,
  input: { name: string; start: string; end: string; tier: ShiftTier; minStaff: number },
) => void
type UpdateShiftFn = (
  shiftId: string,
  input: Partial<{ name: string; start: string; end: string; tier: ShiftTier; minStaff: number }>,
) => void

function ShiftFormModal({
  target,
  onClose,
  onCreate,
  onUpdate,
}: {
  target: { date: string; shift?: ShiftInstance } | null
  onClose: () => void
  onCreate: CreateShiftFn
  onUpdate: UpdateShiftFn
}) {
  const editing = target?.shift
  const [name, setName] = useState('')
  const [start, setStart] = useState('08:00')
  const [end, setEnd] = useState('10:00')
  const [tier, setTier] = useState<ShiftTier>('normal')
  const [minStaff, setMinStaff] = useState(2)
  const [key, setKey] = useState<string | null>(null)

  // Nạp lại state mỗi khi mở modal cho 1 mục tiêu khác (tạo mới hoặc sửa ca khác)
  const targetKey = target ? (target.shift?.id ?? `new:${target.date}`) : null
  if (targetKey !== key) {
    setKey(targetKey)
    setName(editing?.name ?? '')
    setStart(editing?.start ?? '08:00')
    setEnd(editing?.end ?? '10:00')
    setTier(editing?.tier ?? 'normal')
    setMinStaff(editing?.minStaff ?? 2)
  }

  if (!target) return null

  const valid = name.trim().length > 0 && start < end && minStaff >= 1

  const submit = () => {
    if (!valid) return
    if (editing) {
      onUpdate(editing.id, { name, start, end, tier, minStaff })
    } else {
      onCreate(target.date, { name, start, end, tier, minStaff })
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Sửa ca' : 'Tạo ca mới'}
      desc={`${formatDateLong(target.date)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={submit} disabled={!valid}>
            <CalendarPlus size={14} /> {editing ? 'Lưu thay đổi' : 'Tạo ca'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label mb-1.5 block">Tên ca</label>
          <input
            className="input"
            placeholder="Ví dụ: Gian hàng đồ ăn nhẹ"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label mb-1.5 block">Giờ bắt đầu</label>
            <input type="time" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <label className="label mb-1.5 block">Giờ kết thúc</label>
            <input type="time" className="input" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        {start >= end && <p className="text-[12px] font-semibold text-rose-500">Giờ kết thúc phải sau giờ bắt đầu.</p>}
        <div>
          <label className="label mb-1.5 block">Tầng nhu cầu</label>
          <Segmented options={TIER_OPTIONS} value={tier} onChange={setTier} />
        </div>
        <div>
          <label className="label mb-1.5 block">Số lượng người cần</label>
          <input
            type="number"
            min={1}
            className="input"
            value={minStaff}
            onChange={(e) => setMinStaff(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
      </div>
    </Modal>
  )
}
