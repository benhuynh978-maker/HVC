import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Award,
  Clock3,
  CalendarCheck2,
  CircleAlert,
  Crown,
  Flame,
  Repeat2,
  ShieldCheck,
  TriangleAlert,
  UserRoundCheck,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, StatCard } from '../components/ui'
import { AvatarStack, ScoreRing, ShiftTag, StatusDot } from '../components/shared'
import { computeContributions, computeWeekMetrics, isUnderStaffed, kpiState, presentCount } from '../lib/metrics'
import { KPI_TARGET, SHIFT_MAP } from '../data/config'
import {
  addDays,
  cn,
  formatDateLong,
  relativeDayLabel,
  today,
  weekStartOf,
} from '../lib/utils'

export function Dashboard() {
  const data = useStore((s) => s.data)
  const user = useStore((s) => s.data.members.find((m) => m.id === s.userId)!)

  const t = today()
  const thisWeek = weekStartOf(t)

  const metrics = useMemo(() => computeWeekMetrics(data, thisWeek), [data, thisWeek])
  const lastMetrics = useMemo(
    () => computeWeekMetrics(data, addDays(thisWeek, -7)),
    [data, thisWeek],
  )

  const memberMap = useMemo(
    () => Object.fromEntries(data.members.map((m) => [m.id, m])),
    [data.members],
  )

  /* Ca hôm nay */
  const todayShifts = useMemo(() => {
    return data.shifts
      .filter((s) => s.date === t)
      .map((s) => {
        const def = SHIFT_MAP[s.code]
        const list = data.assignments.filter((a) => a.shiftId === s.id)
        return {
          shift: s,
          def,
          members: list.filter((a) => !a.isStandby).map((a) => memberMap[a.memberId]).filter(Boolean),
          lead: memberMap[list.find((a) => a.isLead)?.memberId ?? ''],
          present: presentCount(s, data.assignments),
          under: isUnderStaffed(s, data.assignments),
        }
      })
      .sort((a, b) => (a.def?.start ?? '').localeCompare(b.def?.start ?? ''))
  }, [data, t, memberMap])

  /* Ca đang cần người (chợ ca) */
  const openShifts = useMemo(() => {
    return data.shifts
      .filter((s) => s.date >= t && s.status === 'published')
      .map((s) => ({ s, def: SHIFT_MAP[s.code], under: isUnderStaffed(s, data.assignments) }))
      .filter((x) => x.under)
      .sort((a, b) => a.s.date.localeCompare(b.s.date))
      .slice(0, 5)
  }, [data, t])

  const contributions = useMemo(
    () => computeContributions(data, [addDays(thisWeek, -7), thisWeek]).slice(0, 5),
    [data, thisWeek],
  )

  const trend = (now: number, before: number, higherIsBetter: boolean) => {
    const diff = now - before
    if (Math.abs(diff) < 0.5) return 'giữ nguyên so với tuần trước'
    const better = higherIsBetter ? diff > 0 : diff < 0
    return `${better ? '▲' : '▼'} ${Math.abs(diff).toFixed(0)} so với tuần trước`
  }

  const hour = new Date().getHours()
  const greet = hour < 11 ? 'Chào buổi sáng' : hour < 14 ? 'Chào buổi trưa' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'

  return (
    <>
      <PageHeader
        eyebrow={formatDateLong(t)}
        title={`${greet}, ${user.name.split(' ').slice(-1)[0]}!`}
        desc="Bảng điều khiển vận hành — theo dõi 4 chỉ số then chốt và xử lý những việc cần can thiệp ngay."
        action={
          <Link to="/schedule">
            <Button variant="outline" size="md">
              Xem lịch tuần <ArrowRight size={15} />
            </Button>
          </Link>
        }
      />

      {/* ---- 4 chỉ số then chốt ---- */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 stagger">
        <StatCard
          label="Có mặt đúng giờ"
          value={metrics.onTimeRate.toFixed(0)}
          unit="%"
          icon={<Clock3 size={15} />}
          progress={metrics.onTimeRate}
          state={kpiState(metrics.onTimeRate, KPI_TARGET.onTime.goal, KPI_TARGET.onTime.alert, true)}
          hint={`Mục tiêu ≥ ${KPI_TARGET.onTime.goal}% · ${trend(metrics.onTimeRate, lastMetrics.onTimeRate, true)}`}
        />
        <StatCard
          label="Ca trống (dưới định mức)"
          value={metrics.emptyShifts}
          unit="ca"
          icon={<TriangleAlert size={15} />}
          state={metrics.emptyShifts === 0 ? 'good' : metrics.emptyShifts < 2 ? 'warn' : 'bad'}
          progress={metrics.emptyShifts === 0 ? 100 : 100 - metrics.emptyShifts * 12}
          hint="Chỉ số không được phép khác 0 — chạm ngưỡng là họp khẩn trong 24h"
        />
        <StatCard
          label="Vắng không báo trước"
          value={metrics.noNoticeRate.toFixed(0)}
          unit="%"
          icon={<CircleAlert size={15} />}
          progress={100 - metrics.noNoticeRate * 4}
          state={kpiState(metrics.noNoticeRate, KPI_TARGET.noNotice.goal, KPI_TARGET.noNotice.alert, false)}
          hint={`Mục tiêu ≤ ${KPI_TARGET.noNotice.goal}% · ${trend(metrics.noNoticeRate, lastMetrics.noNoticeRate, false)}`}
        />
        <StatCard
          label="Đổi ca khớp thành công"
          value={metrics.swapMatchedRate.toFixed(0)}
          unit="%"
          icon={<Repeat2 size={15} />}
          progress={metrics.swapMatchedRate}
          state={kpiState(metrics.swapMatchedRate, KPI_TARGET.swapMatched.goal, KPI_TARGET.swapMatched.alert, true)}
          hint={`${metrics.swapCount} lượt xin đổi tuần này — số lượt nhiều không phải chỉ số xấu`}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* ---- Ca hôm nay ---- */}
        <Card className="lg:col-span-2 animate-fade-up">
          <CardHeader
            icon={<CalendarCheck2 size={17} />}
            title="Ca trực hôm nay"
            desc={`${todayShifts.length} ca phủ kín khung giờ hoạt động của Phòng Thanh niên`}
            action={
              <Link to="/attendance">
                <Button size="sm" variant="ghost">
                  Điểm danh <ArrowRight size={13} />
                </Button>
              </Link>
            }
          />
          <div className="border-t border-ink-100">
            {todayShifts.length === 0 ? (
              <EmptyState
                icon={<CalendarCheck2 size={22} />}
                title="Hôm nay chưa có ca nào"
                desc="Có thể lịch tuần này chưa được công bố, hoặc hôm nay ngoài khung giờ hoạt động."
              />
            ) : (
              <div className="divide-y divide-ink-100">
                {todayShifts.map(({ shift, def, members, lead, present, under }) => (
                  <div
                    key={shift.id}
                    className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-ink-50/60"
                  >
                    <div className="w-[92px] shrink-0">
                      <ShiftTag code={shift.code} showTime={false} />
                      <p className="mt-1 text-[11.5px] font-semibold text-ink-400">
                        {def?.start}–{def?.end}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold text-ink-800">{def?.name}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <AvatarStack members={members} />
                        {lead && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                            <Crown size={11} /> {lead.name.split(' ').slice(-1)[0]}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusDot tone={under ? 'bad' : 'good'} />
                      <span
                        className={cn(
                          'text-[12.5px] font-bold tabular-nums',
                          under ? 'text-rose-600' : 'text-emerald-600',
                        )}
                      >
                        {present}/{def?.minStaff}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* ---- Ghi nhận đóng góp ---- */}
        <Card className="animate-fade-up">
          <CardHeader
            icon={<Award size={17} />}
            title="Ghi nhận đóng góp"
            desc="Hai tuần gần nhất — chỉ vinh danh nhóm dẫn đầu"
          />
          <div className="space-y-3 border-t border-ink-100 px-5 py-4">
            {contributions.map((c, i) => (
              <div key={c.member.id} className="flex items-center gap-3">
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold',
                    i === 0
                      ? 'bg-amber-100 text-amber-700'
                      : i === 1
                        ? 'bg-ink-200 text-ink-600'
                        : i === 2
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-ink-100 text-ink-400',
                  )}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-ink-900">{c.member.name}</p>
                  <p className="text-[11.5px] text-ink-400">
                    {c.shifts} ca · {c.hours.toFixed(1)} giờ
                    {c.pickedUp > 0 && (
                      <span className="ml-1 font-semibold text-emerald-600">
                        · {c.pickedUp} ca cứu viện
                      </span>
                    )}
                  </p>
                </div>
                <ScoreRing value={c.member.staff.reliability} size={34} />
              </div>
            ))}
          </div>
          <div className="border-t border-ink-100 px-5 py-3">
            <p className="text-[11.5px] leading-relaxed text-ink-400">
              <ShieldCheck size={11} className="mr-1 inline" />
              Điểm uy tín chỉ hiển thị cho chính chủ. Bảng công khai không bao giờ nêu tên nhóm dưới.
            </p>
          </div>
        </Card>

        {/* ---- Ca cần người ---- */}
        <Card className="lg:col-span-2 animate-fade-up">
          <CardHeader
            icon={<Flame size={17} />}
            title="Ca đang cần người"
            desc="Ca chưa đủ định mức — cần chuyển sang chợ ca hoặc gọi dự bị"
            action={
              <Link to="/swaps">
                <Button size="sm" variant="ghost">
                  Mở chợ ca <ArrowRight size={13} />
                </Button>
              </Link>
            }
          />
          <div className="border-t border-ink-100">
            {openShifts.length === 0 ? (
              <EmptyState
                icon={<ShieldCheck size={22} />}
                title="Mọi ca đều đủ người"
                desc="Không có ca nào dưới định mức tối thiểu. Đây chính là mục tiêu số 1 của hệ thống."
              />
            ) : (
              <div className="divide-y divide-ink-100">
                {openShifts.map(({ s, def }) => {
                  const pool = useStore.getState().standbyPool(s.date, s.code)
                  return (
                    <div key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                      <ShiftTag code={s.code} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-ink-800">
                          {relativeDayLabel(s.date)} · {def?.name}
                        </p>
                        <p className="text-[11.5px] text-ink-400">
                          Có {pool.length} người rảnh khung giờ này trong danh sách dự bị
                        </p>
                      </div>
                      <Badge tone="danger">Thiếu người</Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </Card>

        {/* ---- Nhật ký ---- */}
        <Card className="animate-fade-up">
          <CardHeader icon={<UserRoundCheck size={17} />} title="Nhật ký vận hành" desc="Những gì vừa xảy ra" />
          <div className="max-h-[320px] space-y-3.5 overflow-y-auto border-t border-ink-100 px-5 py-4">
            {data.logs.slice(0, 12).map((l) => (
              <div key={l.id} className="flex gap-2.5">
                <StatusDot
                  tone={l.kind === 'success' ? 'good' : l.kind === 'warn' ? 'warn' : l.kind === 'danger' ? 'bad' : 'idle'}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] leading-relaxed text-ink-700">{l.text}</p>
                  <p className="mt-0.5 text-[11px] text-ink-300">
                    {new Date(l.at).toLocaleString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}
