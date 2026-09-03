import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { AlertCircle, ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Avatar, Button, Card } from '../components/ui'
import { ROLE_LABEL } from '../data/config'
import { cn } from '../lib/utils'

/**
 * Đăng nhập — hệ thống KHÔNG có chức năng tự tạo tài khoản.
 * Tài khoản do Ban Nhân sự cấp khi thành viên gia nhập, đúng như quy trình thật.
 */
export function Login() {
  const userId = useStore((s) => s.userId)
  const login = useStore((s) => s.login)
  const members = useStore((s) => s.data.members)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (userId) return <Navigate to="/" replace />

  // Chỉ 2 tài khoản mẫu — Admin và Điều phối viên dùng chung một giao diện
  // quản trị (isAdminRole), không có giao diện riêng biệt nào ở giữa, nên
  // hiện thêm 1 thẻ Điều phối viên ở đây dễ khiến người dùng tưởng có trải
  // nghiệm thứ 3 tách biệt.
  const quickAccounts = [
    members.find((m) => m.role === 'admin'),
    members.find((m) => m.role === 'member'),
  ].filter(Boolean)

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault()
    setBusy(true)
    setError('')
    const res = login(email, password)
    setBusy(false)
    if (!res.ok) setError(res.error ?? 'Đăng nhập không thành công.')
  }

  const quickFill = (mEmail: string) => {
    setEmail(mEmail)
    setPassword('hvc2026')
    setError('')
  }

  return (
    <div className="flex min-h-full">
      {/* Cột giới thiệu */}
      <div className="relative hidden w-[46%] shrink-0 overflow-hidden bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 lg:block">
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              'radial-gradient(rgba(255,255,255,.9) 1.2px, transparent 1.2px)',
            backgroundSize: '26px 26px',
          }}
        />
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-brand-300/25 blur-3xl" />

        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
              <span className="text-[15px] font-extrabold">HV</span>
            </div>
            <div className="leading-tight">
              <p className="text-[15px] font-extrabold">HVC Staff Hub</p>
              <p className="text-[11.5px] text-white/70">Hùng Vương Concert</p>
            </div>
          </div>

          <div className="max-w-md animate-fade-up">
            <h1 className="text-[34px] font-extrabold leading-[1.15] tracking-tight">
              Không còn ca trống,
              <br />
              không còn lịch trên giấy.
            </h1>
            <p className="mt-4 text-[14.5px] leading-relaxed text-white/80">
              Hệ thống quản lý nhân sự trực phòng cho Project F&amp;B: thu lịch rảnh, tự động xếp ca
              công bằng, xác nhận trước một ngày, và luôn có người dự bị sẵn sàng.
            </p>

            <div className="mt-8 space-y-3">
              {[
                ['Lịch rảnh cập nhật mỗi tuần', 'Lịch trực bám sát đời sống thật của thành viên'],
                ['Xác nhận ca từ 20:00 hôm trước', 'Phát hiện thiếu người sớm 12 tiếng, không đợi tới giờ ca'],
                ['Danh sách dự bị tự sinh', 'Ai rảnh mà chưa được xếp đều là lực lượng ứng cứu'],
              ].map(([t, d]) => (
                <div key={t} className="flex gap-3 rounded-xl bg-white/10 p-3.5 backdrop-blur-sm">
                  <Sparkles size={16} className="mt-0.5 shrink-0 text-white/80" />
                  <div>
                    <p className="text-[13px] font-bold">{t}</p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-white/70">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11.5px] text-white/50">
            Bài làm vòng 2 — tuyển sinh Ban Nhân sự · Project F&amp;B
          </p>
        </div>
      </div>

      {/* Cột đăng nhập */}
      <div className="dot-grid flex flex-1 items-center justify-center bg-ink-50 px-5 py-10">
        <div className="w-full max-w-[400px] animate-fade-up">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white">
                <span className="text-[13px] font-extrabold">HV</span>
              </div>
              <div className="leading-tight">
                <p className="text-[15px] font-extrabold text-ink-900">HVC Staff Hub</p>
                <p className="text-[11px] text-ink-400">Hùng Vương Concert</p>
              </div>
            </div>
          </div>

          <h2 className="text-[24px] font-extrabold tracking-tight text-ink-900">Đăng nhập</h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-500">
            Tài khoản do Ban Nhân sự cấp khi bạn gia nhập. Hệ thống không có chức năng tự đăng ký.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div>
              <label className="label mb-1.5 block">Email</label>
              <input
                className="input"
                type="email"
                autoComplete="username"
                placeholder="ten@hvc.vn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label mb-1.5 block">Mật khẩu</label>
              <div className="relative">
                <input
                  className="input pr-11"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
                  aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-2.5 text-[13px] font-semibold text-rose-700 animate-pop-in">
                <AlertCircle size={15} className="shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              Vào hệ thống
              <ArrowRight size={16} />
            </Button>
          </form>

          <div className="my-7 flex items-center gap-3">
            <div className="h-px flex-1 bg-ink-200" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-300">
              Tài khoản dùng thử
            </span>
            <div className="h-px flex-1 bg-ink-200" />
          </div>

          <div className="space-y-2">
            {quickAccounts.map((m) => (
              <Card
                key={m!.id}
                hover
                className={cn(
                  'flex cursor-pointer items-center gap-3 p-3 transition-all',
                  email === m!.email && 'border-brand-300 shadow-ring',
                )}
              >
                <button
                  type="button"
                  onClick={() => quickFill(m!.email)}
                  className="flex w-full items-center gap-3 text-left"
                >
                  <Avatar id={m!.id} name={m!.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-ink-900">{m!.name}</p>
                    <p className="truncate text-[11.5px] text-ink-400">
                      {ROLE_LABEL[m!.role]} · {m!.email}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] font-bold text-brand-500">Chọn</span>
                </button>
              </Card>
            ))}
          </div>

          <p className="mt-5 text-center text-[11.5px] leading-relaxed text-ink-400">
            Mật khẩu chung của bản demo: <code className="rounded bg-ink-100 px-1.5 py-0.5 font-bold text-ink-600">hvc2026</code>
            <br />
            Bấm vào một tài khoản để điền nhanh.
          </p>
        </div>
      </div>
    </div>
  )
}
