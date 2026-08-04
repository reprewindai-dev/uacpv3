const CANONICAL_PRODUCTION_PORT = "3010";

if (!process.env.PORT) {
  process.env.PORT = CANONICAL_PRODUCTION_PORT;
}

if (process.env.NODE_ENV === "production" && process.env.PORT !== CANONICAL_PRODUCTION_PORT) {
  throw new Error(
    `Refusing to start the root GPC runtime on port ${process.env.PORT}; production requires ${CANONICAL_PRODUCTION_PORT}.`,
  );
}

await import("../server.ts");
