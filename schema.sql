-- ============================================================
--  MURAL UEG ITABERAÍ - schema completo
--  Cole tudo isso no SQL Editor do Supabase e rode uma vez.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- TABELAS
-- ------------------------------------------------------------

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nome       text not null,
  email      text,
  papel      text not null default 'aluno' check (papel in ('aluno','professor')),
  matricula  text,
  foto_url   text,
  bio        text,
  criado_em  timestamptz not null default now()
);

alter table public.profiles add column if not exists foto_url text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists ano_ingresso int;
alter table public.profiles add column if not exists github_url text;
alter table public.profiles add column if not exists linkedin_url text;
alter table public.profiles add column if not exists linguagem_favorita text;
alter table public.profiles add column if not exists areas_favoritas text[];

create table if not exists public.turmas (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  disciplina   text,
  codigo       text not null unique,
  professor_id uuid not null references public.profiles(id) on delete cascade,
  criado_em    timestamptz not null default now(),
  ano          int
);

alter table public.turmas add column if not exists ano int;

create table if not exists public.matriculas (
  id        uuid primary key default gen_random_uuid(),
  turma_id  uuid not null references public.turmas(id) on delete cascade,
  aluno_id  uuid not null references public.profiles(id) on delete cascade,
  status    text not null default 'aprovada' check (status in ('pendente','aprovada')),
  criado_em timestamptz not null default now(),
  unique (turma_id, aluno_id)
);

alter table public.matriculas add column if not exists status text not null default 'aprovada';
alter table public.matriculas drop constraint if exists matriculas_status_check;
alter table public.matriculas add constraint matriculas_status_check check (status in ('pendente','aprovada'));
-- "pode_publicar" era do sistema antigo de tarefas dentro de turma (removido,
-- ver tabela "tarefas" mais abaixo, que é independente de turma/matrícula)
alter table public.matriculas drop column if exists pode_publicar;

create table if not exists public.postagens (
  id           uuid primary key default gen_random_uuid(),
  turma_id     uuid not null references public.turmas(id) on delete cascade,
  autor_id     uuid not null references public.profiles(id) on delete cascade,
  titulo       text not null,
  conteudo     text not null,
  tipo         text not null default 'aviso' check (tipo in ('aviso','material','atividade','duvida')),
  fixado       boolean not null default false,
  data_entrega date,
  criado_em    timestamptz not null default now()
);

alter table public.postagens add column if not exists data_entrega date;
alter table public.postagens add column if not exists data_aula date;
alter table public.postagens add column if not exists anexo_url text;
alter table public.postagens add column if not exists anexo_nome text;

create table if not exists public.respostas (
  id          uuid primary key default gen_random_uuid(),
  postagem_id uuid not null references public.postagens(id) on delete cascade,
  autor_id    uuid not null references public.profiles(id) on delete cascade,
  conteudo    text not null,
  criado_em   timestamptz not null default now()
);

-- atividades soltas: qualquer aluno ou professor cadastra, sem precisar
-- estar matriculado em turma nenhuma; disciplina/professor são só texto
-- livre (servem pra filtrar a busca, não travam quem pode postar)
create table if not exists public.tarefas (
  id           uuid primary key default gen_random_uuid(),
  autor_id     uuid not null references public.profiles(id) on delete cascade,
  titulo       text not null,
  descricao    text,
  disciplina   text,
  professor    text,
  data_entrega date,
  criado_em    timestamptz not null default now()
);

-- se a versão anterior (ligada a postagens de turma) já foi criada,
-- substitui pela versão ligada a "tarefas" abaixo
drop table if exists public.entregas;

-- entrega de cada aluno numa atividade: um registro por aluno+atividade,
-- visível e editável só por quem marcou (é uma lista pessoal de check-in)
create table if not exists public.entregas (
  id            uuid primary key default gen_random_uuid(),
  tarefa_id     uuid not null references public.tarefas(id) on delete cascade,
  aluno_id      uuid not null references public.profiles(id) on delete cascade,
  entregue      boolean not null default false,
  atualizado_em timestamptz not null default now(),
  unique (tarefa_id, aluno_id)
);

create table if not exists public.seguidores (
  id          uuid primary key default gen_random_uuid(),
  seguidor_id uuid not null references public.profiles(id) on delete cascade,
  seguido_id  uuid not null references public.profiles(id) on delete cascade,
  criado_em   timestamptz not null default now(),
  unique (seguidor_id, seguido_id),
  check (seguidor_id <> seguido_id)
);

