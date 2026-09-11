// ============================================================
//  Painel administrativo — guarda de acesso e utilidades comuns
//  a todas as páginas admin-*.html
//
//  A proteção de verdade é o RLS: as tabelas administradores,
//  admin_permissoes, contas_bloqueio e admin_logs só deixam a
//  própria pessoa (ou quem tem a permissão certa) ler/gravar —
//  ver schema.sql. O que tem aqui só evita mostrar a tela e manda
//  quem não é admin de volta pra Comunidade.
// ============================================================

let ADMIN_PERMISSOES = [];

// Chama depois de exigirLogin(). Retorna false (e já redireciona)
// se a pessoa logada não for administradora.
async function exigirAdmin() {
  const { data: souAdmin } = await sb
    .from('administradores')
    .select('id')
    .eq('id', PERFIL.id)
    .maybeSingle();

  if (!souAdmin) {
    window.location.href = 'comunidade.html';
    return false;
  }

  const { data: permissoes } = await sb
    .from('admin_permissoes')
    .select('permissao')
    .eq('admin_id', PERFIL.id);

  ADMIN_PERMISSOES = (permissoes || []).map(p => p.permissao);

  aplicarPermissoesNaNav();
  marcarLinkAdminAtivo();
  return true;
}

function temPermissao(perm) {
  return ADMIN_PERMISSOES.includes(perm);
}

// esconde itens da nav/página marcados com data-permissao="..." que a
// pessoa não tem (ex.: link "Logs" some pra admin sem consultar_logs)
function aplicarPermissoesNaNav() {
  document.querySelectorAll('[data-permissao]').forEach(el => {
    if (!temPermissao(el.dataset.permissao)) el.classList.add('oculto');
  });
}

function marcarLinkAdminAtivo() {
  const aqui = location.pathname.split('/').pop();
  document.querySelectorAll('.admin-nav a[href]').forEach(a => {
    a.classList.toggle('ativa', a.getAttribute('href').split('?')[0] === aqui);
  });
}

// ---------- chamada às operações privilegiadas (Edge Function) ----------
// Reset de senha e bloqueio/desbloqueio de conta rodam no servidor do
// Supabase (com a service_role), nunca no navegador — ver
// supabase/functions/admin-acoes. O front só manda a ação e o alvo,
// autenticado com o token da própria sessão; a function confere de novo
// no servidor se quem chamou é admin e tem a permissão certa.
async function chamarAdminAcao(acao, payload = {}) {
  const { data: sessao } = await sb.auth.getSession();
  const token = sessao && sessao.session && sessao.session.access_token;
  if (!token) throw new Error('Sessão expirada. Entre de novo.');

  // reset de senha manda pro backend a URL certa de volta (respeitando
  // onde o site está hospedado, ex.: github.io/appUEG/), a function só
  // aceita se bater com um domínio permitido
  if (acao === 'resetar_senha' && !payload.redirect_to) {
    payload = { ...payload, redirect_to: new URL('redefinir-senha.html', window.location.href).href };
  }

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/admin-acoes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': SUPABASE_KEY
    },
    body: JSON.stringify({ acao, ...payload })
  });

  let corpo = {};
  try { corpo = await resp.json(); } catch (_) { /* resposta vazia */ }

  if (!resp.ok) {
    throw new Error(corpo.erro || 'Não foi possível completar a operação. Tente de novo.');
  }
  return corpo;
}

// ---------- pequenas formatações usadas em várias telas admin ----------

function dataHoraBr(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function etiquetaStatusConta(status) {
  const ativa = status !== 'bloqueada';
  return `<span class="etiqueta ${ativa ? 'etiqueta-ativa' : 'etiqueta-bloqueada'}">${ativa ? 'Ativa' : 'Bloqueada'}</span>`;
}

function etiquetaPapel(papel) {
  return `<span class="etiqueta${papel === 'professor' ? ' etiqueta-professor' : ''}">${papel === 'professor' ? 'Professor' : 'Aluno'}</span>`;
}
