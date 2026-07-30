
(function(){
'use strict';

       
const API_URL = 'https://script.google.com/macros/s/AKfycbw5H0MjZB5WHh2jDXVe_2vj7vCja9fGyyD4WyYzojHIV6DRb9_D2aSpfSMRvIppfNyG7g/exec';
const MODO = (typeof google !== 'undefined' && google.script && google.script.run) ? 'gas' : 'web';

function call(action, payload){
  if(typeof window.MOCK === 'function') return window.MOCK(action, payload || {});
  if(MODO === 'gas'){
    return new Promise(function(res, rej){
      google.script.run
        .withSuccessHandler(function(txt){ try{ res(JSON.parse(txt)); }catch(e){ rej(new Error('Resposta inválida do servidor.')); } })
        .withFailureHandler(function(err){ rej(new Error(err && err.message ? err.message : 'Falha de comunicação.')); })
        .api(action, payload || {});
    });
  }
  if(!API_URL) return Promise.reject(new Error('API_URL não configurada no script.'));
  return fetch(API_URL, {
    method:'POST', redirect:'follow',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body: JSON.stringify({action:action, payload:payload||{}})
  }).then(function(r){ return r.json(); });
}

/* ═══════════════ 1. UTILITÁRIOS DE UI ═══════════════ */
const $  = function(s,c){ return (c||document).querySelector(s); };
const $$ = function(s,c){ return Array.prototype.slice.call((c||document).querySelectorAll(s)); };

const loader = $('#loader'), loaderTxt = $('#loaderTxt');
function carregando(on, txt){ loaderTxt.textContent = txt || 'Carregando…'; loader.classList.toggle('hidden', !on); }

const ICONE = {ok:'fa-circle-check', err:'fa-circle-exclamation', info:'fa-circle-info'};
function toast(msg, tipo){
  tipo = tipo || 'info';
  const el = document.createElement('div');
  el.className = 'toast ' + tipo;
  el.innerHTML = '<i class="fa-solid ' + ICONE[tipo] + '"></i><span></span>';
  el.lastChild.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(function(){ el.classList.add('out'); setTimeout(function(){ el.remove(); }, 260); }, 4200);
}

function view(id){
  $$('.view').forEach(function(v){ v.classList.add('hidden'); });
  $('#' + id).classList.remove('hidden');
  const dash = (id === 'viewDash');
  $('#btnAreaRh').classList.toggle('hidden', dash || id === 'viewLogin');
  $('#btnVoltar').classList.toggle('hidden', id !== 'viewLogin');
  $('#btnSair').classList.toggle('hidden', !dash);
  window.scrollTo({top:0, behavior:'smooth'});
}

function esc(v){ const d = document.createElement('div'); d.textContent = v == null ? '' : v; return d.innerHTML; }
function opt(sel, arr, ph){
  sel.innerHTML = (ph ? '<option value="">' + esc(ph) + '</option>' : '') +
    arr.map(function(v){ return '<option value="' + esc(v) + '">' + esc(v) + '</option>'; }).join('');
}
function erroCampo(input, msg){
  const f = input.closest('.field');
  f.classList.toggle('is-bad', !!msg);
  const h = $('.hint', f);
  if(h) h.textContent = msg || '';
  return !msg;
}

/* ═══════════════ 2. BOOT ═══════════════ */
const BOOT = window.BOOT || {};
const MESES = BOOT.meses || [];
const CIDADES = BOOT.cidades || [];
const STATUS = BOOT.status || ['Pendente','Em análise','Aprovada','Não atendida'];
const CLASSE_STATUS = {'Pendente':'s-pend','Em análise':'s-anal','Aprovada':'s-apro','Não atendida':'s-nao'};

if(BOOT.logo) $('#logo').src = BOOT.logo;
$('#logo').addEventListener('error', function(){
  const s = document.createElement('span');
  s.className = 'display sm'; s.style.color = '#fff'; s.textContent = 'VEGAS';
  this.replaceWith(s);
});
$('#heroAno').textContent = BOOT.ano || '';
$('#dashAno').textContent = BOOT.ano || '';
opt($('#cidade'), CIDADES, 'Selecione a sua unidade');

/* ═══════════════ 3. FORMULÁRIO — CPF ═══════════════ */
const inCpf = $('#cpf');
inCpf.addEventListener('input', function(){
  let v = this.value.replace(/\D/g, '').slice(0, 11);
  v = v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
       .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
  this.value = v;
  if(this.closest('.field').classList.contains('is-bad')) erroCampo(this, '');
});

function cpfValido(cpf){
  cpf = String(cpf).replace(/\D/g, '');
  if(!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  for(let t = 9; t < 11; t++){
    let soma = 0;
    for(let i = 0; i < t; i++) soma += Number(cpf[i]) * ((t + 1) - i);
    let d = (soma * 10) % 11; if(d === 10) d = 0;
    if(d !== Number(cpf[t])) return false;
  }
  return true;
}

/* ═══════════════ 4. GRADE DE MESES RANQUEÁVEL ═══════════════ */
let escolhidos = [];   // ordem = ranking
const grade = $('#gradeMeses');

grade.innerHTML = MESES.map(function(m, i){
  return '<button type="button" class="month" data-mes="' + esc(m) + '" aria-pressed="false">' +
         '<span class="m-num">' + String(i + 1).padStart(2, '0') + '</span>' + esc(m.slice(0, 3)) + '</button>';
}).join('');

function pintarMeses(){
  $$('.month', grade).forEach(function(b){
    const idx = escolhidos.indexOf(b.dataset.mes);
    if(idx >= 0){ b.dataset.rank = idx + 1; b.setAttribute('aria-pressed', 'true'); b.classList.remove('is-full'); }
    else{
      delete b.dataset.rank; b.setAttribute('aria-pressed', 'false');
      b.classList.toggle('is-full', escolhidos.length >= 3);
    }
  });
  $$('.rank-slot').forEach(function(s, i){
    const v = escolhidos[i];
    $('.rank-v', s).textContent = v || '—';
    s.classList.toggle('is-set', !!v);
  });
  if(escolhidos.length === 3) $('#hintMeses').textContent = '';
}

grade.addEventListener('click', function(e){
  const b = e.target.closest('.month'); if(!b) return;
  const m = b.dataset.mes, i = escolhidos.indexOf(m);
  if(i >= 0) escolhidos.splice(i, 1);
  else if(escolhidos.length >= 3){ toast('Você já escolheu três meses. Toque em um deles para trocar.', 'info'); return; }
  else escolhidos.push(m);
  pintarMeses();
});
pintarMeses();

/* ═══════════════ 5. ASSINATURA ═══════════════ */
const cv = $('#canvasAssinatura'), ctx = cv.getContext('2d'), caixaSign = cv.closest('.sign');
let tracos = [], traco = null, desenhando = false;

function dimensionar(){
  const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  redesenhar();
}
function redesenhar(){
  const r = cv.getBoundingClientRect();
  ctx.clearRect(0, 0, r.width, r.height);
  ctx.strokeStyle = '#111418'; ctx.lineWidth = 2.1; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  tracos.forEach(function(t){
    if(t.length < 2){
      if(t.length === 1){ ctx.beginPath(); ctx.arc(t[0][0]*r.width, t[0][1]*r.height, 1.1, 0, 6.29); ctx.fillStyle = '#111418'; ctx.fill(); }
      return;
    }
    ctx.beginPath(); ctx.moveTo(t[0][0]*r.width, t[0][1]*r.height);
    for(let i = 1; i < t.length; i++) ctx.lineTo(t[i][0]*r.width, t[i][1]*r.height);
    ctx.stroke();
  });
  caixaSign.classList.toggle('is-drawn', tracos.length > 0);
}
function ponto(e){
  const r = cv.getBoundingClientRect();
  return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
}
cv.addEventListener('pointerdown', function(e){
  desenhando = true; cv.setPointerCapture(e.pointerId);
  traco = [ponto(e)]; tracos.push(traco); redesenhar();
  $('#hintAssinatura').textContent = ''; caixaSign.closest('.field').classList.remove('is-bad');
});
cv.addEventListener('pointermove', function(e){
  if(!desenhando) return;
  traco.push(ponto(e)); redesenhar();
});
['pointerup','pointercancel','pointerleave'].forEach(function(ev){
  cv.addEventListener(ev, function(){ desenhando = false; traco = null; });
});
$('#btnLimparAssinatura').addEventListener('click', function(){ tracos = []; redesenhar(); });
window.addEventListener('resize', dimensionar);
dimensionar();

function assinaturaBase64(){
  if(!tracos.length) return '';
  const L = 620, A = 190, off = document.createElement('canvas');
  off.width = L; off.height = A;
  const o = off.getContext('2d');
  o.fillStyle = '#FFFFFF'; o.fillRect(0, 0, L, A);
  o.strokeStyle = '#111418'; o.lineWidth = 2.2; o.lineCap = 'round'; o.lineJoin = 'round';
  tracos.forEach(function(t){
    if(t.length < 2) return;
    o.beginPath(); o.moveTo(t[0][0]*L, t[0][1]*A);
    for(let i = 1; i < t.length; i++) o.lineTo(t[i][0]*L, t[i][1]*A);
    o.stroke();
  });
  return off.toDataURL('image/png');
}

/* ═══════════════ 6. OBSERVAÇÕES ═══════════════ */
$('#observacoes').addEventListener('input', function(){ $('#contObs').textContent = this.value.length; });

/* ═══════════════ 7. ENVIO ═══════════════ */
$('#formFerias').addEventListener('submit', function(e){
  e.preventDefault();
  const nome = $('#nome'), cargo = $('#cargo'), cidade = $('#cidade');
  let ok = true;

  ok = erroCampo(nome, nome.value.trim().split(/\s+/).length < 2 ? 'Informe nome e sobrenome.' : '') && ok;
  ok = erroCampo(inCpf, !cpfValido(inCpf.value) ? 'CPF inválido. Confira os números.' : '') && ok;
  ok = erroCampo(cargo, !cargo.value.trim() ? 'Informe o seu cargo.' : '') && ok;
  ok = erroCampo(cidade, !cidade.value ? 'Selecione a sua unidade.' : '') && ok;

  if(escolhidos.length < 3){
    $('#hintMeses').textContent = 'Escolha três meses diferentes em ordem de preferência.';
    $('#hintMeses').classList.add('is-bad'); ok = false;
  } else if(new Set(escolhidos).size !== 3){
    $('#hintMeses').textContent = 'Cada opção deve possuir um mês diferente.'; ok = false;
  } else { $('#hintMeses').textContent = ''; }

  const assinatura = assinaturaBase64();
  if(!assinatura){
    $('#hintAssinatura').textContent = 'Assine no campo indicado antes de enviar.';
    $('#hintAssinatura').classList.add('is-bad');
    caixaSign.closest('.field').classList.add('is-bad'); ok = false;
  }

  if(!ok){
    toast('Revise os campos destacados para continuar.', 'err');
    const alvo = $('.field.is-bad') || $('#gradeMeses');
    if(alvo) alvo.scrollIntoView({behavior:'smooth', block:'center'});
    return;
  }

  const dados = {
    nome: nome.value.trim(), cpf: inCpf.value, cargo: cargo.value.trim(), cidade: cidade.value,
    opcao1: escolhidos[0], opcao2: escolhidos[1], opcao3: escolhidos[2],
    observacoes: $('#observacoes').value.trim(), assinatura: assinatura
  };

  $('#btnEnviar').disabled = true;
  carregando(true, 'Enviando solicitação…');
  call('enviar', dados).then(function(r){
    carregando(false); $('#btnEnviar').disabled = false;
    if(!r.ok){ toast(r.erro || 'Não foi possível enviar.', 'err'); return; }
    $('#okProtocolo').textContent = r.protocolo;
    $('#okData').textContent = r.dataHora;
    $('#okResumo').innerHTML = escolhidos.map(function(m, i){
      return '<div class="rank-slot is-set"><span class="rank-n">' + (i+1) + 'ª</span><span class="rank-v">' + esc(m) + '</span></div>';
    }).join('');
    view('viewOk');
  }).catch(function(err){
    carregando(false); $('#btnEnviar').disabled = false;
    toast(err.message, 'err');
  });
});

/* ═══════════════ 8. LOGIN / SESSÃO ═══════════════ */
let TOKEN = '';
let timerSessao = null;

$('#btnAreaRh').addEventListener('click', function(){ view('viewLogin'); setTimeout(function(){ $('#senha').focus(); }, 120); });
$('#btnVoltar').addEventListener('click', function(){ view('viewForm'); });
$('#btnVerSenha').addEventListener('click', function(){
  const i = $('#senha'), ver = i.type === 'password';
  i.type = ver ? 'text' : 'password';
  this.innerHTML = '<i class="fa-solid fa-eye' + (ver ? '-slash' : '') + '"></i>';
});
$('#btnSair').addEventListener('click', encerrar);

function encerrar(){
  TOKEN = ''; DADOS = [];
  if(timerSessao) clearInterval(timerSessao);
  $('#senha').value = '';
  view('viewForm');
  toast('Sessão encerrada.', 'info');
}

$('#formLogin').addEventListener('submit', function(e){
  e.preventDefault();
  const h = $('#hintLogin'); h.textContent = '';
  carregando(true, 'Verificando acesso…');
  call('login', {senha: $('#senha').value}).then(function(r){
    carregando(false);
    if(!r.ok){ h.textContent = r.erro; h.classList.add('is-bad'); $('#senha').select(); return; }
    TOKEN = r.token;
    $('#senha').value = '';
    view('viewDash');
    iniciarContagem(90);
    carregarDados();
  }).catch(function(err){ carregando(false); h.textContent = err.message; h.classList.add('is-bad'); });
});

function iniciarContagem(min){
  let restante = min;
  $('#sessaoMin').textContent = restante;
  if(timerSessao) clearInterval(timerSessao);
  timerSessao = setInterval(function(){
    restante--;
    $('#sessaoMin').textContent = Math.max(restante, 0);
    if(restante <= 0){ clearInterval(timerSessao); toast('Sessão expirada. Entre novamente.', 'err'); encerrar(); }
  }, 60000);
}

/* ═══════════════ 9. NAVEGAÇÃO DO DASHBOARD ═══════════════ */
$$('.side-item').forEach(function(b){
  b.addEventListener('click', function(){
    $$('.side-item').forEach(function(x){ x.classList.remove('is-active'); });
    b.classList.add('is-active');
    $$('.panel').forEach(function(p){ p.classList.toggle('is-active', p.dataset.panel === b.dataset.panel); });
    if(b.dataset.panel === 'graficos') desenharGraficos();
  });
});
$('#btnRecarregar').addEventListener('click', function(){ carregarDados(true); });

/* ═══════════════ 10. DADOS + FILTROS ═══════════════ */
let DADOS = [], VISIVEIS = [], ordem = {campo:'iso', dir:'desc'};

function carregarDados(aviso){
  carregando(true, 'Carregando solicitações…');
  call('listar', {token: TOKEN}).then(function(r){
    carregando(false);
    if(!r.ok){ toast(r.erro || 'Falha ao carregar.', 'err'); if(/[Ss]essão/.test(r.erro || '')) encerrar(); return; }
    DADOS = r.itens;
    montarOpcoesFiltro();
    aplicar();
    if(aviso) toast('Dados atualizados.', 'ok');
  }).catch(function(err){ carregando(false); toast(err.message, 'err'); });
}

function unicos(campo){
  return Array.from(new Set(DADOS.map(function(d){ return d[campo]; }).filter(Boolean))).sort(function(a,b){ return a.localeCompare(b,'pt-BR'); });
}
function montarOpcoesFiltro(){
  opt($('#fCidade'), unicos('cidade'), 'Todas');
  opt($('#fCargo'),  unicos('cargo'),  'Todos');
  opt($('#fStatus'), STATUS,           'Todos');
  ['#fOp1','#fOp2','#fOp3'].forEach(function(s){ opt($(s), MESES, 'Todos'); });
}

function paraDate(iso, dataHora){
  if(iso) return new Date(iso);
  const m = /(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})/.exec(dataHora || '');
  return m ? new Date(m[3], m[2]-1, m[1], m[4], m[5]) : new Date(0);
}

function aplicar(){
  const q = $('#busca').value.trim().toLowerCase();
  const f = {
    cidade:$('#fCidade').value, cargo:$('#fCargo').value, status:$('#fStatus').value,
    op1:$('#fOp1').value, op2:$('#fOp2').value, op3:$('#fOp3').value,
    de:$('#fDe').value, ate:$('#fAte').value
  };
  const ativos = Object.keys(f).filter(function(k){ return f[k]; }).length;
  $('#badgeFiltros').textContent = ativos;
  $('#badgeFiltros').classList.toggle('hidden', ativos === 0);
  $('#btnLimparBusca').classList.toggle('hidden', !q);

  const de = f.de ? new Date(f.de + 'T00:00:00') : null;
  const ate = f.ate ? new Date(f.ate + 'T23:59:59') : null;

  VISIVEIS = DADOS.filter(function(d){
    if(f.cidade && d.cidade !== f.cidade) return false;
    if(f.cargo  && d.cargo  !== f.cargo)  return false;
    if(f.status && d.status !== f.status) return false;
    if(f.op1 && d.opcao1 !== f.op1) return false;
    if(f.op2 && d.opcao2 !== f.op2) return false;
    if(f.op3 && d.opcao3 !== f.op3) return false;
    if(de || ate){
      const dt = paraDate(d.iso, d.dataHora);
      if(de && dt < de) return false;
      if(ate && dt > ate) return false;
    }
    if(q){
      const alvo = [d.nome, d.cpf, String(d.cpf).replace(/\D/g,''), d.cidade, d.cargo,
                    d.opcao1, d.opcao2, d.opcao3, d.status, d.protocolo, d.observacoes].join(' ').toLowerCase();
      if(alvo.indexOf(q) < 0) return false;
    }
    return true;
  });

  VISIVEIS.sort(function(a,b){
    let x = a[ordem.campo], y = b[ordem.campo];
    if(ordem.campo === 'iso'){ x = paraDate(a.iso, a.dataHora); y = paraDate(b.iso, b.dataHora); }
    const c = (x > y) - (x < y);
    return ordem.dir === 'asc' ? c : -c;
  });

  $('#resumoFiltro').textContent = VISIVEIS.length + ' de ' + DADOS.length + ' solicitações';
  renderKpis(); renderTabela(); renderBarras(); renderDestaques();
  if($('.panel[data-panel=graficos]').classList.contains('is-active')) desenharGraficos();
}

['#busca','#fCidade','#fCargo','#fStatus','#fOp1','#fOp2','#fOp3','#fDe','#fAte'].forEach(function(s){
  $(s).addEventListener('input', aplicar);
});
$('#btnFiltros').addEventListener('click', function(){ $('#filtros').classList.toggle('hidden'); });
$('#btnLimparBusca').addEventListener('click', function(){ $('#busca').value = ''; aplicar(); });
$('#btnZerarFiltros').addEventListener('click', function(){
  ['#fCidade','#fCargo','#fStatus','#fOp1','#fOp2','#fOp3','#fDe','#fAte'].forEach(function(s){ $(s).value = ''; });
  $('#busca').value = ''; aplicar();
});
$$('#tabela thead th[data-sort]').forEach(function(th){
  th.addEventListener('click', function(){
    const c = th.dataset.sort;
    ordem = {campo:c, dir: (ordem.campo === c && ordem.dir === 'asc') ? 'desc' : 'asc'};
    $$('#tabela thead th').forEach(function(x){ x.removeAttribute('data-dir'); });
    th.dataset.dir = ordem.dir;
    aplicar();
  });
});

/* ═══════════════ 11. RENDER ═══════════════ */
function contar(arr, fn){
  const m = {};
  arr.forEach(function(d){ const k = fn(d); if(k) m[k] = (m[k] || 0) + 1; });
  return m;
}
function ordenarMapa(m, ref){
  const e = Object.keys(m).map(function(k){ return [k, m[k]]; });
  if(ref) e.sort(function(a,b){ return ref.indexOf(a[0]) - ref.indexOf(b[0]); });
  else e.sort(function(a,b){ return b[1] - a[1]; });
  return e;
}

function renderKpis(){
  const c = contar(VISIVEIS, function(d){ return d.status; });
  $('#kTotal').textContent   = VISIVEIS.length;
  $('#kPend').textContent    = c['Pendente'] || 0;
  $('#kAnalise').textContent = c['Em análise'] || 0;
  $('#kOk').textContent      = c['Aprovada'] || 0;
  $('#kNo').textContent      = c['Não atendida'] || 0;
}

function barras(el, entradas){
  if(!entradas.length){ el.innerHTML = '<p class="side-meta">Sem dados para exibir.</p>'; return; }
  const max = Math.max.apply(null, entradas.map(function(e){ return e[1]; }));
  el.innerHTML = entradas.map(function(e){
    return '<div class="bar"><span class="bar-k">' + esc(e[0]) + '</span><span class="bar-v">' + e[1] + '</span>' +
           '<span class="bar-t"><span class="bar-f" style="width:' + (e[1]/max*100).toFixed(1) + '%"></span></span></div>';
  }).join('');
}
function renderBarras(){
  barras($('#listaCidades'), ordenarMapa(contar(VISIVEIS, function(d){ return d.cidade; })));
  barras($('#listaMeses'),   ordenarMapa(contar(VISIVEIS, function(d){ return d.opcao1; }), MESES));
}

function renderTabela(){
  const tb = $('#corpoTabela');
  $('#vazio').classList.toggle('hidden', VISIVEIS.length > 0);
  tb.innerHTML = VISIVEIS.map(function(d){
    return '<tr data-p="' + esc(d.protocolo) + '">' +
      '<td class="c-nome">' + esc(d.nome) + '</td>' +
      '<td class="c-mono">' + esc(d.cpf) + '</td>' +
      '<td>' + esc(d.cidade) + '</td>' +
      '<td>' + esc(d.cargo) + '</td>' +
      '<td>' + esc(d.opcao1) + '</td>' +
      '<td>' + esc(d.opcao2) + '</td>' +
      '<td>' + esc(d.opcao3) + '</td>' +
      '<td class="c-mono">' + esc(String(d.dataHora).slice(0, 10)) + '</td>' +
      '<td><span class="pill ' + (CLASSE_STATUS[d.status] || 's-pend') + '">' + esc(d.status) + '</span></td>' +
      '<td class="c-acoes">' +
        '<button class="icon-btn" data-acao="ver" title="Visualizar"><i class="fa-solid fa-eye"></i></button>' +
        '<button class="icon-btn" data-acao="status" title="Editar status"><i class="fa-solid fa-pen-to-square"></i></button>' +
        '<button class="icon-btn danger" data-acao="excluir" title="Excluir"><i class="fa-solid fa-trash"></i></button>' +
      '</td></tr>';
  }).join('');
}

function renderDestaques(){
  const mes = ordenarMapa(contar(VISIVEIS, function(d){ return d.opcao1; }))[0];
  const cid = ordenarMapa(contar(VISIVEIS, function(d){ return d.cidade; }))[0];
  const car = ordenarMapa(contar(VISIVEIS, function(d){ return d.cargo; }))[0];
  const ult = VISIVEIS.slice().sort(function(a,b){ return paraDate(b.iso,b.dataHora) - paraDate(a.iso,a.dataHora); })[0];
  const put = function(id, idQ, e, suf){
    $(id).textContent  = e ? e[0] : '—';
    $(idQ).textContent = e ? e[1] + ' ' + suf : 'sem dados';
  };
  put('#sMes','#sMesQ', mes, 'como 1ª opção');
  put('#sCidade','#sCidadeQ', cid, 'solicitações');
  put('#sCargo','#sCargoQ', car, 'pedidos');
  $('#sUlt').textContent  = ult ? ult.nome : '—';
  $('#sUltQ').textContent = ult ? ult.dataHora + ' · ' + ult.protocolo : 'sem dados';
}

/* ═══════════════ 12. GRÁFICOS ═══════════════ */
const graficos = {};
const PALETA = ['#2F6FEB','#5C8EF6','#8FB0F9','#AFB7C2','#727A86','#CBA33A','#33A96E','#C4574F',
                '#3E82C4','#6E7FE0','#9AA3AF','#4FA8A0'];
if(window.Chart){
  Chart.defaults.color = '#AFB7C2';
  Chart.defaults.font.family = "'IBM Plex Sans',sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.borderColor = 'rgba(37,43,52,.9)';
}
function grafico(id, tipo, labels, valores, horizontal){
  if(!window.Chart) return;
  if(graficos[id]) graficos[id].destroy();
  const cores = labels.map(function(_, i){ return PALETA[i % PALETA.length]; });
  graficos[id] = new Chart($('#' + id), {
    type: tipo,
    data: {labels: labels, datasets: [{
      label:'Solicitações', data: valores,
      backgroundColor: tipo === 'bar' ? cores.map(function(c){ return c + 'CC'; }) : cores,
      borderColor: tipo === 'bar' ? cores : '#0C0E12',
      borderWidth: tipo === 'bar' ? 1 : 2, borderRadius: 5
    }]},
    options:{
      responsive:true, maintainAspectRatio:false,
      indexAxis: horizontal ? 'y' : 'x',
      plugins:{ legend:{ display: tipo === 'doughnut', position:'right', labels:{boxWidth:10, padding:12} } },
      scales: tipo === 'doughnut' ? {} : {
        x:{ grid:{color:'rgba(37,43,52,.6)'}, ticks:{maxRotation:0, autoSkip:false} },
        y:{ grid:{color:'rgba(37,43,52,.6)'}, beginAtZero:true, ticks:{precision:0} }
      }
    }
  });
}
function desenharGraficos(){
  const porMes = MESES.map(function(m){
    return VISIVEIS.filter(function(d){ return d.opcao1===m || d.opcao2===m || d.opcao3===m; }).length;
  });
  grafico('chMes','bar', MESES.map(function(m){ return m.slice(0,3); }), porMes);

  const cid = ordenarMapa(contar(VISIVEIS, function(d){ return d.cidade; }));
  grafico('chCidade','bar', cid.map(function(e){ return e[0]; }), cid.map(function(e){ return e[1]; }), true);

  const car = ordenarMapa(contar(VISIVEIS, function(d){ return d.cargo; })).slice(0,10);
  grafico('chCargo','bar', car.map(function(e){ return e[0]; }), car.map(function(e){ return e[1]; }), true);

  const st = STATUS.filter(function(s){ return VISIVEIS.some(function(d){ return d.status===s; }); });
  grafico('chStatus','doughnut', st, st.map(function(s){ return VISIVEIS.filter(function(d){ return d.status===s; }).length; }));
}

/* ═══════════════ 13. MODAL / AÇÕES ═══════════════ */
const modal = $('#modal');
function abrirModal(titulo, corpo, pe){
  $('#modalTitulo').textContent = titulo;
  $('#modalCorpo').innerHTML = corpo;
  $('#modalPe').innerHTML = pe || '';
  modal.classList.remove('hidden');
}
function fecharModal(){ modal.classList.add('hidden'); }
modal.addEventListener('click', function(e){ if(e.target.closest('[data-close]')) fecharModal(); });
document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && !modal.classList.contains('hidden')) fecharModal(); });

