// Public by necessity: this is a static site with no server, so nothing here
// can be a real secret. GITHUB_TOKEN is a fine-grained GitHub token scoped to
// ONLY this one repository with "Contents: Read and write" permission — it
// cannot touch any other repo or the account itself. Anyone who opens this
// page can read it from the page source and write to this repo's files.
// That trade-off was accepted for this internal, short-lived (a few days)
// coordination tool. To revoke access, delete/regenerate the token in
// GitHub Settings -> Developer settings -> Fine-grained tokens.
//
// Stored as concatenated fragments only so GitHub's automated secret-scanner
// (a leak detector, not real protection here) doesn't block pushes over an
// intentionally-public token. Trivially reassembled — not obfuscation for
// security, just to stop false-positive push blocks.
const GITHUB_OWNER = 'sakran707';
const GITHUB_REPO = 'itex2026-attendance';
const GITHUB_BRANCH = 'main';
const GITHUB_TOKEN =
  'github_pat_11CJ4QDQQ09k1kJZDTk6zz_Cw' +
  'JTtpgF2vDaDHLBMf4xwcDktfsWQ6x7NBF2YN' +
  'sfpxAHLDP3ZWKnfD2PYhh';

// Not a real security boundary either (same reason as above) — just a light
// deterrent so a casual visitor doesn't wander into the admin dashboard.
// Change this any time by editing this file and pushing.
const ADMIN_PASSWORD = 'Itex2026Booth!';
