// ============================================================
//  Perfil público: bio, seguidores e seguindo
// ============================================================

const USUARIO_ID = param('id');
let USUARIO = null;
let SEGUIDORES = [];
let SEGUINDO_LISTA = [];
let EU_SIGO = false;
let ABERTO_LISTA = null; // 'seguidores' | 'seguindo' | null

(async function inicio() {
  const perfil = await exigirLogin();
  if (!perfil) return;

  if (!USUARIO_ID) {
    window.location.href = 'colegas.html';
    return;
  }

  await carregarUsuario();
})();

async function carregarUsuario() {
  const alvo = document.getElementById('perfilUsuario');

  const { data: usuario, error } = await sb
    .from('profiles')
    .select('id, nome, papel, foto_url, bio, ano_ingresso')
    .eq('id', USUARIO_ID)
    .maybeSingle();

  if (error || !usuario) {
    alvo.innerHTML = `<div class="vazio">Perfil não encontrado.</div>`;
    return;
  }

  USUARIO = usuario;

  const [seguidoresRes, seguindoRes, minhaRelacaoRes] = await Promise.all([
    sb.from('seguidores')
      .select('seguidor:profiles!seguidores_seguidor_id_fkey(id, nome, foto_url, papel)')
      .eq('seguido_id', USUARIO_ID),
    sb.from('seguidores')
      .select('seguido:profiles!seguidores_seguido_id_fkey(id, nome, foto_url, papel)')
      .eq('seguidor_id', USUARIO_ID),
    USUARIO_ID === PERFIL.id
      ? Promise.resolve({ data: null })
      : sb.from('seguidores').select('id').eq('seguidor_id', PERFIL.id).eq('seguido_id', USUARIO_ID).maybeSingle()
  ]);

  SEGUIDORES = (seguidoresRes.data || []).map(s => s.seguidor).filter(Boolean);
  SEGUINDO_LISTA = (seguindoRes.data || []).map(s => s.seguido).filter(Boolean);
  EU_SIGO = !!(minhaRelacaoRes && minhaRelacaoRes.data);

  desenharPerfil();
}

function desenharPerfil() {
  const alvo = document.getElementById('perfilUsuario');
  const ehEu = USUARIO.id === PERFIL.id;
  const ehProf = USUARIO.papel === 'professor';

  alvo.innerHTML = `
    <div class="bloco perfil-cabecalho">
      <img class="avatar avatar-grande" src="${avatarDe(USUARIO)}" alt="">
      <div>
        <h1 style="margin-bottom:4px">${esc(USUARIO.nome)}</h1>
        <span class="etiqueta${ehProf ? ' etiqueta-atividade' : ''}">${ehProf ? 'Professor' : 'Aluno'}</span>
        ${USUARIO.ano_ingresso ? `<span class="etiqueta">Ingresso ${USUARIO.ano_ingresso}</span>` : ''}

        <p class="perfil-bio">${USUARIO.bio ? esc(USUARIO.bio) : '<em>Sem bio ainda.</em>'}</p>

        <div class="contadores">
          <button type="button" class="btn-texto" id="btnVerSeguidores">${SEGUIDORES.length} ${SEGUIDORES.length === 1 ? 'seguidor' : 'seguidores'}</button>
          <button type="button" class="btn-texto" id="btnVerSeguindo">${SEGUINDO_LISTA.length} seguindo</button>
        </div>

        <div style="margin-top:14px">
          ${ehEu
            ? `<a class="btn-linha" href="perfil.html">Editar perfil</a>`
            : `<button type="button" id="btnSeguir">${EU_SIGO ? 'Deixar de seguir' : 'Seguir'}</button>`}
        </div>
      </div>
    </div>

    <div class="bloco${ABERTO_LISTA === 'seguidores' ? '' : ' oculto'}" id="blocoSeguidores" style="margin-top:18px">
      <h2>Seguidores</h2>
      ${listaPessoas(SEGUIDORES, { remover: ehEu })}
    </div>

    <div class="bloco${ABERTO_LISTA === 'seguindo' ? '' : ' oculto'}" id="blocoSeguindo" style="margin-top:18px">
      <h2>Seguindo</h2>
      ${listaPessoas(SEGUINDO_LISTA)}
    </div>
  `;

  ligarBotoesPerfil();
}

function listaPessoas(lista, opcoes = {}) {
  if (!lista.length) {
    return `<p style="font-size:.9rem;color:var(--tinta-fraca);margin-top:10px">Ninguém por aqui ainda.</p>`;
  }
  return `<div class="lista-pessoas-simples" style="margin-top:12px">
    ${lista.map(p => `
      <div class="pessoa-linha">
        <a href="usuario.html?id=${p.id}">
          <img class="avatar avatar-post" src="${avatarDe(p)}" alt="">
          <span>${esc(p.nome)}</span>
        </a>
        ${opcoes.remover ? `<button type="button" class="btn-texto apagar" data-acao="remover-seguidor" data-id="${p.id}">Remover</button>` : ''}
      </div>`).join('')}
  </div>`;
}

function ligarBotoesPerfil() {
  const btnSeguidores = document.getElementById('btnVerSeguidores');
  const btnSeguindo = document.getElementById('btnVerSeguindo');

  if (btnSeguidores) {
    btnSeguidores.onclick = () => {
      ABERTO_LISTA = ABERTO_LISTA === 'seguidores' ? null : 'seguidores';
      desenharPerfil();
    };
  }
  if (btnSeguindo) {
    btnSeguindo.onclick = () => {
      ABERTO_LISTA = ABERTO_LISTA === 'seguindo' ? null : 'seguindo';
      desenharPerfil();
    };
  }

  const btnSeguir = document.getElementById('btnSeguir');
  if (btnSeguir) {
    btnSeguir.onclick = async () => {
      btnSeguir.disabled = true;

      if (EU_SIGO) {
        await sb.from('seguidores').delete()
          .eq('seguidor_id', PERFIL.id).eq('seguido_id', USUARIO.id);
      } else {
        await sb.from('seguidores').insert({ seguidor_id: PERFIL.id, seguido_id: USUARIO.id });
      }

      await carregarUsuario();
    };
  }

  document.querySelectorAll('[data-acao=remover-seguidor]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('Remover esse seguidor? A pessoa deixa de te seguir.')) return;
      b.disabled = true;
      await sb.from('seguidores').delete()
        .eq('seguidor_id', b.dataset.id).eq('seguido_id', PERFIL.id);
      await carregarUsuario();
    };
  });
}
