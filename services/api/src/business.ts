import { createHash } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import type { EngineClient } from "./engine/client.js";
import {
  isEngineRouteRequest,
  type EngineRouteRequest,
} from "./engine/contracts.js";

export class BusinessError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
function fail(message: string, status = 409): never {
  throw new BusinessError(status, "INVALID_OPERATION", message);
}
const uuid = { type: "string", format: "uuid" };
const text = (maxLength: number) => ({
  type: "string",
  minLength: 1,
  maxLength,
  pattern: "\\S",
});
const integer = { type: "integer", minimum: 0, maximum: 2147483647 };
const params = { type: "object", required: ["id"], properties: { id: uuid } };
const productBody = {
  type: "object",
  additionalProperties: false,
  required: ["sku", "name", "weightKg", "stockQuantity", "warehouseNodeId"],
  properties: {
    sku: text(50),
    name: text(120),
    category: text(80),
    weightKg: { type: "number", minimum: 0, maximum: 9999999 },
    stockQuantity: integer,
    warehouseNodeId: uuid,
    isActive: { type: "boolean" },
  },
};
type ProductInput = {
  sku: string;
  name: string;
  category?: string;
  weightKg: number;
  stockQuantity: number;
  warehouseNodeId: string;
  isActive?: boolean;
};
const routeInclude = {
  steps: { orderBy: { sequence: "asc" as const } },
  stops: {
    orderBy: { sequence: "asc" as const },
    include: { items: true, warehouseNode: true },
  },
};
const orderInclude = {
  items: {
    orderBy: [
      { sequence: "asc" as const },
      { createdAt: "asc" as const },
      { id: "asc" as const },
    ],
    include: { product: { include: { warehouseNode: true } } },
  },
  routes: { orderBy: { calculatedAt: "desc" as const }, include: routeInclude },
  collections: {
    orderBy: { startedAt: "desc" as const },
    include: { items: true },
  },
};
type DB = Prisma.TransactionClient;
const atomic = <T>(db: PrismaClient, fn: (tx: DB) => Promise<T>) =>
  db.$transaction(fn, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
const getOrder = async (db: DB, id: string) => {
  const order = await db.order.findUnique({
    where: { id },
    include: orderInclude,
  });
  if (!order)
    throw new BusinessError(404, "NOT_FOUND", "Pedido não encontrado.");
  return order;
};
async function warehouse(db: DB) {
  const nodes = await db.warehouseNode.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
  });
  const edges = await db.warehouseEdge.findMany({
    where: {
      isActive: true,
      fromNode: { isActive: true },
      toNode: { isActive: true },
    },
    orderBy: { id: "asc" },
  });
  return { nodes, edges };
}
async function routeInput(db: DB, id: string) {
  const order = await getOrder(db, id);
  if (!["PENDING", "ROUTED"].includes(order.status))
    fail("Este pedido não pode receber ou iniciar uma rota.");
  const layout = await warehouse(db);
  const entries = layout.nodes.filter((n) => n.type === "ENTRY");
  const exits = layout.nodes.filter((n) => n.type === "EXIT");
  if (entries.length !== 1 || exits.length !== 1)
    fail("O armazém precisa de uma entrada e uma saída ativas.", 422);
  const stops = new Map<string, string[]>();
  for (const item of order.items) {
    const p = item.product;
    if (
      !p.isActive ||
      !p.warehouseNode.isActive ||
      p.warehouseNode.type !== "STORAGE" ||
      p.stockQuantity < item.requestedQuantity
    )
      fail(
        "Produto sem estoque suficiente ou posição ativa. Revise o pedido.",
        422,
      );
    stops.set(p.warehouseNodeId, [
      ...(stops.get(p.warehouseNodeId) ?? []),
      p.id,
    ]);
  }
  const input: EngineRouteRequest = {
    warehouse: {
      nodes: layout.nodes.map((n) => ({
        id: n.id,
        x: Number(n.x),
        y: Number(n.y),
      })),
      edges: layout.edges.map((e) => ({
        from: e.fromNodeId,
        to: e.toNodeId,
        distance: Number(e.distanceMeters),
      })),
    },
    startNodeId: entries[0].id,
    endNodeId: exits[0].id,
    stops: [...stops].map(([id, productIds]) => ({ id, productIds })),
    strategy: "nearest_neighbor",
  };
  if (!isEngineRouteRequest(input))
    fail("Pedido ou grafo inválido para cálculo.", 422);
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        input,
        items: order.items.map((i) => [
          i.id,
          i.requestedQuantity,
          i.product.updatedAt,
        ]),
      }),
    )
    .digest("hex");
  return { order, input, fingerprint };
}
async function validPosition(db: DB, id: string) {
  if (
    !(await db.warehouseNode.findFirst({
      where: { id, type: "STORAGE", isActive: true },
    }))
  )
    fail("Selecione uma posição de armazenagem ativa.", 422);
}

