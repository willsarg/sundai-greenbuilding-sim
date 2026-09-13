// POC router. One Durable Object per instance, named by the instance name.
export { Instance } from "./instance.js";

const ADJ = ["curious", "brave", "quiet", "sunny", "clever", "gentle", "rapid", "amber", "cobalt", "jolly", "lucky", "mellow",
  "bold", "calm", "crisp", "dusty", "eager", "fuzzy", "giant", "happy", "icy", "keen", "lively", "misty",
  "noble", "olive", "plucky", "rosy", "silly", "tidy", "vivid", "witty", "zesty", "coral", "hazel", "ivory"];
const ANIMAL = ["cat", "otter", "heron", "fox", "lynx", "koala", "finch", "moose", "newt", "panda", "seal", "yak",
  "bear", "crane", "dove", "eagle", "gecko", "hare", "ibis", "jay", "kiwi", "lemur", "mole", "owl",
  "puma", "quail", "raven", "swan", "toad", "viper", "wren", "zebra", "bison", "camel", "dingo", "egret"];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const NAME_RE = /^[a-z]+-[a-z]+$/;
// A name is only valid if both halves come from the pool above; anything else (e.g. the docs'
// placeholder "your-instance") is a 400 rather than a silently-created instance.
const validName = (n) => { const [a, b] = n.split("-"); return NAME_RE.test(n) && ADJ.includes(a) && ANIMAL.includes(b); };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...CORS } });

