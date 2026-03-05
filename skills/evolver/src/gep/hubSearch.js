// Hub Search-First Evolution: query evomap-hub for reusable solutions before local solve.
//
// Flow: extractSignals() -> hubSearch(signals) -> if hit: reuse; if miss: normal evolve
// Two modes: direct (skip local reasoning) | reference (inject into prompt as strong hint)

const { getNodeId } = require('./a2aProtocol');

const DEFAULT_MIN_REUSE_SCORE = 0.72;
const DEFAULT_REUSE_MODE = 'reference'; // 'direct' | 'reference'

// ---------------------------------------------------------------------------
// GRC URL / Auth resolution
// ---------------------------------------------------------------------------

const DEFAULT_GRC_URL = 'https://grc.winclawhub.ai';

/**
 * Resolve the hub URL from (in priority order):
 *  1. A2A_HUB_URL environment variable
 *  2. GRC_URL environment variable
 *  3. WinClaw config file (~/.winclaw/config.json5) grc.url field
 *     (uses a GRC-section-aware regex to avoid matching unrelated "url" fields)
 *  4. Hard-coded default: https://grc.winclawhub.ai
 *
 * Never throws — falls back silently to the default.
 * @returns {string}
 */
function resolveHubUrl() {
  // Priority 1: explicit A2A env override
  if (process.env.A2A_HUB_URL) return process.env.A2A_HUB_URL;

  // Priority 2: GRC-specific env override
  if (process.env.GRC_URL) return process.env.GRC_URL;

  try {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const configPath = path.join(os.homedir(), '.winclaw', 'config.json5');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      // Look for url within the grc section (match "grc" key, then find url inside its braces).
      // This avoids matching a "url" from an unrelated config section.
      const grcMatch = content.match(/["']?grc["']?\s*:\s*\{[^}]*["']?url["']?\s*:\s*["']([^"']+)["']/);
      if (grcMatch) return grcMatch[1];
    }
  } catch (_e) {
    // Silently fall through to default
  }

  return DEFAULT_GRC_URL;
}

/**
 * Read the Bearer token for GRC authentication.
 * Priority order:
 *  1. GRC_AUTH_TOKEN environment variable (preferred — avoids plaintext on disk)
 *  2. WinClaw config file (~/.winclaw/config.json5) grc.auth.token field
 * Returns null when no token is configured or the file cannot be read.
 * Never throws.
 * @returns {string|null}
 */
function getAuthToken() {
  // Priority 1: environment variable (safer than reading from plaintext config)
  if (process.env.GRC_AUTH_TOKEN) return process.env.GRC_AUTH_TOKEN;

  try {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const configPath = path.join(os.homedir(), '.winclaw', 'config.json5');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      const match = content.match(/"token"\s*:\s*"([^"]+)"/);
      if (match) return match[1];
    }
  } catch (_e) {
    // No token available
  }
  return null;
}

// ---------------------------------------------------------------------------
// In-memory search cache (5-minute TTL, max 100 entries)
// ---------------------------------------------------------------------------

const searchCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Return cached search results for key, or null if missing / expired.
 * @param {string} cacheKey
 * @returns {object[]|null}
 */
function getCachedSearch(cacheKey) {
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.results;
  }
  searchCache.delete(cacheKey);
  return null;
}

/**
 * Store search results in the cache.  Evicts the oldest entry when the cache
 * exceeds 100 entries.
 * @param {string} cacheKey
 * @param {object[]} results
 */
function setCachedSearch(cacheKey, results) {
  searchCache.set(cacheKey, { results, timestamp: Date.now() });
  // Limit cache size
  if (searchCache.size > 100) {
    const oldest = searchCache.keys().next().value;
    searchCache.delete(oldest);
  }
}

// ---------------------------------------------------------------------------
// Existing helpers (unchanged)
// ---------------------------------------------------------------------------

/**
 * Return the hub URL stripped of trailing slashes.
 * Kept for backward compatibility; new code should use resolveHubUrl().
 * @returns {string}
 */
function getHubUrl() {
  return (process.env.A2A_HUB_URL || '').replace(/\/+$/, '');
}

function getReuseMode() {
  const m = String(process.env.EVOLVER_REUSE_MODE || DEFAULT_REUSE_MODE).toLowerCase();
  return m === 'direct' ? 'direct' : 'reference';
}

function getMinReuseScore() {
  const n = Number(process.env.EVOLVER_MIN_REUSE_SCORE);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MIN_REUSE_SCORE;
}

/**
 * Score a hub asset for local reuse quality.
 * rank = confidence * max(success_streak, 1) * (reputation / 100)
 */
function scoreHubResult(asset) {
  const confidence = Number(asset.confidence) || 0;
  const streak = Math.max(Number(asset.success_streak) || 0, 1);
  // Reputation is included in asset from hub ranked endpoint; default 50 if missing
  const reputation = Number(asset.reputation_score) || 50;
  return confidence * streak * (reputation / 100);
}

