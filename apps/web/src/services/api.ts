export interface WarehouseOption { id: string; code: string; name: string; isActive: boolean }
export interface WarehouseNode {
  warehouseId?: string;
  id: string;
  code: string;
  type: string;
  x: number;
  y: number;
  label: string | null;
  isActive: boolean;
}
export interface Warehouse {
  nodes: WarehouseNode[];
  edges: {
    id: string;
    fromNodeId: string;
    toNodeId: string;
    distanceMeters: number;
  }[];
}
export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  weightKg: number;
  stockQuantity: number;
  warehouseNodeId: string;
  isActive: boolean;
  warehouseNode: WarehouseNode;
}
export interface OrderItem {
  id: string;
  productId: string;
  productSkuSnapshot: string;
  productNameSnapshot: string;
  requestedQuantity: number;
  collectedQuantity: number;
  product: Product;
}
export interface Route {
  id: string;
  status: string;
  totalDistanceMeters: number;
  conventionalDistanceMeters: number | null;
  conventionalPathNodeIds: string[] | null;
  calculatedAt: string;
  algorithm: string;
  steps: { warehouseNodeId: string; sequence: number }[];
  stops: {
    warehouseNodeId: string;
    sequence: number;
    warehouseNode: WarehouseNode;
    items: { orderItemId: string }[];
  }[];
}
export interface Collection {
  id: string;
  routeId: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  items: {
    id: string;
    orderItemId: string;
    requestedQuantity: number;
    collectedQuantity: number;
  }[];
}
export interface Order {
  warehouseId?: string;
  id: string;
  code: string;
  status: string;
  createdAt: string;
  items: OrderItem[];
  routes: Route[];
  collections: Collection[];
}

export async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error(
      "Não foi possível acessar o servidor. Confira a conexão e tente novamente.",
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      data?.error?.message ?? "O servidor não conseguiu concluir a operação.",
    );
  return data as T;
}
export const api = {
  warehouses: () => request<WarehouseOption[]>('/warehouses'),
  products: (warehouseId?: string) => request<Product[]>("/products" + (warehouseId ? `?warehouseId=${encodeURIComponent(warehouseId)}` : '')),
  orders: (warehouseId?: string) => request<Order[]>("/orders" + (warehouseId ? `?warehouseId=${encodeURIComponent(warehouseId)}` : '')),
  distance: (fromNodeId: string, toNodeId: string) =>
    request<{ pathNodeIds: string[]; distanceMeters: number }>(
      "/warehouse/distance",
      "POST",
      { fromNodeId, toNodeId },
    ),
  warehouse: (warehouseId?: string) => request<Warehouse>("/warehouse" + (warehouseId ? `?warehouseId=${encodeURIComponent(warehouseId)}` : '')),
  saveProduct: (body: unknown, id?: string) =>
    request(id ? `/products/${id}` : "/products", id ? "PUT" : "POST", body),
  createOrder: (body: unknown) => request<Order>("/orders", "POST", body),
  calculate: (orderId: string) =>
    request("/routes/calculate", "POST", { orderId }),
  start: (id: string) => request(`/orders/${id}/collections`, "POST"),
  collect: (id: string, itemId: string, collectedQuantity: number) =>
    request(`/collections/${id}/items/${itemId}`, "PATCH", {
      collectedQuantity,
    }),
  complete: (id: string) => request(`/collections/${id}/complete`, "POST"),
  cancel: (id: string) => request(`/orders/${id}/cancel`, "POST"),
};
