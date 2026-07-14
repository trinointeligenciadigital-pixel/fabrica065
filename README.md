# Estoque 065

PWA para controle de produção e estoque da 065 Gelo. O saldo é calculado a partir de um ledger append-only de movimentações por câmara, produto e sabor.

## Estado atual

A fundação técnica está ativa no ambiente de desenvolvimento:

- React, Vite, TypeScript, Tailwind e PWA configurados;
- Clerk e Convex integrados e validados;
- área administrativa protegida, com sincronização lazy do admin no primeiro login;
- primeira conta ativada como admin de bootstrap e contas seguintes mantidas pendentes;
- cadastros persistentes com criação, edição e inativação de produtos, sabores, câmaras, veículos, clientes e colaboradores;
- hub único em `/cadastros` para produtos, sabores, câmaras, equipe e configurações operacionais;
- colaboradores com PIN derivado por PBKDF2, inativação e permissões por câmara;
- configuração de estoque mínimo por câmara, produto e sabor;
- token operacional não sequencial e QR imprimível gerados para cada câmara;
- dashboard reativo ligado aos saldos, mínimos e movimentos reais;
- módulo de estoque em `/estoque`, com busca e filtros por câmara e situação do saldo;
- histórico paginado em `/historico`, com filtros combináveis, autoria e detalhe da origem de cada lançamento;
- fluxo móvel real: QR, identificação, PIN, sessão de 12 horas e produção persistida;
- produção append-only para admin e colaborador, com autor, câmara, horário e idempotência definidos no backend;
- lançamento administrativo de produção em `/movimentacoes`, com conversão por formato, saldo projetado, revisão e recibo;
- contagem física por câmara em `/contagens`, com rascunho, prévia de diferenças, bloqueio operacional e ajustes atômicos;
- diagnóstico administrativo em `/diagnostico`, com controles de integridade do ledger, sessões e contagens;
- estados de carregamento, vazio, erro, acesso pendente e modo sem integração;
- módulos carregados sob demanda para reduzir o pacote inicial;
- 36 testes unitários, 3 testes E2E públicos, auditoria automatizada de acessibilidade, lint, TypeScript e build de produção aprovados.

Sem as variáveis de ambiente, o dashboard entra em modo de demonstração e nenhuma movimentação é persistida.

## Requisitos

- Node.js 20.9 ou superior;
- uma aplicação Clerk;
- um projeto Convex.

## Configuração

1. Copie .env.example para .env.local.
2. Execute npx convex dev e vincule/crie o projeto Convex.
3. Configure CLERK_JWT_ISSUER_DOMAIN no ambiente do Convex.
4. Preencha VITE_CLERK_PUBLISHABLE_KEY e confirme VITE_CONVEX_URL.
5. No Clerk, mantenha o emissor JWT configurado para o Convex.

O primeiro usuário sincronizado é ativado como admin de bootstrap. Usuários seguintes entram inativos até aprovação no banco.

Para habilitar o E2E autenticado, use exclusivamente uma instância Clerk de desenvolvimento e defina `CLERK_SECRET_KEY` e `E2E_ADMIN_EMAIL` no arquivo local não versionado. Sem essas variáveis, apenas a suíte pública é executada.

## Acesso pelo celular em desenvolvimento

- O computador e o celular devem estar conectados à mesma rede Wi-Fi.
- O servidor usa a porta fixa 5176 e escuta a rede local.
- Configure VITE_PUBLIC_APP_URL no .env.local com o IPv4 do computador, por exemplo: http://192.168.18.4:5176.
- Se o IPv4 mudar, atualize a variável, reinicie o servidor e gere/imprima novamente os QRs.
- Em produção, use o domínio HTTPS publicado em VITE_PUBLIC_APP_URL.

## Comandos

- npm run dev
- npm run test
- npm run lint
- npm run build
- npm run test:e2e:public
- npm run convex:dev

## Documentos

- 06-prd-estoque-065.md: produto e escopo aprovado;
- PLANO_IMPLEMENTACAO_ESTOQUE_065.md: fases e critérios de passagem;
- DECISOES_DOMINIO.md: invariantes fechadas na Fase 0;
- PRODUCT.md: contexto estratégico da interface;
- DESIGN.md: sistema visual e responsivo;
- MATRIZ_ENTREGA.md: rastreabilidade dos critérios de aceite.

## Próxima entrega

Concluir a Fase 7 com credenciais exclusivas de teste, piloto em uma câmara, medição em 4G e treinamento da equipe.
