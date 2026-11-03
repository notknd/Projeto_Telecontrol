"""Weighted graph representation used by warehouse route algorithms."""

from types import MappingProxyType
from typing import Mapping

from app.graph_models import WarehouseMap


class WarehouseGraph:
    """An undirected adjacency list built from a validated warehouse map."""

    def __init__(self, warehouse: WarehouseMap) -> None:
        adjacency: dict[str, dict[str, float]] = {
            node.id: {} for node in warehouse.nodes
        }
        for edge in warehouse.edges:
            # Keep the shortest walkable connection if the input lists a pair twice.
            current = adjacency[edge.from_node].get(edge.to_node)
            if current is None or edge.distance < current:
                adjacency[edge.from_node][edge.to_node] = edge.distance
                adjacency[edge.to_node][edge.from_node] = edge.distance
        self._adjacency = adjacency

    @property
    def node_ids(self) -> tuple[str, ...]:
        return tuple(self._adjacency)

    def neighbors(self, node_id: str) -> Mapping[str, float]:
        """Return neighboring nodes and distances, or reject an unknown node."""
        try:
            return MappingProxyType(self._adjacency[node_id])
        except KeyError as error:
            raise KeyError(f"Unknown warehouse node: {node_id}") from error

    def distance(self, from_node: str, to_node: str) -> float | None:
        """Return the direct edge distance, or None when no edge exists."""
        return self.neighbors(from_node).get(to_node)

    def has_node(self, node_id: str) -> bool:
        return node_id in self._adjacency
