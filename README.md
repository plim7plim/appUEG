# Mural UEG Itaberaí

Rede social + mural de turmas do Câmpus Itaberaí da UEG: feed geral aberto pra todo mundo, turmas com mural próprio, tarefas soltas com entrega pessoal, perfil, colegas e horário de aula.

Site estático (HTML/CSS/JS puro) + Supabase. Sem build, sem npm, roda direto no GitHub Pages.

```
index.html          login e cadastro
comunidade.html     feed social aberto (página inicial depois do login)
turmas.html         feed das turmas + minhas turmas (criar / entrar por código)
turma.html?id=...   mural de uma turma: postagens, respostas, anexos
vitrine.html        todas as turmas do câmpus (pedir entrada / entrar por código)
tarefas.html        atividades soltas — qualquer um cadastra, sem precisar de turma
colegas.html        alunos e professores agrupados por turma de ingresso
perfil.html         editar minha foto e bio
usuario.html?id=... perfil público de alguém (seguidores/seguindo)
horario.html        grade de horário + professores responsáveis

css/estilo.css
js/supabase-config.js   credenciais do Supabase
js/comum.js             login, avatar, escape de HTML, campo de arquivo, sino de notificações — usado em toda página
js/login.js
js/comunidade.js
js/turmas.js
js/turma.js
js/vitrine.js
js/tarefas.js
js/colegas.js
js/perfil.js
js/usuario.js
js/horario.js

schema.sql          schema completo (tabelas, RLS, storage, realtime)

admin.html                painel administrativo — dashboard
admin-usuarios.html        painel administrativo — lista de usuários
admin-usuario.html?id=...  painel administrativo — detalhes e ações sobre um usuário
admin-logs.html            painel administrativo — segurança e auditoria
redefinir-senha.html       destino do link de redefinição de senha (recuperação própria ou reset por admin)
js/admin.js                guarda de acesso e utilidades do painel administrativo
js/admin-dashboard.js
js/admin-usuarios.js
js/admin-usuario.js
js/admin-logs.js
js/redefinir-senha.js

supabase/functions/admin-acoes/index.ts   Edge Function: reset de senha, bloqueio/desbloqueio de conta
```

## Como colocar pra rodar

**1. Criar o projeto no Supabase**

Novo projeto → SQL Editor → cole tudo de `schema.sql` → Run. Isso cria as tabelas, o trigger que gera o perfil no cadastro, os buckets de storage (`avatars`, `materiais`), as políticas de RLS e liga o realtime.

O arquivo é seguro de rodar de novo em cima de um banco que já tem essas tabelas — todo `create`/`alter`/`drop` usa `if exists`/`if not exists`.

**2. Desligar confirmação de e-mail** (pra testar sem esperar link)

Authentication → Sign In / Providers → Email → desmarque *Confirm email*.

**3. Preencher as credenciais**

Em `js/supabase-config.js`, troque `SUPABASE_URL` e `SUPABASE_KEY` pelos valores de Settings → API. A chave anon pode ficar no código: quem protege os dados é o RLS.

**4. Subir**

Joga a pasta num repositório e ativa o GitHub Pages. Pra testar local, use um servidor simples (`python -m http.server`) em vez de abrir o arquivo direto — `file://` quebra o login.

## Fluxo de uso

1. Pessoa cria conta marcando **Aluno** ou **Professor** → cai direto na Comunidade.
2. Professor cria uma turma (em "Minhas turmas") → o sistema gera um código de 6 caracteres → passa o código pra turma.
3. Aluno entra na turma digitando o código, ou pede entrada pela vitrine de turmas (o professor aprova).
4. Dentro da turma, só o professor publica (aviso, material ou discussão, com anexo e opção de fixar); qualquer membro responde.
5. Qualquer pessoa — aluno ou professor, matriculado em turma ou não — cadastra uma **atividade solta** em Tarefas (disciplina, professor, prazo). Cada um marca a própria entrega; passado o prazo, a atividade sai de "A entregar" e vai pra "Prazo encerrado".
6. Na Comunidade, qualquer um publica, curte (dá pra ver quem curtiu) e comenta, sem precisar de turma.
7. Postagens, respostas, curtidas e o feed social atualizam sozinhos, sem recarregar (Supabase Realtime).
8. O sino no topo avisa quem curtiu/comentou uma publicação, respondeu ou publicou numa turma da pessoa, novo seguidor, pedido de entrada numa turma (pro professor) e aprovação/recusa do pedido (pro aluno) — gerado direto no banco (trigger), não dá pra falsificar pelo navegador.
9. Postagem de turma, atividade solta e publicação da Comunidade podem ser editadas por quem criou, não só apagadas.

## Regras de acesso (RLS)

Tudo abaixo é validado no banco, não no navegador — mexer no JS pelo DevTools não fura.

