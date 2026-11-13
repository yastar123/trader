import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it.each(["/login", "/register"])("matches the account page at %s", (path) => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes(path);

    expect(matches.at(-1)?.fullPath).toBe(path);
  });

  it.each([
    "/beranda",
    "/trade",
    "/chart",
    "/posisi",
    "/riwayat",
    "/deposit",
    "/withdraw",
    "/kotak-surat",
    "/jurnal",
    "/pengaturan",
    "/kalender-akademi",
    "/komunitas",
    "/panduan-pengguna",
    "/tentang",
  ])("matches the authenticated workspace page at %s", (path) => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes(path);

    expect(matches.at(-1)?.fullPath).toBe(path);
  });

  it.each([
    ["/admin/login", "/admin/login"],
    ["/admin", "/admin/"],
    ["/admin/markets", "/admin/markets"],
    ["/admin/positions", "/admin/positions"],
    ["/admin/deposit", "/admin/deposit"],
    ["/admin/withdraw", "/admin/withdraw"],
    ["/admin/users", "/admin/users"],
    ["/admin/audit", "/admin/audit"],
  ])("matches the admin portal page at %s", (path, expectedFullPath) => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes(path);

    expect(matches.at(-1)?.fullPath).toBe(expectedFullPath);
  });
});
