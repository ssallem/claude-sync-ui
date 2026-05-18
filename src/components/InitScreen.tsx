// First-run screen. After B-3-2 this is a stepper with three observable
// states:
//   - 'choose'     : the user picks between OAuth (preferred) and manual URL
//   - 'oauth-auth' : GitHubAuthFlow runs Device Flow against GitHub
//   - 'oauth-repo' : RepoCreator asks GitHub to make a private repo, then
//                    hands its clone_url back to `onSubmit` — the parent's
//                    existing handler treats it exactly like a user-typed
//                    remote, so the rest of the app stays oblivious to the
//                    OAuth path.
//
// Why option B (inline) instead of routes? The whole stepper lives inside
// one card so the user never sees a layout flash. Card width is also
// constrained (max-w-md) so the dense Device Flow UI doesn't get washed
// out on wide screens.
//
// Props stay byte-identical to the v0.1.x signature so App.tsx, App.test
// and every other consumer keeps working without changes.

import { useState } from "react";
import { useTranslation } from "../i18n";
import GitHubAuthFlow from "./GitHubAuthFlow";
import RepoCreator from "./RepoCreator";
import ManualRemoteForm from "./ManualRemoteForm";

interface InitScreenProps {
  onSubmit: (remote: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

type Step = "choose" | "oauth-auth" | "oauth-repo" | "manual";

export default function InitScreen({ onSubmit, loading, error }: InitScreenProps) {
  const { t } = useTranslation();
  // 'manual' is reserved for a possible future "fold the form out of view by
  // default" variant. The current 'choose' UI already shows the manual form
  // inline, so we never set 'manual' explicitly — but the enum keeps the door
  // open without churning Props.
  const [step, setStep] = useState<Step>("choose");

  return (
    <div className="h-full flex items-center justify-center p-6 bg-slate-900 text-slate-100">
      <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-lg p-6 shadow-xl">
        <h1 className="text-2xl font-semibold mb-2">{t("init-screen.welcome")}</h1>
        <p className="text-sm text-slate-300 mb-6">{t("init-screen.description")}</p>

        {step === "choose" && (
          <>
            <button
              type="button"
              onClick={() => setStep("oauth-auth")}
              disabled={loading}
              className="w-full px-3 py-3 rounded-md bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span aria-hidden="true">🔓</span>{" "}
              {t("github.auth.button-login")}
            </button>

            {/* Visual separator between the OAuth shortcut and the manual fallback. */}
            <div className="my-6 flex items-center" aria-hidden="true">
              <hr className="flex-grow border-slate-700" />
              <span className="mx-3 text-slate-500 text-xs uppercase tracking-wide">
                {t("init-screen.or")}
              </span>
              <hr className="flex-grow border-slate-700" />
            </div>

            <ManualRemoteForm
              onSubmit={onSubmit}
              loading={loading}
              externalError={error}
            />
          </>
        )}

        {step === "oauth-auth" && (
          // GitHubAuthFlow brings its own dialog chrome (rounded card + spinner
          // states). We render it inline here so the user stays inside the same
          // outer card — the nested chrome is intentional for now and will be
          // reconciled when GitHubAuthFlow grows a "borderless" variant.
          <GitHubAuthFlow
            onSuccess={() => setStep("oauth-repo")}
            onCancel={() => setStep("choose")}
          />
        )}

        {step === "oauth-repo" && (
          <RepoCreator
            onCreated={(cloneUrl) => {
              // Hand the GitHub-generated URL straight to the existing init
              // handler — App.tsx already runs `api.init(remote)` + refresh +
              // success toast, so we don't duplicate any of that here.
              void onSubmit(cloneUrl);
            }}
            // Back out to the auth flow rather than 'choose' so a "wrong
            // account" recovery means re-running Device Flow, not retyping
            // a URL.
            onBack={() => setStep("oauth-auth")}
          />
        )}
      </div>
    </div>
  );
}
