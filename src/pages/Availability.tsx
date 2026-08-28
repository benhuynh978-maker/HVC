import { Fragment, useEffect, useRef, useState } from 'react'
import { AlertTriangle, CalendarRange, CheckCircle2, Info, Save, Sparkles } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Badge, Button, Callout, Card, CardHeader, PageHeader } from '../components/ui'
import { WeekNav } from '../components/shared'
import { AVAILABILITY_RATIO, DAY_LABELS, TIME_BLOCKS } from '../data/config'
import { cn, dowOf, formatDateLong, slotKey, weekDays, weekStartOf, today } from '../lib/utils'

/**
 * Lịch rảnh 2 lớp (Đề mục 1):
 *  · Lớp NỀN    : baselineSlots của Member, khai một lần khi gia nhập.
 *  · Lớp ROLLING: bản ghi Availability theo từng tuần — đây là màn hình này.
 * Nếu tuần chưa được cập nhật, lưới hiển thị sẵn lịch nền để người dùng
 * chỉ cần sửa phần khác biệt (đúng như quy trình "60 giây/tuần" trong bài làm).
 *
 * Không còn khai theo mã ca cố định (A/B/C...) — Admin giờ tự tạo ca riêng
 * cho từng ngày, nên lịch rảnh chuyển sang khai theo 4 KHUNG GIỜ trong ngày
 * (Sáng/Trưa/Chiều/Tối). Hệ thống tự so ca cụ thể có giao với khung đã khai
 * hay không khi xếp lịch (xem `freeForShift` trong lib/scheduler.ts).
 */
