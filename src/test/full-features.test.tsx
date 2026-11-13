import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminDepositView } from "@/components/admin/admin-deposit-view";
import { AdminLoginView } from "@/components/admin/admin-login-view";
import { AdminMailView } from "@/components/admin/admin-mail-view";
import { AdminPositionsView } from "@/components/admin/admin-positions-view";
import { AccountPage } from "@/components/auth/account-page";
import { DepositView } from "@/components/workspace/deposit-view";
import { ChartView } from "@/components/workspace/chart-view";
import { JurnalView } from "@/components/workspace/jurnal-view";
import { KalenderAkademiView } from "@/components/workspace/kalender-akademi-view";
import { KomunitasView } from "@/components/workspace/komunitas-view";
import { KotakSuratView } from "@/components/workspace/kotak-surat-view";
import { PanduanPenggunaView } from "@/components/workspace/panduan-pengguna-view";
import { PengaturanView } from "@/components/workspace/pengaturan-view";
import { TentangView } from "@/components/workspace/tentang-view";
import { TradeView } from "@/components/workspace/trade-view";
import { WithdrawView } from "@/components/workspace/withdraw-view";
import { USD_TO_IDR_RATE } from "@/lib/currency";
import { DEFAULT_SESSION, readDemoSession, syncLoginWithExpress } from "@/lib/fe-session";
import { db } from "@/server/db";
import { generateSeedCandles, memoryStore } from "@/server/store";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to?: string }) => (
    <a href={to ?? "#"} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => unknown }) =>
    select({ location: { pathname: "/admin" } }),
}));

const snapshotUsers = memoryStore.users.map((u) => ({ ...u }));
const snapshotDeposits = [...memoryStore.deposits];
const snapshotWithdrawals = [...memoryStore.withdrawals];
const snapshotPositions = [...memoryStore.positions];
const snapshotMethods = [...memoryStore.depositMethods];
const snapshotLimits = { ...memoryStore.walletLimits };
const snapshotMarkets = [...memoryStore.markets];
const snapshotJournal = [...memoryStore.journal];
const snapshotMessages = [...memoryStore.messages];
const snapshotPosts = [...memoryStore.communityPosts];
const snapshotAudit = [...memoryStore.auditLogs];
const snapshotProfile = { ...memoryStore.profile };

