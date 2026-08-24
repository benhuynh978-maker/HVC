import { useMemo, useState } from 'react'
import { AlertTriangle, Award, BarChart3, ShieldCheck, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Badge, Card, CardHeader, PageHeader } from '../components/ui'
import { BarRow, WeekNav } from '../components/shared'
import { computeContributions, computeWeekMetrics, kpiState } from '../lib/metrics'
import { KPI_TARGET } from '../data/config'
import { addDays, cn, weekStartOf, today } from '../lib/utils'

const KPI_ROWS: {
  key: keyof ReturnType<typeof computeWeekMetrics>
  label: string
  unit: string
  goal: number
  alert: number
  higherIsBetter: boolean
  desc: string
}[] = [
  {
    key: 'onTimeRate',
    label: 'Tỷ lệ có mặt đúng giờ',
    unit: '%',
    goal: KPI_TARGET.onTime.goal,
    alert: KPI_TARGET.onTime.alert,
    higherIsBetter: true,
    desc: 'Chỉ số phái sinh — thường tự cải thiện khi hai chỉ số gốc bên dưới được xử lý.',
  },
  {
    key: 'emptyShifts',
    label: 'Số ca trống (<định mức)',
    unit: ' ca',
    goal: KPI_TARGET.emptyShifts.goal,
    alert: KPI_TARGET.emptyShifts.alert,
    higherIsBetter: false,
    desc: 'Chỉ số quan trọng nhất — không được phép khác 0. Chạm ngưỡng là họp khẩn trong 24 giờ.',
  },
  {
    key: 'noNoticeRate',
    label: 'Tỷ lệ vắng không báo trước',
    unit: '%',
    goal: KPI_TARGET.noNotice.goal,
    alert: KPI_TARGET.noNotice.alert,
    higherIsBetter: false,
    desc: 'Chỉ số văn hoá — đo mức độ trung thực của tập thể, không phải mức độ trừng phạt.',
  },
  {
    key: 'advanceNoticeRate',
    label: 'Tỷ lệ báo trước ≥24h / tổng vắng',
    unit: '%',
    goal: KPI_TARGET.advanceNotice.goal,
    alert: KPI_TARGET.advanceNotice.alert,
    higherIsBetter: true,
    desc: 'Chỉ số mới — đo trực tiếp liệu báo vắng có đang "dễ và có ích" hay không.',
  },
  {
    key: 'swapMatchedRate',
    label: 'Tỷ lệ đổi ca khớp thành công',
    unit: '%',
    goal: KPI_TARGET.swapMatched.goal,
    alert: KPI_TARGET.swapMatched.alert,
    higherIsBetter: true,
    desc: 'Số lượt đổi ca cao KHÔNG phải chỉ số xấu — miễn tỷ lệ khớp vẫn cao.',
  },
  {
    key: 'balanceGap',
    label: 'Chênh lệch điểm gánh nặng',
    unit: '%',
    goal: KPI_TARGET.balanceGap.goal,
    alert: KPI_TARGET.balanceGap.alert,
    higherIsBetter: false,
    desc: 'Đo công bằng thật (theo mức độ nặng nhọc), không phải công bằng theo số ca thô.',
  },
]

/**
 * Báo cáo & KPI — nơi tổng hợp đúng 4 chỉ số của Nhiệm vụ 1 và 3 chỉ số bổ
 * sung của Phần C, cùng bảng ghi nhận đóng góp và ngưỡng cảnh báo sớm (mục 3.8).
 */
