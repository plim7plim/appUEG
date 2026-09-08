// ============================================================
//  Mural da turma: postagens do professor + respostas dos alunos
// ============================================================

const TURMA_ID = param('id');
let TURMA = null;
let SOU_PROFESSOR_DAQUI = false;
const ABERTOS = new Set();     // postagens com respostas expandidas
let POSTS = [];
let RESPOSTAS = {};            // { postagem_id: [respostas] }

(async function inicio() {
  const perfil = await exigirLogin();
  if (!perfil) return;

  if (!TURMA_ID) {
    window.location.href = 'turmas.html';
    return;
  }

  const { data: turma } = await sb
    .from('turmas')
    .select('id, nome, disciplina, codigo, professor_id, criado_em, professor:profiles(nome)')
    .eq('id', TURMA_ID)
    .maybeSingle();

  if (!turma) {
    document.getElementById('turmaNome').textContent = 'Turma não encontrada';
    document.getElementById('mural').innerHTML =
      '<div class="vazio">Esse link não aponta para nenhuma turma.</div>';
    return;
  }

  TURMA = turma;
  SOU_PROFESSOR_DAQUI = turma.professor_id === PERFIL.id;

  // aluno precisa estar matriculado e aprovado
  let statusMatricula = SOU_PROFESSOR_DAQUI ? 'aprovada' : null;
  if (!SOU_PROFESSOR_DAQUI) {
    const { data: m } = await sb.from('matriculas')
      .select('status').eq('turma_id', TURMA_ID).eq('aluno_id', PERFIL.id).maybeSingle();
    statusMatricula = m ? m.status : null;
  }

  document.getElementById('turmaNome').textContent = turma.nome;
  document.getElementById('turmaInfo').textContent =
    (turma.disciplina ? turma.disciplina + ' · ' : '') +
    'Prof. ' + (turma.professor ? turma.professor.nome : '—');

  if (statusMatricula === 'pendente') {
    mostrarAviso('avisoTopo', 'Seu pedido de entrada está pendente de aprovação do professor.');
    document.getElementById('mural').innerHTML =
      '<div class="vazio">O mural fica visível depois que o professor aprovar sua entrada.</div>';
    document.getElementById('painelLateral').classList.add('oculto');
    return;
  }

  if (statusMatricula !== 'aprovada') {
    mostrarAviso('avisoTopo', 'Você não está matriculado nesta turma. Entre pelo código ou peça na vitrine de turmas.');
    document.getElementById('mural').innerHTML =
      '<div class="vazio">O mural fica visível depois que você entrar na turma.</div>';
    document.getElementById('painelLateral').classList.add('oculto');
    return;
  }

  if (SOU_PROFESSOR_DAQUI) {
    document.getElementById('painelPublicar').classList.remove('oculto');
    document.getElementById('painelPedidos').classList.remove('oculto');
    await carregarPedidos();
  }

  await montarLateral();
  await carregarMural();
  ligarTempoReal();
})();

