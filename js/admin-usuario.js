// ============================================================
//  Painel administrativo — detalhes de um usuário e ações
//  (resetar senha, bloquear/desbloquear)
// ============================================================

let USUARIO_ALVO = null;

(async () => {
  await exigirLogin();
  const ok = await exigirAdmin();
  if (!ok) return;

  if (!temPermissao('visualizar_usuarios')) {
    document.querySelector('main.pagina').innerHTML +=
      '<div class="bloco"><p>Sua conta de administrador não tem permissão para visualizar usuários.</p></div>';
    return;
  }

  const id = param('id');
  if (!id) { window.location.href = 'admin-usuarios.html'; return; }

  await carregarUsuario(id);
  ligarModais();
})();

async function carregarUsuario(id) {
  const { data, error } = await sb
    .from('profiles')
    .select('id, nome, email, matricula, papel, foto_url, bio, status_conta, criado_em, ano_ingresso')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    document.querySelector('main.pagina').innerHTML +=
      '<div class="bloco"><p>Usuário não encontrado.</p></div>';
    return;
  }

  USUARIO_ALVO = data;
  document.getElementById('conteudoAdmin').classList.remove('oculto');
  desenharCabecalho();
  desenharAcoes();
  if (temPermissao('bloquear_contas')) carregarHistoricoBloqueio(id);
  else document.getElementById('blocoHistoricoBloqueio').classList.add('oculto');
}

function desenharCabecalho() {
  const u = USUARIO_ALVO;
  document.getElementById('usuarioCabecalho').innerHTML = `
    <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
      <img class="avatar avatar-grande" src="${avatarDe(u)}" alt="">
      <div style="flex:1;min-width:200px">
        <h1 style="font-size:1.5rem;margin-bottom:4px">${esc(u.nome)}</h1>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px">
          ${etiquetaPapel(u.papel)}
          ${etiquetaStatusConta(u.status_conta)}
        </div>
        <p style="font-size:.88rem;color:var(--tinta-fraca)">
          ${esc(u.email || 'sem e-mail cadastrado')}${u.matricula ? ' · matrícula ' + esc(u.matricula) : ''}
        </p>
        <p style="font-size:.82rem;color:var(--tinta-fraca);margin-top:4px">
          Cadastrado em ${esc(dataHoraBr(u.criado_em))}
        </p>
      </div>
    </div>`;
}

function desenharAcoes() {
  const alvo = document.getElementById('acoesUsuario');
  const u = USUARIO_ALVO;
  const souEuMesmo = u.id === PERFIL.id;
  const botoes = [];

  if (temPermissao('resetar_senha')) {
    if (u.email) {
      botoes.push('<button type="button" id="btnAbrirReset">Resetar senha</button>');
    } else {
      botoes.push('<p style="font-size:.85rem;color:var(--tinta-fraca)">Este usuário não tem e-mail cadastrado — não é possível enviar link de redefinição.</p>');
    }
  }

  if (temPermissao('bloquear_contas')) {
    if (souEuMesmo) {
      botoes.push('<p style="font-size:.85rem;color:var(--tinta-fraca)">Você não pode bloquear a própria conta.</p>');
    } else if (u.status_conta === 'bloqueada') {
      botoes.push('<button type="button" class="btn-linha" id="btnAbrirDesbloqueio">Desbloquear conta</button>');
    } else {
      botoes.push('<button type="button" class="btn-perigo" id="btnAbrirBloqueio">Bloquear conta</button>');
    }
  }

  if (!botoes.length) {
    botoes.push('<p style="font-size:.85rem;color:var(--tinta-fraca)">Sua conta de administrador não tem permissão para nenhuma ação sobre este usuário.</p>');
  }

  alvo.innerHTML = botoes.join('');

  const btnReset = document.getElementById('btnAbrirReset');
  if (btnReset) btnReset.onclick = () => abrirModal('modalReset');

  const btnBloquear = document.getElementById('btnAbrirBloqueio');
  if (btnBloquear) btnBloquear.onclick = () => abrirModal('modalBloquear');

  const btnDesbloquear = document.getElementById('btnAbrirDesbloqueio');
  if (btnDesbloquear) btnDesbloquear.onclick = () => abrirModal('modalDesbloquear');
}

