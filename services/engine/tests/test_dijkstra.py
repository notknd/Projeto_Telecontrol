import unittest

from app.algorithms.dijkstra import NoPathError, dijkstra
from app.graph import WarehouseGraph
from app.graph_models import WarehouseEdge, WarehouseMap, WarehouseNode


def graph_with(nodes: list[str], edges: list[tuple[str, str, float]]) -> WarehouseGraph:
    return WarehouseGraph(
        WarehouseMap(
            [WarehouseNode(node_id) for node_id in nodes],
            [WarehouseEdge(source, target, distance) for source, target, distance in edges],
        )
    )


class DijkstraTests(unittest.TestCase):
    def test_finds_shortest_path_instead_of_direct_longer_edge(self) -> None:
        graph = graph_with(
            ["entrance", "a", "b", "rack"],
            [("entrance", "rack", 10), ("entrance", "a", 2), ("a", "b", 3), ("b", "rack", 1)],
        )

        result = dijkstra(graph, "entrance", "rack")

        self.assertEqual(result.node_ids, ("entrance", "a", "b", "rack"))
        self.assertEqual(result.distance, 6)

    def test_returns_zero_distance_for_same_start_and_destination(self) -> None:
        result = dijkstra(graph_with(["entrance"], []), "entrance", "entrance")

        self.assertEqual(result.node_ids, ("entrance",))
        self.assertEqual(result.distance, 0)

    def test_supports_zero_weight_edges(self) -> None:
        result = dijkstra(graph_with(["a", "b", "c"], [("a", "b", 0), ("b", "c", 2)]), "a", "c")

        self.assertEqual(result.node_ids, ("a", "b", "c"))
        self.assertEqual(result.distance, 2)

    def test_reports_disconnected_nodes(self) -> None:
        with self.assertRaises(NoPathError):
            dijkstra(graph_with(["a", "b"], []), "a", "b")

    def test_rejects_unknown_start_or_destination(self) -> None:
        graph = graph_with(["a"], [])
        with self.assertRaisesRegex(KeyError, "Unknown warehouse node"):
            dijkstra(graph, "missing", "a")
        with self.assertRaisesRegex(KeyError, "Unknown warehouse node"):
            dijkstra(graph, "a", "missing")


if __name__ == "__main__":
    unittest.main()
