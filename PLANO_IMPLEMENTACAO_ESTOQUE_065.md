# Plano de implementação — Estoque 065

**Base:** PRD Estoque 065 v1.0, julho/2026  
**Status:** em execução; base técnica da Fase 7 implementada em 13/07/2026, piloto operacional pendente
**Modelo de execução:** projeto greenfield, entregas incrementais e homologação por fluxo  
**Estimativa inicial:** 45–60 dias úteis de desenvolvimento para uma pessoa full-stack, mais disponibilidade do cliente para validações  
**Objetivo:** colocar em produção uma PWA confiável para registrar e consultar toda movimentação de estoque da 065 Gelo, substituindo o WhatsApp como registro operacional.

## Status da execução — 13/07/2026

- Clerk e Convex configurados, comunicando-se e publicados no ambiente de desenvolvimento.
- Rotas administrativas protegidas e sincronização do primeiro admin implementada.
- Produtos, sabores e câmaras possuem cadastro, listagem, inativação e validação de nome duplicado.
- Dashboard consulta saldos, mínimos e movimentos reais de forma reativa.
- Cadastros da Fase 2 implementados: formatos, colaboradores, permissões, QR, veículos, clientes, perdas e mínimos.
- Autenticação operacional QR + PIN, sessão de 12 horas e produção real pelo colaborador implementadas.
- Fase 3 concluída: produção, perdas, ajustes manuais, idempotência e bloqueio atômico de saldo negativo.
- Admin pode registrar produção diretamente em Movimentações, com as mesmas conversões e garantias do fluxo QR.
- Fase 4 concluída: manifestos de venda e patrocínio, baixa atômica multi-item e retornos parciais vinculados.
- Fase 5 concluída: contagem exclusiva por câmara, rascunho, prévia de diferenças e reconciliação atômica.
- Fase 6 implementada: dashboard, mínimos, consulta de estoque e histórico paginado com detalhes auditáveis.
- Fase 7 iniciada: diagnóstico de integridade, revisão de autorização, acessibilidade e testes E2E públicos implementados.
- Próximo incremento: piloto controlado, medição em 4G, E2E autenticado com conta exclusiva de teste e treinamento.
## 1. Premissas de planejamento

- O repositório começa vazio.
- A stack aprovada é React, Vite, TypeScript, Tailwind, Convex, Clerk e Vercel.
- O saldo é derivado exclusivamente do ledger append-only; não haverá campo de saldo editável.
- Toda regra crítica será validada no backend, mesmo que também exista validação na interface.
- A primeira implantação só ocorre após contagem física completa de todas as câmaras.
- A v1 depende de conexão; não haverá fila offline.
- O cliente fornecerá produtos, sabores, câmaras, formatos, veículos, colaboradores, permissões, clientes e motivos de perda para a carga inicial.
- O PRD é a fonte de verdade do produto; decisões detalhadas serão registradas diretamente neste planejamento e no backlog.

## 2. Estratégia de entrega

O desenvolvimento será vertical e incremental. Cada fase deve terminar com um conjunto utilizável de funcionalidades, testes automatizados e homologação do responsável da 065 Gelo. Funcionalidade incompleta não segue para produção apenas porque a tela está pronta: interface, autorização, persistência, auditoria e tratamento de erros formam uma única entrega.

### Portões de qualidade comuns a todas as fases

Uma história só é concluída quando:

1. Os critérios de aceite estão demonstráveis.
2. As permissões são verificadas no Convex.
3. Estados de carregamento, vazio, erro, sucesso e falta de conexão estão tratados.
4. O fluxo funciona em celular e desktop quando aplicável.
5. Testes do domínio e do fluxo principal foram adicionados.
6. Não há erro de TypeScript, lint ou build.
7. Eventos relevantes preservam autor, data/hora e contexto de auditoria.

## 3. Arquitetura proposta

### 3.1 Frontend

- SPA/PWA em React + Vite + TypeScript.
- Rotas separadas em dois contextos:
  - `/admin/*`: administração autenticada pelo Clerk;
  - `/operacao/:cameraToken/*`: fluxo QR + PIN do colaborador.
