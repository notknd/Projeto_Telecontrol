# Acompanhamento do projeto — SmartPick

**Atualizado em:** 3 de novembro de 2026
**Branch de integração:** `main` (`841d683`)
**Status geral:** fundação, modelagem, persistência inicial e execução local integrada estão concluídas. O MVP ainda não possui o fluxo de negócio ponta a ponta.

## Como este documento interpreta o progresso

Uma issue fechada no GitHub só é tratada como entrega integrada quando o commit correspondente é alcançável a partir de `main`. Uma branch aberta, ou uma issue fechada sem merge, é registrada como trabalho pendente de reconciliação; ela não é apresentada como funcionalidade disponível no MVP.

## Entregas integradas em `main`

| Issue/entrega | Estado | Evidência técnica |
| --- | --- | --- |
| #1 — fundação do repositório | Concluída | Estrutura para Vue, Fastify, FastAPI, PostgreSQL e health checks. |
| #2 e #4 — modelos de armazém e dados | Concluídas | PR #53; `docs/WAREHOUSE_MODEL.md` e `docs/DATA_MODEL.md`. |
| #3 — grafo inicial do armazém | Concluída | PR #54; commit `c9011e6`. |
| Cadastro temporário de produtos | Integrado como transição | Commit `79e57a8`; endpoint do motor persiste em JSON e não substitui a API/Prisma. |
| #6 — schema Prisma e primeira migração | Concluída | PR #55; schema, migração versionada e integridade de banco. |
| #7 — seed idempotente | Concluída | PR #55; 7 nós, 12 arestas, 3 produtos e 3 pedidos. |
| Execução local e demonstração técnica | Concluída | PR #55; Compose aplica migração/seed e `scripts/test-compose.ps1` valida o conjunto. |

### Evidência reproduzível das issues #6 e #7

`docker compose up --build -d` inicia PostgreSQL, motor, API e frontend. Em seguida, `./scripts/test-compose.ps1` confirmou a saúde dos serviços, o histórico Prisma e uma segunda execução da seed com resultado estável `7|12|3|3` (nós, arestas, produtos e pedidos). As issues #6 e #7 foram fechadas automaticamente pelo merge da PR #55.

## Trabalho fora de `main` que requer reconciliação

| Issue | Estado no GitHub | Branch/commit observado | Situação para o MVP |
| --- | --- | --- | --- |
| #8 e #15 — grafo executável e Dijkstra | Abertas | `codex/issue-15-dijkstra-shortest-path-updated`, commits `b62cced` e `f19fdfc` | Implementação e testes existem, mas não foram mesclados; revisar e atualizar contra `main`. |
| #35 — cenários de pedidos para rota | Fechada | `codex/issue-35-order-scenarios`, commit `f381735` | O teste não está em `main`; reabrir ou documentar a integração antes de considerá-lo entregue. |
| #49 — contrato API ↔ motor | Aberta | `issue-49-route-contract`, commit `a760293` | A branch não possui ancestral comum com `main`; o contrato deve ser reconstruído/reaplicado sobre a base atual. |
| #50 — cliente resiliente do motor | Fechada | `issue-50-engine-api-client`, commit `548bbf1` | O código não está em `main` e parte de base antiga; revisar, rebasear e integrar antes de marcar como disponível. |

Outras issues fechadas de organização/documentação (#39, #42, #45 e #48) não possuem evidência de entrega funcional adicional na árvore atual de `main`; devem ser auditadas antes de servir como marco técnico.

## O que funciona hoje

- `http://127.0.0.1:5173`: frontend Vue servido localmente; ainda é a fundação visual.
- `http://127.0.0.1:3000/health`: health check da API Fastify.
- `http://127.0.0.1:8000/health` e `/docs`: health check e documentação do motor FastAPI.
- PostgreSQL local via Compose, com migração Prisma e massa de demonstração reproduzível.

Ainda não existe, em `main`, CRUD público de produtos/pedidos persistido em Prisma, cálculo de rota exposto pela API Node, mapa 2D ou fluxo de coleta. Portanto, a demonstração atual comprova infraestrutura e dados, não a otimização de pedidos ponta a ponta.

## Próxima sequência técnica recomendada

1. Reconciliar a implementação de grafo/Dijkstra (#8 e #15) e os cenários #35 com a `main` atual.
2. Definir o contrato interno de rota #49 diretamente sobre `main` e validá-lo com o responsável pelo motor.
3. Implementar produtos, posições e pedidos na API Node/Prisma (issues #10 a #13 e #20 a #21), substituindo o cadastro JSON temporário do motor.
4. Reaplicar o cliente resiliente #50 sobre a base atual e integrar API → motor com testes de sucesso, timeout e falha.
5. Expor cálculo de rota, depois construir dashboard, pedido, mapa, coleta, histórico e comparação de rotas no frontend.

Consulte `DEVELOPMENT.md` para o procedimento de atualização e teste local e `IMPLEMENTATION_PLAN.md` para a ordem de implementação.
