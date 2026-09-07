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

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...CORS } });

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
      if (!NAME_RE.test(name)) return json({ error: "bad instance name" }, 400);
      if (m[2] === "/claim") return json({ error: "not found" }, 404);   // internal: only the allocator above may claim
      const stub = env.INSTANCE.get(env.INSTANCE.idFromName(name));
      return stub.fetch(req);
    }

    // Everything else is the static site. "/" is the landing page, "/{name}" serves the viewer.
    if (url.pathname === "/") {
      return env.ASSETS.fetch(new Request(`${url.origin}/index.html`, req));
    }
    if (NAME_RE.test(url.pathname.slice(1))) {
      return env.ASSETS.fetch(new Request(`${url.origin}/view.html`, req));
    }
    return env.ASSETS.fetch(req);
  },
};
