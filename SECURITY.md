# Security notes

## Known npm vulnerabilities (tracked intentionally)

### postcss < 8.5.10 — XSS via unescaped `</style>` in CSS stringify output

- **Advisory**: GHSA-qx2v-qp2m-jg93
- **Severity**: Moderate
- **Affected package**: `postcss` (transitive dependency via `next`)
- **Why not fixed**: The only automated fix (`npm audit fix --force`) would downgrade Next.js from 15 to 9.3.3, which is a breaking change. This is not acceptable.
- **Actual risk**: The vulnerable `postcss` code path is only exercised at **build time** (CSS processing), not at runtime in the deployed Cloudflare Worker. No user-supplied CSS is processed by this code path. Exploitation in production is not possible.
- **Resolution path**: Wait for Next.js to ship a patch release that bumps its internal `postcss` dependency to ≥ 8.5.10. Track: https://github.com/vercel/next.js/issues
- **Last reviewed**: 2026-06-12

---

To re-audit: `npm audit`
To apply safe fixes: `npm audit fix` (no `--force`)
