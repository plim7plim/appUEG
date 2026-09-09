// ============================================================
//  Turmas: professor cria, aluno entra por código
// ============================================================

(async function inicio() {
  const perfil = await exigirLogin();
  if (!perfil) return;

  document.getElementById('painelAluno').classList.remove('oculto');

  if (ehProfessor()) {
    document.getElementById('painelProfessor').classList.remove('oculto');
    document.getElementById('subtitulo').textContent =
      'Turmas que você criou e turmas em que você participa. Passe o código para os alunos entrarem, ou entre em outra turma pelo código.';
    preencherAnosTurma();
  } else {
    document.getElementById('subtitulo').textContent =
      'Turmas em que você está matriculado.';
  }

  ligarAbas();
  await carregarSeguindo();
  await carregarFeed();
  await carregarTurmas();
  ligarTempoRealFeed();
})();

// ---------- quem eu sigo (prioridade no feed) ----------
let SEGUINDO_IDS = new Set();

async function carregarSeguindo() {
  const { data } = await sb.from('seguidores').select('seguido_id').eq('seguidor_id', PERFIL.id);
  SEGUINDO_IDS = new Set((data || []).map(s => s.seguido_id));
}

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

// ---------- ano da turma ----------
function preencherAnosTurma() {
  const sel = document.getElementById('t_ano');
  if (!sel) return;
  const anoAtual = new Date().getFullYear();
  let opts = '';
  for (let ano = anoAtual + 1; ano >= anoAtual - 5; ano--) {
    opts += `<option value="${ano}"${ano === anoAtual ? ' selected' : ''}>${ano}</option>`;
  }
  sel.innerHTML = opts;
}

// ---------- listar ----------
async function carregarTurmas() {
  const alvo = document.getElementById('listaTurmas');

  if (ehProfessor()) {
    const [criadasRes, participaRes] = await Promise.all([
      sb.from('turmas')
        .select('id, nome, disciplina, codigo, criado_em, ano, matriculas(count)')
        .eq('professor_id', PERFIL.id)
        .order('criado_em', { ascending: false }),
      sb.from('matriculas')
        .select('status, criado_em, turmas ( id, nome, disciplina, codigo, ano, professor:profiles(nome) )')
        .eq('aluno_id', PERFIL.id)
        .order('criado_em', { ascending: false })
    ]);

    if (criadasRes.error) {
      alvo.innerHTML = `<div class="vazio">Não foi possível carregar as turmas. ${esc(criadasRes.error.message)}</div>`;
      return;
    }

    const criadas = criadasRes.data || [];
    const participa = (participaRes.data || []).filter(m => m.turmas);

    if (!criadas.length && !participa.length) {
      alvo.innerHTML = `<div class="vazio">Nenhuma turma ainda. Crie a primeira ao lado, ou entre em uma pelo código.</div>`;
      return;
    }

    let html = '';

    if (criadas.length) {
      const grupos = {};
      criadas.forEach(t => {
        const chave = t.ano || 'sem-ano';
        (grupos[chave] = grupos[chave] || []).push(t);
      });

      const anos = Object.keys(grupos).filter(k => k !== 'sem-ano').map(Number).sort((a, b) => b - a);

      anos.forEach(ano => {
        html += `<h2 class="secao-grupo">${ano}</h2><div class="lista-turmas">${grupos[ano].map(cartaoTurmaProfessor).join('')}</div>`;
      });
      if (grupos['sem-ano']) {
        html += `<h2 class="secao-grupo">Ano não informado</h2><div class="lista-turmas">${grupos['sem-ano'].map(cartaoTurmaProfessor).join('')}</div>`;
      }
    }

    if (participa.length) {
      html += `<h2 class="secao-grupo">Turmas em que você participa</h2><div class="lista-turmas">${participa.map(cartaoTurmaMembro).join('')}</div>`;
    }

    alvo.innerHTML = html;

  } else {
    const { data, error } = await sb
      .from('matriculas')
      .select('status, criado_em, turmas ( id, nome, disciplina, codigo, ano, professor:profiles(nome) )')
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

    alvo.innerHTML = turmas.map(cartaoTurmaMembro).join('');
  }
}

function cartaoTurmaMembro(m) {
  const t = m.turmas;
  const pendente = m.status === 'pendente';
  const conteudo = `
    <h3>${esc(t.nome)}</h3>
    ${t.disciplina ? `<div class="disc">${esc(t.disciplina)}</div>` : ''}
    <div class="meta">
      <span>Prof. ${esc(t.professor ? t.professor.nome : '—')}</span>
      ${t.ano ? `<span>${t.ano}</span>` : ''}
      ${pendente
        ? `<span class="etiqueta etiqueta-atividade">Aguardando aprovação</span>`
        : `<span>Código <span class="codigo">${esc(t.codigo)}</span></span>`}
    </div>`;
  return pendente
    ? `<div class="turma">${conteudo}</div>`
    : `<a class="turma" href="turma.html?id=${t.id}">${conteudo}</a>`;
}

