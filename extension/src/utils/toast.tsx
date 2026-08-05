// toast.ts
import { createRoot } from 'react-dom/client'
import Toast, { type ToastType } from '@/assets/components/Toast'

let toastContainer: HTMLDivElement | null = null
let toastRoot: any = null

interface ToastOptions {
  duration?: number
  onClose?: () => void
}

export const toast = {
  show: (message: string, type: ToastType = 'success', options?: ToastOptions) => {
    // 清理旧 Toast
    if (toastContainer) {
      toastRoot?.unmount()
      document.body.removeChild(toastContainer)
      toastContainer = null
      toastRoot = null
    }

    toastContainer = document.createElement('div')
    document.body.appendChild(toastContainer)

    toastRoot = createRoot(toastContainer)
    toastRoot.render(
      <Toast
        message={message}
        type={type}
        duration={options?.duration}
        onClose={() => {
          options?.onClose?.()
          setTimeout(() => {
            if (toastContainer) {
              toastRoot?.unmount()
              document.body.removeChild(toastContainer)
              toastContainer = null
              toastRoot = null
            }
          }, 300)
        }}
      />
    )
  },

  success: (message: string, options?: ToastOptions) => {
    toast.show(message, 'success', options)
  },

  error: (message: string, options?: ToastOptions) => {
    toast.show(message, 'error', options)
  },

  warning: (message: string, options?: ToastOptions) => {
    toast.show(message, 'warning', options)
  },

  info: (message: string, options?: ToastOptions) => {
    toast.show(message, 'info', options)
  }
}