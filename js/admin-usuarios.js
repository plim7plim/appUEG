// ============================================================
//  Painel administrativo — lista de usuários
// ============================================================

let ADMIN_USUARIOS = [];
let ADMIN_USUARIOS_IDS = new Set(); // quem é admin, pro filtro "Administradores"
let FILTROS_USUARIOS = { busca: '', status: 'todos', papel: 'todos' };

(async () => {
  await exigirLogin();
  const ok = await exigirAdmin();
  if (!ok) return;

  if (!temPermissao('visualizar_usuarios')) {
    document.querySelector('.admin-conteudo').innerHTML =
      '<div class="bloco"><p>Sua conta de administrador não tem permissão para visualizar usuários.</p></div>';
    document.getElementById('conteudoAdmin').classList.remove('oculto');
    return;
  }

  document.getElementById('conteudoAdmin').classList.remove('oculto');
  ligarFiltrosUsuarios();
  await carregarUsuarios();
})();

function ligarFiltrosUsuarios() {
  const busca = document.getElementById('buscaUsuario');
  const status = document.getElementById('filtroStatus');
  const papel = document.getElementById('filtroPapel');

  busca.oninput = () => { FILTROS_USUARIOS.busca = busca.value; desenharUsuarios(); };
  status.onchange = () => { FILTROS_USUARIOS.status = status.value; desenharUsuarios(); };
  papel.onchange = () => { FILTROS_USUARIOS.papel = papel.value; desenharUsuarios(); };
}

async function carregarUsuarios() {
  const corpo = document.getElementById('listaUsuarios');

  const [{ data: perfis, error }, admins] = await Promise.all([
    sb.from('profiles')
      .select('id, nome, email, matricula, papel, foto_url, status_conta, criado_em')
      .order('criado_em', { ascending: false }),
    sb.from('administradores').select('id')
  ]);

  if (error) {
    corpo.innerHTML = '<tr><td colspan="4" class="admin-vazio">Não foi possível carregar este conteúdo. <button type="button" id="btnRetentarUsuarios" class="btn-texto">Tentar de novo</button></td></tr>';
    document.getElementById('btnRetentarUsuarios').onclick = carregarUsuarios;
    return;
  }

  ADMIN_USUARIOS_IDS = new Set(((admins && admins.data) || []).map(a => a.id));
  ADMIN_USUARIOS = ordenarPorNome(perfis || []);
  desenharUsuarios();
}

function desenharUsuarios() {
  const corpo = document.getElementById('listaUsuarios');
  const termo = normalizarBusca(FILTROS_USUARIOS.busca);

  const filtrados = ADMIN_USUARIOS.filter(u => {
    if (termo) {
      const alvo = normalizarBusca(`${u.nome} ${u.email || ''} ${u.matricula || ''}`);
      if (!alvo.includes(termo)) return false;
    }
    if (FILTROS_USUARIOS.status !== 'todos' && u.status_conta !== FILTROS_USUARIOS.status) return false;
    if (FILTROS_USUARIOS.papel === 'admin' && !ADMIN_USUARIOS_IDS.has(u.id)) return false;
    if ((FILTROS_USUARIOS.papel === 'aluno' || FILTROS_USUARIOS.papel === 'professor') && u.papel !== FILTROS_USUARIOS.papel) return false;
    return true;
  });

  if (!filtrados.length) {
    corpo.innerHTML = '<tr><td colspan="4" class="admin-vazio">Nenhum usuário encontrado com esses filtros.</td></tr>';
    return;
  }

  corpo.innerHTML = filtrados.map(u => `
    <tr onclick="location.href='admin-usuario.html?id=${u.id}'" style="cursor:pointer">
      <td data-rotulo="Usuário">
        <div class="admin-linha-usuario">
          <img class="avatar" src="${avatarDe(u)}" alt="">
          <div>
            <strong>${esc(u.nome)}${ADMIN_USUARIOS_IDS.has(u.id) ? ' <span class=\"etiqueta etiqueta-admin\">Admin</span>' : ''}</strong>
            <small>${esc(u.email || u.matricula || '')}</small>
          </div>
        </div>
      </td>
      <td data-rotulo="Papel">${etiquetaPapel(u.papel)}</td>
      <td data-rotulo="Status">${etiquetaStatusConta(u.status_conta)}</td>
      <td data-rotulo="Cadastro">${esc(dataHoraBr(u.criado_em))}</td>
    </tr>`).join('');
}
