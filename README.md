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
js/comum.js             login, avatar, escape de HTML, campo de arquivo — usado em toda página
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
| `publicacoes`/`curtidas`/`comentarios` (Comunidade) | Feed aberto pra qualquer logado; cada um só apaga o que é seu |
| `seguidores` | Qualquer um vê quem segue quem; só o próprio segue/deixa de seguir |

## Responsivo

Layout pensado pra celular em primeiro lugar: menu do topo vira hambúrguer abaixo de 860px, grids colapsam pra 1 coluna, botões de formulário ficam largura total, e textos longos (bio, nome) quebram dentro do card em vez de estourar o layout.

## Ideias pro próximo passo

- Painel do professor ver quantos alunos já entregaram uma atividade (a entrega hoje é só pessoal — nem o professor vê)
- Marcar postagem como lida / contador de não lidas
- Professor importar alunos em lote por matrícula
- Notificação por e-mail em nova postagem (Edge Function)
- Ano de ingresso (perfil.html): por enquanto só oferece 2026, já que o curso começou esse ano — voltar a mostrar o intervalo de anos quando entrar a próxima turma
