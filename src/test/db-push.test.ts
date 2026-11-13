import { describe, expect, it } from "vitest";
import { pushSchemaClient } from "@/server/db";

describe("Database schema push", () => {
  it("applies schema only without inserting, updating, or deleting data", async () => {
    const queries: string[] = [];

    await pushSchemaClient({
      query: async (queryText: string) => {
        queries.push(queryText);
        return {};
      },
    });

    expect(queries).toHaveLength(1);
    expect(queries[0]).toMatch(/CREATE TABLE IF NOT EXISTS users/i);
    expect(queries[0]).toMatch(/ADD COLUMN IF NOT EXISTS recipient_user_id/i);
    expect(queries[0]).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b/i);
  });
});
