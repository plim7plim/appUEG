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

(async function inicio() {
  const perfil = await exigirLogin();
  if (!perfil) return;

  await carregarMinhasCurtidas();
  await carregarFeedSocial(true);
  ligarFormPublicar();
  ligarTempoRealSocial();
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

  const { data, error } = await sb
    .from('publicacoes')
    .select('id, conteudo, imagem_url, criado_em, autor_id, autor:profiles(nome, foto_url), curtidas(count), comentarios(count)')
    .order('criado_em', { ascending: false })
    .range(desde, desde + SOCIAL_LIMIT - 1);

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

function desenharFeedSocial() {
  const alvo = document.getElementById('feedSocial');
  if (!alvo) return;

  if (!POSTS_SOCIAL.length) {
    alvo.innerHTML = `<div class="vazio">Ninguém publicou nada ainda. Seja o primeiro!</div>`;
    return;
  }

  alvo.innerHTML = POSTS_SOCIAL.map(cartaoSocial).join('') +
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

function cartaoSocial(p) {
  const curtidas = (p.curtidas && p.curtidas[0]) ? p.curtidas[0].count : 0;
  const comentarios = (p.comentarios && p.comentarios[0]) ? p.comentarios[0].count : 0;
  const euCurti = CURTIDAS_MINHAS.has(p.id);
  const aberto = ABERTOS_COMENTARIOS.has(p.id);

  return `
    <article class="post post-social">
      <div class="post-meta post-autor">
        <img class="avatar avatar-post" src="${avatarDe(p.autor)}" alt="">
        <span><a class="link-autor" href="usuario.html?id=${p.autor_id}">${esc(p.autor ? p.autor.nome : 'Alguém')}</a> · ${esc(quando(p.criado_em))}</span>
      </div>
      <div class="post-corpo">${esc(p.conteudo)}</div>
      ${p.imagem_url ? `<img class="post-imagem" src="${esc(p.imagem_url)}" alt="">` : ''}

      <div class="post-rodape">
        <button type="button" class="btn-texto${euCurti ? ' curtido' : ''}" data-acao="curtir" data-id="${p.id}">
          ${euCurti ? '❤ Curtido' : '🤍 Curtir'}${curtidas > 0 ? ` (${curtidas})` : ''}
        </button>
        <button type="button" class="btn-texto" data-acao="alternar-comentarios" data-id="${p.id}">
          ${comentarios > 0 ? `${comentarios} ${comentarios === 1 ? 'comentário' : 'comentários'}` : 'Comentar'}
          ${aberto ? ' — fechar' : ''}
        </button>
        ${p.autor_id === PERFIL.id
          ? `<button type="button" class="btn-texto apagar" data-acao="apagar-social" data-id="${p.id}">Apagar</button>` : ''}
      </div>

      ${aberto ? blocoComentarios(p.id) : ''}
    </article>`;
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
      } else {
        CURTIDAS_MINHAS.add(id);
        if (!post.curtidas || !post.curtidas[0]) post.curtidas = [{ count: 0 }];
        post.curtidas[0].count += 1;
      }

      desenharFeedSocial();
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

  document.querySelectorAll('[data-acao=apagar-social]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('Apagar esta publicação?')) return;
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

function ligarTempoRealSocial() {
  sb.channel('comunidade')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'publicacoes' },
      () => carregarFeedSocial(true))
    .subscribe();
}
