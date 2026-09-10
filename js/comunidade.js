// ============================================================
//  Comunidade: feed social aberto — qualquer um publica, curte e comenta
// ============================================================

const SOCIAL_LIMIT = 15;
const SOCIAL_IMAGEM_MAX = 2 * 1024 * 1024;
let POSTS_SOCIAL = [];
let SOCIAL_FIM = false;
let SOCIAL_TOKEN = 0;
let CURTIDAS_MINHAS = new Set();
const COMENTARIOS_SOCIAL = {};
const ABERTOS_COMENTARIOS = new Set();
const CURTIDAS_LISTAS = {};
const ABERTOS_CURTIDAS = new Set();
const EDITANDO_SOCIAL = new Set();
let FILTRO_FEED = 'recentes';
let SEGUINDO_IDS = null;
let MENU_POST_ABERTO = null;

(async function inicio() {
  const perfil = await exigirLogin();
  if (!perfil) return;

  await carregarMinhasCurtidas();
  await carregarFeedSocial(true);
  ligarFormPublicar();
  ligarFiltrosFeed();
  ligarTempoRealSocial();
  ligarLightbox();
  carregarProximosPrazos();
  carregarPessoasComunidade();

  document.addEventListener('click', (e) => {
    if (MENU_POST_ABERTO !== null && !e.target.closest('.post-menu-wrap')) {
      MENU_POST_ABERTO = null;
      desenharFeedSocial();
    }
  });
})();

async function carregarMinhasCurtidas() {
  const { data } = await sb.from('curtidas').select('publicacao_id').eq('usuario_id', PERFIL.id);
  CURTIDAS_MINHAS = new Set((data || []).map(c => c.publicacao_id));
}

async function carregarFeedSocial(reset) {
  const alvo = document.getElementById('feedSocial');
  if (!alvo) return;

  if (reset) {
    SOCIAL_TOKEN++;
    POSTS_SOCIAL = [];
    SOCIAL_FIM = false;
    alvo.innerHTML = '<p class="carregando">Carregando...</p>';
  }
  const meuToken = SOCIAL_TOKEN;
  const desde = POSTS_SOCIAL.length;

  let consulta = sb
    .from('publicacoes')
    .select('id, conteudo, imagem_url, criado_em, autor_id, autor:profiles(nome, foto_url), curtidas(count), comentarios(count)')
    .order('criado_em', { ascending: false })
    .range(desde, desde + SOCIAL_LIMIT - 1);

  if (FILTRO_FEED === 'seguindo') {
    if (SEGUINDO_IDS === null) await carregarSeguindoIds();
    if (!SEGUINDO_IDS.length) {
      SOCIAL_FIM = true;
      desenharFeedSocial();
      return;
    }
    consulta = consulta.in('autor_id', SEGUINDO_IDS);
  }

  const { data, error } = await consulta;

  // uma recarga mais nova (publicar, tempo real) já assumiu enquanto isso rodava — descarta
  if (meuToken !== SOCIAL_TOKEN) return;

  if (error) {
    alvo.innerHTML = `<div class="vazio">Não foi possível carregar a comunidade. ${esc(error.message)}</div>`;
    return;
  }

  const existentes = new Set(POSTS_SOCIAL.map(p => p.id));
  const novos = (data || []).filter(p => !existentes.has(p.id));
  POSTS_SOCIAL = POSTS_SOCIAL.concat(novos);
  SOCIAL_FIM = (data || []).length < SOCIAL_LIMIT;

  desenharFeedSocial();
}

async function carregarSeguindoIds() {
  const { data } = await sb.from('seguidores').select('seguido_id').eq('seguidor_id', PERFIL.id);
  SEGUINDO_IDS = (data || []).map(s => s.seguido_id);
}

function ligarFiltrosFeed() {
  document.querySelectorAll('.filtro-pilula').forEach(b => {
    b.onclick = async () => {
      if (b.dataset.filtro === FILTRO_FEED) return;
      document.querySelectorAll('.filtro-pilula').forEach(x => x.classList.remove('ativa'));
      b.classList.add('ativa');
      FILTRO_FEED = b.dataset.filtro;
      await carregarFeedSocial(true);
    };
  });
}

