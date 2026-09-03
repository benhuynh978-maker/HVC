import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  CalendarCheck2,
  CalendarDays,
  CalendarRange,
  LayoutDashboard,
  LogOut,
  Menu,
  Repeat2,
  RotateCcw,
  Sparkles,
  Store,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { Avatar, Button } from '../ui'
import { ROLE_LABEL } from '../../data/config'
import { cn, isAdminRole, parseShiftId, today, tomorrow } from '../../lib/utils'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  badge?: 'pending'
}

/**
 * Hai bộ điều hướng HOÀN TOÀN khác nhau — không phải một danh sách ẩn/hiện
 * theo item. Trưởng ban/Điều phối viên (Admin) không trực ca nên không có
 * "Ca của tôi"/"Lịch rảnh". Nhân viên không quản trị nên không có nhóm
 * "Quản trị". Xem docs/THIET-KE-HE-THONG.md mục 6.1.
 */
const ADMIN_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Hằng ngày',
    items: [
      { to: '/', label: 'Tổng quan', icon: LayoutDashboard },
      { to: '/attendance', label: 'Điểm danh', icon: UserCheck },
    ],
  },
  {
    title: 'Lập kế hoạch',
    items: [
      { to: '/auto', label: 'Xếp lịch tự động', icon: Sparkles },
      { to: '/schedule', label: 'Lịch trực tuần', icon: CalendarDays },
    ],
  },
  {
    title: 'Linh hoạt',
    items: [
      { to: '/swaps', label: 'Đổi ca & Dự bị', icon: Repeat2 },
      { to: '/external', label: 'Điểm bán ngoài', icon: Store },
    ],
  },
  {
    title: 'Quản trị',
    items: [
      { to: '/members', label: 'Thành viên', icon: Users },
      // "Báo cáo & KPI" tạm ẩn khỏi menu — route /reports vẫn còn nguyên,
      // chỉ không có lối vào từ điều hướng. Thêm lại dòng nav item khi cần mở lại.
    ],
  },
]

const STAFF_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Hằng ngày',
    items: [
      { to: '/', label: 'Tổng quan', icon: LayoutDashboard },
      { to: '/my', label: 'Ca của tôi', icon: CalendarCheck2, badge: 'pending' },
      { to: '/attendance', label: 'Điểm danh', icon: UserCheck },
    ],
  },
  {
    title: 'Lập kế hoạch',
    items: [
      { to: '/availability', label: 'Lịch rảnh', icon: CalendarRange },
      { to: '/schedule', label: 'Lịch trực tuần', icon: CalendarDays },
    ],
  },
  {
    title: 'Linh hoạt',
    items: [
      { to: '/swaps', label: 'Đổi ca & Dự bị', icon: Repeat2 },
      { to: '/external', label: 'Điểm bán ngoài', icon: Store },
    ],
  },
]

export function AppShell() {
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const user = useStore((s) => s.data.members.find((m) => m.id === s.userId) ?? null)
  const data = useStore((s) => s.data)
  const logout = useStore((s) => s.logout)
  const resetDemo = useStore((s) => s.resetDemo)
  const isAdmin = isAdminRole(user?.role ?? 'member')
  const GROUPS = isAdmin ? ADMIN_GROUPS : STAFF_GROUPS

  useEffect(() => setOpen(false), [loc.pathname])

  // Admin không trực ca nên luôn có 0 assignment cá nhân — badge tự nhiên
  // biến mất, không cần điều kiện riêng để ẩn.
  const pendingCount = (() => {
    if (!user) return 0
    const tmr = tomorrow()
    return data.assignments.filter((a) => {
      if (a.memberId !== user.id || a.confirmStatus !== 'pending') return false
      const { date } = parseShiftId(a.shiftId)
      return date === tmr || date === today()
    }).length
  })()

  const nav = (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {GROUPS.map((g) => {
        const items = g.items
        if (!items.length) return null
        return (
          <div key={g.title}>
            <p className="label mb-1.5 px-3">{g.title}</p>
            <div className="space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition-all duration-200',
                        isActive
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-ink-500 hover:bg-ink-100/70 hover:text-ink-800',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          size={17}
                          className={cn(
                            'shrink-0 transition-colors',
                            isActive ? 'text-brand-500' : 'text-ink-400 group-hover:text-ink-600',
                          )}
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge === 'pending' && pendingCount > 0 && (
                          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-white animate-pulse-ring">
                            {pendingCount}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        )
      })}
    </nav>
  )

  const footer = user && (
    <div className="border-t border-ink-100 p-3">
      <div className="flex items-center gap-2.5 rounded-xl bg-ink-50 p-2.5">
        <Avatar id={user.id} name={user.name} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-ink-900">{user.name}</p>
          <p className="truncate text-[11px] text-ink-400">{ROLE_LABEL[user.role]}</p>
        </div>
        <button
          onClick={logout}
          title="Đăng xuất"
          className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-white hover:text-rose-500"
        >
          <LogOut size={15} />
        </button>
      </div>
      <button
        onClick={() => void resetDemo()}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-ink-300 transition-colors hover:bg-ink-50 hover:text-ink-500"
      >
        <RotateCcw size={11} /> Khôi phục dữ liệu mẫu
      </button>
    </div>
  )

  return (
    <div className="flex h-full">
      {/* Sidebar — desktop */}
      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-ink-100 bg-white lg:flex">
        {nav}
        {footer}
      </aside>

      {/* Drawer — mobile */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-900/35 backdrop-blur-[3px] animate-fade-in" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-[268px] flex-col bg-white shadow-2xl animate-slide-in">
            <div className="flex h-16 items-center justify-end px-5">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100"
              >
                <X size={18} />
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-ink-100 glass px-4 lg:px-8">
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-100 lg:hidden"
            aria-label="Mở menu"
          >
            <Menu size={19} />
          </button>
          <div className="ml-auto flex items-center gap-2.5">
            {pendingCount > 0 && (
              <NavLink to="/my">
                <Button size="sm" variant="primary" className="gap-1.5">
                  <CalendarCheck2 size={14} />
                  {pendingCount} ca chờ xác nhận
                </Button>
              </NavLink>
            )}
          </div>
        </header>

        <main className="dot-grid flex-1 overflow-y-auto bg-ink-50">
          <div className="mx-auto w-full max-w-[1240px] px-4 py-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
