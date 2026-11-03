// Mural de avisos: leitura, busca e publicacao, sem turmas ou recursos sociais.
const SOCIAL_LIMIT = 15;
const SOCIAL_IMAGEM_MAX = 2 * 1024 * 1024;
let POSTS_SOCIAL = [];
let SOCIAL_FIM = false;
let SOCIAL_TOKEN = 0;
let SOCIAL_CARREGANDO = false;
let BUSCA_SOCIAL = '';
const EDITANDO_SOCIAL = new Set();

(async function inicio() {
  if (!await exigirLogin()) return;
  ligarFormPublicar();
  ligarBuscaSocial();
  ligarTempoRealSocial();
  await carregarFeedSocial(true);
})();

async function carregarFeedSocial(reset) {
  const alvo = document.getElementById('feedSocial');
  if (!alvo) return;

  if (!reset && SOCIAL_CARREGANDO) return;
  SOCIAL_CARREGANDO = true;
  if (reset) {
    SOCIAL_TOKEN++;
    POSTS_SOCIAL = [];
    SOCIAL_FIM = false;
    alvo.innerHTML = '<p class="carregando">Carregando...</p>';
  }
  const meuToken = SOCIAL_TOKEN;
  const desde = POSTS_SOCIAL.length;

  try {
    let consulta = sb
      .from('publicacoes')
      // Os campos de aula são opcionais durante a atualização do banco remoto.
      .select('*, autor:profiles(nome, foto_url)')
      .order('criado_em', { ascending: false })
      .order('id', { ascending: false })
      .range(desde, desde + SOCIAL_LIMIT - 1);

    if (BUSCA_SOCIAL) {
      // Trata curingas como texto para procurar o que a pessoa digitou.
      const termo = BUSCA_SOCIAL.replace(/[\\%_]/g, '\\$&');
      consulta = consulta.ilike('conteudo', `%${termo}%`);
    }

    const { data, error } = await consulta;

    // uma recarga mais nova (publicar, tempo real) já assumiu enquanto isso rodava — descarta
    if (meuToken !== SOCIAL_TOKEN) return;

    if (error) throw error;

    const existentes = new Set(POSTS_SOCIAL.map(p => p.id));
    const novos = (data || []).filter(p => !existentes.has(p.id));
    POSTS_SOCIAL = POSTS_SOCIAL.concat(novos);
    SOCIAL_FIM = (data || []).length < SOCIAL_LIMIT;

    desenharFeedSocial();
  } catch (_) {
    if (meuToken !== SOCIAL_TOKEN) return;
    alvo.innerHTML = '<div class="vazio" role="alert"><p>Não foi possível carregar os avisos. Confira sua conexão e tente novamente.</p><button type="button" class="btn-linha" id="btnRepetirFeed">Tentar novamente</button></div>';
    document.getElementById('btnRepetirFeed').onclick = () => carregarFeedSocial(true);
  } finally {
    if (meuToken === SOCIAL_TOKEN) SOCIAL_CARREGANDO = false;
  }
}


function ligarBuscaSocial() {
  const campo = document.getElementById('buscaPublicacoes');
  if (!campo) return;
  let atraso;
  campo.addEventListener('input', () => {
    clearTimeout(atraso);
    // Invalida a busca anterior antes mesmo de terminar o debounce.
    SOCIAL_TOKEN++;
    atraso = setTimeout(() => {
      BUSCA_SOCIAL = campo.value.trim();
      carregarFeedSocial(true);
    }, 300);
  });
}


function desenharFeedSocial() {
  const alvo = document.getElementById('feedSocial');
  if (!alvo) return;
  if (!POSTS_SOCIAL.length) {
    alvo.innerHTML = `<div class="vazio" role="status">${BUSCA_SOCIAL
      ? `Nenhum aviso encontrado para “${esc(BUSCA_SOCIAL)}”. Tente outra palavra ou limpe a busca.`
      : 'Nenhum aviso publicado ainda. Use “Publicar aviso” para deixar um recado.'}</div>`;
    return;
  }
  alvo.innerHTML = POSTS_SOCIAL.map(cartaoSocial).join('') +
    (SOCIAL_FIM ? '' : '<button type="button" class="btn-linha btn-carregar-mais" id="btnCarregarMaisSocial">Ver mais avisos</button>');
  ligarBotoesSocial();
  const mais = document.getElementById('btnCarregarMaisSocial');
  if (mais) mais.onclick = () => { mais.disabled = true; mais.textContent = 'Carregando...'; carregarFeedSocial(false); };
}

