// ============================================================
//  Tarefas: atividades soltas, cadastradas por qualquer aluno ou
//  professor — não precisa estar matriculado em turma nenhuma.
//  Disciplina e professor são só texto livre, usados pra filtrar
//  a busca. Cada um marca se já entregou; passado o prazo, a
//  atividade sai de "A entregar" e vai pra "Prazo encerrado".
// ============================================================

let TAREFAS_TODAS = [];
let ENTREGAS_MAP = new Map();
let FILTRO_PROFESSOR = '';
let FILTRO_DISCIPLINA = '';

(async function inicio() {
  const perfil = await exigirLogin();
  if (!perfil) return;

  ligarAbasTarefas();
  ligarBotaoNovaAtividade();
  ligarFormNovaTarefa();
  await carregarTarefas();
})();

// ------------------------------------------------------------
//  Nova atividade
// ------------------------------------------------------------
function ligarBotaoNovaAtividade() {
  const btn = document.getElementById('btnNovaAtividade');
  const painel = document.getElementById('painelNovaTarefa');

  btn.onclick = () => {
    painel.classList.toggle('oculto');
    btn.textContent = painel.classList.contains('oculto') ? '+ Nova atividade' : '— Fechar';
  };
}

function ligarFormNovaTarefa() {
  const form = document.getElementById('formNovaTarefa');
  if (!form) return;

  form.onsubmit = async (e) => {
    e.preventDefault();
    esconderAviso('avisoNovaTarefa');
    const btn = document.getElementById('btnCadastrarTarefa');
    btn.disabled = true;
    btn.textContent = 'Cadastrando...';

    const { error } = await sb.from('tarefas').insert({
      autor_id: PERFIL.id,
      titulo: document.getElementById('nt_titulo').value.trim(),
      disciplina: document.getElementById('nt_disciplina').value.trim() || null,
      professor: document.getElementById('nt_professor').value.trim() || null,
      descricao: document.getElementById('nt_descricao').value.trim() || null,
      data_entrega: document.getElementById('nt_data').value || null
    });

    if (error) {
      mostrarAviso('avisoNovaTarefa', 'Não deu para cadastrar: ' + error.message);
    } else {
      form.reset();
      mostrarAviso('avisoNovaTarefa', 'Atividade cadastrada.', true);
      document.getElementById('painelNovaTarefa').classList.add('oculto');
      document.getElementById('btnNovaAtividade').textContent = '+ Nova atividade';
      document.getElementById('abaPendentes').click();
      await carregarTarefas();
    }

    btn.disabled = false;
    btn.textContent = 'Cadastrar atividade';
  };
}

// ------------------------------------------------------------
//  Abas: a entregar / prazo encerrado
// ------------------------------------------------------------
function ligarAbasTarefas() {
  const abaPendentes = document.getElementById('abaPendentes');
  const abaEncerradas = document.getElementById('abaEncerradas');
  const secaoPendentes = document.getElementById('secaoPendentes');
  const secaoEncerradas = document.getElementById('secaoEncerradas');

  abaPendentes.onclick = () => {
    abaPendentes.classList.add('ativa');
    abaEncerradas.classList.remove('ativa');
    secaoPendentes.classList.remove('oculto');
    secaoEncerradas.classList.add('oculto');
  };
  abaEncerradas.onclick = () => {
    abaEncerradas.classList.add('ativa');
    abaPendentes.classList.remove('ativa');
    secaoEncerradas.classList.remove('oculto');
    secaoPendentes.classList.add('oculto');
  };
}

// ------------------------------------------------------------
//  Carregar e desenhar
// ------------------------------------------------------------
async function carregarTarefas() {
  const alvoPendentes = document.getElementById('listaTarefas');
  const alvoEncerradas = document.getElementById('listaTarefasEncerradas');

  const { data, error } = await sb
    .from('tarefas')
    .select('id, autor_id, titulo, descricao, disciplina, professor, data_entrega, criado_em, autor:profiles(nome)')
    .order('criado_em', { ascending: false });

  if (error) {
    alvoPendentes.innerHTML = `<div class="vazio">Não foi possível carregar as atividades. ${esc(error.message)}</div>`;
    alvoEncerradas.innerHTML = '';
    return;
  }

  TAREFAS_TODAS = data || [];

  const ids = TAREFAS_TODAS.map(t => t.id);
  ENTREGAS_MAP = new Map();
  if (ids.length) {
    const { data: entregas } = await sb
      .from('entregas')
      .select('tarefa_id, entregue')
      .eq('aluno_id', PERFIL.id)
      .in('tarefa_id', ids);
    (entregas || []).forEach(e => ENTREGAS_MAP.set(e.tarefa_id, e.entregue));
  }

  montarFiltros();
  desenharTudo();
}

