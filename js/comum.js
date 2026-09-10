// ============================================================
//  Funções usadas por todas as páginas
// ============================================================

let PERFIL = null;

const AVATAR_PADRAO = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
  '<rect width="64" height="64" fill="#dbe4ee"/>' +
  '<circle cx="32" cy="24" r="12" fill="#9fb0c3"/>' +
  '<path d="M10 58c3-14 15-20 22-20s19 6 22 20" fill="#9fb0c3"/>' +
  '</svg>'
);

function avatarDe(pessoa) {
  return esc((pessoa && pessoa.foto_url) || AVATAR_PADRAO);
}

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
    .select('id, nome, email, papel, matricula, foto_url, bio, ano_ingresso, github_url, linkedin_url, linguagem_favorita, areas_favoritas, materias_lecionadas')
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
      bio: null,
      ano_ingresso: null
    };
    await sb.from('profiles').insert(novo);
    PERFIL = novo;
  } else {
    PERFIL = data;
  }

  desenharTopo();
  iniciarNotificacoes();
  ligarTema();
  ligarPerfilMenu();
  return PERFIL;
}

// ---------- modo escuro (segue o sistema até a pessoa escolher manualmente) ----------
function ligarTema() {
  const btn = document.getElementById('btnTema');
  if (!btn) return;

  const sistemaEscuro = window.matchMedia('(prefers-color-scheme: dark)');

  // sem escolha manual salva, o tema "efetivo" é o do sistema — importante
  // pro botão saber pra qual lado alternar mesmo quando ninguém clicou ainda
  const atual = () => {
    const t = document.documentElement.dataset.tema;
    if (t === 'escuro' || t === 'claro') return t;
    return sistemaEscuro.matches ? 'escuro' : 'claro';
  };

  const atualizarAria = () => btn.setAttribute('aria-pressed', String(atual() === 'escuro'));
  atualizarAria();

  btn.onclick = () => {
    const novo = atual() === 'escuro' ? 'claro' : 'escuro';
    document.documentElement.dataset.tema = novo;
    localStorage.setItem('tema', novo);
    atualizarAria();
  };

  // sem escolha manual, muda o sistema com a página aberta: mantém o botão coerente
  sistemaEscuro.addEventListener('change', () => {
    if (!document.documentElement.dataset.tema) atualizarAria();
  });
}

