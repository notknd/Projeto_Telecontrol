from __future__ import annotations

import math
from typing import Literal

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator, model_validator

from app.algorithms.dijkstra import NoPathError, dijkstra
from app.graph import WarehouseGraph
from app.graph_models import WarehouseEdge, WarehouseMap, WarehouseNode
from app.products import DuplicateSkuError, Product, ProductCreate, ProductStore, build_product_store


class HealthResponse(BaseModel):
    status: str
    service: str


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
    strategy: Literal['nearest_neighbor']

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
    visitOrder: Literal['nearest_neighbor'] = 'nearest_neighbor'


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


def build_route_graph(warehouse: Warehouse) -> WarehouseGraph:
    graph = WarehouseMap(
        nodes=(WarehouseNode(node.id, node.x, node.y) for node in warehouse.nodes),
        edges=(WarehouseEdge(edge.from_node, edge.to, edge.distance) for edge in warehouse.edges),
    )
    return WarehouseGraph(graph, directed=True)


def route_for_request(request: RouteRequest) -> RouteResponse:
    graph = build_route_graph(request.warehouse)

    remaining = {stop.id: stop for stop in request.stops}
    path_node_ids = [request.startNodeId]
    ordered_stops: list[RouteStop] = []
    current_node = request.startNodeId
    total_distance = 0.0

    while remaining:
        candidates: list[tuple[float, str, list[str]]] = []
        for stop_id in sorted(remaining):
            try:
                result = dijkstra(graph, current_node, stop_id)
            except NoPathError:
                continue
            else:
                segment, distance = list(result.node_ids), result.distance
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
        try:
            final_result = dijkstra(graph, current_node, request.endNodeId)
        except NoPathError:
            raise RouteNotFound
        segment, distance = list(final_result.node_ids), final_result.distance
        path_node_ids.extend(segment[1:])
        total_distance += distance
    return RouteResponse(pathNodeIds=path_node_ids, stops=ordered_stops, totalDistance=total_distance)


app = FastAPI(title="SmartPick Route Engine", version="0.1.0")


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, __: RequestValidationError) -> JSONResponse:
    return error_response(422, 'INVALID_ROUTE_REQUEST', 'A requisição de cálculo é inválida.')


@app.exception_handler(RouteNotFound)
async def route_not_found_handler(_: Request, __: RouteNotFound) -> JSONResponse:
    return error_response(422, 'NO_ROUTE_FOUND', 'Não existe caminho válido entre os pontos solicitados.')


@app.exception_handler(Exception)
async def internal_error_handler(_: Request, __: Exception) -> JSONResponse:
    return error_response(500, 'ENGINE_INTERNAL_ERROR', 'Não foi possível calcular a rota.')


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="engine")


@app.post('/internal/v1/routes/calculate', response_model=RouteResponse)
def calculate_route(request: RouteRequest) -> RouteResponse:
    return route_for_request(request)


def register_product_routes(application: FastAPI, store: ProductStore) -> None:
    @application.post(
        "/api/v1/products",
        response_model=Product,
        status_code=status.HTTP_201_CREATED,
    )
    def create_product(product_data: ProductCreate) -> Product:
        try:
            return store.create(product_data)
        except DuplicateSkuError as error:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Já existe um produto com este SKU.",
            ) from error


register_product_routes(app, build_product_store())
