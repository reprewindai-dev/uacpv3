// Canonical root GPC entrypoint. Preserve an explicitly supplied deployment PORT,
// otherwise bind the production/root runtime to 3010 before server.ts is loaded.
process.env.PORT ||= "3010";
await import("../server.ts");
