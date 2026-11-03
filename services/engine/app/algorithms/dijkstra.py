"""Dijkstra's shortest-path algorithm for non-negative warehouse edges."""

from dataclasses import dataclass
from heapq import heappop, heappush
from itertools import count

from app.graph import WarehouseGraph


class NoPathError(ValueError):
    """Raised when two valid warehouse nodes are disconnected."""


@dataclass(frozen=True, slots=True)
class ShortestPath:
    node_ids: tuple[str, ...]
    distance: float


def dijkstra(graph: WarehouseGraph, start_node: str, end_node: str) -> ShortestPath:
    """Find the least-distance path between two nodes.

    Distances are sums of edge weights, which the warehouse map expresses in meters.
    """
    graph.neighbors(start_node)
    graph.neighbors(end_node)
    if start_node == end_node:
        return ShortestPath((start_node,), 0)

    distances = {start_node: 0.0}
    previous: dict[str, str] = {}
    sequence = count()
    queue: list[tuple[float, int, str]] = [(0.0, next(sequence), start_node)]

    while queue:
        distance_to_node, _, node_id = heappop(queue)
        if distance_to_node != distances.get(node_id):
            continue
        if node_id == end_node:
            break

        for neighbor_id, edge_distance in graph.neighbors(node_id).items():
            candidate = distance_to_node + edge_distance
            if candidate < distances.get(neighbor_id, float("inf")):
                distances[neighbor_id] = candidate
                previous[neighbor_id] = node_id
                heappush(queue, (candidate, next(sequence), neighbor_id))

    if end_node not in distances:
        raise NoPathError(f"No path between warehouse nodes {start_node!r} and {end_node!r}")

    path = [end_node]
    while path[-1] != start_node:
        path.append(previous[path[-1]])
    path.reverse()
    return ShortestPath(tuple(path), distances[end_node])
