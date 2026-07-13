# PRD — Estoque 065

**Produto:** Estoque 065 — Sistema de controle de produção e estoque
**Cliente:** 065 Gelo (fábrica de gelo saborizado, cubo e escamado)
**Desenvolvimento:** Trino Inteligência Digital
**Versão do documento:** 1.0 — Julho/2026
**Status:** Aprovado para desenvolvimento

---

## 1. Visão geral

O Estoque 065 é um web app (PWA) que centraliza o controle de produção e estoque da 065 Gelo. Ele substitui o registro informal por WhatsApp por um sistema único onde toda entrada (produção, retorno de patrocínio) e toda saída (venda, patrocínio, perda) é lançada na origem — na porta da câmara fria, pelo colaborador, ou no escritório, pelo admin — e o estoque é sempre calculado a partir de um livro-razão imutável de movimentações.

## 2. Problema

Hoje, produção, vendas, patrocínios e perdas são comunicados por mensagens de WhatsApp. As consequências:

- **Ineficiência** — alguém precisa transcrever mensagens para consolidar números.
- **Descentralização** — o dado vive em conversas espalhadas, sem estrutura.
- **Incerteza** — ninguém sabe com confiança quanto há de cada produto em cada câmara, nem quem registrou o quê.
- **Perdas e patrocínios invisíveis** — saídas sem venda não têm rastreio real; retornos de eventos voltam ao estoque sem registro consistente.

## 3. Objetivos e métricas de sucesso

| Objetivo | Métrica |
|---|---|
| Estoque confiável em tempo real | Divergência entre saldo do sistema e contagem física dentro da tolerância operacional, sem "ajustes pra fechar" fora da contagem |
| Rastreabilidade total | 100% das movimentações com autor, data/hora e câmara identificados |
| Agilidade no chão de fábrica | Fluxo QR → PIN → lançamento confirmado em menos de 30 segundos |
| Abandono do WhatsApp como registro | Zero registros operacionais por WhatsApp após a implantação |

## 4. Usuários e personas

**Admin (gestão da 065 Gelo)** — usa no escritório, computador ou celular, várias vezes ao dia. Precisa ver o estoque consolidado, o histórico completo, gerenciar cadastros e ser avisado quando algo está acabando. Entra com e-mail e senha (Clerk).

**Colaborador (chão de fábrica)** — usa em pé, com pressa e mãos frias, no celular. Não faz login tradicional: escaneia o QR Code afixado na porta da câmara fria, digita seu PIN individual e, se estiver autorizado para aquela câmara, acessa apenas os lançamentos que suas permissões liberam (produção e/ou saídas). Cada lançamento fica registrado em seu nome.

## 5. Produtos e modelo de estoque

| Produto | Unidade base | Formatos |
|---|---|---|
| Gelo saborizado (vários sabores) | Pacote (30 pedras de 190g) | — |
| Gelo cubo | kg | Pacotes de 2, 4, 10kg e pesos variados (cadastráveis) |
| Gelo escamado | kg | Pacotes de 2, 4, 10kg e pesos variados (cadastráveis) |

Decisões estruturais:

- **Ledger append-only.** O saldo nunca é gravado; é sempre a soma das entradas menos as saídas por câmara/produto/sabor. Movimentações não são editadas nem excluídas — correção é um lançamento de ajuste, exclusivo do admin.
- **Sabor é atributo**, não produto. Novo sabor é um cadastro, não uma mudança de sistema.
- **Formato de pacote é cadastro.** Demanda de peso novo (ex.: 5kg) não exige desenvolvimento.

## 6. Escopo v1

1. **Produção** — entrada por câmara, produto e sabor, com conversão automática de unidades.
2. **Carregamento (venda e patrocínio)** — itens, cliente, veículo próprio (cadastrado) ou terceiro (placa + descrição), motorista, responsável, data/hora; nome do evento obrigatório em patrocínio.
3. **Perda** — motivo de lista fixa gerenciável + observação opcional.
4. **Retorno de patrocínio** — vinculado ao carregamento de origem; não pode exceder, por item, o que saiu.
5. **Contagem física** — por câmara, com geração automática e atômica de ajustes no fechamento; uma contagem aberta por câmara.
6. **Dashboard em tempo real** — saldo por câmara/produto/sabor, pacotes e kg lado a lado, destaque de estoque abaixo do mínimo.
7. **Histórico** — filtros por período, câmara, produto, sabor, tipo e autor; detalhe de carregamento com retornos vinculados.
8. **Alerta de estoque mínimo** — destaque visual em tempo real no dashboard sempre que o saldo estiver abaixo do mínimo configurado.
9. **Cadastros** — produtos, sabores, formatos de pacote, câmaras (com geração e impressão de QR), colaboradores (PIN, permissões, câmaras autorizadas), veículos, clientes e motivos de perda; inativação em vez de exclusão quando houver referência.
10. **Regra de saldo** — nenhuma saída pode deixar o saldo negativo; o sistema bloqueia e informa o disponível.

### Fora do escopo v1

| Item | Motivo |
|---|---|
| Notificações por WhatsApp | Exige API paga da Meta e aprovação de templates; o dashboard cobre a necessidade operacional da v1 |
| Relatório de consumo por evento | O histórico por carregamento já responde; relatório dedicado é refinamento |
| Exportação Excel/PDF | Entra quando houver demanda real |
| Fila offline | v1 bloqueia envio sem conexão com aviso claro |
| Webhook do Clerk | v1 usa sincronia lazy no primeiro login |

