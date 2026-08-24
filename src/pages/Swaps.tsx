import { useMemo, useState } from 'react'
import { HandHeart, Repeat2, ShieldCheck, Users2 } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Badge, Button, Callout, Card, EmptyState, PageHeader, Tab, TabList, Tabs } from '../components/ui'
import { AvatarStack, ShiftTag } from '../components/shared'
import { SHIFT_MAP } from '../data/config'
import { formatDateLong, parseShiftId, relativeDayLabel, today } from '../lib/utils'
import type { Assignment, Member, SwapRequest } from '../types'

interface OpenSwapItem {
  sw: SwapRequest
  a: Assignment
  date: string
  code: string
  def: (typeof SHIFT_MAP)[string] | undefined
  from: Member
}

/**
 * "Chợ ca" — Lớp 3 của quy trình 4 lớp (Đề mục 2.4) + danh sách dự bị tự sinh.
 * Mọi trao đổi đi qua đây, không thoả thuận riêng qua tin nhắn — đúng quy tắc
 * chống "ca mồ côi" ở mục 3.6 của bài làm.
 */
export function Swaps() {
  const user = useStore((s) => s.data.members.find((m) => m.id === s.userId)!)
  const data = useStore((s) => s.data)
  const claimShift = useStore((s) => s.claimShift)
  const standbyPool = useStore((s) => s.standbyPool)

  const [tab, setTab] = useState<'market' | 'standby'>('market')
  const t = today()

  const memberMap = useMemo(
    () => Object.fromEntries(data.members.map((m) => [m.id, m])),
    [data.members],
  )

  const openSwaps = useMemo(() => {
    const items: OpenSwapItem[] = []
    for (const sw of data.swaps) {
      if (sw.status !== 'open') continue
      const a = data.assignments.find((x) => x.id === sw.assignmentId)
      if (!a) continue
      const { date, code } = parseShiftId(a.shiftId)
      if (date < t) continue
      const from = memberMap[sw.fromMemberId]
      if (!from) continue
      items.push({ sw, a, date, code, def: SHIFT_MAP[code], from })
    }
    return items.sort((x, y) => x.date.localeCompare(y.date))
  }, [data.swaps, data.assignments, memberMap, t])

  const upcomingShifts = useMemo(
    () =>
      data.shifts
        .filter((s) => s.date >= t && s.status === 'published')
        .sort((a, b) => (a.date + a.code).localeCompare(b.date + b.code))
        .slice(0, 40),
    [data.shifts, t],
  )

  const eligibleToClaim = (date: string, code: string) => {
    const pool = standbyPool(date, code)
    return pool.some((m) => m.id === user.id)
  }

  return (
    <>
      <PageHeader
        title="Đổi ca & Dự bị"
        desc="Mọi trao đổi đi qua hệ thống — không thoả thuận riêng. Ca vẫn thuộc trách nhiệm người nhả cho tới khi có người bấm nhận."
      />

      <Tabs value={tab} onChange={(v) => setTab(v as typeof tab)}>
        <TabList className="mb-5">
          <Tab value="market">
            <span className="inline-flex items-center gap-1.5">
              <Repeat2 size={14} /> Chợ ca ({openSwaps.length})
            </span>
          </Tab>
          <Tab value="standby">
            <span className="inline-flex items-center gap-1.5">
              <Users2 size={14} /> Danh sách dự bị
            </span>
          </Tab>
        </TabList>
      </Tabs>

      {tab === 'market' && (
        <div className="space-y-3">
          <Callout tone="info" icon={<ShieldCheck size={14} />} className="mb-2">
            Ca hiện trên chợ này là những ca người trực đã báo <strong>không thể tham gia</strong>.
            Ai rảnh và bấm nhận trước sẽ được xếp — không cần chờ duyệt, và được{' '}
            <strong>+5 điểm ghi nhận</strong> vì đã cứu viện.
          </Callout>

          {openSwaps.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Repeat2 size={22} />}
                title="Chợ ca đang trống"
                desc="Không có ca nào cần người thay thế lúc này — đây là dấu hiệu tốt."
              />
            </Card>
          ) : (
            openSwaps.map(({ sw, a, date, code, def, from }) => {
              const canClaim = eligibleToClaim(date, code) && from.id !== user.id
              return (
                <Card key={sw.id} className="flex flex-wrap items-center gap-3 p-4 animate-fade-up">
                  <ShiftTag code={code} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold text-ink-800">
                      {relativeDayLabel(date)} · {def?.name}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-400">
                      <AvatarStack members={[from]} max={1} size="xs" />
                      {from.name} không thể trực · "{sw.reason}"
                    </p>
                  </div>
                  {canClaim ? (
                    <Button size="sm" variant="success" onClick={() => claimShift(a.shiftId, user.id, sw.id)}>
                      <HandHeart size={14} /> Nhận ca này
                    </Button>
                  ) : (
                    <Badge tone="neutral">
                      {from.id === user.id ? 'Ca của bạn' : 'Bạn không rảnh khung này'}
                    </Badge>
                  )}
                </Card>
              )
            })
          )}
        </div>
      )}

      {tab === 'standby' && (
        <div className="space-y-3">
          <Callout tone="brand" icon={<Users2 size={14} />} className="mb-2">
            Danh sách dự bị của mỗi ca <strong>được tính tự động</strong>: đó là những người đã
            khai rảnh khung giờ đó nhưng chưa được xếp trực. Không ai phải lập danh sách thủ công.
          </Callout>

          {upcomingShifts.map((s) => {
            const def = SHIFT_MAP[s.code]
            const pool = standbyPool(s.date, s.code)
            const under = data.assignments.filter((a) => a.shiftId === s.id && !a.isStandby).length < (def?.minStaff ?? 0)
            if (!pool.length && !under) return null
            return (
              <Card key={s.id} className="p-4 animate-fade-up">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <ShiftTag code={s.code} />
                    <div>
                      <p className="text-[13px] font-semibold text-ink-800">
                        {relativeDayLabel(s.date)} · {def?.name}
                      </p>
                      <p className="text-[11.5px] text-ink-400">{formatDateLong(s.date)}</p>
                    </div>
                  </div>
                  {under && <Badge tone="danger">Đang thiếu người</Badge>}
                </div>
                {pool.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-100 pt-3">
                    {pool.map((m) => (
                      <div key={m.id} className="flex items-center gap-1.5 rounded-full border border-ink-100 py-1 pl-1 pr-2.5">
                        <AvatarStack members={[m]} max={1} size="xs" />
                        <span className="text-[11.5px] font-semibold text-ink-600">{m.name}</span>
                        {m.id === user.id && (
                          <button
                            onClick={() => claimShift(s.id, user.id)}
                            className="ml-1 rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-brand-600"
                          >
                            Nhận ca
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 border-t border-ink-100 pt-3 text-[12px] text-ink-400">
                    Không có ai rảnh khung giờ này ngoài đội đang trực.
                  </p>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
