/**
 * E2E test for GRC Skill Marketplace integration.
 * Tests both consumer (list/detail/versions) and publisher (publish/rate) flows.
 *
 * Usage:  node tests/grc-skill-e2e.mjs
 * Requires: GRC server running on grc.myaiportal.net (dev mode with /auth/dev/token)
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";

const GRC_URL = "https://grc.myaiportal.net";
const PASS = "\x1b[32mPASS\x1b[0m";
const FAIL = "\x1b[31mFAIL\x1b[0m";
const SKIP = "\x1b[33mSKIP\x1b[0m";

let passed = 0;
let failed = 0;
let skipped = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ${PASS} ${label}`);
    passed++;
  } else {
    console.log(`  ${FAIL} ${label}`);
    failed++;
  }
}

function skip(label, reason) {
  console.log(`  ${SKIP} ${label} — ${reason}`);
  skipped++;
}

async function fetchJson(urlPath, opts = {}) {
  const url = `${GRC_URL}${urlPath}`;
  const { headers: optHeaders, ...restOpts } = opts;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...optHeaders },
    ...restOpts,
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, body };
}

// ---------------------------------------------------------------------------
// Phase 1: Consumer API tests (no auth required)
// ---------------------------------------------------------------------------

async function testConsumerAPIs() {
  console.log("\n=== Phase 1: Consumer API Tests (no auth) ===\n");

  // 1. Health check
  const health = await fetchJson("/health");
  assert(health.ok && health.body.status === "ok", "GET /health returns ok");

  // 2. List skills (without Meilisearch-dependent search)
  const list = await fetchJson("/api/v1/skills?limit=5");
  assert(list.ok, "GET /api/v1/skills?limit=5 — list returns 200");
  assert(Array.isArray(list.body?.data), "List returns data array");
  assert(list.body?.pagination !== undefined, "List returns pagination");

  // 3. Search skills (may fail if Meilisearch not running — soft check)
  const search = await fetchJson("/api/v1/skills?q=test&limit=10");
  if (search.ok) {
    assert(true, "GET /api/v1/skills?q=test — search returns 200");
    assert(Array.isArray(search.body?.data), "Search returns data array");
  } else {
    skip("GET /api/v1/skills?q=test — search", `Meilisearch unavailable (${search.status})`);
  }

  // 4. Trending skills
  const trending = await fetchJson("/api/v1/skills/trending?limit=5");
  assert(trending.ok, "GET /api/v1/skills/trending returns 200");
  assert(Array.isArray(trending.body?.data), "Trending returns data array");

  // 5. Recommended skills (cold_start)
  const recommended = await fetchJson("/api/v1/skills/recommended?limit=5&strategy=cold_start");
  assert(recommended.ok, "GET /api/v1/skills/recommended returns 200");
  assert(Array.isArray(recommended.body?.data), "Recommended returns data array");

  // 6. Non-existent skill detail — 404
  const noSkill = await fetchJson("/api/v1/skills/nonexistent-skill-xyz");
  assert(noSkill.status === 404, "GET /api/v1/skills/:slug — 404 for missing skill");
}

// ---------------------------------------------------------------------------
// Phase 2: Auth token acquisition (dev token with full scopes)
// ---------------------------------------------------------------------------

async function getAuthToken() {
  console.log("\n=== Phase 2: Auth Token Acquisition ===\n");

  // Try dev token first (development mode only — full scopes)
  const devRes = await fetchJson("/auth/dev/token", {
    method: "POST",
    body: JSON.stringify({
      node_id: "test-e2e-node-001",
      scopes: ["read", "write", "publish"],
    }),
  });

  if (devRes.ok && devRes.body?.token) {
    const scopes = devRes.body.user?.scopes ?? ["read", "write", "publish"];
    console.log(`  ${PASS} Dev token acquired (scopes: ${scopes.join(", ")})`);
    return { token: devRes.body.token, scopes, type: "dev" };
  }

  console.log(`  ${SKIP} Dev token unavailable (${devRes.status}) — trying anonymous`);

  // Fallback to anonymous token (read-only)
  const anonRes = await fetchJson("/auth/anonymous", {
    method: "POST",
    body: JSON.stringify({ node_id: "test-e2e-node-001" }),
  });

  if (anonRes.ok && anonRes.body?.token) {
    console.log(`  ${PASS} Anonymous token acquired (read-only)`);
    return { token: anonRes.body.token, scopes: ["read"], type: "anonymous" };
  }

  console.log(`  ${FAIL} Failed to get any auth token: ${anonRes.status}`);
  return null;
}

// ---------------------------------------------------------------------------
// Phase 3: Publisher API tests (auth required — write + publish scopes)
// ---------------------------------------------------------------------------

function createTestTarball(slug, version) {
  const tmpDir = path.join(process.cwd(), "tests", ".tmp-skill-test");
  const skillDir = path.join(tmpDir, "skill");
  const tarballPath = path.join(tmpDir, `${slug}-${version}.tar.gz`);

  // Clean up
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(skillDir, { recursive: true });

  // Create SKILL.md
  fs.writeFileSync(
    path.join(skillDir, "SKILL.md"),
    `# ${slug}\n\nA test skill for E2E testing.\n\n## Version\n${version}\n`,
  );

  // Create a simple config file
  fs.writeFileSync(
    path.join(skillDir, "config.json"),
    JSON.stringify({ name: slug, version, description: "Test skill" }, null, 2),
  );

  // Create tarball using tar command
  // On Windows, use forward slashes and --force-local to avoid C: being treated as remote host
  const tarballFwd = tarballPath.replace(/\\/g, "/");
  const tmpDirFwd = tmpDir.replace(/\\/g, "/");
  try {
    execSync(`tar -czf "${tarballFwd}" --force-local -C "${tmpDirFwd}" skill`, { stdio: "pipe" });
  } catch {
    // Try without --force-local (some tar versions don't support it)
    try {
      execSync(`tar -czf "${tarballFwd}" -C "${tmpDirFwd}" skill`, { stdio: "pipe" });
    } catch {
      // Last resort: use PowerShell Compress-Archive to create a zip, then rename
      try {
        execSync(
          `powershell.exe -NoProfile -Command "Compress-Archive -Path '${skillDir.replace(/\\/g, "/")}\\*' -DestinationPath '${tarballFwd}.zip' -Force"`,
          { stdio: "pipe" },
        );
        // We need a .tar.gz — try using node:zlib to create one manually
        // For now, skip this fallback
        console.log(`  ${SKIP} tar command failed, falling back to manual tarball creation`);
      } catch (e3) {
        console.log(`  ${FAIL} Failed to create tarball: ${e3.message}`);
        return null;
      }
    }
  }

  const buffer = fs.readFileSync(tarballPath);
  const checksum = createHash("sha256").update(buffer).digest("hex");

  return { tarballPath, buffer, checksum, tmpDir };
}

async function testPublishAPIs(auth) {
  console.log("\n=== Phase 3: Publisher API Tests ===\n");

  if (!auth || !auth.scopes.includes("write")) {
    skip("Publish skill", "No write-scoped auth token available");
    skip("Rate skill", "No auth token with write scope");
    return null;
  }

  const slug = "e2e-test-skill-" + Date.now();
  const version = "1.0.0";

  // Create test tarball
  const tarball = createTestTarball(slug, version);
  if (!tarball) {
    skip("Publish skill", "Failed to create test tarball");
    return null;
  }

  // Publish skill via multipart form upload
  const formData = new FormData();
  formData.set("name", `E2E Test Skill ${Date.now()}`);
  formData.set("slug", slug);
  formData.set("description", "A test skill created by E2E tests");
  formData.set("version", version);
  formData.set("tags", JSON.stringify(["test", "e2e"]));
  formData.set("changelog", "Initial release for E2E testing");

  const blob = new Blob([new Uint8Array(tarball.buffer)], { type: "application/gzip" });
  formData.set("tarball", blob, `${slug}-${version}.tar.gz`);

  const publishRes = await fetch(`${GRC_URL}/api/v1/skills`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.token}`,
    },
    body: formData,
  });

  const publishBody = await publishRes.json().catch(() => null);
  assert(publishRes.ok, `POST /api/v1/skills — publish returns ${publishRes.status}`);

  if (!publishRes.ok) {
    console.log(`    Response: ${JSON.stringify(publishBody)}`);
    fs.rmSync(tarball.tmpDir, { recursive: true, force: true });
    return null;
  }

  assert(publishBody?.skill?.slug === slug, "Published skill slug matches");
  assert(publishBody?.version?.version === version, "Published version matches");
  console.log(`    Published: ${slug}@${version}`);

  // Clean up temp files
  fs.rmSync(tarball.tmpDir, { recursive: true, force: true });

  return { slug, version, publishBody };
}

// ---------------------------------------------------------------------------
// Phase 4: Full lifecycle test (after publish)
// ---------------------------------------------------------------------------

async function testFullLifecycle(slug, version, auth) {
  console.log("\n=== Phase 4: Full Lifecycle Tests ===\n");

  // 1. List skills and look for published skill (no Meilisearch dependency)
  const list = await fetchJson("/api/v1/skills?limit=100");
  assert(list.ok, "List skills for published skill returns 200");
  const found = list.body?.data?.find((s) => s.slug === slug);
  assert(!!found, `Published skill "${slug}" found in listing`);

  // 2. Get skill detail by slug
  const detail = await fetchJson(`/api/v1/skills/${slug}`);
  assert(detail.ok, `GET /api/v1/skills/${slug} returns 200`);
  assert(detail.body?.slug === slug, "Skill detail slug matches");
  assert(detail.body?.latestVersion === version, "Skill detail latestVersion matches");

  // 3. Get versions
  const versions = await fetchJson(`/api/v1/skills/${slug}/versions`);
  assert(versions.ok, `GET /api/v1/skills/${slug}/versions returns 200`);
  assert(Array.isArray(versions.body?.data), "Versions returns data array");
  assert(versions.body.data.length >= 1, "At least one version exists");
  assert(versions.body.data[0]?.version === version, "First version matches");

  // 4. Download tarball
  const dlRes = await fetch(`${GRC_URL}/api/v1/skills/${slug}/download/${version}`, {
    redirect: "follow",
  });
  assert(dlRes.ok, `Download tarball returns ${dlRes.status}`);
  const dlBuffer = Buffer.from(await dlRes.arrayBuffer());
  assert(dlBuffer.length > 0, `Downloaded tarball is ${dlBuffer.length} bytes`);
  const dlChecksum = createHash("sha256").update(dlBuffer).digest("hex");
  console.log(`    Tarball SHA-256: ${dlChecksum}`);

  // 5. Rate skill
  if (auth && auth.scopes.includes("write")) {
    const rateRes = await fetchJson(`/api/v1/skills/${slug}/rate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify({ rating: 5, review: "Great test skill!" }),
    });
    assert(rateRes.ok, `POST /api/v1/skills/${slug}/rate returns ${rateRes.status}`);
    if (rateRes.ok) {
      console.log(`    Rated: ${rateRes.body?.rating ?? rateRes.body?.data?.rating ?? "?"}/5`);
    } else {
      console.log(`    Rate response: ${JSON.stringify(rateRes.body)}`);
    }
  } else {
    skip("Rate skill", "No write-scoped auth token");
  }

  // 6. Publish v2 (version update)
  if (auth && auth.scopes.includes("publish")) {
    const v2 = "2.0.0";
    const tarball = createTestTarball(slug, v2);
    if (tarball) {
      const formData = new FormData();
      formData.set("name", `E2E Test Skill ${Date.now()}`);
      formData.set("slug", slug);
      formData.set("description", "A test skill v2 for E2E tests");
      formData.set("version", v2);
      formData.set("tags", JSON.stringify(["test", "e2e", "v2"]));
      formData.set("changelog", "Version 2.0.0 — major update");
      const blob = new Blob([new Uint8Array(tarball.buffer)], { type: "application/gzip" });
      formData.set("tarball", blob, `${slug}-${v2}.tar.gz`);

      const pubRes = await fetch(`${GRC_URL}/api/v1/skills`, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.token}` },
        body: formData,
      });
      const pubBody = await pubRes.json().catch(() => null);
      assert(pubRes.ok, `Publish v2 (${v2}) returns ${pubRes.status}`);
      if (pubRes.ok) {
        // Verify versions
        const v2Versions = await fetchJson(`/api/v1/skills/${slug}/versions`);
        assert(v2Versions.body?.data?.length >= 2, "Two versions now exist");
        console.log(`    Published v2: ${slug}@${v2}`);
      } else {
        console.log(`    v2 publish failed: ${JSON.stringify(pubBody)}`);
      }
      fs.rmSync(tarball.tmpDir, { recursive: true, force: true });
    }
  }

  // 7. Verify updated detail after v2
  const detailV2 = await fetchJson(`/api/v1/skills/${slug}`);
  if (detailV2.ok && auth?.scopes.includes("publish")) {
    assert(detailV2.body?.latestVersion === "2.0.0", "Skill detail latestVersion is now 2.0.0");
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("GRC Skill Marketplace E2E Tests");
  console.log("================================");
  console.log(`GRC URL: ${GRC_URL}`);
  console.log(`Time: ${new Date().toISOString()}`);

  // Check GRC server is running
  try {
    await fetch(`${GRC_URL}/health`, { signal: AbortSignal.timeout(3000) });
  } catch {
    console.error("\nERROR: GRC server not running on grc.myaiportal.net");
    process.exit(1);
  }

  // Run tests
  await testConsumerAPIs();

  const auth = await getAuthToken();

  const published = await testPublishAPIs(auth);

  if (published) {
    await testFullLifecycle(published.slug, published.version, auth);
  }

  // Summary
  console.log("\n================================");
  console.log(`Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log("================================\n");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
