/**
 * VEGAS VIGILÂNCIA E SEGURANÇA
 * Backend — Preferência de Férias 2027
 * Banco: Google Sheets | Assinaturas: Google Drive
 */

const ABA          = 'Ferias';
const PASTA_ASSIN  = 'Vegas - Ferias - Assinaturas';
const TZ           = 'America/Sao_Paulo';
const SENHA_PADRAO = 'Vegas4747@';
const ANO_ESPERADO = 2027;

// prazo oficial (mesmos valores do formulário) — validado também aqui, porque quem
// souber a URL da API pode postar direto, sem passar pela tela
const PRAZO_INICIO = '2026-11-01';
const PRAZO_FIM    = '2026-11-25';
const BLOQUEAR_FORA_DO_PRAZO = false; // vire para true quando publicar

const HEADERS = [
  'Protocolo','Registro','Ano Ferias','Nome','CPF','Telefone','Cargo',
  'Cidade','Posto','Turno','Admissao',
  '1a Opcao','2a Opcao','3a Opcao','Observacao','Assinatura',
  'Status','Mes Aprovado','Analisado Por','Data Analise'
];

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(ABA);
  if (!sh) sh = ss.insertSheet(ABA);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
      .setFontWeight('bold').setBackground('#0A0A0A').setFontColor('#E8E8E8');
    sh.setFrozenRows(1);
    // tudo como texto: evita o Sheets reinterpretar '11/2026' como data e virar mês errado
    sh.getRange(1, 1, sh.getMaxRows(), HEADERS.length).setNumberFormat('@');
  }
  PropertiesService.getScriptProperties().setProperty('SENHA_PAINEL', SENHA_PADRAO);
  ss.setSpreadsheetTimeZone(TZ);
  return 'setup ok';
}

function _out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function _senhaOk(s) {
  return String(s || '') === String(PropertiesService.getScriptProperties().getProperty('SENHA_PAINEL') || SENHA_PADRAO);
}
function _txt(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'dd/MM/yyyy HH:mm');
  return v === null || v === undefined ? '' : String(v);
}
function _soNum(v) { return String(v || '').replace(/\D/g, ''); }

function _cpfValido(v) {
  const c = _soNum(v);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  for (var t = 9; t < 11; t++) {
    var s = 0;
    for (var i = 0; i < t; i++) s += parseInt(c.charAt(i), 10) * ((t + 1) - i);
    var d = (s * 10) % 11; if (d === 10) d = 0;
    if (d !== parseInt(c.charAt(t), 10)) return false;
  }
  return true;
}
function _formataCpf(v) {
  const c = _soNum(v);
  return c.length === 11 ? c.slice(0,3)+'.'+c.slice(3,6)+'.'+c.slice(6,9)+'-'+c.slice(9) : String(v || '');
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.action === 'listar') {
      if (!_senhaOk(p.senha)) return _out({ ok: false, erro: 'Senha incorreta.' });
      return _out({ ok: true, dados: listar_() });
    }
    return _out({ ok: true, servico: 'Ferias Vegas', ano: ANO_ESPERADO });
  } catch (err) { return _out({ ok: false, erro: String(err) }); }
}

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.action === 'criar') return _out(criar_(d));
    if (d.action === 'decidir') return _out(decidir_(d));
    return _out({ ok: false, erro: 'Ação desconhecida.' });
  } catch (err) { return _out({ ok: false, erro: String(err) }); }
}

