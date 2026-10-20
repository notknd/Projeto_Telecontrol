# Contratos de API

## Saúde da API principal

`GET /health`

Resposta de sucesso (`200`):

```json
{"status":"ok","service":"api"}
```

## Saúde do motor interno

`GET /health`

Resposta de sucesso (`200`):

```json
{"status":"ok","service":"engine"}
```

O contrato público de negócio, sob `/api/v1`, será adicionado antes do CRUD e permanecerá separado do contrato interno de cálculo.
