const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function ambiente(arquivo, auth = {}) {
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
    URL, setTimeout: () => {},
    document: {
      getElementById: elemento,
      querySelector: () => ({ value: 'aluno' }),
      querySelectorAll: () => [],
      addEventListener: (nome, fn) => { eventos[nome] = fn; }
    },
    window: { location: { href: 'https://exemplo.com/app/index.html' } },
    usuarioAtual: async () => null,
    exigirLogin: async () => null,
    esconderAviso: () => avisos.push({ oculto: true }),
    mostrarAviso: (id, texto, ok) => avisos.push({ texto, ok }),
    sb: { auth }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', arquivo), 'utf8'), contexto);
  return { contexto, elemento, avisos, eventos };
}
const evento = { preventDefault() {} };

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
