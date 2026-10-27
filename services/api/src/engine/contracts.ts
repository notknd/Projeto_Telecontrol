export interface EngineRouteRequest {
  warehouse: {
    nodes: Array<{ id: string; x: number; y: number }>;
    edges: Array<{ from: string; to: string; distance: number }>;
  };
  startNodeId: string;
  stops: Array<{ id: string; productIds: string[] }>;
  endNodeId?: string;
  strategy: string;
}

export interface EngineRouteResponse {
  status: 'success';
  pathNodeIds: string[];
  stops: Array<{ nodeId: string; sequence: number; productIds: string[] }>;
  totalDistance: number;
  distanceUnit: 'm';
  algorithm: { shortestPath: string; visitOrder: string };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function isEngineRouteResponse(value: unknown): value is EngineRouteResponse {
  if (!isRecord(value) || value.status !== 'success') return false;
  if (!isStringArray(value.pathNodeIds) || value.pathNodeIds.length === 0) return false;
  const pathNodeIds = value.pathNodeIds;
  if (!Array.isArray(value.stops) || !Number.isFinite(value.totalDistance) || (value.totalDistance as number) < 0) return false;
  if (value.distanceUnit !== 'm' || !isRecord(value.algorithm)) return false;
  if (typeof value.algorithm.shortestPath !== 'string' || value.algorithm.shortestPath.length === 0) return false;
  if (typeof value.algorithm.visitOrder !== 'string' || value.algorithm.visitOrder.length === 0) return false;

  return value.stops.every((stop, index) =>
    isRecord(stop) &&
    typeof stop.nodeId === 'string' &&
    pathNodeIds.includes(stop.nodeId) &&
    stop.sequence === index + 1 &&
    isStringArray(stop.productIds) &&
    stop.productIds.length > 0,
  );
}

export function matchesEngineRouteRequest(
  response: EngineRouteResponse,
  request: EngineRouteRequest,
): boolean {
  if (response.pathNodeIds[0] !== request.startNodeId) return false;
  if (request.endNodeId && response.pathNodeIds.at(-1) !== request.endNodeId) return false;
  if (response.stops.length !== request.stops.length) return false;

  const requestedStops = new Map(request.stops.map((stop) => [stop.id, stop.productIds]));
  if (requestedStops.size !== request.stops.length) return false;

  return response.stops.every((stop) => {
    const productIds = requestedStops.get(stop.nodeId);
    return productIds !== undefined &&
      productIds.length === stop.productIds.length &&
      productIds.every((productId) => stop.productIds.includes(productId));
  });
}