| Tabela | Regra |
|---|---|
| `turmas` | Leitura liberada pra qualquer logado; só `professor` cria; só o dono edita/apaga |
| `matriculas` | Aluno só enxerga/mexe na própria; professor da turma enxerga todas as da turma; entrada por código grava direto como aprovada, pela vitrine fica pendente até o professor aprovar |
| `postagens` (mural da turma) | Leitura liberada; só o professor da turma publica; autor edita/apaga a própria |
| `respostas` | Qualquer membro da turma responde; apaga quem respondeu ou o professor |
| `tarefas` (atividades soltas) | Qualquer logado vê e cadastra; só quem cadastrou edita/apaga — não depende de turma nem matrícula |
| `entregas` (entregue/não entregue) | Cada um só vê e marca a própria linha — não é visível pra mais ninguém, nem pro professor |
| `publicacoes`/`curtidas`/`comentarios` (Comunidade) | Feed aberto pra qualquer logado; cada um só edita/apaga o que é seu |
| `seguidores` | Qualquer um vê quem segue quem; só o próprio segue/deixa de seguir |
| `notificacoes` | Cada um só vê/marca como lida/apaga a própria; ninguém insere pelo cliente — só as funções de trigger (curtida, comentário, resposta, postagem em turma, novo seguidor, pedido de entrada em turma e aprovação/recusa do pedido) |

## Painel administrativo

Área extra pra quem administra a plataforma — separada do papel `aluno`/`professor`, que continua controlando o resto do site normalmente.

**Como acessar:** `admin.html`. Só aparece um link "Painel administrativo" no menu do avatar (topo) pra quem for admin; qualquer outra pessoa que tentar abrir a URL direto é mandada de volta pra Comunidade — a proteção de verdade é o RLS (as tabelas `administradores`, `admin_permissoes`, `contas_bloqueio` e `admin_logs` só deixam a própria pessoa ler a si mesma, ver `schema.sql`), a checagem no JS é só pra não mostrar a tela.

**Quem pode ser admin:** qualquer conta (aluno ou professor) pode virar administradora — é uma camada à parte, não substitui o papel. Não existe botão para alguém se tornar admin sozinho; o primeiro admin foi inserido manualmente via SQL Editor do Supabase. Para adicionar outro:

```sql
insert into public.administradores (id, criado_por) values ('<uuid do usuário>', '<uuid de quem concedeu>');
insert into public.admin_permissoes (admin_id, permissao, concedido_por) values
  ('<uuid do usuário>', 'visualizar_usuarios', '<uuid de quem concedeu>');
-- repita a segunda linha pra cada permissão: resetar_senha, bloquear_contas,
-- consultar_logs, gerenciar_notificacoes, gerenciar_configuracoes, gerenciar_admins
```

**Permissões por ação** (tabela `admin_permissoes`) — um admin só executa o que tem permissão explícita pra fazer; ninguém concede a si mesmo uma permissão que não tem (a policy de insert exige `gerenciar_admins`, que só quem já tem pode usar).

**Reset de senha e bloqueio/desbloqueio de conta** rodam numa Edge Function (`supabase/functions/admin-acoes`), o único lugar do projeto que usa a `service_role` — nunca no navegador. Ela confere de novo, no servidor, se quem chamou é admin com a permissão certa, aplica um limite de chamadas por admin (anti-abuso) e grava tudo em `admin_logs`. Bloqueio usa a API administrativa do Supabase Auth (`ban_duration`) — a conta realmente não consegue logar, não é só um rótulo na tela.

**Segurança e auditoria** (`admin-logs.html`) mostra o histórico de toda ação administrativa (quem, quando, sobre quem, resultado) pra quem tem a permissão `consultar_logs`.

**Ainda não implementado nesta etapa** (aparecem esmaecidos na navegação do painel, não são links falsos): notificações administrativas, relatórios e configurações.

## Responsivo

Layout pensado pra celular em primeiro lugar: menu do topo vira hambúrguer abaixo de 860px, grids colapsam pra 1 coluna, botões de formulário ficam largura total, e textos longos (bio, nome) quebram dentro do card em vez de estourar o layout.

## Modo escuro

Botão de lua/sol no topo (nas páginas logadas) alterna entre claro e escuro.

- Sem escolha manual, segue o tema do sistema operacional (`prefers-color-scheme`) — muda sozinho se a pessoa trocar o tema do Windows/macOS/celular com a página aberta.
- Ao clicar no botão, a escolha vira manual e fica salva no `localStorage` do navegador, sobrepondo o sistema a partir daí.
- Aplicado antes da página desenhar (script inline no `<head>`), sem piscar claro e depois escurecer.
- O cabeçalho azul também escurece no modo escuro (fica com um tom mais fechado), pra não destoar do resto da página.
- As cores centrais (fundo, texto, bordas, etiquetas, avisos, campos) são todas variáveis CSS — pra ajustar o tom do escuro, ou criar um terceiro tema, basta mexer nos valores em `css/estilo.css` (seção `/* modo escuro */` no fim do arquivo).

## Notificação do navegador

No menu do sino, um banner oferece ativar aviso nativo do navegador (`Notification` API) pra quando chegar uma notificação nova com a aba em segundo plano. Duas limitações importantes:

- Só funciona enquanto a aba do site estiver aberta (mesmo minimizada ou em outra aba) — não é push de verdade.
- Com o navegador fechado não chega nada. Isso exigiria Service Worker + Push API + um servidor (ou Edge Function) pra disparar o push, o que é um projeto à parte — não implementado aqui.

## Ideias pro próximo passo

- Painel do professor ver quantos alunos já entregaram uma atividade (a entrega hoje é só pessoal — nem o professor vê)
- Marcar postagem como lida / contador de não lidas
- Professor importar alunos em lote por matrícula
- Notificação por e-mail em nova postagem (Edge Function)
- Ano de ingresso (perfil.html): por enquanto só oferece 2026, já que o curso começou esse ano — voltar a mostrar o intervalo de anos quando entrar a próxima turma
