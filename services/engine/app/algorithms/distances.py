from collections.abc import Iterable

from app.algorithms.dijkstra import dijkstra
from app.graph import WarehouseGraph


def distances_from(
    graph: WarehouseGraph,
    start_node: str,
    destination_node_ids: Iterable[str],
) -> dict[str, float]:
    distances: dict[str, float] = {}
    for destination_node_id in destination_node_ids:
        distances[destination_node_id] = dijkstra(
            graph, start_node, destination_node_id
        ).distance
    return distances
