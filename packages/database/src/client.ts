import { databaseUnavailable, type Availability } from "@fused-ai/types";
import { err, fail, type Result } from "@fused-ai/shared";
import { databaseAvailability, type FusedEnv } from "@fused-ai/config";

export type DatabaseClient = {
  availability(): Availability;
  ping(): Promise<Result<true>>;
};

export function createDatabaseClient(env: FusedEnv): DatabaseClient {
  return {
    availability: () => databaseAvailability(env),
    ping: async () => {
      const a = databaseAvailability(env);
      if (a.status !== "OK") return fail(a);
      return err(
        databaseUnavailable(
          "DATABASE_URL is set but a Postgres driver is not wired in Phase 1. Refusing to pretend the database is connected.",
        ),
      );
    },
  };
}