$('#corpoTabela').addEventListener('click', function(e){
  const b = e.target.closest('[data-acao]'); if(!b) return;
  const p = b.closest('tr').dataset.p;
  const d = DADOS.filter(function(x){ return x.protocolo === p; })[0];
  if(!d) return;
  if(b.dataset.acao === 'ver')     verDetalhes(d);
  if(b.dataset.acao === 'status')  editarStatus(d);
  if(b.dataset.acao === 'excluir') confirmarExclusao(d);
});

function verDetalhes(d){
  const linha = function(k, v){ return '<dt>' + k + '</dt><dd>' + esc(v || '—') + '</dd>'; };
  const partes = String(d.dataHora).split(' ');
  abrirModal('Solicitação ' + d.protocolo,
    '<dl class="dl">' +
      linha('Protocolo', d.protocolo) + linha('Nome completo', d.nome) + linha('CPF', d.cpf) +
      linha('Cargo', d.cargo) + linha('Unidade / cidade', d.cidade) +
      linha('1ª opção', d.opcao1) + linha('2ª opção', d.opcao2) + linha('3ª opção', d.opcao3) +
      linha('Data', partes[0]) + linha('Hora', partes[1]) +
      '<dt>Status</dt><dd><span class="pill ' + (CLASSE_STATUS[d.status] || 's-pend') + '">' + esc(d.status) + '</span></dd>' +
      linha('Atualizado em', d.atualizado) + linha('Observações', d.observacoes) +
    '</dl>' +
    '<div><span class="lbl" style="display:block;margin-bottom:.45rem">Assinatura</span>' +
    '<div class="sign-view" id="boxAssinatura"><p>Carregando assinatura…</p></div></div>',
    '<button class="btn btn-line" id="btnPdfItem"><i class="fa-solid fa-file-pdf"></i> Baixar PDF</button>' +
    '<button class="btn btn-ghost" data-close>Fechar</button>');

  call('assinatura', {token: TOKEN, protocolo: d.protocolo}).then(function(r){
    const box = $('#boxAssinatura'); if(!box) return;
    box.innerHTML = (r.ok && r.assinatura)
      ? '<img src="' + r.assinatura + '" alt="Assinatura de ' + esc(d.nome) + '">'
      : '<p>Assinatura não disponível.</p>';
    box.dataset.img = (r.ok && r.assinatura) ? r.assinatura : '';
  }).catch(function(){ const b = $('#boxAssinatura'); if(b) b.innerHTML = '<p>Não foi possível carregar a assinatura.</p>'; });

  $('#btnPdfItem').addEventListener('click', function(){ pdfIndividual(d, ($('#boxAssinatura')||{}).dataset ? $('#boxAssinatura').dataset.img : ''); });
}

