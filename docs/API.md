# Contratos de API

## Saúde da API principal

`GET /health`

Durante o desenvolvimento local: `http://127.0.0.1:3000/health`.

Resposta de sucesso (`200`):

```json
{"status":"ok","service":"api"}
```

## Saúde do motor interno

`GET /health`

Durante o desenvolvimento local: `http://127.0.0.1:8000/health`.

Resposta de sucesso (`200`):

```json
{"status":"ok","service":"engine"}
```

O contrato público de negócio, sob `/api/v1`, será adicionado antes do CRUD e permanecerá separado do contrato interno de cálculo.

## Cadastro temporário de produtos

`POST /api/v1/products`

Enquanto a migração do banco não está disponível, este endpoint persiste os
produtos em um arquivo JSON local. A variável `PRODUCTS_FILE_PATH` permite
escolher outro caminho; o padrão é `data/products.json`.

Exemplo de requisição:

```json
{
  "sku": "CX-01",
  "name": "Caixa organizadora",
  "stock_quantity": 12,
  "location": "A-01-02",
  "weight_kg": 1.5,
  "category": "Organização"
}
```

Resposta de sucesso (`201`): inclui os dados enviados, `id`, `is_active` e
`created_at`. O SKU é convertido para maiúsculas e não pode ser repetido.

Erros:

- `422`: campo ausente, vazio, ou quantidade/peso negativo;
- `409`: SKU já cadastrado.

### Consulta de produtos

`GET /api/v1/products`

Retorna todos os produtos cadastrados temporariamente, ordenados pelo SKU. A
resposta de sucesso é `200` com uma lista JSON; se não houver produtos, a lista
será vazia (`[]`).

### Consulta por SKU, atualização e desativação

- `GET /api/v1/products/{sku}`: retorna um produto pelo SKU (`200`) ou `404`
  quando não existir.
- `PUT /api/v1/products/{sku}`: atualiza um ou mais destes campos: `name`,
  `stock_quantity`, `location`, `weight_kg` e `category`. O SKU não é alterado.
  Retorna o produto atualizado (`200`), `404` se não existir ou `422` para dados
  inválidos.
- `DELETE /api/v1/products/{sku}`: desativa logicamente o produto e retorna
  `204`. O registro não é apagado, preservando o histórico para os próximos
  módulos de pedidos e coleta.
