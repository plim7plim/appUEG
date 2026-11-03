-- Aplicar em uma base existente. Não apaga avisos nem altera permissões.
begin;
alter table public.publicacoes add column if not exists disciplina text;
alter table public.publicacoes add column if not exists data_aula date;
alter table public.publicacoes drop constraint if exists publicacoes_aula_check;
alter table public.publicacoes add constraint publicacoes_aula_check check (
  (disciplina is null and data_aula is null)
  or (disciplina is not null and char_length(btrim(disciplina)) between 1 and 100 and data_aula is not null)
);
create index if not exists idx_publicacoes_aula on public.publicacoes(data_aula) where data_aula is not null;
commit;