function desenharTopo() {
  const nome = document.getElementById('topoNome');
  const selo = document.getElementById('topoSelo');
  const avatar = document.getElementById('topoAvatar');
  if (avatar) avatar.src = PERFIL.foto_url || AVATAR_PADRAO;
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

// ---------- menu do perfil (avatar no topo) ----------
function ligarPerfilMenu() {
  const btn = document.getElementById('btnPerfil');
  const menu = document.getElementById('perfilMenu');
  if (!btn || !menu) return;

  btn.onclick = (e) => {
    e.stopPropagation();
    const abrindo = menu.classList.contains('oculto');
    menu.classList.toggle('oculto', !abrindo);
    btn.setAttribute('aria-expanded', String(abrindo));
  };

  document.addEventListener('click', (e) => {
    if (!menu.classList.contains('oculto') && !menu.contains(e.target) && e.target !== btn) {
      menu.classList.add('oculto');
      btn.setAttribute('aria-expanded', 'false');
    }
  });
}

// ---------- notificações (sino no topo) ----------

const NOTIF_TEXTO = {
  curtida:    (nome) => `${nome} curtiu sua publicação`,
  comentario: (nome) => `${nome} comentou na sua publicação`,
  resposta:   (nome) => `${nome} respondeu sua postagem`,
  postagem:   (nome, turma) => `${nome} publicou em ${turma || 'uma turma'}`,
  seguidor:   (nome) => `${nome} começou a seguir você`,
  pedido_entrada:    (nome, turma) => `${nome} pediu para entrar em ${turma || 'uma turma'}`,
  entrada_aprovada:  (nome, turma) => `Seu pedido para entrar em ${turma || 'a turma'} foi aprovado`,
  entrada_recusada:  (nome, turma) => `Seu pedido para entrar em ${turma || 'a turma'} foi recusado`
};

function linkNotificacao(n) {
  if (n.tipo === 'curtida' || n.tipo === 'comentario') return 'comunidade.html';
  if (n.tipo === 'resposta' || n.tipo === 'postagem' || n.tipo === 'pedido_entrada' ||
      n.tipo === 'entrada_aprovada' || n.tipo === 'entrada_recusada') {
    return n.turma_id ? `turma.html?id=${n.turma_id}` : 'turmas.html';
  }
  if (n.tipo === 'seguidor') return n.ator_id ? `usuario.html?id=${n.ator_id}` : 'colegas.html';
  return '#';
}

// Liga o sino (abrir/fechar, marcar tudo como lida, realtime); só roda se
// a página tiver a marcação do sino no topo (todas exceto o login).
async function iniciarNotificacoes() {
  const btn = document.getElementById('btnNotif');
  const menu = document.getElementById('notifMenu');
  if (!btn || !menu || !PERFIL) return;

  btn.onclick = (e) => {
    e.stopPropagation();
    const abrindo = menu.classList.contains('oculto');
    menu.classList.toggle('oculto', !abrindo);
    btn.setAttribute('aria-expanded', String(abrindo));
    if (abrindo) carregarNotificacoes();
  };

  document.addEventListener('click', (e) => {
    if (!menu.classList.contains('oculto') && !menu.contains(e.target) && e.target !== btn) {
      menu.classList.add('oculto');
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  const lerTudo = document.getElementById('btnNotifLerTudo');
  if (lerTudo) {
    lerTudo.onclick = async () => {
      await sb.from('notificacoes').update({ lida: true })
        .eq('destinatario_id', PERFIL.id).eq('lida', false);
      atualizarContadorNotif(0);
      document.querySelectorAll('.notif-item.nao-lida').forEach(el => el.classList.remove('nao-lida'));
    };
  }

  await atualizarContadorNotifInicial();
  configurarPushNavegador();

  sb.channel('notificacoes-' + PERFIL.id)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'notificacoes',
      filter: `destinatario_id=eq.${PERFIL.id}`
    }, (payload) => {
      atualizarContadorNotifInicial();
      if (!menu.classList.contains('oculto')) carregarNotificacoes();
      notificarNoNavegador(payload.new);
    })
    .subscribe();
}

// ---------- aviso nativo do navegador (Notification API) ----------
// Só funciona com a aba aberta (em segundo plano vale); não é push de
// verdade — com o navegador fechado não chega nada, isso exigiria Service
// Worker + servidor de push, fora do escopo de um site estático.
const TITULOS_PUSH = {
  curtida:          'Curtiram sua publicação',
  comentario:       'Comentaram na sua publicação',
  resposta:         'Responderam sua postagem',
  postagem:         'Nova postagem numa turma sua',
  seguidor:         'Você tem um novo seguidor',
  pedido_entrada:   'Pedido de entrada numa turma sua',
  entrada_aprovada: 'Seu pedido de entrada foi aprovado',
  entrada_recusada: 'Seu pedido de entrada foi recusado'
};

function configurarPushNavegador() {
  const banner = document.getElementById('notifPush');
  const btn = document.getElementById('btnAtivarPush');
  if (!banner || !btn || !('Notification' in window)) return;

  if (Notification.permission === 'default') banner.classList.remove('oculto');

  btn.onclick = async () => {
    btn.disabled = true;
    await Notification.requestPermission();
    banner.classList.add('oculto');
  };
}

function notificarNoNavegador(n) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return; // já olhando a tela, o sino já basta

  const notif = new Notification('Mural UEG', {
    body: TITULOS_PUSH[n.tipo] || 'Você tem uma notificação nova.',
    icon: 'img/favicon.png',
    tag: 'mural-ueg-notificacao'
  });
  notif.onclick = () => { window.focus(); notif.close(); };
}

async function atualizarContadorNotifInicial() {
  const { count } = await sb.from('notificacoes')
    .select('id', { count: 'exact', head: true })
    .eq('destinatario_id', PERFIL.id).eq('lida', false);
  atualizarContadorNotif(count || 0);
}

function atualizarContadorNotif(n) {
  const contador = document.getElementById('notifContador');
  if (contador) {
    contador.textContent = n > 9 ? '9+' : String(n);
    contador.classList.toggle('oculto', n === 0);
  }
  document.querySelectorAll('.menu-btn').forEach(b => b.classList.toggle('tem-notif', n > 0));
}

async function carregarNotificacoes() {
  const lista = document.getElementById('notifLista');
  if (!lista) return;
  lista.innerHTML = '<p class="carregando">Carregando...</p>';

  const { data, error } = await sb.from('notificacoes')
    .select('id, tipo, lida, criado_em, ator_id, turma_id, ator:profiles(nome), turma:turmas(nome)')
    .eq('destinatario_id', PERFIL.id)
    .order('criado_em', { ascending: false })
    .limit(30);

  if (error || !data || !data.length) {
    lista.innerHTML = '<p class="notif-vazio">Nenhuma notificação por enquanto.</p>';
    return;
  }

  lista.innerHTML = data.map(n => {
    const nomeAtor = esc((n.ator && n.ator.nome) || 'Alguém');
    const nomeTurma = n.turma && n.turma.nome ? esc(n.turma.nome) : null;
    const gerador = NOTIF_TEXTO[n.tipo];
    const texto = gerador ? gerador(nomeAtor, nomeTurma) : 'Nova notificação';
    return `
      <a href="${esc(linkNotificacao(n))}" class="notif-item${n.lida ? '' : ' nao-lida'}" data-id="${n.id}">
        <span class="notif-item-texto">${texto}</span>
        <span class="notif-item-quando">${esc(quando(n.criado_em))}</span>
      </a>`;
  }).join('');

  lista.querySelectorAll('.notif-item').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.preventDefault();
      const href = el.getAttribute('href');
      el.classList.remove('nao-lida');
      try { await sb.from('notificacoes').update({ lida: true }).eq('id', el.dataset.id); } catch (_) { /* ignora */ }
      window.location.href = href;
    });
  });
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

