// ============================================================
//  Conheça seus colegas: professores e alunos, alunos agrupados
//  por ano de ingresso — ou em ordem alfabética, à escolha.
// ============================================================

let PESSOAS = [];
let MODO_ORDEM = 'turma'; // 'turma' | 'alfabetica'

(async function inicio() {
  const perfil = await exigirLogin();
  if (!perfil) return;
  ligarOrdemColegas();
  await carregarColegas();
})();

async function carregarColegas() {
  const alvo = document.getElementById('colegas');

  const { data, error } = await sb
    .from('profiles')
    .select('id, nome, papel, foto_url, bio, ano_ingresso, linguagem_favorita, materias_lecionadas');

  if (error) {
    alvo.innerHTML = `<div class="vazio">Não foi possível carregar. ${esc(error.message)}</div>`;
    return;
  }

  PESSOAS = ordenarPorNome(data || []);
  desenharColegas();
}

function desenharColegas() {
  const alvo = document.getElementById('colegas');

  if (!PESSOAS.length) {
    alvo.innerHTML = `<div class="vazio">Ninguém por aqui ainda.</div>`;
    return;
  }

  const professores = PESSOAS.filter(p => p.papel === 'professor');
  const alunos = PESSOAS.filter(p => p.papel !== 'professor');

  let html = '';

  if (professores.length) {
    html += secaoColegas(`Professores (${professores.length})`, professores);
  }

  if (alunos.length) {
    if (MODO_ORDEM === 'alfabetica') {
      html += secaoColegas(`Alunos (${alunos.length})`, alunos);
    } else {
      const grupos = {};
      alunos.forEach(a => {
        const chave = a.ano_ingresso || 'sem-ano';
        (grupos[chave] = grupos[chave] || []).push(a);
      });

      Object.keys(grupos)
        .filter(k => k !== 'sem-ano')
        .map(Number)
        .sort((a, b) => b - a)
        .forEach(ano => {
          html += secaoColegas(`Alunos — ingresso ${ano} (${grupos[ano].length})`, grupos[ano]);
        });

      if (grupos['sem-ano']) {
        html += secaoColegas(`Alunos — ano não informado (${grupos['sem-ano'].length})`, grupos['sem-ano']);
      }
    }
  }

  alvo.innerHTML = html;
}

function ligarOrdemColegas() {
  const btnTurma = document.getElementById('ordemTurma');
  const btnAlfabetica = document.getElementById('ordemAlfabetica');
  if (!btnTurma || !btnAlfabetica) return;

  btnTurma.onclick = () => {
    if (MODO_ORDEM === 'turma') return;
    MODO_ORDEM = 'turma';
    btnTurma.classList.add('ativa');
    btnAlfabetica.classList.remove('ativa');
    desenharColegas();
  };
  btnAlfabetica.onclick = () => {
    if (MODO_ORDEM === 'alfabetica') return;
    MODO_ORDEM = 'alfabetica';
    btnAlfabetica.classList.add('ativa');
    btnTurma.classList.remove('ativa');
    desenharColegas();
  };
}

function secaoColegas(titulo, lista) {
  return `
    <h2 class="secao-grupo">${esc(titulo)}</h2>
    <div class="pessoas">${lista.map(cartaoPessoa).join('')}</div>`;
}

function cartaoPessoa(p) {
  const ehProf = p.papel === 'professor';
  const materias = p.materias_lecionadas || [];
  return `
    <div class="pessoa">
      <a href="usuario.html?id=${p.id}"><img class="avatar avatar-pessoa" src="${avatarDe(p)}" alt=""></a>
      <div class="pessoa-info">
        <h3><a href="usuario.html?id=${p.id}">${esc(p.nome)}</a></h3>
        <span class="etiqueta${ehProf ? ' etiqueta-atividade' : ''}">${ehProf ? 'Professor' : 'Aluno'}</span>
        ${!ehProf && p.ano_ingresso ? `<span class="etiqueta">Ingresso ${p.ano_ingresso}</span>` : ''}
        ${p.linguagem_favorita ? `<span class="etiqueta">${esc(p.linguagem_favorita)}</span>` : ''}
        ${ehProf ? materias.map(m => `<span class="etiqueta">${esc(m)}</span>`).join('') : ''}
        <p class="pessoa-bio">${p.bio ? esc(p.bio) : '<em>Sem bio ainda.</em>'}</p>
      </div>
    </div>`;
}