function ordemParaExibicao(lista) {
  if (FILTRO_FEED !== 'curtidas') return lista;
  return lista.slice().sort((a, b) => {
    const ca = (a.curtidas && a.curtidas[0]) ? a.curtidas[0].count : 0;
    const cb = (b.curtidas && b.curtidas[0]) ? b.curtidas[0].count : 0;
    return cb - ca;
  });
}

function desenharFeedSocial() {
  const alvo = document.getElementById('feedSocial');
  if (!alvo) return;

  if (!POSTS_SOCIAL.length) {
    const vazioTexto = FILTRO_FEED === 'seguindo'
      ? 'Você ainda não segue ninguém — ou quem você segue ainda não publicou nada.'
      : 'Ninguém publicou nada ainda. Seja o primeiro!';
    alvo.innerHTML = `<div class="vazio">${vazioTexto}</div>`;
    return;
  }

  alvo.innerHTML = ordemParaExibicao(POSTS_SOCIAL).map(cartaoSocial).join('') +
    (SOCIAL_FIM ? '' : `<button type="button" class="btn-linha btn-carregar-mais" id="btnCarregarMaisSocial">Carregar mais</button>`);

  ligarBotoesSocial();

  const btnMais = document.getElementById('btnCarregarMaisSocial');
  if (btnMais) {
    btnMais.onclick = async () => {
      btnMais.disabled = true;
      btnMais.textContent = 'Carregando...';
      await carregarFeedSocial(false);
    };
  }
}

// ------------------------------------------------------------
//  Lateral: próximos prazos (tarefas soltas) e pessoas da comunidade
// ------------------------------------------------------------
async function carregarProximosPrazos() {
  const alvo = document.getElementById('prazosLateral');
  if (!alvo) return;

  const hoje = new Date();
  const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

  const { data, error } = await sb.from('tarefas')
    .select('id, titulo, disciplina, data_entrega')
    .gte('data_entrega', hojeISO)
    .order('data_entrega', { ascending: true })
    .limit(3);

  if (error || !data || !data.length) {
    alvo.innerHTML = `<p class="notif-vazio" style="padding:6px 0">Nenhum prazo por enquanto.</p>`;
    return;
  }

  const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  alvo.innerHTML = data.map(t => {
    const [ano, mes, dia] = t.data_entrega.split('-');
    return `
      <div class="prazo-item">
        <div class="prazo-data"><span class="dia">${dia}</span><span class="mes">${MESES[Number(mes) - 1]}</span></div>
        <div class="prazo-info">
          <h3>${esc(t.titulo)}</h3>
          <p>${t.disciplina ? esc(t.disciplina) : 'Sem disciplina informada'}</p>
        </div>
      </div>`;
  }).join('');
}

async function carregarPessoasComunidade() {
  const alvo = document.getElementById('pessoasLateral');
  if (!alvo) return;

  const { data, error } = await sb.from('profiles')
    .select('id, nome, papel, foto_url')
    .neq('id', PERFIL.id)
    .order('criado_em', { ascending: false })
    .limit(5);

  if (error || !data || !data.length) {
    alvo.innerHTML = `<p class="notif-vazio" style="padding:6px 0">Ninguém por aqui ainda.</p>`;
    return;
  }

  alvo.innerHTML = data.map(p => `
    <div class="pessoa-mini">
      <a href="usuario.html?id=${p.id}">
        <img class="avatar" src="${avatarDe(p)}" alt="">
        <span class="pessoa-mini-info">
          <span>${esc(p.nome)}</span>
          <small>${p.papel === 'professor' ? 'Professor' : 'Aluno'}</small>
        </span>
      </a>
    </div>`).join('');
}

