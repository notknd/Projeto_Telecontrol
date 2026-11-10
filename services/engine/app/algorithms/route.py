from collections.abc import Iterable
from dataclasses import dataclass

from app.algorithms.dijkstra import dijkstra
from app.algorithms.ordering import nearest_neighbor_order
from app.graph import WarehouseGraph


@dataclass(frozen=True, slots=True)
class RouteStop:
    node_id: str
    sequence: int


@dataclass(frozen=True, slots=True)
class CompleteRoute:
    path_node_ids: tuple[str, ...]
    stops: tuple[RouteStop, ...]
    total_distance: float
    distance_unit: str = "m"


def generate_route(
    graph: WarehouseGraph,
    start_node_id: str,
    stop_node_ids: Iterable[str],
    end_node_id: str | None = None,
) -> CompleteRoute:
    ordered_stops = nearest_neighbor_order(graph, start_node_id, stop_node_ids)
    path_node_ids = [start_node_id]
    total_distance = 0.0
    current_node_id = start_node_id
    destinations = list(ordered_stops)
    if end_node_id is not None:
        destinations.append(end_node_id)

    for target_node_id in destinations:
        segment = dijkstra(graph, current_node_id, target_node_id)
        path_node_ids.extend(segment.node_ids[1:])
        total_distance += segment.distance
        current_node_id = target_node_id

    return CompleteRoute(
        path_node_ids=tuple(path_node_ids),
        stops=tuple(
            RouteStop(node_id=node_id, sequence=index)
            for index, node_id in enumerate(ordered_stops, start=1)
        ),
        total_distance=total_distance,
    )
