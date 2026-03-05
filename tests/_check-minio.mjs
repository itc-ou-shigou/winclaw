// Check MinIO availability
async function main() {
  try {
    const r = await fetch("http://localhost:9000/minio/health/live", {
      signal: AbortSignal.timeout(3000),
    });
    console.log("MinIO health:", r.status);
  } catch (e) {
    console.log("MinIO NOT running:", e.message);
  }

  // Also check Docker
  try {
    const { execSync } = await import("node:child_process");
    const out = execSync("docker ps --format '{{.Names}} {{.Status}}' 2>&1", {
      encoding: "utf-8",
      timeout: 5000,
    });
    console.log("Docker containers:", out || "(none)");
  } catch (e) {
    console.log("Docker check:", e.message);
  }
}
main();
