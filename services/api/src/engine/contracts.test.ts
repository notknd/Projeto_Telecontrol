import assert from "node:assert/strict";
import test from "node:test";
import {
  isEngineRouteResponse,
  matchesEngineRouteRequest,
  type EngineRouteRequest,
  type EngineRouteResponse,
} from "./contracts.js";
const request: EngineRouteRequest = {
  warehouse: {
    nodes: [
      { id: "E", x: 0, y: 0 },
      { id: "A", x: 1, y: 0 },
      { id: "B", x: 2, y: 0 },
      { id: "X", x: 3, y: 0 },
    ],
    edges: [
      { from: "E", to: "A", distance: 1 },
      { from: "A", to: "B", distance: 2 },
      { from: "B", to: "X", distance: 3 },
    ],
  },
  startNodeId: "E",
  endNodeId: "X",
  strategy: "nearest_neighbor",
  stops: [
    { id: "A", productIds: ["p1"] },
    { id: "B", productIds: ["p2"] },
  ],
};
const valid: EngineRouteResponse = {
  status: "success",
  pathNodeIds: ["E", "A", "B", "X"],
  stops: [
    { nodeId: "A", sequence: 1, productIds: ["p1"] },
    { nodeId: "B", sequence: 2, productIds: ["p2"] },
  ],
  totalDistance: 6,
  distanceUnit: "m",
  algorithm: { shortestPath: "dijkstra", visitOrder: "nearest_neighbor" },
};
test("validates the path, distance, complete stop coverage and stop order", () => {
  assert.equal(matchesEngineRouteRequest(valid, request), true);
  assert.equal(
    matchesEngineRouteRequest({ ...valid, totalDistance: 2 }, request),
    false,
  );
  assert.equal(
    matchesEngineRouteRequest(
      { ...valid, pathNodeIds: ["E", "B", "A", "X"] },
      request,
    ),
    false,
  );
  assert.equal(
    matchesEngineRouteRequest(
      { ...valid, stops: [valid.stops[0], valid.stops[0]] },
      request,
    ),
    false,
  );
  assert.equal(
    isEngineRouteResponse({ ...valid, stops: [valid.stops[1], valid.stops[0]] }),
    false,
  );
  assert.equal(
    matchesEngineRouteRequest({ ...valid, stops: [valid.stops[0]] }, request),
    false,
  );
});
