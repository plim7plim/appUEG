// ============================================================
//  Perfil público: apresentação, interesses e links compartilhados
// ============================================================

const USUARIO_ID = param('id');
let USUARIO = null;

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

  try {
    const { data: usuario, error } = await sb
      .from('profiles')
      .select('id, nome, papel, foto_url, bio, ano_ingresso, github_url, linkedin_url, linguagem_favorita, areas_favoritas, materias_lecionadas')
      .eq('id', USUARIO_ID)
      .maybeSingle();

    if (error) throw error;
    if (!usuario) {
      alvo.innerHTML = `<div class="vazio">Perfil não encontrado.</div>`;
      return;
    }

    USUARIO = usuario;

    desenharPerfil();
  } catch (_) {
    alvo.innerHTML = '<div class="vazio" role="alert">Não foi possível carregar o perfil. Recarregue para tentar novamente.</div>';
  }
}

function desenharPerfil() {
  const alvo = document.getElementById('perfilUsuario');
  const ehEu = USUARIO.id === PERFIL.id;
  const ehProf = USUARIO.papel === 'professor';

  alvo.innerHTML = `
    <div class="bloco perfil-cabecalho">
      <div class="perfil-capa"></div>
      <img class="avatar avatar-grande" src="${avatarDe(USUARIO)}" alt="">
      <div class="perfil-corpo">
        <h1 style="margin-bottom:4px">${esc(USUARIO.nome)}</h1>
        <span class="etiqueta${ehProf ? ' etiqueta-atividade' : ''}">${ehProf ? 'Professor' : 'Aluno'}</span>
        ${USUARIO.ano_ingresso ? `<span class="etiqueta">Ingresso ${USUARIO.ano_ingresso}</span>` : ''}

        <p class="perfil-bio">${USUARIO.bio ? esc(USUARIO.bio) : '<em>Sem bio ainda.</em>'}</p>

        ${materiasLecionadas(USUARIO)}
        ${interessesTI(USUARIO)}
        ${redesSociais(USUARIO)}

        ${ehEu ? '<a class="btn-linha" href="perfil.html">Editar meu perfil</a>' : ''}
      </div>
    </div>`;
}

const ICONE_GITHUB = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`;
const ICONE_LINKEDIN = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.446-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z"/></svg>`;

function materiasLecionadas(usuario) {
  if (usuario.papel !== 'professor') return '';
  const materias = usuario.materias_lecionadas || [];
  if (!materias.length) return '';

  return `<div class="perfil-interesses">
    ${materias.map(m => `<span class="etiqueta etiqueta-atividade">${esc(m)}</span>`).join('')}
  </div>`;
}

function interessesTI(usuario) {
  const linguagem = usuario.linguagem_favorita;
  const areas = usuario.areas_favoritas || [];
  if (!linguagem && !areas.length) return '';

  return `<div class="perfil-interesses">
    ${linguagem ? `<span class="etiqueta etiqueta-atividade">${esc(linguagem)}</span>` : ''}
    ${areas.map(a => `<span class="etiqueta">${esc(a)}</span>`).join('')}
  </div>`;
}

function redesSociais(usuario) {
  const github = linkSeguro(usuario.github_url);
  const linkedin = linkSeguro(usuario.linkedin_url);
  if (!github && !linkedin) return '';

  return `<div class="perfil-redes">
    ${github ? `<a class="btn-texto btn-rede" href="${github}" target="_blank" rel="noopener">${ICONE_GITHUB} GitHub</a>` : ''}
    ${linkedin ? `<a class="btn-texto btn-rede" href="${linkedin}" target="_blank" rel="noopener">${ICONE_LINKEDIN} LinkedIn</a>` : ''}
  </div>`;
}
