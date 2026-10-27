# SmartPick — Projeto Telecontrol

Aplicação para otimizar rotas de coleta de produtos em armazéns. A arquitetura usa Vue 3 no frontend, Fastify no backend principal, FastAPI no motor de rotas e PostgreSQL para persistência.

## Estado atual

Esta primeira entrega estabelece a fundação dos serviços. Ainda não há CRUD, banco modelado ou cálculo de rotas; eles serão implementados incrementalmente.

## Ambiente da equipe

Enquanto o MVP estiver em desenvolvimento, a branch de integração e execução é **`localhost`**. O fluxo padrão é nativo e inteiramente local: navegador, API e motor rodam em `127.0.0.1`; PostgreSQL também deve estar instalado localmente quando o schema for adicionado. Docker Compose e qualquer túnel/Cloudflare ficam fora do fluxo atual e só serão tratados depois de o MVP estar funcional.

Consulte o [guia de desenvolvimento](docs/DEVELOPMENT.md) para a instalação, execução, verificações e fluxo de trabalho no app ChatGPT para PC.

## Execução local

```powershell
git switch localhost
Copy-Item .env.example .env
.\scripts\start-local.ps1
```

O script abre três terminais locais para API, motor e frontend. Em seguida, confira:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
Invoke-RestMethod http://127.0.0.1:8000/health
Start-Process http://127.0.0.1:5173
```

Use `.\scripts\test-local.ps1` para executar a suíte nativa antes de abrir um pull request.

## Docker e publicação

`compose.yaml` permanece no repositório como material de implantação futura. Não é requisito, nem deve ser usado como dependência de desenvolvimento, testes ou demonstração do MVP atual. Cloudflare não faz parte da arquitetura nem do fluxo desta branch.

Consulte [a arquitetura](docs/ARCHITECTURE.md), [os contratos](docs/API.md) e [o plano](docs/IMPLEMENTATION_PLAN.md) antes de iniciar a próxima etapa.
