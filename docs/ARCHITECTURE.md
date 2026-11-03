# Arquitetura

O SmartPick é composto por quatro serviços:

- `apps/web`: frontend Vue 3 que consome somente a API pública.
- `services/api`: API Node.js/Fastify, responsável pelas regras de negócio e pela persistência futura via Prisma.
- `services/engine`: motor FastAPI para os cálculos de grafo e rotas; não acessa o banco no fluxo normal.
- `db`: PostgreSQL, fonte oficial dos dados persistentes.

O fluxo previsto é `web → api → engine` e `api → db`.

## Execução atual: localhost

A branch `localhost` é a referência de integração do MVP. Os componentes são executados nativamente, no mesmo computador, sem Docker, Cloudflare ou serviços externos:

| Componente | Endereço local | Observação |
| --- | --- | --- |
| Frontend | `http://127.0.0.1:5173` | Vite/Vue |
| API | `http://127.0.0.1:3000` | Fastify; por padrão escuta somente no localhost |
| Motor | `http://127.0.0.1:8000` | FastAPI; chamado pela API por `ENGINE_URL` |
| PostgreSQL | `127.0.0.1:5432` | Será consumido pela API após a implementação do Prisma |

No desenvolvimento local, `ENGINE_URL` deve ser `http://127.0.0.1:8000`. A configuração de rede interna do Compose (`http://engine:8000`) fica isolada no próprio `compose.yaml` para uma futura fase de implantação.

## Estado da fundação

Nesta etapa, a API expõe saúde e o repositório já contém o schema Prisma, a primeira migração PostgreSQL e a seed de demonstração. As rotas públicas de produtos e pedidos, o cálculo completo e a integração da API com o motor ainda serão implementados incrementalmente.

## Decisões de domínio aprováveis para a próxima etapa

- O [modelo do armazém](WAREHOUSE_MODEL.md) define nós, conexões dirigidas, coordenadas em metros, origem (`ENTRY`) e destino (`EXIT`). Ele é a referência comum do banco, motor e mapa 2D.
- O [modelo de dados](DATA_MODEL.md) define entidades, cardinalidades, estados e invariantes do MVP. A issue #6 o converteu em `services/api/prisma/schema.prisma` e na migração inicial; a API ainda precisa passar a usá-lo nos casos de uso de negócio.
- A API continua responsável por montar um grafo validado a partir do banco e por validar a rota devolvida pelo motor. O navegador não cria conexões, e o motor não acessa o banco no fluxo normal.
