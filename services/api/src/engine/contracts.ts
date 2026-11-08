export interface EngineRouteRequest {
  warehouse: {
    nodes: Array<{ id: string; x: number; y: number }>;
    edges: Array<{ from: string; to: string; distance: number }>;
  };
  startNodeId: string;
  stops: Array<{ id: string; productIds: string[] }>;
  endNodeId?: string;
  strategy: 'nearest_neighbor';
}

export interface EngineRouteResponse {
  status: 'success';
  pathNodeIds: string[];
  stops: Array<{ nodeId: string; sequence: number; productIds: string[] }>;
  totalDistance: number;
  distanceUnit: 'm';
  algorithm: { shortestPath: 'dijkstra'; visitOrder: 'nearest_neighbor' };
}

export interface EngineRouteError {
  error: { code: string; message: string };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim().length > 0);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isEngineRouteRequest(value: unknown): value is EngineRouteRequest {
  if (!isRecord(value) || !isRecord(value.warehouse)) return false;
  if (typeof value.startNodeId !== 'string' || value.startNodeId.trim().length === 0) return false;
  if (value.endNodeId !== undefined && (typeof value.endNodeId !== 'string' || value.endNodeId.trim().length === 0)) {
    return false;
  }
  if (value.strategy !== 'nearest_neighbor') return false;

  const { nodes, edges } = value.warehouse;
  if (!Array.isArray(nodes) || nodes.length === 0 || !Array.isArray(edges) || !Array.isArray(value.stops) || value.stops.length === 0) {
    return false;
  }

  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (!isRecord(node) || typeof node.id !== 'string' || node.id.trim().length === 0 ||
      !isFiniteNumber(node.x) || !isFiniteNumber(node.y) || nodeIds.has(node.id)) {
      return false;
    }
    nodeIds.add(node.id);
  }

  if (!nodeIds.has(value.startNodeId) || (value.endNodeId !== undefined && !nodeIds.has(value.endNodeId))) {
    return false;
  }

  for (const edge of edges) {
    if (!isRecord(edge) || typeof edge.from !== 'string' || typeof edge.to !== 'string' ||
      !nodeIds.has(edge.from) || !nodeIds.has(edge.to) || edge.from === edge.to ||
      !isFiniteNumber(edge.distance) || edge.distance <= 0) {
      return false;
    }
  }

  const stopIds = new Set<string>();
  return value.stops.every((stop) => {
    if (!isRecord(stop) || typeof stop.id !== 'string' || !nodeIds.has(stop.id) ||
      stopIds.has(stop.id) || !isStringArray(stop.productIds) || stop.productIds.length === 0 ||
      new Set(stop.productIds).size !== stop.productIds.length) {
      return false;
    }
    stopIds.add(stop.id);
    return true;
  });
}

export function isEngineRouteResponse(value: unknown): value is EngineRouteResponse {
  if (!isRecord(value) || value.status !== 'success') return false;
  if (!isStringArray(value.pathNodeIds) || value.pathNodeIds.length === 0) return false;
  const pathNodeIds = value.pathNodeIds;
  if (!Array.isArray(value.stops) || !Number.isFinite(value.totalDistance) || (value.totalDistance as number) < 0) return false;
  if (value.distanceUnit !== 'm' || !isRecord(value.algorithm)) return false;
  if (value.algorithm.shortestPath !== 'dijkstra' || value.algorithm.visitOrder !== 'nearest_neighbor') return false;

  return value.stops.every((stop, index) =>
    isRecord(stop) &&
    typeof stop.nodeId === 'string' &&
    pathNodeIds.includes(stop.nodeId) &&
    stop.sequence === index + 1 &&
    isStringArray(stop.productIds) &&
    stop.productIds.length > 0,
  );
}

export function isEngineRouteError(value: unknown): value is EngineRouteError {
  if (!isRecord(value) || !isRecord(value.error)) return false;
  return typeof value.error.code === 'string' && typeof value.error.message === 'string';
}

export function matchesEngineRouteRequest(
  response: EngineRouteResponse,
  request: EngineRouteRequest,
): boolean {
  if (response.pathNodeIds[0] !== request.startNodeId) return false;
  if (request.endNodeId && response.pathNodeIds.at(-1) !== request.endNodeId) return false;
  if (response.stops.length !== request.stops.length) return false;

  let pathDistance = 0;
  for (let index = 1; index < response.pathNodeIds.length; index += 1) {
    const from = response.pathNodeIds[index - 1];
    const to = response.pathNodeIds[index];
    const edge = request.warehouse.edges.find((candidate) => candidate.from === from && candidate.to === to);
    if (!edge) return false;
    pathDistance += edge.distance;
  }
  if (Math.abs(response.totalDistance - pathDistance) > Number.EPSILON * Math.max(1, pathDistance)) {
    return false;
  }

  const requestedStops = new Map(request.stops.map((stop) => [stop.id, stop.productIds]));
  if (requestedStops.size !== request.stops.length) return false;

  return response.stops.every((stop) => {
    const productIds = requestedStops.get(stop.nodeId);
    return productIds !== undefined &&
      productIds.length === stop.productIds.length &&
      productIds.every((productId) => stop.productIds.includes(productId));
  });
}
