import { ChevronLeft, ChevronRight, Crown } from 'lucide-react'
import type { Member, ShiftInstance } from '../types'
import { TIER_LABEL, TIER_STYLE, DAY_SHORT } from '../data/config'
import { addDays, cn, dowOf, formatDate, formatWeekRange, weekStartOf, today } from '../lib/utils'
import { Avatar, Badge, Button } from './ui'

/** Điều hướng tuần — dùng chung ở Lịch rảnh, Lịch trực, Xếp lịch, Báo cáo. */
export function WeekNav({
  weekStart,
  onChange,
  suffix,
}: {
  weekStart: string
  onChange: (w: string) => void
  suffix?: React.ReactNode
}) {
  const thisWeek = weekStartOf(today())
  const offset = Math.round(
    (new Date(weekStart).getTime() - new Date(thisWeek).getTime()) / (7 * 86400000),
  )
  const label =
    offset === 0 ? 'Tuần này' : offset === 1 ? 'Tuần sau' : offset === -1 ? 'Tuần trước' : `${offset > 0 ? '+' : ''}${offset} tuần`

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-xl border border-ink-200 bg-white p-1">
        <button
          onClick={() => onChange(addDays(weekStart, -7))}
          className="rounded-lg p-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
          aria-label="Tuần trước"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="min-w-[132px] px-2 text-center">
          <p className="text-[13px] font-bold leading-tight text-ink-900">{formatWeekRange(weekStart)}</p>
          <p className="text-[10.5px] font-semibold text-brand-500">{label}</p>
        </div>
        <button
          onClick={() => onChange(addDays(weekStart, 7))}
          className="rounded-lg p-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
          aria-label="Tuần sau"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      {offset !== 0 && (
        <Button size="sm" variant="ghost" onClick={() => onChange(thisWeek)}>
          Về tuần này
        </Button>
      )}
      {suffix}
    </div>
  )
}

/** Nhãn ca: tên + khung giờ + tầng. Nhận thẳng ShiftInstance vì không còn catalog cố định để tra theo mã. */
export function ShiftTag({
  shift,
  showTime = true,
}: {
  shift: Pick<ShiftInstance, 'name' | 'start' | 'end' | 'tier'>
  showTime?: boolean
}) {
  const st = TIER_STYLE[shift.tier]
  return (
    <span className={cn('chip', st.chip)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', st.dot)} />
      <span className="font-bold">{shift.name}</span>
      {showTime && <span className="font-medium opacity-75">{shift.start}–{shift.end}</span>}
    </span>
  )
}

export function TierLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[12px] text-ink-500">
      {(['peak', 'normal', 'low'] as const).map((t) => (
        <span key={t} className="inline-flex items-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-full', TIER_STYLE[t].dot)} />
          {TIER_LABEL[t]}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <Crown size={12} className="text-amber-500" /> Ca trưởng
      </span>
    </div>
  )
}

export function DayHeader({ date, active }: { date: string; active?: boolean }) {
  const isToday = date === today()
  return (
    <div className={cn('text-center', active && 'text-brand-600')}>
      <p className={cn('text-[11px] font-bold uppercase tracking-wide', isToday ? 'text-brand-500' : 'text-ink-400')}>
        {DAY_SHORT[dowOf(date)]}
      </p>
      <p
        className={cn(
          'mt-0.5 inline-flex h-6 min-w-[24px] items-center justify-center rounded-lg px-1 text-[12px] font-bold',
          isToday ? 'bg-brand-500 text-white' : 'text-ink-700',
        )}
      >
        {formatDate(date).split('/')[0]}
      </p>
    </div>
  )
}

/** Danh sách avatar xếp chồng. */
export function AvatarStack({
  members,
  max = 4,
  size = 'xs',
}: {
  members: Member[]
  max?: number
  size?: 'xs' | 'sm' | 'md' | 'lg'
}) {
  const shown = members.slice(0, max)
  const rest = members.length - shown.length
  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((m) => (
        <Avatar key={m.id} id={m.id} name={m.name} size={size} ring />
      ))}
      {rest > 0 && (
        <span className="flex h-6 items-center justify-center rounded-full bg-ink-200 px-1.5 text-[9px] font-bold text-ink-600 ring-2 ring-white">
          +{rest}
        </span>
      )}
    </div>
  )
}

/** Vòng tròn hiển thị điểm uy tín. */
export function ScoreRing({ value, size = 44 }: { value: number; size?: number }) {
  const r = (size - 6) / 2
  const c = 2 * Math.PI * r
  const tone = value >= 85 ? '#10b981' : value >= 70 ? '#f59e0b' : '#f43f5e'
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EFEFF5" strokeWidth={4} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.21,.9,.35,1)' }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-[11px] font-extrabold"
        style={{ color: tone }}
      >
        {Math.round(value)}
      </span>
    </div>
  )
}

/** Thanh ngang đơn giản cho biểu đồ — không cần thư viện chart. */
export function BarRow({
  label,
  value,
  max,
  hint,
  tone = 'brand',
}: {
  label: React.ReactNode
  value: number
  max: number
  hint?: string
  tone?: 'brand' | 'emerald' | 'amber' | 'rose' | 'ink'
}) {
  const tones = {
    brand: 'bg-brand-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    ink: 'bg-ink-300',
  }
  return (
    <div className="flex items-center gap-3">
      <div className="w-[124px] shrink-0 truncate text-[12.5px] font-semibold text-ink-600">{label}</div>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-100">
        <div
          className={cn('h-full rounded-full transition-all duration-700', tones[tone])}
          style={{ width: `${max > 0 ? Math.max(2, (value / max) * 100) : 0}%` }}
        />
      </div>
      <div className="w-[54px] shrink-0 text-right text-[12px] font-bold tabular-nums text-ink-700">
        {hint ?? value.toFixed(1)}
      </div>
    </div>
  )
}

export function StatusDot({ tone }: { tone: 'good' | 'warn' | 'bad' | 'idle' }) {
  const tones = {
    good: 'bg-emerald-500',
    warn: 'bg-amber-500',
    bad: 'bg-rose-500',
    idle: 'bg-ink-300',
  }
  return <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full', tones[tone])} />
}

export function InfoBadge({ children }: { children: React.ReactNode }) {
  return (
    <Badge tone="neutral" className="text-[11px] font-medium">
      {children}
    </Badge>
  )
}