function cartaoTurmaProfessor(t) {
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
    const anoValor = document.getElementById('t_ano').value;
    const ano = anoValor ? Number(anoValor) : null;

    let erroFinal = null;
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const { error } = await sb.from('turmas').insert({
        nome, disciplina, ano, codigo: gerarCodigo(), professor_id: PERFIL.id
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
const FEED_LIMIT = 20;
let FEED_POSTS = [];
let FEED_FIM = false;

async function carregarFeed(reset = true) {
  const alvo = document.getElementById('feed');
  if (!alvo) return;

  if (reset) {
    FEED_POSTS = [];
    FEED_FIM = false;
    alvo.innerHTML = '<p class="carregando">Carregando o feed...</p>';
  }

  const { data, error } = await sb
    .from('postagens')
    .select('id, turma_id, titulo, conteudo, tipo, data_aula, anexo_url, anexo_nome, criado_em, autor_id, autor:profiles(nome, foto_url), turma:turmas(nome)')
    .order('criado_em', { ascending: false })
    .range(FEED_POSTS.length, FEED_POSTS.length + FEED_LIMIT - 1);

  if (error) {
    alvo.innerHTML = `<div class="vazio">Não foi possível carregar o feed. ${esc(error.message)}</div>`;
    return;
  }

  FEED_POSTS = FEED_POSTS.concat(data || []);
  FEED_FIM = (data || []).length < FEED_LIMIT;

  desenharFeed();
}

function desenharFeed() {
  const alvo = document.getElementById('feed');
  if (!alvo) return;

  if (!FEED_POSTS.length) {
    alvo.innerHTML = `<div class="vazio">Nenhuma postagem ainda.</div>`;
    return;
  }

  const rotulos = { aviso: 'Aviso', material: 'Material', atividade: 'Atividade', duvida: 'Discussão' };

  // quem eu sigo aparece primeiro, sem embaralhar a ordem cronológica dentro de cada grupo
  const posts = FEED_POSTS.slice().sort((a, b) =>
    (SEGUINDO_IDS.has(a.autor_id) ? 0 : 1) - (SEGUINDO_IDS.has(b.autor_id) ? 0 : 1));

  alvo.innerHTML = posts.map(p => `
    <div class="post feed-item" data-tipo="${esc(p.tipo)}" data-href="turma.html?id=${p.turma_id}">
      <div class="post-topo">
        <h3>${esc(p.titulo)}</h3>
        <span class="etiqueta etiqueta-${esc(p.tipo)}">${rotulos[p.tipo] || 'Aviso'}</span>
        ${p.data_aula ? `<span class="etiqueta etiqueta-aula">Aula ${esc(formatarDataAula(p.data_aula))}</span>` : ''}
        ${SEGUINDO_IDS.has(p.autor_id) ? '<span class="etiqueta etiqueta-seguindo">Seguindo</span>' : ''}
      </div>
      <div class="post-meta post-autor">
        <img class="avatar avatar-post" src="${avatarDe(p.autor)}" alt="">
        <span>${esc(p.turma ? p.turma.nome : 'Turma')} · <a class="link-autor" href="usuario.html?id=${p.autor_id}">${esc(p.autor ? p.autor.nome : 'Professor')}</a> · ${esc(quando(p.criado_em))}</span>
      </div>
      <div class="post-corpo">${esc(p.conteudo)}</div>
      ${p.anexo_url ? `<div class="post-anexo"><a class="anexo-link" href="${esc(p.anexo_url)}" target="_blank" rel="noopener">📎 ${esc(p.anexo_nome || 'Baixar anexo')}</a></div>` : ''}
    </div>`).join('') +
    (FEED_FIM ? '' : `<button type="button" class="btn-linha btn-carregar-mais" id="btnCarregarMaisFeed">Carregar mais</button>`);

  document.querySelectorAll('.feed-item').forEach(card => {
    card.onclick = (e) => {
      if (e.target.closest('a')) return;
      window.location.href = card.dataset.href;
    };
  });

  const btnMais = document.getElementById('btnCarregarMaisFeed');
  if (btnMais) {
    btnMais.onclick = async () => {
      btnMais.disabled = true;
      btnMais.textContent = 'Carregando...';
      await carregarFeed(false);
    };
  }
}

function formatarDataAula(dataISO) {
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}

function ligarTempoRealFeed() {
  sb.channel('feed-geral')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'postagens' },
      () => carregarFeed(true))
    .subscribe();
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
