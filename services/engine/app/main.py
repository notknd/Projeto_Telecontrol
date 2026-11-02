from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel

from app.products import DuplicateSkuError, Product, ProductCreate, ProductStore, build_product_store


class HealthResponse(BaseModel):
    status: str
    service: str


app = FastAPI(title="SmartPick Route Engine", version="0.1.0")


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="engine")


def register_product_routes(application: FastAPI, store: ProductStore) -> None:
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


register_product_routes(app, build_product_store())
