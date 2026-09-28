// Public by necessity: this is a static site with no server, so nothing here
// can be a real secret. GITHUB_TOKEN is a fine-grained GitHub token scoped to
// ONLY this one repository with "Contents: Read and write" permission — it
// cannot touch any other repo or the account itself. Anyone who opens this
// page can read it from the page source and write to this repo's files.
// That trade-off was accepted for this internal, short-lived (a few days)
// coordination tool. To revoke access, delete/regenerate the token in
// GitHub Settings -> Developer settings -> Fine-grained tokens.
const GITHUB_OWNER = 'sakran707';
const GITHUB_REPO = 'itex2026-attendance';
const GITHUB_BRANCH = 'main';
const GITHUB_TOKEN = 'REPLACE_WITH_FINE_GRAINED_TOKEN';

// Not a real security boundary either (same reason as above) — just a light
// deterrent so a casual visitor doesn't wander into the admin dashboard.
const ADMIN_PASSWORD = 'change-me';
