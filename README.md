# Mural UEG Itaberaí

Fórum de turmas: **professor publica**, **aluno vê e responde** — cada um só enxerga as turmas em que está.

Site estático (HTML/CSS/JS puro) + Supabase. Sem build, sem npm, roda direto no GitHub Pages.

```
index.html          login e cadastro
turmas.html         lista de turmas (criar / entrar por código)
turma.html?id=...   mural da turma com postagens e respostas
css/estilo.css
js/supabase-config.js
js/comum.js
js/login.js
js/turmas.js
js/turma.js
sql/schema.sql
```

## Como colocar pra rodar

**1. Criar o projeto no Supabase**

Novo projeto → SQL Editor → cole tudo de `sql/schema.sql` → Run. Isso cria as tabelas, o trigger que gera o perfil no cadastro, as políticas de RLS e liga o realtime.

**2. Desligar confirmação de e-mail** (pra testar sem esperar link)

Authentication → Sign In / Providers → Email → desmarque *Confirm email*.

**3. Preencher as credenciais**

Em `js/supabase-config.js`, troque `SUPABASE_URL` e `SUPABASE_KEY` pelos valores de Settings → API. A chave anon pode ficar no código: quem protege os dados é o RLS.

**4. Subir**

Joga a pasta num repositório e ativa o GitHub Pages. Pra testar local, use um servidor simples (`python -m http.server`) em vez de abrir o arquivo direto — `file://` quebra o login.

## Fluxo de uso

1. Professor cria conta marcando **Professor** → cria a turma → o sistema gera um código de 6 caracteres.
2. Professor passa o código para a turma.
3. Aluno cria conta como **Aluno** → digita o código → entra.
4. Professor publica (aviso, atividade, material ou discussão, com opção de fixar).
5. Todo mundo da turma responde. Novas postagens e respostas aparecem sozinhas, sem recarregar.

## Regras de acesso (RLS)

| Ação | Quem pode |
|---|---|
| Criar turma | Só quem tem papel `professor` |
| Ver postagens | Só professor dono + alunos matriculados |
| Publicar postagem | Só o professor da turma |
| Responder | Qualquer membro da turma |
| Apagar resposta | Autor da resposta ou professor da turma |
| Apagar postagem | Autor da postagem |

Tudo isso é validado no banco, não no navegador — mexer no JS pelo DevTools não fura.

## Ideias pro próximo passo

- Anexar arquivos nas postagens (Supabase Storage)
- Marcar postagem como lida / contador de não lidas
- Professor importar alunos em lote por matrícula
- Notificação por e-mail em nova postagem (Edge Function)