async function carregarHistoricoBloqueio(id) {
  const alvo = document.getElementById('historicoBloqueio');
  const { data, error } = await sb
    .from('contas_bloqueio')
    .select('motivo, bloqueado_em, desbloqueado_em, bloqueado_por:bloqueado_por(nome), desbloqueado_por:desbloqueado_por(nome)')
    .eq('usuario_id', id)
    .order('bloqueado_em', { ascending: false });

  if (error) {
    alvo.innerHTML = '<p style="color:var(--tinta-fraca);font-size:.85rem">Não foi possível carregar o histórico.</p>';
    return;
  }
  if (!data || !data.length) {
    alvo.innerHTML = '<p style="color:var(--tinta-fraca);font-size:.85rem">Nenhum bloqueio registrado.</p>';
    return;
  }

  alvo.innerHTML = data.map(h => `
    <div class="log-item">
      <span class="log-acao">${h.desbloqueado_em ? 'Bloqueio encerrado' : 'Bloqueado'}</span>
      <div style="font-size:.85rem">${esc(h.motivo)}</div>
      <span class="log-quando">
        por ${esc((h.bloqueado_por && h.bloqueado_por.nome) || '—')} em ${esc(dataHoraBr(h.bloqueado_em))}
        ${h.desbloqueado_em ? `· desbloqueado por ${esc((h.desbloqueado_por && h.desbloqueado_por.nome) || '—')} em ${esc(dataHoraBr(h.desbloqueado_em))}` : ''}
      </span>
    </div>`).join('');
}

// ---------- modais ----------

function abrirModal(id) {
  document.getElementById(id).classList.remove('oculto');
}
function fecharModal(id) {
  document.getElementById(id).classList.add('oculto');
}

function ligarModais() {
  document.getElementById('btnCancelarReset').onclick = () => fecharModal('modalReset');
  document.getElementById('btnCancelarBloqueio').onclick = () => fecharModal('modalBloquear');
  document.getElementById('btnCancelarDesbloqueio').onclick = () => fecharModal('modalDesbloquear');

  document.getElementById('btnConfirmarReset').onclick = async () => {
    await executarAcao('btnConfirmarReset', 'modalReset', async () => {
      await chamarAdminAcao('resetar_senha', { usuario_id: USUARIO_ALVO.id });
      mostrarAviso('avisoAdminUsuario', `Link de redefinição enviado para ${USUARIO_ALVO.email}.`, true);
    });
  };

  document.getElementById('btnConfirmarBloqueio').onclick = async () => {
    const motivo = document.getElementById('motivoBloqueio').value.trim();
    if (!motivo) {
      document.getElementById('motivoBloqueio').focus();
      return;
    }
    await executarAcao('btnConfirmarBloqueio', 'modalBloquear', async () => {
      await chamarAdminAcao('bloquear_usuario', { usuario_id: USUARIO_ALVO.id, motivo });
      USUARIO_ALVO.status_conta = 'bloqueada';
      document.getElementById('motivoBloqueio').value = '';
      desenharCabecalho();
      desenharAcoes();
      if (temPermissao('bloquear_contas')) carregarHistoricoBloqueio(USUARIO_ALVO.id);
      mostrarAviso('avisoAdminUsuario', `Conta de ${USUARIO_ALVO.nome} bloqueada.`, true);
    });
  };

  document.getElementById('btnConfirmarDesbloqueio').onclick = async () => {
    await executarAcao('btnConfirmarDesbloqueio', 'modalDesbloquear', async () => {
      await chamarAdminAcao('desbloquear_usuario', { usuario_id: USUARIO_ALVO.id });
      USUARIO_ALVO.status_conta = 'ativa';
      desenharCabecalho();
      desenharAcoes();
      if (temPermissao('bloquear_contas')) carregarHistoricoBloqueio(USUARIO_ALVO.id);
      mostrarAviso('avisoAdminUsuario', `Conta de ${USUARIO_ALVO.nome} desbloqueada.`, true);
    });
  };

  // fecha modal clicando fora do card
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.add('oculto');
    });
  });
}

async function executarAcao(idBotao, idModal, fn) {
  const btn = document.getElementById(idBotao);
  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Processando...';
  esconderAviso('avisoAdminUsuario');

  try {
    await fn();
    fecharModal(idModal);
  } catch (e) {
    mostrarAviso('avisoAdminUsuario', e.message || 'Não foi possível completar a operação.');
  } finally {
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
}
