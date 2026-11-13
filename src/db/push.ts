import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { pushSchemaClient } from "../server/db.ts";

// Muat file .env jika tersedia
try {
  if (typeof process.loadEnvFile === "function" && fs.existsSync(".env")) {
    process.loadEnvFile(".env");
  }
} catch {
  // Abaikan jika .env tidak dapat dibaca
}

async function runDbPush() {
  const isDryRun = process.argv.includes("--dry-run");
  const databaseUrl = process.env["DATABASE_URL"]?.trim();

  if (!databaseUrl) {
    console.error("[db:push] ERROR: Variabel DATABASE_URL tidak ditemukan di .env.");
    process.exit(1);
  }

  const schemaPath = path.resolve(process.cwd(), "src/db/schema.sql");
  if (!fs.existsSync(schemaPath)) {
    console.error(`[db:push] ERROR: File skema tidak ditemukan di ${schemaPath}`);
    process.exit(1);
  }

  const schemaSql = fs.readFileSync(schemaPath, "utf-8");

  if (isDryRun) {
    let parsedHost = "unknown";
    let parsedDb = "unknown";
    try {
      const u = new URL(databaseUrl);
      parsedHost = `${u.hostname}:${u.port || "5432"}`;
      parsedDb = u.pathname.replace(/^\//, "");
    } catch {
      console.error("[db:push] ERROR: Format DATABASE_URL tidak valid.");
      process.exit(1);
    }

    const statements = schemaSql
      .split(";")
      .map((s) =>
        s
          .split("\n")
          .filter((line) => !line.trim().startsWith("--"))
          .join("\n")
          .trim(),
      )
      .filter((s) => s.length > 0 && /^CREATE\s+TABLE/i.test(s));

    console.log(
      `[db:push] Dry-run valid: target PostgreSQL ${parsedHost}/${parsedDb}, ${statements.length} tabel DDL siap di-push.`,
    );
    return;
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
  });

  try {
    console.log("[db:push] Menghubungkan ke PostgreSQL...");
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await pushSchemaClient(client);
      await client.query("COMMIT");
      console.log(
        "[db:push] Sukses! Skema tabel berhasil di-push ke PostgreSQL tanpa menambahkan seed data.",
      );
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[db:push] Gagal melakukan push ke PostgreSQL: ${message}`);
    console.error(
      "[db:push] Pastikan server PostgreSQL berjalan dan DATABASE_URL pada file .env sudah benar.",
    );
    process.exit(1);
  } finally {
    await pool.end();
  }
}

void runDbPush();
