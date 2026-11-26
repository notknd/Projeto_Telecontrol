# Primeira entrega de front-end — Leonardo

## Galpões e capacidade

O seletor de galpão atualiza dashboard, produtos, pedidos e planta em conjunto, limpando a seleção anterior. Há três galpões com 12 posições, 12 produtos e 12 pedidos iniciais cada. A planta possui visão geral e modo detalhado com rolagem.

A expansão exigiu duas migrações incrementais, vínculos persistidos de galpão e filtros na API. Não é apenas um filtro visual. A entrada por perfil continua sem autenticação ou permissões diferenciadas.

Verificação da expansão: compilação e tipagem; testes da interface com troca de galpão; testes de integração com PostgreSQL e motor real em banco descartável; cálculo em cada galpão; rejeição de pedidos com produtos de outro galpão; preservação dos estoques e registros anteriores. A carga foi repetida sem duplicar posições, produtos ou pedidos.

Atualização: 10/11/2026. Responsável: Leonardo (`Yuki-Hoshino-07`).

## Recorte adotado

O desenvolvimento do front-end está dividido em duas entregas. O recorte inicial contempla a Semana 06; a divisão permanece sujeita à revisão da equipe.

| Task / issue | Resultado nesta entrega |
| --- | --- |
| TASK 20 / [#25](https://github.com/notknd/Projeto_Telecontrol/issues/25) | Dashboard com pedidos pendentes, em coleta e concluídos, consultados na API. |
| TASK 21 / [#26](https://github.com/notknd/Projeto_Telecontrol/issues/26) | Busca, filtro, seleção de pedido existente e consulta de seus produtos e quantidades. |
| TASK 22 / [#27](https://github.com/notknd/Projeto_Telecontrol/issues/27) | Planta 2D com nós, corredores, endereços e produtos retornados pelo repositório. |
| TASK 23 / [#28](https://github.com/notknd/Projeto_Telecontrol/issues/28) | Solicitação à API existente e desenho da rota retornada, distância e sequência de paradas. |

As quatro issues estão atribuídas a Leonardo no GitHub e permanecem abertas para revisão.

## Reutilização e limites

`App.vue` abre `FirstDeliveryApp.vue`. Reutiliza CSS, fontes locais, ícones, cliente REST e `WarehouseMap.vue`; o mapa recebe `basic` para apresentar apenas os controles pertinentes à planta 2D. O componente completo mantém seu comportamento anterior quando essa propriedade não é passada.

A identidade visual do HTML foi mantida: paleta, tipografia, sidebar, cabeçalho, indicadores, tabelas e cartões. Os conteúdos e ações foram reduzidos conforme o escopo. O layout do armazém vem da API, não dos endereços fictícios do protótipo.

Não foram portados controle de permissões, banco em localStorage, algoritmos de rota no navegador, editor de armazém ou Three.js. Também não entram na interface inicial cadastro de produtos/pedidos, cancelamento, histórico, comparação convencional e perspectiva. Cadastro de pedido é diferente da seleção de pedido solicitada na TASK 21.

A entrada local permite informar o nome e escolher entre supervisão, operação, estoque e gestão. A seleção fica na sessão da aba e pode ser alterada no cabeçalho. Sair remove essa seleção. Não há senha, autenticação no servidor ou mudança de permissões: os perfis identificam a área de trabalho e mantêm as mesmas funções.

A planta mostra recebimento, expedição e prateleiras nas posições cadastradas, com produtos e estoque consultados na API. Os elementos físicos são esquemáticos, não uma medição do galpão. Ao abrir a planta, a rota fica oculta até ser ativada ou animada.

A carga inicial inclui os pedidos PED-004 a PED-011, com combinações dos três produtos existentes. A inclusão é repetível e não reinicia estoques nem altera o estado dos pedidos existentes.

O mapa inclui uma prévia animada do percurso recebido da API, com pausa, retomada, reinício, avanço por ponto e controle de progresso. A animação não registra coletas nem altera estoque. Com preferência por movimento reduzido, o avanço ocorre por pontos, sem animação contínua. Endereços, produtos e paradas podem ser selecionados para destaque na planta.

Os pedidos iniciais aparecem como PED-001, PED-002 e PED-003 na interface. Esses rótulos substituem os prefixos da massa inicial apenas na apresentação; os códigos persistidos e IDs enviados à API permanecem iguais. A busca aceita o rótulo visível e o código armazenado.

A próxima etapa de Leonardo contempla TASK 24 / [#30](https://github.com/notknd/Projeto_Telecontrol/issues/30) e TASK 25 / [#31](https://github.com/notknd/Projeto_Telecontrol/issues/31): tela de coleta em andamento e marcação dos produtos. Histórico (#33) estava atribuído a outra pessoa e não foi incluído como responsabilidade dele.

Vue 3, TypeScript e Vite permanecem no front-end. A interface consulta apenas `/api/v1` do Fastify existente, que coordena Prisma/PostgreSQL e FastAPI/Python. Calcular a rota chama `POST /routes/calculate` com `orderId`; o navegador não calcula caminhos nem baixa estoque. As consultas são GET `/products`, `/orders` e `/warehouse`.

## Trabalho anterior preservado

A pasta já estava na branch `integration/smartpick-html`, com um commit amplo e alterações locais de interface, backend e banco. Nenhuma dessas alterações anteriores foi revertida. `SmartPickApp.vue` e `tests/flow.mjs` permanecem como referência da integração completa, mas não são a interface e o teste padrão desta entrega.

A branch também contém alterações anteriores de backend e banco. A revisão desta entrega deve considerar o recorte de front-end descrito aqui e suas dependências visuais.

## Execução e verificação

O iniciador local existente continua abrindo a aplicação. A aplicação real precisa da API e de seus contratos disponíveis; não há fallback para dados fictícios quando a API falha. O fluxo agora termina na visualização da rota.

Em `apps/web`:

```powershell
npm run build
npx playwright install chromium
npm run test:e2e
```

O teste inicia seu próprio servidor Vite temporário; `WEB_TEST_URL` permite usar outro servidor. As respostas REST são interceptadas com fixtures exclusivamente no teste, sem alterar banco ou estoque. `TEST_OUTPUT_DIR` permite mudar a pasta de capturas.

Verificado nesta revisão: compilação e tipagem; dashboard; busca e seleção; resposta de cálculo e rota desenhada; falha de cálculo; API indisponível; recuperação; estado vazio; tema escuro; tela de 390 px; ausência de operações de coleta e de erros JavaScript. Capturas em `apps/web/test-results/first-delivery`. Os testes de navegador passaram com respostas simuladas: não constituem uma nova validação integrada de PostgreSQL, Fastify e motor Python nem confirmação de toda a aplicação pronta.