export function registerBusiness(
  server: FastifyInstance,
  db: PrismaClient,
  engine: EngineClient,
) {
  server.get("/api/v1/warehouse", () => warehouse(db));
  server.get("/api/v1/products", () =>
    db.product.findMany({
      include: { warehouseNode: true },
      orderBy: { sku: "asc" },
    }),
  );
  server.post<{ Body: ProductInput }>(
    "/api/v1/products",
    { schema: { body: productBody } },
    async (req, reply) => {
      const result = await atomic(db, async (tx) => {
        await validPosition(tx, req.body.warehouseNodeId);
        return tx.product.create({
          data: {
            ...req.body,
            sku: req.body.sku.trim().toUpperCase(),
            name: req.body.name.trim(),
          },
        });
      });
      return reply.code(201).send(result);
    },
  );
  server.put<{ Params: { id: string }; Body: ProductInput }>(
    "/api/v1/products/:id",
    { schema: { params, body: productBody } },
    async (req) =>
      atomic(db, async (tx) => {
        await validPosition(tx, req.body.warehouseNodeId);
        const active = await tx.orderItem.count({
          where: { productId: req.params.id, order: { status: "COLLECTING" } },
        });
        if (active) fail("Este produto participa de uma coleta em andamento.");
        const affected = await tx.order.findMany({
          where: {
            status: "ROUTED",
            items: { some: { productId: req.params.id } },
          },
          select: { id: true },
        });
        const ids = affected.map((o) => o.id);
        await tx.route.updateMany({
          where: { orderId: { in: ids }, status: "CALCULATED" },
          data: { status: "INVALIDATED" },
        });
        await tx.order.updateMany({
          where: { id: { in: ids } },
          data: { status: "PENDING" },
        });
        return tx.product.update({
          where: { id: req.params.id },
          data: {
            ...req.body,
            sku: req.body.sku.trim().toUpperCase(),
            name: req.body.name.trim(),
          },
        });
      }),
  );
  server.get("/api/v1/orders", () =>
    db.order.findMany({
      include: orderInclude,
      orderBy: { createdAt: "desc" },
    }),
  );
  server.get<{ Params: { id: string } }>(
    "/api/v1/orders/:id",
    { schema: { params } },
    (req) => getOrder(db, req.params.id),
  );
  server.post<{
    Body: {
      code: string;
      items: { productId: string; requestedQuantity: number }[];
    };
  }>(
    "/api/v1/orders",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["code", "items"],
          properties: {
            code: text(50),
            items: {
              type: "array",
              minItems: 1,
              maxItems: 500,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["productId", "requestedQuantity"],
                properties: {
                  productId: uuid,
                  requestedQuantity: { ...integer, minimum: 1 },
                },
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const result = await atomic(db, async (tx) => {
        const merged = new Map<string, number>();
        for (const i of req.body.items)
          merged.set(
            i.productId,
            (merged.get(i.productId) ?? 0) + i.requestedQuantity,
          );
        const items = [];
        for (const [productId, requestedQuantity] of merged) {
          const p = await tx.product.findUnique({ where: { id: productId } });
          if (!p || !p.isActive || requestedQuantity > p.stockQuantity)
            fail("Produto indisponível ou quantidade acima do estoque.", 422);
          await validPosition(tx, p.warehouseNodeId);
          items.push({
            productId,
            requestedQuantity,
            sequence: items.length,
            productSkuSnapshot: p.sku,
            productNameSnapshot: p.name,
          });
        }
        return tx.order.create({
          data: { code: req.body.code.trim(), items: { create: items } },
          include: orderInclude,
        });
      });
      return reply.code(201).send(result);
    },
  );
  server.post<{ Body: { orderId: string } }>(
    "/api/v1/routes/calculate",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["orderId"],
          properties: { orderId: uuid },
        },
      },
    },
    async (req) => {
      const before = await atomic(db, (tx) => routeInput(tx, req.body.orderId));
      if (!["PENDING", "ROUTED"].includes(before.order.status))
        fail("Este pedido não pode receber uma nova rota.");
      const calculated = await engine.calculateRoute(before.input);
      // The same graph and stop set are used for the conventional baseline.
      // Some directed graphs permit the heuristic order but not the conventional order.
      let conventional: number | null = null;
      try {
        conventional = (
          await engine.calculateRoute({
            ...before.input,
            strategy: "input_order",
          })
        ).totalDistance;
      } catch (e) {
        if (!(e instanceof Error && "kind" in e && e.kind === "no_route_found"))
          throw e;
      }
      return atomic(db, async (tx) => {
        const current = await routeInput(tx, req.body.orderId);
        if (
          current.fingerprint !== before.fingerprint ||
          !["PENDING", "ROUTED"].includes(current.order.status)
        )
          fail("O pedido mudou durante o cálculo. Calcule novamente.");
        await tx.route.updateMany({
          where: { orderId: current.order.id, status: "CALCULATED" },
          data: { status: "SUPERSEDED" },
        });
        const previous = await tx.route.aggregate({
          where: { orderId: current.order.id },
          _max: { inputVersion: true },
        });
        const route = await tx.route.create({
          data: {
            orderId: current.order.id,
            algorithm: "dijkstra+nearest_neighbor",
            totalDistanceMeters: calculated.totalDistance,
            conventionalDistanceMeters: conventional,
            inputVersion: (previous._max.inputVersion ?? 0) + 1,
            inputFingerprint: current.fingerprint,
            steps: {
              create: calculated.pathNodeIds.map(
                (warehouseNodeId, sequence) => ({ warehouseNodeId, sequence }),
              ),
            },
            stops: {
              create: calculated.stops.map((s) => ({
                warehouseNodeId: s.nodeId,
                sequence: s.sequence,
                items: {
                  create: current.order.items
                    .filter((i) => s.productIds.includes(i.productId))
                    .map((i) => ({ orderItemId: i.id })),
                },
              })),
            },
          },
          include: routeInclude,
        });
        await tx.order.update({
          where: { id: current.order.id },
          data: { status: "ROUTED" },
        });
        return { orderId: current.order.id, route };
      });
    },
  );
  server.post<{ Params: { id: string } }>(
    "/api/v1/orders/:id/collections",
    { schema: { params } },
    async (req, reply) => {
      const result = await atomic(db, async (tx) => {
        const { order, fingerprint } = await routeInput(tx, req.params.id);
        const route = order.routes.find((r) => r.status === "CALCULATED");
        if (order.status !== "ROUTED" || !route)
          fail("Calcule uma rota antes de iniciar a coleta.");
        if (route.inputFingerprint !== fingerprint) {
          await tx.route.update({
            where: { id: route.id },
            data: { status: "INVALIDATED" },
          });
          await tx.order.update({
            where: { id: order.id },
            data: { status: "PENDING" },
          });
          return null;
        }
        const collection = await tx.collection.create({
          data: {
            orderId: order.id,
            routeId: route.id,
            items: {
              create: order.items.map((i) => ({
                orderItemId: i.id,
                requestedQuantity: i.requestedQuantity,
              })),
            },
          },
          include: { items: true },
        });
        await tx.order.update({
          where: { id: order.id },
          data: { status: "COLLECTING" },
        });
        await tx.route.update({
          where: { id: route.id },
          data: { status: "IN_USE" },
        });
        return collection;
      });
      if (!result) fail("A rota ficou desatualizada. Calcule novamente.");
      return reply.code(201).send(result);
    },
  );
  server.patch<{
    Params: { id: string; itemId: string };
    Body: { collectedQuantity: number };
  }>(
    "/api/v1/collections/:id/items/:itemId",
    {
      schema: {
        params: {
          ...params,
          required: ["id", "itemId"],
          properties: { id: uuid, itemId: uuid },
        },
        body: {
          type: "object",
          additionalProperties: false,
          required: ["collectedQuantity"],
          properties: { collectedQuantity: integer },
        },
      },
    },
    (req) =>
      atomic(db, async (tx) => {
        const item = await tx.collectionItem.findFirst({
          where: { id: req.params.itemId, collectionId: req.params.id },
          include: { collection: true, orderItem: true },
        });
        if (!item) fail("Item de coleta não encontrado.", 404);
        if (item.collection.status !== "IN_PROGRESS")
          fail("A coleta não está em andamento.");
        const quantity = req.body.collectedQuantity;
        if (
          quantity > item.requestedQuantity ||
          quantity < item.collectedQuantity
        )
          fail(
            "A quantidade deve ficar entre o já coletado e o solicitado.",
            422,
          );
        const delta = quantity - item.collectedQuantity;
        const changed = await tx.product.updateMany({
          where: {
            id: item.orderItem.productId,
            stockQuantity: { gte: delta },
          },
          data: { stockQuantity: { decrement: delta } },
        });
        if (!changed.count)
          fail("Estoque insuficiente para confirmar a coleta.");
        await tx.orderItem.update({
          where: { id: item.orderItemId },
          data: { collectedQuantity: quantity },
        });
        return tx.collectionItem.update({
          where: { id: item.id },
          data: {
            collectedQuantity: quantity,
            collectedAt:
              quantity === item.requestedQuantity ? new Date() : null,
          },
        });
      }),
  );
  server.post<{ Params: { id: string } }>(
    "/api/v1/collections/:id/complete",
    { schema: { params } },
    (req) =>
      atomic(db, async (tx) => {
        const c = await tx.collection.findUnique({
          where: { id: req.params.id },
          include: { items: true },
        });
        if (!c) fail("Coleta não encontrada.", 404);
        if (c.status === "COMPLETED") return c;
        if (
          c.status !== "IN_PROGRESS" ||
          !c.items.length ||
          c.items.some((i) => i.collectedQuantity !== i.requestedQuantity)
        )
          fail("Confirme todas as quantidades antes de concluir.");
        const completedAt = new Date();
        await tx.order.update({
          where: { id: c.orderId },
          data: { status: "COMPLETED", completedAt },
        });
        await tx.route.update({
          where: { id: c.routeId },
          data: { status: "COMPLETED" },
        });
        return tx.collection.update({
          where: { id: c.id },
          data: { status: "COMPLETED", completedAt },
        });
      }),
  );
  server.post<{ Params: { id: string } }>(
    "/api/v1/orders/:id/cancel",
    { schema: { params } },
    (req) =>
      atomic(db, async (tx) => {
        const o = await getOrder(tx, req.params.id);
        if (["COMPLETED", "CANCELLED"].includes(o.status))
          fail("Pedido já encerrado.");
        const cancelledAt = new Date();
        await tx.collection.updateMany({
          where: { orderId: o.id, status: "IN_PROGRESS" },
          data: { status: "CANCELLED", cancelledAt },
        });
        await tx.route.updateMany({
          where: { orderId: o.id, status: { in: ["CALCULATED", "IN_USE"] } },
          data: { status: "INVALIDATED" },
        });
        return tx.order.update({
          where: { id: o.id },
          data: { status: "CANCELLED", cancelledAt },
        });
      }),
  );
}
