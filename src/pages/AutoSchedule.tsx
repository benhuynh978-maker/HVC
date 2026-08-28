import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
  Gauge,
  Loader2,
  Rocket,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { Button, Callout, Card, CardHeader, PageHeader, useConfirm } from '../components/ui'
import { BarRow, WeekNav } from '../components/shared'
import type { SchedulerResult } from '../lib/scheduler'
import { addDays, cn, formatDateLong, today, weekStartOf } from '../lib/utils'

const HARD_RULES = [
  ['H1', 'Chỉ xếp người đã khai rảnh đúng khung giờ đó'],
  ['H2', 'Mỗi ca phải đủ định mức tối thiểu theo tầng ca'],
  ['H3', 'Không trùng lịch điểm bán ngoài (kèm đệm di chuyển 60 phút)'],
  ['H4', 'Không vượt trần cam kết tự nguyện của cá nhân'],
  ['H5', 'Mỗi ca có đúng 1 ca trưởng'],
  ['H6', 'Không quá 2 ca/ngày và không quá 4 giờ liên tục'],
  ['H7', 'Ca cao điểm luôn có ≥1 người đã trực ≥3 ca'],
] as const

const SOFT_RULES = [
  ['S1', 'Cân bằng điểm gánh nặng, không cân bằng số ca thô'],
  ['S2', 'Ưu tiên người đang có tải thấp so với trần cam kết'],
  ['S3', 'Xoay vòng ca — hạn chế lặp lại ca tuần trước'],
  ['S6', 'Hạn chế xếp một người cả hai ngày cuối tuần'],
] as const

/**
 * Xếp lịch tự động — chạy trực tiếp thuật toán trong lib/scheduler.ts (Lớp 1
 * của quy trình 4 lớp ở Đề mục 2.4) và hiển thị kết quả để điều phối viên
 * rà soát trước khi công bố (Lớp 2).
 */