create table if not exists public.publicacoes (
  id         uuid primary key default gen_random_uuid(),
  autor_id   uuid not null references public.profiles(id) on delete cascade,
  conteudo   text not null,
  imagem_url text,
  criado_em  timestamptz not null default now()
);

create table if not exists public.curtidas (
  id            uuid primary key default gen_random_uuid(),
  publicacao_id uuid not null references public.publicacoes(id) on delete cascade,
  usuario_id    uuid not null references public.profiles(id) on delete cascade,
  criado_em     timestamptz not null default now(),
  unique (publicacao_id, usuario_id)
);

create table if not exists public.comentarios (
  id            uuid primary key default gen_random_uuid(),
  publicacao_id uuid not null references public.publicacoes(id) on delete cascade,
  autor_id      uuid not null references public.profiles(id) on delete cascade,
  conteudo      text not null,
  criado_em     timestamptz not null default now()
);

create index if not exists idx_matriculas_aluno    on public.matriculas(aluno_id);
create index if not exists idx_matriculas_turma    on public.matriculas(turma_id);
create index if not exists idx_postagens_turma     on public.postagens(turma_id, criado_em desc);
drop index if exists idx_postagens_tarefas;
create index if not exists idx_respostas_postagem  on public.respostas(postagem_id, criado_em);
create index if not exists idx_tarefas_data        on public.tarefas(data_entrega);
create index if not exists idx_entregas_tarefa     on public.entregas(tarefa_id);
create index if not exists idx_entregas_aluno      on public.entregas(aluno_id);
create index if not exists idx_seguidores_seguidor on public.seguidores(seguidor_id);
create index if not exists idx_seguidores_seguido  on public.seguidores(seguido_id);
create index if not exists idx_publicacoes_criado   on public.publicacoes(criado_em desc);
create index if not exists idx_curtidas_publicacao  on public.curtidas(publicacao_id);
create index if not exists idx_comentarios_publicacao on public.comentarios(publicacao_id, criado_em);

-- ------------------------------------------------------------
-- PERFIL AUTOMÁTICO AO CRIAR CONTA
-- ------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email, papel, matricula)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'nome',''), split_part(new.email,'@',1)),
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'papel',''), 'aluno'),
    nullif(new.raw_user_meta_data->>'matricula','')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- FUNÇÕES AUXILIARES (evitam recursão infinita nas policies)
-- ------------------------------------------------------------

create or replace function public.meu_papel()
returns text language sql stable security definer set search_path = public as $$
  select papel from public.profiles where id = auth.uid();
$$;

create or replace function public.eh_professor_da_turma(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.turmas where id = t and professor_id = auth.uid());
$$;

create or replace function public.eh_membro_da_turma(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.turmas     where id = t        and professor_id = auth.uid())
      or exists (select 1 from public.matriculas where turma_id = t  and aluno_id = auth.uid() and status = 'aprovada');
$$;

-- entrada por código: único caminho que grava matrícula já aprovada
create or replace function public.entrar_por_codigo(p_codigo text)
returns public.matriculas
language plpgsql security definer set search_path = public as $$
declare
  v_turma_id uuid;
  v_row public.matriculas;
