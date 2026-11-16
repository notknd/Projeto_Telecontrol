# Plano de implementação

## Estado de referência — 03/11/2026

`main` é a fonte de verdade integrada. Ela já contém a fundação do repositório, os modelos de domínio, o grafo inicial, o schema Prisma, a primeira migração e a seed de demonstração. A PR #55 também tornou a execução local reproduzível com Docker Compose e testes automatizados.

O projeto ainda não implementa o fluxo do PRD `pedido → cálculo de rota → coleta → histórico`. A próxima etapa não é criar novas telas isoladas: é conectar dados persistidos, contrato de rota e motor de cálculo na ordem abaixo.

## Entregas concluídas

1. Estrutura inicial para Vue, Fastify, FastAPI e PostgreSQL, com health checks.
2. Modelagem do armazém e do domínio do MVP (issues #2 e #4).
3. Grafo inicial do armazém (issue #3).
4. Schema Prisma, migração PostgreSQL e seed idempotente (issues #6 e #7, PR #55).
5. Composição Docker local, teste integrado e roteiro de demonstração (PR #55).

## Pré-requisito de integração

Antes de reutilizar uma entrega de outra branch, atualize `main` e confirme que ela tem ancestral comum:

```powershell
git switch main
git pull --ff-only origin main
git merge-base main origin/NOME-DA-BRANCH
```

Se `git merge-base` não retornar um commit, não faça merge direto. Recrie ou aplique cuidadosamente a mudança sobre `main`, com revisão do contrato e dos testes. Isso se aplica à branch atual da issue #49. Issues fechadas sem commit em `main` também devem ser reabertas ou receber uma nova issue de integração.

## Próximas etapas, na ordem do PRD

1. **Motor e testes de rota:** revisar e integrar o grafo executável/Dijkstra das branches das issues #8 e #15; depois incorporar os cenários de #35. Validar caminhos inexistentes, pesos e distâncias.
2. **Contrato interno:** concluir #49 com `POST /internal/v1/routes/calculate`, exemplos, invariantes e erros. O contrato deve ser versionado na `main`, não apenas numa branch desconectada.
3. **Dados de negócio na API:** implementar produtos, posições e pedidos pela API Fastify usando Prisma (issues #10–#13 e #20–#21). O endpoint JSON temporário do motor não é a persistência final.
4. **Integração API → motor:** rebasear/revisar #50; aplicar timeout, validação de resposta e erros previsíveis. Em seguida, implementar o endpoint público de cálculo de rota (#22).
5. **Coleta e visualização:** implementar atualização e conclusão de coleta (#23, #31, #32, #33), dashboard/pedido/mapa/rota (#25–#28 e #30) e comparação de rota (#36).
6. **Validação do MVP:** executar o fluxo completo (#43), casos extremos (#37), correções (#38/#39) e a demonstração (#47).

Cada etapa deve preservar a execução local. Antes de abrir PR, execute `./scripts/test-local.ps1`; quando a alteração envolver banco, Compose ou comunicação entre serviços, execute também `./scripts/test-compose.ps1`.
