import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Camera,
  CalendarCheck2,
  CheckCircle2,
  Circle,
  Clock3,
  Crown,
  Loader2,
  RefreshCcw,
  RotateCcw,
  UserRoundCheck,
  Wrench,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { Button, Card, CardHeader, EmptyState, PageHeader, Segmented } from '../components/ui'
import { ShiftTag } from '../components/shared'
import { ATTENDANCE_LABEL, ATTENDANCE_STYLE, RELIABILITY_DELTA } from '../data/config'
import { cn, minutesOf, today } from '../lib/utils'
import type { Assignment, AttendanceStatus, ShiftInstance } from '../types'

/** Khung mở "Bước 2" — bao nhiêu phút trước giờ ca thì lời nhắc (tuỳ chọn) xuất hiện. */
const PRE_SHIFT_WINDOW_MIN = 120

/**
 * "Điểm danh" phía Nhân viên — quy trình 3 bước để giảm gian dối:
 *   Bước 1  Xác nhận trước 1 ngày   — đã có sẵn ở "Ca của tôi" (D-1), chỉ hiển thị lại ở đây.
 *   Bước 2  Xác nhận trước 1–2 giờ  — MỚI, tuỳ chọn, không phạt nếu bỏ lỡ.
 *   Bước 3  Điểm danh bằng camera   — MỚI, bắt buộc: phải chụp & "lưu" ảnh thành công
 *           mới tính là điểm danh xong. Trạng thái đúng giờ/trễ vẫn tự tính theo giờ
 *           chụp (statusFor), ảnh chỉ là bằng chứng chống gian dối — không lưu ảnh
 *           thật (chưa có backend), không cần Admin duyệt lại.
 *
 * Trang chỉ hiển thị ca của chính người đăng nhập, chỉ trong hôm nay — không thấy
 * ai khác. Lịch sử các ngày trước xem ở "Ca của tôi".
 */