function editarStatus(d){
  abrirModal('Editar status · ' + d.nome,
    '<label class="field"><span class="lbl">Status da solicitação</span>' +
    '<div class="select-wrap"><select id="novoStatus">' +
      STATUS.map(function(s){ return '<option value="' + esc(s) + '"' + (s===d.status?' selected':'') + '>' + esc(s) + '</option>'; }).join('') +
    '</select><i class="fa-solid fa-chevron-down"></i></div>' +
    '<em class="hint">Protocolo ' + esc(d.protocolo) + ' · atual: ' + esc(d.status) + '</em></label>',
    '<button class="btn btn-ghost" data-close>Cancelar</button>' +
    '<button class="btn btn-primary" id="btnSalvarStatus"><i class="fa-solid fa-check"></i> Salvar status</button>');

  $('#btnSalvarStatus').addEventListener('click', function(){
    const novo = $('#novoStatus').value;
    carregando(true, 'Salvando status…');
    call('status', {token: TOKEN, protocolo: d.protocolo, status: novo}).then(function(r){
      carregando(false);
      if(!r.ok){ toast(r.erro || 'Não foi possível salvar.', 'err'); return; }
      d.status = novo; fecharModal(); aplicar(); toast('Status atualizado para "' + novo + '".', 'ok');
    }).catch(function(err){ carregando(false); toast(err.message, 'err'); });
  });
}

