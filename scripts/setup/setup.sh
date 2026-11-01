#!/usr/bin/env bash
set -euo pipefail

main() {
	cd "$(dirname "$0")/../.."
	npm ci --ignore-scripts
	./scripts/setup/install-hooks.sh
}

main
