// Korean dictionary. Values are translated for end-user UI display.
// Keys mirror `en.ts` exactly — the Dict type guarantees lock-step.
// Interpolation placeholders ({n}, {time}, {ahead}, ...) are preserved
// verbatim so the runtime substitution still works.

import type { Dict } from "./index";

export const ko: Dict = {
  // Header
  "header.settings": "설정",
  "header.refresh": "새로고침",
  // v0.2.8 — Header에 노출된 별도 GitHub 로그아웃 진입점. SettingsModal의
  // "GitHub 계정 연결 해제"는 유지하되, dogfood에서 사용자가 못 찾았다.
  "header.github-logout": "로그아웃",
  "header.github-logout-success": "GitHub 로그아웃 되었습니다.",

  // RemoteBar
  "remote-bar.remote-label": "원격:",
  "remote-bar.local-label": "로컬:",
  "remote-bar.no-sync-yet": "(아직 동기화되지 않음)",
  "remote-bar.last-sync": "마지막 동기화: {time}",
  "remote-bar.change": "변경",

  // StatusBadge
  "status-badge.modified": "수정됨",
  "status-badge.added": "추가됨",
  "status-badge.deleted": "삭제됨",
  "status-badge.untracked": "추적 안 됨",
  "status-badge.conflict": "충돌",
  "status-badge.synced": "동기화됨",

  // FileTree
  "file-tree.empty": "변경 사항 없음 — 깨끗합니다",
  "file-tree.root-bucket": "(루트)",
  "file-tree.tracking": "{n}개 파일 추적 중 (제외: stow {stow}개, git {git}개)",
  "file-tree.tracking_one": "{n}개 파일 추적 중 (제외: stow {stow}개, git {git}개)",
  "file-tree.tracking_other": "{n}개 파일 추적 중 (제외: stow {stow}개, git {git}개)",
  "file-tree.show-excluded": "무엇이 제외됐어?",
  // v0.2.5 — 파일 row를 더블클릭하면 OS 기본 에디터에서 열기.
  "file-tree.open-in-editor": "더블클릭하여 에디터에서 열기",
  "file-tree.open-failed": "파일 열기 실패: {message}",

  // StowignoreModal
  "stowignore-modal.title": "동기화에서 제외된 항목",
  "stowignore-modal.description":
    "~/.claude/.stowignore 의 규칙에 일치하는 경로는 이 PC에만 남고 원격으로 푸시되지 않습니다. 컴퓨터별 상태(projects/, file-history/, daemon/ 등)가 여기에 들어갑니다.",
  "stowignore-modal.loading": ".stowignore 읽는 중...",
  "stowignore-modal.empty":
    ".stowignore 파일이 없습니다. ~/.claude/ 안의 모든 추적 경로가 푸시됩니다.",
  "stowignore-modal.close": "닫기",
  "stowignore-modal.close-aria": "창 닫기",

  // ActionBar
  "action-bar.push": "보내기 {n}↑",
  "action-bar.pull": "받기 {n}↓",
  "action-bar.resolve": "충돌 해결 ({n})",
  "action-bar.refresh": "새로고침",

  // StatusBar
  "status-bar.loading": "상태 불러오는 중...",
  "status-bar.summary": "{ahead}개 앞섬, {behind}개 뒤처짐",
  "status-bar.last-sync": "마지막 동기화 {time}",
  "status-bar.files-tracked": "{n}개 파일 추적 중",
  "status-bar.branch": "브랜치: {branch}",

  // InitScreen
  "init-screen.welcome": "claude-sync에 오신 것을 환영합니다",
  "init-screen.description":
    "~/.claude 폴더를 여러 PC에서 Git으로 동기화합니다. 비어있는 (또는 이미 claude-sync로 설정된) Git 저장소의 원격 URL을 입력하세요.",
  "init-screen.remote-url-label": "원격 URL",
  "init-screen.placeholder": "https://github.com/you/dotclaude.git",
  "init-screen.invalid": "https://, ssh://, git@로 시작하거나 로컬 절대 경로여야 합니다.",
  "init-screen.submit": "초기화",
  "init-screen.submitting": "초기화 중...",
  "init-screen.tip": "원격 저장소가 미리 존재하고 push 권한이 있어야 합니다.",
  "init-screen.or": "또는",
  // v0.2.2 — OAuth로 저장소는 만들었지만 로컬 init이 실패한 경우 (대부분 git
  // HTTPS 자격 증명 문제) 표시. URL은 아래에 미리 입력되어 있어 자격 증명을
  // 설정한 뒤 초기화 버튼만 누르면 재시도된다.
  "init-screen.repo-created-init-failed":
    "GitHub 저장소는 생성되었지만 로컬 초기화에 실패했습니다. 아래에 URL이 미리 입력되어 있습니다 — Git 자격 증명을 설정하거나 (또는 SSH 사용) 초기화 버튼을 눌러 다시 시도하세요.",

  // SettingsModal
  "settings-modal.title": "설정",
  "settings-modal.close-aria": "닫기",
  "settings-modal.running": "진단 검사 실행 중...",
  "settings-modal.overall": "종합:",
  "settings-modal.change-remote": "원격 변경",
  "settings-modal.close": "닫기",
  "settings-modal.new-remote-label": "새 원격 URL",
  "settings-modal.new-remote-placeholder": "git@github.com:you/dotclaude.git",
  "settings-modal.invalid-remote": "https://, ssh://, git@로 시작하거나 로컬 절대 경로여야 합니다.",
  "settings-modal.update": "변경",
  "settings-modal.updating": "변경 중...",
  "settings-modal.cancel": "취소",
  "settings-modal.update-success": "원격이 성공적으로 변경되었습니다",
  "settings-modal.language": "언어",
  "settings-modal.github-logout": "GitHub 계정 연결 해제",
  "settings-modal.github-logout-success": "GitHub 계정이 연결 해제되었습니다.",

  // ErrorBanner
  "error-banner.label": "오류",
  "error-banner.dismiss": "닫기",
  "error-banner.dismiss-aria": "오류 닫기",
  "error-banner.show-more": "전체 보기",
  "error-banner.show-less": "접기",
  "error-banner.create-stowignore": ".stowignore 생성",
  "error-banner.stowignore-success":
    "기본 .stowignore가 생성되었습니다. 다시 초기화하세요.",
  "error-banner.smart-stowignore-success":
    "{n}개 감지된 경로가 포함된 스마트 .stowignore가 생성되었습니다. 다시 초기화하세요.",
  "error-banner.path-outside-claude-dir":
    ".stowignore를 생성할 수 없습니다: 감지된 경로 중 ~/.claude/ 외부 경로가 있습니다. 파일을 직접 편집하세요.",
  "error-banner.stowignore-exists":
    ".stowignore가 이미 존재합니다. 수동으로 편집하세요.",

  // Toast
  "toast.dismiss-aria": "닫기",

  // App-level toasts
  "app.action-failed": "{action} 실패: {message}",
  "app.resolve-coming":
    "충돌 해결 UI는 v0.2에서 추가될 예정입니다. 지금은 ~/.claude/<file>을 직접 편집하여 '_conflicts' 키를 제거한 뒤 푸시하세요.",
  "app.init-success": "초기화 완료! ~/.claude가 원격 저장소와 동기화되었습니다.",
  // v0.2.7 — ls-remote 기반 검증으로 변경: 사이드카 버그뿐만 아니라
  // 네트워크/타임아웃 이슈도 같은 토스트로 표시한다.
  "app.push-unverified":
    "푸시가 GitHub에 도달하지 못했습니다 — 원격 ref가 갱신되지 않았습니다. 사이드카 버그 또는 네트워크 문제일 수 있습니다. 수동으로 `git push`를 실행하거나 연결 상태를 확인하세요.",

  // Doctor levels (UI badge mapping)
  "doctor.level.ok": "정상",
  "doctor.level.warn": "경고",
  "doctor.level.fail": "실패",

  // GitHubAuthFlow — OAuth Device Flow UI strings.
  "github.auth.preparing": "GitHub 로그인 준비 중...",
  "github.auth.enter-code-at": "{url}에서 이 코드를 입력하세요",
  "github.auth.copy-code": "코드 복사",
  "github.auth.copy-success": "복사됨",
  "github.auth.open-browser": "브라우저에서 열기",
  "github.auth.expires-in": "{min}:{sec} 후 만료",
  "github.auth.polling": "승인을 기다리는 중...",
  "github.auth.cancel": "취소",
  "github.auth.scope-notice":
    "이 앱은 비공개 저장소 생성 권한(repo)을 요청합니다.",
  "github.auth.success": "연결되었습니다",
  "github.auth.try-again": "다시 시도",
  "github.error.expired": "코드가 만료되었습니다. 다시 시도해주세요.",
  "github.error.denied": "요청을 거부하셨습니다.",
  "github.error.network": "네트워크 오류입니다. 연결을 확인해주세요.",

  // GitHub OAuth — login entry + RepoCreator screen (B-3-2).
  "github.auth.button-login": "GitHub으로 로그인",
  "github.repo.title": "비공개 저장소 만들기",
  "github.repo.name-label": "저장소 이름",
  "github.repo.private-notice": "저장소는 비공개로 생성됩니다.",
  "github.repo.description":
    "여러분의 GitHub 계정에 만들어 설정 동기화에 사용됩니다.",
  "github.repo.create-button": "비공개 저장소 생성",
  "github.repo.creating": "생성 중...",
  "github.repo.back": "뒤로",
  "github.error.repo-taken":
    "같은 이름의 저장소가 이미 있습니다. 다른 이름을 입력해주세요.",
  "github.error.forbidden":
    "GitHub이 요청을 거부했습니다. 계정 권한을 확인해주세요.",
  "github.error.token-expired":
    "GitHub 세션이 만료되었습니다. 다시 로그인해주세요.",
  "github.error.invalid-name": "저장소 이름은 비워둘 수 없습니다.",
  "github.error.not-logged-in": "먼저 GitHub에 로그인해주세요.",
};
