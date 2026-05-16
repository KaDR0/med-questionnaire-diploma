import { useCallback } from "react";
import { useSnackbar } from "notistack";

/**
 * Thin convenience wrapper over notistack so pages don't have to know about variants/keys.
 *
 * Usage:
 *   const toast = useToast();
 *   toast.success("Saved");
 *   toast.error(t("patients.importError"));
 *   toast.info("Heads up", { persist: true });
 *
 * Returns the underlying enqueue/close as well, in case a caller needs full control.
 */
export default function useToast() {
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  const make = useCallback(
    (variant) => (message, options = {}) =>
      enqueueSnackbar(message, { variant, ...options }),
    [enqueueSnackbar]
  );

  return {
    success: make("success"),
    error: make("error"),
    warning: make("warning"),
    info: make("info"),
    default: make("default"),
    enqueue: enqueueSnackbar,
    close: closeSnackbar,
  };
}
