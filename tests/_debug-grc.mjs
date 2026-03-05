// Quick debug script for GRC endpoints
async function main() {
  // 1. Health check
  try {
    const r1 = await fetch("http://localhost:3100/health");
    const b1 = await r1.json();
    console.log("health:", r1.status, JSON.stringify(b1));
  } catch (e) {
    console.log("health ERROR:", e.message);
  }

  // 2. Search with q param
  try {
    const r2 = await fetch("http://localhost:3100/api/v1/skills?q=test&limit=10");
    console.log("search status:", r2.status);
    const b2 = await r2.text();
    console.log("search body:", b2.substring(0, 600));
  } catch (e) {
    console.log("search ERROR:", e.message);
  }

  // 3. List without q param
  try {
    const r3 = await fetch("http://localhost:3100/api/v1/skills?limit=5");
    console.log("list status:", r3.status);
    const b3 = await r3.text();
    console.log("list body:", b3.substring(0, 600));
  } catch (e) {
    console.log("list ERROR:", e.message);
  }

  // 4. Email login
  try {
    const r4 = await fetch("http://localhost:3100/auth/email/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@winclawhub.ai", password: "Admin123!" }),
    });
    console.log("login status:", r4.status);
    const b4 = await r4.text();
    console.log("login body:", b4.substring(0, 600));
  } catch (e) {
    console.log("login ERROR:", e.message);
  }

  // 5. Try register
  try {
    const r5 = await fetch("http://localhost:3100/auth/email/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test-e2e@winclawhub.ai",
        password: "TestE2E123!",
        name: "E2E Test User",
      }),
    });
    console.log("register status:", r5.status);
    const b5 = await r5.text();
    console.log("register body:", b5.substring(0, 600));
  } catch (e) {
    console.log("register ERROR:", e.message);
  }

  // 6. Anonymous token
  try {
    const r6 = await fetch("http://localhost:3100/auth/anonymous", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ node_id: "test-e2e-node-debug" }),
    });
    console.log("anon status:", r6.status);
    const b6 = await r6.json();
    console.log("anon scopes:", b6.scopes);
    console.log("anon token prefix:", b6.token ? b6.token.substring(0, 40) + "..." : "none");
  } catch (e) {
    console.log("anon ERROR:", e.message);
  }
}

main();
