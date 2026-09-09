// ============================================================
//  Vitrine: todas as turmas do sistema, aluno pede pra entrar
// ============================================================

(async function inicio() {
  const perfil = await exigirLogin();
  if (!perfil) return;
  await carregarVitrine();
  ligarFormEntrarCodigo();
})();

// ---------- entrar direto pelo código ----------
function ligarFormEntrarCodigo() {
  const form = document.getElementById('formEntrarVitrine');
  if (!form) return;

  form.onsubmit = async (e) => {
    e.preventDefault();
    esconderAviso('avisoEntrarVitrine');
    const btn = document.getElementById('btnEntrarVitrine');
    btn.disabled = true;
    btn.textContent = 'Entrando...';

    const codigo = document.getElementById('v_codigo').value.trim().toUpperCase();

    const { error } = await sb.rpc('entrar_por_codigo', { p_codigo: codigo });

    if (error && /codigo_invalido/i.test(error.message)) {
      mostrarAviso('avisoEntrarVitrine', 'Nenhuma turma com esse código. Confira com o professor.');
    } else if (error) {
      mostrarAviso('avisoEntrarVitrine', 'Não deu para entrar: ' + error.message);
    } else {
      form.reset();
      mostrarAviso('avisoEntrarVitrine', 'Pronto, você entrou na turma.', true);
      await carregarVitrine();
    }

    btn.disabled = false;
    btn.textContent = 'Entrar na turma';
  };
}

async function carregarVitrine() {
  const alvo = document.getElementById('listaVitrine');

  const [turmasRes, matriculasRes] = await Promise.all([
    sb.from('turmas')
      .select('id, nome, disciplina, criado_em, ano, professor_id, professor:profiles(nome)')
      .order('criado_em', { ascending: false }),
    sb.from('matriculas').select('turma_id, status').eq('aluno_id', PERFIL.id)
  ]);

  if (turmasRes.error) {
    alvo.innerHTML = `<div class="vazio">Não foi possível carregar as turmas. ${esc(turmasRes.error.message)}</div>`;
    return;
  }

  const status = {};
  (matriculasRes.data || []).forEach(m => { status[m.turma_id] = m.status; });

  const turmas = turmasRes.data || [];
  if (!turmas.length) {
    alvo.innerHTML = `<div class="vazio">Nenhuma turma criada ainda.</div>`;
    return;
  }

  alvo.innerHTML = turmas.map(t => {
    let acao;
    if (t.professor_id === PERFIL.id) {
      acao = `<span class="etiqueta">Sua turma</span>`;
    } else if (status[t.id] === 'aprovada') {
      acao = `<a class="btn-linha" style="display:inline-block;text-decoration:none" href="turma.html?id=${t.id}">Você já está nessa turma</a>`;
    } else if (status[t.id] === 'pendente') {
      acao = `<span class="etiqueta etiqueta-atividade">Pedido enviado, aguardando o professor</span>`;
    } else if (ehProfessor()) {
      acao = '';
    } else {
      acao = `<button type="button" class="btn-linha" data-acao="pedir" data-id="${t.id}">Pedir para entrar</button>`;
    }

    return `
      <div class="turma">
        <h3>${esc(t.nome)}</h3>
        ${t.disciplina ? `<div class="disc">${esc(t.disciplina)}</div>` : ''}
        <div class="meta">
          <span>Prof. ${esc(t.professor ? t.professor.nome : '—')}</span>
          ${t.ano ? `<span>${t.ano}</span>` : ''}
        </div>
        <div style="margin-top:11px">${acao}</div>
      </div>`;
  }).join('');

  document.querySelectorAll('[data-acao=pedir]').forEach(b => {
    b.onclick = async () => {
      b.disabled = true;
      b.textContent = 'Enviando...';

      const { error } = await sb.from('matriculas')
        .insert({ turma_id: b.dataset.id, aluno_id: PERFIL.id, status: 'pendente' });

      if (error && error.code === '23505') {
        mostrarAviso('avisoVitrine', 'Você já tem uma solicitação para essa turma.');
        await carregarVitrine();
      } else if (error) {
        mostrarAviso('avisoVitrine', 'Não deu para enviar o pedido: ' + error.message);
        b.disabled = false;
        b.textContent = 'Pedir para entrar';
      } else {
        mostrarAviso('avisoVitrine', 'Pedido enviado. Aguarde o professor aprovar.', true);
        await carregarVitrine();
      }
    };
  });
}
