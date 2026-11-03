# SmartPick — Projeto Telecontrol

Aplicação para otimizar rotas de coleta de produtos em armazéns. A arquitetura usa Vue 3 no frontend, Fastify no backend principal, FastAPI no motor de rotas e PostgreSQL para persistência.

## Estado atual

A fundação dos serviços, a modelagem do domínio e a primeira persistência do MVP estão disponíveis. O backend possui schema Prisma, migração PostgreSQL versionada e seed de demonstração; CRUD completo, cálculo de rotas e telas de coleta continuam nas próximas etapas.

## Ambiente da equipe

Enquanto o MVP estiver em desenvolvimento, a branch de integração e execução é **`main`**. A prioridade é executar tudo localmente. O caminho mais simples é Docker Compose: ele cria PostgreSQL, motor, API e frontend no mesmo computador e aplica a migração e a seed de demonstração automaticamente.

Consulte o [guia de desenvolvimento](docs/DEVELOPMENT.md) para a instalação, execução, verificações e fluxo de trabalho no app ChatGPT para PC.

## Execução local

```powershell
git switch main
docker compose up --build -d
```

Em seguida, confira:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
Invoke-RestMethod http://127.0.0.1:8000/health
Start-Process http://127.0.0.1:5173
```

Abra `http://127.0.0.1:5173` no navegador. Use `docker compose down` para parar o ambiente. O fluxo nativo com `.\scripts\start-local.ps1` continua disponível para depuração; para ele, copie `.env.example` para `.env` e prepare o PostgreSQL local.

Use `.\scripts\test-local.ps1` para executar a suíte nativa antes de abrir um pull request.

Para validar a composição Docker já em execução, incluindo saúde dos quatro serviços, migração Prisma e seed idempotente, use:

```powershell
.\scripts\test-compose.ps1
```

Acrescente `-Build` para reconstruir as imagens antes da verificação.

## Docker e publicação

`compose.yaml` é a forma reproduzível de executar o MVP local completo. Cloudflare não faz parte da arquitetura nem do fluxo desta branch.

Consulte [a arquitetura](docs/ARCHITECTURE.md), [os contratos](docs/API.md) e [o plano](docs/IMPLEMENTATION_PLAN.md) antes de iniciar a próxima etapa.
