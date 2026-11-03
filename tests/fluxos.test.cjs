const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function ambiente(arquivo, auth = {}, extras = {}) {
  const elementos = new Map();
  const elemento = id => {
    if (!elementos.has(id)) {
      const classes = new Set();
      const atributos = new Map();
      elementos.set(id, {
        value: '', disabled: false, textContent: '',
        classList: {
          add: c => classes.add(c), remove: c => classes.delete(c),
          contains: c => classes.has(c),
          toggle: (c, ativo = !classes.has(c)) => ativo ? classes.add(c) : classes.delete(c)
        },
        setAttribute: (k, v) => atributos.set(k, v),
        getAttribute: k => atributos.get(k), removeAttribute: k => atributos.delete(k),
        focus() {}, reportValidity: () => true
      });
    }
    return elementos.get(id);
  };
  const avisos = [];
  const eventos = {};
  const contexto = vm.createContext({
    URL, URLSearchParams, setTimeout: () => {},
    document: {
      getElementById: elemento,
      querySelector: () => ({ value: 'aluno' }),
      querySelectorAll: () => [],
      addEventListener: (nome, fn) => { eventos[nome] = fn; }
    },
    window: { location: { href: 'https://exemplo.com/app/index.html' } },
    usuarioAtual: async () => null,
    exigirLogin: async () => null,
    param: () => 'turma',
    ligarCampoArquivo: () => {},
    esconderAviso: () => avisos.push({ oculto: true }),
    mostrarAviso: (id, texto, ok) => avisos.push({ texto, ok }),
    sb: { auth },
    ...extras
  });
  if (arquivo === 'js/comunidade.js') {
    contexto.bancoSemRecadosDeAula = ambiente('js/comum.js').contexto.bancoSemRecadosDeAula;
  }
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', arquivo), 'utf8'), contexto);
  return { contexto, elemento, avisos, eventos };
}
const evento = { preventDefault() {} };

test('link de recuperação recebido na entrada preserva tokens e vai para nova senha antes do SDK', () => {
  const href = 'https://exemplo.com/app/index.html#access_token=token-de-teste&type=recovery&refresh_token=refresh-de-teste';
  const url = new URL(href);
  let destino;
  let opcoes;
  const contexto = vm.createContext({ URL, URLSearchParams, window: {
    location: { href, hostname: url.hostname, replace: valor => { destino = valor; } },
    supabase: { createClient: (u, k, options) => { opcoes = options; return {}; } }
  } });
  for (const file of ['recuperacao.js', 'supabase-config.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8'), contexto);
  }
  assert.equal(new URL(destino).pathname, '/app/redefinir-senha.html');
  assert.equal(new URL(destino).hash, url.hash);
  assert.equal(opcoes.auth.detectSessionInUrl, false);
});

for (const href of ['https://exemplo.com/app/redefinir-senha.html#type=recovery', 'https://exemplo.com/app/index.html#type=signup']) {
  test(`recuperação não cria redirecionamento indevido em ${new URL(href).pathname} (${new URL(href).hash})`, () => {
    let redirecionamentos = 0;
    const contexto = vm.createContext({ URL, URLSearchParams, window: { location: { href, replace: () => { redirecionamentos++; } } } });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js/recuperacao.js'), 'utf8'), contexto);
    assert.equal(redirecionamentos, 0);
    assert.equal(vm.runInContext('REDIRECIONANDO_RECUPERACAO', contexto), false);
  });
}

test('login automático não disputa a navegação com a recuperação', async () => {
  let consultas = 0;
  const a = ambiente('js/login.js', {}, {
    REDIRECIONANDO_RECUPERACAO: true,
    usuarioAtual: async () => { consultas++; return { id: 'usuario' }; }
  });
  await Promise.resolve();
  assert.equal(consultas, 0);
  assert.equal(a.contexto.window.location.href, 'https://exemplo.com/app/index.html');
});

test('tela de nova senha exibe o formulário quando existe sessão de recuperação', async () => {
  let liberarSessao;
  const a = ambiente('js/redefinir-senha.js', {
    onAuthStateChange: () => {}, getSession: () => new Promise(resolve => { liberarSessao = resolve; })
  });
  a.elemento('formNovaSenha').classList.add('oculto');
  liberarSessao({ data: { session: { access_token: 'sessao-de-teste' } } });
  await new Promise(setImmediate);
  assert.equal(a.elemento('formNovaSenha').classList.contains('oculto'), false);
  assert.equal(a.elemento('verificando').classList.contains('oculto'), true);
});

