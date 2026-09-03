import { useMemo, useState } from 'react'
import { Car, Mail, Phone, Search, ShieldCheck, Sparkles } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Badge, Card, EmptyState, Modal, PageHeader, Segmented } from '../components/ui'
import { AvatarStack, ScoreRing } from '../components/shared'
import { GROUP_LABEL, ROLE_LABEL, SKILL_LABEL } from '../data/config'
import { computeContributions } from '../lib/metrics'
import { hasStaffProfile, weekStartOf, today, addDays } from '../lib/utils'
import type { MemberGroup, StaffMember } from '../types'

/**
 * Danh bạ Thành viên — CHỈ Admin truy cập (route /members được RequireAdmin bảo vệ).
 * Đây là roster vận hành để xếp ca, nên chỉ liệt kê người có hồ sơ trực ca
 * (role === 'member') — Trưởng ban/Điều phối viên không trực ca nên không có
 * gì để hiển thị ở đây (kỹ năng, điểm uy tín, trần cam kết...). Xem
 * docs/THIET-KE-HE-THONG.md mục 6.3.
 */
export function Members() {
  const data = useStore((s) => s.data)

  const [q, setQ] = useState('')
  const [group, setGroup] = useState<MemberGroup | 'all'>('all')
  const [selected, setSelected] = useState<StaffMember | null>(null)

  const contributions = useMemo(
    () => computeContributions(data, [addDays(weekStartOf(today()), -7), weekStartOf(today())]),
    [data],
  )
  const contribMap = useMemo(
    () => Object.fromEntries(contributions.map((c) => [c.member.id, c])),
    [contributions],
  )

  const list = useMemo(() => {
    return data.members
      .filter((m) => m.active)
      .filter(hasStaffProfile)
      .filter((m) => group === 'all' || m.group === group)
      .filter((m) => !q || m.name.toLowerCase().includes(q.toLowerCase()) || m.unit.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  }, [data.members, group, q])

  return (
    <>
      <PageHeader
        title="Thành viên"
        desc={`${list.length} nhân viên đang hoạt động trong Ban Nhân sự`}
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input
            className="input pl-9"
            placeholder="Tìm theo tên hoặc lớp/đơn vị..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Segmented
          value={group}
          onChange={setGroup}
          options={[
            { value: 'all', label: 'Tất cả' },
            { value: 'TC', label: 'Tài chính' },
            { value: 'NS', label: 'Nhân sự' },
            { value: 'TT', label: 'Truyền thông' },
            { value: 'DD', label: 'Đạo diễn NT' },
            { value: 'DN', label: 'Đối ngoại' },
          ]}
        />
      </div>

      {list.length === 0 ? (
        <Card>
          <EmptyState icon={<Search size={22} />} title="Không tìm thấy thành viên phù hợp" />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3 stagger">
          {list.map((m) => {
            const c = contribMap[m.id]
            return (
              <Card key={m.id} hover className="cursor-pointer p-4">
                <button onClick={() => setSelected(m)} className="flex w-full items-center gap-3 text-left">
                  <AvatarStack members={[m]} max={1} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-bold text-ink-900">{m.name}</p>
                    <p className="truncate text-[11.5px] text-ink-400">
                      {m.unit} · {ROLE_LABEL[m.role]}
                    </p>
                  </div>
                  <ScoreRing value={m.staff.reliability} size={36} />
                </button>
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-ink-100 pt-3">
                  <Badge tone="neutral">{GROUP_LABEL[m.group]}</Badge>
                  {c && c.shifts > 0 && <Badge tone="brand">{c.shifts} ca / 2 tuần</Badge>}
                  {m.staff.canTravel && (
                    <Badge tone="info">
                      <Car size={10} /> Có thể đi ngoài
                    </Badge>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? ''} desc={selected?.unit}>
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <AvatarStack members={[selected]} max={1} size="lg" />
              <div className="flex-1 space-y-1">
                <p className="flex items-center gap-1.5 text-[12.5px] text-ink-600">
                  <Mail size={13} className="text-ink-300" /> {selected.email}
                </p>
                <p className="flex items-center gap-1.5 text-[12.5px] text-ink-600">
                  <Phone size={13} className="text-ink-300" /> {selected.phone}
                </p>
              </div>
              <div className="text-center">
                <ScoreRing value={selected.staff.reliability} size={52} />
                <p className="mt-1 text-[10px] font-semibold text-ink-400">Điểm uy tín</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <InfoBox label="Ban phụ trách" value={GROUP_LABEL[selected.group]} />
              <InfoBox label="Vai trò" value={ROLE_LABEL[selected.role]} />
              <InfoBox label="Trần cam kết" value={`${selected.staff.maxShiftsPerWeek} ca/tuần`} />
              <InfoBox label="Tổng ca đã trực" value={`${selected.staff.totalShiftsDone} ca`} />
            </div>

            <div>
              <p className="label mb-2">Kỹ năng</p>
              <div className="flex flex-wrap gap-1.5">
                {selected.staff.skills.map((s) => (
                  <Badge key={s} tone="brand">
                    {SKILL_LABEL[s]}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge tone={selected.staff.parentConsent ? 'success' : 'neutral'}>
                <ShieldCheck size={11} /> {selected.staff.parentConsent ? 'Đã có đồng ý phụ huynh' : 'Chưa có đồng ý phụ huynh'}
              </Badge>
              <Badge tone={selected.staff.canTravel ? 'success' : 'neutral'}>
                <Car size={11} /> {selected.staff.canTravel ? 'Có thể đi điểm bán ngoài' : 'Không di chuyển xa'}
              </Badge>
            </div>

            {contribMap[selected.id] && (
              <div className="rounded-xl bg-brand-50 p-3.5">
                <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-brand-700">
                  <Sparkles size={13} /> 2 tuần gần nhất
                </p>
                <p className="mt-1 text-[12px] text-brand-600">
                  {contribMap[selected.id].shifts} ca · {contribMap[selected.id].hours.toFixed(1)} giờ đóng góp
                  {contribMap[selected.id].pickedUp > 0 && ` · ${contribMap[selected.id].pickedUp} lần nhận ca cứu viện`}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink-50 p-3">
      <p className="text-[10.5px] font-semibold text-ink-400">{label}</p>
      <p className="mt-0.5 text-[13px] font-bold text-ink-800">{value}</p>
    </div>
  )
}