export function SelfCheckIn() {
  const user = useStore((s) => s.data.members.find((m) => m.id === s.userId)!)
  const data = useStore((s) => s.data)
  const setAttendance = useStore((s) => s.setAttendance)
  const ackPreShift = useStore((s) => s.ackPreShift)

  const t = today()
  const [nowMinutes, setNowMinutes] = useState(() => currentMinutes())
  useEffect(() => {
    const id = setInterval(() => setNowMinutes(currentMinutes()), 30_000)
    return () => clearInterval(id)
  }, [])

  const shiftMap = useMemo(
    () => Object.fromEntries(data.shifts.map((s) => [s.id, s])),
    [data.shifts],
  )

  const todayShifts = useMemo(() => {
    return data.assignments
      .filter((a) => {
        if (a.memberId !== user.id) return false
        if (a.confirmStatus === 'declined') return false
        return shiftMap[a.shiftId]?.date === t
      })
      .map((a) => ({ a, def: shiftMap[a.shiftId] }))
      .filter((x) => !!x.def)
      .sort((x, y) => x.def!.start.localeCompare(y.def!.start))
  }, [data.assignments, shiftMap, user.id, t])

  const finishCheckIn = (assignmentId: string, status: AttendanceStatus) => {
    setAttendance(assignmentId, status, { verifiedByPhoto: true })
  }

  // ------------------------------------------------------------------
  // Chế độ xem thử — hiện ở mọi môi trường (kể cả bản deploy Netlify), để
  // ai cũng xem trước được cả 3 bước mà không cần đợi đúng ngày có ca thật.
  // Camera là thật (để xem đúng trải nghiệm), nhưng kết quả chỉ đổi state
  // cục bộ — không bao giờ đụng tới dữ liệu thật trong store.
  // ------------------------------------------------------------------
  const [previewMode, setPreviewMode] = useState<'off' | 'force-has' | 'force-empty'>('off')
  const [sim, setSim] = useState<{ attendance: AttendanceStatus; checkInAt?: string; preShiftAckAt?: string }>({
    attendance: 'none',
  })

  /** Ca giả lập cho chế độ xem thử — không còn catalog cố định để lấy mẫu, nên dựng 1 ca quanh giờ hiện tại. */
  const simDef: ShiftInstance = useMemo(() => {
    const nowMin = currentMinutes()
    const startMin = Math.max(0, nowMin - 15)
    const pad = (n: number) => String(n).padStart(2, '0')
    const toHHMM = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`
    return {
      id: 'sim',
      date: today(),
      code: 'sim',
      name: 'Ca xem thử',
      start: toHHMM(startMin),
      end: toHHMM(startMin + 120),
      tier: 'normal',
      minStaff: 1,
      standbyNeeded: 0,
      weight: 1,
      hours: 2,
      status: 'draft',
    }
  }, [])

  const resetPreview = () => setSim({ attendance: 'none' })

  const effectiveMode: 'has' | 'empty' =
    previewMode === 'off' ? (todayShifts.length > 0 ? 'has' : 'empty') : previewMode === 'force-has' ? 'has' : 'empty'

  return (
    <>
      <PageHeader
        title="Điểm danh"
        desc="Quy trình 3 bước cho ca của bạn hôm nay. Trang này chỉ hiển thị ca của riêng bạn."
      />

      <div className="mb-5 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <p className="flex items-center gap-1.5 text-[12px] font-bold text-amber-700">
            <Wrench size={13} /> Chế độ xem thử
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
          Dùng để xem trước cả 3 bước mà không cần đợi đúng ngày có ca thật. Camera là thật, nhưng
          kết quả chỉ hiển thị tạm, không lưu vào dữ liệu thật.
        </p>
      </div>

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
            confirmStatus="confirmed"
            attendance={sim.attendance}
            checkInAt={sim.checkInAt}
            selfCheckInVerified={sim.attendance !== 'none'}
            preShiftAckAt={sim.preShiftAckAt}
            nowMinutes={nowMinutes}
            onAckPreShift={() => setSim((s) => ({ ...s, preShiftAckAt: new Date().toISOString() }))}
            onCheckIn={(status) =>
              setSim((s) => ({ ...s, attendance: status, checkInAt: new Date().toISOString() }))
            }
          />
          {sim.attendance !== 'none' && (
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
              confirmStatus={a.confirmStatus}
              attendance={a.attendance}
              checkInAt={a.checkInAt}
              selfCheckInVerified={a.selfCheckInVerified}
              preShiftAckAt={a.preShiftAckAt}
              nowMinutes={nowMinutes}
              onAckPreShift={() => ackPreShift(a.id)}
              onCheckIn={(status) => finishCheckIn(a.id, status)}
            />
          ))}
        </div>
      )}
    </>
  )
}

/* ================================================================== */
/* Thẻ 1 ca — stepper 3 bước                                           */
/* ================================================================== */

function ShiftCheckInCard({
  def,
  isLead,
  confirmStatus,
  attendance,
  checkInAt,
  selfCheckInVerified,
  preShiftAckAt,
  nowMinutes,
  onAckPreShift,
  onCheckIn,
}: {
  def: ShiftInstance
  isLead: boolean
  confirmStatus: Assignment['confirmStatus']
  attendance: AttendanceStatus
  checkInAt?: string
  selfCheckInVerified?: boolean
  preShiftAckAt?: string
  nowMinutes: number
  onAckPreShift: () => void
  onCheckIn: (status: AttendanceStatus) => void
}) {
  const startMin = minutesOf(def.start)
  const endMin = minutesOf(def.end)
  const ended = nowMinutes > endMin
  const step2Open = nowMinutes >= startMin - PRE_SHIFT_WINDOW_MIN
  const step2Missed = !preShiftAckAt && nowMinutes >= startMin

  return (
    <Card className="overflow-hidden animate-fade-up">
      <CardHeader
        icon={<ShiftTag shift={def} showTime={false} />}
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

      <div className="divide-y divide-ink-100 border-t border-ink-100">
        {/* Bước 1 — D-1, chỉ hiển thị lại, thao tác thật ở "Ca của tôi" */}
        <StepRow
          index={1}
          label="Xác nhận trước 1 ngày"
          state={confirmStatus === 'confirmed' ? 'done' : confirmStatus === 'declined' ? 'skipped' : 'pending'}
        >
          {confirmStatus === 'confirmed' ? (
            <span className="text-[12px] font-semibold text-emerald-600">Đã xác nhận hôm qua</span>
          ) : (
            <span className="text-[12px] font-semibold text-amber-600">Chưa xác nhận — xem ở "Ca của tôi"</span>
          )}
        </StepRow>

        {/* Bước 2 — tuỳ chọn, không phạt */}
        <StepRow
          index={2}
          label="Xác nhận trước giờ (tuỳ chọn)"
          state={preShiftAckAt ? 'done' : step2Missed ? 'skipped' : 'pending'}
        >
          {preShiftAckAt ? (
            <span className="text-[12px] font-semibold text-emerald-600">
              Đã xác nhận lúc{' '}
              {new Date(preShiftAckAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : step2Missed ? (
            <span className="text-[12px] font-medium text-ink-400">Đã bỏ qua bước này — không sao cả</span>
          ) : step2Open ? (
            <Button size="sm" variant="outline" onClick={onAckPreShift}>
              Tôi sẽ tới ca này
            </Button>
          ) : (
            <span className="text-[12px] text-ink-300">Sẽ mở nhắc nhở gần giờ trực</span>
          )}
        </StepRow>

        {/* Bước 3 — bắt buộc, chụp ảnh */}
        <div className="px-5 py-4">
          <div className="mb-3 flex items-center gap-2.5">
            <StepIcon state={attendance !== 'none' ? 'done' : 'pending'} index={3} />
            <span className="text-[13px] font-bold text-ink-800">Điểm danh bằng camera (bắt buộc)</span>
          </div>

          {attendance !== 'none' ? (
            <div className="ml-[30px] flex flex-wrap items-center gap-2">
              <span className={cn('chip', ATTENDANCE_STYLE[attendance])}>
                <CheckCircle2 size={12} /> {ATTENDANCE_LABEL[attendance]}
                {RELIABILITY_DELTA[attendance] !== 0 && (
                  <span className="ml-1 font-extrabold">
                    {RELIABILITY_DELTA[attendance] > 0 ? '+' : ''}
                    {RELIABILITY_DELTA[attendance]}
                  </span>
                )}
              </span>
              {selfCheckInVerified && (
                <span className="chip border border-sky-100 bg-sky-50 text-sky-700">
                  <Camera size={11} /> Đã xác thực bằng ảnh
                </span>
              )}
              {checkInAt && (
                <span className="text-[11.5px] text-ink-400">
                  <Clock3 size={11} className="mr-1 inline" />
                  {new Date(checkInAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          ) : (
            <div className="ml-[30px]">
              {ended && (
                <p className="mb-2.5 text-[12px] text-amber-600">
                  Ca này đã qua giờ kết thúc — vẫn điểm danh được, trạng thái sẽ tự tính theo giờ chụp.
                </p>
              )}
              <CameraCheckIn
                onDone={(status) => onCheckIn(status)}
                computeStatus={() => statusFor(startMin, currentMinutes())}
              />
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

function StepRow({
  index,
  label,
  state,
  children,
}: {
  index: number
  label: string
  state: 'done' | 'pending' | 'skipped'
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 px-5 py-3.5">
      <div className="flex items-center gap-2.5">
        <StepIcon state={state} index={index} />
        <span className="text-[13px] font-bold text-ink-800">{label}</span>
      </div>
      {children}
    </div>
  )
}

function StepIcon({ state, index }: { state: 'done' | 'pending' | 'skipped'; index: number }) {
  if (state === 'done')
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <CheckCircle2 size={14} />
      </span>
    )
  if (state === 'skipped')
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-400">
        <Circle size={12} />
      </span>
    )
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-ink-200 text-[11px] font-bold text-ink-400">
      {index}
    </span>
  )
}

/* ================================================================== */
/* Camera — chụp ảnh bắt buộc để hoàn tất Bước 3                       */
/* Không lưu ảnh thật (chưa có backend) — ảnh chỉ tồn tại trong bộ nhớ  */
/* tạm để xem lại trước khi xác nhận, sau đó bị huỷ ngay.               */
/* ================================================================== */

type CamState = 'idle' | 'requesting' | 'live' | 'captured' | 'error'

function CameraCheckIn({
  onDone,
  computeStatus,
}: {
  onDone: (status: AttendanceStatus) => void
  computeStatus: () => AttendanceStatus
}) {
  const [state, setState] = useState<CamState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop())
    streamRef.current = null
  }

  useEffect(() => stopStream, []) // đảm bảo tắt camera khi rời trang giữa chừng

  const startCamera = async () => {
    setState('requesting')
    setErrorMsg('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setState('live')
    } catch (err) {
      setState('error')
      setErrorMsg(cameraErrorMessage(err))
    }
  }

  const capture = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1) // chụp đúng như những gì thấy trên preview (đã lật gương)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    setPhoto(canvas.toDataURL('image/jpeg', 0.85))
    stopStream()
    setState('captured')
  }

  const retake = () => {
    setPhoto(null)
    void startCamera()
  }

  const confirm = () => {
    // "Lưu thành công" được mô phỏng — không gửi/lưu ảnh thật vì hệ thống
    // hiện chưa có backend. Huỷ ảnh khỏi bộ nhớ ngay khi xác nhận xong.
    const status = computeStatus()
    setPhoto(null)
    onDone(status)
  }

  if (state === 'idle') {
    return (
      <Button size="md" variant="success" onClick={() => void startCamera()}>
        <Camera size={16} /> Bắt đầu điểm danh (chụp ảnh)
      </Button>
    )
  }

  if (state === 'requesting') {
    return (
      <div className="flex items-center gap-2 text-[13px] text-ink-500">
        <Loader2 size={16} className="animate-spin" /> Đang mở camera — vui lòng cho phép quyền truy cập...
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="max-w-md space-y-2.5 rounded-xl border border-rose-100 bg-rose-50 p-3.5">
        <p className="flex items-center gap-1.5 text-[13px] font-bold text-rose-700">
          <AlertTriangle size={14} /> Không thể mở camera
        </p>
        <p className="text-[12.5px] leading-relaxed text-rose-600">{errorMsg}</p>
        <Button size="sm" variant="danger" onClick={() => void startCamera()}>
          <RefreshCcw size={13} /> Thử lại
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-sm space-y-3">
      <div className="overflow-hidden rounded-xl border border-ink-200 bg-ink-900">
        {state === 'live' ? (
          <video ref={videoRef} muted playsInline className="aspect-[4/3] w-full -scale-x-100 object-cover" />
        ) : (
          photo && <img src={photo} alt="Ảnh điểm danh vừa chụp" className="aspect-[4/3] w-full object-cover" />
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      {state === 'live' ? (
        <Button size="md" variant="success" onClick={capture} className="w-full">
          <Camera size={16} /> Chụp ảnh
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button size="md" variant="ghost" onClick={retake} className="flex-1">
            <RefreshCcw size={14} /> Chụp lại
          </Button>
          <Button size="md" variant="success" onClick={confirm} className="flex-1">
            <UserRoundCheck size={16} /> Xác nhận điểm danh
          </Button>
        </div>
      )}
    </div>
  )
}

function cameraErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : ''
  switch (name) {
    case 'NotAllowedError':
      return 'Bạn đã từ chối quyền truy cập camera. Vui lòng cấp quyền trong cài đặt trình duyệt rồi thử lại.'
    case 'NotFoundError':
      return 'Không tìm thấy camera trên thiết bị này.'
    case 'NotReadableError':
      return 'Camera đang được ứng dụng khác sử dụng. Đóng ứng dụng đó rồi thử lại.'
    case 'SecurityError':
      return 'Trình duyệt chặn truy cập camera ở kết nối không an toàn (cần HTTPS).'
    default:
      return 'Đã có lỗi khi mở camera. Vui lòng thử lại.'
  }
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
