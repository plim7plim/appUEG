# Revisão técnica — 03/11/2026

> Escopo atual: a pedido do usuário, o produto foi simplificado para Avisos, Tarefas
> e Horários. As seções abaixo registram também o estado anterior e correções históricas.
> O README descreve a versão atual.


## Diagnóstico

O Mural UEG usa 16 páginas HTML, uma folha CSS compartilhada e 19 scripts JavaScript
sem framework ou build. Supabase fornece autenticação, PostgreSQL com RLS, Storage,
Realtime e uma Edge Function em Deno para operações administrativas. Não há motivo
para trocar essa stack no tamanho atual do produto.

Cada página possui um script de domínio. `comum.js` reúne sessão, perfil, notificações,
tema e utilidades; `admin.js` acrescenta a guarda e as chamadas privilegiadas.
O banco gera perfis e notificações por triggers. Tarefas e conteúdos são independentes
das turmas; entregas são pessoais. O painel administrativo usa permissões separadas
do papel aluno/professor.

A identidade visual já é consistente: azul institucional, detalhes em ocre, títulos
serifados e temas claro/escuro. Foram preservados os layouts e componentes existentes.
Não foram adicionadas bibliotecas ao frontend, contas de demonstração ou dados fictícios
para preencher telas.

## Problemas e correções

| Problema observado | Impacto | Correção local |
|---|---|---|
| `schema.sql` apagava `entregas` incondicionalmente | Reaplicar o arquivo destruía marcações pessoais | Removida a exclusão; uma estrutura legada agora interrompe a execução antes das alterações |
| Links de anexos escapavam HTML, mas aceitavam protocolos executáveis | Um valor malicioso gravado via API podia virar um link perigoso | Validação HTTP/HTTPS compartilhada em turmas e biblioteca; URLs inválidas não geram links ou prévias |
| Falha ao consultar entregas virava um mapa vazio | Atividades entregues pareciam não entregues | Estado só é substituído após sucesso das duas consultas; dados anteriores são preservados |
| Falha de rede podia deixar o upload desabilitado | Usuário não conseguia tentar novamente | `try/catch/finally` e bloqueio de submissões simultâneas na biblioteca |
| Exceções no carregamento do feed ficavam sem recuperação | Tela podia permanecer carregando | Erro explícito e botão para tentar novamente, respeitando o token da consulta atual |
| Erro na consulta de seguidores virava lista vazia | Filtro Seguindo informava ausência de pessoas incorretamente | Erro propagado ao estado de recuperação do feed |
| Falha ao buscar sessão/perfil não era tratada em todos os caminhos | Inicialização interrompida sem orientação | Mensagem recuperável; painel não consulta permissões com perfil nulo |
| Erros das permissões administrativas eram confundidos com ausência de permissão | Redirecionamento ou tela incompleta sem explicar a falha | Guarda trata erros e permanece fechada até recarregar com sucesso |
| Sair da turma redirecionava mesmo com falha de exclusão | Interface indicava uma saída que não aconteceu | Redirecionamento somente após confirmação; botão restaurado em falhas |
| Lista de alunos incluía pedidos pendentes | Contagem e relação de participantes incorretas | Consulta restrita a matrículas aprovadas |
| Filtros mantinham valores removidos após atualizar dados | Lista vazia apesar de seletor mostrar todos | Seletores e estado dos filtros são sincronizados |
| Campo de arquivo escondia o foco de teclado | Pessoa não percebia onde estava na navegação | Contorno visível no botão associado ao input |
| Títulos e nomes de arquivos longos não tinham quebra suficiente | Possível transbordamento em telas pequenas | Quebra de palavras e colunas de formulário com largura mínima zero |

Notificações também preservam o estado de leitura quando o banco rejeita a atualização.
A escolha do tema continua funcionando na aba quando o navegador impede gravação no
armazenamento local.

## Arquivos alterados

- `conteudos.html`: campo de arquivo acessível, sem `display:none` no input obrigatório.
- `js/supabase-config.js`: seleção entre banco local e remoto pelo hostname.
- `css/estilo.css`: foco, quebra de texto e dimensionamento de campos.
- `js/comum.js`: inicialização, notificações, persistência de tema e validação de URLs.
- `js/admin.js`: guarda administrativa em falhas de perfil/permissões.
- `js/comunidade.js`: recuperação do feed e distinção entre erros e listas vazias.
- `js/conteudos.js`: envio, filtros, links e estado acessível das prévias.
- `js/tarefas.js`: consistência das leituras e dos filtros.
- `js/turma.js`: matrículas aprovadas, saída e links de anexos.
- `js/turmas.js`: validação dos links de anexos no feed geral.
- `schema.sql`: preservação das entregas ao reaplicar.
- `tests/fluxos.test.cjs`: regressões de rede, estado, links e matrículas.
- `supabase/config.toml` e `supabase/.gitignore`: ambiente local solicitado durante a revisão.
- `README.md` e este relatório: instruções e limitações verificadas.