test('recados exigem matéria e data juntas e rejeitam datas impossíveis', () => {
  const a = ambiente('js/comum.js');
  assert.equal(a.contexto.aulaDoAviso('', '').disciplina, null);
  assert.equal(a.contexto.aulaDoAviso(' Banco de Dados ', '2026-11-09').disciplina, 'Banco de Dados');
  for (const [materia, data] of [['Banco de Dados', ''], ['', '2026-11-09'], ['Banco de Dados', '2026-02-31']]) {
    assert.throws(() => a.contexto.aulaDoAviso(materia, data));
  }
});

for (const papel of ['aluno', 'professor']) {
  test(`${papel} publica recado de matéria com data e autoria próprias`, async () => {
    const a = ambiente('js/comunidade.js');
    a.contexto.aulaDoAviso = ambiente('js/comum.js').contexto.aulaDoAviso;
    a.contexto.PERFIL = { id: 'usuario', papel };
    a.elemento('s_conteudo').value = 'Levar os materiais combinados.';
    a.elemento('s_conteudo').addEventListener = () => {};
    a.elemento('s_disciplina').value = 'Banco de Dados';
    a.elemento('s_data_aula').value = '2026-11-09';
    a.elemento('s_imagem').files = [];
    a.elemento('formPublicar').reset = () => {};
    a.contexto.limparCampoArquivo = () => {};
    a.contexto.carregarFeedSocial = async () => {};
    let registro;
    a.contexto.sb.from = () => ({ insert: async valor => { registro = valor; return { error: null }; } });
    a.contexto.ligarFormPublicar();
    await a.elemento('formPublicar').onsubmit(evento);
    assert.equal(registro.disciplina, 'Banco de Dados');
    assert.equal(registro.data_aula, '2026-11-09');
    assert.equal(registro.autor_id, 'usuario');
  });
}

test('horários vinculam recados à próxima data da aula, sem repetir datas passadas', () => {
  const a = ambiente('js/horario.js');
  const terca = new Date(2026, 10, 3, 23, 30);
  assert.equal(a.contexto.proximaDataDaAula('Segunda', terca), '2026-11-09');
  assert.equal(a.contexto.proximaDataDaAula('Terça', terca), '2026-11-03');
  assert.equal(a.contexto.proximaDataDaAula('Sábado', terca), '2026-11-07');
});

test('perfil de colega consulta apresentação sem depender de seguidores', async () => {
  const a = ambiente('js/usuario.js');
  const tabelas = [];
  a.contexto.desenharPerfil = () => {};
  a.contexto.sb.from = tabela => {
    tabelas.push(tabela);
    return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { id: 'colega' }, error: null }) };
  };
  await a.contexto.carregarUsuario();
  assert.deepEqual(tabelas, ['profiles']);
});

for (const hostname of ['127.0.0.1', 'localhost', 'plim7plim.github.io', 'localhost.exemplo.com']) {
  test(`configuração seleciona o banco correto em ${hostname}`, () => {
    let conexao;
    const contexto = vm.createContext({ window: {
      location: { hostname },
      supabase: { createClient: (url, key) => { conexao = { url, key }; return {}; } }
    } });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js/supabase-config.js'), 'utf8'), contexto);
    assert.equal(conexao.url, ['127.0.0.1', 'localhost'].includes(hostname)
      ? 'http://127.0.0.1:54321' : 'https://ljztotcqbtphawyizbaq.supabase.co');
    assert.equal(JSON.parse(Buffer.from(conexao.key.split('.')[1], 'base64url')).role, 'anon');
  });
}

test('links externos rejeitam protocolos executáveis, URLs inválidas e credenciais', () => {
  const a = ambiente('js/comum.js');
  for (const url of ['javascript:alert(1)', 'data:text/html,teste', 'https://', 'https://usuario:senha@exemplo.com', 'https://exemplo.com\njavascript:alert(1)', null]) {
    assert.equal(a.contexto.linkSeguro(url), null, String(url));
  }
  assert.equal(a.contexto.linkSeguro('https://exemplo.com/a?x=1&y=2'), 'https://exemplo.com/a?x=1&amp;y=2');
});

