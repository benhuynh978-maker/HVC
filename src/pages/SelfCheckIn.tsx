import { useMemo, useState } from 'react'
import { CalendarCheck2, CheckCircle2, Clock3, Crown, RotateCcw, UserRoundCheck, Wrench } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Button, Card, CardHeader, EmptyState, PageHeader, Segmented } from '../components/ui'
import { ShiftTag } from '../components/shared'
import { ATTENDANCE_LABEL, ATTENDANCE_STYLE, RELIABILITY_DELTA, SHIFTS, SHIFT_MAP } from '../data/config'
import { cn, minutesOf, parseShiftId, today } from '../lib/utils'
import type { Assignment, AttendanceStatus, ShiftDef } from '../types'

/**
 * "Điểm danh" phía Nhân viên — KHÔNG phải bảng cả đội như bên Admin
 * (`Attendance.tsx`), mà là giao diện tự điểm danh (self check-in) cho
 * đúng ca của chính người đăng nhập, chỉ trong ngày hôm nay. Không hiển
 * thị tên/trạng thái của bất kỳ ai khác — kể cả khi là ca trưởng.
 *
 * Lịch sử điểm danh các ngày trước đã xem được qua "Ca của tôi", nên
 * trang này cố tình chỉ tập trung vào hành động "hôm nay".
 */
