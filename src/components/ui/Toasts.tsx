import { CheckCircle2, Info, XCircle, X } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { cn } from '../../lib/utils'

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
}

const TONES = {
  success: 'border-emerald-200 text-emerald-600',
  error: 'border-rose-200 text-rose-600',
  info: 'border-sky-200 text-sky-600',
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2.5">
      {toasts.map((t) => {
        const Icon = ICONS[t.kind]
        return (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-xl border bg-white/95 p-3.5 shadow-lift backdrop-blur animate-slide-in',
              TONES[t.kind],
            )}
          >
            <Icon size={18} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-bold text-ink-900">{t.title}</p>
              {t.desc && <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-500">{t.desc}</p>}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 rounded-md p-1 text-ink-300 transition-colors hover:bg-ink-100 hover:text-ink-600"
              aria-label="Đóng thông báo"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