export function AutoSchedule() {
  const data = useStore((s) => s.data)
  const generateWeek = useStore((s) => s.generateWeek)
  const publishWeek = useStore((s) => s.publishWeek)
  const clearWeek = useStore((s) => s.clearWeek)
  const memberMap = useMemo(
    () => Object.fromEntries(data.members.map((m) => [m.id, m])),
    [data.members],
  )

  // Mặc định mở ngay tuần gần nhất ĐÃ CÓ CA (do Admin tạo ở "Lịch trực tuần")
  // nhưng CHƯA xếp người — đó là việc thật sự cần làm ở trang này. Nếu không
  // có tuần nào như vậy trong 12 tuần tới, mở tuần này để Admin biết cần
  // sang "Lịch trực tuần" tạo ca trước.
  const firstUnscheduledWeek = useMemo(() => {
    let w = weekStartOf(today())
    for (let i = 0; i < 12; i++) {
      const shiftsOfW = data.shifts.filter((s) => weekStartOf(s.date) === w)
      const idsOfW = new Set(shiftsOfW.map((s) => s.id))
      const scheduledOfW = data.assignments.some((a) => idsOfW.has(a.shiftId))
      if (shiftsOfW.length > 0 && !scheduledOfW) return w
      w = addDays(w, 7)
    }
    return weekStartOf(today())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [weekStart, setWeekStart] = useState(firstUnscheduledWeek)
  const [result, setResult] = useState<SchedulerResult | null>(null)
  const [running, setRunning] = useState(false)
  const { ask, node } = useConfirm()

  const weekShifts = data.shifts.filter((s) => weekStartOf(s.date) === weekStart)
  const weekShiftIds = new Set(weekShifts.map((s) => s.id))
  const hasShifts = weekShifts.length > 0
  const hasAssignments = data.assignments.some((a) => weekShiftIds.has(a.shiftId))
  const hasDraft = hasShifts && hasAssignments
  const isPublished = weekShifts.some((s) => s.status === 'published')

  const run = () => {
    setRunning(true)
    setTimeout(() => {
      const r = generateWeek(weekStart)
      setResult(r)
      setRunning(false)
    }, 550) // độ trễ nhẹ để cảm nhận rõ "thuật toán đang chạy"
  }

  const publish = () => {
    ask(
      'Công bố lịch tuần này?',
      'Sau khi công bố, lịch sẽ hiển thị cho toàn bộ thành viên và bước vào cơ chế xác nhận D-1. Mọi thay đổi sau đó phải đi qua chợ ca / đổi ca.',
      () => publish2(),
    )
  }
  const publish2 = () => {
    publishWeek(weekStart)
  }

  const clear = () => {
    ask(
      'Xoá lịch nháp của tuần này?',
      'Toàn bộ ca và phân công của tuần này sẽ bị xoá. Hành động này không thể hoàn tác.',
      () => {
        clearWeek(weekStart)
        setResult(null)
      },
      true,
    )
  }

  return (
    <>
      <PageHeader
        title="Xếp lịch tự động"
        desc="Thuật toán khớp lịch rảnh với ràng buộc cứng, sau đó tối ưu công bằng bằng điểm gánh nặng — chạy tức thì, rà soát trước khi công bố."
        action={<WeekNav weekStart={weekStart} onChange={setWeekStart} />}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
        {/* Cột trái: ràng buộc */}
        <div className="space-y-5">
          <Card className="p-5 animate-fade-up">
            <p className="label mb-3 flex items-center gap-1.5">
              <ShieldCheck size={13} /> Ràng buộc cứng
            </p>
            <div className="space-y-2.5">
              {HARD_RULES.map(([code, desc]) => (
                <div key={code} className="flex gap-2 text-[12px] leading-relaxed">
                  <span className="mt-0.5 shrink-0 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-extrabold text-rose-600">
                    {code}
                  </span>
                  <span className="text-ink-600">{desc}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 animate-fade-up">
            <p className="label mb-3 flex items-center gap-1.5">
              <Gauge size={13} /> Ràng buộc mềm (tối ưu)
            </p>
            <div className="space-y-2.5">
              {SOFT_RULES.map(([code, desc]) => (
                <div key={code} className="flex gap-2 text-[12px] leading-relaxed">
                  <span className="mt-0.5 shrink-0 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-extrabold text-brand-600">
                    {code}
                  </span>
                  <span className="text-ink-600">{desc}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Cột phải: hành động + kết quả */}
        <div className="space-y-5">
          <Card className="animate-fade-up overflow-hidden">
            <div className="flex flex-col items-center gap-4 bg-gradient-to-br from-brand-50 via-white to-white p-8 text-center sm:flex-row sm:text-left">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-lift">
                {running ? <Loader2 size={22} className="animate-spin" /> : <Sparkles size={22} />}
              </div>
              <div className="flex-1">
                <p className="text-[16px] font-extrabold text-ink-900">
                  Tuần {formatDateLong(weekStart)} – {formatDateLong(addDays(weekStart, 6))}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-500">
                  {isPublished
                    ? 'Lịch tuần này đã được công bố.'
                    : hasDraft
                      ? 'Đang có bản nháp — rà soát bên dưới rồi công bố khi sẵn sàng.'
                      : hasShifts
                        ? `Tuần này đã có ${weekShifts.length} ca — chạy thuật toán để xếp người vào.`
                        : 'Tuần này chưa có ca nào. Sang "Lịch trực tuần" để tạo ca trước khi xếp lịch.'}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {hasDraft && !isPublished && (
                  <Button variant="ghost" onClick={clear}>
                    <Trash2 size={15} /> Xoá nháp
                  </Button>
                )}
                <Button onClick={run} disabled={running || isPublished || !hasShifts}>
                  {running ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
                  {hasDraft ? 'Chạy lại' : 'Xếp lịch tự động'}
                </Button>
              </div>
            </div>
          </Card>

          {!hasShifts && !isPublished && (
            <Callout tone="brand" icon={<CalendarPlus size={14} />} title="Chưa có ca nào để xếp">
              Ca không còn tạo tự động theo mẫu cố định — hãy sang "Lịch trực tuần" để tạo ca riêng
              cho từng ngày trong tuần này trước.
              <div className="mt-2.5">
                <Link to="/schedule">
                  <Button size="sm" variant="outline">
                    Sang "Lịch trực tuần" <ArrowRight size={13} />
                  </Button>
                </Link>
              </div>
            </Callout>
          )}

          {result && (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 stagger">
                <MiniStat label="Số ca" value={result.stats.totalShifts} />
                <MiniStat
                  label="Độ phủ định mức"
                  value={`${result.stats.coverage.toFixed(0)}%`}
                  good={result.stats.coverage >= 95}
                />
                <MiniStat
                  label="Ca còn hở"
                  value={result.gaps.length}
                  good={result.gaps.length === 0}
                />
                <MiniStat
                  label="Chênh lệch tải"
                  value={`${result.stats.balanceGap.toFixed(0)}%`}
                  good={result.stats.balanceGap <= 20}
                />
              </div>

              {result.gaps.length > 0 ? (
                <Callout tone="warn" icon={<AlertTriangle size={15} />} title={`${result.gaps.length} ca chưa đủ định mức`}>
                  Đây là những ca cần chuyển sang <strong>Lớp 3 — Chợ ca công khai</strong> ngay
                  sau khi công bố. Điều phối viên nên rà soát thủ công trước (Lớp 2).
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {result.gaps.slice(0, 8).map((g) => (
                      <span key={g.shiftId} className="chip border border-amber-200 bg-white text-amber-700">
                        {formatDateLong(g.date).slice(0, 5)} · {g.code} · thiếu {g.missing}
                      </span>
                    ))}
                  </div>
                </Callout>
              ) : (
                <Callout tone="success" icon={<CheckCircle2 size={15} />} title="Không có ca trống nào">
                  Toàn bộ ca đều đạt định mức tối thiểu. Đây chính là chỉ số quan trọng nhất trong
                  bộ 4 chỉ số vận hành — sẵn sàng để công bố.
                </Callout>
              )}

              <Card className="animate-fade-up">
                <CardHeader
                  icon={<Users size={16} />}
                  title="Cân bằng tải theo thành viên"
                  desc="Điểm gánh nặng — không phải số ca thô. Ca cao điểm / cuối tuần / ca trưởng có hệ số cao hơn."
                />
                <div className="max-h-[320px] space-y-3 overflow-y-auto border-t border-ink-100 px-5 py-4">
                  {Object.entries(result.burden)
                    .filter(([, v]) => v > 0)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 12)
                    .map(([id, v]) => {
                      const m = memberMap[id]
                      if (!m?.staff) return null
                      const max = Math.max(...Object.values(result.burden), 1)
                      return (
                        <BarRow
                          key={id}
                          label={m.name.split(' ').slice(-2).join(' ')}
                          value={v}
                          max={max}
                          tone={v / m.staff.maxShiftsPerWeek > 1.3 ? 'rose' : 'brand'}
                        />
                      )
                    })}
                </div>
              </Card>

              <div className="space-y-1.5">
                {result.notes.map((n, i) => (
                  <p key={i} className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-400">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-300" />
                    {n}
                  </p>
                ))}
              </div>

              {!isPublished && (
                <Button size="lg" variant="success" className="w-full" onClick={publish}>
                  <CheckCircle2 size={16} /> Công bố lịch tuần này
                </Button>
              )}
            </>
          )}

          {!result && hasDraft && (
            <Callout tone="info">
              Tuần này đã có bản nháp từ trước.{' '}
              <button className="font-bold underline" onClick={run}>
                Chạy lại thuật toán
              </button>{' '}
              để xem chi tiết ràng buộc và cân bằng tải.
            </Callout>
          )}
        </div>
      </div>

      {node}
    </>
  )
}

function MiniStat({ label, value, good }: { label: string; value: string | number; good?: boolean }) {
  return (
    <Card className="p-4 text-center animate-fade-up">
      <p className="label mb-1.5">{label}</p>
      <p
        className={cn(
          'text-[22px] font-extrabold',
          good === undefined ? 'text-ink-800' : good ? 'text-emerald-600' : 'text-amber-600',
        )}
      >
        {value}
      </p>
    </Card>
  )
}
