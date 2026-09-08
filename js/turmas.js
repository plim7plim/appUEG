// ============================================================
//  Turmas: professor cria, aluno entra por código
// ============================================================

(async function inicio() {
  const perfil = await exigirLogin();
  if (!perfil) return;

  if (ehProfessor()) {
    document.getElementById('painelProfessor').classList.remove('oculto');
    document.getElementById('subtitulo').textContent =
      'Turmas que você criou. Passe o código para os alunos entrarem.';
  } else {
    document.getElementById('painelAluno').classList.remove('oculto');
    document.getElementById('subtitulo').textContent =
      'Turmas em que você está matriculado.';
  }

  ligarAbas();
  await carregarFeed();
  await carregarTurmas();
})();

// ---------- abas ----------
function ligarAbas() {
  const abaFeed = document.getElementById('abaFeed');
  const abaMinhasTurmas = document.getElementById('abaMinhasTurmas');
  const secaoFeed = document.getElementById('secaoFeed');
  const secaoMinhasTurmas = document.getElementById('secaoMinhasTurmas');

  abaFeed.onclick = () => {
    abaFeed.classList.add('ativa');
    abaMinhasTurmas.classList.remove('ativa');
    secaoFeed.classList.remove('oculto');
    secaoMinhasTurmas.classList.add('oculto');
  };
  abaMinhasTurmas.onclick = () => {
    abaMinhasTurmas.classList.add('ativa');
    abaFeed.classList.remove('ativa');
    secaoMinhasTurmas.classList.remove('oculto');
    secaoFeed.classList.add('oculto');
  };
}

// ---------- listar ----------
async function carregarTurmas() {
  const alvo = document.getElementById('listaTurmas');

  if (ehProfessor()) {
    const { data, error } = await sb
      .from('turmas')
      .select('id, nome, disciplina, codigo, criado_em, matriculas(count)')
      .eq('professor_id', PERFIL.id)
      .order('criado_em', { ascending: false });

    if (error) {
      alvo.innerHTML = `<div class="vazio">Não foi possível carregar as turmas. ${esc(error.message)}</div>`;
      return;
    }
    if (!data.length) {
      alvo.innerHTML = `<div class="vazio">Nenhuma turma ainda. Crie a primeira ao lado.</div>`;
      return;
    }

    alvo.innerHTML = data.map(t => {
      const qtd = (t.matriculas && t.matriculas[0]) ? t.matriculas[0].count : 0;
      return `
        <a class="turma" href="turma.html?id=${t.id}">
          <h3>${esc(t.nome)}</h3>
          ${t.disciplina ? `<div class="disc">${esc(t.disciplina)}</div>` : ''}
          <div class="meta">
            <span>Código <span class="codigo">${esc(t.codigo)}</span></span>
            <span>${qtd} ${qtd === 1 ? 'aluno' : 'alunos'}</span>
          </div>
        </a>`;
    }).join('');

  } else {
    const { data, error } = await sb
      .from('matriculas')
      .select('status, criado_em, turmas ( id, nome, disciplina, codigo, professor:profiles(nome) )')
      .eq('aluno_id', PERFIL.id)
      .order('criado_em', { ascending: false });

    if (error) {
      alvo.innerHTML = `<div class="vazio">Não foi possível carregar as turmas. ${esc(error.message)}</div>`;
      return;
    }
    const turmas = data.filter(m => m.turmas);
    if (!turmas.length) {
      alvo.innerHTML = `<div class="vazio">Você ainda não está em nenhuma turma. Peça o código ao professor, entre ao lado, ou <a href="vitrine.html">veja todas as turmas</a>.</div>`;
      return;
    }

    alvo.innerHTML = turmas.map(m => {
      const t = m.turmas;
      const pendente = m.status === 'pendente';
      const conteudo = `
        <h3>${esc(t.nome)}</h3>
        ${t.disciplina ? `<div class="disc">${esc(t.disciplina)}</div>` : ''}
        <div class="meta">
          <span>Prof. ${esc(t.professor ? t.professor.nome : '—')}</span>
          ${pendente
            ? `<span class="etiqueta etiqueta-atividade">Aguardando aprovação</span>`
            : `<span>Código <span class="codigo">${esc(t.codigo)}</span></span>`}
        </div>`;
      return pendente
        ? `<div class="turma">${conteudo}</div>`
        : `<a class="turma" href="turma.html?id=${t.id}">${conteudo}</a>`;
    }).join('');
  }
}

