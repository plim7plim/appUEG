// ============================================================
//  Funções usadas por todas as páginas
// ============================================================

let PERFIL = null;

async function usuarioAtual() {
  const { data } = await sb.auth.getUser();
  return data.user || null;
}

// Garante que tem login; se não tiver, manda pro index.
// Retorna o perfil (id, nome, papel...).
async function exigirLogin() {
  const user = await usuarioAtual();
  if (!user) {
    window.location.href = 'index.html';
    return null;
  }

  const { data, error } = await sb
    .from('profiles')
    .select('id, nome, email, papel, matricula, foto_url, bio')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !data) {
    // fallback: cria o perfil caso o trigger não tenha rodado
    const meta = user.user_metadata || {};
    const novo = {
      id: user.id,
      nome: meta.nome || (user.email || '').split('@')[0],
      email: user.email,
      papel: meta.papel || 'aluno',
      matricula: meta.matricula || null,
      foto_url: null,
      bio: null
    };
    await sb.from('profiles').insert(novo);
    PERFIL = novo;
  } else {
    PERFIL = data;
  }

  desenharTopo();
  return PERFIL;
}

function desenharTopo() {
  const nome = document.getElementById('topoNome');
  const selo = document.getElementById('topoSelo');
  if (nome) nome.textContent = PERFIL.nome;
  if (selo) {
    selo.textContent = PERFIL.papel === 'professor' ? 'Professor' : 'Aluno';
    selo.className = 'selo' + (PERFIL.papel === 'professor' ? ' selo-professor' : '');
  }
  const sair = document.getElementById('btnSair');
  if (sair) {
    sair.onclick = async (e) => {
      e.preventDefault();
      await sb.auth.signOut();
      window.location.href = 'index.html';
    };
  }
}

function ehProfessor() {
  return PERFIL && PERFIL.papel === 'professor';
}

// ---------- utilidades ----------

function esc(txt) {
  return String(txt == null ? '' : txt)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function quando(iso) {
  const d = new Date(iso);
  const agora = new Date();
  const seg = Math.floor((agora - d) / 1000);

  if (seg < 60) return 'agora mesmo';
  if (seg < 3600) return `há ${Math.floor(seg / 60)} min`;
  if (seg < 86400) return `há ${Math.floor(seg / 3600)} h`;
  if (seg < 172800) return 'ontem';

  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) +
    ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function mostrarAviso(id, texto, ok = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = texto;
  el.className = 'aviso' + (ok ? ' aviso-ok' : '');
  el.classList.remove('oculto');
}

function esconderAviso(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('oculto');
}

function param(nome) {
  return new URLSearchParams(window.location.search).get(nome);
}

function gerarCodigo() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 6; i++) c += letras[Math.floor(Math.random() * letras.length)];
  return c;
}