// ------------------------------------------------------------
//  Pedidos de entrada (professor aprova/recusa)
// ------------------------------------------------------------
async function carregarPedidos() {
  const alvo = document.getElementById('listaPedidos');

  const { data, error } = await sb
    .from('matriculas')
    .select('id, criado_em, aluno:profiles(nome, matricula)')
    .eq('turma_id', TURMA_ID)
    .eq('status', 'pendente')
    .order('criado_em', { ascending: true });

  if (error) {
    alvo.innerHTML = `<div class="vazio">Não foi possível carregar os pedidos. ${esc(error.message)}</div>`;
    return;
  }

  const pedidos = (data || []).filter(p => p.aluno);
  if (!pedidos.length) {
    alvo.innerHTML = `<p style="font-size:.9rem;color:var(--tinta-fraca)">Nenhum pedido pendente.</p>`;
    return;
  }

  alvo.innerHTML = pedidos.map(p => `
    <li>
      ${esc(p.aluno.nome)}
      ${p.aluno.matricula ? `<small>Matrícula ${esc(p.aluno.matricula)}</small>` : ''}
      <div style="margin-top:6px;display:flex;gap:10px">
        <button type="button" class="btn-texto" data-acao="aprovar-pedido" data-id="${p.id}">Aprovar</button>
        <button type="button" class="btn-texto apagar" data-acao="recusar-pedido" data-id="${p.id}">Recusar</button>
      </div>
    </li>`).join('');

  document.querySelectorAll('[data-acao=aprovar-pedido]').forEach(b => {
    b.onclick = async () => {
      const { error } = await sb.from('matriculas').update({ status: 'aprovada' }).eq('id', b.dataset.id);
      if (error) mostrarAviso('avisoTopo', 'Não deu para aprovar: ' + error.message);
      await carregarPedidos();
      await montarLateral();
    };
  });

  document.querySelectorAll('[data-acao=recusar-pedido]').forEach(b => {
    b.onclick = async () => {
      const { error } = await sb.from('matriculas').delete().eq('id', b.dataset.id);
      if (error) mostrarAviso('avisoTopo', 'Não deu para recusar: ' + error.message);
      await carregarPedidos();
    };
  });
}

// ------------------------------------------------------------
//  Lateral
// ------------------------------------------------------------
async function montarLateral() {
  const alvo = document.getElementById('lateralInfo');

  let html = `<p style="font-size:.9rem">Código de entrada:
      <span class="codigo">${esc(TURMA.codigo)}</span></p>`;

  if (SOU_PROFESSOR_DAQUI) {
    const { data } = await sb
      .from('matriculas')
      .select('criado_em, aluno:profiles(nome, matricula)')
      .eq('turma_id', TURMA_ID)
      .order('criado_em', { ascending: true });

    const alunos = (data || []).filter(m => m.aluno);
    html += `<h2 style="margin-top:18px">Alunos (${alunos.length})</h2>`;
    html += alunos.length
      ? `<ul class="alunos">${alunos.map(m => `
          <li>${esc(m.aluno.nome)}
            ${m.aluno.matricula ? `<small>Matrícula ${esc(m.aluno.matricula)}</small>` : ''}
          </li>`).join('')}</ul>`
      : `<p style="font-size:.9rem;color:var(--tinta-fraca)">Ninguém entrou ainda. Compartilhe o código.</p>`;
  } else {
    html += `<p style="font-size:.88rem;color:var(--tinta-fraca);margin-top:12px">
      Você pode responder qualquer postagem desta turma.</p>
      <button class="btn-linha" id="btnSairTurma" style="margin-top:12px">Sair da turma</button>`;
  }

  alvo.className = '';
  alvo.innerHTML = html;

  const btnSairTurma = document.getElementById('btnSairTurma');
  if (btnSairTurma) {
    btnSairTurma.onclick = async () => {
      if (!confirm('Sair desta turma? Você perde o acesso ao mural.')) return;
      await sb.from('matriculas').delete()
        .eq('turma_id', TURMA_ID).eq('aluno_id', PERFIL.id);
      window.location.href = 'turmas.html';
    };
  }
}

// ------------------------------------------------------------
//  Mural
// ------------------------------------------------------------
async function carregarMural() {
  const { data: posts, error } = await sb
    .from('postagens')
    .select('id, titulo, conteudo, tipo, fixado, data_entrega, criado_em, autor_id, autor:profiles(nome, papel)')
    .eq('turma_id', TURMA_ID)
    .order('fixado', { ascending: false })
    .order('criado_em', { ascending: false });

  const alvo = document.getElementById('mural');

  if (error) {
    alvo.innerHTML = `<div class="vazio">Não foi possível carregar o mural. ${esc(error.message)}</div>`;
    return;
  }

  POSTS = posts || [];
  RESPOSTAS = {};

  if (POSTS.length) {
    const ids = POSTS.map(p => p.id);
    const { data: resp } = await sb
      .from('respostas')
      .select('id, postagem_id, conteudo, criado_em, autor_id, autor:profiles(nome, papel)')
      .in('postagem_id', ids)
      .order('criado_em', { ascending: true });

    (resp || []).forEach(r => {
      (RESPOSTAS[r.postagem_id] = RESPOSTAS[r.postagem_id] || []).push(r);
    });
  }

  desenharMural();
}

