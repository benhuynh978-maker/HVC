import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlarmClock,
  ArrowRight,
  CalendarCheck2,
  CalendarX2,
  Clock3,
  Crown,
  Flame,
  Repeat2,
  ShieldCheck,
  UserX,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, Segmented } from '../components/ui'
import { AvatarStack, ShiftTag } from '../components/shared'
import { computePersonalCounters, isUnderStaffed, presentCount, type StatPeriod } from '../lib/metrics'
import { SHIFT_MAP } from '../data/config'
import { cn, formatDateLong, parseShiftId, relativeDayLabel, today, tomorrow } from '../lib/utils'

/**
 * Tổng quan — giao diện Nhân viên. So với bản Admin (Dashboard.tsx), trang
 * này KHÔNG có: Ghi nhận đóng góp, Nhật ký vận hành, 4 thẻ % toàn ban.
 * Thay vào đó là 4 chỉ số CÁ NHÂN dạng số đếm, theo kỳ tự chọn.
 * Xem docs/THIET-KE-HE-THONG.md mục 5 và 6.2.
 */
export function StaffDashboard() {
  const data = useStore((s) => s.data)
  const user = useStore((s) => s.data.members.find((m) => m.id === s.userId)!)

  const [period, setPeriod] = useState<StatPeriod>('week')
  const t = today()
  const tmr = tomorrow()

  const memberMap = useMemo(
    () => Object.fromEntries(data.members.map((m) => [m.id, m])),
    [data.members],
  )

  const counters = useMemo(
    () => computePersonalCounters(data, user.id, period),
    [data, user.id, period],
  )

  /* Ca của tôi cần xác nhận (ngày mai) */
  const myPending = useMemo(
    () =>
      data.assignments
        .filter((a) => {
          if (a.memberId !== user.id || a.confirmStatus !== 'pending') return false
          const { date } = parseShiftId(a.shiftId)
          return date === tmr
        })
        .map((a) => ({ a, ...parseShiftId(a.shiftId) })),
    [data.assignments, user.id, tmr],
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

  /* Ca đang cần người (chợ ca) — vẫn có ích với nhân viên vì có thể nhận cứu viện */
  const openShifts = useMemo(() => {
    return data.shifts
      .filter((s) => s.date >= t && s.status === 'published')
      .map((s) => ({ s, def: SHIFT_MAP[s.code], under: isUnderStaffed(s, data.assignments) }))
      .filter((x) => x.under)
      .sort((a, b) => a.s.date.localeCompare(b.s.date))
      .slice(0, 5)
  }, [data, t])

  const hour = new Date().getHours()
  const greet = hour < 11 ? 'Chào buổi sáng' : hour < 14 ? 'Chào buổi trưa' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'

  return (
    <>
      <PageHeader
        eyebrow={formatDateLong(t)}
        title={`${greet}, ${user.name.split(' ').slice(-1)[0]}!`}
        desc="Đây là những gì đang chờ bạn hôm nay và ngày mai."
        action={
          <Link to="/schedule">
            <Button variant="outline" size="md">
              Xem lịch tuần <ArrowRight size={15} />
            </Button>
          </Link>
        }
      />

      {/* ---- Việc cần xử lý ngay ---- */}
      {myPending.length > 0 && (
        <Card className="mb-6 overflow-hidden border-brand-200 animate-fade-up">
          <div className="flex flex-col gap-4 bg-gradient-to-r from-brand-50 to-white p-5 sm:flex-row sm:items-center">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white animate-pulse-ring">
              <AlarmClock size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold text-ink-900">
                Bạn có {myPending.length} ca vào ngày mai cần xác nhận
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-500">
                Hạn xác nhận là <strong>22:00 tối nay</strong>. Nếu không trực được, hãy báo ngay — ca
                sẽ tự động mở cho người dự bị và bạn <strong>không bị trừ điểm uy tín</strong>.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {myPending.map(({ a, code }) => (
                  <ShiftTag key={a.id} code={code} />
                ))}
              </div>
            </div>
            <Link to="/my" className="shrink-0">
              <Button size="md">
                Xác nhận ngay <ArrowRight size={15} />
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* ---- 4 chỉ số cá nhân theo kỳ ---- */}
      <div className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[13.5px] font-bold text-ink-800">Hoạt động của bạn</p>
            <p className="text-[12px] text-ink-400">{counters.label}</p>
          </div>
          <Segmented
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'week', label: 'Tuần' },
              { value: 'month', label: 'Tháng' },
              { value: 'season', label: 'Cả mùa' },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 stagger">
          <CountCard label="Đi trễ" value={counters.late} icon={<Clock3 size={15} />} warn={counters.late > 0} />
          <CountCard
            label="Nghỉ có báo trước"
            value={counters.excusedAbsence}
            icon={<CalendarX2 size={15} />}
          />
          <CountCard label="Ca đã đổi" value={counters.swapCount} icon={<Repeat2 size={15} />} />
          <CountCard
            label="Báo không phép"
            value={counters.unauthorizedAbsence}
            icon={<UserX size={15} />}
            warn={counters.unauthorizedAbsence > 0}
            danger
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* ---- Ca hôm nay ---- */}
        <Card className="animate-fade-up">
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
                    <span
                      className={cn(
                        'text-[12.5px] font-bold tabular-nums',
                        under ? 'text-rose-600' : 'text-emerald-600',
                      )}
                    >
                      {present}/{def?.minStaff}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* ---- Ca cần người ---- */}
        <Card className="animate-fade-up">
          <CardHeader
            icon={<Flame size={17} />}
            title="Ca đang cần người"
            desc="Rảnh khung giờ này? Nhận ngay để cứu viện và được cộng điểm ghi nhận"
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
                desc="Không có ca nào dưới định mức tối thiểu lúc này."
              />
            ) : (
              <div className="divide-y divide-ink-100">
                {openShifts.map(({ s, def }) => (
                  <div key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                    <ShiftTag code={s.code} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-ink-800">
                        {relativeDayLabel(s.date)} · {def?.name}
                      </p>
                    </div>
                    <Badge tone="danger">Thiếu người</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  )
}

function CountCard({
  label,
  value,
  icon,
  warn,
  danger,
}: {
  label: string
  value: number
  icon: React.ReactNode
  warn?: boolean
  danger?: boolean
}) {
  const tone = warn ? (danger ? 'text-rose-600' : 'text-amber-600') : 'text-ink-800'
  const iconTone = warn ? (danger ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600') : 'bg-brand-50 text-brand-600'
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="label">{label}</p>
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', iconTone)}>{icon}</div>
      </div>
      <p className={cn('mt-3 text-[28px] font-extrabold leading-none tracking-tight', tone)}>{value}</p>
      <p className="mt-2.5 text-[12px] text-ink-400">ca trong kỳ đã chọn</p>
    </Card>
  )
}