export function Availability() {
  const user = useStore((s) => s.data.members.find((m) => m.id === s.userId)!)
  const data = useStore((s) => s.data)
  const saveAvailability = useStore((s) => s.saveAvailability)
  // Trang này chỉ vào được qua route dành cho nhân viên (RequireStaff), nên
  // user.staff luôn tồn tại trên thực tế; assert để khỏi rải optional-chaining
  // khắp file (không đặt early-return ở đây vì sẽ phá thứ tự gọi hook bên dưới).
  const staff = user.staff!

  const nextWeek = weekStartOf(today())
  const [weekStart, setWeekStart] = useState(nextWeek)
  const days = weekDays(weekStart)

  const record = data.availability.find((a) => a.memberId === user.id && a.weekStart === weekStart)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [note, setNote] = useState('')
  const [dirty, setDirty] = useState(false)
  const dragMode = useRef<'add' | 'remove' | null>(null)

  useEffect(() => {
    const base = record?.submitted ? record.slots : staff.baselineSlots
    setSelected(new Set(base))
    setNote(record?.note ?? '')
    setDirty(false)
  }, [weekStart, record, staff.baselineSlots])

  useEffect(() => {
    const onUp = () => (dragMode.current = null)
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [])

  const toggle = (key: string, force?: 'add' | 'remove') => {
    setSelected((prev) => {
      const next = new Set(prev)
      const willAdd = force ? force === 'add' : !next.has(key)
      if (willAdd) next.add(key)
      else next.delete(key)
      return next
    })
    setDirty(true)
  }

  const startDrag = (key: string) => {
    const willAdd = !selected.has(key)
    dragMode.current = willAdd ? 'add' : 'remove'
    toggle(key, dragMode.current)
  }
  const dragOver = (key: string) => {
    if (dragMode.current) toggle(key, dragMode.current)
  }

  const target = Math.max(4, staff.maxShiftsPerWeek * AVAILABILITY_RATIO)
  const enough = selected.size >= target
  const ratio = Math.min(100, (selected.size / target) * 100)

  const save = () => {
    saveAvailability(user.id, weekStart, [...selected], note)
    setDirty(false)
  }

  const isSubmitted = record?.submitted && !dirty

  return (
    <>
      <PageHeader
        title="Lịch rảnh của tôi"
        desc="Bấm hoặc kéo để chọn những khung giờ bạn rảnh. Hệ thống sẽ chỉ xếp bạn vào đúng những khung này — không hơn."
        action={
          <WeekNav
            weekStart={weekStart}
            onChange={setWeekStart}
            suffix={
              isSubmitted ? (
                <Badge tone="success">
                  <CheckCircle2 size={12} /> Đã cập nhật
                </Badge>
              ) : (
                <Badge tone="warn">Dùng lịch nền</Badge>
              )
            }
          />
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
        <Card className="animate-fade-up">
          <CardHeader
            icon={<CalendarRange size={17} />}
            title={`Tuần ${formatDateLong(weekStart)} – ${formatDateLong(days[6])}`}
            desc="Kéo chuột qua nhiều ô để chọn nhanh hàng loạt"
          />
          <div className="overflow-x-auto border-t border-ink-100 px-5 py-4">
            <div className="min-w-[640px] select-none">
              <div className="grid grid-cols-[92px_repeat(7,1fr)] gap-1.5">
                <div />
                {days.map((d) => (
                  <div key={d} className="text-center">
                    <p className="text-[11px] font-bold uppercase text-ink-400">{DAY_LABELS[dowOf(d)]}</p>
                    <p className="text-[10.5px] text-ink-300">{formatDateLong(d).slice(0, 5)}</p>
                  </div>
                ))}

                {TIME_BLOCKS.map((block) => (
                  <Fragment key={block.value}>
                    <div className="flex items-center gap-1.5 py-1 pr-2">
                      <div className="min-w-0">
                        <p className="truncate text-[11.5px] font-bold text-ink-700">{block.label}</p>
                        <p className="truncate text-[9.5px] text-ink-400">{block.start}–{block.end}</p>
                      </div>
                    </div>
                    {days.map((d) => {
                      const dow = dowOf(d)
                      const key = slotKey(dow, block.value)
                      const active = selected.has(key)
                      return (
                        <button
                          key={key}
                          onMouseDown={() => startDrag(key)}
                          onMouseEnter={() => dragOver(key)}
                          className={cn(
                            'h-9 rounded-lg border text-[10px] font-bold transition-all duration-150',
                            active
                              ? 'border-brand-200 bg-brand-50 text-brand-700 shadow-sm scale-[1.03]'
                              : 'border-ink-150 border-dashed border-ink-200 bg-white text-ink-300 hover:border-ink-300 hover:bg-ink-50',
                          )}
                        >
                          {active ? 'Rảnh' : ''}
                        </button>
                      )
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5 animate-fade-up">
            <p className="label mb-3">Tiến độ khai báo</p>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-[26px] font-extrabold text-ink-900">{selected.size}</span>
              <span className="text-[12px] font-semibold text-ink-400">/ {target} khung tối thiểu</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
              <div
                className={cn('h-full rounded-full transition-all duration-500', enough ? 'bg-emerald-500' : 'bg-amber-500')}
                style={{ width: `${ratio}%` }}
              />
            </div>
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-400">
              Trần cam kết của bạn: <strong className="text-ink-600">{staff.maxShiftsPerWeek} ca/tuần</strong>.
              Quy tắc "khai gấp đôi" giúp thuật toán có đủ không gian tối ưu và tạo ra pool dự bị
              cho những người khác.
            </p>
            {!enough && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-[11.5px] text-amber-700">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                Khai thêm {target - selected.size} khung để đạt mức khuyến nghị.
              </div>
            )}
          </Card>

          <Card className="p-5 animate-fade-up">
            <label className="label mb-2 block">Ghi chú cho tuần này</label>
            <textarea
              className="input min-h-[84px] resize-none"
              placeholder="Ví dụ: tuần này em có bài kiểm tra, xin nhận ít ca hơn..."
              value={note}
              onChange={(e) => {
                setNote(e.target.value)
                setDirty(true)
              }}
            />
            <p className="mt-2 text-[11px] text-ink-400">
              Điều phối viên sẽ thấy ghi chú này khi rà soát lịch nháp.
            </p>
          </Card>

          <Button size="lg" className="w-full" onClick={save} disabled={!dirty && !!isSubmitted}>
            <Save size={16} /> Lưu lịch rảnh tuần này
          </Button>

          <Callout tone="info" icon={<Info size={14} />}>
            Cổng cập nhật mở từ <strong>Thứ 4 18:00</strong> đến <strong>Thứ 6 21:00</strong> cho
            tuần kế tiếp. Không cập nhật thì hệ thống dùng lịch nền của bạn — không ai bị bỏ sót.
          </Callout>

          {!record?.submitted && (
            <Callout tone="brand" icon={<Sparkles size={14} />}>
              Đây là <strong>lịch nền</strong> của bạn. Sửa và lưu để hệ thống dùng bản cập nhật
              riêng cho tuần này.
            </Callout>
          )}
        </div>
      </div>
    </>
  )
}