function confirmarExclusao(d){
  abrirModal('Excluir solicitação',
    '<p class="lede">Excluir a solicitação <b>' + esc(d.protocolo) + '</b> de <b>' + esc(d.nome) + '</b>? ' +
    'A linha é removida da planilha e não há como desfazer.</p>',
    '<button class="btn btn-ghost" data-close>Cancelar</button>' +
    '<button class="btn btn-primary" id="btnConfirmarEx" style="background:linear-gradient(180deg,#D4635A,#B0453D)">' +
    '<i class="fa-solid fa-trash"></i> Excluir definitivamente</button>');

  $('#btnConfirmarEx').addEventListener('click', function(){
    carregando(true, 'Excluindo…');
    call('excluir', {token: TOKEN, protocolo: d.protocolo}).then(function(r){
      carregando(false);
      if(!r.ok){ toast(r.erro || 'Não foi possível excluir.', 'err'); return; }
      DADOS = DADOS.filter(function(x){ return x.protocolo !== d.protocolo; });
      fecharModal(); montarOpcoesFiltro(); aplicar(); toast('Solicitação excluída.', 'ok');
    }).catch(function(err){ carregando(false); toast(err.message, 'err'); });
  });
}

/* ═══════════════ 14. EXPORTAÇÕES ═══════════════ */
const COLUNAS = ['Protocolo','Nome','CPF','Cargo','Cidade','1ª Opção','2ª Opção','3ª Opção','Data/Hora','Status','Observações'];
function linhaExport(d){
  return [d.protocolo, d.nome, d.cpf, d.cargo, d.cidade, d.opcao1, d.opcao2, d.opcao3, d.dataHora, d.status, d.observacoes || ''];
}
function nomeArquivo(ext){
  const h = new Date().toISOString().slice(0,16).replace(/[:T]/g,'-');
  return 'ferias-vegas-' + h + '.' + ext;
}
function baixar(blob, nome){
  const a = document.createElement('a'), url = URL.createObjectURL(blob);
  a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1500);
}