function cartaoSocial(p) {
  const imagem = linkSeguro(p.imagem_url);
  const meu = p.autor_id === PERFIL.id;
  return `<article class="post post-social" id="aviso-${esc(p.id)}">
    <div class="post-meta post-autor"><img class="avatar avatar-post" src="${avatarDe(p.autor)}" alt=""><span>${esc(p.autor ? p.autor.nome : 'Alguém')} · ${esc(quando(p.criado_em))}</span></div>
    ${p.disciplina && p.data_aula ? `<p class="aviso-aula-meta">${esc(p.disciplina)} · ${esc(diaDaAula(p.data_aula))}</p>` : ''}
    ${EDITANDO_SOCIAL.has(p.id) ? `<form class="form-edicao" data-acao="salvar-aviso" data-id="${esc(p.id)}">
      <div class="campo"><label for="editar-${esc(p.id)}">Texto do aviso</label><textarea id="editar-${esc(p.id)}" name="conteudo" required maxlength="1000">${esc(p.conteudo)}</textarea></div>
      <div class="campo-duplo">
        <div class="campo"><label for="materia-${esc(p.id)}">Matéria (opcional)</label><input id="materia-${esc(p.id)}" name="disciplina" maxlength="100" list="disciplinasAulas" value="${esc(p.disciplina || '')}"></div>
        <div class="campo"><label for="data-${esc(p.id)}">Dia da aula</label><input type="date" id="data-${esc(p.id)}" name="data_aula" value="${esc(p.data_aula || '')}"></div>
      </div>
      <div class="form-edicao-acoes"><button type="submit">Salvar</button><button type="button" class="btn-linha" data-acao="cancelar-aviso" data-id="${esc(p.id)}">Cancelar</button></div>
    </form>` : `<div class="post-corpo">${esc(p.conteudo)}</div>`}
    ${imagem ? `<a href="${imagem}" target="_blank" rel="noopener" aria-label="Abrir imagem do aviso"><img class="post-imagem" src="${imagem}" alt="Imagem anexada ao aviso" loading="lazy" decoding="async"></a>` : ''}
    ${meu && !EDITANDO_SOCIAL.has(p.id) ? `<div class="post-rodape"><button type="button" class="btn-texto" data-acao="editar-aviso" data-id="${esc(p.id)}">Editar</button><button type="button" class="btn-texto apagar" data-acao="apagar-aviso" data-id="${esc(p.id)}">Apagar</button></div>` : ''}
  </article>`;
}

function ligarBotoesSocial() {
  document.querySelectorAll('[data-acao=editar-aviso]').forEach(b => {
    b.onclick = () => { EDITANDO_SOCIAL.add(b.dataset.id); desenharFeedSocial(); document.getElementById('editar-' + b.dataset.id).focus(); };
  });
  document.querySelectorAll('[data-acao=cancelar-aviso]').forEach(b => {
    b.onclick = () => { EDITANDO_SOCIAL.delete(b.dataset.id); desenharFeedSocial(); };
  });
  document.querySelectorAll('form[data-acao=salvar-aviso]').forEach(form => {
    form.onsubmit = async e => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]');
      if (btn.disabled) return;
      const conteudo = form.elements.conteudo.value.trim();
      if (!conteudo) { mostrarAviso('avisoPublicar', 'Escreva o texto do aviso.'); return; }
      let aula;
      try { aula = aulaDoAviso(form.elements.disciplina.value, form.elements.data_aula.value); }
      catch (erro) { mostrarAviso('avisoPublicar', erro.message); return; }
      btn.disabled = true;
      btn.textContent = 'Salvando...';
      try {
        const postAtual = POSTS_SOCIAL.find(p => p.id === form.dataset.id);
        const camposAula = aula.disciplina || (postAtual && Object.prototype.hasOwnProperty.call(postAtual, 'data_aula')) ? aula : {};
        const { error } = await sb.from('publicacoes').update({ conteudo, ...camposAula }).eq('id', form.dataset.id).eq('autor_id', PERFIL.id);
        if (error) throw error;
        EDITANDO_SOCIAL.delete(form.dataset.id);
        await carregarFeedSocial(true);
      } catch (erro) {
        mostrarAviso('avisoPublicar', bancoSemRecadosDeAula(erro)
          ? 'O banco ainda precisa ser atualizado para recados por matéria. Avisos gerais continuam disponíveis; seu texto foi preservado.'
          : 'Não foi possível salvar o aviso. Seu texto foi preservado; tente novamente.');
      } finally { btn.disabled = false; btn.textContent = 'Salvar'; }
    };
  });
  document.querySelectorAll('[data-acao=apagar-aviso]').forEach(b => {
    b.onclick = async () => {
      if (b.disabled || !confirm('Apagar este aviso?')) return;
      b.disabled = true;
      try {
        const { error } = await sb.from('publicacoes').delete().eq('id', b.dataset.id).eq('autor_id', PERFIL.id);
        if (error) throw error;
        await carregarFeedSocial(true);
      } catch (_) { mostrarAviso('avisoPublicar', 'Não foi possível apagar o aviso. Tente novamente.'); }
      finally { b.disabled = false; }
    };
  });
}

