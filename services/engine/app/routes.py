from __future__ import annotations

import math
from typing import Literal

from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator, model_validator

from app.graph import WarehouseGraph
from app.graph_models import WarehouseMap, WarehouseNode, WarehouseEdge
from app.algorithms.dijkstra import dijkstra, NoPathError


class Node(BaseModel):
    id: str = Field(min_length=1)
    x: float
    y: float

    @field_validator('id')
    @classmethod
    def strip_id(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError('id cannot be blank')
        return value

    @field_validator('x', 'y')
    @classmethod
    def coordinates_must_be_finite(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError('coordinates must be finite')
        return value


class Edge(BaseModel):
    from_node: str = Field(alias='from', min_length=1)
    to: str = Field(min_length=1)
    distance: float = Field(gt=0)

    @field_validator('distance')
    @classmethod
    def distance_must_be_finite(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError('distance must be finite')
        return value

    model_config = {'populate_by_name': True}


class Warehouse(BaseModel):
    nodes: list[Node] = Field(min_length=1)
    edges: list[Edge]

    @model_validator(mode='after')
    def validate_graph(self) -> 'Warehouse':
        node_ids = [node.id for node in self.nodes]
        if len(node_ids) != len(set(node_ids)):
            raise ValueError('node ids must be unique')
        known_nodes = set(node_ids)
        pairs = [(e.from_node, e.to) for e in self.edges]
        if len(pairs) != len(set(pairs)):
            raise ValueError('duplicate directed edges')
        for edge in self.edges:
            if edge.from_node not in known_nodes or edge.to not in known_nodes:
                raise ValueError('edge endpoints must exist in nodes')
            if edge.from_node == edge.to:
                raise ValueError('edges cannot connect a node to itself')
        return self


class Stop(BaseModel):
    id: str = Field(min_length=1)
    productIds: list[str] = Field(min_length=1)

    @field_validator('id')
    @classmethod
    def strip_stop_id(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError('id cannot be blank')
        return value

    @field_validator('productIds')
    @classmethod
    def products_must_be_unique_and_non_empty(cls, values: list[str]) -> list[str]:
        products = [value.strip() for value in values]
        if any(not product for product in products) or len(products) != len(set(products)):
            raise ValueError('product ids must be unique and non-empty')
        return products


class RouteRequest(BaseModel):
    warehouse: Warehouse
    startNodeId: str = Field(min_length=1)
    stops: list[Stop] = Field(min_length=1)
    endNodeId: str | None = None
    strategy: Literal['nearest_neighbor', 'input_order']

    @model_validator(mode='after')
    def validate_route_nodes(self) -> 'RouteRequest':
        node_ids = {node.id for node in self.warehouse.nodes}
        if self.startNodeId not in node_ids or (self.endNodeId is not None and self.endNodeId not in node_ids):
            raise ValueError('route nodes must exist in warehouse')
        stop_ids = [stop.id for stop in self.stops]
        if len(stop_ids) != len(set(stop_ids)) or any(stop_id not in node_ids for stop_id in stop_ids):
            raise ValueError('stops must identify distinct warehouse nodes')
        return self


class RouteStop(BaseModel):
    nodeId: str
    sequence: int
    productIds: list[str]


class Algorithm(BaseModel):
    shortestPath: Literal['dijkstra'] = 'dijkstra'
    visitOrder: Literal['nearest_neighbor', 'input_order'] = 'nearest_neighbor'


class RouteResponse(BaseModel):
    status: Literal['success'] = 'success'
    pathNodeIds: list[str]
    stops: list[RouteStop]
    totalDistance: float
    distanceUnit: Literal['m'] = 'm'
    algorithm: Algorithm = Field(default_factory=Algorithm)


class RouteNotFound(Exception):
    pass


def error_response(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={'error': {'code': code, 'message': message}})


def shortest_path(graph: WarehouseGraph, start: str, destination: str) -> tuple[list[str], float] | None:
    try:
        result = dijkstra(graph, start, destination)
        return list(result.node_ids), result.distance
    except NoPathError:
        return None


def route_for_request(request: RouteRequest) -> RouteResponse:
    adjacency = WarehouseGraph(WarehouseMap(
        [WarehouseNode(n.id, n.x, n.y) for n in request.warehouse.nodes],
        [WarehouseEdge(e.from_node, e.to, e.distance) for e in request.warehouse.edges],
    ))

    remaining = {stop.id: stop for stop in request.stops}
    path_node_ids = [request.startNodeId]
    ordered_stops: list[RouteStop] = []
    current_node = request.startNodeId
    total_distance = 0.0

    while remaining:
        candidates: list[tuple[float, str, list[str]]] = []
        stop_ids = sorted(remaining) if request.strategy == 'nearest_neighbor' else [next(iter(remaining))]
        for stop_id in stop_ids:
            result = shortest_path(adjacency, current_node, stop_id)
            if result is not None:
                segment, distance = result
                candidates.append((distance, stop_id, segment))
        if not candidates:
            raise RouteNotFound
        distance, stop_id, segment = min(candidates, key=lambda candidate: (candidate[0], candidate[1]))
        stop = remaining.pop(stop_id)
        path_node_ids.extend(segment[1:])
        total_distance += distance
        ordered_stops.append(RouteStop(nodeId=stop.id, sequence=len(ordered_stops) + 1, productIds=stop.productIds))
        current_node = stop_id

    if request.endNodeId is not None:
        final_segment = shortest_path(adjacency, current_node, request.endNodeId)
        if final_segment is None:
            raise RouteNotFound
        segment, distance = final_segment
        path_node_ids.extend(segment[1:])
        total_distance += distance
    return RouteResponse(pathNodeIds=path_node_ids, stops=ordered_stops, totalDistance=total_distance, algorithm=Algorithm(visitOrder=request.strategy))
