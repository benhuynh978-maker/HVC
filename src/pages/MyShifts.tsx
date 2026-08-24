import { useMemo, useState } from 'react'
import { CalendarX2, CheckCircle2, Clock3, Crown, HelpCircle, ShieldCheck, XCircle } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Badge, Button, Callout, Card, CardHeader, EmptyState, Modal, PageHeader } from '../components/ui'
import { ScoreRing, ShiftTag } from '../components/shared'
import { SHIFT_MAP, CONFIRM_DEADLINE_HOUR } from '../data/config'
import { formatDateLong, parseShiftId, relativeDayLabel, today } from '../lib/utils'
import type { Assignment, ShiftDef } from '../types'

interface MyShiftItem {
  a: Assignment
  date: string
  code: string
  def: ShiftDef | undefined
}

/**
 * "Ca của tôi" — nơi thực thi trực tiếp cơ chế XÁC NHẬN D-1 (mục 3.5 của kế hoạch).
 * Đây là màn hình thành viên mở nhiều nhất mỗi ngày.
 */
export function MyShifts() {
  const user = useStore((s) => s.data.members.find((m) => m.id === s.userId)!)
  const data = useStore((s) => s.data)
  const confirmAssignment = useStore((s) => s.confirmAssignment)
  const declineAssignment = useStore((s) => s.declineAssignment)

  const [declineTarget, setDeclineTarget] = useState<Assignment | null>(null)
  const [reason, setReason] = useState('')

  const t = today()

  const mine = useMemo(() => {
    return data.assignments
      .filter((a) => a.memberId === user.id)
      .map((a) => ({ a, ...parseShiftId(a.shiftId), def: SHIFT_MAP[parseShiftId(a.shiftId).code] }))
      .filter((x) => x.date >= t)
      .sort((x, y) => (x.date + x.def?.start).localeCompare(y.date + y.def?.start))
  }, [data.assignments, user.id, t])

  const upcoming = mine.filter((x) => x.date !== t)
  const now = mine.filter((x) => x.date === t)

  const needsConfirm = mine.filter((x) => x.a.confirmStatus === 'pending')

  const hourNow = new Date().getHours()
  const deadlinePassed = hourNow >= CONFIRM_DEADLINE_HOUR

  const openDecline = (a: Assignment) => {
    setDeclineTarget(a)
    setReason('')
  }

  const submitDecline = () => {
    if (!declineTarget) return
    declineAssignment(declineTarget.id, reason.trim() || 'Không nêu lý do')
    setDeclineTarget(null)
  }

  return (
    <>
      <PageHeader
        title="Ca của tôi"
        desc="Xác nhận ca sắp tới, hoặc báo sớm nếu bạn không trực được — báo trước luôn dễ và không có hệ quả tiêu cực."
        action={<ScoreRingCard reliability={user.staff?.reliability ?? 0} />}
      />

      {needsConfirm.length > 0 && (
        <Callout
          tone={deadlinePassed ? 'danger' : 'brand'}
          icon={<Clock3 size={16} />}
          title={`${needsConfirm.length} ca đang chờ bạn xác nhận`}
          className="mb-6"
        >
          Hạn xác nhận là <strong>{CONFIRM_DEADLINE_HOUR}:00 tối hôm trước ngày trực</strong>. Sau
          giờ này, ca của bạn sẽ chuyển sang trạng thái "rủi ro" và điều phối viên sẽ chủ động gọi
          xác minh.
        </Callout>
      )}

      {now.length > 0 && (
        <Section title="Hôm nay" items={now} onDecline={openDecline} onConfirm={confirmAssignment} readOnlyConfirm />
      )}

      <Section title="Sắp tới" items={upcoming} onDecline={openDecline} onConfirm={confirmAssignment} />

      {mine.length === 0 && (
        <Card>
          <EmptyState
            icon={<CalendarX2 size={22} />}
            title="Bạn chưa có ca nào sắp tới"
            desc="Có thể lịch tuần sau chưa được công bố, hoặc bạn chưa được xếp vào ca nào. Hãy cập nhật lịch rảnh để hệ thống xếp bạn vào tuần kế tiếp."
          />
        </Card>
      )}

      <Modal
        open={!!declineTarget}
        onClose={() => setDeclineTarget(null)}
        title="Báo không trực được ca này"
        desc="Không sao cả — điều quan trọng nhất là bạn báo sớm. Ca sẽ được mở ngay cho danh sách dự bị."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeclineTarget(null)}>
              Quay lại
            </Button>
            <Button variant="danger" onClick={submitDecline}>
              Xác nhận không trực được
            </Button>
          </>
        }
      >
        {declineTarget && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ShiftTag code={parseShiftId(declineTarget.shiftId).code} />
              <span className="text-[13px] font-semibold text-ink-600">
                {relativeDayLabel(parseShiftId(declineTarget.shiftId).date)}
              </span>
            </div>
            <div>
              <label className="label mb-1.5 block">Lý do (không bắt buộc)</label>
              <textarea
                className="input min-h-[84px] resize-none"
                placeholder="Ví dụ: trùng lịch kiểm tra giữa kỳ..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <Callout tone="success" icon={<ShieldCheck size={14} />}>
              Vì bạn báo trước hạn nên <strong>không có bất kỳ hệ quả tiêu cực nào</strong>. Đây
              chính là hành xử được hệ thống khuyến khích.
            </Callout>
          </div>
        )}
      </Modal>
    </>
  )
}

