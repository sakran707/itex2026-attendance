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

/**
 * Loads the latest roster, applies `mutate` to it, and commits the result.
 * Retries on a 409 (someone else saved in between, by re-reading the fresh
 * version and re-applying `mutate` on top of it) and on transient network
 * failures (common on mobile connections) with a short backoff, before
 * finally giving up.
 */
async function updateRoster(mutate, attempt = 0) {
  const MAX_ATTEMPTS = 6;
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
      if (attempt >= MAX_ATTEMPTS - 1) throw new Error(`roster_save_failed:${res.status}`);
      await sleep(400 * (attempt + 1));
      return updateRoster(mutate, attempt + 1);
    }
    return updated;
  } catch (err) {
    if (attempt >= MAX_ATTEMPTS - 1) throw err;
    await sleep(400 * (attempt + 1));
    return updateRoster(mutate, attempt + 1);
  }
}

window.itexStore = { fetchRosterWithSha, updateRoster };
