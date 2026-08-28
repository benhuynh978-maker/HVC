import type { AppData } from '../types'
import { buildSeed } from '../data/seed'

/**
 * ============================================================
 *  LỚP DỮ LIỆU (Data Access Layer)
 * ============================================================
 *  Toàn bộ ứng dụng chỉ nói chuyện với `db` qua interface `DataAdapter`.
 *  Giao diện KHÔNG biết dữ liệu đang nằm ở đâu.
 *
 *  Hiện tại: LocalStorageAdapter — chạy được ngay, không cần máy chủ.
 *
 *  Khi có backend, chỉ cần viết thêm một adapter mới và đổi đúng 1 dòng
 *  ở cuối file này. Không phải sửa bất kỳ component nào.
 *
 *  Ví dụ với Supabase:
 *
 *    class SupabaseAdapter implements DataAdapter {
 *      async load() {
 *        const [members, shifts, assignments] = await Promise.all([
 *          supabase.from('members').select('*'),
 *          supabase.from('shifts').select('*'),
 *          supabase.from('assignments').select('*'),
 *        ])
 *        return { ...  }
 *      }
 *      async save(d: AppData) { ... upsert ... }
 *    }
 *
 *  Bảng cần tạo phía máy chủ tương ứng với các mảng trong `AppData`:
 *    members · availability · shifts · assignments · swaps · events · logs
 */

// v2: đổi mô hình ca trực từ catalog cố định (SHIFT_MAP) sang ShiftInstance
// tự mang đủ field (name/start/end/tier/minStaff...). Đổi khoá lưu trữ để
// mọi trình duyệt đang có dữ liệu v1 cũ tự động seed lại theo mô hình mới,
// thay vì đọc thiếu field và làm vỡ toàn bộ giao diện (React không có error
// boundary nên 1 lỗi render là mất trắng cả trang).
export const STORAGE_KEY = 'hvc-staff-hub:v2'

export interface DataAdapter {
  load(): Promise<AppData | null>
  save(data: AppData): Promise<void>
  clear(): Promise<void>
}

class LocalStorageAdapter implements DataAdapter {
  async load(): Promise<AppData | null> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as AppData
      if (!parsed?.members?.length) return null
      return parsed
    } catch {
      return null
    }
  }

  async save(data: AppData): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.warn('[db] Không lưu được dữ liệu:', e)
    }
  }

  async clear(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY)
  }
}

export const db: DataAdapter = new LocalStorageAdapter()

/** Nạp dữ liệu; lần đầu tiên thì sinh dữ liệu mẫu. */
export async function loadOrSeed(): Promise<AppData> {
  // Dọn key phiên bản dữ liệu cũ (trước khi đổi mô hình ca trực) nếu còn sót lại.
  try {
    localStorage.removeItem('hvc-staff-hub:v1')
  } catch {
    /* bỏ qua */
  }

  const existing = await db.load()
  if (existing) return existing
  const seeded = buildSeed()
  await db.save(seeded)
  return seeded
}

export async function resetToSeed(): Promise<AppData> {
  const seeded = buildSeed()
  await db.save(seeded)
  return seeded
}

/* ------------------------------------------------------------------ */
/* Phiên đăng nhập                                                     */
/* ------------------------------------------------------------------ */

const SESSION_KEY = 'hvc-staff-hub:session'

export function saveSession(memberId: string) {
  try {
    localStorage.setItem(SESSION_KEY, memberId)
  } catch {
    /* bỏ qua */
  }
}

export function readSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* bỏ qua */
  }
}
