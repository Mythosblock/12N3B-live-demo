import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import netlify from "@netlify/vite-plugin-tanstack-start";

// @ts-expect-error JS plugin alongside the TS vite config
import { grokPwaPlugin } from "./scripts/grok-pwa-plugin.mjs";
// @ts-expect-error JS plugin alongside the TS vite config
import { appEnvPlugin } from "./scripts/app-env-plugin.mjs";
import { isMigrationFile } from "./scripts/migration-plan.mjs";

/** The files src/lib/db.ts globs — same directory, same non-recursive scope. */
function hasGlobbedMigrations(root: string): boolean {
  try {
    return readdirSync(join(root, "migrations")).some(isMigrationFile);
  } catch {
    return false;
  }
}

/**
 * Finish PGLite bootstrap during dev-server setup (before traffic).
 * Vite awaits async configureServer hooks.
 *
 * Production: src/lib/db kicks ensureDbReady on import.
 *
 * Vite awaiting the hook puts this on time-to-first-render, so an app with
 * no migrations — no schema to apply — skips it entirely rather than paying
 * for a PGLite instance it never queries.
 */
function pgliteBootstrapPlugin(): Plugin {
  return {
    name: "app-builder:pglite-bootstrap",
    apply: "serve",

    async configureServer(server) {
      if (!hasGlobbedMigrations(server.config.root)) return;

      try {
        const mod = (await server.ssrLoadModule("/src/lib/db.ts")) as {
          ensureDbReady?: () => Promise<void>;
        };

        if (typeof mod.ensureDbReady === "function") {
          await mod.ensureDbReady();
        }
      } catch (err) {
        console.error("[app-builder] DB bootstrap failed:", err);
        throw err;
      }
    },
  };
}

/**
 * Live-preview OAuth popup.
 *
 * This middleware handles /auth/popup during Vite development/live preview.
 * It runs before TanStack Start so the popup path cannot fall through to
 * the application shell.
 */
function authPopupPlugin(): Plugin {
  return {
    name: "app-builder:auth-popup",
    apply: "serve",

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const rawUrl = req.url ?? "";
          const pathOnly = rawUrl.split("?", 1)[0] ?? "";

          if (pathOnly !== "/auth/popup") {
            next();
            return;
          }

          if ((req.method ?? "GET").toUpperCase() !== "GET") {
            res.statusCode = 405;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end("Method Not Allowed");
            return;
          }

          const host = String(
            req.headers["x-forwarded-host"] ??
              req.headers.host ??
              "localhost:8080",
          );

          const proto = String(
            req.headers["x-forwarded-proto"] ??
              ((req.socket as { encrypted?: boolean } | undefined)?.encrypted
                ? "https"
                : "http"),
          );

          const requestHeaders = new Headers();

          for (const [key, value] of Object.entries(req.headers)) {
            if (value === undefined) continue;

            if (Array.isArray(value)) {
              for (const v of value) {
                requestHeaders.append(key, v);
              }
            } else {
              requestHeaders.set(key, value);
            }
          }

          // Ensure Host is the public preview host so Better Auth's
          // dynamic baseURL / redirect_uri match the popup origin.
          if (!requestHeaders.has("host")) {
            requestHeaders.set("host", host);
          }

          const request = new Request(`${proto}://${host}${rawUrl}`, {
            method: "GET",
            headers: requestHeaders,
          });

          const mod = (await server.ssrLoadModule(
            "/src/lib/auth/popup.server.ts",
          )) as {
            handleAuthPopupRequest: (req: Request) => Promise<Response>;
          };

          const response = await mod.handleAuthPopupRequest(request);

          res.statusCode = response.status;

          // Preserve multiple Set-Cookie headers.
          const setCookies =
            typeof response.headers.getSetCookie === "function"
              ? response.headers.getSetCookie()
              : [];

          response.headers.forEach((value, key) => {
            if (key.toLowerCase() === "set-cookie") return;
            res.setHeader(key, value);
          });

          for (const cookie of setCookies) {
            res.appendHeader("set-cookie", cookie);
          }

          const body = Buffer.from(await response.arrayBuffer());
          res.end(body);
        } catch (err) {
          console.error("[app-builder] /auth/popup handler failed:", err);

          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end("auth popup failed");
          }
        }
      });
    },
  };
}

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
  },

  preview: {
    host: "127.0.0.1",
    port: 8081,
    strictPort: true,
  },

  resolve: {
    tsconfigPaths: true,
  },

  plugins: [
    pgliteBootstrapPlugin(),

    // Before TanStack Start so /auth/popup never falls through to the SPA.
    authPopupPlugin(),

    // Dev-only /__app-env.
    appEnvPlugin(),

    // PWA head + ?install=1 tutorial page.
    grokPwaPlugin(),

    tailwindcss(),

    // TanStack Start SSR.
    tanstackStart(),

    // Official Netlify TanStack Start deployment integration.
    netlify(),

    viteReact(),
  ],
});
