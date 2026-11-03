import unittest

from app.algorithms.route import generate_route
from app.graph import WarehouseGraph
from app.graph_models import WarehouseEdge, WarehouseMap, WarehouseNode


class OrderScenarioTests(unittest.TestCase):
    def setUp(self) -> None:
        self.graph = WarehouseGraph(
            WarehouseMap(
                [WarehouseNode(node_id) for node_id in ("entrada", "corredor", "A", "B", "C")],
                [
                    WarehouseEdge("entrada", "corredor", 2),
                    WarehouseEdge("corredor", "A", 2),
                    WarehouseEdge("corredor", "B", 3),
                    WarehouseEdge("B", "C", 1),
                ],
            )
        )

    def test_pedido_vazio_permanece_na_entrada(self) -> None:
        rota = generate_route(self.graph, "entrada", [])

        self.assertEqual(rota.path_node_ids, ("entrada",))
        self.assertEqual(rota.total_distance, 0)

    def test_pedido_com_um_produto_usa_um_caminho_valido(self) -> None:
        rota = generate_route(self.graph, "entrada", ["A"])

        self.assertEqual(rota.path_node_ids, ("entrada", "corredor", "A"))
        self.assertEqual(rota.total_distance, 4)
        self.assertEqual([(stop.node_id, stop.sequence) for stop in rota.stops], [("A", 1)])

    def test_pedido_com_varios_produtos_visita_todos(self) -> None:
        rota = generate_route(self.graph, "entrada", ["C", "A", "B"])

        self.assertEqual([stop.node_id for stop in rota.stops], ["A", "B", "C"])
        self.assertEqual({stop.node_id for stop in rota.stops}, {"A", "B", "C"})
        self.assertEqual(rota.path_node_ids, ("entrada", "corredor", "A", "corredor", "B", "C"))
        self.assertEqual(rota.total_distance, 10)

    def test_pedido_com_repeticao_nao_repete_a_parada(self) -> None:
        rota = generate_route(self.graph, "entrada", ["A", "A", "B"])

        self.assertEqual([stop.node_id for stop in rota.stops], ["A", "B"])
        self.assertEqual(len(rota.stops), 2)

    def test_retorno_a_entrada_mantem_rota_conectada(self) -> None:
        rota = generate_route(self.graph, "entrada", ["A", "B"], end_node_id="entrada")

        self.assertEqual(rota.path_node_ids[-1], "entrada")
        self.assertEqual(rota.total_distance, 14)
        for from_node, to_node in zip(rota.path_node_ids, rota.path_node_ids[1:]):
            self.assertIsNotNone(self.graph.distance(from_node, to_node))


if __name__ == "__main__":
    unittest.main()
