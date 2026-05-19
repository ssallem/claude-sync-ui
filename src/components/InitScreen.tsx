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
//
// v0.2.2: post-repo-create init can still fail (most commonly because git
// HTTPS push needs credentials the user hasn't configured). When that
// happens we *must* leave the 'oauth-repo' step or the user is stuck on
// a screen that re-creating-the-same-repo would just fail with `repo_taken`.
// We bounce back to 'choose' and pre-fill the manual form with the clone_url
// the user just paid to create, so retry/recovery is one click away. The
// inline `error` prop is already populated by App.tsx's setInitError, so the
// failure surface renders for free via ManualRemoteForm.externalError.

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
  // Holds the clone_url of a repo we successfully created on GitHub but
  // failed to `init` against locally. We pass it down so ManualRemoteForm can
  // pre-fill the input — without this, the user would have to leave the app,
  // look up their newly-created repo, copy the URL, and paste it back.
  const [pendingRemote, setPendingRemote] = useState<string>("");

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

            {pendingRemote && (
              // Distinct from a normal init-failure banner: tells the user
              // *why* the form is pre-filled and what to do next. We surface
              // this even when `error` is null (defense in depth — the inline
              // error path already covers the failure detail).
              <p
                className="mb-3 text-xs text-amber-300 bg-amber-950/40 border border-amber-800/60 rounded-md px-3 py-2"
                role="status"
              >
                {t("init-screen.repo-created-init-failed")}
              </p>
            )}
            <ManualRemoteForm
              onSubmit={onSubmit}
              loading={loading}
              externalError={error}
              initialRemote={pendingRemote}
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
            onCreated={async (cloneUrl) => {
              // Hand the GitHub-generated URL straight to the existing init
              // handler — App.tsx runs `api.init(remote)` + refresh + success
              // toast. On success the parent re-renders and this whole
              // InitScreen unmounts (status flips to initialized).
              //
              // CRITICAL (v0.2.2): we *must* await + catch. Without this,
              // an init failure (e.g. git HTTPS push without credentials)
              // leaves the user on a RepoCreator screen with the same name
              // already taken on GitHub — clicking Create again fails with
              // `repo_taken` and the user is stuck. Bounce back to 'choose'
              // and pre-fill the manual form with the URL we just paid to
              // create so retry is one click away. App.tsx already set
              // `initError`, which surfaces via ManualRemoteForm.externalError.
              try {
                await onSubmit(cloneUrl);
              } catch {
                setPendingRemote(cloneUrl);
                setStep("choose");
              }
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
