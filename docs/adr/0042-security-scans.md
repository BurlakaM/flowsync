# 42. Security scans

- **Status:** accepted
- **Date:** 2026-11-17
- **In the plan log:** D42 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

The `ops/security-scan.sh` script in Docker (Trivy for images, gitleaks for history, a CycloneDX SBOM) — the same locally and in CI; CodeQL as a separate workflow; `npm audit` remains for dependencies

## Alternatives considered and why not

`npm audit` alone (does not see the OS, the npm from the base image, or nginx); paid/cloud scanners (need accounts)
