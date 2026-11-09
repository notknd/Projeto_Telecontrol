"""Cadastro temporário de produtos.

Enquanto o banco de dados do projeto não está disponível, os produtos ficam em
um arquivo JSON local. As regras de validação deste módulo poderão ser
reutilizadas quando a persistência for migrada para PostgreSQL/Prisma.
"""

from __future__ import annotations

import json
import os
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator


class ProductCreate(BaseModel):
    sku: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=120)
    stock_quantity: int = Field(ge=0)
    location: str = Field(min_length=1, max_length=80)
    weight_kg: float = Field(ge=0)
    category: str | None = Field(default=None, max_length=80)

    @field_validator("sku", "name", "location", "category", mode="before")
    @classmethod
    def remove_extra_spaces(cls, value: str | None) -> str | None:
        if value is None:
            return None
        clean_value = value.strip()
        if not clean_value:
            raise ValueError("não pode ficar vazio")
        return clean_value

    @field_validator("sku")
    @classmethod
    def normalize_sku(cls, value: str) -> str:
        return value.upper()


class Product(ProductCreate):
    id: str
    is_active: bool
    created_at: datetime


class DuplicateSkuError(Exception):
    """Gerado ao tentar cadastrar um SKU já existente."""


class ProductStore:
    """Pequeno repositório JSON utilizado até que a migração para o banco de dados esteja disponível."""

    def __init__(self, file_path: Path) -> None:
        self.file_path = file_path
        self.lock = Lock()

    def create(self, product_data: ProductCreate) -> Product:
        with self.lock:
            products = self._read_products()
            if any(product["sku"] == product_data.sku for product in products):
                raise DuplicateSkuError

            product = Product(
                id=str(uuid4()),
                is_active=True,
                created_at=datetime.now(UTC),
                **product_data.model_dump(),
            )
            products.append(product.model_dump(mode="json"))
            self._write_products(products)
            return product

    def _read_products(self) -> list[dict[str, object]]:
        if not self.file_path.exists():
            return []
        return json.loads(self.file_path.read_text(encoding="utf-8"))

    def _write_products(self, products: list[dict[str, object]]) -> None:
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        temporary_file = self.file_path.with_suffix(".tmp")
        temporary_file.write_text(
            json.dumps(products, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        temporary_file.replace(self.file_path)


def build_product_store() -> ProductStore:
    """Cria o armazenamento usando um caminho opcional configurado pelo ambiente."""
    file_name = os.environ.get("PRODUCTS_FILE_PATH", "data/products.json")
    return ProductStore(Path(file_name))