function montarFiltros() {
  const professores = [...new Set(TAREFAS_TODAS.map(t => t.professor).filter(Boolean))].sort(COLACIONADOR_PT.compare);
  const disciplinas = [...new Set(TAREFAS_TODAS.map(t => t.disciplina).filter(Boolean))].sort(COLACIONADOR_PT.compare);

  const selProf = document.getElementById('filtroProfessor');
  const selDisc = document.getElementById('filtroDisciplina');
  const profAtual = selProf.value;
  const discAtual = selDisc.value;

  selProf.innerHTML = `<option value="">Todos os professores</option>` +
    professores.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
  selDisc.innerHTML = `<option value="">Todas as disciplinas</option>` +
    disciplinas.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');

  if (professores.includes(profAtual)) selProf.value = profAtual;
  if (disciplinas.includes(discAtual)) selDisc.value = discAtual;

  selProf.onchange = () => { FILTRO_PROFESSOR = selProf.value; desenharTudo(); };
  selDisc.onchange = () => { FILTRO_DISCIPLINA = selDisc.value; desenharTudo(); };
}

function desenharTudo() {
  const hojeISO = new Date().toISOString().slice(0, 10);

  const filtradas = TAREFAS_TODAS.filter(t =>
    (!FILTRO_PROFESSOR || t.professor === FILTRO_PROFESSOR) &&
    (!FILTRO_DISCIPLINA || t.disciplina === FILTRO_DISCIPLINA)
  );

  const pendentes = filtradas
    .filter(t => !t.data_entrega || t.data_entrega >= hojeISO)
    .sort((a, b) => (a.data_entrega || '9999-99-99').localeCompare(b.data_entrega || '9999-99-99'));
  const encerradas = filtradas
    .filter(t => t.data_entrega && t.data_entrega < hojeISO)
    .sort((a, b) => b.data_entrega.localeCompare(a.data_entrega));

  desenharSecao(document.getElementById('listaTarefas'), pendentes, 'Nenhuma atividade a entregar no momento.', false);
  desenharSecao(document.getElementById('listaTarefasEncerradas'), encerradas, 'Nenhuma atividade com prazo encerrado.', true);
}

function desenharSecao(alvo, lista, textoVazio, encerrada) {
  if (!lista.length) {
    alvo.innerHTML = `<div class="vazio">${esc(textoVazio)}</div>`;
    return;
  }
  alvo.innerHTML = `<div class="mural">${lista.map(t => cartaoTarefa(t, encerrada)).join('')}</div>`;
  ligarAcoesCartao(alvo);
}

function cartaoTarefa(t, encerrada) {
  const dataTxt = t.data_entrega ? formatarData(t.data_entrega) : 'Sem prazo definido';
  const entregue = !!ENTREGAS_MAP.get(t.id);
  const classeEtiqueta = !t.data_entrega ? '' : encerrada ? ' etiqueta-encerrada' : ' etiqueta-prazo';
  const meta = [
    t.disciplina || null,
    t.professor ? `Prof. ${t.professor}` : null,
    t.autor ? `cadastrado por ${t.autor.nome}` : null
  ].filter(Boolean).join(' · ');

  return `
    <div class="post" data-tipo="atividade">
      <div class="post-topo">
        <h3>${esc(t.titulo)}</h3>
        <span class="etiqueta${classeEtiqueta}">${esc(dataTxt)}</span>
      </div>
      ${meta ? `<div class="post-meta">${esc(meta)}</div>` : ''}
      ${t.descricao ? `<div class="post-corpo">${esc(t.descricao)}</div>` : ''}
      <div class="post-rodape">
        <label class="marcar entrega-marcar">
          <input type="checkbox" data-acao="alternar-entrega" data-id="${t.id}" ${entregue ? 'checked' : ''}>
          <span class="entrega-nao">Não entregue</span>
          <span class="entrega-sim">Entregue</span>
        </label>
        ${t.autor_id === PERFIL.id
          ? `<button type="button" class="btn-texto apagar" data-acao="apagar-tarefa" data-id="${t.id}">Apagar</button>` : ''}
      </div>
    </div>`;
}

function ligarAcoesCartao(alvo) {
  alvo.querySelectorAll('[data-acao=alternar-entrega]').forEach(chk => {
    chk.onchange = async () => {
      const id = chk.dataset.id;
      const entregue = chk.checked;
      chk.disabled = true;

      const { error } = await sb.from('entregas').upsert(
        { tarefa_id: id, aluno_id: PERFIL.id, entregue, atualizado_em: new Date().toISOString() },
        { onConflict: 'tarefa_id,aluno_id' }
      );

      if (error) {
        chk.checked = !entregue;
        mostrarAviso('avisoTarefas', 'Não deu para salvar: ' + error.message);
      } else {
        ENTREGAS_MAP.set(id, entregue);
      }
      chk.disabled = false;
    };
  });

  alvo.querySelectorAll('[data-acao=apagar-tarefa]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('Apagar esta atividade?')) return;
      b.disabled = true;
      const { error } = await sb.from('tarefas').delete().eq('id', b.dataset.id);
      if (error) {
        mostrarAviso('avisoTarefas', 'Não deu para apagar: ' + error.message);
        b.disabled = false;
        return;
      }
      TAREFAS_TODAS = TAREFAS_TODAS.filter(t => t.id !== b.dataset.id);
      desenharTudo();
    };
  });
}

function formatarData(dataISO) {
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}
