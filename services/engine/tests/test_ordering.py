import unittest

from app.algorithms.dijkstra import NoPathError
from app.algorithms.ordering import nearest_neighbor_order
from app.graph import WarehouseGraph
from app.graph_models import WarehouseEdge, WarehouseMap, WarehouseNode


class NearestNeighborTests(unittest.TestCase):
    def setUp(self) -> None:
        self.graph = WarehouseGraph(
            WarehouseMap(
                [WarehouseNode(node_id) for node_id in ("entrance", "a", "b", "c")],
                [
                    WarehouseEdge("entrance", "a", 2),
                    WarehouseEdge("a", "b", 1),
                    WarehouseEdge("b", "c", 2),
                ],
            )
        )

    def test_visits_nearest_remaining_location(self) -> None:
        self.assertEqual(
            nearest_neighbor_order(self.graph, "entrance", ["c", "b", "a"]),
            ("a", "b", "c"),
        )

    def test_keeps_input_order_for_equal_distances(self) -> None:
        graph = WarehouseGraph(
            WarehouseMap(
                [WarehouseNode("entrance"), WarehouseNode("left"), WarehouseNode("right")],
                [WarehouseEdge("entrance", "left", 1), WarehouseEdge("entrance", "right", 1)],
            )
        )
        self.assertEqual(nearest_neighbor_order(graph, "entrance", ["right", "left"]), ("right", "left"))

    def test_removes_duplicate_locations(self) -> None:
        self.assertEqual(nearest_neighbor_order(self.graph, "entrance", ["a", "a", "b"]), ("a", "b"))

    def test_empty_input_returns_empty_order(self) -> None:
        self.assertEqual(nearest_neighbor_order(self.graph, "entrance", []), ())

    def test_unreachable_location_raises(self) -> None:
        graph = WarehouseGraph(WarehouseMap([WarehouseNode("entrance"), WarehouseNode("rack")], []))
        with self.assertRaises(NoPathError):
            nearest_neighbor_order(graph, "entrance", ["rack"])


if __name__ == "__main__":
    unittest.main()
