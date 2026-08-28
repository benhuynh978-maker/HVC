/**
 * Mô hình dữ liệu của HVC Staff Hub.
 * Toàn bộ hệ thống chỉ đọc/ghi qua các kiểu này, nên khi thay lớp lưu trữ
 * (localStorage -> Supabase/REST API) thì phần giao diện không phải sửa gì.
 */

export type Role = 'admin' | 'coordinator' | 'member'

/** Nhóm đối tượng — dùng để cân bằng tải giữa các nhóm có lịch sinh hoạt khác nhau. */
export type MemberGroup = 'HS' | 'SV' | 'DL'

export type Skill = 'cashier' | 'sales' | 'logistics' | 'media'

/** Tầng ca theo nhu cầu thực tế: cao điểm / thường / thấp điểm. */
export type ShiftTier = 'peak' | 'normal' | 'low'

export interface ShiftDef {
  code: string
  name: string
  start: string
  end: string
  tier: ShiftTier
  /** Số người trực chính tối thiểu. */
  minStaff: number
  /** Số người dự bị tại chỗ cần có (ca thấp điểm). */
  standbyNeeded: number
  /** Các thứ trong tuần áp dụng ca này (1 = Thứ 2 … 7 = Chủ nhật). */
  days: number[]
  /** Hệ số điểm gánh nặng. */
  weight: number
  hours: number
}

/**
 * Hồ sơ trực ca — CHỈ tồn tại với role === 'member'.
 * Trưởng ban / Điều phối viên không trực ca dưới bất kỳ hình thức nào
 * (kể cả khẩn cấp), nên không có hồ sơ này — họ bị loại khỏi thuật toán
 * xếp lịch, pool dự bị, và điểm bán ngoài ngay ở tầng dữ liệu, không phải
 * chỉ ẩn ở giao diện. Xem docs/THIET-KE-HE-THONG.md mục 3.
 */
export interface StaffProfile {
  /** Trần cam kết tự nguyện: số ca tối đa mỗi tuần do chính thành viên đặt. */
  maxShiftsPerWeek: number
  skills: Skill[]
  /** Điểm uy tín 0–100, khởi điểm 80. */
  reliability: number
  /** Đồng ý của phụ huynh cho hoạt động ngoài trường. */
  parentConsent: boolean
  canTravel: boolean
  /** Lịch rảnh nền, dạng "<thứ>-<mã ca>" ví dụ "1-A". */
  baselineSlots: string[]
  totalShiftsDone: number
}

export interface Member {
  id: string
  name: string
  email: string
  /** Chỉ dùng cho bản demo không backend — thật sẽ do máy chủ xác thực. */
  password: string
  role: Role
  group: MemberGroup
  unit: string
  phone: string
  active: boolean
  joinedAt: string
  /** Có mặt khi và chỉ khi role === 'member'. */
  staff?: StaffProfile
}

/** Member đã được xác nhận có hồ sơ trực ca — dùng sau khi lọc bằng `hasStaffProfile()`. */
export type StaffMember = Member & { staff: StaffProfile }

/** Lịch rảnh cập nhật theo tuần (lớp rolling). */
export interface Availability {
  memberId: string
  weekStart: string
  slots: string[]
  note: string
  updatedAt: string
  /** false = chưa cập nhật tuần này, hệ thống dùng baselineSlots. */
  submitted: boolean
}

export type ShiftStatus = 'draft' | 'published'

export interface ShiftInstance {
  id: string
  date: string
  code: string
  status: ShiftStatus
}

export type ConfirmStatus = 'pending' | 'confirmed' | 'declined'

export type AttendanceStatus =
  | 'none'
  | 'ontime'
  | 'late_minor'
  | 'late_major'
  | 'absent_notified'
  | 'absent_no_notice'

export interface Assignment {
  id: string
  shiftId: string
  memberId: string
  isLead: boolean
  /** true = dự bị tại chỗ của ca thấp điểm (không phải pool dự bị chung). */
  isStandby: boolean
  confirmStatus: ConfirmStatus
  attendance: AttendanceStatus
  checkInAt?: string
  declineReason?: string
  /** Đánh dấu ca này nhận từ chợ ca / dự bị (dùng để cộng điểm ghi nhận). */
  pickedUp?: boolean
  /** Bước 2 (tuỳ chọn, không phạt nếu bỏ lỡ): giờ bấm "Tôi sẽ tới ca này". */
  preShiftAckAt?: string
  /** Bước 3: true nếu điểm danh đi qua đúng luồng chụp ảnh (khác với Admin tự gán tay). */
  selfCheckInVerified?: boolean
}

export type SwapType = 'release' | 'swap'
export type SwapStatus = 'open' | 'matched' | 'approved' | 'rejected' | 'cancelled'

export interface SwapRequest {
  id: string
  type: SwapType
  assignmentId: string
  fromMemberId: string
  toMemberId?: string
  targetAssignmentId?: string
  reason: string
  status: SwapStatus
  createdAt: string
  resolvedAt?: string
}

export type EventStatus = 'open' | 'locked' | 'done'

export interface ExternalEvent {
  id: string
  name: string
  location: string
  date: string
  start: string
  end: string
  needed: number
  note: string
  status: EventStatus
  applicants: string[]
  selected: string[]
  standby: string[]
}

export interface LogEntry {
  id: string
  at: string
  kind: 'info' | 'success' | 'warn' | 'danger'
  text: string
  memberId?: string
}

export interface AppData {
  version: number
  members: Member[]
  availability: Availability[]
  shifts: ShiftInstance[]
  assignments: Assignment[]
  swaps: SwapRequest[]
  events: ExternalEvent[]
  logs: LogEntry[]
}
