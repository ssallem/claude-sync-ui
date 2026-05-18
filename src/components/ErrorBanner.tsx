// Temporary error surface used until Day 5 introduces a real toast component.
// Renders only when `message` is non-null; dismissible via the close button.

import { useTranslation } from "../i18n";

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export default function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  const { t } = useTranslation();
  return (
    <div className="bg-red-600 text-white px-3 py-2 flex items-center gap-3 text-sm border-b border-red-700">
      <span className="font-semibold uppercase tracking-wide text-xs">{t("error-banner.label")}</span>
      <span className="flex-1 truncate" title={message}>
        {message}
      </span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="px-2 py-0.5 rounded bg-red-700 hover:bg-red-800 active:bg-red-900 text-xs"
        >
          {t("error-banner.dismiss")}
        </button>
      )}
    </div>
  );
}
