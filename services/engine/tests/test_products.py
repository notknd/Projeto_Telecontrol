from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import register_product_routes
from app.products import ProductStore


def build_test_client(tmp_path) -> TestClient:
    app = FastAPI()
    register_product_routes(app, ProductStore(tmp_path / "products.json"))
    return TestClient(app)


def test_registers_a_product(tmp_path) -> None:
    client = build_test_client(tmp_path)

    response = client.post(
        "/api/v1/products",
        json={
            "sku": " cx-01 ",
            "name": " Caixa organizadora ",
            "stock_quantity": 12,
            "location": " A-01-02 ",
            "weight_kg": 1.5,
            "category": " Organização ",
        },
    )

    assert response.status_code == 201
    product = response.json()
    assert product["sku"] == "CX-01"
    assert product["name"] == "Caixa organizadora"
    assert product["location"] == "A-01-02"
    assert product["is_active"] is True
    assert product["id"]


def test_lists_products_in_sku_order(tmp_path) -> None:
    client = build_test_client(tmp_path)

    assert client.get("/api/v1/products").json() == []
    for sku in ("CX-02", "CX-01"):
        response = client.post(
            "/api/v1/products",
            json={
                "sku": sku,
                "name": f"Produto {sku}",
                "stock_quantity": 1,
                "location": "A-01-01",
                "weight_kg": 0.5,
            },
        )
        assert response.status_code == 201

    response = client.get("/api/v1/products")

    assert response.status_code == 200
    assert [product["sku"] for product in response.json()] == ["CX-01", "CX-02"]


def test_gets_updates_and_deactivates_a_product(tmp_path) -> None:
    client = build_test_client(tmp_path)
    product = {
        "sku": "CX-01",
        "name": "Caixa organizadora",
        "stock_quantity": 12,
        "location": "A-01-02",
        "weight_kg": 1.5,
    }
    assert client.post("/api/v1/products", json=product).status_code == 201

    response = client.get("/api/v1/products/cx-01")
    assert response.status_code == 200
    assert response.json()["sku"] == "CX-01"

    response = client.put(
        "/api/v1/products/CX-01",
        json={"stock_quantity": 7, "location": "B-02-01"},
    )
    assert response.status_code == 200
    assert response.json()["stock_quantity"] == 7
    assert response.json()["location"] == "B-02-01"

    response = client.delete("/api/v1/products/CX-01")
    assert response.status_code == 204
    assert client.get("/api/v1/products/CX-01").json()["is_active"] is False


def test_returns_not_found_for_an_unknown_sku(tmp_path) -> None:
    client = build_test_client(tmp_path)

    response = client.get("/api/v1/products/UNKNOWN")

    assert response.status_code == 404
    assert response.json() == {"detail": "Produto não encontrado."}


def test_rejects_a_repeated_sku(tmp_path) -> None:
    client = build_test_client(tmp_path)
    product = {
        "sku": "CX-01",
        "name": "Caixa organizadora",
        "stock_quantity": 12,
        "location": "A-01-02",
        "weight_kg": 1.5,
    }

    assert client.post("/api/v1/products", json=product).status_code == 201
    response = client.post("/api/v1/products", json=product)

    assert response.status_code == 409
    assert response.json() == {"detail": "Já existe um produto com este SKU."}


def test_rejects_invalid_product_data(tmp_path) -> None:
    client = build_test_client(tmp_path)

    response = client.post(
        "/api/v1/products",
        json={
            "sku": "",
            "name": "Caixa organizadora",
            "stock_quantity": -1,
            "location": "A-01-02",
            "weight_kg": -0.5,
        },
    )

    assert response.status_code == 422