function cartaoSocial(p) {
  const curtidas = (p.curtidas && p.curtidas[0]) ? p.curtidas[0].count : 0;
  const comentarios = (p.comentarios && p.comentarios[0]) ? p.comentarios[0].count : 0;
  const euCurti = CURTIDAS_MINHAS.has(p.id);
  const aberto = ABERTOS_COMENTARIOS.has(p.id);
  const curtidasAbertas = ABERTOS_CURTIDAS.has(p.id);

  if (EDITANDO_SOCIAL.has(p.id)) {
    return `
      <article class="post post-social">
        <div class="post-meta post-autor">
          <img class="avatar avatar-post" src="${avatarDe(p.autor)}" alt="">
          <span><a class="link-autor" href="usuario.html?id=${p.autor_id}">${esc(p.autor ? p.autor.nome : 'Alguém')}</a> · ${esc(quando(p.criado_em))}</span>
        </div>
        ${blocoEdicaoSocial(p)}
      </article>`;
  }

  return `
    <article class="post post-social">
      <div class="post-cabecalho">
        <div class="post-meta post-autor">
          <img class="avatar avatar-post" src="${avatarDe(p.autor)}" alt="">
          <span><a class="link-autor" href="usuario.html?id=${p.autor_id}">${esc(p.autor ? p.autor.nome : 'Alguém')}</a> · ${esc(quando(p.criado_em))}</span>
        </div>
        ${p.autor_id === PERFIL.id ? `
        <div class="post-menu-wrap">
          <button type="button" class="post-menu-btn" data-acao="abrir-menu-post" data-id="${p.id}" aria-haspopup="true" aria-expanded="${MENU_POST_ABERTO === p.id}" aria-label="Mais opções da publicação">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/></svg>
          </button>
          <div class="post-menu${MENU_POST_ABERTO === p.id ? '' : ' oculto'}" role="menu">
            <button type="button" role="menuitem" data-acao="editar-social" data-id="${p.id}">Editar</button>
            <button type="button" role="menuitem" class="apagar" data-acao="apagar-social" data-id="${p.id}">Excluir</button>
          </div>
        </div>` : ''}
      </div>
      <div class="post-corpo">${esc(p.conteudo)}</div>
      ${p.imagem_url ? `<img class="post-imagem" src="${esc(p.imagem_url)}" alt="">` : ''}

      <div class="post-rodape">
        <button type="button" class="btn-texto${euCurti ? ' curtido' : ''}" data-acao="curtir" data-id="${p.id}">
          ${euCurti ? '❤ Curtido' : '🤍 Curtir'}
        </button>
        ${curtidas > 0 ? `
        <button type="button" class="btn-texto btn-contagem" data-acao="ver-curtidas" data-id="${p.id}">
          ${curtidas} ${curtidas === 1 ? 'curtida' : 'curtidas'}${curtidasAbertas ? ' — fechar' : ''}
        </button>` : ''}
        <button type="button" class="btn-texto" data-acao="alternar-comentarios" data-id="${p.id}">
          ${comentarios > 0 ? `${comentarios} ${comentarios === 1 ? 'comentário' : 'comentários'}` : 'Comentar'}
          ${aberto ? ' — fechar' : ''}
        </button>
      </div>

      ${curtidasAbertas ? blocoCurtidas(p.id) : ''}
      ${aberto ? blocoComentarios(p.id) : ''}
    </article>`;
}

function blocoEdicaoSocial(p) {
  return `
    <form class="form-edicao" data-acao="salvar-edicao-social" data-id="${p.id}">
      <div class="campo">
        <textarea name="conteudo" required maxlength="1000">${esc(p.conteudo)}</textarea>
      </div>
      ${p.imagem_url ? `<img class="post-imagem" src="${esc(p.imagem_url)}" alt="">` : ''}
      <div class="form-edicao-acoes">
        <button type="submit">Salvar</button>
        <button type="button" class="btn-linha" data-acao="cancelar-edicao-social" data-id="${p.id}">Cancelar</button>
      </div>
    </form>`;
}

function blocoCurtidas(publicacaoId) {
  const lista = CURTIDAS_LISTAS[publicacaoId];

  if (!lista) {
    return `<p class="carregando">Carregando curtidas...</p>`;
  }

  if (!lista.length) {
    return `<p style="font-size:.9rem;color:var(--tinta-fraca);padding:6px 0">Ninguém curtiu ainda.</p>`;
  }

  return `<div class="lista-pessoas-simples" style="margin-top:12px">
    ${lista.map(pessoa => `
      <div class="pessoa-linha">
        <a href="usuario.html?id=${pessoa.id}">
          <img class="avatar avatar-post" src="${avatarDe(pessoa)}" alt="">
          <span>${esc(pessoa.nome)}</span>
        </a>
      </div>`).join('')}
  </div>`;
}

