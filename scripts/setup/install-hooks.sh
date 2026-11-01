#!/usr/bin/env bash
set -euo pipefail

main() {
	cd "$(dirname "$0")/../.."
	case "${CI:-}" in true | 1) return ;; esac
	clear_husky_path
	hooks_path=$(git config --get core.hooksPath || :)
	if [ -n "$hooks_path" ]; then
		echo 'Skipping hooks: a custom core.hooksPath is configured.'
		return
	fi
	prepare_hooks
	write_pre_commit
	write_commit_msg
	install_hook pre-commit
	install_hook commit-msg
}

clear_husky_path() {
	local_hooks_path=$(git config --local --get core.hooksPath || :)
	case "$local_hooks_path" in
	.husky | .husky/_ | ./.husky | ./.husky/_)
		git config --local --unset-all core.hooksPath
		;;
	esac
}

prepare_hooks() {
	hooks_dir=$(git rev-parse --git-path hooks)
	mkdir -p "$hooks_dir"
	hook_tmp_dir=$(mktemp -d "$hooks_dir/.koa-router.XXXXXX")
	trap 'rm -rf "$hook_tmp_dir"' 0
	trap 'exit 1' HUP INT TERM
}

install_hook() {
	hook_name=${1:?hook name is required}
	hook="$hooks_dir/$hook_name"
	if hook_exists; then
		echo "Skipping existing $hook_name hook."
		return
	fi
	chmod +x "$hook_tmp_dir/$hook_name"
	ln "$hook_tmp_dir/$hook_name" "$hook"
	echo "Installed $hook_name hook."
}

hook_exists() {
	[ -e "$hook" ] || [ -L "$hook" ]
}

write_pre_commit() {
	cat >"$hook_tmp_dir/pre-commit" <<'HOOK'
#!/bin/sh
# koa-router-managed-hook
set -eu
npm run check
HOOK
}

write_commit_msg() {
	cat >"$hook_tmp_dir/commit-msg" <<'HOOK'
#!/bin/sh
# koa-router-managed-hook
set -eu
header=$(head -n 1 < "$1")
case "$header" in Merge\ * | Revert\ * | fixup!\ * | squash!\ *) exit 0 ;; esac
pattern='^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([^()]+\))?!?: [^[:space:]].*$'
if [ "${#header}" -le 100 ] && printf '%s\n' "$header" | grep -Eq "$pattern"; then
  exit 0
fi
echo 'Use a Conventional Commit header under 101 characters, e.g. fix: preserve middleware.' >&2
exit 1
HOOK
}

main
