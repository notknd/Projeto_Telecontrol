"""Data structures for the warehouse map graph."""

from dataclasses import dataclass
from math import isfinite
from typing import Iterable


@dataclass(frozen=True, slots=True)
class WarehouseNode:
    """A stable warehouse location, optionally positioned on a 2D map."""

    id: str
    x: float | None = None
    y: float | None = None

    def __post_init__(self) -> None:
        if not self.id or not self.id.strip():
            raise ValueError("Node id must not be empty")
        for name, value in (("x", self.x), ("y", self.y)):
            if value is not None and not isfinite(value):
                raise ValueError(f"Node {name} coordinate must be finite")


@dataclass(frozen=True, slots=True)
class WarehouseEdge:
    """A walkable connection between two nodes, measured in meters."""

    from_node: str
    to_node: str
    distance: float

    def __post_init__(self) -> None:
        if not self.from_node or not self.from_node.strip():
            raise ValueError("Edge from_node must not be empty")
        if not self.to_node or not self.to_node.strip():
            raise ValueError("Edge to_node must not be empty")
        if not isfinite(self.distance) or self.distance < 0:
            raise ValueError("Edge distance must be a finite non-negative number")


@dataclass(frozen=True, slots=True)
class WarehouseMap:
    """Validated nodes and weighted connections for a warehouse."""

    nodes: tuple[WarehouseNode, ...]
    edges: tuple[WarehouseEdge, ...]

    def __init__(
        self,
        nodes: Iterable[WarehouseNode],
        edges: Iterable[WarehouseEdge],
    ) -> None:
        node_list = tuple(nodes)
        edge_list = tuple(edges)
        node_ids = [node.id for node in node_list]
        if len(node_ids) != len(set(node_ids)):
            raise ValueError("Warehouse node ids must be unique")

        known_nodes = set(node_ids)
        for edge in edge_list:
            missing = {edge.from_node, edge.to_node} - known_nodes
            if missing:
                raise ValueError(
                    "Edge references unknown node(s): " + ", ".join(sorted(missing))
                )

        object.__setattr__(self, "nodes", node_list)
        object.__setattr__(self, "edges", edge_list)