- Componentes e tokens visuais compartilhados, mas layouts distintos:
  - admin: navegação persistente e alta densidade;
  - operação: uma decisão por tela, alvos de toque de no mínimo 56 px.
- Estado remoto reativo pelas queries do Convex; evitar duplicar saldo em estado local.
- Formulários com validação de entrada e confirmação explícita antes de movimentações.

### 3.2 Backend e dados

- Convex como banco, backend reativo, agendador e executor de mutations atômicas.
- Funções organizadas por domínio: autorização, cadastros, produção, carregamentos, perdas, retornos, contagens, estoque, histórico e estoque mínimo.
- Helpers centrais para:
  - exigir identidade do Clerk;
  - buscar papel e situação do admin no banco;
  - validar sessão do operador, câmara, expiração e permissão;
  - calcular saldo por câmara/produto/sabor;
  - validar quantidade e unidade;
  - registrar movimentação imutável.


### 3.3 Modelo de domínio mínimo

O schema detalhado deve ser reconciliado com o documento de modelagem citado no PRD. O conjunto mínimo esperado inclui:

- usuários administrativos;
- colaboradores;
- sessões de operador;
- câmaras;
- produtos;
- sabores;
- formatos de pacote;
- veículos;
- clientes;
- motivos de perda;
- carregamentos e seus itens;
- contagens físicas e seus itens;
- movimentações do ledger.

O número final de tabelas pode diferir das 12 citadas no PRD se carregamentos, contagens e itens forem normalizados. Essa decisão deve ser fechada antes da Fase 1.

### 3.4 Invariantes obrigatórias

- Quantidades são sempre positivas na entrada; o tipo da movimentação define o sinal.
- Nenhuma saída deixa o saldo negativo.
- Movimentações nunca são editadas ou excluídas.
- Ajustes exigem admin e justificativa/origem.
- Um retorno de patrocínio referencia um carregamento e não ultrapassa o saldo retornável de cada item.
- Existe no máximo uma contagem aberta por câmara.
- O fechamento da contagem e seus ajustes ocorre em uma única mutation atômica.
- Cadastros referenciados são inativados, não apagados.
- Sabor só é aceito em produto saborizado; a ausência de sabor é validada nos demais produtos.
- Toda sessão de operador pertence a uma única câmara e expira em 12 horas.

## 4. Fases de execução

## Fase 0 — Descoberta e fechamento técnico

**Esforço:** 3–5 dias úteis  
**Objetivo:** eliminar ambiguidades antes da implementação estrutural.

### Atividades

- Mapear o escopo, os requisitos e os critérios de aceite do PRD em uma matriz requisito → história → teste.
- Validar vocabulário e unidades com o cliente:
  - pacote de gelo saborizado versus kg de cubo/escamado;
  - conversão de formato em peso base;
  - tratamento de pesos variados;
  - estoque mínimo por câmara/produto/sabor;
  - fuso horário operacional (`America/Cuiaba`).
- Definir quais lançamentos o admin pode fazer além do colaborador.
- Confirmar política de ajuste, bloqueio de PIN e reativação.
- Desenhar fluxos e protótipo navegável das telas críticas.
- Definir ambientes: desenvolvimento, homologação e produção.

### Saídas

- Backlog priorizado e rastreável.
- Diagrama de dados aprovado.
- Contratos das mutations críticas.
- Protótipo homologado do QR → PIN → lançamento.
- Plano de testes e dados de homologação.

### Critério de passagem

Nenhuma regra de unidade, autorização, retorno ou contagem permanece aberta.

## Fase 1 — Fundação técnica e segurança

**Esforço:** 6–8 dias úteis  
**Objetivo:** criar a base segura sobre a qual os módulos serão implementados.

### Atividades

- Criar o projeto React/Vite/TypeScript/Tailwind e configurar qualidade de código.
- Criar o projeto Convex e o schema inicial com índices.
- Integrar Clerk pelo `ConvexProviderWithClerk`.
- Implementar sincronização lazy do admin no primeiro login.
- Criar helpers de autenticação e autorização no backend.
- Criar sessão de operador com token seguro, hash do PIN, expiração de 12 horas, vínculo à câmara e bloqueio após cinco tentativas.
- Configurar variáveis de ambiente separadas por ambiente.
- Criar layouts base do admin e da operação.
- Configurar manifest, ícones, service worker e aviso de indisponibilidade offline.
- Preparar CI com typecheck, lint, testes e build.

