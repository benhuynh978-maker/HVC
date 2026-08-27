import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useStore } from './store/useStore'
import { isAdminRole } from './lib/utils'
import { Toasts } from './components/ui/Toasts'
import { AppShell } from './components/layout/AppShell'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { StaffDashboard } from './pages/StaffDashboard'
import { MyShifts } from './pages/MyShifts'
import { Attendance } from './pages/Attendance'
import { SelfCheckIn } from './pages/SelfCheckIn'
import { Availability } from './pages/Availability'
import { AutoSchedule } from './pages/AutoSchedule'
import { Schedule } from './pages/Schedule'
import { Swaps } from './pages/Swaps'
import { External } from './pages/External'
import { Members } from './pages/Members'
import { Reports } from './pages/Reports'

function LoadingScreen() {
  return (
    <div className="flex h-dvh items-center justify-center bg-ink-50">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-lift animate-pulse-ring">
          <span className="text-[14px] font-extrabold">HV</span>
        </div>
        <p className="text-[13px] font-semibold text-ink-400">Đang tải HVC Staff Hub...</p>
      </div>
    </div>
  )
}

/** Chỉ Trưởng ban / Điều phối viên (Admin). */
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const role = useStore((s) => s.data.members.find((m) => m.id === s.userId)?.role)
  if (!role || !isAdminRole(role)) return <Navigate to="/" replace />
  return <>{children}</>
}

/** Chỉ Thành viên (Nhân viên) — Admin không trực ca nên không vào được các trang này. */
function RequireStaff({ children }: { children: React.ReactNode }) {
  const role = useStore((s) => s.data.members.find((m) => m.id === s.userId)?.role)
  if (!role || isAdminRole(role)) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  const ready = useStore((s) => s.ready)
  const userId = useStore((s) => s.userId)
  const role = useStore((s) => s.data.members.find((m) => m.id === s.userId)?.role)
  const init = useStore((s) => s.init)

  useEffect(() => {
    void init()
  }, [init])

  if (!ready) return <LoadingScreen />

  const isAdmin = role ? isAdminRole(role) : false

  return (
    <HashRouter>
      <div className="h-dvh bg-ink-50">
        {!userId ? (
          <Login />
        ) : (
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={isAdmin ? <Dashboard /> : <StaffDashboard />} />
              <Route
                path="/my"
                element={
                  <RequireStaff>
                    <MyShifts />
                  </RequireStaff>
                }
              />
              <Route path="/attendance" element={isAdmin ? <Attendance /> : <SelfCheckIn />} />
              <Route
                path="/availability"
                element={
                  <RequireStaff>
                    <Availability />
                  </RequireStaff>
                }
              />
              <Route
                path="/auto"
                element={
                  <RequireAdmin>
                    <AutoSchedule />
                  </RequireAdmin>
                }
              />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/swaps" element={<Swaps />} />
              <Route path="/external" element={<External />} />
              <Route
                path="/members"
                element={
                  <RequireAdmin>
                    <Members />
                  </RequireAdmin>
                }
              />
              <Route
                path="/reports"
                element={
                  <RequireAdmin>
                    <Reports />
                  </RequireAdmin>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        )}
      </div>
      <Toasts />
    </HashRouter>
  )
}
