// ============================================================
//  Horário de aula: grade semanal (fixa por semestre, ver GRADE_SEMESTRE
//  abaixo) + professor responsável por disciplina (esse sim vem do banco,
//  em "turmas"). A grade em si não é editável pelo banco ainda — não há
//  campo de dia/sala em "turmas" — então fica aqui até isso existir.
// ============================================================

const ICONES_HORARIO = {
  rede: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  codigo: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
  web: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  requisitos: '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="m9 14 2 2 4-4"/>',
  ciencia: '<path d="M9 3h6M10 3v6.5L5 18a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3L14 9.5V3"/>',
  design: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'
};

// UEG 2026/2 — Curso de Sistemas para Internet
const GRADE_SEMESTRE = [
  { dia: 'Segunda', materia: 'Redes de Computadores',            sala: 'Sala 1', professores: 'Paulo',            icone: 'rede',       cor: 'azul'  },
  { dia: 'Terça',   materia: 'Programação e Estrutura de Dados', sala: 'Sala 2', professores: 'Eugênio e Roberto', icone: 'codigo',     cor: 'ocre'  },
  { dia: 'Quarta',  materia: 'Introdução à Programação Web',     sala: 'Sala 2', professores: 'Eugênio e Roberto', icone: 'web',        cor: 'verde' },
  { dia: 'Quinta',  materia: 'Engenharia de Requisitos',         sala: 'Sala 2', professores: 'Eugênio e Gustavo', icone: 'requisitos', cor: 'vinho' },
  { dia: 'Sexta',   materia: 'Metodologia Científica',           sala: 'Sala 1', professores: 'Gustavo',           icone: 'ciencia',    cor: 'azul'  },
  { dia: 'Sábado',  materia: 'Design de Interação',               sala: 'Sala 1', professores: 'Guilherme',        icone: 'design',     cor: 'ocre'  }
];

(async function inicio() {
  const perfil = await exigirLogin();
  if (!perfil) return;
  await carregarTarefasPendentesPorMateria();
  desenharGrade();
  await carregarProfessores();
})();

// ["Domingo","Segunda",...] — Date.getDay() já vem nessa ordem (0=domingo)
const DIA_DE_HOJE = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][new Date().getDay()];

// ------------------------------------------------------------
//  Tarefa pendente por disciplina — cruza "tarefas" (atividade solta,
//  disciplina em texto livre) com a matéria de cada dia da grade, pra
//  avisar embaixo da aula quando tiver algo a entregar daquela matéria.
//  Só entra quem ainda não foi marcado como entregue pela pessoa logada.
// ------------------------------------------------------------
let TAREFAS_POR_MATERIA = new Map();

async function carregarTarefasPendentesPorMateria() {
  TAREFAS_POR_MATERIA = new Map();

  const { data, error } = await sb
    .from('tarefas')
    .select('id, titulo, disciplina, data_entrega')
    .not('disciplina', 'is', null)
    .not('data_entrega', 'is', null)
    .order('data_entrega', { ascending: true });

  if (error || !data || !data.length) return;

  const ids = data.map(t => t.id);
  const { data: entregas } = await sb
    .from('entregas')
    .select('tarefa_id')
    .eq('aluno_id', PERFIL.id)
    .eq('entregue', true)
    .in('tarefa_id', ids);
  const entregues = new Set((entregas || []).map(e => e.tarefa_id));

  data.forEach(t => {
    if (entregues.has(t.id)) return;
    const chave = normalizarBusca(t.disciplina);
    if (!TAREFAS_POR_MATERIA.has(chave)) TAREFAS_POR_MATERIA.set(chave, []);
    TAREFAS_POR_MATERIA.get(chave).push(t);
  });
}

// disciplina é texto livre tanto na grade quanto na tarefa — compara
// normalizado e, se não bater exato, tenta por inclusão (ex.: "Introdução
// à Programação Web" digitado como só "Programação Web")
function tarefaMaisProximaDaMateria(materia) {
  const chave = normalizarBusca(materia);
  let lista = TAREFAS_POR_MATERIA.get(chave);
  if (!lista) {
    for (const [k, v] of TAREFAS_POR_MATERIA) {
      if (k.includes(chave) || chave.includes(k)) { lista = v; break; }
    }
  }
  return lista && lista.length ? lista[0] : null;
}

function desenharGrade() {
  const alvo = document.getElementById('gradeHorario');
  if (!alvo) return;

  const hojeISO = hojeLocalISOHorario();

  alvo.innerHTML = GRADE_SEMESTRE.map(d => {
    const hoje = d.dia === DIA_DE_HOJE;
    const tarefa = tarefaMaisProximaDaMateria(d.materia);
    const atrasada = tarefa && tarefa.data_entrega < hojeISO;

    return `
      <div class="horario-dia${hoje ? ' horario-dia-hoje' : ''}">
        <div class="horario-dia-topo">
          <span>${esc(d.dia)}</span>
          ${hoje ? '<span class="horario-hoje-selo">Hoje</span>' : ''}
        </div>
        <div class="horario-dia-corpo">
          <div class="horario-dia-icone cor-${d.cor}">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONES_HORARIO[d.icone] || ''}</svg>
          </div>
          <div class="horario-dia-materia">${esc(d.materia)}</div>
          <div class="horario-dia-professor">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/></svg>
            ${esc(d.professores)}
          </div>
          <div class="horario-dia-sala">${esc(d.sala)}</div>
          ${tarefa ? `
          <a href="tarefas.html" class="horario-dia-tarefa${atrasada ? ' atrasada' : ''}">
            <span class="horario-dia-tarefa-cabecalho">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
              ${esc(tarefa.titulo)}
            </span>
            <small>${atrasada ? 'atrasada — entrega era' : 'entrega'} ${esc(formatarDataHorario(tarefa.data_entrega))}</small>
          </a>` : ''}
        </div>
      </div>`;
  }).join('');
}

function formatarDataHorario(dataISO) {
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}`;
}

// "hoje" no fuso local, não em UTC (mesmo motivo do hojeLocalISO em tarefas.js)
function hojeLocalISOHorario() {
  const d = new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

async function carregarProfessores() {
  const alvo = document.getElementById('professores');

  const { data, error } = await sb
    .from('turmas')
    .select('nome, disciplina, professor:profiles(id, nome, foto_url, bio)');

  if (error) {
    alvo.innerHTML = `<div class="vazio">Não foi possível carregar os professores. ${esc(error.message)}</div>`;
    return;
  }

  const turmas = ordenarPorNome((data || []).filter(t => t.professor), t => t.professor.nome);
  if (!turmas.length) {
    alvo.innerHTML = `<div class="vazio">Nenhuma turma cadastrada ainda.</div>`;
    return;
  }

  alvo.innerHTML = turmas.map(t => `
    <div class="pessoa">
      <a href="usuario.html?id=${t.professor.id}"><img class="avatar avatar-pessoa" src="${avatarDe(t.professor)}" alt=""></a>
      <div class="pessoa-info">
        <h3><a href="usuario.html?id=${t.professor.id}">${esc(t.professor.nome)}</a></h3>
        <span class="etiqueta etiqueta-atividade">${esc(t.disciplina || t.nome)}</span>
        <p class="pessoa-bio">${t.professor.bio ? esc(t.professor.bio) : '<em>Sem bio ainda.</em>'}</p>
      </div>
    </div>`).join('');
}