beforeEach(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/session")) {
        return new Response(JSON.stringify(memoryStore.profile), { status: 200 });
      }
      if (url.includes("/api/wallet/transactions")) {
        return new Response(
          JSON.stringify({
            balance: 24510,
            deposits: memoryStore.deposits,
            withdrawals: memoryStore.withdrawals,
            limits: memoryStore.walletLimits,
            depositMethods: memoryStore.depositMethods.filter((m) => m.enabled),
            idrPerUsd: USD_TO_IDR_RATE,
          }),
          { status: 200 },
        );
      }
      if (url.includes("/api/markets")) {
        return new Response(JSON.stringify(memoryStore.markets.filter((m) => m.enabled)), {
          status: 200,
        });
      }
      if (url.includes("/api/positions")) {
        return new Response(JSON.stringify(memoryStore.positions), { status: 200 });
      }
      if (url.includes("/api/trading-rules")) {
        return new Response(
          JSON.stringify({
            rules: {
              maxDailyPositions: memoryStore.tradingRules.maxDailyPositions,
              minCloseMinutes: memoryStore.tradingRules.minCloseMinutes,
            },
            todayOpenCount: 0,
            todayDate: "2026-11-12",
          }),
          { status: 200 },
        );
      }
      if (url.includes("/api/journal")) {
        return new Response(JSON.stringify(memoryStore.journal), { status: 200 });
      }
      if (url.includes("/api/messages")) {
        const userId = await db.getCurrentTraderId();
        return new Response(JSON.stringify(userId ? await db.getMessagesForUser(userId) : []), {
          status: 200,
        });
      }
      if (url.includes("/api/admin/messages")) {
        if (init?.method === "POST") {
          const body = JSON.parse(String(init.body ?? "{}")) as {
            recipientUserId: string | null;
            subject: string;
            body: string;
            category: "Peringatan Pasar" | "Sistem & Akun" | "Dukungan";
          };
          const result = await db.sendAdminMessage({
            ...body,
            recipientUserId: body.recipientUserId === "all" ? null : body.recipientUserId,
            adminEmail: "admin@wmtrader.id",
          });
          return new Response(JSON.stringify(result.messages ?? []), {
            status: result.error ? 404 : 201,
          });
        }
        return new Response(JSON.stringify(await db.getAdminMessages()), { status: 200 });
      }
      if (url.includes("/api/admin/users")) {
        return new Response(JSON.stringify(await db.getAdminUsers()), { status: 200 });
      }
      if (url.includes("/api/admin/session")) {
        return new Response(JSON.stringify({ authenticated: true, email: "admin@ictrading.id" }), {
          status: 200,
        });
      }
      if (url.includes("/api/admin/trading-rules")) {
        return new Response(JSON.stringify(memoryStore.tradingRules), { status: 200 });
      }
      if (url.includes("/api/admin/positions")) {
        const enriched = await db.getAdminPositions();
        return new Response(JSON.stringify(enriched), { status: 200 });
      }
      if (url.includes("/api/admin/deposits")) {
        return new Response(JSON.stringify(memoryStore.deposits), { status: 200 });
      }
      if (url.includes("/api/admin/wallet-limits")) {
        return new Response(JSON.stringify(memoryStore.walletLimits), { status: 200 });
      }
      if (url.includes("/api/admin/deposit-methods")) {
        return new Response(JSON.stringify(memoryStore.depositMethods), { status: 200 });
      }
      if (url.includes("/api/community")) {
        return new Response(JSON.stringify(memoryStore.communityPosts), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  memoryStore.users = snapshotUsers.map((u) => ({ ...u }));
  memoryStore.deposits = [...snapshotDeposits];
  memoryStore.withdrawals = [...snapshotWithdrawals];
  memoryStore.positions = [...snapshotPositions];
  memoryStore.depositMethods = [...snapshotMethods];
  memoryStore.walletLimits = { ...snapshotLimits };
  memoryStore.markets = [...snapshotMarkets];
  memoryStore.journal = [...snapshotJournal];
  memoryStore.messages = [...snapshotMessages];
  memoryStore.communityPosts = [...snapshotPosts];
  memoryStore.auditLogs = [...snapshotAudit];
  memoryStore.profile = { ...snapshotProfile };
});