function blocoComentarios(publicacaoId) {
  const lista = COMENTARIOS_SOCIAL[publicacaoId] || [];
  const itens = lista.map(c => `
    <div class="resposta">
      <div class="resposta-quem">
        <img class="avatar avatar-resposta" src="${avatarDe(c.autor)}" alt="">
        <a class="link-autor" href="usuario.html?id=${c.autor_id}">${esc(c.autor ? c.autor.nome : 'Alguém')}</a>
        <em>${esc(quando(c.criado_em))}</em>
      </div>
      <div class="resposta-corpo">${esc(c.conteudo)}</div>
      ${c.autor_id === PERFIL.id
        ? `<button type="button" class="btn-texto" data-acao="apagar-comentario" data-id="${c.id}" data-publicacao="${publicacaoId}">Apagar</button>` : ''}
    </div>`).join('');

  return `
    <div class="respostas">
      ${lista.length ? itens : '<p style="font-size:.9rem;color:var(--tinta-fraca);padding:6px 0">Nenhum comentário ainda.</p>'}
      <form class="form-resposta" data-acao="comentar" data-id="${publicacaoId}">
        <textarea required placeholder="Escreva um comentário..." aria-label="Comentário"></textarea>
        <button type="submit">Comentar</button>
      </form>
    </div>`;
}

