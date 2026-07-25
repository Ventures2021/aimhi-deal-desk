import indexHtml from "../index.html";
import markSvg from "../aimhi-manifest-portal.svg";

export default {
  async fetch(request) {
    const { pathname } = new URL(request.url);
    if (pathname === "/health") {
      return Response.json({ service: "aimhi-deal-desk", status: "ok" });
    }
    if (pathname === "/aimhi-manifest-portal.svg" || pathname === "/aimhi-manifest-portal-icon.svg") {
      return new Response(markSvg, { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=86400" } });
    }
    if (pathname !== "/" && pathname !== "/index.html") {
      return new Response("Not found", { status: 404 });
    }
    return new Response(indexHtml, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
  },
};