function criar_(d) {
  const obrig = ['nome','cpf','telefone','cargo','cidade','posto','turno','admissao'];
  for (var i = 0; i < obrig.length; i++) {
    if (!String(d[obrig[i]] || '').trim()) return { ok: false, erro: 'Campo obrigatório ausente: ' + obrig[i] };
  }
  if (!_cpfValido(d.cpf)) return { ok: false, erro: 'CPF inválido.' };
  if (!d.assinatura) return { ok: false, erro: 'Assinatura é obrigatória.' };
  if (!Array.isArray(d.preferencias) || d.preferencias.length !== 3)
    return { ok: false, erro: 'É necessário escolher 3 meses em ordem de preferência.' };

  const hoje = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  if (BLOQUEAR_FORA_DO_PRAZO && (hoje < PRAZO_INICIO || hoje > PRAZO_FIM))
    return { ok: false, erro: 'Fora do prazo de preenchimento (01/11/2026 a 25/11/2026).' };

  // ---------- período aquisitivo: revalidado no servidor ----------
  // fichado no ano anterior ao das férias => só a partir do mês do aniversário de admissão
  const partes = String(d.admissao).split('-');
  const anoAdm = parseInt(partes[0], 10);
  const mesAdm = parseInt(partes[1], 10);
  if (!anoAdm || !mesAdm) return { ok: false, erro: 'Data de admissão inválida.' };
  if (anoAdm >= ANO_ESPERADO) return { ok: false, erro: 'Admissão em ' + anoAdm + ': procure o RH, não há 12 meses completos em ' + ANO_ESPERADO + '.' };

  const ORDEM_MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                       'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  if (anoAdm === ANO_ESPERADO - 1) {
    for (var k = 0; k < d.preferencias.length; k++) {
      const nomeMes = String(d.preferencias[k]).split('/')[0];
      const idx = ORDEM_MESES.indexOf(nomeMes);
      if (idx >= 0 && idx < mesAdm - 1) {
        return { ok: false, erro: nomeMes + ' não está disponível: você foi fichado em ' +
                 ORDEM_MESES[mesAdm - 1] + '/' + anoAdm + '.' };
      }
    }
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA);
    if (!sh) return { ok: false, erro: 'Aba Ferias não encontrada. Rode setup().' };

    // um envio por CPF por ano de férias
    const jaTem = protocoloDoCpf_(sh, d.cpf, d.ano || ANO_ESPERADO);
    if (jaTem) return { ok: false, erro: 'Este CPF já registrou a preferência de ' +
             (d.ano || ANO_ESPERADO) + ' (protocolo ' + jaTem + '). Procure o RH para corrigir.' };

    const protocolo = novoProtocolo_(sh);
    const agora = Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm');
    const urlAssin = salvarAssinatura_(d.assinatura, protocolo);

    sh.appendRow([
      protocolo, agora, String(d.ano || ANO_ESPERADO),
      d.nome, _formataCpf(d.cpf), d.telefone, d.cargo,
      d.cidade, d.posto, d.turno,
      String(mesAdm).padStart(2, '0') + '/' + anoAdm,
      d.preferencias[0], d.preferencias[1], d.preferencias[2],
      d.observacao || '', urlAssin,
      'Pendente', '', '', ''
    ]);

    return { ok: true, protocolo: protocolo, registro: agora };
  } finally { lock.releaseLock(); }
}

function protocoloDoCpf_(sh, cpf, ano) {
  const n = sh.getLastRow();
  if (n < 2) return null;
  const v = sh.getRange(2, 1, n - 1, HEADERS.length).getValues();
  const alvo = _soNum(cpf);
  for (var r = 0; r < v.length; r++) {
    if (_soNum(v[r][4]) === alvo && String(v[r][2]) === String(ano)) return String(v[r][0]);
  }
  return null;
}

function novoProtocolo_(sh) {
  const n = sh.getLastRow();
  var max = 0;
  if (n > 1) {
    sh.getRange(2, 1, n - 1, 1).getValues().forEach(function (r) {
      const m = String(r[0]).match(/FER-(\d+)/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
  }
  return 'FER-' + ('0000' + (max + 1)).slice(-4);
}

function salvarAssinatura_(dataUrl, nome) {
  if (!dataUrl) return '';
  const it = DriveApp.getFoldersByName(PASTA_ASSIN);
  const pasta = it.hasNext() ? it.next() : DriveApp.createFolder(PASTA_ASSIN);
  const partes = String(dataUrl).split(',');
  const b64 = partes.length > 1 ? partes[1] : partes[0];
  const blob = Utilities.newBlob(Utilities.base64Decode(b64), 'image/png', nome + '.png');
  const f = pasta.createFile(blob);
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/uc?id=' + f.getId();
}

// RH aprova indicando qual mês foi concedido
function decidir_(d) {
  if (!_senhaOk(d.senha)) return { ok: false, erro: 'Senha incorreta.' };
  if (!d.protocolo) return { ok: false, erro: 'Protocolo não informado.' };
  if (['Aprovada','Recusada'].indexOf(d.status) < 0) return { ok: false, erro: 'Status inválido.' };
  if (!String(d.analisadoPor || '').trim()) return { ok: false, erro: 'Informe quem está analisando.' };
  if (d.status === 'Aprovada' && !String(d.mesAprovado || '').trim())
    return { ok: false, erro: 'Informe o mês concedido.' };

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA);
    const n = sh.getLastRow();
    const protos = sh.getRange(2, 1, n - 1, 1).getValues();
    var linha = -1;
    for (var i = 0; i < protos.length; i++) if (String(protos[i][0]) === String(d.protocolo)) { linha = i + 2; break; }
    if (linha < 0) return { ok: false, erro: 'Protocolo não encontrado.' };

    sh.getRange(linha, 17, 1, 4).setValues([[
      d.status, d.mesAprovado || '', d.analisadoPor,
      Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm')
    ]]);
    return { ok: true, protocolo: d.protocolo, status: d.status };
  } finally { lock.releaseLock(); }
}

function listar_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA);
  if (!sh || sh.getLastRow() < 2) return [];
  const v = sh.getRange(2, 1, sh.getLastRow() - 1, HEADERS.length).getValues();
  const chaves = ['protocolo','registro','anoFerias','nome','cpf','telefone','cargo',
    'cidade','posto','turno','admissao','pref1','pref2','pref3','observacao','assinatura',
    'status','mesAprovado','analisadoPor','dataAnalise'];
  return v.filter(function (r) { return r[0]; }).map(function (r) {
    const o = {};
    chaves.forEach(function (k, i) { o[k] = _txt(r[i]); });
    return o;
  }).reverse();
}