function ligarBotoesSocial() {
  document.querySelectorAll('[data-acao=curtir]').forEach(b => {
    b.onclick = async () => {
      if (b.disabled) return;
      const id = b.dataset.id;
      const post = POSTS_SOCIAL.find(p => p.id === id);
      if (!post) return;
      b.disabled = true;

      const jaCurti = CURTIDAS_MINHAS.has(id);
      const { error } = jaCurti
        ? await sb.from('curtidas').delete().eq('publicacao_id', id).eq('usuario_id', PERFIL.id)
        : await sb.from('curtidas').insert({ publicacao_id: id, usuario_id: PERFIL.id });

      if (error) {
        // ignora "já curtida" (corrida com outra aba/clique) — só avisa erros de verdade
        if (error.code !== '23505') mostrarAviso('avisoPublicar', 'Não deu para curtir: ' + error.message);
        b.disabled = false;
        return;
      }

      if (jaCurti) {
        CURTIDAS_MINHAS.delete(id);
        if (post.curtidas && post.curtidas[0]) post.curtidas[0].count = Math.max(0, post.curtidas[0].count - 1);
        if (!post.curtidas || !post.curtidas[0] || post.curtidas[0].count === 0) ABERTOS_CURTIDAS.delete(id);
      } else {
        CURTIDAS_MINHAS.add(id);
        if (!post.curtidas || !post.curtidas[0]) post.curtidas = [{ count: 0 }];
        post.curtidas[0].count += 1;
      }

      delete CURTIDAS_LISTAS[id]; // lista de quem curtiu ficou desatualizada, busca de novo se abrir
      desenharFeedSocial();
    };
  });

  document.querySelectorAll('[data-acao=ver-curtidas]').forEach(b => {
    b.onclick = async () => {
      const id = b.dataset.id;
      if (ABERTOS_CURTIDAS.has(id)) {
        ABERTOS_CURTIDAS.delete(id);
        desenharFeedSocial();
        return;
      }
      ABERTOS_CURTIDAS.add(id);
      desenharFeedSocial();

      if (!CURTIDAS_LISTAS[id]) {
        const { data } = await sb.from('curtidas')
          .select('usuario:profiles(id, nome, foto_url)')
          .eq('publicacao_id', id)
          .order('criado_em', { ascending: true });
        CURTIDAS_LISTAS[id] = (data || []).map(c => c.usuario).filter(Boolean);
        if (ABERTOS_CURTIDAS.has(id)) desenharFeedSocial();
      }
    };
  });

  document.querySelectorAll('[data-acao=alternar-comentarios]').forEach(b => {
    b.onclick = async () => {
      const id = b.dataset.id;
      if (ABERTOS_COMENTARIOS.has(id)) {
        ABERTOS_COMENTARIOS.delete(id);
        desenharFeedSocial();
        return;
      }
      ABERTOS_COMENTARIOS.add(id);
      if (!COMENTARIOS_SOCIAL[id]) {
        const { data } = await sb.from('comentarios')
          .select('id, conteudo, criado_em, autor_id, autor:profiles(nome, foto_url)')
          .eq('publicacao_id', id)
          .order('criado_em', { ascending: true });
        COMENTARIOS_SOCIAL[id] = data || [];
      }
      desenharFeedSocial();
    };
  });

  document.querySelectorAll('[data-acao=abrir-menu-post]').forEach(b => {
    b.onclick = (e) => {
      e.stopPropagation();
      const id = b.dataset.id;
      MENU_POST_ABERTO = MENU_POST_ABERTO === id ? null : id;
      desenharFeedSocial();
    };
  });

  document.querySelectorAll('[data-acao=editar-social]').forEach(b => {
    b.onclick = () => {
      MENU_POST_ABERTO = null;
      EDITANDO_SOCIAL.add(b.dataset.id);
      desenharFeedSocial();
    };
  });

  document.querySelectorAll('[data-acao=cancelar-edicao-social]').forEach(b => {
    b.onclick = () => {
      EDITANDO_SOCIAL.delete(b.dataset.id);
      desenharFeedSocial();
    };
  });

  document.querySelectorAll('form[data-acao=salvar-edicao-social]').forEach(f => {
    f.onsubmit = async (e) => {
      e.preventDefault();
      const id = f.dataset.id;
      const btn = f.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.textContent = 'Salvando...';

      const conteudo = f.conteudo.value.trim();
      const { error } = await sb.from('publicacoes').update({ conteudo }).eq('id', id);

      if (error) {
        mostrarAviso('avisoPublicar', 'Não deu para salvar: ' + error.message);
        btn.disabled = false;
        btn.textContent = 'Salvar';
        return;
      }
      const post = POSTS_SOCIAL.find(p => p.id === id);
      if (post) post.conteudo = conteudo;
      EDITANDO_SOCIAL.delete(id);
      desenharFeedSocial();
    };
  });

  document.querySelectorAll('[data-acao=apagar-social]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('Apagar esta publicação?')) return;
      MENU_POST_ABERTO = null;
      await sb.from('publicacoes').delete().eq('id', b.dataset.id);
      POSTS_SOCIAL = POSTS_SOCIAL.filter(p => p.id !== b.dataset.id);
      desenharFeedSocial();
    };
  });

  document.querySelectorAll('[data-acao=apagar-comentario]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('Apagar este comentário?')) return;
      await sb.from('comentarios').delete().eq('id', b.dataset.id);
      const pid = b.dataset.publicacao;
      COMENTARIOS_SOCIAL[pid] = (COMENTARIOS_SOCIAL[pid] || []).filter(c => c.id !== b.dataset.id);
      const post = POSTS_SOCIAL.find(p => p.id === pid);
      if (post && post.comentarios && post.comentarios[0]) post.comentarios[0].count = Math.max(0, post.comentarios[0].count - 1);
      desenharFeedSocial();
    };
  });

  document.querySelectorAll('form[data-acao=comentar]').forEach(f => {
    f.onsubmit = async (e) => {
      e.preventDefault();
      const texto = f.querySelector('textarea').value.trim();
      if (!texto) return;
      const btn = f.querySelector('button');
      btn.disabled = true;

      const publicacaoId = f.dataset.id;
      const { error } = await sb.from('comentarios').insert({
        publicacao_id: publicacaoId,
        autor_id: PERFIL.id,
        conteudo: texto
      });

      if (error) {
        mostrarAviso('avisoPublicar', 'Não deu para comentar: ' + error.message);
        btn.disabled = false;
        return;
      }

      const { data } = await sb.from('comentarios')
        .select('id, conteudo, criado_em, autor_id, autor:profiles(nome, foto_url)')
        .eq('publicacao_id', publicacaoId)
        .order('criado_em', { ascending: true });
      COMENTARIOS_SOCIAL[publicacaoId] = data || [];

      const post = POSTS_SOCIAL.find(p => p.id === publicacaoId);
      if (post) {
        if (!post.comentarios || !post.comentarios[0]) post.comentarios = [{ count: 0 }];
        post.comentarios[0].count += 1;
      }

      desenharFeedSocial();
    };
  });
}

