import unittest

from app.algorithms.distances import distances_from
from app.algorithms.dijkstra import NoPathError
from app.graph import WarehouseGraph
from app.graph_models import WarehouseEdge, WarehouseMap, WarehouseNode


class PickupDistanceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.graph = WarehouseGraph(
            WarehouseMap(
                [WarehouseNode(node_id) for node_id in ("entrance", "crossing", "rack-a", "rack-b")],
                [
                    WarehouseEdge("entrance", "crossing", 2),
                    WarehouseEdge("crossing", "rack-a", 3),
                    WarehouseEdge("crossing", "rack-b", 5),
                ],
            )
        )

    def test_calculates_start_to_each_product_location(self) -> None:
        self.assertEqual(
            distances_from(self.graph, "entrance", ["rack-a", "rack-b"]),
            {"rack-a": 5, "rack-b": 7},
        )

    def test_returns_zero_for_start_location(self) -> None:
        self.assertEqual(distances_from(self.graph, "entrance", ["entrance"]), {"entrance": 0})

    def test_disconnected_location_raises(self) -> None:
        graph = WarehouseGraph(WarehouseMap([WarehouseNode("entrance"), WarehouseNode("rack")], []))
        with self.assertRaises(NoPathError):
            distances_from(graph, "entrance", ["rack"])


if __name__ == "__main__":
    unittest.main()
