const CANONICAL_PRODUCTION_PORT = "3010";

if (!process.env.PORT) {
  process.env.PORT = CANONICAL_PRODUCTION_PORT;
}

if (process.env.PORT !== CANONICAL_PRODUCTION_PORT) {
  throw new Error(
    `Refusing to start the root GPC runtime on port ${process.env.PORT}; production requires ${CANONICAL_PRODUCTION_PORT}.`,
  );
}

if (process.env.UACP_PORT_GUARD_ONLY !== "true") {
  await import("../server.ts");
}