/* Excel: CSV com BOM e separador ";" — abre direto no Excel pt-BR */
$('#btnXls').addEventListener('click', function(){
  if(!VISIVEIS.length){ toast('Nada para exportar com os filtros atuais.', 'info'); return; }
  const cel = function(v){ return '"' + String(v == null ? '' : v).replace(/"/g,'""') + '"'; };
  const csv = [COLUNAS.map(cel).join(';')].concat(VISIVEIS.map(function(d){ return linhaExport(d).map(cel).join(';'); })).join('\r\n');
  baixar(new Blob(['\uFEFF' + csv], {type:'text/csv;charset=utf-8'}), nomeArquivo('csv'));
  toast('Planilha exportada.', 'ok');
});

$('#btnPdf').addEventListener('click', function(){
  const painel = ($('.side-item.is-active') || {}).dataset;
  if(painel && (painel.panel === 'graficos' || painel.panel === 'painel')) return pdfVisual(painel.panel);
  return pdfLista();
});

function cabecalhoPdf(doc, subtitulo){
  doc.setFillColor(10,10,10); doc.rect(0,0,doc.internal.pageSize.getWidth(),58,'F');
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(16);
  doc.text('VEGAS VIGILÂNCIA E SEGURANÇA', 40, 26);
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(180,188,198);
  doc.text(subtitulo, 40, 43);
  doc.text(new Date().toLocaleString('pt-BR'), doc.internal.pageSize.getWidth()-40, 43, {align:'right'});
  doc.setTextColor(20,20,20);
}

function pdfLista(){
  if(!window.jspdf){ toast('Biblioteca de PDF não carregou. Verifique a conexão.', 'err'); return; }
  if(!VISIVEIS.length){ toast('Nada para exportar com os filtros atuais.', 'info'); return; }
  const doc = new window.jspdf.jsPDF({orientation:'landscape', unit:'pt', format:'a4'});
  cabecalhoPdf(doc, 'Preferência de férias ' + (BOOT.ano||'') + ' · ' + VISIVEIS.length + ' solicitações · ' + $('#resumoFiltro').textContent);
  doc.autoTable({
    startY: 76,
    head: [COLUNAS.slice(0,10)],
    body: VISIVEIS.map(function(d){ return linhaExport(d).slice(0,10); }),
    styles:{fontSize:7.5, cellPadding:4, overflow:'linebreak'},
    headStyles:{fillColor:[16,19,24], textColor:[232,232,232], fontStyle:'bold'},
    alternateRowStyles:{fillColor:[245,246,248]},
    columnStyles:{0:{cellWidth:62},2:{cellWidth:78},8:{cellWidth:88}},
    margin:{left:30, right:30}
  });
  doc.save(nomeArquivo('pdf'));
  toast('PDF gerado.', 'ok');
}

function pdfVisual(nomePainel){
  if(!window.html2canvas || !window.jspdf){ toast('Bibliotecas de PDF não carregaram.', 'err'); return; }
  const alvo = $('.panel[data-panel=' + nomePainel + ']');
  carregando(true, 'Gerando PDF…');
  html2canvas(alvo, {backgroundColor:'#0A0C10', scale:2, useCORS:true}).then(function(canvas){
    const doc = new window.jspdf.jsPDF({orientation:'landscape', unit:'pt', format:'a4'});
    cabecalhoPdf(doc, (nomePainel === 'graficos' ? 'Gráficos' : 'Visão geral') + ' · férias ' + (BOOT.ano||''));
    const L = doc.internal.pageSize.getWidth() - 60;
    const A = canvas.height * L / canvas.width;
    doc.addImage(canvas.toDataURL('image/jpeg', .92), 'JPEG', 30, 76, L, Math.min(A, doc.internal.pageSize.getHeight()-100));
    doc.save(nomeArquivo('pdf'));
    carregando(false); toast('PDF gerado.', 'ok');
  }).catch(function(){ carregando(false); toast('Não foi possível gerar o PDF deste painel.', 'err'); });
}

function pdfIndividual(d, imgAssinatura){
  if(!window.jspdf){ toast('Biblioteca de PDF não carregou.', 'err'); return; }
  const doc = new window.jspdf.jsPDF({unit:'pt', format:'a4'});
  cabecalhoPdf(doc, 'Solicitação de preferência de férias · ' + d.protocolo);
  doc.autoTable({
    startY: 80,
    body: [
      ['Nome completo', d.nome], ['CPF', d.cpf], ['Cargo', d.cargo], ['Unidade / cidade', d.cidade],
      ['1ª opção', d.opcao1], ['2ª opção', d.opcao2], ['3ª opção', d.opcao3],
      ['Data / hora', d.dataHora], ['Status', d.status], ['Observações', d.observacoes || '—']
    ],
    theme:'grid', styles:{fontSize:9, cellPadding:6},
    columnStyles:{0:{cellWidth:150, fontStyle:'bold', fillColor:[244,245,247]}},
    margin:{left:40, right:40}
  });
  let y = doc.lastAutoTable.finalY + 28;
  doc.setFontSize(8.5); doc.setTextColor(110,118,128);
  doc.text('ASSINATURA DO COLABORADOR', 40, y);
  if(imgAssinatura){ try{ doc.addImage(imgAssinatura, 'PNG', 40, y + 8, 300, 92); }catch(e){} }
  doc.setDrawColor(200,204,210); doc.line(40, y + 104, 340, y + 104);
  doc.save('ferias-' + d.protocolo + '.pdf');
}

$('#btnPrint').addEventListener('click', function(){ window.print(); });

/* ═══════════════ 15. START ═══════════════ */
view('viewForm');

})();