### Testes prioritários

- Usuário sem identidade não acessa função administrativa.
- Papel alterado no banco passa a valer sem depender do token Clerk.
- PIN não é persistido em texto puro.
- Sessão expirada, revogada ou de outra câmara é rejeitada.
- Colaborador inativo não inicia nem reutiliza sessão.

### Critério de passagem

Admin entra em ambiente de homologação; colaborador autorizado abre uma sessão da câmara; tentativas inválidas e acessos cruzados são bloqueados.

## Fase 2 — Cadastros e preparação operacional

**Esforço:** 7–9 dias úteis  
**Objetivo:** permitir que o cliente configure tudo o que os lançamentos exigem.

### Atividades

- Implementar CRUD com inativação para produtos, sabores, formatos, câmaras, colaboradores, veículos, clientes e motivos de perda.
- Implementar permissões do colaborador por ação e câmara.
- Gerar token não sequencial para a URL da câmara.
- Gerar QR Code e layout de impressão por câmara.
- Configurar estoque mínimo no nível definido na Fase 0.
- Criar filtros, busca, paginação e indicação de inativos.
- Criar carga inicial controlada ou roteiro de importação manual.

### Testes prioritários

- Entidade referenciada não é excluída.
- Cadastro inativo não aparece como opção em novo lançamento.
- Admin ainda consegue consultar o histórico ligado a cadastro inativo.
- QR identifica uma única câmara sem expor credenciais.
- Permissões por câmara são aplicadas no backend.

### Critério de passagem

O cliente consegue cadastrar os dados reais, imprimir os QRs e validar o acesso de ao menos dois perfis de colaborador com permissões diferentes.

## Fase 3 — Ledger, produção e perdas

**Esforço:** 6–8 dias úteis  
**Objetivo:** colocar o núcleo de estoque em funcionamento.

### Atividades

- Implementar o ledger append-only e a consulta agregada de saldo.
- Definir e testar conversões de formato para unidade base.
- Implementar lançamento de produção para admin e colaborador autorizado.
- Implementar lançamento de perda com motivo e observação.
- Implementar ajustes manuais exclusivos do admin.
- Criar confirmação com resumo antes da gravação.
- Criar recibo de sucesso com identificação inequívoca do lançamento.
- Impedir reenvio acidental por duplo toque ou repetição de requisição.

### Testes prioritários

- Produção aumenta exatamente o saldo correto.
- Perda e ajuste negativo respeitam o saldo disponível.
- Conversões preservam precisão e não usam ponto flutuante de forma insegura.
- Uma requisição repetida não duplica movimentação.
- Não existe função pública que altere ou remova movimentações.

### Critério de passagem

Uma rodada real simulada de produção e perda fecha com o saldo esperado por câmara, produto e sabor.

## Fase 4 — Carregamentos e retornos de patrocínio

**Esforço:** 7–9 dias úteis  
**Objetivo:** controlar todas as saídas comerciais e promocionais e seus retornos.

### Atividades

- Implementar carregamento de venda e patrocínio com múltiplos itens.
- Exigir cliente, responsável, data/hora e dados de transporte definidos no PRD.
- Tratar veículo próprio cadastrado e veículo terceiro com placa e descrição.
- Exigir nome do evento em patrocínio.
- Validar todos os itens e debitar o estoque atomicamente.
- Implementar retorno vinculado ao carregamento de patrocínio.
- Calcular quantidade retornável por item considerando retornos anteriores.
- Exibir carregamento, saídas e retornos como uma cadeia auditável.

### Testes prioritários

- Falta de saldo em qualquer item impede o carregamento inteiro.
- Duas saídas concorrentes não produzem saldo negativo.
- Venda não aceita retorno de patrocínio.
- Soma dos retornos nunca ultrapassa a saída original por item.
- Retorno entra na câmara correta conforme regra fechada na Fase 0.

### Critério de passagem

Venda, patrocínio e retorno são homologados com cenários de múltiplos itens, saldo insuficiente e retorno parcial em mais de uma ocasião.

