import { ref } from 'vue';

// Types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  createdAt: number;
}

export interface ToastOptions {
  title?: string;
  duration?: number;
}

// Simple reactive state (shared across the app)
const toasts = ref<ToastData[]>([]);

const getDefaultDuration = (type: ToastType): number => {
  switch (type) {
    case 'error':
      return 8000; // Errors stay longer
    case 'warning':
      return 6000;
    case 'info':
      return 5000;
    case 'success':
      return 4000;
    default:
      return 5000;
  }
};

const add = (toast: Omit<ToastData, 'id' | 'createdAt'>) => {
  const id = crypto.randomUUID();
  const duration = toast.duration ?? getDefaultDuration(toast.type);
  const newToast: ToastData = {
    ...toast,
    id,
    createdAt: Date.now(),
    duration
  };
  
  toasts.value.push(newToast);
  
  // Auto dismiss after duration
  if (duration > 0) {
    setTimeout(() => {
      remove(id);
    }, duration);
  }
  
  return id;
};

const remove = (id: string) => {
  const index = toasts.value.findIndex(t => t.id === id);
  if (index > -1) {
    toasts.value.splice(index, 1);
  }
};

const clear = () => {
  toasts.value = [];
};

// Composables
export const useToastState = () => {
  return {
    toasts,
    add,
    remove,
    clear
  };
};

export const useToast = () => {
  const show = (type: ToastType, message: string, options?: ToastOptions) => {
    return add({
      type,
      message,
      title: options?.title,
      duration: options?.duration
    });
  };
  
  const success = (message: string, options?: ToastOptions) => {
    return show('success', message, options);
  };
  
  const error = (message: string, options?: ToastOptions) => {
    return show('error', message, options);
  };
  
  const warning = (message: string, options?: ToastOptions) => {
    return show('warning', message, options);
  };
  
  const info = (message: string, options?: ToastOptions) => {
    return show('info', message, options);
  };
  
  return {
    success,
    error,
    warning,
    info,
    remove,
    clear
  };
};