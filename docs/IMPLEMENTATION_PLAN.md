# Plano de implementação

## Auditoria inicial — 20/10/2026

- A branch `main` continha apenas um README mínimo e nenhum código executável.
- Não há dependências, modelo de dados, API ou documentação técnica existentes para reutilizar.
- Os issues abertos incluem a definição do modelo do armazém, do grafo e das entidades. Os documentos fornecidos pelo solicitante são a referência arquitetural atual.
- Não foram encontradas decisões de código mais recentes que conflitem com o PRD ou o guia.

## Entrega atual: Fase 1 — fundação

1. Estrutura inicial para Vue, Fastify, FastAPI e PostgreSQL.
2. Dockerfiles, Compose, variáveis de ambiente e verificações de saúde.
3. Documentação da arquitetura e dos contratos de saúde.

## Próxima etapa recomendada

As decisões de modelagem estão registradas em [WAREHOUSE_MODEL.md](WAREHOUSE_MODEL.md) e [DATA_MODEL.md](DATA_MODEL.md). A próxima implementação é converter esse modelo em schema Prisma, criar a migração e um seed repetível antes do CRUD.
