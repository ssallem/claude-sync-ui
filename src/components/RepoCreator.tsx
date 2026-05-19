// RepoCreator — Step 2 of the OAuth path. After GitHubAuthFlow stores the
// access token in the OS keyring, this component asks GitHub to create a
// private repository on the user's account and hands back the clone URL so
// the parent can feed it into the normal `api.init(remote)` flow.
//
// Error-mapping strategy:
//   The Rust side (src-tauri/src/github.rs::create_repo) emits a small set
//   of stable error strings (`repo_taken`, `forbidden`, `token_expired`,
//   `invalid_name`, `not_logged_in`, or `github_api_error:<code>:<body>`).
//   We map each string to an i18n key so the displayed message stays
//   translatable. The raw message is kept in `errorDetail` for developer
//   debugging — surfaced only as a tiny mono-font line below the i18n
//   message so end-users still see something friendly.
//
// Client-side validation:
//   We pre-empt the round-trip for an empty name (same policy as the Rust
//   guard `validate_repo_name`). Anything more aggressive (charset, length)
//   stays server-authoritative — the Rust validator is the single source
//   of truth.

import { useCallback, useRef, useState } from "react";
import { api } from "../lib/api";
import { useTranslation } from "../i18n";

interface RepoCreatorProps {
  // Called with the GitHub-returned clone URL (https://) on success.
  // Parent typically passes this straight to `api.init(remote)`. Async
  // return so the parent can throw on a follow-up failure (e.g. `init`
  // rejects because git can't push HTTPS without credentials) — we await
  // it here so the "Creating..." spinner stays visible until the whole
  // create+init pipeline either succeeds (this component unmounts as the
  // parent renders the main app) or fails (parent transitions us away).
  onCreated: (cloneUrl: string) => void | Promise<void>;
  // Called when the user backs out of this step. Parent decides whether
  // that means "back to choose" or "back to the auth flow".
  onBack: () => void;
}

// Maps the canonical Rust error string → i18n key. Anything outside this
// table falls through to a generic network message + raw detail.
function mapErrorKey(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("repo_taken")) return "github.error.repo-taken";
  if (m.includes("token_expired")) return "github.error.token-expired";
  if (m.includes("not_logged_in")) return "github.error.not-logged-in";
  if (m.includes("invalid_name")) return "github.error.invalid-name";
  if (m.includes("forbidden")) return "github.error.forbidden";
  // github_api_error:<code>:<body> and anything else → network bucket.
  return "github.error.network";
}

const errMsg = (e: unknown): string =>
  typeof e === "string" ? e : (e as Error)?.message ?? String(e);

export default function RepoCreator({ onCreated, onBack }: RepoCreatorProps) {
  const { t } = useTranslation();
  const [name, setName] = useState<string>("dotclaude");
  const [creating, setCreating] = useState<boolean>(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (creating) return;
      const trimmed = name.trim();
      // Pre-empt the server round-trip for the empty case — same policy as the
      // Rust `validate_repo_name` guard. Anything stricter stays server-side
      // so we don't drift from the canonical rules.
      if (trimmed.length === 0) {
        setErrorKey("github.error.invalid-name");
        setErrorDetail(null);
        inputRef.current?.focus();
        return;
      }
      setCreating(true);
      setErrorKey(null);
      setErrorDetail(null);
      try {
        const result = await api.githubCreateRepo(trimmed);
        // Await so the spinner stays visible while the parent runs init.
        // The parent (InitScreen) handles post-create failures by
        // transitioning state — it must NOT re-throw, because any error
        // that escapes here would be misclassified by `mapErrorKey` as a
        // GitHub network error even though the repo was created cleanly.
        // We trust the parent's contract: resolve = success, reject = it
        // already handled the failure and changed step out from under us.
        await onCreated(result.clone_url);
      } catch (err) {
        const raw = errMsg(err);
        setErrorKey(mapErrorKey(raw));
        setErrorDetail(raw);
        // Re-focus so the user can edit immediately on the common "name taken"
        // path without grabbing the mouse.
        inputRef.current?.focus();
        inputRef.current?.select();
      } finally {
        setCreating(false);
      }
    },
    [creating, name, onCreated],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full"
      aria-label={t("github.repo.title")}
    >
      <h2 className="text-lg font-semibold text-slate-100 mb-2">
        {t("github.repo.title")}
      </h2>
      <p className="text-sm text-slate-300 mb-4">{t("github.repo.description")}</p>

      <label
        htmlFor="repo-name"
        className="block text-xs uppercase tracking-wide text-slate-400 mb-1"
      >
        {t("github.repo.name-label")}
      </label>
      <input
        id="repo-name"
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        disabled={creating}
        className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-sm font-mono text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      />

      <p className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
        <span aria-hidden="true">🔒</span>
        <span>{t("github.repo.private-notice")}</span>
      </p>

      {errorKey && (
        <p className="mt-3 text-sm text-rose-400 break-words" role="alert">
          {t(errorKey)}
        </p>
      )}
      {errorDetail && errorKey === "github.error.network" && (
        // Dev hint for the catch-all branch only — known errors already have
        // a translated message that's friendlier than the raw string.
        <p className="mt-1 text-xs text-slate-500 font-mono break-all">
          {errorDetail}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={creating}
          className="flex-1 px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creating ? t("github.repo.creating") : t("github.repo.create-button")}
        </button>
      </div>

      <div className="mt-3 flex justify-start">
        <button
          type="button"
          onClick={onBack}
          disabled={creating}
          className="text-sm text-slate-400 hover:text-slate-200 disabled:opacity-50"
        >
          ← {t("github.repo.back")}
        </button>
      </div>
    </form>
  );
}