// ---------- ordenação alfabética (pt-BR, acentos/maiúsculas não importam) ----------
const COLACIONADOR_PT = new Intl.Collator('pt-BR', { sensitivity: 'base' });
function ordenarPorNome(lista, pegarNome = (x) => x.nome) {
  return lista.slice().sort((a, b) => COLACIONADOR_PT.compare(pegarNome(a) || '', pegarNome(b) || ''));
}

// normaliza texto de busca: minúsculas e sem acento, pra "matematica" achar "Matemática"
function normalizarBusca(txt) {
  return String(txt == null ? '' : txt)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

// Só deixa passar link http(s) — evita que um "javascript:..." salvo direto
// na API (sem passar pela normalização do formulário) vire link clicável.
function linkSeguro(url) {
  return url && /^https?:\/\//i.test(url) ? esc(url) : null;
}

// Liga um <input type=file> escondido ao texto que mostra o nome do
// arquivo escolhido (usado com o botão .btn-arquivo customizado).
function ligarCampoArquivo(inputId, nomeId, textoPadrao = 'Nenhum arquivo escolhido') {
  const input = document.getElementById(inputId);
  const nomeEl = document.getElementById(nomeId);
  if (!input || !nomeEl) return;

  input.addEventListener('change', () => {
    const arquivo = input.files[0];
    nomeEl.textContent = arquivo ? arquivo.name : textoPadrao;
    nomeEl.classList.toggle('tem-arquivo', !!arquivo);
  });
}

function limparCampoArquivo(nomeId, textoPadrao = 'Nenhum arquivo escolhido') {
  const nomeEl = document.getElementById(nomeId);
  if (!nomeEl) return;
  nomeEl.textContent = textoPadrao;
  nomeEl.classList.remove('tem-arquivo');
}

function gerarCodigo() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 6; i++) c += letras[Math.floor(Math.random() * letras.length)];
  return c;
}

// ---------- rodapé (presente em toda página) ----------
(function preencherRodape() {
  const ano = document.getElementById('rodapeAno');
  if (ano) ano.textContent = new Date().getFullYear();
})();
