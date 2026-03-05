// Create the grc-assets bucket in MinIO using HTTP API
// MinIO supports S3-compatible API

import { createHmac, createHash } from "node:crypto";

const MINIO_URL = "http://localhost:9000";
const ACCESS_KEY = "minioadmin";
const SECRET_KEY = "minioadmin";
const BUCKET = "grc-assets";

// Simple S3 signature v4 is complex, but MinIO also supports simpler approaches
// Let's just try the basic PUT request (some MinIO configs allow it)

async function main() {
  // First check if bucket exists with a HEAD request
  try {
    const headRes = await fetch(`${MINIO_URL}/${BUCKET}`, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
    });
    if (headRes.status === 200) {
      console.log("Bucket already exists:", BUCKET);
      return;
    }
    console.log("Bucket HEAD status:", headRes.status);
  } catch (e) {
    console.log("HEAD check:", e.message);
  }

  // Use mc (MinIO Client) if available via Docker
  try {
    const { execSync } = await import("node:child_process");
    // Run mc inside the MinIO container or use docker exec
    execSync(
      `docker exec grc-minio mc alias set local http://localhost:9000 minioadmin minioadmin 2>&1`,
      { encoding: "utf-8", timeout: 10000 },
    );
    const out = execSync(
      `docker exec grc-minio mc mb local/${BUCKET} --ignore-existing 2>&1`,
      { encoding: "utf-8", timeout: 10000 },
    );
    console.log("mc mb:", out.trim());
  } catch (e) {
    console.log("mc approach failed:", e.message);
    // Last resort: try docker CLI to create bucket
    try {
      const { execSync } = await import("node:child_process");
      execSync(
        `docker exec grc-minio mkdir -p /data/${BUCKET} 2>&1`,
        { encoding: "utf-8", timeout: 5000 },
      );
      console.log("Created bucket directory manually");
    } catch (e2) {
      console.log("Manual mkdir:", e2.message);
    }
  }
}

main().catch((e) => console.error("Error:", e));