function ligarFormPublicar() {
  const form = document.getElementById('formPublicar');
  if (!form) return;
  ligarCampoArquivo('s_imagem', 's_imagem_nome', '');
  const texto = document.getElementById('s_conteudo');
  const contador = document.getElementById('s_contador');
  if (typeof GRADE_SEMESTRE !== 'undefined') {
    document.getElementById('disciplinasAulas').innerHTML = [...new Set(GRADE_SEMESTRE.map(d => d.materia))]
      .map(m => `<option value="${esc(m)}"></option>`).join('');
  }
  const materiaInicial = param('disciplina');
  const dataInicial = param('data_aula');
  if (materiaInicial && /^\d{4}-\d{2}-\d{2}$/.test(dataInicial || '')) {
    document.getElementById('s_disciplina').value = materiaInicial.slice(0, 100);
    document.getElementById('s_data_aula').value = dataInicial;
    document.getElementById('novoAviso').open = true;
    texto.focus();
  }
  texto.addEventListener('input', () => { contador.textContent = texto.value.length; });
  form.onsubmit = async e => {
    e.preventDefault();
    const btn = document.getElementById('btnPublicarSocial');
    if (btn.disabled) return;
    esconderAviso('avisoPublicar');
    const conteudo = texto.value.trim();
    if (!conteudo) { mostrarAviso('avisoPublicar', 'Escreva o texto do aviso.'); texto.focus(); return; }
    let aula;
    try { aula = aulaDoAviso(document.getElementById('s_disciplina').value, document.getElementById('s_data_aula').value); }
    catch (erro) { mostrarAviso('avisoPublicar', erro.message); return; }
    const arquivo = document.getElementById('s_imagem').files[0];
    if (arquivo && (!arquivo.type.startsWith('image/') || arquivo.size > 25 * 1024 * 1024)) {
      mostrarAviso('avisoPublicar', 'Escolha uma imagem de até 25 MB.'); return;
    }
    btn.disabled = true;
    btn.textContent = 'Publicando...';
    try {
      let imagemUrl = null;
      if (arquivo) {
        const imagem = await comprimirImagem(arquivo);
        const caminho = `${PERFIL.id}/${Date.now()}.jpg`;
        const { error } = await sb.storage.from('materiais').upload(caminho, imagem, { contentType: 'image/jpeg' });
        if (error) throw error;
        imagemUrl = sb.storage.from('materiais').getPublicUrl(caminho).data.publicUrl;
      }
      const { error } = await sb.from('publicacoes').insert({ autor_id: PERFIL.id, conteudo, imagem_url: imagemUrl, ...(aula.disciplina ? aula : {}) });
      if (error) throw error;
      form.reset();
      contador.textContent = '0';
      limparCampoArquivo('s_imagem_nome', '');
      mostrarAviso('avisoPublicar', 'Aviso publicado.', true);
      await carregarFeedSocial(true);
    } catch (erro) {
      mostrarAviso('avisoPublicar', bancoSemRecadosDeAula(erro)
        ? 'O banco ainda precisa ser atualizado para recados por matéria. Avisos gerais continuam disponíveis; seu texto foi preservado.'
        : 'Não foi possível concluir a publicação. Confira os avisos antes de tentar novamente.');
    } finally { btn.disabled = false; btn.textContent = 'Publicar'; }
  };
}

function ligarTempoRealSocial() {
  sb.channel('avisos').on('postgres_changes', { event: '*', schema: 'public', table: 'publicacoes' }, () => {
    if (!EDITANDO_SOCIAL.size) carregarFeedSocial(true);
  }).subscribe();
}

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
