export type D1DatabaseLike = {
  prepare: (query: string) => {
    bind: (...values: Array<string | number | null>) => {
      run: () => Promise<unknown>;
    };
  };
};

export const migrationDirectory = "migrations";

export function assertDatabase(env: { DB?: D1DatabaseLike }): D1DatabaseLike {
  if (!env.DB) {
    throw new Error("database_unavailable");
  }
  return env.DB;
}
