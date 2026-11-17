#!/usr/bin/env bash
# Local and CI security checks that need no accounts: everything runs in Docker containers.
#
#   ./ops/security-scan.sh images    # builds the prod images and scans them with Trivy (fails on fixable HIGH/CRITICAL)
#   ./ops/security-scan.sh secrets   # looks for committed secrets in the whole git history with gitleaks
#   ./ops/security-scan.sh sbom      # writes a CycloneDX bill of materials per image to sbom/
#   ./ops/security-scan.sh all
#
# Why Trivy sees what `npm audit` does not: the base image brings its own npm, Alpine packages and nginx.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
# Inside the repository (ignored by git): docker.exe cannot write to Git Bash's /tmp.
SCAN_DIR="$ROOT_DIR/.scan-tmp"
mkdir -p "$SCAN_DIR"
trap 'rm -rf "$SCAN_DIR"' EXIT
# Pinned in CI by a digest bump through Dependabot-style review; `latest` keeps the vulnerability data fresh.
TRIVY_IMAGE="${TRIVY_IMAGE:-aquasec/trivy:latest}"
GITLEAKS_IMAGE="${GITLEAKS_IMAGE:-zricethezav/gitleaks:latest}"

# Git Bash on Windows rewrites /paths in arguments (also the container side of -v); this switches that off.
# Build contexts are relative (cd above) because docker.exe cannot read Git Bash style absolute paths.
export MSYS_NO_PATHCONV=1

build_images() {
  docker build -q --target prod -t flowsync-backend-scan ./backend >/dev/null
  docker build -q --target prod -t flowsync-frontend-scan ./frontend >/dev/null
  docker save flowsync-backend-scan -o .scan-tmp/backend.tar
  docker save flowsync-frontend-scan -o .scan-tmp/frontend.tar
}

trivy() {
  docker run --rm -v "$SCAN_DIR:/scan:ro" -v "$ROOT_DIR/.trivyignore:/.trivyignore:ro" \
    "$TRIVY_IMAGE" "$@" --ignorefile /.trivyignore
}

scan_images() {
  build_images
  local failed=0
  for name in backend frontend; do
    echo "== Trivy: $name"
    # --ignore-unfixed: a vulnerability nobody has patched yet is not actionable, and would block every build.
    trivy image --input "/scan/$name.tar" --severity HIGH,CRITICAL --ignore-unfixed \
      --scanners vuln --exit-code 1 --quiet || failed=1
  done
  [ "$failed" -eq 0 ] && echo "Images: no fixable HIGH or CRITICAL vulnerabilities" || return 1
}

scan_secrets() {
  echo "== gitleaks: whole history"
  docker run --rm -v "$ROOT_DIR:/repo:ro" "$GITLEAKS_IMAGE" detect --source /repo --no-banner --redact --verbose
}

make_sbom() {
  build_images
  mkdir -p "$ROOT_DIR/sbom"
  for name in backend frontend; do
    docker run --rm -v "$SCAN_DIR:/scan:ro" -v "$ROOT_DIR/sbom:/out" "$TRIVY_IMAGE" \
      image --input "/scan/$name.tar" --format cyclonedx --output "/out/$name.cdx.json" --quiet
    echo "sbom/$name.cdx.json: $(grep -c '"purl"' "$ROOT_DIR/sbom/$name.cdx.json") components"
  done
}

case "${1:-all}" in
  images) scan_images ;;
  secrets) scan_secrets ;;
  sbom) make_sbom ;;
  all) scan_secrets; scan_images; make_sbom ;;
  *) echo "Usage: $0 images|secrets|sbom|all" >&2; exit 2 ;;
esac
