# Arquitetura

O SmartPick é composto por quatro serviços:

- `apps/web`: frontend Vue 3 que consome somente a API pública.
- `services/api`: API Node.js/Fastify, responsável pelas regras de negócio e pela persistência futura via Prisma.
- `services/engine`: motor FastAPI para os cálculos de grafo e rotas; não acessa o banco no fluxo normal.
- `db`: PostgreSQL, fonte oficial dos dados persistentes.

O fluxo previsto é `web → api → engine` e `api → db`. O motor não publica portas no host pelo Compose; a API o acessará por `http://engine:8000` na rede interna.

## Estado da fundação

API e motor ainda expõem somente endpoints de saúde. A API já possui um cliente HTTP configurável para o contrato interno de cálculo, com validação da resposta e tratamento de timeout e indisponibilidade. O endpoint de cálculo no FastAPI e o fluxo de pedidos/rotas ainda não foram implementados; portanto, a chamada ainda não está ligada a uma rota de negócio nem a persistência.