test('falha de rede ao buscar usuário apresenta erro recuperável sem redirecionar', async () => {
  const a = ambiente('js/comum.js', { getUser: async () => { throw Error('offline'); } });
  let erros = 0;
  a.contexto.mostrarErroDePerfil = () => { erros++; };
  assert.equal(await a.contexto.exigirLogin(), null);
  assert.equal(erros, 1);
  assert.equal(a.contexto.window.location.href, 'https://exemplo.com/app/index.html');
});

test('painel administrativo não consulta permissões sem perfil carregado', async () => {
  const a = ambiente('js/admin.js');
  a.contexto.PERFIL = null;
  a.contexto.sb.from = () => { throw Error('Não deve consultar'); };
  assert.equal(await a.contexto.exigirAdmin(), false);
});

test('falha nas entregas preserva estado anterior e não desenha tarefas como não entregues', async () => {
  const a = ambiente('js/tarefas.js');
  a.contexto.PERFIL = { id: 'aluno' };
  vm.runInContext("TAREFAS_TODAS = [{ id: 'anterior' }]; ENTREGAS_MAP.set('anterior', true);", a.contexto);
  let desenhos = 0;
  a.contexto.desenharTudo = () => { desenhos++; };
  a.contexto.montarFiltros = () => {};
  a.contexto.sb.from = tabela => ({
    select() { return this; }, order() { return this; }, eq() { return this; }, in() { return this; },
    then(resolve) { return Promise.resolve(tabela === 'tarefas'
      ? { data: [{ id: 'nova' }], error: null }
      : { data: null, error: { message: 'offline' } }).then(resolve); }
  });
  await a.contexto.carregarTarefas();
  assert.equal(desenhos, 0);
  assert.equal(vm.runInContext('TAREFAS_TODAS[0].id', a.contexto), 'anterior');
  assert.equal(vm.runInContext("ENTREGAS_MAP.get('anterior')", a.contexto), true);
  assert.match(a.avisos.at(-1).texto, /preservados/);
});

test('upload de conteúdo libera botão após falha e impede envios simultâneos', async () => {
  const a = ambiente('js/conteudos.js');
  a.contexto.PERFIL = { id: 'aluno' };
  a.contexto.ligarCampoArquivo = () => {};
  a.contexto.nomeArquivoSeguro = nome => nome;
  a.elemento('nc_arquivo').files = [{ name: 'aula.pdf', size: 10, type: 'application/pdf' }];
  let rejeitar;
  let chamadas = 0;
  a.contexto.sb.storage = { from: () => ({ upload: () => {
    chamadas++;
    return new Promise((resolve, reject) => { rejeitar = reject; });
  } }) };
  a.contexto.ligarFormNovoConteudo();
  const primeira = a.elemento('formNovoConteudo').onsubmit(evento);
  await a.elemento('formNovoConteudo').onsubmit(evento);
  assert.equal(chamadas, 1);
  rejeitar(Error('offline'));
  await primeira;
  assert.equal(a.elemento('btnEnviarConteudo').disabled, false);
  assert.equal(a.elemento('btnEnviarConteudo').textContent, 'Anexar conteúdo');
  assert.match(a.avisos.at(-1).texto, /conexão/);
});

test('conteúdo com URL executável não cria link nem visualização', () => {
  const a = ambiente('js/conteudos.js');
  a.contexto.PERFIL = { id: 'aluno' };
  a.contexto.linkSeguro = () => null;
  a.contexto.quando = () => 'agora';
  a.contexto.esc = valor => String(valor || '');
  const html = a.contexto.cartaoConteudo({ id: 'arquivo', autor_id: 'outro', arquivo_nome: 'aula.pdf', arquivo_url: 'javascript:alert(1)' });
  assert.doesNotMatch(html, /javascript:|href=|alternar-previa/);
  assert.match(html, /indisponível/);
});

