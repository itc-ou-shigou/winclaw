// Test the dev token endpoint
async function main() {
  try {
    const r = await fetch("http://localhost:3100/auth/dev/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        node_id: "test-e2e-dev-001",
        scopes: ["read", "write", "publish"],
      }),
    });
    console.log("Status:", r.status);
    const body = await r.json();
    console.log("Body:", JSON.stringify(body, null, 2));

    if (body.token) {
      // Decode JWT payload
      const parts = body.token.split(".");
      const payload = JSON.parse(
        Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(),
      );
      console.log("\nJWT payload:", JSON.stringify(payload, null, 2));

      // Test publish auth with the dev token
      const pubRes = await fetch("http://localhost:3100/api/v1/skills", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + body.token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ test: true }),
      });
      console.log("\nPublish test status:", pubRes.status);
      const pubBody = await pubRes.text();
      console.log("Publish test body:", pubBody.substring(0, 300));
    }
  } catch (e) {
    console.error("Error:", e.message);
  }
}
main();