// ---------- professor cria turma ----------
const formTurma = document.getElementById('formTurma');
if (formTurma) {
  formTurma.onsubmit = async (e) => {
    e.preventDefault();
    esconderAviso('avisoTurma');
    const btn = document.getElementById('btnCriarTurma');
    btn.disabled = true;
    btn.textContent = 'Criando...';

    const nome = document.getElementById('t_nome').value.trim();
    const disciplina = document.getElementById('t_disciplina').value.trim() || null;

    let erroFinal = null;
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const { error } = await sb.from('turmas').insert({
        nome, disciplina, codigo: gerarCodigo(), professor_id: PERFIL.id
      });
      if (!error) { erroFinal = null; break; }
      erroFinal = error;
      if (error.code !== '23505') break; // 23505 = código repetido, tenta outro
    }

    if (erroFinal) {
      mostrarAviso('avisoTurma', 'Não deu para criar a turma: ' + erroFinal.message);
    } else {
      formTurma.reset();
      mostrarAviso('avisoTurma', 'Turma criada.', true);
      await carregarTurmas();
    }

    btn.disabled = false;
    btn.textContent = 'Criar turma';
  };
}

// ---------- feed geral (postagens de todo o Mural UEG) ----------
async function carregarFeed() {
  const alvo = document.getElementById('feed');
  if (!alvo) return;

  const { data, error } = await sb
    .from('postagens')
    .select('id, turma_id, titulo, conteudo, tipo, criado_em, autor:profiles(nome), turma:turmas(nome)')
    .order('criado_em', { ascending: false })
    .limit(30);

  if (error) {
    alvo.innerHTML = `<div class="vazio">Não foi possível carregar o feed. ${esc(error.message)}</div>`;
    return;
  }
  if (!data.length) {
    alvo.innerHTML = `<div class="vazio">Nenhuma postagem ainda.</div>`;
    return;
  }

  const rotulos = { aviso: 'Aviso', material: 'Material', atividade: 'Atividade', duvida: 'Discussão' };

  alvo.innerHTML = data.map(p => `
    <a class="post feed-item" data-tipo="${esc(p.tipo)}" href="turma.html?id=${p.turma_id}">
      <div class="post-topo">
        <h3>${esc(p.titulo)}</h3>
        <span class="etiqueta etiqueta-${esc(p.tipo)}">${rotulos[p.tipo] || 'Aviso'}</span>
      </div>
      <div class="post-meta">
        ${esc(p.turma ? p.turma.nome : 'Turma')} · ${esc(p.autor ? p.autor.nome : 'Professor')} · ${esc(quando(p.criado_em))}
      </div>
      <div class="post-corpo">${esc(p.conteudo)}</div>
    </a>`).join('');
}

// ---------- aluno entra por código ----------
const formEntrarTurma = document.getElementById('formEntrarTurma');
if (formEntrarTurma) {
  formEntrarTurma.onsubmit = async (e) => {
    e.preventDefault();
    esconderAviso('avisoEntrar');
    const btn = document.getElementById('btnEntrarTurma');
    btn.disabled = true;
    btn.textContent = 'Entrando...';

    const codigo = document.getElementById('a_codigo').value.trim().toUpperCase();

    const { error } = await sb.rpc('entrar_por_codigo', { p_codigo: codigo });

    if (error && /codigo_invalido/i.test(error.message)) {
      mostrarAviso('avisoEntrar', 'Nenhuma turma com esse código. Confira com o professor.');
    } else if (error) {
      mostrarAviso('avisoEntrar', 'Não deu para entrar: ' + error.message);
    } else {
      formEntrarTurma.reset();
      mostrarAviso('avisoEntrar', 'Pronto, você entrou na turma.', true);
      await carregarTurmas();
    }

    btn.disabled = false;
    btn.textContent = 'Entrar na turma';
  };
}