test('falha no feed oferece nova tentativa em vez de permanecer carregando', async () => {
  const a = ambiente('js/comunidade.js');
  a.contexto.sb.from = () => ({
    select() { return this; }, order() { return this; }, range() { throw Error('offline'); }
  });
  await a.contexto.carregarFeedSocial(true);
  assert.match(a.elemento('feedSocial').innerHTML, /Não foi possível/);
  assert.equal(typeof a.elemento('btnRepetirFeed').onclick, 'function');
});

test('avisos consultam publicacoes sem depender de seguidores ou turmas', async () => {
  const a = ambiente('js/comunidade.js');
  const tabelas = [];
  a.contexto.sb.from = tabela => {
    tabelas.push(tabela);
    return { select() { return this; }, order() { return this; }, range() { return this; },
      then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); } };
  };
  a.contexto.desenharFeedSocial = () => {};
  await a.contexto.carregarFeedSocial(true);
  assert.deepEqual(tabelas, ['publicacoes']);
});

test('publicar aviso impede envio duplicado e preserva o texto quando a conexão falha', async () => {
  const a = ambiente('js/comunidade.js');
  a.contexto.aulaDoAviso = ambiente('js/comum.js').contexto.aulaDoAviso;
  a.contexto.PERFIL = { id: 'usuario' };
  a.elemento('s_conteudo').value = 'Aula transferida para a sala 2.';
  a.elemento('s_conteudo').addEventListener = () => {};
  a.elemento('s_imagem').files = [];
  let rejeitar;
  let chamadas = 0;
  a.contexto.sb.from = () => ({ insert: () => {
    chamadas++;
    return new Promise((resolve, reject) => { rejeitar = reject; });
  } });
  a.contexto.ligarFormPublicar();
  const primeira = a.elemento('formPublicar').onsubmit(evento);
  await a.elemento('formPublicar').onsubmit(evento);
  assert.equal(chamadas, 1);
  rejeitar(Error('offline'));
  await primeira;
  assert.equal(a.elemento('s_conteudo').value, 'Aula transferida para a sala 2.');
  assert.equal(a.elemento('btnPublicarSocial').disabled, false);
  assert.match(a.avisos.at(-1).texto, /Não foi possível/);
});