export function Reports() {
  const data = useStore((s) => s.data)
  const [weekStart, setWeekStart] = useState(weekStartOf(today()))

  const cur = useMemo(() => computeWeekMetrics(data, weekStart), [data, weekStart])
  const prev = useMemo(() => computeWeekMetrics(data, addDays(weekStart, -7)), [data, weekStart])

  const contributions = useMemo(() => computeContributions(data, [weekStart]), [data, weekStart])
  const maxBurden = Math.max(...contributions.map((c) => c.burden), 1)

  return (
    <>
      <PageHeader
        title="Báo cáo & KPI"
        desc="Bộ chỉ số vận hành đầy đủ — so sánh với tuần trước và với ngưỡng cảnh báo sớm đã đặt ra."
        action={<WeekNav weekStart={weekStart} onChange={setWeekStart} />}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 mb-6">
        {KPI_ROWS.map((row) => {
          const value = cur[row.key] as number
          const prevValue = prev[row.key] as number
          const state = kpiState(value, row.goal, row.alert, row.higherIsBetter)
          const diff = value - prevValue
          const better = row.higherIsBetter ? diff > 0 : diff < 0
          const flatDiff = Math.abs(diff) < 0.5

          return (
            <Card key={row.label} className="p-4 animate-fade-up">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12.5px] font-bold text-ink-800">{row.label}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-ink-400">{row.desc}</p>
                </div>
                <Badge tone={state === 'good' ? 'success' : state === 'warn' ? 'warn' : 'danger'}>
                  {state === 'good' ? 'Tốt' : state === 'warn' ? 'Cần theo dõi' : 'Báo động'}
                </Badge>
              </div>
              <div className="mt-3 flex items-end justify-between">
                <span
                  className={cn(
                    'text-[26px] font-extrabold leading-none',
                    state === 'good' ? 'text-emerald-600' : state === 'warn' ? 'text-amber-600' : 'text-rose-600',
                  )}
                >
                  {value.toFixed(row.unit === ' ca' ? 0 : 1)}
                  {row.unit}
                </span>
                <span
                  className={cn(
                    'flex items-center gap-1 text-[11.5px] font-bold',
                    flatDiff ? 'text-ink-400' : better ? 'text-emerald-600' : 'text-rose-600',
                  )}
                >
                  {flatDiff ? <Minus size={12} /> : better ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {flatDiff ? 'không đổi' : `${Math.abs(diff).toFixed(1)}${row.unit} so tuần trước`}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700',
                    state === 'good' ? 'bg-emerald-500' : state === 'warn' ? 'bg-amber-500' : 'bg-rose-500',
                  )}
                  style={{
                    width: `${Math.min(100, row.higherIsBetter ? value : 100 - Math.min(value, 100))}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-[10.5px] text-ink-300">
                Mục tiêu {row.higherIsBetter ? '≥' : '≤'} {row.goal}
                {row.unit} · Ngưỡng báo động {row.higherIsBetter ? '<' : '>'} {row.alert}
                {row.unit}
              </p>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="animate-fade-up">
          <CardHeader
            icon={<BarChart3 size={17} />}
            title="Cân bằng tải theo thành viên"
            desc="Điểm gánh nặng tuần này — càng đồng đều càng công bằng"
          />
          <div className="max-h-[360px] space-y-3 overflow-y-auto border-t border-ink-100 px-5 py-4">
            {contributions
              .filter((c) => c.burden > 0)
              .sort((a, b) => b.burden - a.burden)
              .map((c) => (
                <BarRow
                  key={c.member.id}
                  label={c.member.name.split(' ').slice(-2).join(' ')}
                  value={c.burden}
                  max={maxBurden}
                  tone={c.burden / c.member.staff.maxShiftsPerWeek > 1.3 ? 'rose' : 'brand'}
                  hint={c.burden.toFixed(1)}
                />
              ))}
          </div>
        </Card>

        <Card className="animate-fade-up">
          <CardHeader icon={<Award size={17} />} title="Ghi nhận đóng góp tuần này" desc="Xếp hạng theo điểm gánh nặng" />
          <div className="max-h-[360px] space-y-2.5 overflow-y-auto border-t border-ink-100 px-5 py-4">
            {contributions
              .sort((a, b) => b.burden - a.burden)
              .slice(0, 10)
              .map((c, i) => (
                <div key={c.member.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-ink-50">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold',
                        i < 3 ? 'bg-amber-100 text-amber-700' : 'bg-ink-100 text-ink-400',
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="truncate text-[12.5px] font-semibold text-ink-700">{c.member.name}</span>
                  </div>
                  <span className="shrink-0 text-[12px] font-bold text-ink-500">{c.shifts} ca · {c.hours.toFixed(1)}h</span>
                </div>
              ))}
          </div>
        </Card>
      </div>

      <Card className="mt-5 p-5 animate-fade-up">
        <p className="mb-3 flex items-center gap-2 text-[13px] font-bold text-ink-800">
          <ShieldCheck size={15} className="text-brand-500" /> Ngưỡng cảnh báo sớm đang áp dụng
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Đúng giờ tuần < 85%', 'Rà soát khung giờ trễ nhiều nhất, xem xét dịch giờ ca'],
            ['Ca trống ≥ 1', 'Họp khẩn Ban điều hành trong 24 giờ'],
            ['Vắng không báo > 8%', 'Phỏng vấn nhanh 5 thành viên, kiểm tra tải & động lực'],
            ['Báo trước < 70%', 'Kiểm tra kênh báo vắng và pool dự bị có hoạt động không'],
            ['Chênh lệch tải > 35%', 'Chạy lại thuật toán cân bằng, rà soát thủ công'],
          ].map(([cond, action]) => (
            <div key={cond} className="flex gap-2.5 rounded-xl bg-ink-50 p-3">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
              <div>
                <p className="text-[12px] font-bold text-ink-800">{cond}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500">{action}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}
