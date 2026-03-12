import { toast as rtToast, type ToastOptions } from "react-toastify";

interface MessageOptions {
  description?: string;
}

const normalize = (title: string, options?: MessageOptions): string =>
  options?.description ? `${title} — ${options.description}` : title;

export const toast = {
  success: (title: string, options?: MessageOptions) => rtToast.success(normalize(title, options)),
  error: (title: string, options?: MessageOptions) => rtToast.error(normalize(title, options)),
  info: (title: string, options?: MessageOptions) => rtToast.info(normalize(title, options)),
  warning: (title: string, options?: MessageOptions) => rtToast.warning(normalize(title, options)),
  message: (title: string, options?: MessageOptions) => rtToast.info(normalize(title, options)),
  dismiss: (id?: string | number) => rtToast.dismiss(id)
};

export const toastConfig: ToastOptions = {
  position: "top-right",
  autoClose: 3400,
  theme: "colored"
};