function ScoreRingCard({ reliability }: { reliability: number }) {
  return (
    <Card className="flex items-center gap-3 px-4 py-2.5">
      <ScoreRing value={reliability} size={38} />
      <div>
        <p className="text-[11px] font-semibold text-ink-400">Điểm uy tín</p>
        <p className="text-[12.5px] font-bold text-ink-800">Chỉ mình bạn thấy</p>
      </div>
    </Card>
  )
}

function Section({
  title,
  items,
  onConfirm,
  onDecline,
  readOnlyConfirm,
}: {
  title: string
  items: MyShiftItem[]
  onConfirm: (id: string) => void
  onDecline: (a: Assignment) => void
  readOnlyConfirm?: boolean
}) {
  if (!items.length) return null
  return (
    <Card className="mb-5 animate-fade-up">
      <CardHeader title={title} />
      <div className="divide-y divide-ink-100 border-t border-ink-100">
        {items.map(({ a, date, code, def }) => (
          <div key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
            <ShiftTag code={code} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-800">
                {def?.name}
                {a.isLead && (
                  <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-600">
                    <Crown size={11} /> Ca trưởng
                  </span>
                )}
              </p>
              <p className="text-[12px] text-ink-400">
                {relativeDayLabel(date)} · {formatDateLong(date)}
              </p>
            </div>

            <StatusPill a={a} />

            {!readOnlyConfirm && a.confirmStatus === 'pending' && (
              <div className="flex gap-2">
                <Button size="sm" variant="danger" onClick={() => onDecline(a)}>
                  <XCircle size={14} /> Không thể trực
                </Button>
                <Button size="sm" variant="success" onClick={() => onConfirm(a.id)}>
                  <CheckCircle2 size={14} /> Xác nhận
                </Button>
              </div>
            )}
            {!readOnlyConfirm && a.confirmStatus === 'confirmed' && (
              <Button size="sm" variant="ghost" onClick={() => onDecline(a)} className="text-ink-400">
                Đổi ý? Báo không trực được
              </Button>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

function StatusPill({ a }: { a: Assignment }) {
  if (a.confirmStatus === 'confirmed')
    return (
      <Badge tone="success">
        <CheckCircle2 size={12} /> Đã xác nhận
      </Badge>
    )
  if (a.confirmStatus === 'declined')
    return (
      <Badge tone="neutral" className="text-ink-400">
        <XCircle size={12} /> Đã báo không trực
      </Badge>
    )
  return (
    <Badge tone="warn">
      <HelpCircle size={12} /> Chờ xác nhận
    </Badge>
  )
}