function desenharMural() {
  const alvo = document.getElementById('mural');

  if (!POSTS.length) {
    alvo.innerHTML = SOU_PROFESSOR_DAQUI
      ? `<div class="vazio">Mural vazio. Publique o primeiro aviso acima.</div>`
      : `<div class="vazio">O professor ainda não publicou nada nesta turma.</div>`;
    return;
  }

  alvo.innerHTML = POSTS.map(p => {
    const lista = RESPOSTAS[p.id] || [];
    const aberto = ABERTOS.has(p.id);
    const rotulo = { aviso: 'Aviso', material: 'Material', atividade: 'Atividade', duvida: 'Discussão' }[p.tipo] || 'Aviso';

    return `
    <article class="post ${p.fixado ? 'fixado' : ''}" data-tipo="${esc(p.tipo)}">
      <div class="post-topo">
        <h3>${esc(p.titulo)}</h3>
        <span class="etiqueta etiqueta-${esc(p.tipo)}">${rotulo}</span>
        ${p.data_entrega ? `<span class="etiqueta etiqueta-prazo">Entrega ${esc(formatarDataEntrega(p.data_entrega))}</span>` : ''}
        ${p.fixado ? '<span class="etiqueta">Fixado</span>' : ''}
      </div>
      <div class="post-meta">
        ${esc(p.autor ? p.autor.nome : 'Professor')} · ${esc(quando(p.criado_em))}
      </div>
      <div class="post-corpo">${esc(p.conteudo)}</div>

      <div class="post-rodape">
        <button class="btn-texto" data-acao="alternar" data-id="${p.id}">
          ${lista.length ? `${lista.length} ${lista.length === 1 ? 'resposta' : 'respostas'}` : 'Responder'}
          ${aberto ? ' — fechar' : ''}
        </button>
        ${p.autor_id === PERFIL.id
          ? `<button class="btn-texto apagar" data-acao="apagar-post" data-id="${p.id}">Apagar postagem</button>` : ''}
      </div>

      ${aberto ? blocoRespostas(p, lista) : ''}
    </article>`;
  }).join('');

  ligarBotoesDoMural();
}

