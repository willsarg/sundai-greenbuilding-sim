// POC router. One Durable Object per instance, named by the instance name.
export { Instance } from "./instance.js";

const ADJ = ["curious", "brave", "quiet", "sunny", "clever", "gentle", "rapid", "amber", "cobalt", "jolly", "lucky", "mellow"];
const ANIMAL = ["cat", "otter", "heron", "fox", "lynx", "koala", "finch", "moose", "newt", "panda", "seal", "yak"];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const NAME_RE = /^[a-z]+-[a-z]+$/;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
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
      if (body.password !== env.EVENT_PASSWORD) return json({ error: "unauthorized" }, 401);
      const name = `${pick(ADJ)}-${pick(ANIMAL)}`;
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
      const stub = env.INSTANCE.get(env.INSTANCE.idFromName(name));
      return stub.fetch(req);
    }

    // Everything else is the static site. "/{name}" serves the viewer.
    if (NAME_RE.test(url.pathname.slice(1))) {
      return env.ASSETS.fetch(new Request(`${url.origin}/view.html`, req));
    }
    return env.ASSETS.fetch(req);
  },
};
