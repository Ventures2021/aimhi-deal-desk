import indexHtml from "../index.html";
import markSvg from "../aimhi-manifest-portal.svg";
import ogPng from "../aimhi-og.png";
import { consumeDocumentJobs, routeApi } from "./api.js";
import { HttpError, json, requestId, withSecurity } from "./lib.js";

const pagePaths = new Set(["/", "/index.html", "/deal-desk", "/deal-desk/"]);

function logRequest(request, response, startedAt, reqId) {
  const url = new URL(request.url);
  console.log(
    JSON.stringify({
      event: "http.request",
      requestId: reqId,
      method: request.method,
      path: url.pathname,
      status: response.status,
      durationMs: Date.now() - startedAt,
      colo: request.cf?.colo || null,
    }),
  );
}

async function handleFetch(request, env) {
  const { pathname } = new URL(request.url);

  if (pathname === "/health" || pathname === "/deal-desk/health") {
    return json({
      service: "aimhi-deal-desk",
      status: "ok",
      dependencies: {
        database: Boolean(env.DB),
        documentStorage: Boolean(env.DOCUMENTS),
        queue: Boolean(env.PROCESSING_QUEUE),
      },
    });
  }

  if (pathname.startsWith("/api/")) {
    return routeApi(request, env, pathname);
  }

  if (
    pathname.endsWith("/aimhi-manifest-portal.svg") ||
    pathname.endsWith("/aimhi-manifest-portal-icon.svg")
  ) {
    return withSecurity(
      new Response(markSvg, {
        headers: {
          "content-type": "image/svg+xml; charset=utf-8",
          "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      }),
    );
  }

  if (pathname.endsWith("/aimhi-og.png")) {
    return withSecurity(
      new Response(ogPng, {
        headers: {
          "content-type": "image/png",
          "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      }),
    );
  }

  if (!pagePaths.has(pathname)) {
    return withSecurity(new Response("Not found", { status: 404 }), {
      "cache-control": "no-store",
    });
  }

  return withSecurity(
    new Response(indexHtml, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    }),
  );
}

export default {
  async fetch(request, env) {
    const startedAt = Date.now();
    const reqId = requestId(request);
    let response;
    try {
      response = await handleFetch(request, env);
    } catch (error) {
      if (error instanceof HttpError) {
        response = json(
          {
            error: error.code,
            requestId: reqId,
            ...(error.details ? { details: error.details } : {}),
          },
          error.status,
        );
      } else {
        console.error(
          JSON.stringify({
            event: "http.unhandled_error",
            requestId: reqId,
            error: error?.name || "Error",
          }),
        );
        response = json({ error: "internal_error", requestId: reqId }, 500);
      }
    }
    response.headers.set("x-request-id", reqId);
    logRequest(request, response, startedAt, reqId);
    return response;
  },

  async queue(batch, env) {
    await consumeDocumentJobs(batch, env);
  },
};
