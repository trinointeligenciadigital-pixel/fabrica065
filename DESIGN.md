# Design System — Estoque 065

## 1. Direção

A interface deriva do ambiente físico da fábrica: superfícies claras e frias, tipografia limpa e números com precisão de etiqueta industrial. O visual é contido; a personalidade aparece na organização do saldo por câmara e no tratamento rigoroso das unidades.

Cena de uso: um colaborador está do lado de fora da câmara, sob luz industrial, segurando o celular com uma mão e precisa concluir um lançamento sem hesitar. Isso exige tema claro, contraste alto e controles amplos.

## 2. Estratégia de cor

Estratégia restrita: neutros frios com ciano apenas para ação, seleção e foco.

| Token | Hex | Uso |
|---|---|---|
| `canvas` | `#EEF3F4` | fundo da aplicação |
| `surface` | `#FFFFFF` | painéis, formulários e tabelas |
| `ink` | `#12262C` | texto principal |
| `muted` | `#5B7078` | texto secundário |
| `primary` | `#0E7C9C` | ação principal, foco e seleção |
| `danger` | `#C93A42` | erro e saída bloqueada |
| `success` | `#1F8A5B` | confirmação |
| `warning` | `#B97A0F` | estoque mínimo e atenção |

Todos os estados terão também texto ou ícone; cor nunca será o único indicador.

## 3. Tipografia

- Interface: Inter, pesos 400, 500, 600 e 700.
- Dados: IBM Plex Mono, pesos 500 e 600, `font-variant-numeric: tabular-nums`.
- Escala fixa e compacta no admin; títulos de 28/34, 22/28 e 18/24 px.
- Fluxo operacional com rótulos de 16/24 px e valores de 24/30 px.
- Sem fonte display; a ferramenta deve desaparecer na tarefa.

## 4. Espaçamento e forma

- Escala base: 4, 8, 12, 16, 24, 32 e 48 px.
- Raio único de 10 px; pílula apenas para badges de estado.
- Borda fria de 1 px e uma sombra discreta para elementos realmente elevados.
- Barra lateral de 248 px no admin; conteúdo com largura útil máxima de 1440 px.
- No mobile, margem lateral de 16 px e área de ação fixa inferior quando necessário.

## 5. Assinatura do produto

O elemento recorrente é a **faixa de contexto da câmara**: uma linha compacta no topo dos fluxos que mostra nome da câmara, estado da sessão e saldo relevante. Ela não é decoração; impede lançamentos no contexto errado e conecta visualmente QR, operação e ledger.

## 6. Componentes

Cada componente interativo cobre `default`, `hover`, `focus-visible`, `active`, `disabled`, `loading` e `error`.

- Botões: primário sólido, secundário contornado e ação destrutiva explícita.
- Campos: rótulo sempre visível, ajuda curta, unidade anexada ao controle e erro abaixo.
- Tabelas: cabeçalho fixo quando útil, números alinhados à direita e ações no fim da linha.
- Badges: texto curto com fundo suave e contraste AA.
- Confirmação de movimentação: resumo inline ou página dedicada; modal não é padrão.
- Carregamento: skeleton que preserva a estrutura.
- Vazio: explica o que falta e oferece a próxima ação autorizada.
- Offline: bloqueio persistente e inequívoco; nunca enfileirar silenciosamente.

## 7. Movimento

Transições de estado entre 150 e 220 ms com easing de desaceleração. Movimento comunica seleção, conclusão ou erro. Sem animação ornamental ou sequência de entrada. Em `prefers-reduced-motion`, mudanças são instantâneas.

## 8. Responsividade

- Até 767 px: navegação compacta; formulários em uma coluna; fluxo operacional ocupa toda a tela.
- De 768 a 1099 px: sidebar recolhível; tabelas priorizam colunas essenciais.
- A partir de 1100 px: sidebar persistente e conteúdo administrativo denso.
- Tabelas largas usam rolagem horizontal com primeira coluna identificável; não virar cada linha em card automaticamente.