## 7. Fluxos principais

**Colaborador lança produção:** escaneia QR da câmara → digita PIN → sistema valida hash, câmara autorizada e permissão → menu → Produção → produto → sabor (se saborizado) → quantidade → confirmação com resumo → gravado com autor, câmara e data/hora.

**Carregamento de patrocínio com retorno:** carregamento tipo patrocínio com evento, itens, veículo e motorista → produtos saem do estoque → após o evento, Retorno de Patrocínio → seleciona o carregamento → informa o que voltou em boas condições (limitado ao que saiu) → entrada vinculada ao carregamento de origem.

**Contagem física:** admin abre contagem na câmara → digita quantidades contadas por produto/sabor → resumo das diferenças → fechamento gera ajustes automáticos vinculados à contagem.

**Alerta de mínimo:** o dashboard calcula e destaca em tempo real os itens cujo saldo está abaixo do mínimo configurado.

## 8. Requisitos

Os requisitos funcionais abrangem Cadastros, Acesso do Colaborador, Produção, Saídas/Carregamento, Retorno de Patrocínio, Perdas, Contagem Física, Dashboard, Histórico e Alertas.

Os requisitos não funcionais incluem: autenticação pelo Clerk para o admin; QR + PIN com sessão de 12h vinculada à câmara para o colaborador; verificação de identidade em toda função; papel lido do banco e nunca do token; PIN apenas como hash com bloqueio após 5 tentativas; imutabilidade do ledger; experiência mobile-first com alvos de 56px; PWA com bloqueio claro offline; fluxo do colaborador em menos de 30 segundos; primeira carga em menos de 2 segundos em 4G; e cron de limpeza de sessões.

## 9. Arquitetura e stack

| Camada | Tecnologia | Papel |
|---|---|---|
| Frontend | React + Vite + TypeScript + Tailwind | PWA mobile-first |
| Backend e banco | Convex | Dados, tempo real, mutations atômicas, crons, actions |
| Autenticação admin | Clerk | E-mail e senha, integração via `ConvexProviderWithClerk` |
| Autenticação colaborador | Convex (próprio) | QR → PIN (hash) → token de sessão de 12h vinculado à câmara |

| Deploy | Vercel + `npx convex deploy` | Hospedagem e backend |

O modelo de dados deve manter `movimentacoes` como ledger imutável e `sessoesOperador` vinculada a uma única câmara, além das entidades necessárias aos cadastros, carregamentos, retornos e contagens físicas.

## 10. Design

Identidade derivada do próprio produto — o gelo. Tema claro:

- Fundo `#EEF3F4`, cards brancos, texto principal petróleo `#12262C`, secundário `#5B7078`
- Ação/primária `#0E7C9C` (ciano gelo escurecido, contraste AA); erro `#C93A42`, sucesso `#1F8A5B`, alerta `#B97A0F`, com fundos suaves para badges
- Tipografia: **Inter** (títulos e corpo) e **IBM Plex Mono** (números — saldos, quantidades, placas — com tabular-nums)
- Raio 10px, sombra única e discreta, ícones lucide, sem gradientes/glow/emoji
- Densidade: admin denso (tabelas); colaborador arejado (uma decisão por tela, toque ≥ 56px)
- Todas as telas devem contemplar estados de carregamento, vazio, erro, sucesso e indisponibilidade de conexão.

## 11. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Sinal instável na porta da câmara fria | Testar sinal antes do go-live; QR do lado de fora; bloqueio claro offline |
| Colaborador achar mais fácil o WhatsApp | Fluxo < 30s validado com colaborador real antes do lançamento |
| PIN compartilhado | PIN individual, bloqueio por tentativas, orientação na implantação |
| Estoque inicial errado | Implantação começa obrigatoriamente com contagem física completa |


## 12. Critérios de aceite da v1

1. Colaborador autorizado completa um lançamento de produção em menos de 30 segundos a partir do QR.
2. Colaborador não autorizado para uma câmara não passa da tela de PIN dela.
3. Saída que excederia o saldo é bloqueada com mensagem do disponível.
4. Retorno de patrocínio não aceita quantidade maior que a que saiu no carregamento de origem.
5. Fechamento de contagem gera ajustes corretos e o saldo passa a bater com o contado.
6. Dashboard reflete um lançamento feito em outro dispositivo sem recarregar a página.
7. Produto abaixo do mínimo aparece destacado no dashboard em tempo real.
8. Toda movimentação exibe autor, data/hora e câmara no histórico.
9. Nenhuma movimentação pode ser editada ou excluída pela interface.
10. Sistema instalável como PWA no celular e utilizável com uma mão no fluxo do colaborador.

## 13. Fases de entrega

1. **Fundação** — setup, autenticação admin, schema e helpers de autorização.
2. **Cadastros** — todas as entidades e QR das câmaras.
3. **Operação** — acesso do colaborador, produção, carregamentos, perdas e retornos.
4. **Controle** — contagem física, dashboard e histórico.
5. **Automação e implantação** — crons técnicos, contagem inicial nas câmaras, treinamento dos colaboradores e go-live.

