# Matriz de entrega — Estoque 065

| Critério do PRD | História verificável | Cobertura atual | Situação |
|---|---|---|---|
| 1. Produção em menos de 30 segundos | Colaborador abre QR, valida PIN e registra produção | Fluxo real QR → PIN → confirmação → ledger publicado; cronometragem com operador pendente | Em andamento |
| 2. Bloqueio por câmara | Sessão valida colaborador, câmara e permissão | Sessão de 12h, vínculo à câmara, bloqueio após 5 tentativas e revogação publicados | Em andamento |
| 3. Sem saldo negativo | Toda saída valida e grava atomicamente | Perdas, ajustes negativos, vendas e patrocínios validam o saldo dentro da mesma transação | Concluído |
| 4. Limite de retorno | Retorno acumulado não supera item original | Retornos parciais descontam devoluções anteriores e bloqueiam excesso atomicamente | Concluído |
| 5. Contagem gera ajustes | Fechamento atômico reconcilia ledger | Abertura exclusiva, rascunho, prévia, fechamento atômico e ajustes vinculados publicados | Concluído |
| 6. Dashboard em tempo real | Outro dispositivo atualiza sem recarga | Query reativa publicada e interface ligada ao Convex; teste entre dois dispositivos pendente | Em andamento |
| 7. Estoque mínimo visual | Item abaixo do mínimo fica destacado | Configuração, consulta reativa e destaque visual publicados | Em andamento |
| 8. Autor, data e câmara | Histórico apresenta trilha completa | Histórico paginado com período, câmara, produto, sabor, tipo, autor e detalhe de origem publicado | Concluído |
| 9. Ledger imutável | Não existem update/delete públicos | Produção, perda e ajuste somente acrescentam movimentos; não existem funções públicas de edição ou remoção | Concluído |
| 10. PWA de uma mão | Instalação e operação móvel | Manifest, service worker e fluxo responsivo | Parcial |

## Qualidade transversal

| Requisito | Evidência atual |
|---|---|
| TypeScript estrito | npx tsc -b e npm run build |
| Testes automatizados | 34 testes unitários e 3 E2E públicos para autenticação, QR inválido e largura móvel |
| Qualidade estática | npm run lint |
| Offline sem falso sucesso | banner global e bloqueio reativo da confirmação |
| Diagnóstico operacional | verificação reativa de saldos negativos, referências, origens, sessões e contagens abertas |
| Acessibilidade inicial | foco visível, link para pular ao conteúdo, estados textuais e auditoria Axe na tela pública |
| Identidade no backend | bootstrap lazy e helper requireAdmin consultam admin ativo no banco |
| Proteção das rotas | login Clerk obrigatório e estado de acesso pendente |
| Persistência dos cadastros | criação, edição e inativação de produtos, sabores, câmaras, frota, clientes e equipe; demais configurações persistentes |
| QR de câmara | token não sequencial, QR em alta correção, layout A4 e tela pública validada |
| Operação por QR | produção e perda com permissão no backend, conversão por formato, idempotência, confirmação e recibo real |
| Operação administrativa | produção, perda e ajuste com autorização no backend, saldo projetado, confirmação e recibo real |
| Carregamentos | venda e patrocínio multi-item, transporte, idempotência, baixa atômica e cadeia de retornos |
| Consulta de estoque | rota dedicada com saldos reativos, busca e filtros por câmara, mínimo e saldo zerado |
| Histórico auditável | paginação por índice, filtros combináveis e detalhe da origem de carregamentos, retornos, perdas e contagens |
| Contagem física | uma aberta por câmara, bloqueio operacional, rascunho, prévia e fechamento atômico auditável |
