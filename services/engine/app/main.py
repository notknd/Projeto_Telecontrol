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


# Products remain available for compatibility; the web uses only the Node API.
from fastapi import Request
from fastapi.exceptions import RequestValidationError
from app.routes import RouteRequest, RouteResponse, RouteNotFound, route_for_request, error_response

@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, error: RequestValidationError):
    if request.url.path.startswith('/internal/'):
        return error_response(422, 'INVALID_ROUTE_REQUEST', 'A requisição de cálculo é inválida.')
    from fastapi.exception_handlers import request_validation_exception_handler
    return await request_validation_exception_handler(request, error)

@app.exception_handler(RouteNotFound)
async def route_not_found_handler(_: Request, __: RouteNotFound):
    return error_response(422, 'NO_ROUTE_FOUND', 'Não existe caminho válido entre os pontos solicitados.')

@app.post('/internal/v1/routes/calculate', response_model=RouteResponse)
def calculate_route(request: RouteRequest) -> RouteResponse:
    return route_for_request(request)
