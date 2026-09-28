// Uses the roster JSON file inside this same GitHub repo as the shared
// database, read and written directly from the browser via the GitHub
// Contents API. See github-config.js for the (intentionally public) token.

const DATA_PATH = 'data/roster.json';
const API_BASE = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DATA_PATH}`;

function decodeBase64Utf8(b64) {
  const binary = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

function encodeUtf8Base64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

async function fetchRosterWithSha() {
  const res = await fetch(`${API_BASE}?ref=${GITHUB_BRANCH}`, {
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`roster_fetch_failed:${res.status}`);
  const data = await res.json();
  return { roster: JSON.parse(decodeBase64Utf8(data.content)), sha: data.sha };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A 409 (someone else saved a split-second earlier) is cheap to recover from —
// just re-read and re-apply — so it gets many fast retries with light jitter.
// Everything else (dropped connections, GitHub briefly rate-limiting a burst
// of near-simultaneous saves from many phones) gets fewer retries with a
// growing backoff, since hammering it faster tends to make that worse.
const MAX_CONFLICT_ATTEMPTS = 20;
const MAX_OTHER_ATTEMPTS = 8;

/**
 * Loads the latest roster, applies `mutate` to it, and commits the result.
 * `onRetry(attempt)` is called before each retry so the caller can show
 * progress instead of a silent stall.
 */
async function updateRoster(mutate, onRetry, conflictAttempt = 0, otherAttempt = 0) {
  try {
    const { roster, sha } = await fetchRosterWithSha();
    const updated = mutate(roster);
    const res = await fetch(API_BASE, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Update ITEX 2026 attendance',
        content: encodeUtf8Base64(JSON.stringify(updated, null, 2) + '\n'),
        sha,
        branch: GITHUB_BRANCH,
      }),
    });
    if (!res.ok) {
      if (res.status === 409) {
        if (conflictAttempt >= MAX_CONFLICT_ATTEMPTS - 1) throw new Error(`roster_save_failed:${res.status}`);
        onRetry?.(conflictAttempt + otherAttempt + 1);
        await sleep(150 + Math.random() * 250);
        return updateRoster(mutate, onRetry, conflictAttempt + 1, otherAttempt);
      }
      if (otherAttempt >= MAX_OTHER_ATTEMPTS - 1) throw new Error(`roster_save_failed:${res.status}`);
      onRetry?.(conflictAttempt + otherAttempt + 1);
      await sleep(Math.min(600 * 2 ** otherAttempt, 4000));
      return updateRoster(mutate, onRetry, conflictAttempt, otherAttempt + 1);
    }
    return updated;
  } catch (err) {
    if (otherAttempt >= MAX_OTHER_ATTEMPTS - 1) throw err;
    onRetry?.(conflictAttempt + otherAttempt + 1);
    await sleep(Math.min(600 * 2 ** otherAttempt, 4000));
    return updateRoster(mutate, onRetry, conflictAttempt, otherAttempt + 1);
  }
}

window.itexStore = { fetchRosterWithSha, updateRoster };
