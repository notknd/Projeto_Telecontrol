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

O contrato público de negócio, sob `/api/v1`, será adicionado antes do CRUD e permanecerá separado do contrato interno de cálculo. A proposta de contrato de rota da issue #49 ainda está fora de `main`; ela não deve ser tomada como endpoint disponível até ser reconstruída/revisada sobre a base atual e integrada.

## Cadastro temporário de produtos no motor

`POST /api/v1/products`

Este endpoint está implementado temporariamente no processo FastAPI do motor e
persiste os produtos em um arquivo JSON local. A variável `PRODUCTS_FILE_PATH`
permite escolher outro caminho; o padrão é `data/products.json`. Ele não é o
contrato final: a próxima etapa deve movê-lo para a API Node/Fastify e persistir
via Prisma, conforme o PRD.

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
