import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Lưới an toàn cuối cùng — nếu bất kỳ lỗi render nào lọt qua (vd dữ liệu cũ
 * trong localStorage không khớp mô hình dữ liệu mới sau khi cập nhật), React
 * mặc định sẽ unmount TOÀN BỘ cây component và để lại màn hình trắng, không
 * dấu vết. Boundary này chặn lỗi lại, hiện thông báo rõ ràng kèm nút khôi
 * phục dữ liệu mẫu — thay vì "mất giao diện" không rõ lý do.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary] Lỗi hiển thị:', error, info.componentStack)
  }

  private resetData = () => {
    try {
      localStorage.clear()
    } catch {
      /* bỏ qua */
    }
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 p-6">
        <div className="w-full max-w-md rounded-2xl border border-rose-100 bg-white p-6 shadow-lg">
          <p className="text-[15px] font-bold text-rose-700">Đã có lỗi khi hiển thị trang</p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-500">
            Có thể do dữ liệu đã lưu trong trình duyệt này không còn khớp với phiên bản hiện tại của
            hệ thống. Bấm nút bên dưới để khôi phục dữ liệu mẫu và tải lại — thao tác này không ảnh
            hưởng tới ai khác.
          </p>
          <p className="mt-3 rounded-lg bg-ink-50 p-2.5 font-mono text-[11px] text-ink-400">
            {this.state.error.message}
          </p>
          <button
            onClick={this.resetData}
            className="mt-4 h-10 w-full rounded-xl bg-brand-500 text-[13px] font-bold text-white transition-colors hover:bg-brand-600"
          >
            Khôi phục dữ liệu mẫu &amp; tải lại
          </button>
        </div>
      </div>
    )
  }
}