// Docs gate. POST /docs with the event password serves the docs page and sets a 12 h cookie
// holding a hash of the password, so GET /docs (refresh, deep link) keeps working for the day.
const DOCS_COOKIE = "gbsim_docs";
const DOCS_TTL = 12 * 3600;
async function docsToken(password) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`docs:${password}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function cookieValue(req, name) {
  const m = (req.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? m[1] : null;
}
// Paths that people and coding agents guess when looking for an API description or the client.
const PROBE = /^\/(openapi\.json|api-docs|swagger(\.json)?|schema|create|pip\/.*|gbsim(\.py)?|requirements\.txt|README(\.md)?|assets\/gbsim\.py|\.well-known\/.*)$/i;
const redirect = (url, to) => Response.redirect(`${url.origin}${to}`, 303);

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

    if (url.pathname === "/api/instances" && req.method === "POST") {
      let body = {};
      try { body = await req.json(); } catch {}
      if (!env.EVENT_PASSWORD) return json({ error: "server has no EVENT_PASSWORD configured" }, 503);
      if (typeof body.password !== "string" || body.password !== env.EVENT_PASSWORD) return json({ error: "unauthorized" }, 401);
      // Claim an unused name (36x36 pool). The DO makes the claim atomic; retry on collision.
      let name = null;
      for (let i = 0; i < 8 && !name; i++) {
        const cand = `${pick(ADJ)}-${pick(ANIMAL)}`;
        const stub = env.INSTANCE.get(env.INSTANCE.idFromName(cand));
        const r = await stub.fetch(new Request(`${url.origin}/api/i/${cand}/claim`, { method: "POST" }));
        if (r.status === 201) name = cand;
      }
      if (!name) return json({ error: "no free instance names, try again" }, 503);
      const base = `${url.protocol}//${url.host}`;
      const ws = url.protocol === "https:" ? "wss:" : "ws:";
      return json({
        name,
        send_url: `${base}/api/i/${name}/frame`,
        view_url: `${base}/${name}`,
        ws_url: `${ws}//${url.host}/api/i/${name}/view`,
      }, 201);
    }

    const m = url.pathname.match(/^\/api\/i\/([^/]+)(\/.*)?$/);
    if (m) {
      const name = m[1];
      if (!validName(name)) return json({ error: "bad instance name" }, 400);
      const sub = m[2] || "/";
      if (sub === "/claim" || sub === "/reset") return json({ error: "not found" }, 404);   // internal routes
      const stub = env.INSTANCE.get(env.INSTANCE.idFromName(name));
      // Admin: DELETE /api/i/{name} with the admin password (separate from the event password)
      // wipes the instance (frame, clip, reservation) and returns its name to the pool.
      // Viewers get a black frame and no clip.
      if (sub === "/" && req.method === "DELETE") {
        const auth = req.headers.get("authorization") || "";
        if (!env.ADMIN_PASSWORD) return json({ error: "server has no ADMIN_PASSWORD configured" }, 503);
        if (auth !== `Bearer ${env.ADMIN_PASSWORD}`) return json({ error: "unauthorized" }, 401);
        return stub.fetch(new Request(`${url.origin}/api/i/${name}/reset`, { method: "POST" }));
      }
      return stub.fetch(req);
    }

    if (url.pathname === "/docs/") return redirect(url, "/docs");
    if (url.pathname === "/docs") {
      if (!env.EVENT_PASSWORD) return json({ error: "server has no EVENT_PASSWORD configured" }, 503);
      const token = await docsToken(env.EVENT_PASSWORD);
      const serve = () => env.ASSETS.fetch(new Request(`${url.origin}/docs.html`, { method: "GET" }));
      if (req.method === "POST") {
        let pw = null;
        try { pw = (await req.formData()).get("password"); } catch {}
        if (typeof pw !== "string" || pw !== env.EVENT_PASSWORD) return redirect(url, "/?docs=denied");
        const res = new Response((await serve()).body, { headers: { "Content-Type": "text/html; charset=utf-8" } });
        res.headers.set("Set-Cookie", `${DOCS_COOKIE}=${token}; Path=/docs; Max-Age=${DOCS_TTL}; HttpOnly; Secure; SameSite=Strict`);
        return res;
      }
      if (req.method === "GET" && cookieValue(req, DOCS_COOKIE) === token) return serve();
      return redirect(url, "/");
    }
    if (url.pathname === "/docs.html") return json({ error: "not found" }, 404);   // only via the gate above

    // Everything else is the static site. "/" is the landing page, "/{name}" serves the viewer.
    if (url.pathname === "/") {
      return env.ASSETS.fetch(new Request(`${url.origin}/index.html`, req));
    }
    if (validName(url.pathname.slice(1))) {
      return env.ASSETS.fetch(new Request(`${url.origin}/view.html`, req));
    }
    // "/demo/{slug}" is the viewer playing a baked clip from /demos/{slug}.bin: no instance,
    // no password, no socket. Slugs are checked against the baked manifest.
    if (url.pathname === "/demo" || url.pathname === "/demo/") return redirect(url, "/#demos");
    const demo = url.pathname.match(/^\/demo\/([a-z0-9-]+)$/);
    if (demo) {
      const m = await env.ASSETS.fetch(new Request(`${url.origin}/demos/demos.json`, { method: "GET" }));
      const list = m.ok ? await m.json() : [];
      if (!list.some((d) => d.slug === demo[1])) return json({ error: "no such demo" }, 404);
      return env.ASSETS.fetch(new Request(`${url.origin}/view.html`, req));
    }
    // Unknown API paths and the usual doc-discovery guesses get a JSON 404 that points at the docs,
    // so a person or an agent probing the API learns where the reference is.
    // "/i/{name}" is a common misreading of the viewer URL; send it to the viewer.
    const iName = url.pathname.match(/^\/i\/([^/]+)\/?$/);
    if (iName && validName(iName[1])) return redirect(url, `/${iName[1]}`);
    if (url.pathname.startsWith("/api") || PROBE.test(url.pathname)) {
      return json({
        error: "not found",
        hint: "The API reference is the docs page: open https://sundai.willsarg.com, enter the event password and press Open docs (POST /docs). The README at https://github.com/willsarg/sundai-greenbuilding-sim has the same table.",
        endpoints: ["POST /api/instances", "POST|GET /api/i/{name}/frame", "POST|DELETE /api/i/{name}/clip", "GET /api/i/{name}/", "WS /api/i/{name}/view"],
        client: "Python client: git clone https://github.com/willsarg/sundai-greenbuilding-sim && cd poc/python (package gbsim; not on PyPI, not served from this host)",
      }, 404);
    }
    return env.ASSETS.fetch(req);
  },
};
