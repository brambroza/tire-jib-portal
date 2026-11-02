"use client";

import { useEffect } from "react";

type ActionFeedbackProps = {
  error?: string | null;
  success?: string | null;
  onClearError?: () => void;
  onClearSuccess?: () => void;
};

export default function ActionFeedback({
  error,
  success,
  onClearError,
  onClearSuccess
}: ActionFeedbackProps) {
  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => {
      onClearSuccess?.();
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [success, onClearSuccess]);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => {
      onClearError?.();
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [error, onClearError]);

  if (!error && !success) return null;

  return (
    <div className="snackbar-wrap" role="status" aria-live="polite">
      {success && (
        <div className="snackbar snackbar-success">
          <div className="snackbar-dot" />
          <div className="snackbar-text">{success}</div>
          <button className="snackbar-close" onClick={onClearSuccess} aria-label="close success message">
            x
          </button>
        </div>
      )}
      {error && (
        <div className="snackbar snackbar-error" role="alert" aria-live="assertive">
          <div className="snackbar-dot" />
          <div className="snackbar-text">{error}</div>
          <button className="snackbar-close" onClick={onClearError} aria-label="close error message">
            x
          </button>
        </div>
      )}
    </div>
  );
}