## Verificação realizada

- Antes das alterações: 11 testes passaram.
- Após as correções: 26 testes passaram com `node --test tests/fluxos.test.cjs`.
  São testes isolados com respostas controladas; não equivalem a testes completos do Supabase.
- Sintaxe dos 19 scripts de navegador validada com `node --check`.
- Referências locais de scripts, estilos e imagens nas 16 páginas verificadas: nenhuma ausente.
- Entrada e cadastro inspecionados no Chrome, no tema escuro, em tamanhos de celular,
  tablet e desktop. Sem criação de contas pela interface.
- O projeto não possui build ou teste de navegador automatizado configurado.
- Supabase local iniciado com CLI 3.0.0 e Docker: Auth, REST e Storage responderam
  HTTP 200; site local respondeu HTTP 200. As 17 tabelas da aplicação e os três
  buckets foram conferidos. Redirecionamentos do Auth apontam para a porta 8000.
- Schema aplicado com sucesso e reaplicado em transação: a tabela `entregas`
  manteve o mesmo OID. A proteção para estrutura legada foi exercitada em uma
  transação revertida; a coluna original foi preservada após a rejeição esperada.
- O endereço remoto configurado falhou na resolução DNS nesta máquina. Não foi
  possível validar os dados nem o comportamento do ambiente hospedado.
- No Docker Desktop desta máquina, o coletor de logs Vector reinicia porque não
  alcança o endpoint Docker em IPv6 na porta 2375. Auth, REST, banco, Storage,
  Realtime e Studio estão ativos, mas a coleta de logs local precisa de ajuste.
  Não foi habilitado acesso TCP ao daemon Docker para contornar esse erro.

## Pendências e prioridades

### P0 — antes de disponibilizar para mais usuários

1. Verificar o projeto Supabase remoto e seu endereço. O diagnóstico local de DNS
   não permite concluir se o projeto foi pausado, removido ou se há outro problema.
2. Revisar a exposição de `profiles`: a policy permite leitura de linhas completas
   para autenticados, incluindo e-mail e matrícula. Esconder esses campos no frontend
   não restringe a API. Separar os dados privados com compatibilidade para autores,
   colegas, professores e painel administrativo.
3. Restringir alterações de campos administrativos do perfil no banco. A policy
   de update confere o dono da linha, mas não limita as colunas atualizadas; o
   `status_conta` pode divergir do bloqueio efetivo no Auth.

### P1 — confiabilidade e crescimento

1. Tratar os resultados de todas as gravações da Edge Function. Auth, perfil,
   histórico e auditoria são atualizados separadamente; falhas retornadas pelo
   cliente Supabase em algumas dessas gravações são ignoradas. O rate limit por
   contagem de logs também não é atômico e pode falhar aberto se a leitura falhar.
2. Adotar migrations versionadas e testar RLS com usuários de papéis distintos.
   A proteção adicionada ao schema preserva entregas atuais, mas não migra a versão
   antiga ligada a postagens. Fazer backup antes de aplicar em produção.
3. Paginar tarefas, conteúdos, colegas e listas administrativas. Consultas sem
   paginação ficam sujeitas ao limite de linhas da API. O filtro por curtidas da
   Comunidade ordena somente as publicações já carregadas, não o banco inteiro.
4. Aplicar recuperação de falhas e prevenção de envio duplicado aos demais fluxos
   de edição, publicação, foto de perfil e entrada por código.
5. Garantir limpeza/reconciliação de uploads quando o cadastro do registro falhar,
   evitando arquivos órfãos. Não excluir automaticamente uploads quando a resposta
   de uma gravação for ambígua por falha de rede.

### P2 — manutenção e experiência

1. Testar os fluxos autenticados em navegador, incluindo ambos os temas, teclado,
   leitores de tela, PDF e upload de arquivos reais em ambiente de teste.
2. Consolidar gradualmente a marcação compartilhada do cabeçalho/rodapé, sem impor
   um framework somente para isso. Os scripts globais atuais são suficientes, mas
   requerem cuidado com ordem de carregamento e nomes de funções.
3. Fixar versões dos recursos CDN e avaliar integridade/cache. Hoje o frontend usa
   Supabase JS pela versão principal `@2` e fontes externas por CSS `@import`.