test('aviso só limpa o formulário depois da confirmação da gravação', async () => {
  const a = ambiente('js/comunidade.js');
  a.contexto.aulaDoAviso = ambiente('js/comum.js').contexto.aulaDoAviso;
  a.contexto.PERFIL = { id: 'usuario', papel: 'aluno' };
  a.elemento('s_conteudo').value = 'Aviso do câmpus';
  a.elemento('s_conteudo').addEventListener = () => {};
  a.elemento('s_imagem').files = [];
  let resets = 0;
  let recargas = 0;
  let registro;
  a.elemento('formPublicar').reset = () => { resets++; };
  a.contexto.limparCampoArquivo = () => {};
  a.contexto.carregarFeedSocial = async () => { recargas++; };
  a.contexto.sb.from = () => ({ insert: async valor => { registro = valor; return { error: null }; } });
  a.contexto.ligarFormPublicar();
  await a.elemento('formPublicar').onsubmit(evento);
  assert.equal(registro.conteudo, 'Aviso do câmpus');
  assert.equal(registro.autor_id, 'usuario');
  assert.equal(Object.prototype.hasOwnProperty.call(registro, 'disciplina'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(registro, 'data_aula'), false);
  assert.equal(resets, 1);
  assert.equal(recargas, 1);
  assert.equal(a.avisos.at(-1).ok, true);
});

test('banco sem patch mantém leitura de avisos antigos sem campos de aula', async () => {
  const a = ambiente('js/comunidade.js');
  const comum = ambiente('js/comum.js').contexto;
  for (const helper of ['esc', 'avatarDe', 'quando', 'linkSeguro']) a.contexto[helper] = comum[helper];
  a.contexto.PERFIL = { id: 'usuario' };
  a.contexto.sb.from = () => ({
    select(campos) { assert.equal(campos, '*, autor:profiles(nome, foto_url)'); return this; },
    order() { return this; }, range() { return this; },
    then(resolve) { return Promise.resolve({ data: [{ id: 'anterior', autor_id: 'outro', conteudo: 'Aviso anterior ao patch', criado_em: '2026-11-03T12:00:00Z' }], error: null }).then(resolve); }
  });
  await a.contexto.carregarFeedSocial(true);
  assert.match(a.elemento('feedSocial').innerHTML, /Aviso anterior ao patch/);
  assert.doesNotMatch(a.elemento('feedSocial').innerHTML, /Não foi possível/);
});

test('banco sem patch informa a pendência e preserva o recado por matéria', async () => {
  const a = ambiente('js/comunidade.js');
  a.contexto.aulaDoAviso = ambiente('js/comum.js').contexto.aulaDoAviso;
  a.contexto.PERFIL = { id: 'usuario', papel: 'aluno' };
  a.elemento('s_conteudo').value = 'Levar os materiais combinados.';
  a.elemento('s_conteudo').addEventListener = () => {};
  a.elemento('s_disciplina').value = 'Banco de Dados';
  a.elemento('s_data_aula').value = '2026-11-09';
  a.elemento('s_imagem').files = [];
  let resets = 0;
  a.elemento('formPublicar').reset = () => { resets++; };
  a.contexto.sb.from = () => ({ insert: async () => ({ error: { code: 'PGRST204', message: "Could not find the 'data_aula' column" } }) });
  a.contexto.ligarFormPublicar();
  await a.elemento('formPublicar').onsubmit(evento);
  assert.equal(resets, 0);
  assert.equal(a.elemento('s_conteudo').value, 'Levar os materiais combinados.');
  assert.match(a.avisos.at(-1).texto, /banco ainda precisa ser atualizado/);
  assert.equal(a.elemento('btnPublicarSocial').disabled, false);
});

test('paginação de avisos não dispara duas consultas simultâneas', async () => {
  const a = ambiente('js/comunidade.js');
  let concluir;
  let chamadas = 0;
  a.contexto.sb.from = () => {
    chamadas++;
    return { select() { return this; }, order() { return this; }, range() { return this; },
      then(resolve, reject) { return new Promise(r => { concluir = r; }).then(resolve, reject); } };
  };
  a.contexto.desenharFeedSocial = () => {};
  const primeira = a.contexto.carregarFeedSocial(false);
  await Promise.resolve();
  await a.contexto.carregarFeedSocial(false);
  assert.equal(chamadas, 1);
  concluir({ data: [], error: null });
  await primeira;
  assert.equal(vm.runInContext('SOCIAL_CARREGANDO', a.contexto), false);
});

test('filtros de tarefas removidos dos dados também são limpos no estado', () => {
  const a = ambiente('js/tarefas.js');
  a.contexto.COLACIONADOR_PT = new Intl.Collator('pt-BR');
  a.contexto.esc = valor => String(valor || '');
  a.elemento('filtroProfessor').value = 'Professor removido';
  a.elemento('filtroDisciplina').value = 'Disciplina removida';
  vm.runInContext("FILTRO_PROFESSOR = 'Professor removido'; FILTRO_DISCIPLINA = 'Disciplina removida';", a.contexto);
  a.contexto.montarFiltros();
  assert.equal(vm.runInContext('FILTRO_PROFESSOR', a.contexto), '');
  assert.equal(vm.runInContext('FILTRO_DISCIPLINA', a.contexto), '');
});

test('lista de alunos consulta apenas matrículas aprovadas', async () => {
  const a = ambiente('js/turma.js');
  a.contexto.esc = valor => String(valor || '');
  a.contexto.ordenarPorNome = lista => lista;
  vm.runInContext("TURMA = { codigo: 'ABC123' }; SOU_PROFESSOR_DAQUI = true;", a.contexto);
  const filtros = [];
  a.contexto.sb.from = () => ({
    select() { return this; }, eq(campo, valor) { filtros.push([campo, valor]); return this; },
    order: async () => ({ data: [], error: null })
  });
  await a.contexto.montarLateral();
  assert.ok(filtros.some(([campo, valor]) => campo === 'status' && valor === 'aprovada'));
});

test('falha ao sair da turma não redireciona nem informa sucesso', async () => {
  const a = ambiente('js/turma.js');
  a.contexto.PERFIL = { id: 'aluno' };
  a.contexto.esc = valor => String(valor || '');
  a.contexto.confirm = () => true;
  vm.runInContext("TURMA = { codigo: 'ABC123' };", a.contexto);
  a.contexto.sb.from = () => ({
    delete() { return this; }, eq() { return this; },
    then(resolve) { return Promise.resolve({ error: Error('offline') }).then(resolve); }
  });
  await a.contexto.montarLateral();
  await a.elemento('btnSairTurma').onclick();
  assert.equal(a.contexto.window.location.href, 'https://exemplo.com/app/index.html');
  assert.equal(a.elemento('btnSairTurma').disabled, false);
  assert.match(a.avisos.at(-1).texto, /Não foi possível sair/);
});

test('nova atividade preserva formulário após falha e bloqueia envios simultâneos', async () => {
  const a = ambiente('js/tarefas.js');
  a.contexto.PERFIL = { id: 'aluno' };
  a.elemento('nt_titulo').value = 'Trabalho de matemática';
  let concluir;
  let chamadas = 0;
  let resets = 0;
  let recargas = 0;
  a.elemento('formNovaTarefa').reset = () => { resets++; };
  a.elemento('abaPendentes').click = () => {};
  a.contexto.carregarTarefas = async () => { recargas++; };
  a.contexto.sb.from = () => ({ insert: () => {
    chamadas++;
    return new Promise((resolve, reject) => { concluir = { resolve, reject }; });
  } });
  a.contexto.ligarFormNovaTarefa();
  const enviar = () => a.elemento('formNovaTarefa').onsubmit(evento);
  const primeira = enviar();
  await enviar();
  assert.equal(chamadas, 1);
  assert.equal(a.elemento('btnCadastrarTarefa').disabled, true);
  concluir.reject(Error('offline'));
  await primeira;
  assert.equal(a.elemento('btnCadastrarTarefa').disabled, false);
  assert.equal(a.elemento('btnCadastrarTarefa').textContent, 'Cadastrar atividade');
  assert.equal(a.elemento('nt_titulo').value, 'Trabalho de matemática');
  assert.equal(resets, 0);
  assert.match(a.avisos.at(-1).texto, /conexão/);

  const segunda = enviar();
  concluir.resolve({ error: null });
  await segunda;
  assert.equal(chamadas, 2);
  assert.equal(resets, 1);
  assert.equal(recargas, 1);
  assert.equal(a.elemento('btnCadastrarTarefa').disabled, false);
  assert.equal(a.avisos.at(-1).ok, true);
});

for (const entregue of [true, false]) {
  test(`entrega ${entregue} restaura estado após falha de conexão e permite nova tentativa`, async () => {
    const a = ambiente('js/tarefas.js');
    a.contexto.PERFIL = { id: 'aluno' };
    let atualizacoes = 0;
    a.contexto.atualizarStatsTarefas = () => { atualizacoes++; };
    let falhar = true;
    a.contexto.sb.from = () => ({ upsert: async () => {
      if (falhar) throw Error('offline');
      return { error: null };
    } });
    const chk = { dataset: { id: 'tarefa' }, checked: entregue, disabled: false };
    vm.runInContext(`ENTREGAS_MAP.set('tarefa', ${!entregue});`, a.contexto);
    a.contexto.ligarAcoesCartao({
      querySelectorAll: seletor => seletor === '[data-acao=alternar-entrega]' ? [chk] : []
    });
    await chk.onchange();
    assert.equal(chk.checked, !entregue);
    assert.equal(chk.disabled, false);
    assert.equal(vm.runInContext("ENTREGAS_MAP.get('tarefa')", a.contexto), !entregue);
    assert.equal(atualizacoes, 0);
    assert.match(a.avisos.at(-1).texto, /conexão/);

    falhar = false;
    chk.checked = entregue;
    await chk.onchange();
    assert.equal(chk.checked, entregue);
    assert.equal(chk.disabled, false);
    assert.equal(vm.runInContext("ENTREGAS_MAP.get('tarefa')", a.contexto), entregue);
    assert.equal(atualizacoes, 1);
    assert.equal(a.avisos.at(-1).oculto, true);
  });
}

test('cadastro sem sessão mantém confirmação visível e preenche e-mail', async () => {
  const a = ambiente('js/login.js', { signUp: async () => ({ data: { session: null } }) });
  a.elemento('c_nome').value = 'Maria Silva';
  a.elemento('c_email').value = 'maria@exemplo.com';
  a.elemento('c_senha').value = 'senha-teste';
  await a.elemento('formCriar').onsubmit(evento);
  assert.match(a.avisos.at(-1).texto, /Confirme o e-mail/);
  assert.equal(a.avisos.at(-1).ok, true);
  assert.equal(a.elemento('e_email').value, 'maria@exemplo.com');
  assert.equal(a.elemento('c_senha').value, '');
  assert.equal(a.elemento('btnCriar').disabled, false);
});

test('busca no mural consulta o servidor e escapa curingas digitados', async () => {
  const a = ambiente('js/comunidade.js');
  let filtro;
  const consulta = {
    select() { return this; }, order() { return this; }, range() { return this; },
    ilike(coluna, termo) { filtro = { coluna, termo }; return this; },
    then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); }
  };
  a.contexto.sb.from = () => consulta;
  a.contexto.desenharFeedSocial = () => {};
  vm.runInContext("BUSCA_SOCIAL = '100%_teste';", a.contexto);
  await a.contexto.carregarFeedSocial(true);
  assert.deepEqual(filtro, { coluna: 'conteudo', termo: '%100\\%\\_teste%' });
});