/**
 * Pick the best matching asset above the threshold.
 * Returns { match, score, mode } or null if nothing qualifies.
 */
function pickBestMatch(results, threshold) {
  if (!Array.isArray(results) || results.length === 0) return null;

  let best = null;
  let bestScore = 0;

  for (const asset of results) {
    // Only consider promoted assets
    if (asset.status && asset.status !== 'promoted') continue;
    const s = scoreHubResult(asset);
    if (s > bestScore) {
      bestScore = s;
      best = asset;
    }
  }

  if (!best || bestScore < threshold) return null;

  return {
    match: best,
    score: Math.round(bestScore * 1000) / 1000,
    mode: getReuseMode(),
  };
}

// ---------------------------------------------------------------------------
// Main search function
// ---------------------------------------------------------------------------

/**
 * Search the hub for reusable capsules matching the given signals.
 *
 * Enhancements over the original implementation:
 *  - resolveHubUrl() is used so GRC fallback URL is tried when A2A_HUB_URL
 *    is not set
 *  - Bearer token is injected when available via getAuthToken()
 *  - Results are cached in memory for 5 minutes (keyed on signals + limit)
 *
 * Returns { hit: true, match, score, mode } or { hit: false }.
 *
 * @param {string[]} signals
 * @param {{ threshold?: number, limit?: number, timeoutMs?: number, noCache?: boolean }} opts
 * @returns {Promise<object>}
 */
async function hubSearch(signals, opts) {
  const hubUrl = resolveHubUrl().replace(/\/+$/, '');
  if (!hubUrl) return { hit: false, reason: 'no_hub_url' };

  const signalList = Array.isArray(signals) ? signals.filter(Boolean) : [];
  if (signalList.length === 0) return { hit: false, reason: 'no_signals' };

  const threshold = (opts && Number.isFinite(opts.threshold)) ? opts.threshold : getMinReuseScore();
  const limit = (opts && Number.isFinite(opts.limit)) ? opts.limit : 5;
  const timeout = (opts && Number.isFinite(opts.timeoutMs)) ? opts.timeoutMs : 8000;
  const noCache = !!(opts && opts.noCache);

  // Cache lookup (skip if caller opts out or signals are empty)
  const cacheKey = signalList.join('|') + ':' + limit;
  if (!noCache) {
    const cached = getCachedSearch(cacheKey);
    if (cached) {
      const pick = pickBestMatch(cached, threshold);
      if (!pick) return { hit: false, reason: 'below_threshold', candidates: cached.length, fromCache: true };
      console.log(`[HubSearch] Cache hit: ${pick.match.asset_id || pick.match.local_id} (score=${pick.score}, mode=${pick.mode})`);
      return {
        hit: true,
        match: pick.match,
        score: pick.score,
        mode: pick.mode,
        asset_id: pick.match.asset_id || null,
        source_node_id: pick.match.source_node_id || null,
        chain_id: pick.match.chain_id || null,
        fromCache: true,
      };
    }
  }

  try {
    const params = new URLSearchParams();
    params.set('signals', signalList.join(','));
    params.set('status', 'promoted');
    params.set('limit', String(limit));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    // Build request headers — inject auth token when available
    const headers = { 'Content-Type': 'application/json' };
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }

    const url = `${hubUrl}/a2a/assets/search?${params.toString()}`;
    const res = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return { hit: false, reason: `hub_http_${res.status}` };

    const data = await res.json();
    const assets = Array.isArray(data.assets) ? data.assets : [];

    // Cache the raw asset list regardless of threshold
    if (!noCache) {
      setCachedSearch(cacheKey, assets);
    }

    if (assets.length === 0) return { hit: false, reason: 'no_results' };

    const pick = pickBestMatch(assets, threshold);
    if (!pick) return { hit: false, reason: 'below_threshold', candidates: assets.length };

    console.log(`[HubSearch] Hit: ${pick.match.asset_id || pick.match.local_id} (score=${pick.score}, mode=${pick.mode})`);

    return {
      hit: true,
      match: pick.match,
      score: pick.score,
      mode: pick.mode,
      asset_id: pick.match.asset_id || null,
      source_node_id: pick.match.source_node_id || null,
      chain_id: pick.match.chain_id || null,
    };
  } catch (err) {
    // Hub unreachable is non-fatal; fall through to normal evolve
    console.log(`[HubSearch] Failed (non-fatal): ${err.message}`);
    return { hit: false, reason: 'fetch_error', error: err.message };
  }
}

module.exports = {
  hubSearch,
  scoreHubResult,
  pickBestMatch,
  getReuseMode,
  getMinReuseScore,
  getHubUrl,
  resolveHubUrl,
  getAuthToken,
  getCachedSearch,
  setCachedSearch,
};
