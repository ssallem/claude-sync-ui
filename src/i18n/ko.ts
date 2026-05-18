// Korean dictionary. Values are translated for end-user UI display.
// Keys mirror `en.ts` exactly — the Dict type guarantees lock-step.
// Interpolation placeholders ({n}, {time}, {ahead}, ...) are preserved
// verbatim so the runtime substitution still works.

import type { Dict } from "./index";

export const ko: Dict = {
  // Header
  "header.settings": "설정",
  "header.refresh": "새로고침",

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
  "file-tree.tracking_one": "{n}개 파일 추적 중 (제외: stow {stow}개, git {git}개)",
  "file-tree.tracking_other": "{n}개 파일 추적 중 (제외: stow {stow}개, git {git}개)",

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
  "init-screen.tip": "팁: 먼저 GitHub에 비어있는 비공개 저장소를 만드세요.",

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

  // ErrorBanner
  "error-banner.label": "오류",
  "error-banner.dismiss": "닫기",

  // Toast
  "toast.dismiss-aria": "닫기",

  // App-level toasts
  "app.action-failed": "{action} 실패: {message}",
  "app.resolve-coming":
    "충돌 해결 UI는 v0.2에서 추가될 예정입니다. 지금은 ~/.claude/<file>을 직접 편집하여 '_conflicts' 키를 제거한 뒤 푸시하세요.",
  "app.init-success": "초기화 완료! ~/.claude가 원격 저장소와 동기화되었습니다.",

  // Doctor levels (UI badge mapping)
  "doctor.level.ok": "정상",
  "doctor.level.warn": "경고",
  "doctor.level.fail": "실패",
};
