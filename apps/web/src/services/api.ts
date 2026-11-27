export interface WarehouseOption { id: string; code: string; name: string; isActive: boolean }
export interface WarehouseNode { id: string; code: string; type: string; x: number; y: number; label: string | null; isActive: boolean }
export interface Warehouse { nodes: WarehouseNode[]; edges: { id: string; fromNodeId: string; toNodeId: string; distanceMeters: number }[] }
export interface Product { id: string; sku: string; name: string; category: string | null; weightKg: number; stockQuantity: number; warehouseNodeId: string; isActive: boolean; warehouseNode: WarehouseNode }
export interface OrderItem { id: string; productId: string; productSkuSnapshot: string; productNameSnapshot: string; requestedQuantity: number; collectedQuantity: number; product: Product }
export interface PersistedRoute {
  id: string; orderId: string; status: string; algorithm: string; totalDistanceMeters: number;
  distanceUnit: string; pathNodeIds: string[];
  stops: { nodeId: string; sequence: number; productIds: string[] }[];
}
export interface Route extends PersistedRoute {
  steps: { warehouseNodeId: string; sequence: number }[];
  conventionalDistanceMeters: number | null;
  conventionalPathNodeIds: string[] | null;
  stops: { nodeId: string; warehouseNodeId: string; sequence: number; warehouseNode: WarehouseNode; productIds: string[]; items: { orderItemId: string }[] }[];
}
export interface Collection { id: string; orderId: string; routeId: string; status: string; startedAt: string; completedAt: string | null; items: { id: string; orderItemId: string; requestedQuantity: number; collectedQuantity: number; collectedAt?: string | null }[] }
export interface Order { id: string; code: string; status: string; createdAt: string; items: OrderItem[]; routes: Route[]; collections: Collection[] }
export interface HistoryEntry { collectionId: string; order: { id: string; code: string }; routeId: string; startedAt: string; completedAt: string; itemCount: number; requestedQuantity: number; collectedQuantity: number }

export async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error("Não foi possível acessar o servidor. Confira a conexão e tente novamente.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message ?? `Falha na API (${response.status}).`);
  return data as T;
}

async function list<T>(path: string, key: string): Promise<T[]> {
  const result = await request<Record<string, T[]>>(path);
  return result[key] ?? [];
}
const nodeFallback = (id: string): WarehouseNode => ({ id, code: id || "—", type: "STORAGE", x: 0, y: 0, label: null, isActive: true });

export const api = {
  // These endpoints are not part of the consolidated API yet. Keep the old view explicit about that.
  warehouses: async (): Promise<WarehouseOption[]> => { throw new Error("A API ainda não disponibiliza a lista de armazéns."); },
  warehouse: async (_warehouseId?: string): Promise<Warehouse> => { throw new Error("A API ainda não disponibiliza o grafo do armazém."); },
  distance: async (_fromNodeId: string, _toNodeId: string): Promise<{ pathNodeIds: string[]; distanceMeters: number }> => { throw new Error("A API ainda não oferece consulta de distância entre posições."); },
  products: async (_warehouseId?: string) => (await list<Omit<Product, "warehouseNode"> & { warehouseNode?: WarehouseNode }>("/products", "products"))
    .map((product) => ({ ...product, warehouseNode: product.warehouseNode ?? nodeFallback(product.warehouseNodeId) })),
  orders: async (_warehouseId?: string) => (await list<Omit<Order, "routes" | "collections"> & { routes?: Route[]; collections?: Collection[] }>("/orders", "orders"))
    .map((order) => ({ ...order, routes: order.routes ?? [], collections: order.collections ?? [], items: order.items.map((item) => ({ ...item, product: item.product ?? ({ id: item.productId, sku: item.productSkuSnapshot, name: item.productNameSnapshot, category: null, weightKg: 0, stockQuantity: 0, warehouseNodeId: "", isActive: true, warehouseNode: nodeFallback("") }) })) })),
  createProduct: async (body: unknown) => (await request<{ product: Product }>("/products", "POST", body)).product,
  createOrder: async (body: { code: string; items: Array<{ productId: string; requestedQuantity: number }> }) =>
    (await request<{ order: Order }>("/orders", "POST", { code: body.code, items: body.items.map(({ productId, requestedQuantity }) => ({ productId, quantity: requestedQuantity })) })).order,
  calculate: async (orderId: string) => request<{ orderId: string; route: PersistedRoute }>("/routes/calculate", "POST", { orderId }),
  route: async (routeId: string) => (await request<{ route: PersistedRoute }>(`/routes/${routeId}`)).route,
  start: async (orderId: string, routeId: string) => (await request<{ collection: Collection }>("/collections", "POST", { orderId, routeId })).collection,
  collection: async (id: string) => (await request<{ collection: Collection }>(`/collections/${id}`)).collection,
  collect: (id: string, itemId: string, collectedQuantity: number) => request<{ item: Collection["items"][number]; collectionStatus: string; orderStatus: string }>(`/collections/${id}/items/${itemId}`, "PATCH", { collectedQuantity }),
  complete: (id: string) => request<{ collectionId: string; collectionStatus: string; orderId: string; orderStatus: string; completedAt: string }>(`/collections/${id}/complete`, "POST"),
  history: () => list<HistoryEntry>("/collections/history", "collections"),
};

export { nodeFallback };