4. Tornar a grade de horário configurável quando houver necessidade de outros
   semestres; hoje ela é explicitamente fixa para 2026/2.

Nenhuma policy ou dado do Supabase remoto foi alterado nesta revisão.

## Acesso para quem usa o mural pela primeira vez

Após esclarecimento do público, foram acrescentados um guia expansível na Comunidade,
atalhos com nomes alinhados às páginas e explicações sobre código de turma, aprovação
de entrada, alcance das publicações e caráter pessoal da marcação de entregas.
As telas vazias de turmas e conteúdos agora indicam o próximo passo. A aba de turmas
passou a informar seu estado a tecnologias assistivas, e os links “Minhas turmas”
abrem diretamente essa aba por fragmento da URL.

Arquivos desta etapa: `comunidade.html`, `turmas.html`, `tarefas.html`, `conteudos.html`,
`vitrine.html`, `js/turmas.js`, `js/conteudos.js`, `css/estilo.css` e este relatório.
O guia foi conferido em uma prévia estática extraída do HTML real, em desktop e celular;
isso verifica apresentação e expansão, sem simular login ou dados da aplicação.
As alterações estão no código local e ainda não foram publicadas no GitHub Pages.

## Simplificação solicitada: três áreas

- Navegação no desktop e no celular reduzida a Avisos, Tarefas e Horários.
- Turmas, códigos, matrículas e aprovação retirados dos fluxos; links antigos
  redirecionam para Avisos, sem apagar registros no Supabase.
- Avisos usa a tabela de publicações existente, mantendo texto, imagem, busca,
  paginação e edição/exclusão pelo autor; recursos de rede social foram retirados.
- Saíram da interface biblioteca, lista de colegas, perfis públicos, seguidores,
  curtidas, comentários, sino de notificações e guia de entrada em turma.
- Tarefas não consulta mais matrículas e não filtra dados por turmas.
- Horários mantém a grade real do semestre e não consulta turmas para exibir professores.
- Login e cadastro apresentam as três funções atuais. O perfil da própria conta e
  o painel administrativo continuam disponíveis pelo menu do avatar.
- Nenhuma tabela ou dado do banco remoto foi apagado. Código e estruturas legadas
  não usados foram mantidos para evitar uma migração destrutiva nesta etapa.
- Alterações locais; não publicadas automaticamente no site hospedado.
- Verificação desta etapa: 29 testes isolados passaram; sintaxe dos 19 scripts,
  referências das 16 páginas e navegação de três áreas conferidas. As telas
  principais não consultam turmas, matrículas ou seguidores. A prévia visual
  foi conferida em desktop e celular, incluindo abertura do formulário pelo teclado.
  Não houve publicação nem teste de gravação no banco remoto nesta etapa.

## Ajustes posteriores solicitados

- Conhecer colegas e os perfis públicos voltaram, com busca e informações de
  apresentação. A navegação passou a quatro áreas; turmas continuam retiradas.
- Alunos e professores publicam recados para uma matéria e uma data. As novas
  colunas são opcionais para preservar avisos gerais e registros antigos.
- A grade compartilhada está em `js/grade.js`. Horários exibe recados dos próximos
  sete dias, ligados à próxima ocorrência da aula; matérias fora da grade aparecem
  em uma seção própria. O formulário recebe matéria/data pelo atalho de cada aula.
- Patch aditivo aplicado apenas no Supabase local. Teste SQL com RLS confirmou
  publicação por aluno, leitura por outra conta e proteção de autoria. Dados de
  verificação foram revertidos por transação. O patch remoto e a publicação do
  frontend ainda são necessários para habilitar isso no site online.
- Recuperação de senha ganhou um encaminhamento anterior ao SDK para evitar que
  o login automático capture o link. A tela publicada de nova senha já existia e
  foi aberta diretamente no Chrome, com formulário visível, para a pessoa concluir.
  Nenhuma senha foi consultada ou alterada pelo agente.
- Verificação dos ajustes posteriores: 39 testes isolados passaram; sintaxe dos
  21 scripts e referências das 16 páginas verificadas. O teste SQL de recados
  passou com rollback integral, sem contas de verificação persistentes. A prévia
  dos quatro acessos e dos campos de aula foi conferida no desktop e no celular.
- Antes do envio à main, foi verificada a compatibilidade com o banco sem o patch:
  avisos gerais continuam sendo lidos e publicados; recados por matéria exibem a
  pendência de atualização sem perder o texto. A suíte passou a 41 testes, todos
  aprovados. O push do código não aplica alterações ao Supabase remoto.
