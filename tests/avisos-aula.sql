-- Executar apenas na base local de testes. Tudo é revertido ao terminar.
begin;
select set_config('teste.aluno', gen_random_uuid()::text, true);
select set_config('teste.outro', gen_random_uuid()::text, true);
select set_config('teste.aviso', gen_random_uuid()::text, true);
insert into auth.users(id, email, raw_user_meta_data) values
  (current_setting('teste.aluno')::uuid, current_setting('teste.aluno') || '@example.invalid', '{"nome":"Verificação de aluno","papel":"aluno"}'),
  (current_setting('teste.outro')::uuid, current_setting('teste.outro') || '@example.invalid', '{"nome":"Verificação de outra conta","papel":"aluno"}');
select set_config('request.jwt.claim.sub', current_setting('teste.aluno'), true);
set local role authenticated;
insert into public.publicacoes(id, autor_id, conteudo, disciplina, data_aula)
values (current_setting('teste.aviso')::uuid, auth.uid(), 'Recado de verificação', 'Banco de Dados', '2026-11-09');
do $$
begin
  if not exists (select 1 from public.publicacoes where id = current_setting('teste.aviso')::uuid and disciplina = 'Banco de Dados') then
    raise exception 'Aluno não conseguiu ler o próprio recado';
  end if;
  update public.publicacoes set conteudo = 'Recado atualizado na verificação' where id = current_setting('teste.aviso')::uuid;
  if not found then raise exception 'Aluno não conseguiu editar o próprio recado'; end if;
  begin
    insert into public.publicacoes(autor_id, conteudo) values (current_setting('teste.outro')::uuid, 'Não deve ser gravado');
    raise exception 'Foi permitido publicar em nome de outra conta';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.publicacoes(autor_id, conteudo, disciplina) values (auth.uid(), 'Não deve ser gravado', 'Banco de Dados');
    raise exception 'Foi permitido recado de matéria sem data';
  exception when check_violation then null;
  end;
end $$;
select set_config('request.jwt.claim.sub', current_setting('teste.outro'), true);
do $$
begin
  if not exists (select 1 from public.publicacoes where id = current_setting('teste.aviso')::uuid) then
    raise exception 'Outra conta autenticada não conseguiu ler o recado compartilhado';
  end if;
  delete from public.publicacoes where id = current_setting('teste.aviso')::uuid;
  if found then raise exception 'Outra conta conseguiu apagar o recado do aluno'; end if;
end $$;
reset role;
rollback;
