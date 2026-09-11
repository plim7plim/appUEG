// ============================================================
//  Conteúdos: biblioteca de material por disciplina (anotação, prova,
//  trabalho, material de aula, outro) — qualquer aluno ou professor
//  anexa, sem precisar de turma. Mesmo espírito de "Tarefas": solto,
//  disciplina em texto livre, só quem cadastrou edita/apaga.
// ============================================================

let CONTEUDOS_TODOS = [];
let MINHAS_DISCIPLINAS_CONTEUDOS = new Set();
let FILTRO_DISCIPLINA_CONTEUDO = '';
let FILTRO_TIPO_CONTEUDO = '';
let FILTRO_BUSCA_CONTEUDO = '';
let FILTRO_SO_MINHAS_CONTEUDOS = true;
const EDITANDO_CONTEUDO = new Set();

const TIPOS_CONTEUDO = {
  anotacao: { rotulo: 'Anotação', classe: 'etiqueta-aula' },
  prova:    { rotulo: 'Prova',    classe: 'etiqueta-duvida' },
  trabalho: { rotulo: 'Trabalho', classe: 'etiqueta-atividade' },
  material: { rotulo: 'Material', classe: 'etiqueta-material' },
  outro:    { rotulo: 'Outro',    classe: '' }
};

(async function inicio() {
  const perfil = await exigirLogin();
  if (!perfil) return;

  ligarBotaoNovoConteudo();
  ligarFormNovoConteudo();
  ligarBuscaConteudos();
  await carregarMinhasDisciplinasConteudos();
  ligarFiltroMinhasDisciplinasConteudos();
  await carregarConteudos();
})();

// ------------------------------------------------------------
//  Disciplinas das turmas em que o aluno está matriculado — usadas
//  pra, por padrão, mostrar primeiro o material das matérias dele.
// ------------------------------------------------------------
async function carregarMinhasDisciplinasConteudos() {
  MINHAS_DISCIPLINAS_CONTEUDOS = new Set();
  if (ehProfessor()) return;

  const { data } = await sb
    .from('matriculas')
    .select('turmas(disciplina)')
    .eq('aluno_id', PERFIL.id)
    .eq('status', 'aprovada');

  (data || []).forEach(m => {
    const disc = m.turmas && m.turmas.disciplina;
    if (disc) MINHAS_DISCIPLINAS_CONTEUDOS.add(normalizarBusca(disc));
  });
}

function ligarFiltroMinhasDisciplinasConteudos() {
  const wrap = document.getElementById('minhasDisciplinasConteudosWrap');
  const chk = document.getElementById('filtroMinhasDisciplinasConteudos');
  if (!wrap || !chk) return;

  if (!MINHAS_DISCIPLINAS_CONTEUDOS.size) {
    wrap.classList.add('oculto');
    return;
  }

  wrap.classList.remove('oculto');
  chk.checked = FILTRO_SO_MINHAS_CONTEUDOS;
  chk.onchange = () => { FILTRO_SO_MINHAS_CONTEUDOS = chk.checked; desenharConteudos(); };
}

function ligarBuscaConteudos() {
  const input = document.getElementById('buscaConteudos');
  if (!input) return;
  input.oninput = () => { FILTRO_BUSCA_CONTEUDO = input.value; desenharConteudos(); };
}

// ------------------------------------------------------------
//  Novo conteúdo
// ------------------------------------------------------------
function ligarBotaoNovoConteudo() {
  const btn = document.getElementById('btnNovoConteudo');
  const painel = document.getElementById('painelNovoConteudo');

  btn.onclick = () => {
    painel.classList.toggle('oculto');
    btn.textContent = painel.classList.contains('oculto') ? '+ Novo conteúdo' : '— Fechar';
  };
}

