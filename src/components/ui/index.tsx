import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { X } from 'lucide-react'
import { cn, avatarColor, initials } from '../../lib/utils'

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-500 text-white shadow-sm hover:bg-brand-600 active:bg-brand-700 disabled:bg-brand-200',
  secondary: 'bg-ink-900 text-white hover:bg-ink-800 active:bg-ink-900 disabled:bg-ink-300',
  outline: 'bg-white text-ink-700 border border-ink-200 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50',
  ghost: 'bg-transparent text-ink-600 hover:bg-ink-100 hover:text-ink-800',
  danger: 'bg-rose-500 text-white hover:bg-rose-600 disabled:bg-rose-200',
  success: 'bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-emerald-200',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[15px] gap-2 rounded-xl',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-all duration-200',
        'active:scale-[.97] disabled:cursor-not-allowed disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

export function Card({
  className,
  children,
  hover,
}: {
  className?: string
  children: ReactNode
  hover?: boolean
}) {
  return <div className={cn('card', hover && 'card-hover', className)}>{children}</div>
}

export function CardHeader({
  title,
  desc,
  icon,
  action,
  className,
}: {
  title: ReactNode
  desc?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-5 pb-4', className)}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold text-ink-900 leading-tight">{title}</h3>
          {desc && <p className="mt-1 text-[13px] leading-relaxed text-ink-500">{desc}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Badge / Chip                                                        */
/* ------------------------------------------------------------------ */

export function Badge({
  children,
  className,
  tone = 'neutral',
}: {
  children: ReactNode
  className?: string
  tone?: 'neutral' | 'brand' | 'success' | 'warn' | 'danger' | 'info'
}) {
  const tones = {
    neutral: 'bg-ink-100 text-ink-600',
    brand: 'bg-brand-50 text-brand-700 border border-brand-100',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    warn: 'bg-amber-50 text-amber-700 border border-amber-100',
    danger: 'bg-rose-50 text-rose-700 border border-rose-100',
    info: 'bg-sky-50 text-sky-700 border border-sky-100',
  }
  return <span className={cn('chip', tones[tone], className)}>{children}</span>
}

/* ------------------------------------------------------------------ */
/* Avatar                                                              */
/* ------------------------------------------------------------------ */

export function Avatar({
  id,
  name,
  size = 'md',
  className,
  ring,
}: {
  id: string
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
  ring?: boolean
}) {
  const sizes = {
    xs: 'h-6 w-6 text-[9px]',
    sm: 'h-8 w-8 text-[11px]',
    md: 'h-10 w-10 text-xs',
    lg: 'h-14 w-14 text-base',
  }
  return (
    <div
      title={name}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-bold text-white select-none',
        avatarColor(id),
        sizes[size],
        ring && 'ring-2 ring-white',
        className,
      )}
    >
      {initials(name)}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Stat                                                                */
/* ------------------------------------------------------------------ */

export function StatCard({
  label,
  value,
  unit,
  hint,
  state = 'good',
  icon,
  progress,
}: {
  label: string
  value: string | number
  unit?: string
  hint?: ReactNode
  state?: 'good' | 'warn' | 'bad' | 'neutral'
  icon?: ReactNode
  progress?: number
}) {
  const tone = {
    good: { text: 'text-emerald-600', bg: 'bg-emerald-500', soft: 'bg-emerald-50 text-emerald-600' },
    warn: { text: 'text-amber-600', bg: 'bg-amber-500', soft: 'bg-amber-50 text-amber-600' },
    bad: { text: 'text-rose-600', bg: 'bg-rose-500', soft: 'bg-rose-50 text-rose-600' },
    neutral: { text: 'text-ink-700', bg: 'bg-brand-500', soft: 'bg-brand-50 text-brand-600' },
  }[state]

  return (
    <Card hover className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="label">{label}</p>
        {icon && (
          <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', tone.soft)}>
            {icon}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className={cn('text-[28px] font-extrabold leading-none tracking-tight', tone.text)}>
          {value}
        </span>
        {unit && <span className={cn('text-sm font-bold', tone.text)}>{unit}</span>}
      </div>
      {typeof progress === 'number' && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
          <div
            className={cn('h-full rounded-full transition-all duration-700', tone.bg)}
            style={{ width: `${Math.max(2, Math.min(100, progress))}%` }}
          />
        </div>
      )}
      {hint && <p className="mt-2.5 text-[12px] leading-relaxed text-ink-400">{hint}</p>}
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Progress                                                            */
/* ------------------------------------------------------------------ */

export function Progress({
  value,
  className,
  barClass,
}: {
  value: number
  className?: string
  barClass?: string
}) {
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-ink-100', className)}>
      <div
        className={cn('h-full rounded-full bg-brand-500 transition-all duration-700', barClass)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Empty state                                                         */
/* ------------------------------------------------------------------ */

export function EmptyState({
  icon,
  title,
  desc,
  action,
}: {
  icon?: ReactNode
  title: string
  desc?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center animate-fade-in">
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-400">
          {icon}
        </div>
      )}
      <p className="text-[15px] font-bold text-ink-800">{title}</p>
      {desc && <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-400">{desc}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  desc,
  children,
  footer,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  desc?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-ink-900/35 backdrop-blur-[3px] animate-fade-in"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative z-10 w-full max-h-[88vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl animate-pop-in',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-md',
        )}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-ink-100 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <h3 className="text-base font-bold text-ink-900">{title}</h3>
            {desc && <p className="mt-1 text-[13px] leading-relaxed text-ink-500">{desc}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="sticky bottom-0 flex justify-end gap-2 border-t border-ink-100 bg-white/95 px-5 py-3.5 backdrop-blur">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

const TabsCtx = createContext<{ value: string; set: (v: string) => void } | null>(null)

export function Tabs({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (v: string) => void
  children: ReactNode
}) {
  return <TabsCtx.Provider value={{ value, set: onChange }}>{children}</TabsCtx.Provider>
}

export function TabList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'inline-flex gap-1 rounded-xl bg-ink-100 p-1 overflow-x-auto no-scrollbar max-w-full',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function Tab({ value, children }: { value: string; children: ReactNode }) {
  const ctx = useContext(TabsCtx)!
  const active = ctx.value === value
  return (
    <button
      onClick={() => ctx.set(value)}
      className={cn(
        'whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-200',
        active ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700',
      )}
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Section heading                                                     */
/* ------------------------------------------------------------------ */

export function PageHeader({
  title,
  desc,
  action,
  eyebrow,
}: {
  title: string
  desc?: string
  action?: ReactNode
  eyebrow?: string
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between animate-fade-up">
      <div>
        {eyebrow && <p className="label mb-1.5 text-brand-500">{eyebrow}</p>}
        <h1 className="text-[26px] font-extrabold tracking-tight text-ink-900">{title}</h1>
        {desc && <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-500">{desc}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Info callout                                                        */
/* ------------------------------------------------------------------ */

export function Callout({
  tone = 'info',
  title,
  children,
  icon,
  className,
}: {
  tone?: 'info' | 'warn' | 'success' | 'danger' | 'brand'
  title?: ReactNode
  children: ReactNode
  icon?: ReactNode
  className?: string
}) {
  const tones = {
    info: 'bg-sky-50/70 border-sky-100 text-sky-900',
    warn: 'bg-amber-50/70 border-amber-100 text-amber-900',
    success: 'bg-emerald-50/70 border-emerald-100 text-emerald-900',
    danger: 'bg-rose-50/70 border-rose-100 text-rose-900',
    brand: 'bg-brand-50/70 border-brand-100 text-brand-900',
  }
  return (
    <div className={cn('flex gap-3 rounded-xl border p-4 text-[13px] leading-relaxed', tones[tone], className)}>
      {icon && <div className="mt-0.5 shrink-0 opacity-80">{icon}</div>}
      <div className="min-w-0">
        {title && <p className="mb-1 font-bold">{title}</p>}
        <div className="opacity-90">{children}</div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Segmented toggle                                                    */
/* ------------------------------------------------------------------ */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl bg-ink-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-all duration-200',
            value === o.value ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Confirm dialog helper                                               */
/* ------------------------------------------------------------------ */

export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean
    title: string
    desc?: string
    onOk?: () => void
    danger?: boolean
  }>({ open: false, title: '' })

  const ask = (title: string, desc: string, onOk: () => void, danger = false) =>
    setState({ open: true, title, desc, onOk, danger })

  const node = (
    <Modal
      open={state.open}
      onClose={() => setState((s) => ({ ...s, open: false }))}
      title={state.title}
      desc={state.desc}
      footer={
        <>
          <Button variant="ghost" onClick={() => setState((s) => ({ ...s, open: false }))}>
            Huỷ
          </Button>
          <Button
            variant={state.danger ? 'danger' : 'primary'}
            onClick={() => {
              state.onOk?.()
              setState((s) => ({ ...s, open: false }))
            }}
          >
            Xác nhận
          </Button>
        </>
      }
    />
  )

  return { ask, node }
}