## Fase 5 — Contagem física e reconciliação

**Esforço:** 5–7 dias úteis  
**Objetivo:** permitir conferência física sem comprometer a auditabilidade.

### Atividades

- Abrir uma contagem por câmara e registrar seu responsável.
- Congelar ou definir claramente a referência de saldo usada na comparação.
- Registrar quantidades contadas por produto/sabor.
- Exibir diferenças antes do fechamento.
- Fechar a contagem em mutation atômica, gerando ajustes vinculados.
- Impedir segundo fechamento e múltiplas contagens abertas na mesma câmara.
- Definir comportamento de movimentações durante uma contagem aberta.

### Decisão crítica

Recomenda-se não bloquear a operação durante a contagem. O fechamento deve comparar o contado com o saldo correspondente ao instante operacional definido e considerar as movimentações ocorridas durante o processo. Essa semântica precisa ser especificada e testada antes da implementação.

### Testes prioritários

- Concorrência na abertura de contagem.
- Fechamento com diferença positiva, negativa e zero.
- Falha parcial não deixa contagem fechada sem todos os ajustes.
- Reexecução do fechamento não duplica ajustes.

### Critério de passagem

Após o fechamento, o saldo exibido coincide com a contagem segundo a regra temporal aprovada, e cada ajuste aponta para sua contagem de origem.

## Fase 6 — Dashboard, histórico e estoque mínimo

**Esforço:** 6–8 dias úteis  
**Objetivo:** dar à gestão visibilidade confiável e acionável.

### Atividades

- Criar dashboard reativo por câmara, produto e sabor.
- Exibir pacotes e kg lado a lado quando fizer sentido, sem misturar unidades incompatíveis.
- Destacar estoque abaixo do mínimo.
- Criar histórico com filtros por período, câmara, produto, sabor, tipo e autor.
- Criar visão detalhada de movimentação, carregamento e retornos.
- Implementar paginação e índices adequados para o histórico.



- Registrar resultado técnico do envio para diagnóstico.

### Testes prioritários

- Dashboard em um dispositivo reflete lançamento de outro sem recarga.
- Filtros do histórico combinam corretamente.
- Limite mínimo e unidade exibida correspondem ao cadastro.



### Critério de passagem

Os critérios de aceite 6, 7 e 8 do PRD são demonstrados em homologação, incluindo a atualização visual em tempo real.

## Fase 7 — Hardening, piloto e go-live

**Esforço:** 5–7 dias úteis de desenvolvimento + janela operacional do cliente  
**Objetivo:** reduzir risco antes de abandonar o WhatsApp.

### Atividades

- Executar testes E2E dos fluxos críticos em celulares reais.
- Validar o fluxo do colaborador em menos de 30 segundos.
- Testar sinal de rede em cada porta de câmara.
- Revisar acessibilidade, alvos de toque, contraste e uso com uma mão.
- Medir primeira carga em 4G e otimizar para a meta de menos de 2 segundos.
- Executar revisão de segurança e autorização função por função.
- Testar concorrência em saídas, retornos e contagens.
- Configurar monitoramento, logs e procedimento de suporte.
- Cadastrar os dados reais e revisar permissões.
- Treinar admins e colaboradores.
- Executar contagem física inicial completa.
- Congelar o WhatsApp como canal de registro e iniciar o sistema.
- Fazer acompanhamento intensivo nos primeiros dias.

### Progresso técnico em 13/07/2026

- Concluído: auditoria das funções públicas e confirmação de autorização administrativa ou sessão operacional.
- Concluído: diagnóstico reativo de integridade, sem escrita, disponível para admins.
- Concluído: link de salto ao conteúdo e auditoria Axe do acesso público.
- Concluído: 29 testes unitários e 3 cenários E2E públicos em Chromium.
- Preparado: E2E autenticado com Clerk, ativado somente por chave secreta e conta exclusivas de teste.
- Pendente de campo: celular real, rede 4G/Wi-Fi nas portas, cronometragem, piloto, carga real, treinamento e go-live.
### Estratégia de implantação