function ligarFormNovoConteudo() {
  const form = document.getElementById('formNovoConteudo');
  if (!form) return;
  ligarCampoArquivo('nc_arquivo', 'nc_arquivo_nome');

  form.onsubmit = async (e) => {
    e.preventDefault();
    esconderAviso('avisoNovoConteudo');
    const btn = document.getElementById('btnEnviarConteudo');
    const arquivo = document.getElementById('nc_arquivo').files[0];

    if (!arquivo) {
      mostrarAviso('avisoNovoConteudo', 'Escolha um arquivo pra anexar.');
      return;
    }
    if (arquivo.size > 10 * 1024 * 1024) {
      mostrarAviso('avisoNovoConteudo', 'O arquivo precisa ter até 10 MB.');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Enviando...';

    const caminho = `${PERFIL.id}/${Date.now()}-${nomeArquivoSeguro(arquivo.name)}`;
    const { error: erroUpload } = await sb.storage.from('conteudos').upload(caminho, arquivo, {
      contentType: arquivo.type || 'application/octet-stream'
    });

    if (erroUpload) {
      mostrarAviso('avisoNovoConteudo', 'Não deu para enviar o arquivo: ' + erroUpload.message);
      btn.disabled = false;
      btn.textContent = 'Anexar conteúdo';
      return;
    }

    const arquivoUrl = sb.storage.from('conteudos').getPublicUrl(caminho, { download: false }).data.publicUrl;

    const { error } = await sb.from('conteudos').insert({
      autor_id: PERFIL.id,
      titulo: document.getElementById('nc_titulo').value.trim(),
      disciplina: document.getElementById('nc_disciplina').value.trim(),
      tipo: document.getElementById('nc_tipo').value,
      descricao: document.getElementById('nc_descricao').value.trim() || null,
      arquivo_url: arquivoUrl,
      arquivo_nome: arquivo.name
    });

    if (error) {
      mostrarAviso('avisoNovoConteudo', 'Não deu para cadastrar: ' + error.message);
    } else {
      form.reset();
      limparCampoArquivo('nc_arquivo_nome');
      mostrarAviso('avisoNovoConteudo', 'Conteúdo anexado.', true);
      document.getElementById('painelNovoConteudo').classList.add('oculto');
      document.getElementById('btnNovoConteudo').textContent = '+ Novo conteúdo';
      await carregarConteudos();
    }

    btn.disabled = false;
    btn.textContent = 'Anexar conteúdo';
  };
}

// ------------------------------------------------------------
//  Carregar e desenhar
// ------------------------------------------------------------
async function carregarConteudos() {
  const alvo = document.getElementById('listaConteudos');

  const { data, error } = await sb
    .from('conteudos')
    .select('id, autor_id, titulo, disciplina, tipo, descricao, arquivo_url, arquivo_nome, criado_em, autor:profiles(nome)')
    .order('criado_em', { ascending: false });

  if (error) {
    alvo.innerHTML = `<div class="vazio">Não foi possível carregar os conteúdos. ${esc(error.message)}</div>`;
    return;
  }

  CONTEUDOS_TODOS = data || [];
  montarFiltrosConteudos();
  desenharConteudos();
}

function montarFiltrosConteudos() {
  const disciplinas = [...new Set(CONTEUDOS_TODOS.map(c => c.disciplina).filter(Boolean))].sort(COLACIONADOR_PT.compare);

  const selDisc = document.getElementById('filtroDisciplinaConteudo');
  const discAtual = selDisc.value;

  selDisc.innerHTML = `<option value="">Todas as disciplinas</option>` +
    disciplinas.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');

  if (disciplinas.includes(discAtual)) selDisc.value = discAtual;
  selDisc.onchange = () => { FILTRO_DISCIPLINA_CONTEUDO = selDisc.value; desenharConteudos(); };

  const selTipo = document.getElementById('filtroTipoConteudo');
  selTipo.onchange = () => { FILTRO_TIPO_CONTEUDO = selTipo.value; desenharConteudos(); };
}

function desenharConteudos() {
  const alvo = document.getElementById('listaConteudos');
  const busca = normalizarBusca(FILTRO_BUSCA_CONTEUDO);

  const filtrados = CONTEUDOS_TODOS.filter(c =>
    (!FILTRO_DISCIPLINA_CONTEUDO || c.disciplina === FILTRO_DISCIPLINA_CONTEUDO) &&
    (!FILTRO_TIPO_CONTEUDO || c.tipo === FILTRO_TIPO_CONTEUDO) &&
    (!FILTRO_SO_MINHAS_CONTEUDOS || !MINHAS_DISCIPLINAS_CONTEUDOS.size || !c.disciplina || MINHAS_DISCIPLINAS_CONTEUDOS.has(normalizarBusca(c.disciplina))) &&
    (!busca || normalizarBusca(c.titulo).includes(busca) || normalizarBusca(c.descricao).includes(busca))
  );

  if (!filtrados.length) {
    alvo.innerHTML = '<div class="vazio">Nenhum conteúdo encontrado.</div>';
    return;
  }

  alvo.innerHTML = filtrados.map(cartaoConteudo).join('');
  ligarAcoesConteudo(alvo);
}

function cartaoConteudo(c) {
  if (EDITANDO_CONTEUDO.has(c.id)) return blocoEdicaoConteudo(c);

  const tipoInfo = TIPOS_CONTEUDO[c.tipo] || TIPOS_CONTEUDO.outro;
  const meta = [
    c.disciplina || null,
    c.autor ? `anexado por ${c.autor.nome}` : null,
    quando(c.criado_em)
  ].filter(Boolean).join(' · ');

  const previsualizavel = tipoDePrevia(c.arquivo_nome);

  return `
    <div class="post" data-tipo="conteudo">
      <div class="post-topo">
        <h3>${esc(c.titulo)}</h3>
        <span class="etiqueta ${tipoInfo.classe}">${esc(tipoInfo.rotulo)}</span>
      </div>
      <div class="post-meta">${esc(meta)}</div>
      ${c.descricao ? `<div class="post-corpo">${esc(c.descricao)}</div>` : ''}
      <div class="post-anexo">
        <a class="anexo-link" href="${esc(c.arquivo_url)}" target="_blank" rel="noopener">📎 ${esc(c.arquivo_nome)}</a>
        ${previsualizavel ? `<button type="button" class="btn-texto" data-acao="alternar-previa" data-id="${c.id}" data-tipo-previa="${previsualizavel}" data-url="${esc(c.arquivo_url)}" data-nome="${esc(c.arquivo_nome)}">Visualizar aqui</button>` : ''}
      </div>
      ${previsualizavel ? `
      <div class="conteudo-previa oculto" id="previa-${c.id}"></div>` : ''}
      ${c.autor_id === PERFIL.id ? `
      <div class="post-rodape">
        <button type="button" class="btn-texto" data-acao="editar-conteudo" data-id="${c.id}">Editar</button>
        <button type="button" class="btn-texto apagar" data-acao="apagar-conteudo" data-id="${c.id}">Apagar</button>
      </div>` : ''}
    </div>`;
}

// pdf mostra embutido num iframe; imagem, direto num <img>; o resto
// (docx, pptx, zip...) não tem como o navegador exibir sozinho, só baixa
function tipoDePrevia(nomeArquivo) {
  const ext = (nomeArquivo.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'imagem';
  return null;
}

function blocoEdicaoConteudo(c) {
  return `
    <div class="post" data-tipo="conteudo">
      <form class="form-edicao" data-acao="salvar-edicao-conteudo" data-id="${c.id}">
        <div class="campo">
          <label>Título</label>
          <input type="text" name="titulo" required value="${esc(c.titulo)}">
        </div>
        <div class="campo-duplo">
          <div class="campo">
            <label>Disciplina</label>
            <input type="text" name="disciplina" required value="${esc(c.disciplina)}">
          </div>
          <div class="campo">
            <label>Tipo</label>
            <select name="tipo">
              ${Object.entries(TIPOS_CONTEUDO).map(([valor, info]) =>
                `<option value="${valor}"${c.tipo === valor ? ' selected' : ''}>${esc(info.rotulo)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="campo">
          <label>Descrição</label>
          <textarea name="descricao">${esc(c.descricao || '')}</textarea>
        </div>
        <p style="font-size:.8rem;color:var(--tinta-fraca);margin:-4px 0 14px">
          O arquivo anexado (${esc(c.arquivo_nome)}) não muda ao editar — pra trocar o arquivo, apague e anexe de novo.
        </p>
        <div class="form-edicao-acoes">
          <button type="submit">Salvar</button>
          <button type="button" class="btn-linha" data-acao="cancelar-edicao-conteudo" data-id="${c.id}">Cancelar</button>
        </div>
      </form>
    </div>`;
}

function ligarAcoesConteudo(alvo) {
  alvo.querySelectorAll('[data-acao=alternar-previa]').forEach(b => {
    b.onclick = () => {
      const painel = document.getElementById('previa-' + b.dataset.id);
      const abrindo = painel.classList.contains('oculto');

      // só monta o iframe/imagem na primeira vez que abre — evita carregar
      // arquivo de cartão que ninguém nem olhou
      if (abrindo && !painel.dataset.montado) {
        painel.innerHTML = b.dataset.tipoPrevia === 'pdf'
          ? `<iframe src="${esc(b.dataset.url)}" title="${esc(b.dataset.nome)}" loading="lazy"></iframe>`
          : `<img src="${esc(b.dataset.url)}" alt="${esc(b.dataset.nome)}" loading="lazy">`;
        painel.dataset.montado = '1';
      }

      painel.classList.toggle('oculto', !abrindo);
      b.textContent = abrindo ? 'Ocultar' : 'Visualizar aqui';
    };
  });

  alvo.querySelectorAll('[data-acao=editar-conteudo]').forEach(b => {
    b.onclick = () => { EDITANDO_CONTEUDO.add(b.dataset.id); desenharConteudos(); };
  });

  alvo.querySelectorAll('[data-acao=cancelar-edicao-conteudo]').forEach(b => {
    b.onclick = () => { EDITANDO_CONTEUDO.delete(b.dataset.id); desenharConteudos(); };
  });

  alvo.querySelectorAll('form[data-acao=salvar-edicao-conteudo]').forEach(f => {
    f.onsubmit = async (e) => {
      e.preventDefault();
      const id = f.dataset.id;
      const btn = f.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.textContent = 'Salvando...';

      const { error } = await sb.from('conteudos').update({
        titulo: f.titulo.value.trim(),
        disciplina: f.disciplina.value.trim(),
        tipo: f.tipo.value,
        descricao: f.descricao.value.trim() || null
      }).eq('id', id);

      if (error) {
        mostrarAviso('avisoConteudos', 'Não deu para salvar: ' + error.message);
        btn.disabled = false;
        btn.textContent = 'Salvar';
        return;
      }
      EDITANDO_CONTEUDO.delete(id);
      await carregarConteudos();
    };
  });

  alvo.querySelectorAll('[data-acao=apagar-conteudo]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('Apagar este conteúdo?')) return;
      b.disabled = true;
      const { error } = await sb.from('conteudos').delete().eq('id', b.dataset.id);
      if (error) {
        mostrarAviso('avisoConteudos', 'Não deu para apagar: ' + error.message);
        b.disabled = false;
        return;
      }
      CONTEUDOS_TODOS = CONTEUDOS_TODOS.filter(c => c.id !== b.dataset.id);
      desenharConteudos();
    };
  });
}
