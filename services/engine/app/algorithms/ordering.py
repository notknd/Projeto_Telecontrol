"""Pickup-stop ordering strategies."""

from collections.abc import Iterable

from app.algorithms.dijkstra import dijkstra
from app.graph import WarehouseGraph


def nearest_neighbor_order(
    graph: WarehouseGraph,
    start_node_id: str,
    stop_node_ids: Iterable[str],
) -> tuple[str, ...]:
    """Order unique pickup locations using the nearest-neighbor heuristic.

    Equal-distance choices keep the order provided by the caller. This makes
    the heuristic reproducible while leaving its non-optimal nature explicit.
    """
    graph.neighbors(start_node_id)
    remaining = list(dict.fromkeys(stop_node_ids))
    ordered: list[str] = []
    current_node_id = start_node_id

    while remaining:
        distances = {
            node_id: dijkstra(graph, current_node_id, node_id).distance
            for node_id in remaining
        }
        next_node_id = min(remaining, key=distances.__getitem__)
        ordered.append(next_node_id)
        remaining.remove(next_node_id)
        current_node_id = next_node_id

    return tuple(ordered)