function ligarFormPublicar() {
  const form = document.getElementById('formPublicar');
  if (!form) return;

  ligarCampoArquivo('s_imagem', 's_imagem_nome', '');

  const conteudoEl = document.getElementById('s_conteudo');
  const contadorEl = document.getElementById('s_contador');
  if (conteudoEl && contadorEl) {
    conteudoEl.addEventListener('input', () => { contadorEl.textContent = conteudoEl.value.length; });
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    esconderAviso('avisoPublicar');
    const btn = document.getElementById('btnPublicarSocial');
    btn.disabled = true;
    btn.textContent = 'Publicando...';

    const conteudo = document.getElementById('s_conteudo').value.trim();
    const arquivo = document.getElementById('s_imagem').files[0];

    if (arquivo && !arquivo.type.startsWith('image/')) {
      mostrarAviso('avisoPublicar', 'Escolha um arquivo de imagem.');
      btn.disabled = false;
      btn.textContent = 'Publicar';
      return;
    }

    if (arquivo && arquivo.size > 25 * 1024 * 1024) {
      mostrarAviso('avisoPublicar', 'Escolha uma imagem de até 25 MB.');
      btn.disabled = false;
      btn.textContent = 'Publicar';
      return;
    }

    let imagemUrl = null;

    if (arquivo) {
      let paraEnviar;
      try {
        paraEnviar = await comprimirImagem(arquivo);
      } catch (erroCompressao) {
        mostrarAviso('avisoPublicar', 'Não deu para processar a imagem: ' + erroCompressao.message);
        btn.disabled = false;
        btn.textContent = 'Publicar';
        return;
      }

      const caminho = `${PERFIL.id}/${Date.now()}.jpg`;
      const { error: erroUpload } = await sb.storage.from('materiais')
        .upload(caminho, paraEnviar, { contentType: 'image/jpeg' });

      if (erroUpload) {
        mostrarAviso('avisoPublicar', 'Não deu para enviar a imagem: ' + erroUpload.message);
        btn.disabled = false;
        btn.textContent = 'Publicar';
        return;
      }

      imagemUrl = sb.storage.from('materiais').getPublicUrl(caminho).data.publicUrl;
    }

    const { error } = await sb.from('publicacoes').insert({
      autor_id: PERFIL.id,
      conteudo,
      imagem_url: imagemUrl
    });

    if (error) {
      mostrarAviso('avisoPublicar', 'Não deu para publicar: ' + error.message);
    } else {
      form.reset();
      limparCampoArquivo('s_imagem_nome', '');
      if (contadorEl) contadorEl.textContent = '0';
      mostrarAviso('avisoPublicar', 'Publicado.', true);
      await carregarFeedSocial(true);
    }

    btn.disabled = false;
    btn.textContent = 'Publicar';
  };
}

// ------------------------------------------------------------
//  Compressão de imagem: redimensiona e reduz qualidade até
//  caber no limite, em vez de só recusar arquivos grandes.
// ------------------------------------------------------------
async function comprimirImagem(file, ladoMaximo = 1600) {
  const origem = await lerComoImagem(file);
  let largura = origem.width;
  let altura = origem.height;

  if (largura > ladoMaximo || altura > ladoMaximo) {
    if (largura >= altura) {
      altura = Math.round(altura * (ladoMaximo / largura));
      largura = ladoMaximo;
    } else {
      largura = Math.round(largura * (ladoMaximo / altura));
      altura = ladoMaximo;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  canvas.getContext('2d').drawImage(origem, 0, 0, largura, altura);

  let qualidade = 0.82;
  let blob = await canvasParaBlob(canvas, qualidade);
  while (blob.size > SOCIAL_IMAGEM_MAX && qualidade > 0.35) {
    qualidade -= 0.15;
    blob = await canvasParaBlob(canvas, qualidade);
  }
  return blob;
}

function lerComoImagem(file) {
  if (window.createImageBitmap) return createImageBitmap(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler a imagem.')); };
    img.src = url;
  });
}

function canvasParaBlob(canvas, qualidade) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('Não foi possível processar a imagem.')),
      'image/jpeg',
      qualidade
    );
  });
}

// ------------------------------------------------------------
//  Lightbox: clicar numa imagem do feed abre ela em tela cheia
// ------------------------------------------------------------
function ligarLightbox() {
  const overlay = document.getElementById('lightbox');
  const img = document.getElementById('lightboxImg');
  if (!overlay || !img) return;

  const fechar = () => overlay.classList.add('oculto');

  document.getElementById('feedSocial').addEventListener('click', (e) => {
    const alvo = e.target.closest('.post-imagem');
    if (!alvo) return;
    img.src = alvo.src;
    overlay.classList.remove('oculto');
  });

  overlay.querySelector('.lightbox-fechar').onclick = fechar;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) fechar(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });
}

function ligarTempoRealSocial() {
  sb.channel('comunidade')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'publicacoes' },
      () => carregarFeedSocial(true))
    .subscribe();
}