begin
  select id into v_turma_id from public.turmas where codigo = upper(p_codigo);
  if v_turma_id is null then
    raise exception 'codigo_invalido';
  end if;

  insert into public.matriculas (turma_id, aluno_id, status)
  values (v_turma_id, auth.uid(), 'aprovada')
  on conflict (turma_id, aluno_id) do update set status = 'aprovada'
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.turma_da_postagem(p uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select turma_id from public.postagens where id = p;
$$;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------

alter table public.profiles   enable row level security;
alter table public.turmas     enable row level security;
alter table public.matriculas enable row level security;
alter table public.postagens  enable row level security;
alter table public.respostas  enable row level security;
alter table public.tarefas    enable row level security;
alter table public.entregas   enable row level security;
alter table public.seguidores enable row level security;
alter table public.publicacoes enable row level security;
alter table public.curtidas    enable row level security;
alter table public.comentarios enable row level security;

-- perfis: todo mundo logado enxerga nome/papel (precisa pra mostrar autor)
drop policy if exists p_profiles_select on public.profiles;
create policy p_profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists p_profiles_insert on public.profiles;
create policy p_profiles_insert on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists p_profiles_update on public.profiles;
create policy p_profiles_update on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- turmas: leitura liberada (aluno precisa achar a turma pelo código)
drop policy if exists p_turmas_select on public.turmas;
create policy p_turmas_select on public.turmas
  for select to authenticated using (true);

drop policy if exists p_turmas_insert on public.turmas;
create policy p_turmas_insert on public.turmas
  for insert to authenticated
  with check (professor_id = auth.uid() and public.meu_papel() = 'professor');

drop policy if exists p_turmas_update on public.turmas;
create policy p_turmas_update on public.turmas
  for update to authenticated
  using (professor_id = auth.uid()) with check (professor_id = auth.uid());

drop policy if exists p_turmas_delete on public.turmas;
create policy p_turmas_delete on public.turmas
  for delete to authenticated using (professor_id = auth.uid());

-- matrículas: o aluno se matricula sozinho pelo código
drop policy if exists p_matriculas_select on public.matriculas;
create policy p_matriculas_select on public.matriculas
  for select to authenticated
  using (aluno_id = auth.uid() or public.eh_professor_da_turma(turma_id));

-- só a função entrar_por_codigo (security definer) grava status 'aprovada';
-- o cliente só pode inserir pedido pendente (vitrine)
drop policy if exists p_matriculas_insert on public.matriculas;
create policy p_matriculas_insert on public.matriculas
  for insert to authenticated with check (aluno_id = auth.uid() and status = 'pendente');

drop policy if exists p_matriculas_update on public.matriculas;
create policy p_matriculas_update on public.matriculas
  for update to authenticated
  using (public.eh_professor_da_turma(turma_id))
  with check (public.eh_professor_da_turma(turma_id));

drop policy if exists p_matriculas_delete on public.matriculas;
create policy p_matriculas_delete on public.matriculas
  for delete to authenticated
  using (aluno_id = auth.uid() or public.eh_professor_da_turma(turma_id));

-- postagens: feed é público pra qualquer logado; só o professor da turma publica
drop policy if exists p_postagens_select on public.postagens;
create policy p_postagens_select on public.postagens
  for select to authenticated using (true);

drop policy if exists p_postagens_insert on public.postagens;
create policy p_postagens_insert on public.postagens
  for insert to authenticated
  with check (autor_id = auth.uid() and public.eh_professor_da_turma(turma_id));

-- só depois de recriar a policy acima (que dependia dela) dá pra remover a
-- função do sistema antigo de tarefas dentro de turma (ver tabela "tarefas")
drop function if exists public.pode_publicar_tarefa(uuid);

drop policy if exists p_postagens_update on public.postagens;
create policy p_postagens_update on public.postagens
  for update to authenticated
  using (autor_id = auth.uid()) with check (autor_id = auth.uid());

drop policy if exists p_postagens_delete on public.postagens;
create policy p_postagens_delete on public.postagens
  for delete to authenticated using (autor_id = auth.uid());

-- tarefas: atividade solta, sem turma — qualquer logado vê e cadastra a sua;
-- só quem cadastrou edita/apaga
drop policy if exists p_tarefas_select on public.tarefas;
create policy p_tarefas_select on public.tarefas
  for select to authenticated using (true);

drop policy if exists p_tarefas_insert on public.tarefas;
create policy p_tarefas_insert on public.tarefas
  for insert to authenticated with check (autor_id = auth.uid());

drop policy if exists p_tarefas_update on public.tarefas;
create policy p_tarefas_update on public.tarefas
  for update to authenticated
  using (autor_id = auth.uid()) with check (autor_id = auth.uid());

drop policy if exists p_tarefas_delete on public.tarefas;
create policy p_tarefas_delete on public.tarefas
  for delete to authenticated using (autor_id = auth.uid());

-- entregas: cada um só vê/marca a própria entrega (lista pessoal de check-in)
drop policy if exists p_entregas_select on public.entregas;
create policy p_entregas_select on public.entregas
  for select to authenticated using (aluno_id = auth.uid());

drop policy if exists p_entregas_insert on public.entregas;
create policy p_entregas_insert on public.entregas
  for insert to authenticated with check (aluno_id = auth.uid());

drop policy if exists p_entregas_update on public.entregas;
create policy p_entregas_update on public.entregas
  for update to authenticated
  using (aluno_id = auth.uid()) with check (aluno_id = auth.uid());

drop policy if exists p_entregas_delete on public.entregas;
create policy p_entregas_delete on public.entregas
  for delete to authenticated using (aluno_id = auth.uid());

-- respostas: qualquer membro da turma responde
drop policy if exists p_respostas_select on public.respostas;
create policy p_respostas_select on public.respostas
  for select to authenticated
  using (public.eh_membro_da_turma(public.turma_da_postagem(postagem_id)));

drop policy if exists p_respostas_insert on public.respostas;
create policy p_respostas_insert on public.respostas
  for insert to authenticated
  with check (
    autor_id = auth.uid()
    and public.eh_membro_da_turma(public.turma_da_postagem(postagem_id))
  );

drop policy if exists p_respostas_delete on public.respostas;
create policy p_respostas_delete on public.respostas
  for delete to authenticated
  using (
    autor_id = auth.uid()
    or public.eh_professor_da_turma(public.turma_da_postagem(postagem_id))
  );

-- seguidores: qualquer um vê quem segue quem; só o próprio segue/deixa de seguir
drop policy if exists p_seguidores_select on public.seguidores;
create policy p_seguidores_select on public.seguidores
  for select to authenticated using (true);

drop policy if exists p_seguidores_insert on public.seguidores;
create policy p_seguidores_insert on public.seguidores
  for insert to authenticated with check (seguidor_id = auth.uid());

drop policy if exists p_seguidores_delete on public.seguidores;
create policy p_seguidores_delete on public.seguidores
  for delete to authenticated using (seguidor_id = auth.uid() or seguido_id = auth.uid());

-- comunidade: feed social aberto — qualquer autenticado publica, curte e comenta
drop policy if exists p_publicacoes_select on public.publicacoes;
create policy p_publicacoes_select on public.publicacoes
  for select to authenticated using (true);

drop policy if exists p_publicacoes_insert on public.publicacoes;
create policy p_publicacoes_insert on public.publicacoes
  for insert to authenticated with check (autor_id = auth.uid());

drop policy if exists p_publicacoes_delete on public.publicacoes;
create policy p_publicacoes_delete on public.publicacoes
  for delete to authenticated using (autor_id = auth.uid());

drop policy if exists p_curtidas_select on public.curtidas;
create policy p_curtidas_select on public.curtidas
  for select to authenticated using (true);

drop policy if exists p_curtidas_insert on public.curtidas;
create policy p_curtidas_insert on public.curtidas
  for insert to authenticated with check (usuario_id = auth.uid());

drop policy if exists p_curtidas_delete on public.curtidas;
create policy p_curtidas_delete on public.curtidas
  for delete to authenticated using (usuario_id = auth.uid());

drop policy if exists p_comentarios_select on public.comentarios;
create policy p_comentarios_select on public.comentarios
  for select to authenticated using (true);

drop policy if exists p_comentarios_insert on public.comentarios;
create policy p_comentarios_insert on public.comentarios
  for insert to authenticated with check (autor_id = auth.uid());

drop policy if exists p_comentarios_delete on public.comentarios;
create policy p_comentarios_delete on public.comentarios
  for delete to authenticated using (autor_id = auth.uid());

-- ------------------------------------------------------------
-- STORAGE (fotos de perfil)
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists p_avatars_select on storage.objects;
create policy p_avatars_select on storage.objects
  for select to public using (bucket_id = 'avatars');

drop policy if exists p_avatars_insert on storage.objects;
create policy p_avatars_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists p_avatars_update on storage.objects;
create policy p_avatars_update on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ------------------------------------------------------------
-- STORAGE (anexos de postagens)
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('materiais', 'materiais', true)
on conflict (id) do nothing;

drop policy if exists p_materiais_select on storage.objects;
create policy p_materiais_select on storage.objects
  for select to public using (bucket_id = 'materiais');

drop policy if exists p_materiais_insert on storage.objects;
create policy p_materiais_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'materiais' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists p_materiais_delete on storage.objects;
create policy p_materiais_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'materiais' and (storage.foldername(name))[1] = auth.uid()::text);

-- ------------------------------------------------------------
-- REALTIME
-- ------------------------------------------------------------

do $$
begin
  begin
    alter publication supabase_realtime add table public.postagens;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.respostas;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.publicacoes;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.comentarios;
  exception when duplicate_object then null;
  end;
end $$;
