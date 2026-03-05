// Decode JWT token to check scopes
async function main() {
  const r = await fetch("http://localhost:3100/auth/anonymous", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ node_id: "test-e2e-node-jwt" }),
  });
  const body = await r.json();
  const token = body.token;

  // Decode JWT payload (base64url)
  const parts = token.split(".");
  const payload = JSON.parse(
    Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(),
  );
  console.log("JWT payload:", JSON.stringify(payload, null, 2));

  // Try using the anonymous token to publish (to see what error we get)
  const pubRes = await fetch("http://localhost:3100/api/v1/skills", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ test: true }),
  });
  console.log("\nPublish attempt with anon token:", pubRes.status);
  const pubBody = await pubRes.text();
  console.log("Publish response:", pubBody.substring(0, 500));

  // Check auth routes
  const routes = ["/auth/register", "/auth/dev/token", "/auth/api-key"];
  for (const route of routes) {
    try {
      const rr = await fetch("http://localhost:3100" + route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      console.log(`${route}: ${rr.status}`);
    } catch (e) {
      console.log(`${route}: ERROR ${e.message}`);
    }
  }
}

main();
