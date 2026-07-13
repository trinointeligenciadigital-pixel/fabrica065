# Decisões de domínio — Fase 0

**Status:** base técnica inicial; validar no piloto antes do go-live.

## D01 — Representação de quantidade

Quantidades são persistidas como inteiros. Gelo saborizado usa pacote como unidade mínima. Gelo cubo e escamado usam grama como unidade mínima, embora a interface apresente kg. Formatos de pacote convertem para gramas. Não usar ponto flutuante para saldo.

## D02 — Escopo da câmara em carregamentos

Cada carregamento pertence a uma única câmara. Todos os seus itens saem dela. Um retorno de patrocínio volta para a mesma câmara do carregamento de origem. Caso a operação futura exija múltiplas câmaras, serão criados carregamentos separados.

## D03 — Concorrência e saldo

A validação de saldo e a inserção de todas as movimentações de uma saída ocorrem na mesma mutation. Se qualquer item não tiver saldo, nada é gravado. Requisições de escrita usam chave de idempotência.

## D04 — Contagem física

Uma câmara pode ter no máximo uma contagem aberta. Enquanto estiver aberta, novas movimentações nessa câmara são bloqueadas. O fechamento compara o saldo do ledger às quantidades contadas e gera todos os ajustes na mesma mutation atômica.

## D05 — Imutabilidade

Movimentações não possuem operações de atualização ou exclusão. Correções são novas movimentações de ajuste, restritas ao admin, com justificativa e vínculo de origem quando aplicável.

## D06 — Estoque mínimo

O limite é configurado por câmara, produto e sabor opcional, na mesma unidade inteira usada pelo ledger. O alerta existe somente no dashboard em tempo real; não há notificação por e-mail.

## D07 — Sessão do colaborador

O QR identifica a câmara por token público não sequencial. O colaborador se identifica antes de informar o PIN, permitindo atribuir tentativas inválidas à pessoa correta. O PIN é individual e armazenado apenas como hash. Após cinco tentativas inválidas, o colaborador é bloqueado por 15 minutos. A sessão dura 12 horas, pertence a uma única câmara e pode ser revogada.

## D08 — Fuso e auditoria

Instantes são persistidos em UTC. Exibição, agrupamentos operacionais e crons técnicos usam `America/Cuiaba`. Autor, origem, câmara e data/hora são definidos ou validados no backend.

## D09 — Inativação

Cadastros com referência histórica não são excluídos. Itens inativos somem de novas operações, mas continuam visíveis no histórico.

## D10 — Conectividade

A v1 não mantém fila offline. Sem conexão, consultas podem exibir o último estado já renderizado, mas toda ação de escrita fica bloqueada com mensagem clara.