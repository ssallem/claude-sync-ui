import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ToastProvider } from "./components/Toast";
import { LanguageProvider } from "./i18n";
import "./index.css";

// LanguageProvider wraps ToastProvider so any toast that needs translation can
// call useTranslation() once we wire C-2.
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <LanguageProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </LanguageProvider>
  </React.StrictMode>,
);
