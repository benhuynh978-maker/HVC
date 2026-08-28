import { useEffect, useMemo, useState } from 'react'
import {
  Car,
  Lock,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Trophy,
  Users,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { Badge, Button, Callout, Card, EmptyState, Modal, PageHeader, useConfirm } from '../components/ui'
import { AvatarStack, ScoreRing } from '../components/shared'
import { GROUP_LABEL, SKILL_LABEL, TRAVEL_BUFFER_MIN } from '../data/config'
import { cn, formatDateLong, hasStaffProfile, relativeDayLabel } from '../lib/utils'
import type { ExternalEvent, StaffMember } from '../types'

/**
 * Điểm bán ngoài (Đề mục 4). Điểm mấu chốt: khi "Chốt & khoá lịch" được bấm,
 * store.lockEvent() thực thi ràng buộc cứng H3 — tự động gỡ mọi ca trực phòng
 * trùng giờ (kèm đệm di chuyển 60 phút) và đẩy sang chợ ca. Đây là cơ chế
 * chống xung đột giữa hai kênh bán mà đề bài yêu cầu.
 */
export function External() {
  const user = useStore((s) => s.data.members.find((m) => m.id === s.userId)!)
  const data = useStore((s) => s.data)
  const isManager = useStore((s) => s.isManager)()
  const applyToEvent = useStore((s) => s.applyToEvent)
  const withdrawFromEvent = useStore((s) => s.withdrawFromEvent)
  const setEventSelection = useStore((s) => s.setEventSelection)
  const lockEvent = useStore((s) => s.lockEvent)
  const { ask, node } = useConfirm()

  const [openEvent, setOpenEvent] = useState<ExternalEvent | null>(null)
  const memberMap = useMemo(
    () => Object.fromEntries(data.members.map((m) => [m.id, m])),
    [data.members],
  )

  const events = [...data.events].sort((a, b) => a.date.localeCompare(b.date))

  return (
    <>
      <PageHeader
        title="Điểm bán ngoài"
        desc="Đăng ký nguyện vọng theo sự kiện, hệ thống chấm điểm và đề xuất danh sách. Khi chốt, lịch trực phòng trùng giờ được tự động khoá — không cần rà soát thủ công."
      />

      <Callout tone="brand" icon={<ShieldCheck size={15} />} className="mb-6">
        <strong>Nguyên tắc số 1 — Một lịch duy nhất.</strong> Khi một sự kiện được chốt, mọi khung
        giờ trực phòng trùng (kèm đệm di chuyển {TRAVEL_BUFFER_MIN} phút trước/sau) của người tham
        gia sẽ tự động bị khoá và đẩy sang chợ ca. Không thể xảy ra tình trạng một người bị xếp
        cùng lúc ở hai kênh.
      </Callout>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 stagger">
        {events.map((ev) => {
          const applied = ev.applicants.includes(user.id)
          const selected = ev.selected.includes(user.id)
          const eligible = !!user.staff && user.staff.canTravel && user.staff.reliability >= 80

          return (
            <Card key={ev.id} hover className="flex flex-col overflow-hidden">
              <div className="border-b border-ink-100 bg-gradient-to-br from-brand-50/60 to-white p-5">
                <div className="flex items-start justify-between gap-2">
                  <Badge tone={ev.status === 'open' ? 'info' : ev.status === 'locked' ? 'success' : 'neutral'}>
                    {ev.status === 'open' ? 'Đang mở đăng ký' : ev.status === 'locked' ? 'Đã chốt' : 'Hoàn tất'}
                  </Badge>
                  <span className="text-[11px] font-bold text-brand-500">{relativeDayLabel(ev.date)}</span>
                </div>
                <h3 className="mt-2.5 text-[15px] font-extrabold leading-snug text-ink-900">{ev.name}</h3>
                <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-ink-500">
                  <MapPin size={12} /> {ev.location}
                </p>
                <p className="mt-1 text-[12px] text-ink-500">
                  {formatDateLong(ev.date)} · {ev.start}–{ev.end}
                </p>
              </div>

              <div className="flex-1 space-y-3 p-5">
                <p className="text-[12.5px] leading-relaxed text-ink-500">{ev.note}</p>
                <div className="flex items-center gap-2 text-[12px] text-ink-500">
                  <Users size={13} />
                  Cần <strong className="text-ink-800">{ev.needed}</strong> người · {ev.applicants.length} đã đăng ký
                </div>
                {ev.selected.length > 0 && (
                  <div className="flex items-center gap-2">
                    <AvatarStack members={ev.selected.map((id) => memberMap[id]).filter(Boolean)} max={5} size="sm" />
                    <span className="text-[11.5px] text-ink-400">đã được chọn</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 border-t border-ink-100 p-4">
                {isManager ? (
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setOpenEvent(ev)}>
                    <Sparkles size={14} /> Quản lý ứng viên
                  </Button>
                ) : selected ? (
                  <Badge tone="success" className="w-full justify-center py-1.5">
                    <Trophy size={12} /> Bạn đã được chọn!
                  </Badge>
                ) : applied ? (
                  <Button size="sm" variant="ghost" className="flex-1" onClick={() => withdrawFromEvent(ev.id, user.id)}>
                    Rút đăng ký
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={!eligible || ev.status !== 'open'}
                    onClick={() => applyToEvent(ev.id, user.id)}
                  >
                    <Star size={14} /> Đăng ký nguyện vọng
                  </Button>
                )}
              </div>
              {!isManager && !eligible && !selected && (
                <p className="border-t border-ink-100 px-4 py-2.5 text-[11px] leading-relaxed text-amber-600">
                  <ShieldAlert size={11} className="mr-1 inline" />
                  Cần: có thể di chuyển + điểm uy tín ≥80.
                </p>
              )}
            </Card>
          )
        })}
      </div>

      {events.length === 0 && (
        <Card>
          <EmptyState icon={<Store size={22} />} title="Chưa có sự kiện điểm bán ngoài nào" />
        </Card>
      )}

      <ManageEventModal
        event={openEvent}
        onClose={() => setOpenEvent(null)}
        onLock={(id) =>
          ask(
            'Chốt danh sách & khoá lịch?',
            'Hệ thống sẽ tự động gỡ mọi ca trực phòng trùng giờ (kèm đệm 60 phút) của người được chọn và đẩy sang chợ ca. Hành động này không thể hoàn tác.',
            () => {
              lockEvent(id)
              setOpenEvent(null)
            },
          )
        }
        onSave={setEventSelection}
      />
      {node}
    </>
  )
}

/* -------------------------------------------------------------------- */

function scoreOf(m: StaffMember, ev: ExternalEvent): number {
  let score = 0
  score += m.staff.reliability >= 90 ? 25 : m.staff.reliability >= 80 ? 18 : 8
  score += m.staff.canTravel ? 10 : 0
  score += ev.applicants.length ? 5 : 0
  score += m.staff.skills.includes('cashier') || m.staff.skills.includes('sales') ? 15 : 5
  return score
}

function ManageEventModal({
  event,
  onClose,
  onLock,
  onSave,
}: {
  event: ExternalEvent | null
  onClose: () => void
  onLock: (id: string) => void
  onSave: (id: string, selected: string[], standby: string[]) => void
}) {
  const data = useStore((s) => s.data)
  const memberMap = useMemo(
    () => Object.fromEntries(data.members.map((m) => [m.id, m])),
    [data.members],
  )
  const [picked, setPicked] = useState<Set<string>>(new Set())

  const candidates = useMemo(() => {
    if (!event) return []
    return event.applicants
      .map((id) => memberMap[id])
      .filter(Boolean)
      .filter(hasStaffProfile)
      .map((m) => ({ m, score: scoreOf(m, event) }))
      .sort((a, b) => b.score - a.score)
  }, [event, memberMap])

  useEffect(() => {
    if (event) setPicked(new Set(event.selected))
  }, [event])

  if (!event) return null

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Modal
      open={!!event}
      onClose={onClose}
      wide
      title={event.name}
      desc={`Cần ${event.needed} người · ${candidates.length} ứng viên hợp lệ, xếp hạng theo điểm uy tín, kỹ năng và khả năng di chuyển`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Đóng</Button>
          <Button
            variant="outline"
            onClick={() => onSave(event.id, [...picked], candidates.filter((c) => !picked.has(c.m.id)).slice(0, 2).map((c) => c.m.id))}
          >
            Lưu danh sách
          </Button>
          <Button variant="success" onClick={() => onLock(event.id)} disabled={event.status !== 'open'}>
            <Lock size={14} /> Chốt & khoá lịch
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        {candidates.map(({ m, score }) => {
          const active = picked.has(m.id)
          return (
            <button
              key={m.id}
              onClick={() => toggle(m.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all',
                active ? 'border-brand-300 bg-brand-50' : 'border-ink-100 hover:border-ink-200',
              )}
            >
              <AvatarStack members={[m]} max={1} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-ink-900">{m.name}</p>
                <p className="flex flex-wrap items-center gap-1 text-[11px] text-ink-400">
                  {GROUP_LABEL[m.group]} · {m.staff.skills.map((s) => SKILL_LABEL[s]).join(', ')}
                  {m.staff.canTravel && (
                    <span className="inline-flex items-center gap-0.5 text-emerald-600">
                      <Car size={10} /> có thể di chuyển
                    </span>
                  )}
                </p>
              </div>
              <ScoreRing value={m.staff.reliability} size={32} />
              <div className="w-16 text-right">
                <p className="text-[10px] font-semibold text-ink-400">Điểm ưu tiên</p>
                <p className="text-[14px] font-extrabold text-brand-600">{score}</p>
              </div>
              {active && <Badge tone="success">Chọn</Badge>}
            </button>
          )
        })}
        {candidates.length === 0 && (
          <p className="py-8 text-center text-[13px] text-ink-400">Chưa có ai đăng ký nguyện vọng cho sự kiện này.</p>
        )}
      </div>
    </Modal>
  )
}