for (const [form, botao, metodo] of [
  ['formEntrar', 'btnEntrar', 'signInWithPassword'],
  ['formCriar', 'btnCriar', 'signUp']
]) {
  test(`${form} libera nova tentativa após falha de rede`, async () => {
    const a = ambiente('js/login.js', { [metodo]: async () => { throw Error('offline'); } });
    a.elemento('c_nome').value = 'Maria';
    await a.elemento(form).onsubmit(evento);
    assert.equal(a.elemento(botao).disabled, false);
    assert.match(a.avisos.at(-1).texto, /conexão/);
  });
}

test('recuperação não mostra sucesso se API recusar o envio', async () => {
  const a = ambiente('js/login.js', { resetPasswordForEmail: async () => ({ error: { message: 'rate limit' } }) });
  a.elemento('e_email').value = 'maria@exemplo.com';
  await a.elemento('linkEsqueciSenha').onclick(evento);
  assert.match(a.avisos.at(-1).texto, /Não foi possível/);
  assert.equal(a.elemento('linkEsqueciSenha').getAttribute('aria-disabled'), undefined);
});

test('recuperação impede envio duplicado enquanto aguarda resposta', async () => {
  let concluir;
  let chamadas = 0;
  const a = ambiente('js/login.js', { resetPasswordForEmail: () => {
    chamadas++;
    return new Promise(resolve => { concluir = resolve; });
  } });
  a.elemento('e_email').value = 'maria@exemplo.com';
  const primeira = a.elemento('linkEsqueciSenha').onclick(evento);
  await a.elemento('linkEsqueciSenha').onclick(evento);
  assert.equal(chamadas, 1);
  concluir({ error: null });
  await primeira;
});

