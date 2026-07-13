# Matriz de entrega — Estoque 065

| Critério do PRD | História verificável | Cobertura atual | Situação |
|---|---|---|---|
| 1. Produção em menos de 30 segundos | Colaborador abre QR, valida PIN e registra produção | Fluxo real QR → PIN → confirmação → ledger publicado; cronometragem com operador pendente | Em andamento |
| 2. Bloqueio por câmara | Sessão valida colaborador, câmara e permissão | Sessão de 12h, vínculo à câmara, bloqueio após 5 tentativas e revogação publicados | Em andamento |
| 3. Sem saldo negativo | Toda saída valida e grava atomicamente | Invariante e schema definidos | Pendente |
| 4. Limite de retorno | Retorno acumulado não supera item original | Tabelas e relacionamentos definidos | Pendente |
| 5. Contagem gera ajustes | Fechamento atômico reconcilia ledger | Regra, schema e bloqueio de câmara definidos | Pendente |
| 6. Dashboard em tempo real | Outro dispositivo atualiza sem recarga | Query reativa publicada e interface ligada ao Convex; teste entre dois dispositivos pendente | Em andamento |
| 7. Estoque mínimo visual | Item abaixo do mínimo fica destacado | Configuração, consulta reativa e destaque visual publicados | Em andamento |
| 8. Autor, data e câmara | Histórico apresenta trilha completa | Dashboard recente exibe autor, data e câmara; filtros pendentes | Parcial |
| 9. Ledger imutável | Não existem update/delete públicos | Schema e primeira mutation append-only | Parcial |
| 10. PWA de uma mão | Instalação e operação móvel | Manifest, service worker e fluxo responsivo | Parcial |

## Qualidade transversal

| Requisito | Evidência atual |
|---|---|
| TypeScript estrito | npx tsc -b e npm run build |
| Testes automatizados | 10 testes de quantidade, PIN e token de sessão |
| Qualidade estática | npm run lint |
| Offline sem falso sucesso | banner global e bloqueio reativo da confirmação |
| Acessibilidade inicial | foco visível, semântica, estados textuais, carregamento e vazio |
| Identidade no backend | bootstrap lazy e helper requireAdmin consultam admin ativo no banco |
| Proteção das rotas | login Clerk obrigatório e estado de acesso pendente |
| Persistência dos cadastros | produtos, sabores, câmaras, formatos, frota, clientes, perdas, equipe e mínimos |
| QR de câmara | token não sequencial, QR em alta correção, layout A4 e tela pública validada |
| Produção operacional | permissão no backend, conversão por formato, idempotência e recibo real |