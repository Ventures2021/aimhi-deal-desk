import indexHtml from "../index.html";
import markSvg from "../aimhi-manifest-portal.svg";

const pagePaths = new Set(["/", "/index.html", "/deal-desk", "/deal-desk/"]);

export default {
  async fetch(request) {
    const { pathname } = new URL(request.url);

    if (pathname === "/health" || pathname === "/deal-desk/health") {
      return Response.json({ service: "aimhi-deal-desk", status: "ok" });
    }

    if (
      pathname.endsWith("/aimhi-manifest-portal.svg") ||
      pathname.endsWith("/aimhi-manifest-portal-icon.svg")
    ) {
      return new Response(markSvg, {
        headers: {
          "content-type": "image/svg+xml; charset=utf-8",
          "cache-control": "public, max-age=86400",
        },
      });
    }

    if (!pagePaths.has(pathname)) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(indexHtml, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  },
};
