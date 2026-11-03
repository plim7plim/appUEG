// ============================================================
//  Horarios do semestre e tarefas pendentes por disciplina.
// ============================================================

const ICONES_HORARIO = {
  rede: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  codigo: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
  web: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  requisitos: '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="m9 14 2 2 4-4"/>',
  ciencia: '<path d="M9 3h6M10 3v6.5L5 18a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3L14 9.5V3"/>',
  design: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'
};

(async function inicio() {
  const perfil = await exigirLogin();
  if (!perfil) return;
  desenharGrade();
  const resultados = await Promise.allSettled([carregarTarefasPendentesPorMateria(), carregarAvisosDeAula()]);
  desenharGrade();
  if (resultados.some(r => r.status === 'rejected')) {
    mostrarAviso('avisoHorario', 'Os horários estão disponíveis, mas alguns recados ou tarefas não puderam ser consultados. Recarregue para tentar novamente.');
  }
  sb.channel('recados-de-aula').on('postgres_changes', { event: '*', schema: 'public', table: 'publicacoes' }, async () => {
    try { await carregarAvisosDeAula(); desenharGrade(); }
    catch (_) { mostrarAviso('avisoHorario', 'Não foi possível atualizar os recados. Recarregue para tentar novamente.'); }
  }).subscribe();
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
let AVISOS_AULAS = null;

// Cada coluna representa a próxima ocorrência desse dia, incluindo hoje.
function proximaDataDaAula(dia, base = new Date()) {
  const indice = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].indexOf(dia);
  const data = new Date(base);
  data.setDate(data.getDate() + (indice - data.getDay() + 7) % 7);
  return hojeLocalISOHorario(data);
}

async function carregarAvisosDeAula() {
  const fim = new Date();
  fim.setDate(fim.getDate() + 6);
  const { data, error } = await sb.from('publicacoes')
    .select('id, disciplina, data_aula, conteudo, autor:profiles(nome)')
    .gte('data_aula', hojeLocalISOHorario()).lte('data_aula', hojeLocalISOHorario(fim))
    .order('data_aula', { ascending: true }).order('criado_em', { ascending: false });
  if (error) throw error;
  AVISOS_AULAS = data || [];
}

function recadosDaAula(dia) {
  return (AVISOS_AULAS || []).filter(a => a.data_aula === proximaDataDaAula(dia.dia)
    && normalizarBusca(a.disciplina).trim() === normalizarBusca(dia.materia).trim());
}

function blocoRecadoDeAula(a) {
  return `<div class="recado-aula"><p class="aviso-aula-meta">${esc(a.disciplina)} · ${esc(diaDaAula(a.data_aula))}</p><p class="post-corpo">${esc(a.conteudo)}</p><small>Recado de ${esc(a.autor ? a.autor.nome : 'alguém')}</small></div>`;
}

async function carregarTarefasPendentesPorMateria() {
  TAREFAS_POR_MATERIA = new Map();

  const { data, error } = await sb
    .from('tarefas')
    .select('id, titulo, disciplina, data_entrega')
    .not('disciplina', 'is', null)
    .not('data_entrega', 'is', null)
    .order('data_entrega', { ascending: true });

  if (error) throw error;
  if (!data || !data.length) return;

  const ids = data.map(t => t.id);
  const { data: entregas, error: erroEntregas } = await sb
    .from('entregas')
    .select('tarefa_id')
    .eq('aluno_id', PERFIL.id)
    .eq('entregue', true)
    .in('tarefa_id', ids);
  if (erroEntregas) throw erroEntregas;
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
    const dataAula = proximaDataDaAula(d.dia);
    const recados = recadosDaAula(d);
    const linkRecado = `comunidade.html?disciplina=${encodeURIComponent(d.materia)}&data_aula=${dataAula}#novoAviso`;

    return `
      <div class="horario-dia${hoje ? ' horario-dia-hoje' : ''}">
        <div class="horario-dia-topo">
          <span>${esc(d.dia)} · ${esc(formatarDataHorario(dataAula))}</span>
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
          ${recados.map(blocoRecadoDeAula).join('')}
          <a class="recado-aula-criar" href="${esc(linkRecado)}">+ Deixar recado para esta aula</a>
        </div>
      </div>`;
  }).join('');

  const outros = document.getElementById('outrosRecadosAula');
  if (outros) {
    if (AVISOS_AULAS === null) {
      outros.innerHTML = '<p class="ajuda-contexto">Os recados ainda não foram carregados.</p>';
    } else {
      const exibidos = new Set(GRADE_SEMESTRE.flatMap(recadosDaAula).map(a => a.id));
      const restantes = AVISOS_AULAS.filter(a => !exibidos.has(a.id));
      outros.innerHTML = restantes.length ? restantes.map(blocoRecadoDeAula).join('')
        : '<p class="ajuda-contexto">Nenhum outro recado de aula nos próximos sete dias.</p>';
    }
  }
}

function formatarDataHorario(dataISO) {
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}`;
}

// "hoje" no fuso local, não em UTC (mesmo motivo do hojeLocalISO em tarefas.js)
function hojeLocalISOHorario(d = new Date()) {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}
