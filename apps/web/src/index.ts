import { createRequestContext, logHttpRequest } from "@aimhi/observability";
import { consumeDocumentJobs, routeApi, type Env } from "./api";
import { HttpError, json, withSecurity } from "./lib";
import { indexHtml, markSvg } from "./page";

const pagePaths = new Set(["/", "/index.html", "/deal-desk", "/deal-desk/"]);

async function handleFetch(request: Request, env: Env): Promise<Response> {
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
          "cache-control":
            "public, max-age=86400, stale-while-revalidate=604800",
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
  async fetch(request: Request, env: Env): Promise<Response> {
    const context = createRequestContext(request);
    let response: Response;

    try {
      response = await handleFetch(request, env);
    } catch (error) {
      if (error instanceof HttpError) {
        response = json(
          {
            error: error.code,
            requestId: context.requestId,
            ...(error.details ? { details: error.details } : {}),
          },
          error.status,
        );
      } else {
        const err = error as { name?: string };
        console.error(
          JSON.stringify({
            event: "http.unhandled_error",
            requestId: context.requestId,
            error: err?.name || "Error",
          }),
        );
        response = json(
          { error: "internal_error", requestId: context.requestId },
          500,
        );
      }
    }

    response.headers.set("x-request-id", context.requestId);
    logHttpRequest(request, response, context);
    return response;
  },

  async queue(
    batch: {
      messages: Array<{
        id: string;
        body: unknown;
        ack: () => void;
        retry: (opts: { delaySeconds: number }) => void;
      }>;
    },
    env: Env,
  ): Promise<void> {
    await consumeDocumentJobs(batch, env);
  },
};