function renderWithQuery(ui: ReactNode) {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("Full Feature Suite — Trader & Admin Core Services", () => {
  it("does not restore a demo trader or pretend a failed registration succeeded", async () => {
    expect(DEFAULT_SESSION.loggedIn).toBe(false);
    expect(DEFAULT_SESSION.accountId).toBe("");

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify({ error: "Server unavailable" }), { status: 503 }),
      ),
    );
    await expect(
      syncLoginWithExpress({
        email: "new.trader@example.com",
        name: "Trader Baru",
        isRegister: true,
      }),
    ).rejects.toThrow("Server unavailable");
    expect(readDemoSession().loggedIn).toBe(false);
    expect(readDemoSession().accountId).toBe("");
  });

  it("handles trader session login, profile updates, and logout cleanly", async () => {
    const logged = await db.loginOrRegisterTrader({
      email: "trader.uji@ictrading.id",
      name: "Trader Uji",
      isRegister: true,
    });
    expect(logged.loggedIn).toBe(true);
    expect(logged.email).toBe("trader.uji@ictrading.id");
    expect(logged.name).toBe("Trader Uji");
    expect(logged.balance).toBe(0);
    expect(memoryStore.users.find((user) => user.accountId === logged.accountId)?.balance).toBe(0);

    const updated = await db.updateProfile({
      currency: "IDR",
      accountType: "Standard",
      leverage: 200,
    });
    expect(updated.currency).toBe("IDR");
    expect(updated.accountType).toBe("Standard");
    expect(updated.leverage).toBe(200);

    await db.logoutTrader();
    const afterLogout = await db.getSession();
    expect(afterLogout.loggedIn).toBe(false);

    const existing = await db.loginOrRegisterTrader({
      email: snapshotUsers[0]!.email,
      isRegister: true,
    });
    expect(existing.balance).toBe(snapshotUsers[0]!.balance);

    memoryStore.profile.accountId = "missing-account";
    expect((await db.getSession()).balance).toBe(0);
  });

  it("supports admin deposit method CRUD, wallet limits, and IDR->USD deposit approval", async () => {
    // 1. Update wallet limits
    const limRes = await db.updateWalletLimits(
      { minDeposit: 20, maxDeposit: 10000, minWithdraw: 15, maxWithdraw: 5000 },
      "admin@ictrading.id",
    );
    expect(limRes.error).toBeUndefined();
    expect(limRes.limits?.minDeposit).toBe(20);
    expect(limRes.limits?.maxWithdraw).toBe(5000);

    // 2. CRUD deposit methods
    const createdMethod = await db.createDepositMethod(
      {
        label: "QRIS Instan",
        accountInfo: "IC-QRIS-9901",
        accountHolder: "wmTrader",
        fee: "Gratis (0%)",
        eta: "Instan setelah verifikasi",
        enabled: true,
      },
      "admin@ictrading.id",
    );
    expect(createdMethod.error).toBeUndefined();
    const methodId = createdMethod.method!.id;

    const updatedMethod = await db.updateDepositMethod(
      methodId,
      { accountInfo: "IC-QRIS-7777", enabled: false },
      "admin@ictrading.id",
    );
    expect(updatedMethod.method?.accountInfo).toBe("IC-QRIS-7777");
    expect(updatedMethod.method?.enabled).toBe(false);

    // Disabled methods stay hidden from trader getDepositMethods(false)
    const traderVisibleMethods = await db.getDepositMethods(false);
    expect(traderVisibleMethods.some((m) => m.id === methodId)).toBe(false);

    const deleted = await db.deleteDepositMethod(methodId, "admin@ictrading.id");
    expect(deleted.ok).toBe(true);

    // 3. Trader creates IDR deposit with proof image -> Admin approves -> Balance increases
    const startBalance = (await db.getWalletTransactions()).balance;
    const depositIdr = 3_400_000;
    const expectedUsd = Number((depositIdr / USD_TO_IDR_RATE).toFixed(2));
    const dep = await db.createDeposit({
      amount: expectedUsd,
      amountIdr: depositIdr,
      exchangeRate: USD_TO_IDR_RATE,
      method: "Transfer Bank BNI",
      reference: "BNI-TEST-01",
      proofImage: "data:image/png;base64,iVBORw0KGgo=",
      proofFileName: "bukti.png",
    });
    expect(dep.status).toBe("Menunggu");
    expect(dep.amount).toBe(200);
    expect(dep.amountIdr).toBe(3_400_000);

    const reviewed = await db.reviewDeposit({
      id: dep.id,
      decision: "approve",
      note: "Mutasi terverifikasi",
      adminEmail: "admin@ictrading.id",
    });
    expect(reviewed.deposit?.status).toBe("Disetujui");

    const afterApproveBalance = (await db.getWalletTransactions()).balance;
    expect(afterApproveBalance).toBe(Number((startBalance + 200).toFixed(2)));
  });

  it("validates withdraw balance and updates balance upon admin approval", async () => {
    const startBalance = (await db.getWalletTransactions()).balance;
    const tooHigh = await db.createWithdraw({
      amount: startBalance + 5000,
      destination: "Bank BCA · 123456",
    });
    expect(tooHigh.error).toContain("tidak mencukupi");

    const wd = await db.createWithdraw({
      amount: 150,
      destination: "Bank BCA · 5210948120",
    });
    expect(wd.error).toBeUndefined();
    expect(wd.withdrawal?.status).toBe("Menunggu");

    const approved = await db.reviewWithdraw({
      id: wd.withdrawal!.id,
      decision: "approve",
      adminEmail: "admin@ictrading.id",
    });
    expect(approved.withdrawal?.status).toBe("Disetujui");

    const endBalance = (await db.getWalletTransactions()).balance;
    expect(endBalance).toBe(Number((startBalance - 150).toFixed(2)));
  });

  it("supports admin market CRUD, journal CRUD, inbox CRUD, community interactions, and user updates", async () => {
    // Market CRUD
    const newMarket = await db.createMarket(
      {
        symbol: "DOGEUSD",
        name: "Dogecoin / Dolar AS",
        category: "Kripto / Coin",
        basePrice: 0.38,
        bid: 0.38,
        ask: 0.382,
        prevBid: 0.38,
        openDay: 0.36,
        spreadValue: 0.002,
        spreadLabel: "2.0",
        pipSize: 0.001,
        tickStep: 0.002,
        decimals: 4,
        contractSize: 1000,
        trendBias: "Naik",
        trendStrength: 2,
        enabled: true,
        candles: generateSeedCandles(0.38, 0.002, 4),
      },
      "admin@ictrading.id",
    );
    expect(newMarket.error).toBeUndefined();
    expect((await db.getEnabledMarkets()).some((m) => m.symbol === "DOGEUSD")).toBe(true);
    expect(await db.deleteMarket("DOGEUSD", "admin@ictrading.id")).toBe(true);

    // Journal CRUD
    const jrn = await db.createJournal({
      symbol: "XAUUSD",
      side: "BUY",
      lot: 0.2,
      entry: "2680.00",
      exit: "2692.00",
      pnl: 240,
      strategy: "Breakout",
      notes: "Setup sesi NY bersih.",
    });
    expect((await db.getJournal()).some((j) => j.id === jrn.id)).toBe(true);
    await db.deleteJournal(jrn.id);
    expect((await db.getJournal()).some((j) => j.id === jrn.id)).toBe(false);

    // Inbox CRUD
    const msg = await db.createMessage({
      subject: "Tes Tiket Dukungan",
      body: "Mohon cek status verifikasi akun.",
    });
    const archived = await db.updateMessage(msg.id, { archived: true, unread: true });
    expect(archived?.archived).toBe(true);
    expect(archived?.unread).toBe(true);
    await db.deleteMessage(msg.id);
    expect((await db.getMessages()).some((m) => m.id === msg.id)).toBe(false);

    // Community interactions
    const post = await db.createCommunityPost({
      pair: "EURUSD",
      bias: "Bullish",
      title: "Uji Ide Komunitas",
      content: "Harga bertahan di atas support H4.",
    });
    const unliked = await db.toggleCommunityLike(post.id);
    expect(unliked?.likes).toBe(1);
    const commented = await db.addCommunityComment(post.id, {
      text: "Setuju dengan skenario ini.",
    });
    expect(commented?.comments.length).toBe(1);

    // Admin users & audit log
    const usrUpdated = await db.updateAdminUser({
      id: "USR-02",
      kycStatus: "Terverifikasi",
      status: "Aktif",
      adminEmail: "admin@ictrading.id",
    });
    expect(usrUpdated?.kycStatus).toBe("Terverifikasi");
    const logs = await db.getAdminAudit();
    expect(logs.some((l) => l.action === "Perbarui Pengguna")).toBe(true);
  });

  it("delivers targeted and broadcast admin mail with independent recipient state", async () => {
    const [firstUser, secondUser] = memoryStore.users;
    expect(firstUser).toBeDefined();
    expect(secondUser).toBeDefined();

    const targeted = await db.sendAdminMessage({
      recipientUserId: firstUser!.id,
      subject: "Pemberitahuan Pribadi",
      body: "Surat ini hanya untuk pengguna pertama.",
      category: "Sistem & Akun",
      adminEmail: "admin@wmtrader.id",
    });
    expect(targeted.messages).toHaveLength(1);
    expect(
      (await db.getMessagesForUser(firstUser!.id)).some(
        (message) => message.id === targeted.messages![0]!.id,
      ),
    ).toBe(true);
    expect(
      (await db.getMessagesForUser(secondUser!.id)).some(
        (message) => message.id === targeted.messages![0]!.id,
      ),
    ).toBe(false);

    const broadcast = await db.sendAdminMessage({
      recipientUserId: null,
      subject: "Pengumuman untuk Semua",
      body: "Setiap pengguna mendapat salinan terpisah.",
      category: "Sistem & Akun",
      adminEmail: "admin@wmtrader.id",
    });
    expect(broadcast.messages).toHaveLength(memoryStore.users.length);
    expect(new Set(broadcast.messages?.map((message) => message.recipientUserId)).size).toBe(
      memoryStore.users.length,
    );

    const firstCopy = broadcast.messages!.find(
      (message) => message.recipientUserId === firstUser!.id,
    )!;
    const secondCopy = broadcast.messages!.find(
      (message) => message.recipientUserId === secondUser!.id,
    )!;
    await db.updateMessageForUser(firstCopy.id, firstUser!.id, { unread: false });
    expect(
      (await db.getMessagesForUser(firstUser!.id)).find((message) => message.id === firstCopy.id)
        ?.unread,
    ).toBe(false);
    expect(
      (await db.getMessagesForUser(secondUser!.id)).find((message) => message.id === secondCopy.id)
        ?.unread,
    ).toBe(true);
    expect(memoryStore.auditLogs[0]?.action).toBe("Kirim Surat Admin");
  });

  it("lets administrators compose a letter for one user or everyone", async () => {
    renderWithQuery(<AdminMailView />);
    await waitFor(() => {
      expect(screen.getByLabelText("Penerima")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Penerima"), {
      target: { value: memoryStore.users[0]!.id },
    });
    fireEvent.change(screen.getByLabelText("Subjek"), {
      target: { value: "Surat dari admin" },
    });
    fireEvent.change(screen.getByLabelText("Isi Surat"), {
      target: { value: "Informasi untuk pengguna tertentu." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kirim Surat" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Surat berhasil dikirim kepada 1 pengguna.",
      );
    });
    expect(
      memoryStore.messages.some(
        (message) =>
          message.subject === "Surat dari admin" &&
          message.recipientUserId === memoryStore.users[0]!.id,
      ),
    ).toBe(true);

    cleanup();
    memoryStore.profile.accountId = memoryStore.users[0]!.accountId;
    renderWithQuery(<KotakSuratView />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Surat dari admin" })).toBeInTheDocument();
    });
  });

  it("deletes admin positions, deposits, withdrawals, and users with audit records", async () => {
    const userTemplate = memoryStore.users.find((user) => user.id === "USR-02");
    const positionTemplate = memoryStore.positions[0];
    const depositTemplate = memoryStore.deposits[0];
    const withdrawalTemplate = memoryStore.withdrawals[0];
    if (!userTemplate || !positionTemplate || !depositTemplate || !withdrawalTemplate) {
      throw new Error("Missing seed data for admin deletion test.");
    }

    const user = {
      ...userTemplate,
      id: "USR-DELETE",
      accountId: "IC-DELETE",
      name: "Pengguna Uji Hapus",
      email: "uji-hapus@example.com",
    };
    const position = {
      ...positionTemplate,
      id: "ORD-DELETE",
      userId: user.id,
      userName: user.name,
      accountId: user.accountId,
    };
    const deposit = {
      ...depositTemplate,
      id: "DEP-DELETE",
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      accountId: user.accountId,
    };
    const withdrawal = {
      ...withdrawalTemplate,
      id: "WD-DELETE",
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      accountId: user.accountId,
    };
    memoryStore.users.push(user);
    memoryStore.positions.push(position);
    memoryStore.deposits.push(deposit);
    memoryStore.withdrawals.push(withdrawal);

    expect(await db.deleteAdminPosition(position.id, "admin@ictrading.id")).toBe(true);
    expect(await db.deleteAdminDeposit(deposit.id, "admin@ictrading.id")).toBe(true);
    expect(await db.deleteAdminWithdrawal(withdrawal.id, "admin@ictrading.id")).toBe(true);
    expect(memoryStore.users.find((item) => item.id === user.id)?.balance).toBe(user.balance);

    memoryStore.positions.push({ ...position, id: "ORD-CASCADE" });
    memoryStore.deposits.push({ ...deposit, id: "DEP-CASCADE" });
    memoryStore.withdrawals.push({ ...withdrawal, id: "WD-CASCADE" });
    expect(await db.deleteAdminUser(user.id, "admin@ictrading.id")).toBe(true);
    expect(memoryStore.users.some((item) => item.id === user.id)).toBe(false);
    expect(memoryStore.positions.some((item) => item.userId === user.id)).toBe(false);
    expect(memoryStore.deposits.some((item) => item.userId === user.id)).toBe(false);
    expect(memoryStore.withdrawals.some((item) => item.userId === user.id)).toBe(false);
    expect(await db.deleteAdminUser(user.id, "admin@ictrading.id")).toBe(false);

    const actions = memoryStore.auditLogs.map((log) => log.action);
    expect(actions).toContain("Hapus Posisi");
    expect(actions).toContain("Hapus Deposit");
    expect(actions).toContain("Hapus Withdraw");
    expect(actions).toContain("Hapus Pengguna");
  });
});

