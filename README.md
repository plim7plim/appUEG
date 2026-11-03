# Mural UEG Itaberaí

Um mural simples para acompanhar **avisos, tarefas, horários e colegas** do câmpus.
HTML, CSS e JavaScript puro, com Supabase para autenticação e dados. Sem build
ou dependências npm no frontend.

## Como usar

- **Avisos** (`comunidade.html`): leia os recados mais recentes, busque por texto
  e publique um aviso, com imagem opcional. Cada pessoa edita/apaga os próprios avisos.
- **Tarefas** (`tarefas.html`): consulte atividades e prazos. A marcação de entrega
  é pessoal e não envia trabalhos ao professor. Qualquer pessoa autenticada pode cadastrar atividades.
- **Horários** (`horario.html`): consulte disciplinas, salas e professores da grade
  de Sistemas para Internet, semestre 2026/2, com lembretes de tarefas pendentes.
- **Conhecer colegas** (`colegas.html`): busque alunos e professores por nome e veja suas apresentações e interesses. Perfis públicos não exigem seguir pessoas.
- Foto e dados da conta ficam em **Meu perfil**, no menu do avatar.

Não há fluxo de turmas, código de entrada ou aprovação. A navegação do desktop
  e do celular usa as mesmas quatro áreas. A antiga Comunidade passou a ser Avisos;
curtidas, comentários, seguidores e biblioteca saíram da interface.

## Desenvolvimento local

Com Docker Desktop ativo, Node.js e Python, execute nesta pasta:

```powershell
npx --yes supabase@3.0.0 start
python -m http.server 8000 --bind 127.0.0.1
```

- Site: [http://127.0.0.1:8000](http://127.0.0.1:8000).
- Painel do banco: [http://127.0.0.1:54323](http://127.0.0.1:54323).
- E-mails locais: [http://127.0.0.1:54324](http://127.0.0.1:54324).

A base nova recebe `schema.sql` sem usuários ou dados de demonstração. Cadastre
sua conta pela entrada do site. Contas remotas não são copiadas para a base local.
Em `localhost`/`127.0.0.1`, o frontend usa a API local; no site publicado, usa os
valores remotos de `js/supabase-config.js`. Nunca coloque `service_role` no frontend.

Para parar preservando os dados: `npx --yes supabase@3.0.0 stop`.

## Arquivos principais

```text
index.html                  entrada e cadastro
comunidade.html             avisos (URL preservada para links existentes)
tarefas.html                 atividades e prazos
horario.html                 grade semanal
perfil.html                  dados da conta
js/comum.js                  autenticação e utilidades compartilhadas
js/comunidade.js             consulta, publicação e edição de avisos
js/tarefas.js                tarefas e marcação pessoal de entregas
js/horario.js                grade do semestre e tarefas por disciplina
css/estilo.css               identidade visual, temas e responsividade
schema.sql                   estrutura e políticas do Supabase
supabase/config.toml         ambiente local
tests/fluxos.test.cjs         testes isolados dos fluxos
```

Os avisos continuam na tabela `publicacoes`, preservando os recados e imagens
existentes. Tarefas usa `tarefas` e `entregas`, sem consultar matrículas. Horários
usa a grade já cadastrada no código e tarefas por disciplina, sem consultar turmas.

As URLs antigas de turmas, vitrine e conteúdos redirecionam
para Avisos. Os dados antigos e scripts não carregados por essas páginas foram
preservados para evitar uma migração destrutiva. `schema.sql` ainda contém essas
estruturas: não há necessidade de executá-lo novamente para simplificar a interface.

## Publicação e banco remoto

O frontend pode ser servido no GitHub Pages. Configure os valores remotos em
`js/supabase-config.js` e as URLs permitidas no Supabase Auth. Alterações locais
não são publicadas automaticamente.

O painel administrativo continua restrito aos administradores, acessível pelo menu
da conta. Operações privilegiadas usam `supabase/functions/admin-acoes`, no servidor.
A grade de horário é fixa para 2026/2; atualize `GRADE_SEMESTRE` quando mudar o semestre.

## Verificação

```powershell
node --test tests/fluxos.test.cjs
```

Os testes usam respostas controladas e não criam contas no banco remoto. Também há
cobertura de funções legadas preservadas, embora não façam mais parte da navegação.
Consulte [REVISAO.md](REVISAO.md) para o histórico de correções e limitações conhecidas.

## Recados para uma aula

Alunos e professores podem publicar avisos gerais ou preencher **Matéria** e
**Dia da aula** para um recado compartilhado. A matéria pode ser escolhida entre
as sugestões da grade ou digitada. O recado aparece no mural com a data e também
em Horários quando a aula estiver nos próximos sete dias. Não se repete toda semana.
Recados de matérias fora da grade fixa aparecem na seção de outros recados da semana.
O atalho “Deixar recado para esta aula” preenche matéria e data no formulário.

Antes de publicar esta versão contra uma base já existente, aplique somente
`supabase/patches/20261103_avisos_por_aula.sql` no SQL Editor do projeto correto.
O patch acrescenta colunas e uma validação; não apaga registros nem muda permissões.
A base local desta sessão já recebeu o patch. Novas bases usam o schema atualizado.
Se o frontend for publicado antes do patch, os avisos gerais continuam funcionando.
Tentar cadastrar um recado por matéria informa explicitamente a atualização pendente
e preserva o texto, sem indicar sucesso.

Para testar as permissões localmente com dados revertidos ao final:

```powershell
docker cp tests/avisos-aula.sql supabase_db_appUEG:/tmp/teste-avisos-aula.sql
docker exec supabase_db_appUEG psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/teste-avisos-aula.sql
```

## Recuperação de senha

`js/recuperacao.js` roda antes do SDK Supabase e encaminha links com `type=recovery`
para `redefinir-senha.html`, preservando os parâmetros até a página certa processá-los.
Isso evita que o login automático da entrada leve a pessoa ao mural antes da troca.
No Supabase Auth, permita a URL publicada de `redefinir-senha.html` nos redirects.
O link pode criar uma sessão temporária; a senha só muda ao enviar o formulário.