test('erro de leitura do perfil não tenta inserir perfil substituto', async () => {
  const a = ambiente('js/comum.js', { getUser: async () => ({ data: { user: { id: 'usuario' } } }) });
  let insercoes = 0;
  a.contexto.sb.from = () => ({
    select() { return this; }, eq() { return this; },
    maybeSingle: async () => ({ error: { message: 'offline' }, data: null }),
    insert: async () => { insercoes++; }
  });
  assert.equal(await a.contexto.exigirLogin(), null);
  assert.equal(insercoes, 0);
});

test('marcar notificações com erro mantém contador e permite tentar novamente', async () => {
  const a = ambiente('js/comum.js');
  vm.runInContext("PERFIL = { id: 'usuario' };", a.contexto);
  a.contexto.configurarPushNavegador = () => {};
  a.contexto.sb.from = () => ({
    select() { return this; }, update() { return this; }, eq() { return this; },
    then(resolve) { return Promise.resolve({ count: 3, error: { message: 'offline' } }).then(resolve); }
  });
  a.contexto.sb.channel = () => ({ on() { return this; }, subscribe() {} });
  a.elemento('notifContador').textContent = '3';
  await a.contexto.iniciarNotificacoes();
  await a.elemento('btnNotifLerTudo').onclick();
  assert.equal(a.elemento('notifContador').textContent, '3');
  assert.equal(a.elemento('btnNotifLerTudo').disabled, false);
  assert.match(a.elemento('notifLista').textContent, /Não foi possível/);
});