export function SelfCheckIn() {
  const user = useStore((s) => s.data.members.find((m) => m.id === s.userId)!)
  const data = useStore((s) => s.data)
  const setAttendance = useStore((s) => s.setAttendance)

  const t = today()
  const [nowMinutes, setNowMinutes] = useState(() => currentMinutes())

  const todayShifts = useMemo(() => {
    return data.assignments
      .filter((a) => {
        if (a.memberId !== user.id) return false
        if (a.confirmStatus === 'declined') return false
        const { date } = parseShiftId(a.shiftId)
        return date === t
      })
      .map((a) => ({ a, def: SHIFT_MAP[parseShiftId(a.shiftId).code] }))
      .filter((x) => !!x.def)
      .sort((x, y) => x.def!.start.localeCompare(y.def!.start))
  }, [data.assignments, user.id, t])

  const checkIn = (a: Assignment) => {
    setNowMinutes(currentMinutes()) // làm mới mốc thời gian ngay lúc bấm, cho chính xác
    const def = SHIFT_MAP[parseShiftId(a.shiftId).code]
    if (!def) return
    const status = statusFor(minutesOf(def.start), currentMinutes())
    setAttendance(a.id, status)
  }

  // ------------------------------------------------------------------
  // Chế độ xem thử — CHỈ tồn tại trong bản dev (import.meta.env.DEV),
  // Vite loại bỏ toàn bộ khối này khỏi bundle khi `npm run build`.
  // Không đụng vào store thật — mọi tương tác chỉ đổi state cục bộ.
  // ------------------------------------------------------------------
  const isDev = import.meta.env.DEV
  const [previewMode, setPreviewMode] = useState<'off' | 'force-has' | 'force-empty'>('off')
  const [simAttendance, setSimAttendance] = useState<AttendanceStatus>('none')
  const [simCheckInAt, setSimCheckInAt] = useState<string | undefined>()

  const simDef: ShiftDef = useMemo(() => {
    // Chọn ca có giờ bắt đầu gần với hiện tại nhất, để việc bấm thử ra
    // kết quả "đúng giờ/trễ" trông hợp lý thay vì luôn lệch quá xa.
    const nowMin = currentMinutes()
    return [...SHIFTS].sort(
      (x, y) => Math.abs(minutesOf(x.start) - nowMin) - Math.abs(minutesOf(y.start) - nowMin),
    )[0]
  }, [])

  const simCheckIn = () => {
    const status = statusFor(minutesOf(simDef.start), currentMinutes())
    setSimAttendance(status)
    setSimCheckInAt(new Date().toISOString())
  }
  const resetPreview = () => {
    setSimAttendance('none')
    setSimCheckInAt(undefined)
  }

  const effectiveMode: 'has' | 'empty' =
    previewMode === 'off' ? (todayShifts.length > 0 ? 'has' : 'empty') : previewMode === 'force-has' ? 'has' : 'empty'

  return (
    <>
      <PageHeader
        title="Điểm danh"
        desc="Tự xác nhận có mặt cho ca của bạn hôm nay. Trang này chỉ hiển thị ca của riêng bạn."
      />

      {isDev && (
        <div className="mb-5 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <p className="flex items-center gap-1.5 text-[12px] font-bold text-amber-700">
              <Wrench size={13} /> Chế độ xem thử (chỉ hiện khi phát triển)
            </p>
            <Segmented
              value={previewMode}
              onChange={(v) => {
                setPreviewMode(v)
                resetPreview()
              }}
              options={[
                { value: 'off', label: 'Dữ liệu thật' },
                { value: 'force-has', label: 'Có ca' },
                { value: 'force-empty', label: 'Không có ca' },
              ]}
            />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-amber-700/80">
            Dùng để xem trước giao diện ở cả 2 trường hợp mà không cần đợi đúng ngày có ca thật. Bản
            build thật (deploy) sẽ không có khối này.
          </p>
        </div>
      )}

      {effectiveMode === 'empty' ? (
        <Card>
          <EmptyState
            icon={<CalendarCheck2 size={22} />}
            title="Hôm nay bạn không có ca nào"
            desc="Không có gì để điểm danh. Xem lịch sắp tới ở mục &quot;Ca của tôi&quot;."
          />
        </Card>
      ) : previewMode === 'force-has' ? (
        <div className="space-y-3">
          <ShiftCheckInCard
            def={simDef}
            isLead={false}
            attendance={simAttendance}
            checkInAt={simCheckInAt}
            ended={false}
            onCheckIn={simCheckIn}
          />
          {simAttendance !== 'none' && (
            <Button size="sm" variant="ghost" onClick={resetPreview}>
              <RotateCcw size={13} /> Đặt lại xem thử
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {todayShifts.map(({ a, def }) => (
            <ShiftCheckInCard
              key={a.id}
              def={def!}
              isLead={a.isLead}
              attendance={a.attendance}
              checkInAt={a.checkInAt}
              ended={nowMinutes > minutesOf(def!.end)}
              onCheckIn={() => checkIn(a)}
            />
          ))}
        </div>
      )}
    </>
  )
}

function ShiftCheckInCard({
  def,
  isLead,
  attendance,
  checkInAt,
  ended,
  onCheckIn,
}: {
  def: ShiftDef
  isLead: boolean
  attendance: AttendanceStatus
  checkInAt?: string
  ended: boolean
  onCheckIn: () => void
}) {
  const notYetChecked = attendance === 'none'
  return (
    <Card className="overflow-hidden animate-fade-up">
      <CardHeader
        icon={<ShiftTag code={def.code} showTime={false} />}
        title={
          <span className="flex items-center gap-1.5">
            {def.name}
            {isLead && (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-amber-600">
                <Crown size={11} /> Ca trưởng
              </span>
            )}
          </span>
        }
        desc={`${def.start}–${def.end}`}
      />
      <div className="border-t border-ink-100 px-5 py-4">
        {notYetChecked ? (
          ended ? (
            <p className="text-[13px] text-ink-400">
              Ca đã kết thúc mà chưa điểm danh — liên hệ điều phối viên nếu cần điều chỉnh.
            </p>
          ) : (
            <Button size="md" variant="success" onClick={onCheckIn}>
              <UserRoundCheck size={16} /> Tôi đã có mặt
            </Button>
          )
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('chip', ATTENDANCE_STYLE[attendance])}>
              <CheckCircle2 size={12} /> {ATTENDANCE_LABEL[attendance]}
              {RELIABILITY_DELTA[attendance] !== 0 && (
                <span className="ml-1 font-extrabold">
                  {RELIABILITY_DELTA[attendance] > 0 ? '+' : ''}
                  {RELIABILITY_DELTA[attendance]}
                </span>
              )}
            </span>
            {checkInAt && (
              <span className="text-[11.5px] text-ink-400">
                <Clock3 size={11} className="mr-1 inline" />
                Đã ghi nhận lúc{' '}
                {new Date(checkInAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

function currentMinutes(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

/** Ngưỡng khớp đúng ATTENDANCE_LABEL: trễ nhẹ 1–10 phút, trễ nặng >10 phút. */
function statusFor(shiftStartMinutes: number, nowMin: number): AttendanceStatus {
  const diff = nowMin - shiftStartMinutes
  if (diff <= 0) return 'ontime'
  if (diff <= 10) return 'late_minor'
  return 'late_major'
}
