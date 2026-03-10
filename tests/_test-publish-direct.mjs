// Direct publish test to debug 500 error
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const GRC_URL = "https://grc.myaiportal.net";

async function main() {
  // Get dev token
  const tokenRes = await fetch(`${GRC_URL}/auth/dev/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      node_id: "test-direct-pub",
      scopes: ["read", "write", "publish"],
    }),
  });
  const tokenBody = await tokenRes.json();
  console.log("Token:", tokenRes.status);
  const token = tokenBody.token;

  // Create tarball
  const tmpDir = path.join(process.cwd(), "tests", ".tmp-pub-test");
  const skillDir = path.join(tmpDir, "skill");
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# Test\nTest skill.\n");
  fs.writeFileSync(
    path.join(skillDir, "config.json"),
    JSON.stringify({ name: "test", version: "1.0.0" }),
  );

  const tarballPath = path.join(tmpDir, "test.tar.gz").replace(/\\/g, "/");
  const tmpDirFwd = tmpDir.replace(/\\/g, "/");
  execSync(`tar -czf "${tarballPath}" --force-local -C "${tmpDirFwd}" skill`, { stdio: "pipe" });
  const buffer = fs.readFileSync(tarballPath);
  console.log("Tarball size:", buffer.length);

  // Publish
  const slug = "test-direct-" + Date.now();
  const formData = new FormData();
  formData.set("name", "Test Direct " + Date.now());
  formData.set("slug", slug);
  formData.set("description", "Direct test skill");
  formData.set("version", "1.0.0");
  formData.set("tags", JSON.stringify(["test"]));
  formData.set("changelog", "Initial");

  const blob = new Blob([new Uint8Array(buffer)], { type: "application/gzip" });
  formData.set("tarball", blob, `${slug}-1.0.0.tar.gz`);

  console.log("Publishing...");
  const pubRes = await fetch(`${GRC_URL}/api/v1/skills`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  console.log("Status:", pubRes.status);
  const pubBody = await pubRes.text();
  console.log("Body:", pubBody.substring(0, 800));

  // Clean up
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

main().catch((e) => console.error("Error:", e));
