from fastapi import FastAPI, HTTPException, Response, status
from pydantic import BaseModel

from app.products import (
    DuplicateSkuError,
    Product,
    ProductCreate,
    ProductNotFoundError,
    ProductStore,
    ProductUpdate,
    build_product_store,
)


class HealthResponse(BaseModel):
    status: str
    service: str


app = FastAPI(title="SmartPick Route Engine", version="0.1.0")


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="engine")


def register_product_routes(application: FastAPI, store: ProductStore) -> None:
    @application.get("/api/v1/products", response_model=list[Product])
    def list_products() -> list[Product]:
        return store.list_all()

    @application.get("/api/v1/products/{sku}", response_model=Product)
    def get_product(sku: str) -> Product:
        try:
            return store.get_by_sku(sku)
        except ProductNotFoundError as error:
            raise HTTPException(status_code=404, detail="Produto não encontrado.") from error

    @application.post(
        "/api/v1/products",
        response_model=Product,
        status_code=status.HTTP_201_CREATED,
    )
    def create_product(product_data: ProductCreate) -> Product:
        try:
            return store.create(product_data)
        except DuplicateSkuError as error:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Já existe um produto com este SKU.",
            ) from error

    @application.put("/api/v1/products/{sku}", response_model=Product)
    def update_product(sku: str, product_data: ProductUpdate) -> Product:
        if not product_data.model_fields_set:
            raise HTTPException(status_code=422, detail="Informe ao menos um campo para atualizar.")
        try:
            return store.update(sku, product_data)
        except ProductNotFoundError as error:
            raise HTTPException(status_code=404, detail="Produto não encontrado.") from error

    @application.delete("/api/v1/products/{sku}", status_code=status.HTTP_204_NO_CONTENT)
    def deactivate_product(sku: str) -> Response:
        try:
            store.deactivate(sku)
        except ProductNotFoundError as error:
            raise HTTPException(status_code=404, detail="Produto não encontrado.") from error
        return Response(status_code=status.HTTP_204_NO_CONTENT)


register_product_routes(app, build_product_store())
