import sql from "mssql";

// Server-only MSSQL connection to the legacy Manilal ERP database.
// Read-only by convention: the sync layer must never INSERT/UPDATE/DELETE.

const config: sql.config = {
  server: process.env.MSSQL_MANILAL_HOST!,
  port: Number(process.env.MSSQL_MANILAL_PORT ?? 1433),
  user: process.env.MSSQL_MANILAL_USER!,
  password: process.env.MSSQL_MANILAL_PASSWORD!,
  database: process.env.MSSQL_MANILAL_DATABASE ?? "manilal",
  options: {
    encrypt: false, // SQL Server 2008 R2, no TLS
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: { max: 4, min: 0, idleTimeoutMillis: 30_000 },
  connectionTimeout: 20_000,
  requestTimeout: 180_000,
};

let poolPromise: Promise<sql.ConnectionPool> | null = null;

export function getErpPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config)
      .connect()
      .catch((err) => {
        poolPromise = null;
        throw err;
      });
  }
  return poolPromise;
}

export { sql };