1. Homologação com dados fictícios.
2. Piloto controlado em uma câmara e poucos colaboradores.
3. Correção dos problemas encontrados no uso real.
4. Cadastro final e contagem inicial de todas as câmaras.
5. Go-live geral no início de um turno, com responsável de suporte disponível.
6. Revisões após 24 horas, 7 dias e 30 dias.

### Critério de passagem

Todos os dez critérios de aceite do PRD estão aprovados; não há vulnerabilidade crítica, erro impeditivo ou divergência inexplicada de saldo.

## 5. Cronograma de referência

O calendário depende do tamanho da equipe. Para uma pessoa full-stack dedicada e validações do cliente sem atraso:

| Período | Entrega principal |
|---|---|
| Semana 1 | Descoberta, protótipo e fechamento do domínio |
| Semanas 2–3 | Fundação, segurança e cadastros |
| Semanas 4–5 | Ledger, produção, perdas e ajustes |
| Semanas 6–7 | Carregamentos, patrocínios e retornos |
| Semana 8 | Contagem física |
| Semanas 9–10 | Dashboard, histórico e estoque mínimo |
| Semanas 11–12 | Hardening, piloto, treinamento e go-live |

Esse cronograma é uma referência de 12 semanas, não uma data contratual. A estimativa deve ser recalibrada após a Fase 0 e novamente ao fim da Fase 2.

## 6. Backlog por prioridade

### P0 — indispensável para operar

- Autenticação e autorização de admin.
- QR, PIN, sessão e permissões do colaborador.
- Cadastros essenciais.
- Ledger e cálculo de saldo.
- Produção, perda, venda, patrocínio e retorno.
- Bloqueio de saldo negativo.
- Contagem física e ajustes atômicos.
- Dashboard e histórico auditável.
- PWA instalável e bloqueio offline claro.

### P1 — indispensável para o go-live completo

- Configuração de estoque mínimo e destaque visual em tempo real.
- Impressão de QR.
- Experiência mobile otimizada.
- Observabilidade, limpeza de sessões e ferramentas de suporte.
- Carga inicial e treinamento.

### P2 — refinamentos dentro da v1, se a capacidade permitir

- Melhorias de produtividade em filtros e cadastros.
- Atalhos e repetição assistida de itens, sem repetir movimentação.
- Painéis adicionais que não alterem os critérios de aceite.

Itens declarados fora do escopo — WhatsApp, exportação, fila offline e relatório dedicado por evento — não entram no backlog da v1 sem aprovação explícita de mudança de escopo.

## 7. Estratégia de testes

### Testes unitários e de domínio

- Conversões de unidade.
- Cálculo de saldo.
- Retornável de patrocínio.
- Limites de estoque mínimo.
- Expiração, tentativas e permissões de sessão.

### Testes de integração

- Mutations atômicas com múltiplos itens.
- Concorrência para impedir saldo negativo.
- Fechamento de contagem e geração de ajustes.
- Autorização aplicada a cada função pública do Convex.


### Testes E2E

- Admin cria cadastros e acompanha saldo.
- Colaborador: QR → PIN → produção em menos de 30 segundos.
- Colaborador não autorizado é bloqueado.
- Venda com saldo suficiente e insuficiente.
- Patrocínio com retorno parcial e tentativa de excesso.
- Contagem completa com diferenças.
- Atualização reativa entre dois dispositivos.
- Instalação e abertura como PWA.

### Testes operacionais

- Celulares Android e iPhone representativos do cliente.
- Rede 4G e Wi-Fi no local real.
- Uso com uma mão e baixa luminosidade/reflexo.
- Impressão e leitura dos QRs na distância real.

## 8. Segurança e privacidade

- Não confiar em papel, permissões, câmara ou autor enviados pelo frontend.
- Consultar o papel do admin no banco em toda operação protegida.
- Armazenar PIN somente com hash adequado e salt; nunca registrar PIN em logs.
- Armazenar token de sessão de operador de forma que vazamento do banco não permita reutilização direta.
- Usar comparação segura de credenciais e limitação de tentativas.
- Não incluir segredos Clerk ou Convex no bundle do navegador.
- Minimizar dados pessoais e restringir listagens de colaboradores e clientes ao admin.
- Preservar trilha de auditoria para ações administrativas relevantes, além das movimentações.
- Revisar funções públicas do Convex antes de cada release.