describe("Interactive UI Views & Menus Smoke Tests", () => {
  it("switches Kalender Akademi tabs and filters cleanly", () => {
    renderWithQuery(<KalenderAkademiView />);
    expect(screen.getByText("Kalender Akademi")).toBeInTheDocument();
    expect(screen.getByText("Data kalender ekonomi belum tersedia.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Jadwal Akademi" }));
    expect(screen.getByText("Jadwal akademi belum tersedia.")).toBeInTheDocument();
  });

  it("filters Panduan Pengguna and toggles onboarding checklist and FAQ", () => {
    renderWithQuery(<PanduanPenggunaView />);
    expect(screen.getByText("Panduan Pengguna")).toBeInTheDocument();

    const search = screen.getByPlaceholderText("Cari topik panduan...");
    fireEvent.change(search, { target: { value: "Raw Spread" } });
    expect(
      screen.getAllByText("Mengenal Perbedaan Akun Raw Spread dan Standard").length,
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("Pelajari tiket order di terminal Trade"));
    expect(screen.getByText("2/4 selesai")).toBeInTheDocument();
  });

  it("switches Pengaturan tabs and saves profile settings", async () => {
    renderWithQuery(<PengaturanView />);
    await waitFor(() => {
      expect(screen.getByLabelText("Nama Lengkap")).toHaveValue("Raka Pratama");
    });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Profil" }));
    await waitFor(() => {
      expect(
        screen.getByText("Profil dan preferensi akun berhasil diperbarui."),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Preferensi Trading" }));
    expect(screen.getByText("Parameter Eksekusi Default")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Keamanan" }));
    expect(screen.getByText("Autentikasi & Kata Sandi")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Notifikasi" }));
    expect(screen.getByText("Pengaturan Pemberitahuan")).toBeInTheDocument();
  });

  it("submits feedback form on the Tentang wmTrader page", () => {
    renderWithQuery(<TentangView />);
    fireEvent.change(screen.getByLabelText("Topik Pertanyaan"), {
      target: { value: "Informasi VPS" },
    });
    fireEvent.change(screen.getByLabelText("Pesan"), {
      target: { value: "Apakah VPS aktif otomatis untuk akun Raw?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kirim Pertanyaan" }));
    expect(
      screen.getByText("Pertanyaan Anda telah dicatat pada pratinjau frontend."),
    ).toBeInTheDocument();
  });

  it("renders DepositView with transfer instructions and validates missing transfer proof", async () => {
    renderWithQuery(<DepositView />);
    await waitFor(() => {
      expect(screen.getByText("Deposit Dana Trading")).toBeInTheDocument();
    });
    expect(screen.getByText("Instruksi Transfer Tujuan")).toBeInTheDocument();
    expect(screen.getByText("Formulir Pengajuan Deposit")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Transfer Bank BCA/ })).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText(/Nomor Referensi/i), {
      target: { value: "BNI-UJI-99" },
    });
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "170000" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Kirim Konfirmasi Deposit/i }));
    await waitFor(() => {
      expect(
        screen.getByText("Mohon unggah foto atau screenshot bukti transfer terlebih dahulu."),
      ).toBeInTheDocument();
    });
  });

  it("renders WithdrawView, JurnalView, KotakSuratView, KomunitasView, and TradeView without admin profit leakage", async () => {
    renderWithQuery(<WithdrawView />);
    await waitFor(() => {
      expect(screen.getByText("Withdraw Saldo Akun")).toBeInTheDocument();
    });

    renderWithQuery(<JurnalView />);
    await waitFor(() => {
      expect(screen.getByText("Jurnal Trading")).toBeInTheDocument();
    });

    renderWithQuery(<KotakSuratView />);
    await waitFor(() => {
      expect(screen.getByText("Kotak Surat")).toBeInTheDocument();
    });

    renderWithQuery(<KomunitasView />);
    await waitFor(() => {
      expect(screen.getByText("Komunitas Trader")).toBeInTheDocument();
    });

    renderWithQuery(<TradeView />);
    await waitFor(() => {
      expect(screen.getByText("Ringkasan Akun & Margin")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Atur Profit User/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Default Keuntungan User/i)).not.toBeInTheDocument();
  });

  it("renders coin charts from enabled market data and opens position history on its tab", async () => {
    renderWithQuery(<ChartView />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /BTCUSD/ })).toBeInTheDocument();
    });
    expect(screen.getByRole("region", { name: /Grafik Bitcoin/ })).toBeInTheDocument();
    cleanup();

    renderWithQuery(<TradeView mode="positions" initialTab="Ditutup" />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Riwayat Ditutup/ })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
    expect(screen.getByText("Ringkasan Akun & Margin")).not.toBeVisible();
  });

  it("renders AccountPage (login & register) and AdminLoginView with matching login appearance", () => {
    renderWithQuery(<AccountPage mode="login" />);
    expect(screen.getByText("Selamat datang kembali")).toBeInTheDocument();
    cleanup();

    renderWithQuery(<AccountPage mode="register" />);
    expect(screen.getByText("Buat akun Anda")).toBeInTheDocument();
    cleanup();

    renderWithQuery(<AdminLoginView />);
    expect(screen.getByText("Masuk ke Portal Admin")).toBeInTheDocument();
    expect(screen.getByLabelText("Alamat email")).toBeInTheDocument();
    expect(screen.getByLabelText("Kata sandi")).toBeInTheDocument();
  });

  it("renders AdminPositionsView and AdminDepositView with admin controls", async () => {
    renderWithQuery(<AdminPositionsView />);
    await waitFor(() => {
      expect(screen.getByText("Aturan Trading Semua User")).toBeInTheDocument();
    });
    expect(screen.getByText("Pantauan Trading Semua User")).toBeInTheDocument();
    cleanup();

    renderWithQuery(<AdminDepositView />);
    await waitFor(() => {
      expect(screen.getByText("Verifikasi Manual & Metode Deposit")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Pengaturan Batas Nominal Deposit (USD & Konversi IDR)"),
    ).toBeInTheDocument();
  });
});
