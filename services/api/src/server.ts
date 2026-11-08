import Fastify from "fastify";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { registerBusiness, BusinessError } from "./business.js";
import { createEngineClient, type EngineClient } from "./engine/client.js";
import { toPublicApiError } from "./engine/errors.js";

export function buildServer(
  options: { db?: PrismaClient; engine?: EngineClient } = {},
) {
  const server = Fastify({
    logger: true,
    bodyLimit: 1_048_576,
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false } },
  });
  const db = options.db ?? new PrismaClient();
  registerBusiness(server, db, options.engine ?? createEngineClient());
  server.addHook("onClose", async () => {
    if (!options.db) await db.$disconnect();
  });
  // Decimal JSON values are numeric, in the units defined by the public contract.
  server.addHook("preSerialization", async (_request, _reply, payload) => {
    const convert = (value: unknown): unknown => {
      if (
        value &&
        typeof value === "object" &&
        "toNumber" in value &&
        typeof value.toNumber === "function"
      )
        return value.toNumber();
      if (Array.isArray(value)) return value.map(convert);
      if (value && typeof value === "object" && !(value instanceof Date))
        return Object.fromEntries(
          Object.entries(value).map(([k, v]) => [k, convert(v)]),
        );
      return value;
    };
    return convert(payload);
  });
  server.setErrorHandler((error, request, reply) => {
    if (error instanceof BusinessError)
      return reply
        .code(error.statusCode)
        .send({ error: { code: error.code, message: error.message } });
    const code = (error as { code?: string }).code;
    if (code === "P2002" || code === "P2034")
      return reply.code(409).send({
        error: {
          code: "CONFLICT",
          message:
            "Código já utilizado ou dados alterados por outra operação. Atualize e tente novamente.",
        },
      });
    if (code === "P2025")
      return reply.code(404).send({
        error: { code: "NOT_FOUND", message: "Registro não encontrado." },
      });
    if (code === "P1001")
      return reply.code(503).send({
        error: {
          code: "DATABASE_UNAVAILABLE",
          message: "O banco de dados está indisponível.",
        },
      });
    const result = toPublicApiError(error);
    if (result.statusCode >= 500) request.log.error(error);
    return reply.code(result.statusCode).send(result.body);
  });

  server.get("/health", async () => ({ status: "ok", service: "api" }));

  return server;
}

async function start() {
  const server = buildServer();
  const host = process.env.HOST ?? "127.0.0.1";
  const port = Number.parseInt(
    process.env.PORT ?? process.env.API_PORT ?? "3000",
    10,
  );

  await server.listen({ host, port });
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  start().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
