// ============================================================
//  Tarefas: atividades de todas as turmas do usuário, com data,
//  professor e o que precisa ser feito.
// ============================================================

(async function inicio() {
  const perfil = await exigirLogin();
  if (!perfil) return;

  document.getElementById('subtituloTarefas').textContent = ehProfessor()
    ? 'Atividades que você publicou em todas as suas turmas.'
    : 'Atividades de todas as turmas em que você está matriculado.';

  await carregarTarefas();
})();

async function turmasDoUsuario() {
  if (ehProfessor()) {
    const { data, error } = await sb
      .from('turmas')
      .select('id')
      .eq('professor_id', PERFIL.id);
    if (error) return { ids: [], error };
    return { ids: (data || []).map(t => t.id), error: null };
  }

  const { data, error } = await sb
    .from('matriculas')
    .select('turma_id')
    .eq('aluno_id', PERFIL.id)
    .eq('status', 'aprovada');
  if (error) return { ids: [], error };
  return { ids: (data || []).map(m => m.turma_id), error: null };
}

async function carregarTarefas() {
  const alvo = document.getElementById('listaTarefas');

  const { ids: turmaIds, error: erroTurmas } = await turmasDoUsuario();
  if (erroTurmas) {
    alvo.innerHTML = `<div class="vazio">Não foi possível carregar suas turmas. ${esc(erroTurmas.message)}</div>`;
    return;
  }
  if (!turmaIds.length) {
    alvo.innerHTML = `<div class="vazio">Você ainda não tem turmas. Entre em uma pela <a href="vitrine.html">vitrine de turmas</a>.</div>`;
    return;
  }

  const hojeISO = new Date().toISOString().slice(0, 10);

  const { data, error } = await sb
    .from('postagens')
    .select('id, turma_id, titulo, conteudo, data_entrega, criado_em, turma:turmas(nome, professor:profiles(nome))')
    .eq('tipo', 'atividade')
    .in('turma_id', turmaIds)
    .or(`data_entrega.is.null,data_entrega.gte.${hojeISO}`)
    .order('data_entrega', { ascending: true, nullsFirst: false })
    .order('criado_em', { ascending: false });

  if (error) {
    alvo.innerHTML = `<div class="vazio">Não foi possível carregar as tarefas. ${esc(error.message)}</div>`;
    return;
  }

  const tarefas = data || [];
  if (!tarefas.length) {
    alvo.innerHTML = `<div class="vazio">Nenhuma atividade pendente. Tarefas com data já vencida saem da lista.</div>`;
    return;
  }

  const comData = tarefas.filter(t => t.data_entrega);
  const semData = tarefas.filter(t => !t.data_entrega);

  let html = '';
  if (comData.length) html += secaoTarefas('A entregar', comData, 'prazo');
  if (semData.length) html += secaoTarefas('Sem data definida', semData, null);

  alvo.innerHTML = html;
}

function secaoTarefas(titulo, lista, classeData) {
  return `
    <h2 style="font-size:1.05rem;margin:22px 0 10px">${esc(titulo)} (${lista.length})</h2>
    <div class="mural">
      ${lista.map(t => cartaoTarefa(t, classeData)).join('')}
    </div>`;
}

function cartaoTarefa(t, classeData) {
  const turmaNome = t.turma ? t.turma.nome : 'Turma';
  const professorNome = t.turma && t.turma.professor ? t.turma.professor.nome : '—';
  const dataTxt = t.data_entrega ? formatarData(t.data_entrega) : 'Sem prazo definido';

  return `
    <a class="post feed-item" data-tipo="atividade" href="turma.html?id=${t.turma_id}">
      <div class="post-topo">
        <h3>${esc(t.titulo)}</h3>
        ${classeData ? `<span class="etiqueta etiqueta-${classeData}">${esc(dataTxt)}</span>` : `<span class="etiqueta">${esc(dataTxt)}</span>`}
      </div>
      <div class="post-meta">${esc(turmaNome)} · Prof. ${esc(professorNome)}</div>
      <div class="post-corpo">${esc(t.conteudo)}</div>
    </a>`;
}

function formatarData(dataISO) {
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}
