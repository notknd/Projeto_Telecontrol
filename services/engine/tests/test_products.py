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
            "sku": " tc-01 ",
            "name": " Teclado Gamer ",
            "stock_quantity": 12,
            "location": " A-01-02 ",
            "weight_kg": 1.5,
            "category": " Periféricos ",
        },
    )

    assert response.status_code == 201
    product = response.json()
    assert product["sku"] == "TC-01"
    assert product["name"] == "Teclado Gamer"
    assert product["location"] == "A-01-02"
    assert product["is_active"] is True
    assert product["id"]


def test_rejects_a_repeated_sku(tmp_path) -> None:
    client = build_test_client(tmp_path)
    product = {
        "sku": "TC-01",
        "name": "Teclado Gamer",
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
            "name": "Teclado Gamer",
            "stock_quantity": -1,
            "location": "A-01-02",
            "weight_kg": -0.5,
        },
    )

    assert response.status_code == 422