function formatarDataEntrega(dataISO) {
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}`;
}

function blocoRespostas(post, lista) {
  const itens = lista.map(r => `
    <div class="resposta">
      <div class="resposta-quem">
        ${esc(r.autor ? r.autor.nome : 'Alguém')}
        <em>${r.autor && r.autor.papel === 'professor' ? 'professor · ' : ''}${esc(quando(r.criado_em))}</em>
      </div>
      <div class="resposta-corpo">${esc(r.conteudo)}</div>
      ${(r.autor_id === PERFIL.id || SOU_PROFESSOR_DAQUI)
        ? `<button class="btn-texto" data-acao="apagar-resposta" data-id="${r.id}">Apagar</button>` : ''}
    </div>`).join('');

  return `
  <div class="respostas">
    ${itens || '<p style="font-size:.9rem;color:var(--tinta-fraca);padding:6px 0">Ninguém respondeu ainda. Comece a conversa.</p>'}
    <form class="form-resposta" data-acao="responder" data-id="${post.id}">
      <textarea required placeholder="Escreva sua resposta..." aria-label="Resposta"></textarea>
      <button type="submit">Enviar resposta</button>
    </form>
  </div>`;
}

function ligarBotoesDoMural() {
  document.querySelectorAll('[data-acao=alternar]').forEach(b => {
    b.onclick = () => {
      const id = b.dataset.id;
      ABERTOS.has(id) ? ABERTOS.delete(id) : ABERTOS.add(id);
      desenharMural();
    };
  });

  document.querySelectorAll('[data-acao=apagar-post]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('Apagar esta postagem e todas as respostas dela?')) return;
      const { error } = await sb.from('postagens').delete().eq('id', b.dataset.id);
      if (error) mostrarAviso('avisoTopo', 'Não deu para apagar: ' + error.message);
      await carregarMural();
    };
  });

  document.querySelectorAll('[data-acao=apagar-resposta]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('Apagar esta resposta?')) return;
      const { error } = await sb.from('respostas').delete().eq('id', b.dataset.id);
      if (error) mostrarAviso('avisoTopo', 'Não deu para apagar: ' + error.message);
      await carregarMural();
    };
  });

  document.querySelectorAll('form[data-acao=responder]').forEach(f => {
    f.onsubmit = async (e) => {
      e.preventDefault();
      const texto = f.querySelector('textarea').value.trim();
      if (!texto) return;
      const btn = f.querySelector('button');
      btn.disabled = true;
      btn.textContent = 'Enviando...';

      const { error } = await sb.from('respostas').insert({
        postagem_id: f.dataset.id,
        autor_id: PERFIL.id,
        conteudo: texto
      });

      if (error) {
        mostrarAviso('avisoTopo', 'Não deu para responder: ' + error.message);
        btn.disabled = false;
        btn.textContent = 'Enviar resposta';
        return;
      }
      ABERTOS.add(f.dataset.id);
      await carregarMural();
    };
  });
}

// ------------------------------------------------------------
//  Publicar (professor)
// ------------------------------------------------------------
const formPost = document.getElementById('formPost');
const selTipo = document.getElementById('p_tipo');
const campoDataEntrega = document.getElementById('campoDataEntrega');

if (selTipo && campoDataEntrega) {
  const alternarCampoData = () => {
    campoDataEntrega.classList.toggle('oculto', selTipo.value !== 'atividade');
  };
  selTipo.onchange = alternarCampoData;
  alternarCampoData();
}

if (formPost) {
  formPost.onsubmit = async (e) => {
    e.preventDefault();
    esconderAviso('avisoPost');
    const btn = document.getElementById('btnPublicar');
    btn.disabled = true;
    btn.textContent = 'Publicando...';

    const tipo = document.getElementById('p_tipo').value;
    const dataEntrega = document.getElementById('p_data_entrega').value;

    const { error } = await sb.from('postagens').insert({
      turma_id: TURMA_ID,
      autor_id: PERFIL.id,
      titulo: document.getElementById('p_titulo').value.trim(),
      conteudo: document.getElementById('p_conteudo').value.trim(),
      tipo,
      fixado: document.getElementById('p_fixado').checked,
      data_entrega: (tipo === 'atividade' && dataEntrega) ? dataEntrega : null
    });

    if (error) {
      mostrarAviso('avisoPost', 'Não deu para publicar: ' + error.message);
    } else {
      formPost.reset();
      if (campoDataEntrega) campoDataEntrega.classList.add('oculto');
      mostrarAviso('avisoPost', 'Postagem publicada.', true);
      await carregarMural();
    }

    btn.disabled = false;
    btn.textContent = 'Publicar';
  };
}

// ------------------------------------------------------------
//  Tempo real
// ------------------------------------------------------------
function ligarTempoReal() {
  sb.channel('mural-' + TURMA_ID)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'postagens', filter: 'turma_id=eq.' + TURMA_ID },
      () => carregarMural())
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'respostas' },
      (payload) => {
        const pid = (payload.new && payload.new.postagem_id) ||
                    (payload.old && payload.old.postagem_id);
        if (!pid || POSTS.some(p => p.id === pid)) carregarMural();
      })
    .subscribe();
}
