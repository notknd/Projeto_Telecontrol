# Acompanhamento do projeto — SmartPick

**Atualizado em:** 8 de novembro de 2026
**Branch de integração:** `main` (`b3abb5d`)
**Status geral:** infraestrutura, persistência, grafo, cálculo de rota e a integração API → motor estão disponíveis. O MVP ainda não possui a interface de seleção/exibição de rota nem o fluxo de coleta ponta a ponta.

## Como este documento interpreta o progresso

Uma issue fechada no GitHub só é tratada como entrega integrada quando o commit correspondente é alcançável a partir de `main`. Uma branch aberta, mesmo pronta para revisão, é registrada como pendente de integração.

## Entregas integradas em `main`

| Issue/entrega | Estado | Evidência técnica |
| --- | --- | --- |
| #1 — fundação do repositório | Concluída | Estrutura para Vue, Fastify, FastAPI, PostgreSQL e health checks. |
| #2 e #4 — modelos de armazém e dados | Concluídas | PR #53; `docs/WAREHOUSE_MODEL.md` e `docs/DATA_MODEL.md`. |
| #3 — grafo inicial do armazém | Concluída | PR #54; commit `c9011e6`. |
| #6 — schema Prisma e primeira migração | Concluída | PR #55; schema, migração versionada e integridade de banco. |
| #7 — seed idempotente | Concluída | PR #55; 7 nós, 12 arestas, 3 produtos e 3 pedidos. |
| #8 e #15 — grafo executável e Dijkstra | Concluídas | PR #57; representação do grafo, Dijkstra e testes automatizados. |
| #22 — cálculo de rota de pedido persistido | Implementação integrada; issue ainda aberta | PR #58; `POST /api/v1/routes/calculate` consulta pedido, posições e grafo no Prisma e chama o motor. |
| #49 — contrato API ↔ motor | Implementado tecnicamente; issue ainda aberta | PR #58; `docs/API.md`, contratos TypeScript e endpoint interno versionado. |
| #50 — cliente resiliente do motor | Implementado em `main` | PR #58 inclui cliente, timeout, validação da resposta, mapeamento de erros e testes. |
| Execução local e demonstração técnica | Concluída | Compose aplica migração/seed e `scripts/test-compose.ps1` valida o conjunto. |

### Evidência reproduzível das issues #6 e #7

`docker compose up --build -d` inicia PostgreSQL, motor, API e frontend. Em seguida, `./scripts/test-compose.ps1` confirmou a saúde dos serviços, o histórico Prisma e uma segunda execução da seed com resultado estável `7|12|3|3` (nós, arestas, produtos e pedidos).

## Trabalho pronto para revisão, mas fora de `main`

| Issue | Branch/commit observado | Situação para o MVP |
| --- | --- | --- |
| #20 — API de produtos; apoio a #10 e #12 | `codex/issue-20-products-api`, commit `73e9c20` | Implementa `POST` e consultas de produtos na API Fastify usando Prisma, com vínculo a posição ativa, validações e testes. Aguardar revisão e merge. |
| #35 — cenários de pedidos para rota | `codex/issue-35-order-scenarios`, commit `f381735` | O teste original não está em `main`; revisar/reaplicar os cenários sobre a base atual. |

## O que funciona hoje

- `http://127.0.0.1:5173`: frontend Vue servido localmente; ainda é a fundação visual.
- `http://127.0.0.1:3000/health`: health check da API Fastify.
- `POST http://127.0.0.1:3000/api/v1/routes/calculate`: calcula a rota de um pedido persistido pelo seu `orderId`.
- `http://127.0.0.1:8000/health` e `/docs`: health check e documentação do motor FastAPI.
- PostgreSQL local via Compose, com migração Prisma, massa de demonstração reproduzível e pedidos `DEMO-SHORT` e `DEMO-MULTI-STOP`.

Ainda faltam CRUD público completo de produtos e pedidos integrado em `main`, seleção de pedido, mapa 2D, exibição da rota, execução da coleta, histórico e comparação de rotas. Assim, a demonstração atual comprova infraestrutura e cálculo via API, mas não um fluxo visual ponta a ponta.

## Próxima sequência técnica recomendada

1. Revisar e integrar a API de produtos (#20; também cobre parte de #10 e #12).
2. Validar localmente os pedidos seedados no endpoint de rota e fechar/reconciliar as issues #22, #49 e #50 com as PRs já integradas.
3. Implementar criação e consulta de pedidos pela API/Prisma (#11, #13 e #21).
4. Construir seleção de pedido, mapa 2D e exibição da rota no frontend (#26 a #28).
5. Reaplicar os cenários #35 e concluir teste ponta a ponta, coleta, histórico e comparação de rotas.

Consulte `DEVELOPMENT.md` para o procedimento de atualização e teste local e `IMPLEMENTATION_PLAN.md` para a ordem de implementação.
