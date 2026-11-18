# 31. Files

- **Status:** accepted
- **Date:** 2026-11-16
- **In the plan log:** D31 (`docs/ARCHITECTURE_PLAN.md`, section 3)

## Decision

Uploads through the API (`multer`): type detected from the bytes, up to 2 MB, SVG forbidden; stored in S3-compatible storage (`@aws-sdk/client-s3`), served only to project members. Dev storage is RustFS (the MinIO image is no longer published for free)

## Alternatives considered and why not

Presigned URLs: the storage must be reachable from the browser, and the server does not verify the file type