## 9. Observabilidade e suporte

- Registrar falhas técnicas com identificador de correlação, sem credenciais.
- Disponibilizar ao usuário uma mensagem simples e um código de suporte.
- Monitorar falhas de funções backend e crons técnicos.
- Criar verificação administrativa de integridade:
  - movimentações sem entidade de origem esperada;
  - sessões expiradas ainda ativas;
  - contagens abertas há muito tempo;
  - cadastros inconsistentes.
- Definir responsável e prazo de resposta durante o piloto e a primeira semana.
- Documentar recuperação de configuração e acesso; o ledger não deve ser “corrigido” diretamente no banco.

## 10. Riscos e respostas

| Risco | Prevenção | Plano de contingência |
|---|---|---|
| Regra de unidade ambígua | Homologar exemplos numéricos na Fase 0 | Bloquear cadastro/formato ambíguo até correção |
| Corrida entre saídas | Validar e gravar atomicamente | Rejeitar a segunda operação com saldo atualizado |
| Contagem concorrente com operação | Definir semântica temporal e testá-la | Pausar operacionalmente a câmara durante a primeira implantação, se necessário |
| Sinal ruim | Teste físico e QR fora da câmara | Melhorar cobertura; v1 não simula sucesso offline |
| PIN compartilhado | PIN individual, bloqueio e treinamento | Revogar sessões, trocar PIN e auditar lançamentos |
| Baixa adesão | Fluxo medido com colaborador real | Ajustar UX durante o piloto antes do corte do WhatsApp |
| Estoque inicial incorreto | Contagem obrigatória | Nova contagem formal, nunca edição de saldo |

| Crescimento do ledger | Índices e consultas agregadas planejadas | Introduzir snapshots/cache verificável sem mudar a fonte de verdade |

## 11. Gestão do projeto

### Rituais recomendados

- Planejamento semanal com seleção de histórias e critérios de aceite.
- Demonstração semanal em homologação para o responsável do cliente.
- Registro de decisões de domínio e arquitetura.
- Triagem contínua de bugs por severidade.
- Reestimativa ao final de cada fase.

### Classificação de defeitos

- **Crítico:** perda de rastreabilidade, saldo incorreto, acesso indevido ou sistema indisponível; bloqueia release.
- **Alto:** fluxo P0 não pode ser concluído; bloqueia a fase.
- **Médio:** existe contorno operacional seguro; programar antes do go-live quando afeta operação frequente.
- **Baixo:** problema visual ou refinamento sem impacto operacional; pode entrar após estabilização.

### Controle de mudanças

Toda solicitação nova deve indicar:

1. problema que resolve;
2. impacto nos critérios de aceite;
3. impacto em prazo, dados e testes;
4. decisão: substituir item atual, mover para pós-v1 ou ampliar formalmente o escopo.

## 12. Checklist de go-live

- [ ] Dez critérios de aceite do PRD homologados.
- [ ] Todos os admins reais acessam o ambiente de produção.
- [ ] Colaboradores, permissões e PINs conferidos individualmente.
- [ ] Câmaras e QRs instalados e testados.
- [ ] Produtos, sabores, formatos, veículos, clientes e motivos revisados.
- [ ] Estoques mínimos configurados.


- [ ] Contagem física inicial concluída e assinada pelo responsável.
- [ ] Teste de saldo, saída e retorno concluído em produção de forma controlada.
- [ ] Treinamento realizado com admin e colaboradores.
- [ ] Canal e responsáveis de suporte divulgados.
- [ ] Procedimento do WhatsApp encerrado formalmente como fonte de registro.
- [ ] Plano de rollback operacional definido sem apagar movimentações.

## 13. Próximas ações imediatas

1. Nomear o responsável de produto da 065 Gelo e o responsável técnico.
2. Realizar a oficina da Fase 0 para fechar unidades, contagem e permissões.
3. Produzir a matriz requisito → história → teste a partir do PRD.
4. Aprovar o modelo de dados e o protótipo do fluxo do colaborador.
5. Reestimar o projeto e iniciar a Fase 1.
