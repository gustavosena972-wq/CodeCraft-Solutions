/* =========================================================================
   CONFIGURAÇÃO — cole aqui a URL e a chave do seu projeto Supabase.
   Onde pegar: Supabase → seu projeto → Project Settings (engrenagem) → API
   ========================================================================= */
const SUPABASE_URL = 'https://eqaoanbanhryhbldlbhc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_cDjtfaScPpBj-JHSCwagng_LoKGL-IN';
/* ========================================================================= */

/* Dados da empresa para o PIX. A chave abaixo (telefone) é onde o dinheiro cai. */
const COMPANY_NAME = 'CODECRAFT SOLUTIONS';
const COMPANY_PIX_KEY = '31999758385';
const COMPANY_PIX_KEY_ALT = '31999758385';
const COMPANY_PIX_CITY = 'BELO HORIZONTE';
/* Intervalo (ms) do fallback de atualização automática caso o realtime falhe. */
const LIVE_POLL_MS = 3000;

const configOk = !SUPABASE_URL.startsWith('COLE_AQUI') && !SUPABASE_ANON_KEY.startsWith('COLE_AQUI');
if(!configOk){ document.getElementById('config-banner').classList.add('show'); }
const supabaseClient = configOk ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Evita misturar sessão com o CodeCraft Gestão no mesmo domínio github.io
    storageKey: 'ccs-site-auth-v1',
  },
}) : null;

/* Contas autorizadas no painel (Gustavo + Lucas) — login só via Supabase Auth. */
const ADMIN_ALLOWED_EMAILS = [
  'gustavosena972@gmail.com',
  'lucashdhdhdhdhdbddb@gmail.com'
];
try{ sessionStorage.removeItem('ccs-admin-local'); }catch(e){}
function normalizeEmail(email){
  return String(email || '').trim().toLowerCase();
}
function isAllowedAdminEmail(email){
  return ADMIN_ALLOWED_EMAILS.includes(normalizeEmail(email));
}
function sessionAdminEmail(session){
  return session && session.user ? normalizeEmail(session.user.email) : '';
}
async function requireAdminSession(){
  if(!supabaseClient) return null;
  const { data } = await supabaseClient.auth.getSession();
  const session = data && data.session ? data.session : null;
  if(session){
    if(!isAllowedAdminEmail(sessionAdminEmail(session))){
      await supabaseClient.auth.signOut();
      return null;
    }
    return session;
  }
  return null;
}

/* ================= UTIL ================= */
function genCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for(let i=0;i<6;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}
function fmtDate(iso){
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
}
function showToast(msg){
  const t = document.getElementById('ccs-toast');
  if(!t){ console.log(msg); return; }
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2200);
}
function fromRow(r){
  return { id:r.id, trackingCode:r.tracking_code, clientName:r.client_name, projectName:r.project_name,
    serviceType:r.service_type || 'site', status:r.status, pixKey:r.pix_key, pixValue:r.pix_value, pixCity:r.pix_city, notes:r.notes,
    deliveryUrl:r.delivery_url || '', paid:r.paid, createdAt:r.created_at, updatedAt:r.updated_at };
}

/* ================= DB CALLS (Supabase) ================= */
async function loadProjects(){
  if(!supabaseClient) return [];
  const { data, error } = await supabaseClient.from('projects').select('*').order('created_at', { ascending:false });
  if(error){ console.error(error); return []; }
  return data.map(fromRow);
}
async function loadProjectByCode(code){
  if(!supabaseClient) return null;
  const { data, error } = await supabaseClient.from('projects').select('*').eq('tracking_code', code).maybeSingle();
  if(error || !data) return null;
  return fromRow(data);
}
async function insertProject(p){
  if(!supabaseClient) return null;
  if(!(await requireAdminSession())){ showToast('Faça login no admin para criar projetos.'); return null; }
  const { data, error } = await supabaseClient.from('projects').insert({
    tracking_code: p.trackingCode, client_name: p.clientName, project_name: p.projectName,
    service_type: p.serviceType || 'site',
    status:'analise', pix_key: p.pixKey, pix_value: p.pixValue || null, pix_city: p.pixCity, notes: p.notes, paid:false
  }).select().single();
  if(error){ console.error(error); showToast('Erro ao salvar projeto. Confirme o login e o SQL do banco.'); return null; }
  return fromRow(data);
}
async function updateProject(id, fields){
  if(!supabaseClient) return;
  if(!(await requireAdminSession())){ showToast('Faça login no admin para alterar projetos.'); return; }
  const dbFields = { updated_at: new Date().toISOString() };
  if('status' in fields) dbFields.status = fields.status;
  if('paid' in fields) dbFields.paid = fields.paid;
  if('delivery_url' in fields) dbFields.delivery_url = fields.delivery_url;
  const { error } = await supabaseClient.from('projects').update(dbFields).eq('id', id);
  if(error){ console.error(error); showToast('Não foi possível atualizar o projeto.'); }
}
async function deleteProjectRow(id){
  if(!supabaseClient) return;
  if(!(await requireAdminSession())){ showToast('Faça login no admin para excluir.'); return; }
  const { error } = await supabaseClient.from('projects').delete().eq('id', id);
  if(error){ console.error(error); showToast('Não foi possível excluir o projeto.'); }
}
async function loadMessages(){
  if(!supabaseClient) return [];
  if(!(await requireAdminSession())) return [];
  const { data, error } = await supabaseClient.from('messages').select('*').order('created_at', { ascending:false });
  if(error){ console.error(error); return []; }
  return data.map(m=>({ id:m.id, name:m.name, contact:m.contact, msg:m.msg, createdAt:m.created_at }));
}
async function insertMessage(m){
  if(!supabaseClient) return false;
  const row = { name: String(m.name||'').slice(0,80), contact: String(m.contact||'').slice(0,120), msg: String(m.msg||'').slice(0,2000) };
  let { error } = await supabaseClient.from('messages').insert(row);
  if(error){
    await new Promise(r=>setTimeout(r, 600));
    ({ error } = await supabaseClient.from('messages').insert(row));
  }
  if(error){ console.error(error); showToast('Erro ao enviar mensagem. Tente de novo em instantes.'); return false; }
  return true;
}
/* Chat por projeto (tabela chat_messages). Sinaliza se a tabela não existe
   ainda, para o site continuar funcionando sem quebrar. */
let chatTableMissing = false;
async function loadChat(code){
  if(!supabaseClient) return [];
  const { data, error } = await supabaseClient.from('chat_messages')
    .select('*').eq('tracking_code', code).order('created_at', { ascending:true });
  if(error){
    if((error.message||'').toLowerCase().includes('chat_messages')) chatTableMissing = true;
    console.error(error); return [];
  }
  return data.map(c=>({ id:c.id, trackingCode:c.tracking_code, sender:c.sender, body:c.body, createdAt:c.created_at }));
}
async function insertChat(code, sender, body){
  if(!supabaseClient) return false;
  if(sender === 'admin' && !(await requireAdminSession())){
    showToast('Faça login no admin para responder.');
    return false;
  }
  const clean = String(body||'').slice(0, 4000);
  let { error } = await supabaseClient.from('chat_messages')
    .insert({ tracking_code: code, sender, body: clean });
  if(error){
    await new Promise(r=>setTimeout(r, 600));
    ({ error } = await supabaseClient.from('chat_messages')
      .insert({ tracking_code: code, sender, body: clean }));
  }
  if(error){
    if((error.message||'').toLowerCase().includes('chat_messages')) chatTableMissing = true;
    console.error(error); showToast('Não foi possível enviar. Verifique a tabela de conversas.'); return false;
  }
  return true;
}

/* Chat aberto (leads): conversas iniciadas na landing, antes de existir um
   projeto. Guardamos cada contato em lead_chats; as mensagens reusam a tabela
   chat_messages (tracking_code = código do lead). */
async function insertLead(code, name){
  if(!supabaseClient) return false;
  const { error } = await supabaseClient.from('lead_chats').insert({ code, name });
  if(error){ console.error(error); showToast('Não foi possível iniciar o chat. Verifique a tabela de contatos.'); return false; }
  return true;
}
async function loadLeadChats(){
  if(!supabaseClient) return [];
  const { data, error } = await supabaseClient.from('lead_chats').select('*').order('last_at', { ascending:false });
  if(error){ console.error(error); return []; }
  return data.map(l=>({ id:l.id, code:l.code, name:l.name, createdAt:l.created_at, lastAt:l.last_at }))
    .filter(l=> !String(l.code||'').startsWith('CRM-'));
}
async function loadLeadByCode(code){
  if(!supabaseClient) return null;
  const { data, error } = await supabaseClient.from('lead_chats').select('*').eq('code', code).maybeSingle();
  if(error || !data) return null;
  return { id:data.id, code:data.code, name:data.name, createdAt:data.created_at, lastAt:data.last_at };
}
async function touchLead(code){
  if(!supabaseClient) return;
  await supabaseClient.from('lead_chats').update({ last_at: new Date().toISOString() }).eq('code', code);
}

/* ================= PIX (BR Code / EMV payload) ================= */
function crc16(str){
  let crc = 0xFFFF;
  for(let c=0;c<str.length;c++){
    crc ^= str.charCodeAt(c) << 8;
    for(let i=0;i<8;i++){
      crc = (crc & 0x8000) ? ((crc<<1) ^ 0x1021) : (crc<<1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4,'0');
}
function tlv(id, value){ return id + String(value.length).padStart(2,'0') + value; }
/* Normaliza a chave PIX. Telefones precisam do formato +55DDDNUMERO para o
   banco reconhecer o QR. E-mail/CPF/chave aleatória passam sem alteração. */
function normalizePixKey(chave){
  let k = (chave || '').trim();
  if(!k) return '';
  if(k.includes('@')) return k.toLowerCase();
  if(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k)) return k;
  const digits = k.replace(/\D/g, '');
  if(digits.length === 11 && digits[2] === '9') return '+55' + digits;
  if(digits.length === 13 && digits.indexOf('55') === 0) return '+' + digits;
  return digits || k;
}
function buildPixPayload({chave, valor, nome, cidade, txid}){
  const merchantAccount = tlv('00','br.gov.bcb.pix') + tlv('01', normalizePixKey(chave));
  const mai = tlv('26', merchantAccount);
  const tx = String(txid || '***').replace(/[^a-zA-Z0-9*]/g,'').slice(0,25) || '***';
  const addData = tlv('62', tlv('05', tx));
  let payload = tlv('00','01') + tlv('01','11') + mai + tlv('52','0000') + tlv('53','986');
  if(valor) payload += tlv('54', Number(valor).toFixed(2));
  payload += tlv('58','BR') + tlv('59',(nome||COMPANY_NAME).slice(0,25).toUpperCase()) + tlv('60',(cidade||COMPANY_PIX_CITY).slice(0,15).toUpperCase()) + addData;
  payload += '6304';
  return payload + crc16(payload);
}

/* ================= SCREEN SWITCH ================= */
let realtimeChannel = null;
let pollTimer = null;
/* Fallback: mesmo que o realtime do Supabase esteja desligado, recarregamos
   os dados a cada LIVE_POLL_MS para o painel/portal atualizar sozinho. */
function startPolling(fn){
  stopPolling();
  pollTimer = setInterval(()=>{ try{ fn(); }catch(e){ console.error(e); } }, LIVE_POLL_MS);
}
function stopPolling(){ if(pollTimer){ clearInterval(pollTimer); pollTimer = null; } }
function stopRealtime(){
  if(realtimeChannel){ supabaseClient && supabaseClient.removeChannel(realtimeChannel); realtimeChannel = null; }
  stopPolling();
}

function showScreen(name){
  stopRealtime();
  stopLeadLive();
  const lp = document.getElementById('lead-panel'); if(lp) lp.style.display = 'none';
  if(window.CCS_PAGE === 'admin'){
    window.scrollTo(0,0);
    renderAdminGate();
    return;
  }
  const landing = document.getElementById('screen-landing');
  const client = document.getElementById('screen-client');
  if(landing) landing.style.display = name==='landing' ? 'block' : 'none';
  if(client) client.style.display = name==='client' ? 'block' : 'none';
  window.scrollTo(0,0);
  if(name === 'admin'){ location.href = 'admin/'; return; }
  if(name === 'client'){ resetClientLookup(); }
  if(name === 'landing' && (location.hash === '#admin' || location.hash === '#portal')){
    history.replaceState(null, '', location.pathname + location.search);
  }
}
function goHome(){
  if(window.CCS_PAGE === 'admin'){ location.href = '../index.html'; return; }
  showScreen('landing');
  closeSiteNav();
}
function goAdmin(){ location.href = (window.CCS_PAGE === 'admin') ? './' : 'admin/'; }
function applyRouteFromHash(){
  if(window.CCS_PAGE === 'admin') return;
  const h = (location.hash || '').toLowerCase();
  if(h === '#admin'){ location.replace('admin/'); return; }
  if(h === '#portal' || h === '#client') showScreen('client');
}
window.addEventListener('hashchange', applyRouteFromHash);
window.addEventListener('DOMContentLoaded', applyRouteFromHash);
if(document.readyState !== 'loading') applyRouteFromHash();
window.addEventListener('DOMContentLoaded', applyRouteFromHash);
if(document.readyState !== 'loading') applyRouteFromHash();
function toggleSiteNav(btn){
  const nav = document.getElementById('ccs-nav');
  if(!nav) return;
  const open = nav.classList.toggle('open');
  if(btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}
function closeSiteNav(){
  const nav = document.getElementById('ccs-nav');
  if(!nav) return;
  nav.classList.remove('open');
  const btn = nav.querySelector('.ccs-nav-toggle');
  if(btn) btn.setAttribute('aria-expanded', 'false');
}

/* ================= HERO TYPING ================= */
const heroLines = [
  '$ codecraft — estúdio BH',
  '> chat humano · portal ao vivo · PIX',
  '> site · loja · sistema · Gestão',
  '> do orçamento à entrega, transparente ✓'
];
function typeHero(){
  const el = document.getElementById('ccs-typed');
  if(!el) return;
  let full = '';
  let li = 0, ci = 0;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced){ el.textContent = heroLines.join('\n'); return; }
  function step(){
    if(li >= heroLines.length){ return; }
    const line = heroLines[li];
    if(ci <= line.length){
      el.innerHTML = full + line.slice(0,ci) + '<span class="ccs-cursor">&nbsp;</span>';
      ci++; setTimeout(step, 22);
    } else {
      full += line + '\n'; li++; ci = 0; setTimeout(step, 260);
    }
  }
  step();
}

/* ================= CONTACT FORM ================= */
async function submitContact(e){
  e.preventDefault();
  const now = Date.now();
  if(window.__ccsLastContact && now - window.__ccsLastContact < 20000){ showToast('Aguarde alguns segundos antes de enviar de novo.'); return; }
  window.__ccsLastContact = now;
  if(!configOk){ showToast('Configure o Supabase primeiro (topo do script).'); return; }
  const name = document.getElementById('c-name').value.trim().slice(0, 80);
  const contact = document.getElementById('c-contact').value.trim().slice(0, 120);
  const msg = document.getElementById('c-msg').value.trim().slice(0, 2000);
  if(!name || !contact || !msg){ showToast('Preencha todos os campos.'); return; }
  await insertMessage({ name, contact, msg });
  document.getElementById('c-name').value = '';
  document.getElementById('c-contact').value = '';
  document.getElementById('c-msg').value = '';
  showToast('Mensagem enviada! Vamos responder em breve.');
}

/* ================= PIPELINE RENDER (shared) ================= */
const STAGES = [
  {key:'analise', label:'Em análise', desc:'Entendendo o problema e desenhando a solução.'},
  {key:'andamento', label:'Em andamento', desc:'Construção do projeto em progresso.'},
  {key:'concluido', label:'Concluído', desc:'Entregue e no ar.'}
];
function renderPipeline(currentKey){
  const currentIdx = STAGES.findIndex(s=>s.key===currentKey);
  return STAGES.map((s,i)=>{
    let cls = 'future';
    if(i < currentIdx) cls = 'done';
    if(i === currentIdx) cls = 'current';
    return `<div class="ccs-stage ${cls}"><div class="track"></div><div class="node">${i+1}</div><h4>${s.label}</h4><p>${s.desc}</p></div>`;
  }).join('');
}

/* ================= CLIENT PORTAL ================= */
let currentClientCode = null;
function resetClientLookup(){
  currentClientCode = null;
  document.getElementById('client-lookup').style.display = 'block';
  document.getElementById('client-result').style.display = 'none';
  document.getElementById('client-code-input').value = '';
  document.getElementById('client-error').style.display = 'none';
  stopRealtime();
}
async function lookupProject(){
  if(!configOk){ showToast('Configure o Supabase primeiro (topo do script).'); return; }
  const code = document.getElementById('client-code-input').value.trim().toUpperCase();
  if(!code) return;
  const proj = await loadProjectByCode(code);
  if(!proj){
    document.getElementById('client-error').style.display = 'block';
    return;
  }
  currentClientCode = code;
  document.getElementById('client-error').style.display = 'none';
  document.getElementById('client-lookup').style.display = 'none';
  document.getElementById('client-result').style.display = 'block';
  renderClientProject(proj);
  renderClientChat();

  stopRealtime();
  realtimeChannel = supabaseClient.channel('client-'+code)
    .on('postgres_changes', { event:'*', schema:'public', table:'projects', filter:`tracking_code=eq.${code}` }, async ()=>{
      const updated = await loadProjectByCode(code);
      if(updated) renderClientProject(updated);
    })
    .on('postgres_changes', { event:'*', schema:'public', table:'chat_messages', filter:`tracking_code=eq.${code}` }, ()=>renderClientChat())
    .subscribe();
  /* fallback caso o realtime esteja desligado no Supabase */
  startPolling(async ()=>{
    const updated = await loadProjectByCode(code);
    if(updated) renderClientProject(updated);
    renderClientChat();
  });
}
async function renderClientChat(){
  if(!currentClientCode) return;
  const box = document.getElementById('client-chat-messages');
  const msgs = await loadChat(currentClientCode);
  box.innerHTML = msgs.length ? msgs.map(renderBubble).join('')
    : '<div style="text-align:center; color:var(--ink-soft); font-size:13px; margin:auto;">Nenhuma mensagem ainda. Fale com a equipe!</div>';
  box.scrollTop = box.scrollHeight;
}
async function sendClientChat(){
  if(!currentClientCode) return;
  const input = document.getElementById('client-chat-input');
  const body = input.value.trim();
  if(!body) return;
  const ok = await insertChat(currentClientCode, 'client', body);
  if(ok){ input.value=''; renderClientChat(); }
}
function renderBubble(m){
  const who = m.sender === 'admin' ? 'admin' : 'client';
  return `<div class="ccs-bubble ${who}">${escapeHtml(m.body)}<span class="t">${fmtDate(m.createdAt)}</span></div>`;
}
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function safeHttpUrl(u){
  const s = String(u||'').trim();
  if(!s) return '';
  try{
    const withProto = /^https?:\/\//i.test(s) ? s : ('https://' + s);
    const parsed = new URL(withProto);
    if(parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.toString();
  }catch(e){ return ''; }
}
function renderClientProject(proj){
  document.getElementById('client-tracking').textContent = 'Código: ' + proj.trackingCode;
  document.getElementById('client-project-name').textContent = proj.projectName;
  document.getElementById('client-name').textContent = 'Cliente: ' + proj.clientName;
  document.getElementById('client-pipeline').innerHTML = renderPipeline(proj.status);
  document.getElementById('client-updated').textContent = 'Última atualização: ' + fmtDate(proj.updatedAt);
  document.getElementById('client-notes').innerHTML = proj.notes ? ('<strong>Observações da equipe:</strong> ' + escapeHtml(proj.notes)) : '';

  const deliveryArea = document.getElementById('client-delivery-area');
  const safeDelivery = safeHttpUrl(proj.deliveryUrl);
  if(safeDelivery){
    deliveryArea.innerHTML = `<div style="margin-top:16px; padding:18px; border:2px solid var(--teal); border-radius:12px; background:#fff;">
      <div style="font-weight:800; color:var(--teal); margin-bottom:4px;">Seu projeto está pronto!</div>
      <div style="font-size:13.5px; color:var(--ink-soft); margin-bottom:12px;">Clique no botão abaixo para acessar.</div>
      <a class="ccs-btn amber" href="${escapeHtml(safeDelivery)}" target="_blank" rel="noopener noreferrer">Acessar meu site →</a>
    </div>`;
  } else {
    deliveryArea.innerHTML = '';
  }

  const pixArea = document.getElementById('client-pix-area');
  const pixKey = (proj.pixKey || COMPANY_PIX_KEY || '').trim();
  if(proj.paid){
    pixArea.innerHTML = `<div class="ccs-pix-box" style="border-color:var(--teal); border-style:solid;"><div style="color:var(--teal); font-weight:700;">✓ Pagamento confirmado. Obrigado!</div></div>`;
  } else if(pixKey){
    pixArea.innerHTML = `
      <div class="ccs-pix-box">
        <div id="qr-${escapeHtml(proj.trackingCode)}" class="ccs-qr"></div>
        <div style="flex:1; min-width:220px;">
          <div style="font-weight:700; margin-bottom:6px;">Pagamento via PIX</div>
          <div style="font-size:14px; color:var(--ink-soft); margin-bottom:8px;">Valor: ${proj.pixValue ? 'R$ '+Number(proj.pixValue).toFixed(2) : 'a combinar'} · Chave: <strong>${escapeHtml(pixKey)}</strong></div>
          <div class="ccs-pix-key" id="pixkeytext-${escapeHtml(proj.trackingCode)}"></div>
          <button class="ccs-btn amber small" style="margin-top:10px;" onclick="copyText('${escapeHtml(pixKey)}')">Copiar chave</button>
          <button class="ccs-btn ghost small" style="margin-top:10px;" onclick="copyPix('${escapeHtml(proj.trackingCode)}')">Copiar copia e cola</button>
        </div>
      </div>`;
    const payload = buildPixPayload({chave: pixKey, valor: proj.pixValue, nome:'CODECRAFT SOLUTIONS', cidade: proj.pixCity || COMPANY_PIX_CITY, txid: proj.trackingCode});
    document.getElementById(`pixkeytext-${proj.trackingCode}`).textContent = payload;
    const qrEl = document.getElementById(`qr-${proj.trackingCode}`);
    qrEl.innerHTML = '';
    try{ new QRCode(qrEl, {text: payload, width:144, height:144, colorDark:'#12172B', colorLight:'#ffffff'}); }catch(e){}
  } else {
    pixArea.innerHTML = '';
  }
}
function copyPix(code){
  const el = document.getElementById('pixkeytext-'+code);
  if(!el || !el.textContent){ showToast('PIX ainda não carregou.'); return; }
  copyRaw(el.textContent, 'PIX copia e cola copiado!');
}
function copyRaw(text, okMsg){
  const done = function(){ showToast(okMsg || 'Copiado.'); };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(done).catch(function(){ copyFallback(text, done); });
    return;
  }
  copyFallback(text, done);
}
function copyFallback(text, done){
  const el = document.createElement('textarea');
  el.value = text;
  el.setAttribute('readonly','');
  el.style.position = 'fixed';
  el.style.left = '-9999px';
  document.body.appendChild(el);
  el.select();
  try{ document.execCommand('copy'); done(); }catch(e){ showToast('Selecione o código e copie no celular.'); }
  document.body.removeChild(el);
}
function copyText(text){
  copyRaw(text, 'Chave PIX copiada: '+text);
}

/* ================= CHAT ABERTO (widget da landing) ================= */
let leadCode = null;
let leadName = null;
let leadChannel = null;
let leadPollTimer = null;

function initLead(){
  leadCode = localStorage.getItem('ccs_lead_code');
  leadName = localStorage.getItem('ccs_lead_name');
}
let pendingLeadPrefill = '';
function openLeadFromPricing(service){
  pendingLeadPrefill = `Olá! Tenho interesse em: ${service}. Pode me passar um orçamento?`;
  const panel = document.getElementById('lead-panel');
  if(panel.style.display === 'none' || !panel.style.display) toggleLeadWidget();
  const input = document.getElementById('lead-input');
  if(leadCode && input){ input.value = pendingLeadPrefill; input.focus(); pendingLeadPrefill = ''; }
}
function toggleLeadWidget(){
  const panel = document.getElementById('lead-panel');
  const willOpen = panel.style.display === 'none' || !panel.style.display;
  panel.style.display = willOpen ? 'block' : 'none';
  if(!willOpen){ stopLeadLive(); return; }
  if(leadCode){
    document.getElementById('lead-name-step').style.display = 'none';
    document.getElementById('lead-chat-step').style.display = 'block';
    renderLeadChat();
    startLeadLive();
  } else {
    document.getElementById('lead-name-step').style.display = 'block';
    document.getElementById('lead-chat-step').style.display = 'none';
    const ni = document.getElementById('lead-name-input'); if(ni) ni.focus();
  }
}
async function startLead(){
  if(!configOk){ showToast('Configure o Supabase primeiro (topo do script).'); return; }
  const name = document.getElementById('lead-name-input').value.trim();
  if(!name){ showToast('Digite seu nome para começar.'); return; }
  const code = 'L' + genCode();
  const ok = await insertLead(code, name);
  if(!ok) return;
  leadCode = code; leadName = name;
  localStorage.setItem('ccs_lead_code', code);
  localStorage.setItem('ccs_lead_name', name);
  document.getElementById('lead-name-step').style.display = 'none';
  document.getElementById('lead-chat-step').style.display = 'block';
  /* Sem bot automático: só a equipe autenticada responde como admin. */
  renderLeadChat();
  startLeadLive();
  if(pendingLeadPrefill){
    const input = document.getElementById('lead-input');
    if(input){ input.value = pendingLeadPrefill; input.focus(); }
    pendingLeadPrefill = '';
  }
}
async function sendLead(){
  if(!leadCode) return;
  const input = document.getElementById('lead-input');
  const body = input.value.trim();
  if(!body) return;
  const ok = await insertChat(leadCode, 'client', body);
  if(ok){
    input.value='';
    await touchLead(leadCode);
    renderLeadChat();
  }
}
async function renderLeadChat(){
  if(!leadCode) return;
  const box = document.getElementById('lead-messages');
  if(!box) return;
  const msgs = await loadChat(leadCode);
  box.innerHTML = msgs.length ? msgs.map(renderBubble).join('')
    : '<div class="ccs-bubble admin" style="align-self:flex-start; max-width:92%;"><strong>CodeCraft Solutions</strong><br>Olá'+(leadName?', '+escapeHtml(leadName):'')+'! Conte o que você precisa (site, loja, sistema ou Gestão). A equipe responde por aqui — sem bot, atendimento humano.<span class="t">agora</span></div>';
  box.scrollTop = box.scrollHeight;
}
function startLeadLive(){
  stopLeadLive();
  if(!supabaseClient || !leadCode) return;
  leadChannel = supabaseClient.channel('lead-'+leadCode)
    .on('postgres_changes', { event:'*', schema:'public', table:'chat_messages', filter:`tracking_code=eq.${leadCode}` }, ()=>renderLeadChat())
    .subscribe();
  leadPollTimer = setInterval(()=>{ renderLeadChat(); }, LIVE_POLL_MS);
}
function stopLeadLive(){
  if(leadChannel){ supabaseClient && supabaseClient.removeChannel(leadChannel); leadChannel = null; }
  if(leadPollTimer){ clearInterval(leadPollTimer); leadPollTimer = null; }
}

/* ================= ADMIN ================= */
let adminLoggedIn = false;

function renderAdminGate(){
  document.getElementById('admin-login-shell').style.display = adminLoggedIn ? 'none' : 'block';
  document.getElementById('admin-main').style.display = adminLoggedIn ? 'flex' : 'none';
  document.getElementById('admin-logout-btn').style.display = adminLoggedIn ? 'inline-block' : 'none';
  document.getElementById('admin-live').style.display = adminLoggedIn ? 'inline-flex' : 'none';
  if(adminLoggedIn){
    renderAdminAll();
    switchAdminTab('projetos');
    stopRealtime();
    realtimeChannel = supabaseClient.channel('admin-projects')
      .on('postgres_changes', { event:'*', schema:'public', table:'projects' }, ()=>{ renderProjectsList(); renderEmpresa(); renderChatProjectList(); renderAdminOverview(); })
      .on('postgres_changes', { event:'*', schema:'public', table:'messages' }, ()=>{ renderMessagesList(); renderAdminOverview(); })
      .on('postgres_changes', { event:'*', schema:'public', table:'lead_chats' }, ()=>{ renderChatProjectList(); renderAdminOverview(); })
      .on('postgres_changes', { event:'*', schema:'public', table:'chat_messages' }, ()=>{ if(currentChatCode) renderAdminChat(); })
      .subscribe();
    startPolling(()=>{
      renderProjectsList(); renderMessagesList(); renderEmpresa(); renderChatProjectList(); renderAdminOverview();
      if(currentChatCode) renderAdminChat();
    });
  }
}
function openAdminPanel(){
  adminLoggedIn = true;
  const errEl = document.getElementById('admin-login-error');
  if(errEl) errEl.style.display = 'none';
  const pass = document.getElementById('admin-pass');
  if(pass) pass.value = '';
  try{ migrateCrmLeads(); }catch(e){ console.error(e); }
  renderAdminGate();
}
async function adminLogin(){
  const emailEl = document.getElementById('admin-email');
  const passEl = document.getElementById('admin-pass');
  const errEl = document.getElementById('admin-login-error');
  if(!emailEl || !passEl || !errEl) return;
  const email = emailEl.value.trim();
  const password = passEl.value;
  if(!email || !password){
    errEl.textContent = 'Preencha o e-mail e a senha.';
    errEl.style.display = 'block';
    return;
  }
  if(!isAllowedAdminEmail(email)){
    errEl.textContent = 'Este e-mail não tem acesso ao admin.';
    errEl.style.display = 'block';
    return;
  }

  if(!configOk || !supabaseClient){
    errEl.textContent = 'Configure o Supabase (URL e chave) no app.js.';
    errEl.style.display = 'block';
    return;
  }
  try{
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if(error){
      errEl.textContent = 'E-mail ou senha incorretos. Use a senha da conta no Supabase Auth (Authentication → Users).';
      errEl.style.display = 'block';
      return;
    }
    openAdminPanel();
  }catch(e){
    console.error(e);
    errEl.textContent = 'Falha de conexão. Tente de novo.';
    errEl.style.display = 'block';
  }
}
async function adminLogout(){
  adminLoggedIn = false;
  try{ sessionStorage.removeItem('ccs-admin-local'); }catch(e){}
  stopRealtime();
  if(supabaseClient){ await supabaseClient.auth.signOut(); }
  renderAdminGate();
}
async function syncAdminSessionFromAuth(session){
  const authOk = !!(session && isAllowedAdminEmail(sessionAdminEmail(session)));
  if(session && !authOk){
    await supabaseClient.auth.signOut();
  }
  adminLoggedIn = authOk;
  const onAdmin = window.CCS_PAGE === 'admin' || (document.getElementById('screen-admin') && document.getElementById('screen-admin').style.display === 'block');
  if(!adminLoggedIn){
    stopRealtime();
    if(onAdmin) renderAdminGate();
    return;
  }
  if(onAdmin){
    migrateCrmLeads();
    renderAdminGate();
  }
}
/* Restaura / sincroniza a sessão do admin (Supabase Auth). */
if(configOk){
  supabaseClient.auth.getSession().then(({ data })=>{
    syncAdminSessionFromAuth(data && data.session);
  });
  supabaseClient.auth.onAuthStateChange((_event, session)=>{
    syncAdminSessionFromAuth(session);
  });
}

const ADMIN_TABS = ['projetos','conversas','mensagens','operacoes','empresa'];
let projectFilter = 'all';
const REPLY_TEMPLATES = [
  { id:'ola', label:'Saudação', body:'Olá! Obrigado pelo contato. Sou da CodeCraft Solutions (BH). Pode me contar em uma frase o que você precisa (site, loja ou sistema)?' },
  { id:'orc', label:'Orçamento', body:'Perfeito. Para montar um orçamento justo, me diga: 1) tipo de projeto, 2) prazo desejado, 3) se já tem identidade visual. Em seguida te envio as opções.' },
  { id:'codigo', label:'Código', body:'Seu código de acompanhamento é: [COLE_O_CODIGO]. Abra Portal do cliente no site, cole o código e clique em Ver status.' },
  { id:'pix', label:'PIX', body:'Quando estiver tudo certo, o pagamento é via PIX no portal do projeto. Assim que confirmar, marcamos como pago e seguimos a entrega.' },
  { id:'entrega', label:'Entrega', body:'Seu projeto está no ar. No portal do cliente aparece o botão Acessar meu site. Qualquer ajuste fino nos primeiros dias, fale por aqui.' }
];
function switchAdminTab(tab){
  if(!ADMIN_TABS.includes(tab)) tab = 'projetos';
  ADMIN_TABS.forEach(t=>{
    const pane = document.getElementById('tab-'+t);
    const btn = document.getElementById('tab-btn-'+t);
    if(pane) pane.style.display = t===tab ? 'block' : 'none';
    if(btn) btn.classList.toggle('active', t===tab);
  });
  if(tab==='projetos'){ renderProjectsList(); renderAdminOverview(); }
  if(tab==='conversas') renderChatProjectList();
  if(tab==='mensagens') renderMessagesList();
  if(tab==='operacoes'){ renderAgenda(); renderLeads(); renderHunt(); renderOpsTemplates(); }
  if(tab==='empresa'){ renderEmpresa(); buildCalculator(); }
}
async function renderAdminAll(){ await renderProjectsList(); await renderMessagesList(); await renderEmpresa(); await renderChatProjectList(); await renderAdminOverview(); renderAgenda(); await renderLeads(); renderHunt(); renderOpsTemplates(); }
async function renderAdminOverview(){
  const el = document.getElementById('admin-overview');
  if(!el) return;
  try{
    const [projects, messages, leads] = await Promise.all([
      loadProjects().catch(()=>[]),
      loadMessages().catch(()=>[]),
      loadLeadChats().catch(()=>[])
    ]);
    const unpaid = (projects||[]).filter(p=>!p.paid && Number(p.pixValue)>0).length;
    const open = (projects||[]).filter(p=>p.status==='analise' || p.status==='andamento').length;
    el.innerHTML =
      '<div class="ccs-metric"><div class="lbl">Projetos</div><div class="val">'+(projects||[]).length+'</div><div class="sub">'+open+' em produção</div></div>'+
      '<div class="ccs-metric receber"><div class="lbl">PIX a receber</div><div class="val">'+unpaid+'</div><div class="sub">sem pagamento marcado</div></div>'+
      '<div class="ccs-metric"><div class="lbl">Conversas</div><div class="val">'+(leads||[]).length+'</div><div class="sub">contatos pelo site</div></div>'+
      '<div class="ccs-metric"><div class="lbl">Mensagens</div><div class="val">'+(messages||[]).length+'</div><div class="sub">formulário da home</div></div>';
    setNavBadge('badge-projetos', open);
    setNavBadge('badge-conversas', (leads||[]).length);
    setNavBadge('badge-mensagens', (messages||[]).length);
  }catch(e){
    el.innerHTML = '<div class="ccs-panel ccs-empty" style="grid-column:1/-1; padding:18px;">Não foi possível carregar o resumo agora.</div>';
  }
}
function setNavBadge(id, n){
  const el = document.getElementById(id);
  if(!el) return;
  if(n > 0){ el.style.display = 'inline-grid'; el.textContent = String(n > 99 ? '99+' : n); }
  else { el.style.display = 'none'; }
}
function setProjectFilter(f){
  projectFilter = f || 'all';
  document.querySelectorAll('#project-filters .ccs-chip').forEach(btn=>{
    btn.classList.toggle('active', btn.getAttribute('data-filter') === projectFilter);
  });
  renderProjectsList();
}
function renderOpsTemplates(){
  const el = document.getElementById('ops-templates-list');
  if(!el) return;
  el.innerHTML = REPLY_TEMPLATES.map(t=>'<li><strong>'+escapeHtml(t.label)+':</strong> '+escapeHtml(t.body)+'</li>').join('');
}
function replyChipsHtml(){
  return '<div class="ccs-reply-chips">'+REPLY_TEMPLATES.map(t=>
    '<button type="button" onclick="useReplyTemplate(\''+t.id+'\')">'+escapeHtml(t.label)+'</button>'
  ).join('')+'</div>';
}
function useReplyTemplate(id){
  const t = REPLY_TEMPLATES.find(x=>x.id===id);
  const input = document.getElementById('admin-chat-input');
  if(!t || !input) return;
  let body = t.body;
  if(currentChatCode) body = body.replace('[COLE_O_CODIGO]', currentChatCode);
  input.value = body;
  input.focus();
}
function copyTrackingCode(code){
  navigator.clipboard.writeText(code).then(()=>showToast('Código copiado: '+code));
}
function toggleNewProjectForm(){
  const f = document.getElementById('new-project-form');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
}
async function createProject(){
  const clientName = document.getElementById('np-client').value.trim();
  const projectName = document.getElementById('np-project').value.trim();
  const serviceType = document.getElementById('np-service').value;
  const pixKey = document.getElementById('np-pixkey').value.trim() || COMPANY_PIX_KEY;
  const pixValue = document.getElementById('np-value').value.trim();
  const pixCity = document.getElementById('np-city').value.trim() || COMPANY_PIX_CITY;
  const notes = document.getElementById('np-notes').value.trim();
  if(!clientName || !projectName){ showToast('Preencha nome do cliente e do projeto.'); return; }
  const trackingCode = genCode();
  const created = await insertProject({ trackingCode, clientName, projectName, serviceType, pixKey, pixValue, pixCity, notes });
  if(!created) return;
  const contact = (notes.match(/Contato:\s*(.+)/) || [])[1] || '';
  ['np-client','np-project','np-value','np-notes'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('np-service').value = 'site';
  document.getElementById('np-pixkey').value = COMPANY_PIX_KEY;
  document.getElementById('np-city').value = COMPANY_PIX_CITY;
  toggleNewProjectForm();
  /* Se o projeto veio de um chat aberto, manda o código direto na conversa do cliente. */
  if(pendingLeadCode){
    await insertChat(pendingLeadCode, 'admin', `Seu código de acompanhamento é: ${trackingCode}\nAbra o "Portal do cliente" no site e digite esse código para acompanhar seu projeto em tempo real.`);
    await touchLead(pendingLeadCode);
    pendingLeadCode = null; pendingLeadName = '';
    showToast('Código enviado no chat do cliente!');
  }
  showCodeModal(trackingCode, clientName, contact);
  renderProjectsList();
}
async function setStatus(id, status){ await updateProject(id, { status }); renderProjectsList(); renderEmpresa(); }
async function togglePaid(id, current){ await updateProject(id, { paid: !current }); renderProjectsList(); renderEmpresa(); }
async function saveDelivery(id){
  const input = document.getElementById('delivery-'+id);
  if(!input) return;
  let url = input.value.trim();
  if(url){
    url = safeHttpUrl(url);
    if(!url){ showToast('Link inválido. Use http:// ou https://'); return; }
  }
  await updateProject(id, { delivery_url: url });
  showToast(url ? 'Link de entrega salvo!' : 'Link removido.');
  renderProjectsList();
}
async function deleteProject(id){
  if(!confirm('Excluir este projeto? Essa ação não pode ser desfeita.')) return;
  await deleteProjectRow(id);
  renderProjectsList(); renderEmpresa(); renderChatProjectList();
}
async function renderProjectsList(){
  const container = document.getElementById('projects-list');
  let projects = await loadProjects();
  if(projectFilter === 'analise' || projectFilter === 'andamento' || projectFilter === 'concluido'){
    projects = projects.filter(p=>p.status === projectFilter);
  } else if(projectFilter === 'unpaid'){
    projects = projects.filter(p=>!p.paid && Number(p.pixValue)>0);
  }
  if(projects.length === 0){
    container.innerHTML = '<div class="ccs-panel ccs-empty"><strong>Nenhum projeto neste filtro.</strong><br>Ajuste o filtro ou clique em <em>+ Novo projeto</em>.</div>';
    return;
  }
  container.innerHTML = `<div class="ccs-panel" style="overflow-x:auto;">
    <table class="ccs-table">
      <thead><tr><th>Código</th><th>Cliente / Projeto</th><th>Serviço</th><th>Status</th><th>PIX</th><th></th></tr></thead>
      <tbody>
        ${projects.map(p=>`
          <tr>
            <td class="mono"><button class="ccs-btn ghost small" style="font-family:inherit;" onclick="copyTrackingCode('${escapeHtml(p.trackingCode)}')">${escapeHtml(p.trackingCode)}</button></td>
            <td><strong>${escapeHtml(p.clientName)}</strong><br><span style="color:var(--ink-soft); font-size:13px;">${escapeHtml(p.projectName)}</span></td>
            <td style="font-size:13px;">${escapeHtml((typeof SERVICE_LABELS!=='undefined' && SERVICE_LABELS[p.serviceType]) ? SERVICE_LABELS[p.serviceType] : (p.serviceType||'—'))}</td>
            <td>
              <div class="ccs-status-btns">
                <button class="${p.status==='analise'?'active-analise':''}" onclick="setStatus('${p.id}','analise')">Em análise</button>
                <button class="${p.status==='andamento'?'active-andamento':''}" onclick="setStatus('${p.id}','andamento')">Em andamento</button>
                <button class="${p.status==='concluido'?'active-concluido':''}" onclick="setStatus('${p.id}','concluido')">Concluído</button>
              </div>
            </td>
            <td>
              ${p.pixKey ? `R$ ${p.pixValue ? Number(p.pixValue).toFixed(2) : '—'}<br><button class="ccs-btn ${p.paid?'ghost':'amber'} small" style="margin-top:6px;" onclick="togglePaid('${p.id}', ${p.paid})">${p.paid ? 'Marcado como pago ✓' : 'Marcar como pago'}</button>` : '<span style="color:var(--ink-soft);">sem PIX</span>'}
            </td>
            <td><button class="ccs-btn ghost small" onclick="deleteProject('${p.id}')">Excluir</button></td>
          </tr>
          <tr>
            <td colspan="6" style="background:var(--paper-dim); border-bottom:2px solid var(--line);">
              <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <span style="font-size:13px; color:var(--ink-soft); font-weight:700;">Link de entrega:</span>
                <input id="delivery-${p.id}" value="${escapeHtml(p.deliveryUrl||'')}" placeholder="https://site-do-cliente.com" style="flex:1; min-width:220px; padding:8px 10px; border:1.5px solid var(--line); border-radius:8px; font-size:13.5px;">
                <button class="ccs-btn amber small" onclick="saveDelivery('${p.id}')">Salvar link</button>
                ${p.deliveryUrl ? `<a class="ccs-btn ghost small" href="${escapeHtml(p.deliveryUrl)}" target="_blank" rel="noopener">Abrir</a>` : ''}
              </div>
              <div style="font-size:12px; color:var(--ink-soft); margin-top:6px;">Cole o endereço do site pronto e salve — o cliente vê o botão "Acessar meu site" na hora, no portal.</div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>`;
}
let currentCode = null;
let modalContact = '';
function showCodeModal(code, clientName, contact){
  currentCode = code;
  modalContact = contact || '';
  document.getElementById('modal-code').textContent = code;
  document.getElementById('modal-client-name').textContent = clientName;
  document.getElementById('code-modal').style.display = 'flex';
}
function closeCodeModal(){
  document.getElementById('code-modal').style.display = 'none';
  currentCode = null; modalContact = '';
}
function copyCode(){
  if(currentCode){
    navigator.clipboard.writeText(currentCode).then(()=>showToast('Código copiado!'));
  }
}
function openAppConversas(){
  showScreen('admin');
  switchAdminTab('conversas');
}
function sendCodeInApp(){
  copyCode();
  closeCodeModal();
  openAppConversas();
  showToast('Código copiado. Envie na aba Conversas.');
}
function createProjectFromMessage(btn){
  const name = (btn && btn.getAttribute('data-name')) || '';
  const contact = (btn && btn.getAttribute('data-contact')) || '';
  const msg = (btn && btn.getAttribute('data-msg')) || '';
  switchAdminTab('projetos');
  const f = document.getElementById('new-project-form');
  f.style.display = 'block';
  document.getElementById('np-client').value = name;
  document.getElementById('np-notes').value = `Contato: ${contact}\nMensagem: ${msg}`;
  document.getElementById('np-project').focus();
}
async function renderMessagesList(){
  const container = document.getElementById('messages-list');
  const messages = await loadMessages();
  if(messages.length === 0){
    container.innerHTML = '<div class="ccs-panel ccs-empty"><strong>Caixa de entrada vazia.</strong><br>Quando alguém enviar o formulário “Fale com a gente” na home, o recado aparece aqui.</div>';
    return;
  }
  container.innerHTML = messages.map(m=>{
    const replyChat = `<button class="ccs-btn amber small" onclick="openAppConversas()">Responder no chat</button>`;
    return `
    <div class="ccs-panel" style="margin-bottom:14px;">
      <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:6px;">
        <strong>${escapeHtml(m.name)}</strong>
        <span style="font-size:12.5px; color:var(--ink-soft);">${fmtDate(m.createdAt)}</span>
      </div>
      <div style="font-size:13px; color:var(--ink-soft); margin:4px 0 8px;">${escapeHtml(m.contact)}</div>
      <div style="font-size:14.5px; margin-bottom:12px;">${escapeHtml(m.msg)}</div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="ccs-btn amber small" data-name="${escapeHtml(m.name)}" data-contact="${escapeHtml(m.contact)}" data-msg="${escapeHtml(m.msg)}" onclick="createProjectFromMessage(this)">Criar projeto</button>
        ${replyChat}
      </div>
    </div>`;
  }).join('');
}

/* ================= CONVERSAS (chat admin) ================= */
let currentChatCode = null;
let currentChatProject = null;
let currentChatIsLead = false;
let pendingLeadCode = null;
let pendingLeadName = '';
async function renderChatProjectList(){
  const container = document.getElementById('chat-project-list');
  if(!container) return;
  const [leads, projects] = await Promise.all([loadLeadChats(), loadProjects()]);
  if(leads.length === 0 && projects.length === 0){
    container.innerHTML = '<div class="ccs-empty" style="padding:20px;"><strong>Nenhuma conversa ainda.</strong><br><span style="font-size:13px;">Quando um visitante abrir o chat do site, a conversa entra nesta lista.</span></div>';
    return;
  }
  let html = '';
  if(leads.length){
    html += '<div class="ccs-eyebrow" style="margin:2px 0 8px;">Novos contatos (chat)</div>';
    html += leads.map(l=>`
      <button class="ccs-chat-proj ${l.code===currentChatCode?'active':''}" onclick="openAdminLeadChat('${l.code}')">
        <strong>${escapeHtml(l.name)}</strong>
        <span>contato pelo site</span>
      </button>`).join('');
  }
  if(projects.length){
    if(leads.length) html += '<div class="ccs-eyebrow" style="margin:14px 0 8px;">Projetos</div>';
    html += projects.map(p=>`
      <button class="ccs-chat-proj ${p.trackingCode===currentChatCode?'active':''}" onclick="openAdminChat('${p.trackingCode}')">
        <strong>${escapeHtml(p.clientName)}</strong>
        <span>${p.trackingCode} · ${escapeHtml(p.projectName)}</span>
      </button>`).join('');
  }
  container.innerHTML = html;
}
async function openAdminLeadChat(code){
  const lead = await loadLeadByCode(code);
  currentChatCode = code;
  currentChatProject = null;
  currentChatIsLead = true;
  renderChatProjectList();
  const main = document.getElementById('admin-chat-main');
  const name = lead ? lead.name : code;
  main.innerHTML = `
    <div class="ccs-chat-head">
      <div><strong>${escapeHtml(name)}</strong><br>
        <span style="font-size:12px; color:var(--ink-soft);">Contato pelo chat do site</span></div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="ccs-btn amber small" onclick="createProjectForLead('${code}')">Criar projeto e enviar código</button>
      </div>
    </div>
    <div id="admin-chat-messages" class="ccs-chat-messages"></div>
    ${replyChipsHtml()}
    <div class="ccs-chat-input">
      <input id="admin-chat-input" placeholder="Escreva para o cliente..." onkeydown="if(event.key==='Enter')sendAdminChat()">
      <button class="ccs-btn amber" onclick="sendAdminChat()">Enviar</button>
    </div>`;
  renderAdminChat();
}
async function createProjectForLead(code){
  const lead = await loadLeadByCode(code);
  pendingLeadCode = code;
  pendingLeadName = lead ? lead.name : '';
  switchAdminTab('projetos');
  const f = document.getElementById('new-project-form');
  f.style.display = 'block';
  document.getElementById('np-client').value = pendingLeadName;
  document.getElementById('np-project').focus();
  showToast('Preencha o projeto — o código será enviado no chat do cliente.');
}
async function openAdminChat(code){
  const proj = await loadProjectByCode(code);
  currentChatCode = code;
  currentChatProject = proj;
  currentChatIsLead = false;
  document.querySelectorAll('.ccs-chat-proj').forEach(b=>b.classList.remove('active'));
  renderChatProjectList();
  const main = document.getElementById('admin-chat-main');
  const contact = proj && proj.notes ? (proj.notes.match(/Contato:\s*(.+)/)||[])[1] : '';
  main.innerHTML = `
    <div class="ccs-chat-head">
      <div><strong>${escapeHtml(proj ? proj.clientName : code)}</strong><br>
        <span style="font-size:12px; color:var(--ink-soft); font-family:'JetBrains Mono',monospace;">${code}</span></div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="ccs-btn ghost small" onclick="sendCodeInChat()">Enviar código</button>
      </div>
    </div>
    <div id="admin-chat-messages" class="ccs-chat-messages"></div>
    ${replyChipsHtml()}
    <div class="ccs-chat-input">
      <input id="admin-chat-input" placeholder="Escreva para o cliente..." onkeydown="if(event.key==='Enter')sendAdminChat()">
      <button class="ccs-btn amber" onclick="sendAdminChat()">Enviar</button>
    </div>`;
  renderAdminChat();
}
async function renderAdminChat(){
  if(!currentChatCode) return;
  const box = document.getElementById('admin-chat-messages');
  if(!box) return;
  const msgs = await loadChat(currentChatCode);
  box.innerHTML = msgs.length ? msgs.map(renderBubble).join('')
    : '<div style="text-align:center; color:var(--ink-soft); font-size:13px; margin:auto;">Nenhuma mensagem ainda.</div>';
  box.scrollTop = box.scrollHeight;
}
async function sendAdminChat(){
  const input = document.getElementById('admin-chat-input');
  if(!input || !currentChatCode) return;
  const body = input.value.trim();
  if(!body) return;
  const ok = await insertChat(currentChatCode, 'admin', body);
  if(ok){ input.value=''; renderAdminChat(); }
}
async function sendCodeInChat(){
  if(!currentChatCode) return;
  const ok = await insertChat(currentChatCode, 'admin', `Seu código de acompanhamento é: ${currentChatCode}`);
  if(ok){ renderAdminChat(); showToast('Código enviado na conversa.'); }
}

/* ================= EMPRESA (painel de controle) ================= */
const CHART_COLORS = { teal:'#2FB6A5', amber:'#E8A33D', slate:'#6B7CA0', panel:'#161B33', line:'#DAD6CA' };
const STATUS_LABELS = { analise:'Em análise', andamento:'Em andamento', concluido:'Concluído' };
const SERVICE_LABELS = { loja:'Loja virtual', site:'Site institucional', landing:'Landing page', sistema:'Sistema/App sob medida', manutencao:'Manutenção mensal' };
const SERVICE_ORDER = ['loja','site','landing','sistema','manutencao'];
const SERVICE_COLORS = { loja:'#2FB6A5', site:'#161B33', landing:'#E8A33D', sistema:'#6B7CA0', manutencao:'#D65B5B' };
function money(v){ return 'R$ ' + Number(v||0).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}); }
let lastEmpresaProjects = [];

function computeStats(projects){
  let recebido = 0, aReceber = 0;
  const byStatus = { analise:0, andamento:0, concluido:0 };
  const byMonth = {}; // 'YYYY-MM' -> { recebido, aReceber }
  const byService = {}; // service -> { total, count }
  SERVICE_ORDER.forEach(k=>{ byService[k] = { total:0, count:0 }; });
  projects.forEach(p=>{
    const v = Number(p.pixValue || 0);
    if(p.paid) recebido += v; else aReceber += v;
    if(byStatus[p.status] === undefined) byStatus[p.status] = 0;
    byStatus[p.status]++;
    const svc = SERVICE_LABELS[p.serviceType] ? p.serviceType : 'site';
    if(!byService[svc]) byService[svc] = { total:0, count:0 };
    byService[svc].total += v; byService[svc].count++;
    const d = new Date(p.createdAt);
    if(!isNaN(d)){
      const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
      if(!byMonth[key]) byMonth[key] = { recebido:0, aReceber:0 };
      if(p.paid) byMonth[key].recebido += v; else byMonth[key].aReceber += v;
    }
  });
  const total = recebido + aReceber;
  const comValor = projects.filter(p=>Number(p.pixValue||0) > 0).length;
  const concluidos = byStatus.concluido || 0;
  const emAberto = projects.length - concluidos;
  const ticket = comValor ? total / comValor : 0;
  const conclusao = projects.length ? Math.round((concluidos / projects.length) * 100) : 0;
  const months = Object.keys(byMonth).sort();
  return { recebido, aReceber, total, ticket, concluidos, emAberto, conclusao, byStatus, byMonth, months, byService, count:projects.length };
}

async function renderEmpresa(){
  const el = document.getElementById('empresa-metrics');
  if(!el) return;
  const projects = await loadProjects();
  lastEmpresaProjects = projects;
  const s = computeStats(projects);
  el.innerHTML = `
    <div class="ccs-metric"><div class="lbl">Faturamento total</div><div class="val">${money(s.total)}</div><div class="sub">recebido + a receber</div></div>
    <div class="ccs-metric recebido"><div class="lbl">Recebido</div><div class="val">${money(s.recebido)}</div><div class="sub">pagamentos confirmados</div></div>
    <div class="ccs-metric receber"><div class="lbl">A receber</div><div class="val">${money(s.aReceber)}</div><div class="sub">aguardando pagamento</div></div>
    <div class="ccs-metric"><div class="lbl">Ticket médio</div><div class="val">${money(s.ticket)}</div><div class="sub">por projeto com valor</div></div>
    <div class="ccs-metric"><div class="lbl">Sites/lojas</div><div class="val">${s.count}</div><div class="sub">projetos cadastrados</div></div>
    <div class="ccs-metric"><div class="lbl">Em produção</div><div class="val">${s.emAberto}</div><div class="sub">ainda não entregues</div></div>
    <div class="ccs-metric"><div class="lbl">Entregues</div><div class="val">${s.concluidos}</div><div class="sub">sites/lojas no ar</div></div>
    <div class="ccs-metric"><div class="lbl">Taxa de entrega</div><div class="val">${s.conclusao}%</div><div class="sub">entregues / total</div></div>`;
  renderEmpresaCharts(s);
  renderEmpresaTable(projects, s);
}

let charts = { revenue:null, paid:null, status:null, service:null };
function renderEmpresaCharts(s){
  if(typeof Chart === 'undefined') return;
  /* Só desenha quando a aba Empresa está visível — evita rebuild no polling. */
  const tab = document.getElementById('tab-empresa');
  if(!tab || tab.style.display === 'none') return;
  const monthLabels = s.months.map(m=>{ const [y,mo]=m.split('-'); return mo+'/'+y.slice(2); });
  const recData = s.months.map(m=>s.byMonth[m].recebido);
  const recvData = s.months.map(m=>s.byMonth[m].aReceber);

  drawChart('revenue', document.getElementById('chart-revenue'), {
    type:'bar',
    data:{ labels: monthLabels.length ? monthLabels : ['—'], datasets:[
      { label:'Recebido', data: recData.length ? recData : [0], backgroundColor: CHART_COLORS.teal },
      { label:'A receber', data: recvData.length ? recvData : [0], backgroundColor: CHART_COLORS.amber }
    ]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ position:'bottom' }, tooltip:{ callbacks:{ label:(c)=>c.dataset.label+': '+money(c.parsed.y) } } },
      scales:{ x:{ stacked:true, grid:{display:false} }, y:{ stacked:true, ticks:{ callback:(v)=>'R$ '+v } } } }
  });

  drawChart('paid', document.getElementById('chart-paid'), {
    type:'doughnut',
    data:{ labels:['Recebido','A receber'], datasets:[{ data:[s.recebido, s.aReceber], backgroundColor:[CHART_COLORS.teal, CHART_COLORS.amber] }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'62%',
      plugins:{ legend:{ position:'bottom' }, tooltip:{ callbacks:{ label:(c)=>c.label+': '+money(c.parsed) } } } }
  });

  drawChart('status', document.getElementById('chart-status'), {
    type:'doughnut',
    data:{ labels:['Em análise','Em andamento','Concluído'],
      datasets:[{ data:[s.byStatus.analise||0, s.byStatus.andamento||0, s.byStatus.concluido||0],
        backgroundColor:[CHART_COLORS.slate, CHART_COLORS.amber, CHART_COLORS.teal] }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'62%', plugins:{ legend:{ position:'bottom' } } }
  });

  const svcLabels = SERVICE_ORDER.map(k=>SERVICE_LABELS[k]);
  const svcData = SERVICE_ORDER.map(k=>(s.byService[k] ? s.byService[k].total : 0));
  const svcColors = SERVICE_ORDER.map(k=>SERVICE_COLORS[k]);
  drawChart('service', document.getElementById('chart-service'), {
    type:'bar',
    data:{ labels: svcLabels, datasets:[{ label:'Faturamento', data: svcData, backgroundColor: svcColors }] },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label:(c)=>{
        const k = SERVICE_ORDER[c.dataIndex]; const n = s.byService[k] ? s.byService[k].count : 0;
        return money(c.parsed.x) + ' · ' + n + (n===1?' projeto':' projetos'); } } } },
      scales:{ x:{ ticks:{ callback:(v)=>'R$ '+v } }, y:{ grid:{display:false} } } }
  });
}
function drawChart(key, canvas, config){
  if(!canvas) return;
  /* Atualiza no lugar quando possível para não piscar a cada polling. */
  if(charts[key] && charts[key].config.type === config.type){
    charts[key].data = config.data;
    charts[key].options = config.options;
    charts[key].update();
    return;
  }
  if(charts[key]) charts[key].destroy();
  charts[key] = new Chart(canvas.getContext('2d'), config);
}

function renderEmpresaTable(projects, s){
  const el = document.getElementById('empresa-table');
  if(!el) return;
  if(!projects.length){ el.innerHTML = '<div class="ccs-empty">Nenhum projeto ainda.</div>'; return; }
  el.innerHTML = `
    <table class="ccs-table">
      <thead><tr><th>Código</th><th>Cliente</th><th>Projeto</th><th>Tipo</th><th>Status</th><th>Valor</th><th>Pago</th><th>Criado em</th></tr></thead>
      <tbody>
        ${projects.map(p=>`
          <tr>
            <td class="mono">${escapeHtml(p.trackingCode)}</td>
            <td>${escapeHtml(p.clientName)}</td>
            <td>${escapeHtml(p.projectName)}</td>
            <td>${SERVICE_LABELS[p.serviceType] || 'Site institucional'}</td>
            <td>${STATUS_LABELS[p.status] || escapeHtml(p.status)}</td>
            <td>${p.pixValue ? money(p.pixValue) : '—'}</td>
            <td style="color:${p.paid?'var(--teal)':'var(--ink-soft)'}; font-weight:600;">${p.paid?'Sim':'Não'}</td>
            <td>${fmtDate(p.createdAt)}</td>
          </tr>`).join('')}
      </tbody>
      <tfoot><tr style="font-weight:700; border-top:2px solid var(--line);">
        <td colspan="5">Totais</td>
        <td>${money(s.total)}</td>
        <td colspan="2">${money(s.recebido)} recebido</td>
      </tr></tfoot>
    </table>`;
}

function exportExcel(){
  if(typeof XLSX === 'undefined'){ showToast('Biblioteca de Excel não carregou. Tente recarregar.'); return; }
  const projects = lastEmpresaProjects || [];
  const s = computeStats(projects);
  const projRows = [['Código','Cliente','Projeto','Tipo de serviço','Status','Valor (R$)','Pago','Criado em','Atualizado em']];
  projects.forEach(p=>{
    projRows.push([
      p.trackingCode, p.clientName, p.projectName,
      SERVICE_LABELS[p.serviceType] || 'Site institucional',
      STATUS_LABELS[p.status] || p.status,
      Number(p.pixValue || 0), p.paid ? 'Sim' : 'Não',
      fmtDate(p.createdAt), fmtDate(p.updatedAt)
    ]);
  });
  const resumoRows = [
    ['Indicador','Valor'],
    ['Faturamento total', s.total],
    ['Recebido', s.recebido],
    ['A receber', s.aReceber],
    ['Ticket médio', Number(s.ticket.toFixed(2))],
    ['Sites/lojas (total)', s.count],
    ['Em produção', s.emAberto],
    ['Entregues', s.concluidos],
    ['Taxa de entrega (%)', s.conclusao]
  ];
  const svcRows = [['Tipo de serviço','Projetos','Faturamento (R$)']];
  SERVICE_ORDER.forEach(k=>{
    const b = s.byService[k] || { total:0, count:0 };
    svcRows.push([SERVICE_LABELS[k], b.count, b.total]);
  });
  const wb = XLSX.utils.book_new();
  const wsP = XLSX.utils.aoa_to_sheet(projRows);
  wsP['!cols'] = [{wch:10},{wch:20},{wch:24},{wch:20},{wch:14},{wch:12},{wch:6},{wch:18},{wch:18}];
  const wsR = XLSX.utils.aoa_to_sheet(resumoRows);
  wsR['!cols'] = [{wch:24},{wch:16}];
  const wsS = XLSX.utils.aoa_to_sheet(svcRows);
  wsS['!cols'] = [{wch:24},{wch:10},{wch:18}];
  XLSX.utils.book_append_sheet(wb, wsR, 'Resumo');
  XLSX.utils.book_append_sheet(wb, wsS, 'Por serviço');
  XLSX.utils.book_append_sheet(wb, wsP, 'Projetos');
  const stamp = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `codecraft-controle-${stamp}.xlsx`);
  showToast('Excel exportado!');
}
let calcExpr = '';
function calcPress(v){
  const disp = document.getElementById('calc-display');
  if(v==='C'){ calcExpr=''; disp.value='0'; return; }
  if(v==='='){
    try{
      const safe = calcExpr.replace(/[^0-9+\-*/.() ]/g,'');
      const r = Function('"use strict";return ('+ (safe||'0') +')')();
      calcExpr = String(r); disp.value = r;
    }catch(e){ disp.value='Erro'; calcExpr=''; }
    return;
  }
  if(v==='←'){ calcExpr = calcExpr.slice(0,-1); disp.value = calcExpr || '0'; return; }
  calcExpr += v; disp.value = calcExpr;
}
let calcBuilt = false;
function buildCalculator(){
  if(calcBuilt) return;
  const grid = document.getElementById('calc-grid');
  if(!grid) return;
  const keys = [
    ['C','clr'],['←','op'],['(','op'],[')','op'],
    ['7',''],['8',''],['9',''],['/','op'],
    ['4',''],['5',''],['6',''],['*','op'],
    ['1',''],['2',''],['3',''],['-','op'],
    ['0',''],['.',''],['+','op'],['=','eq']
  ];
  grid.innerHTML = keys.map(([k,cls])=>`<button class="${cls==='clr'?'op':cls}" onclick="calcPress('${k}')">${k}</button>`).join('');
  calcBuilt = true;
}

/* ================= ADMIN OPS: leads, caça, post, mercado ================= */
const LEADS_KEY = 'ccs-admin-leads';
const POSTS_KEY = 'ccs-admin-posts';
const HUNTS = [
  { id:'clinica', label:'Clínicas e consultórios', maps:'https://www.google.com/maps/search/clínica+Belo+Horizonte', google:'https://www.google.com/search?q=clínica+Belo+Horizonte+telefone', insta:'https://www.instagram.com/explore/tags/clinicabh/', niche:'Clínica' },
  { id:'adv', label:'Advocacia', maps:'https://www.google.com/maps/search/advogado+Belo+Horizonte', google:'https://www.google.com/search?q=escritório+advocacia+Belo+Horizonte+contato', insta:'https://www.instagram.com/explore/tags/advogadobh/', niche:'Advogado' },
  { id:'imob', label:'Imobiliárias', maps:'https://www.google.com/maps/search/imobiliária+Belo+Horizonte', google:'https://www.google.com/search?q=imobiliária+Belo+Horizonte+whatsapp', insta:'https://www.instagram.com/explore/tags/imobiliariabh/', niche:'Imobiliária' },
  { id:'rest', label:'Restaurantes', maps:'https://www.google.com/maps/search/restaurante+Belo+Horizonte', google:'https://www.google.com/search?q=restaurante+Savassi+delivery+contato', insta:'https://www.instagram.com/explore/tags/gastronomiabh/', niche:'Restaurante' },
  { id:'auto', label:'Oficinas e auto', maps:'https://www.google.com/maps/search/oficina+mecânica+Belo+Horizonte', google:'https://www.google.com/search?q=oficina+Belo+Horizonte+whatsapp', insta:'https://www.instagram.com/explore/tags/oficinabh/', niche:'Oficina' },
  { id:'loja', label:'Lojas e e-commerce', maps:'https://www.google.com/maps/search/loja+Belo+Horizonte', google:'https://www.google.com/search?q=loja+precisa+de+site+Belo+Horizonte', insta:'https://www.instagram.com/explore/tags/empreenderbh/', niche:'Loja' },
  { id:'saude', label:'Academias', maps:'https://www.google.com/maps/search/academia+Belo+Horizonte', google:'https://www.google.com/search?q=academia+Belo+Horizonte+contato', insta:'https://www.instagram.com/explore/tags/academiabh/', niche:'Academia' },
  { id:'cont', label:'Contabilidade', maps:'https://www.google.com/maps/search/contador+Belo+Horizonte', google:'https://www.google.com/search?q=escritório+contabilidade+Belo+Horizonte', insta:'https://www.instagram.com/explore/tags/contadorabh/', niche:'Contador' },
  { id:'dent', label:'Dentistas', maps:'https://www.google.com/maps/search/dentista+Belo+Horizonte', google:'https://www.google.com/search?q=consultório+odontológico+Belo+Horizonte+whatsapp', insta:'https://www.instagram.com/explore/tags/dentistabh/', niche:'Dentista' },
  { id:'salao', label:'Salões e estética', maps:'https://www.google.com/maps/search/salão+de+beleza+Belo+Horizonte', google:'https://www.google.com/search?q=salão+beleza+Belo+Horizonte+whatsapp', insta:'https://www.instagram.com/explore/tags/salaobh/', niche:'Salão' },
  { id:'pet', label:'Pet shop', maps:'https://www.google.com/maps/search/pet+shop+Belo+Horizonte', google:'https://www.google.com/search?q=pet+shop+Belo+Horizonte+contato', insta:'https://www.instagram.com/explore/tags/petbh/', niche:'Pet shop' },
  { id:'obra', label:'Construção e reforma', maps:'https://www.google.com/maps/search/construtora+Belo+Horizonte', google:'https://www.google.com/search?q=reforma+Belo+Horizonte+orçamento+whatsapp', insta:'https://www.instagram.com/explore/tags/construçãobh/', niche:'Construção' }
];
const TASKS_KEY = 'ccs-admin-tasks';
const GESTAO_URL = 'https://gustavosena972-wq.github.io/financas-codecraft/';
const GESTAO_PLANOS_URL = 'https://gustavosena972-wq.github.io/financas-codecraft/app/planos/';
var opsMem = { unpaidI:0, lastHunt:null, lastChannel:null };

function todayISO(){
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function loadTasks(){ try{ return JSON.parse(localStorage.getItem(TASKS_KEY)||'[]'); }catch(e){ return []; } }
function saveTasks(list){ localStorage.setItem(TASKS_KEY, JSON.stringify(list)); }
function addTask(title, when, type){
  const list = loadTasks();
  list.unshift({ id: Date.now().toString(36)+Math.random().toString(36).slice(2,6), title, when: when||todayISO(), type: type||'geral', done:false, at: new Date().toISOString() });
  saveTasks(list.slice(0,80));
}
function addTaskFromForm(){
  const title = (document.getElementById('task-title').value||'').trim();
  const when = document.getElementById('task-when').value || todayISO();
  if(!title){ showToast('Escreve o que fazer.'); return; }
  addTask(title, when, 'manual');
  document.getElementById('task-title').value = '';
  renderAgenda();
  showToast('Guardado na agenda.');
}
function toggleTask(id){
  saveTasks(loadTasks().map(t=> t.id===id ? Object.assign({},t,{done:!t.done}) : t));
  renderAgenda();
}
function removeTask(id){
  saveTasks(loadTasks().filter(t=>t.id!==id));
  renderAgenda();
}
function renderAgenda(){
  const when = document.getElementById('task-when');
  if(when && !when.value) when.value = todayISO();
  const el = document.getElementById('agenda-list');
  if(!el) return;
  const list = loadTasks();
  const today = todayISO();
  const due = list.filter(t=>!t.done && t.when<=today);
  const later = list.filter(t=>!t.done && t.when>today);
  const done = list.filter(t=>t.done).slice(0,8);
  function row(t){
    return `<div class="ccs-panel" style="margin-bottom:8px; display:flex; justify-content:space-between; gap:10px; align-items:center; flex-wrap:wrap; ${t.done?'opacity:.55;':''}">
      <div><strong>${escapeHtml(t.title)}</strong><br><span style="color:var(--ink-soft); font-size:12px;">${t.when} · ${t.type}</span></div>
      <div style="display:flex; gap:6px;">
        <button class="ccs-btn ${t.done?'ghost':'amber'} small" onclick="toggleTask('${t.id}')">${t.done?'Reabrir':'Feito'}</button>
        <button class="ccs-btn ghost small" onclick="removeTask('${t.id}')">Tirar</button>
      </div>
    </div>`;
  }
  el.innerHTML = (due.length?`<div class="ccs-eyebrow" style="margin-bottom:8px;">Para hoje / atrasado · ${due.length}</div>`+due.map(row).join(''):'<div class="ccs-panel ccs-empty">Nada atrasado. Adicione um item na agenda quando precisar.</div>')
    +(later.length?`<div class="ccs-eyebrow" style="margin:16px 0 8px;">Depois</div>`+later.map(row).join(''):'')
    +(done.length?`<div class="ccs-eyebrow" style="margin:16px 0 8px;">Feito</div>`+done.map(row).join(''):'');
}

function loadCrmLeadsLocal(){
  try{ return JSON.parse(localStorage.getItem(LEADS_KEY)||'[]'); }catch(e){ return []; }
}
function saveCrmLeadsLocal(list){ localStorage.setItem(LEADS_KEY, JSON.stringify(list)); }
function parseCrmRow(row){
  const code = String(row.code||'');
  const id = code.replace(/^CRM-/, '');
  try{
    const v = JSON.parse(row.name);
    if(v && v.name){
      return { id: v.id || id, name:v.name, phone:v.phone||'', niche:v.niche||'', status:v.status||'aberto', createdAt:v.createdAt||row.created_at };
    }
  }catch(e){}
  return { id, name: row.name, phone:'', niche:'', status:'aberto', createdAt:row.created_at };
}
async function loadCrmLeads(){
  const local = loadCrmLeadsLocal();
  if(!supabaseClient) return local;
  const table = await supabaseClient.from('admin_leads').select('*').order('created_at', {ascending:false});
  if(!table.error && table.data){
    const list = table.data.map(r=>({
      id: String(r.id), name:r.name, phone:r.phone||'', niche:r.niche||'', status:r.status||'aberto', createdAt:r.created_at
    }));
    saveCrmLeadsLocal(list);
    return list;
  }
  const chats = await supabaseClient.from('lead_chats').select('*').like('code','CRM-%').order('last_at', {ascending:false});
  if(!chats.error && chats.data && chats.data.length){
    const list = chats.data.map(parseCrmRow);
    saveCrmLeadsLocal(list);
    return list;
  }
  return local;
}
async function persistCrmLead(lead){
  const rest = loadCrmLeadsLocal().filter(x=>x.id!==lead.id);
  saveCrmLeadsLocal([lead].concat(rest));
  if(!supabaseClient) return;
  const row = { id: lead.id, name: lead.name, phone: lead.phone||'', niche: lead.niche||'', status: lead.status||'aberto', created_at: lead.createdAt };
  const ins = await supabaseClient.from('admin_leads').upsert(row);
  if(!ins.error) return;
  await supabaseClient.from('lead_chats').upsert({
    code: 'CRM-'+lead.id,
    name: JSON.stringify(lead),
    last_at: new Date().toISOString()
  }, { onConflict: 'code' });
}
async function removeCrmLeadCloud(id){
  if(!supabaseClient) return;
  await supabaseClient.from('admin_leads').delete().eq('id', id);
  await supabaseClient.from('lead_chats').delete().eq('code', 'CRM-'+id);
}
async function migrateCrmLeads(){
  const local = loadCrmLeadsLocal();
  for(let i=0;i<local.length;i++) await persistCrmLead(local[i]);
}
function pitchFor(name, niche){
  const who = name || 'você';
  const n = niche ? ' Vi o segmento de '+niche+'.' : '';
  return 'Olá, '+who+'! Aqui é da CodeCraft Solutions, em Belo Horizonte. Fazemos site, loja e sistema.'+n+' Posso mandar um modelo pronto, sem compromisso, em dois minutos?';
}
async function saveLeadAndPing(){
  const nameEl = document.getElementById('lead-name');
  if(!nameEl) return;
  const name = nameEl.value.trim();
  const phone = document.getElementById('lead-phone').value.trim();
  const niche = document.getElementById('lead-niche').value.trim();
  if(!name){ showToast('Coloque o nome da empresa.'); return; }
  const lead = { id: Date.now().toString(36), name, phone, niche, createdAt: new Date().toISOString(), status:'aberto' };
  await persistCrmLead(lead);
  document.getElementById('lead-name').value=''; document.getElementById('lead-phone').value='';
  await renderLeads();
  addTask('Retornar '+name+(niche?' · '+niche:''), todayISO(), 'lead');
  showToast('Lead salvo. Responda na aba Conversas quando o cliente falar no chat.');
}
async function markLead(id, status){
  const list = await loadCrmLeads();
  const next = list.map(l=> l.id===id ? Object.assign({}, l, { status }) : l);
  const lead = next.find(l=>l.id===id);
  if(lead) await persistCrmLead(lead);
  await renderLeads();
}
async function removeLead(id){
  saveCrmLeadsLocal(loadCrmLeadsLocal().filter(l=>l.id!==id));
  await removeCrmLeadCloud(id);
  await renderLeads();
}
async function openLeadWa(id){
  const list = await loadCrmLeads();
  const l = list.find(x=>x.id===id);
  if(!l) return;
  const text = pitchFor(l.name, l.niche);
  await navigator.clipboard.writeText(text).catch(()=>{});
  openAppConversas();
  showToast('Texto copiado. Responda na aba Conversas.');
}
async function renderLeads(){
  const el = document.getElementById('leads-list');
  if(!el) return;
  const list = await loadCrmLeads();
  if(!list.length){ el.innerHTML = '<div class="ccs-panel ccs-empty">Nenhum lead ainda. Cadastre o nome da empresa quando fizer contato.</div>'; return; }
  el.innerHTML = list.map(l=>`
    <div class="ccs-panel" style="margin-bottom:10px; display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
      <div><strong>${escapeHtml(l.name)}</strong> · ${escapeHtml(l.niche||'—')}<br><span style="color:var(--ink-soft); font-size:13px;">${escapeHtml(l.phone||'sem telefone')} · ${l.status}</span></div>
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        <button class="ccs-btn amber small" onclick="openLeadWa('${l.id}')">Abrir chat</button>
        <button class="ccs-btn ghost small" onclick="markLead('${l.id}','respondeu')">Respondeu</button>
        <button class="ccs-btn ghost small" onclick="removeLead('${l.id}')">Tirar</button>
      </div>
    </div>`).join('');
}

function renderHunt(){
  const el = document.getElementById('hunt-grid');
  if(!el) return;
  el.innerHTML = HUNTS.map(h=>`
    <div class="ccs-panel">
      <strong>${h.label}</strong>
      <p style="font-size:13px; color:var(--ink-soft); margin:8px 0 12px;">Abre Maps e Google já na Grande BH. Ache uma empresa e salve em Clientes.</p>
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        <button class="ccs-btn amber small" onclick="runHunt('${h.id}')">Caçar agora</button>
        <a class="ccs-btn ghost small" href="${h.insta}" target="_blank" rel="noopener">Instagram</a>
      </div>
    </div>`).join('');
}
function runHunt(id, city){
  const h = HUNTS.find(x=>x.id===id);
  if(!h) return;
  const place = city || 'Belo Horizonte';
  const q = encodeURIComponent((h.niche||h.label)+' '+place);
  window.open('https://www.google.com/maps/search/'+q, '_blank');
  window.open('https://www.google.com/search?q='+q+'+whatsapp+contato', '_blank');
  if(h.insta) window.open(h.insta, '_blank');
  const niche = document.getElementById('lead-niche');
  if(niche) niche.value = h.niche;
  const nameEl = document.getElementById('lead-name');
  if(nameEl && !nameEl.value) nameEl.placeholder = 'Cole o nome que achou em '+place;
  opsMem.lastHunt = { id:h.id, city:place };
  addTask('Caçar '+h.label+' em '+place, todayISO(), 'cacar');
  showToast('Maps, Google e Instagram abertos.');
}

function todayPosts(mkt){
  const day = new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long' });
  const extra = mkt && mkt.usd!=null ? ('\nMercado agora: dólar R$ '+moneyFx(mkt.usd)+(mkt.selic!=null?', Selic '+mkt.selic+'%':'')+'. Quem controla gente, caixa e operação fecha o mês — CodeCraft Gestão.') : '';
  return {
    linkedin: 'CodeCraft Solutions · '+day+'\n\nAtendemos MEI, PME e grandes empresas: site, loja virtual, sistema sob medida e ERP CodeCraft Gestão.\nEntrega com portal ao vivo e chat no site.\nhttps://gustavosena972-wq.github.io/CodeCraft-Solutions/'+extra,
    instagram: 'Site, loja ou ERP para sua empresa — do MEI ao corporativo.\nFale no chat do site · CodeCraft Solutions · BH',
    google: 'Criação de sites, lojas e sistemas em Belo Horizonte. Acompanhe o projeto ao vivo. Atendimento no chat do site.',
    chat: 'CodeCraft Solutions — site, loja e sistema. Fale no chat do site e acompanhe no portal.'
  };
}
function bestChannel(projects, messages, mkt){
  const unpaid = (projects||[]).filter(p=>!p.paid && Number(p.pixValue)>0).length;
  const hour = new Date().getHours();
  const inbound = (messages||[]).length;
  const usd = Number(mkt && mkt.usdPct) || 0;
  const ibov = Number(mkt && mkt.ibovPct) || 0;
  if(unpaid >= 1) return { id:'chat', label:'Chat do site', why:'Tem cobrança em aberto. Responda no chat antes de postar.' };
  if(inbound > 0 && hour >= 9 && hour <= 18) return { id:'chat', label:'Chat do site', why:'Já chega pedido pelo site. Responder no chat fecha mais do que postar agora.' };
  if(Math.abs(usd) >= 0.8 || ibov <= -1) return { id:'linkedin', label:'LinkedIn', why:'Mercado mexeu. Post de caixa e preço em real fecha mais no LinkedIn agora.' };
  if(hour >= 8 && hour <= 11) return { id:'google', label:'Google Meu Negócio', why:'Manhã é hora de busca local: “criar site BH”.' };
  if(hour >= 11 && hour <= 14) return { id:'linkedin', label:'LinkedIn', why:'Horário comercial B2B. Ticket maior.' };
  return { id:'instagram', label:'Instagram', why:'Prova de trabalho fora do expediente. Bom para aparecer, não para fechar sozinho.' };
}
function copyPost(kind, mkt){
  const p = todayPosts(mkt || marketCache);
  const text = p[kind] || p.chat;
  navigator.clipboard.writeText(text).then(()=>{
    const done = JSON.parse(localStorage.getItem(POSTS_KEY)||'{}');
    done[new Date().toISOString().slice(0,10)+'-'+kind] = true;
    localStorage.setItem(POSTS_KEY, JSON.stringify(done));
    showToast('Texto copiado. Cole no app e publique.');
    renderPostar();
  });
}
function openPost(kind, mkt){
  copyPost(kind, mkt);
  const urls = {
    linkedin:'https://www.linkedin.com/feed/',
    instagram:'https://www.instagram.com/',
    google:'https://business.google.com/posts',
    chat:'https://gustavosena972-wq.github.io/CodeCraft-Solutions/'
  };
  window.open(urls[kind]||urls.chat, '_blank');
}
async function renderPostar(){
  const el = document.getElementById('postar-box');
  if(!el) return;
  const projects = await loadProjects();
  const messages = await loadMessages();
  const mkt = await loadMarket();
  const ch = bestChannel(projects, messages, mkt);
  const posts = todayPosts(mkt);
  const keys = [['linkedin','LinkedIn'],['instagram','Instagram'],['google','Google'],['chat','Site · chat']];
  el.innerHTML = `
    <div class="ccs-panel" style="margin-bottom:14px; border-color:var(--amber);">
      <div class="ccs-eyebrow">Canal de agora</div>
      <h3 style="margin:6px 0;">${ch.label}</h3>
      <p style="color:var(--ink-soft); font-size:14px;">${ch.why}</p>
      <button class="ccs-btn amber" style="margin-top:10px;" onclick="openPost('${ch.id}')">Copiar e abrir ${ch.label}</button>
    </div>
    ${keys.map(([k,lab])=>`
      <div class="ccs-panel" style="margin-bottom:10px;">
        <strong>${lab}</strong>
        <pre style="white-space:pre-wrap; font-family:Inter,sans-serif; font-size:13.5px; margin:10px 0; color:var(--ink);">${escapeHtml(posts[k])}</pre>
        <button class="ccs-btn amber small" onclick="copyPost('${k}')">Copiar</button>
        <button class="ccs-btn ghost small" onclick="openPost('${k}')">Abrir e postar</button>
      </div>`).join('')}`;
}

let marketCache = null;
async function loadMarket(){
  if(marketCache && (Date.now()-marketCache.at)<20*1000) return marketCache;
  const out = { usd:null, usdPct:null, eur:null, ibov:null, ibovPct:null, selic:null, ipca:null, at: Date.now() };
  try{
    const selic = await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json');
    if(selic.ok){ const j = await selic.json(); out.selic = j[0] && j[0].valor; }
  }catch(e){}
  try{
    const ipca = await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/1?formato=json');
    if(ipca.ok){ const j = await ipca.json(); out.ipca = j[0] && j[0].valor; }
  }catch(e){}
  try{
    const fx = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL');
    if(fx.ok){
      const j = await fx.json();
      if(j.USDBRL){ out.usd = Number(j.USDBRL.bid); out.usdPct = j.USDBRL.pctChange; }
      if(j.EURBRL){ out.eur = Number(j.EURBRL.bid); }
    }
  }catch(e){}
  try{
    const ib = await fetch('https://brapi.dev/api/quote/%5EBVSP');
    if(ib.ok){ const j = await ib.json(); const q = j.results && j.results[0]; if(q){ out.ibov = q.regularMarketPrice; out.ibovPct = q.regularMarketChangePercent; } }
  }catch(e){}
  marketCache = out;
  return out;
}
function moneyFx(n){ return n==null ? '—' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 }); }

async function renderHoje(){
  const metrics = document.getElementById('hoje-metrics');
  const marketEl = document.getElementById('hoje-market');
  const actions = document.getElementById('hoje-actions');
  if(!metrics) return;
  const projects = await loadProjects();
  const messages = await loadMessages();
  const unpaid = projects.filter(p=>!p.paid && Number(p.pixValue)>0);
  const stuck = projects.filter(p=>p.status==='analise' || (p.status==='andamento' && !p.deliveryUrl));
  const leads = (await loadCrmLeads()).filter(l=>l.status==='aberto');
  const mkt = await loadMarket();
  const ch = bestChannel(projects, messages, mkt);
  const due = loadTasks().filter(x=>!x.done && x.when<=todayISO()).length;
  const analysis = analyzeMarket(mkt);
  metrics.innerHTML = `
    <div class="ccs-metric receber"><div class="lbl">A receber</div><div class="val">${unpaid.length}</div><div class="sub">projetos sem PIX marcado</div></div>
    <div class="ccs-metric"><div class="lbl">Em produção</div><div class="val">${stuck.length}</div><div class="sub">análise ou sem link</div></div>
    <div class="ccs-metric"><div class="lbl">Leads / agenda</div><div class="val">${leads.length}</div><div class="sub">${due} item(ns) para hoje</div></div>
    <div class="ccs-metric"><div class="lbl">Canal de agora</div><div class="val" style="font-size:18px;">${ch.label}</div><div class="sub">${ch.why}</div></div>`;
  marketEl.innerHTML = `<div class="ccs-eyebrow">Mercado agora · ação de hoje</div>
    <div style="display:flex; gap:18px; flex-wrap:wrap; margin-top:8px; font-family:JetBrains Mono,monospace; font-size:14px;">
      <span>Dólar R$ ${moneyFx(mkt.usd)} ${mkt.usdPct!=null?'('+mkt.usdPct+'%)':''}</span>
      <span>Euro R$ ${moneyFx(mkt.eur)}</span>
      <span>Ibovespa ${mkt.ibov!=null?Number(mkt.ibov).toLocaleString('pt-BR'):'—'} ${mkt.ibovPct!=null?'('+Number(mkt.ibovPct).toFixed(2)+'%)':''}</span>
      <span>Selic ${mkt.selic!=null?mkt.selic+'%':'—'}</span>
      <span>IPCA ${mkt.ipca!=null?mkt.ipca+'%':'—'}</span>
    </div>
    <p style="font-size:13px; margin-top:10px;">${escapeHtml(analysis.copy)}</p>
    <button class="ccs-btn amber small" style="margin-top:8px;" onclick="openPost('${ch.id}')">Postar com esse mercado</button>`;
  const firstUnpaid = unpaid[0];
  const firstLead = leads[0];
  actions.innerHTML = `
    <div class="ccs-eyebrow" style="margin-bottom:10px;">Ações</div>
    ${firstUnpaid ? `<button class="ccs-btn amber" onclick="chaseUnpaid()">Cobrar ${escapeHtml(firstUnpaid.clientName)} · ${money(Number(firstUnpaid.pixValue))}</button>` : '<p style="color:var(--ink-soft);">Nada a cobrar no PIX agora.</p>'}
    ${unpaid.length>1 ? `<button class="ccs-btn ghost" style="margin-top:8px;" onclick="chaseAllUnpaid()">Cobrar todos (${unpaid.length})</button>` : ''}
    ${firstLead ? `<button class="ccs-btn" style="margin-top:8px;" onclick="openLeadWa('${firstLead.id}')">Chamar lead ${escapeHtml(firstLead.name)}</button>` : ''}
    <button class="ccs-btn ghost" style="margin-top:8px;" onclick="runHunt('clinica')">Caçar clínicas em BH</button>
    <button class="ccs-btn ghost" style="margin-top:8px;" onclick="openPost('${ch.id}')">Postar em ${ch.label}</button>
    <button class="ccs-btn ghost" style="margin-top:8px;" onclick="replyStalledChat()">Responder chat parado</button>
  `;
}
function chaseText(p){
  return 'Olá, '+p.clientName+'! Aqui é da CodeCraft. O PIX do projeto '+p.projectName+' é '+money(Number(p.pixValue))+' na chave 31999758385. Quando pagar, me avisa aqui no chat que confirmo no painel.';
}
async function chaseProject(p){
  if(!p) return false;
  const text = chaseText(p);
  if(p.trackingCode){
    await insertChat(p.trackingCode, 'admin', text);
    showScreen('admin');
    switchAdminTab('conversas');
    await openAdminChat(p.trackingCode);
    showToast('Cobrança enviada no chat: '+p.clientName);
  } else {
    await navigator.clipboard.writeText(text).catch(()=>{});
    openAppConversas();
    showToast('Texto copiado. Envie na aba Conversas.');
  }
  addTask('Cobrar '+p.clientName+' · '+money(Number(p.pixValue)), todayISO(), 'cobranca');
  return true;
}
async function chaseUnpaid(){
  const projects = await loadProjects();
  const unpaid = projects.filter(x=>!x.paid && Number(x.pixValue)>0);
  if(!unpaid.length){ showToast('Nada a cobrar.'); return null; }
  const p = unpaid[opsMem.unpaidI % unpaid.length];
  opsMem.unpaidI++;
  await chaseProject(p);
  return p;
}
async function chaseAllUnpaid(){
  const projects = await loadProjects();
  const unpaid = projects.filter(x=>!x.paid && Number(x.pixValue)>0);
  if(!unpaid.length){ showToast('Nada a cobrar.'); return; }
  unpaid.slice(0,6).forEach((p,i)=> setTimeout(()=> chaseProject(p), i*700));
  showToast('Abrindo cobrança de '+Math.min(6, unpaid.length)+' cliente(s).');
}

function proposalText(name, service){
  const map = {
    site: 'site institucional com acompanhamento ao vivo e PIX na entrega',
    loja: 'loja virtual com pedido, chat no site e PIX',
    landing: 'landing page para captar cliente',
    sistema: 'sistema sob medida para o dia a dia da empresa',
    gestao: 'CodeCraft Gestão — ERP/HCM (Financeiro, RH e Billing, R$ 280–500)'
  };
  const what = map[service] || map.site;
  return 'Olá'+(name?', '+name:'')+'! Sou da CodeCraft Solutions, em BH.\n\nPosso te entregar um '+what+'. Você acompanha cada etapa no portal e paga só na chave PIX 31999758385.\n\nMe fala o que você precisa que eu fecho o escopo e o prazo.\nAtendimento pelo chat do site.';
}
function sendProposal(){
  const nameEl = document.getElementById('prop-name');
  if(!nameEl) return;
  const name = (nameEl.value||'').trim();
  const service = document.getElementById('prop-service').value;
  const text = proposalText(name, service);
  navigator.clipboard.writeText(text).catch(()=>{});
  openAppConversas();
  addTask('Proposta '+service+(name?' · '+name:''), todayISO(), 'proposta');
  showToast('Proposta copiada. Cole na aba Conversas.');
}

function renderTools(){
  const el = document.getElementById('tools-grid');
  if(!el) return;
  el.innerHTML = [
    ['Cobrar quem deve','Envia cobrança PIX no chat do próximo cliente.','chaseUnpaid()'],
    ['Cobrar todos','Abre até 6 cobranças em sequência.','chaseAllUnpaid()'],
    ['Achar clínicas BH','Maps + Google + Instagram já filtrados.','runHunt("clinica")'],
    ['Postar no melhor canal','Copia o texto e abre o canal de agora.','(async()=>{const p=await loadProjects();const m=await loadMessages();const k=await loadMarket();openPost(bestChannel(p,m,k).id,k);})()'],
    ['Analisar mercado e postar','Lê dólar, bolsa e Selic e já publica.','(async()=>{const p=await loadProjects();const m=await loadMessages();const k=await loadMarket();openPost(bestChannel(p,m,k).id,k);})()'],
    ['Responder chat parado','Abre a conversa parada e manda o texto.','replyStalledChat()'],
    ['Abrir CodeCraft Gestão','ERP/HCM: Financeiro, RH e Billing.','window.open(GESTAO_URL,"_blank")'],
    ['Exportar a empresa','Baixa Excel de projetos e caixa.','exportExcel()']
  ].map(([t,d,fn])=>`
    <div class="ccs-panel">
      <strong>${t}</strong>
      <p style="font-size:13px; color:var(--ink-soft); margin:8px 0 12px;">${d}</p>
      <button class="ccs-btn amber small" onclick='${fn}'>Fazer agora</button>
    </div>`).join('');
}

async function findStalledChats(){
  const chats = await loadLeadChats();
  const stalled = [];
  for(const c of (chats||[]).slice(0,20)){
    const msgs = await loadChat(c.code);
    if(!msgs || !msgs.length) continue;
    const last = msgs[msgs.length-1];
    const ageH = (Date.now()-new Date(last.created_at||last.createdAt||Date.now()).getTime())/36e5;
    if(last.sender==='client' && ageH >= 2) stalled.push({ code:c.code, name:c.name, last, ageH });
  }
  return stalled;
}
async function replyStalledChat(){
  const stalled = await findStalledChats();
  if(!stalled.length){ showToast('Nenhuma conversa parada agora.'); return null; }
  const s = stalled[0];
  const text = 'Prezado(a) '+(s.name||'cliente')+',\n\nAgradecemos o contato com a CodeCraft Solutions. Recebemos sua mensagem e gostaríamos de dar continuidade.\n\nPor gentileza, confirme se a necessidade é site, loja virtual, sistema sob medida ou CodeCraft Gestão, para enviarmos prazo e valor com objetividade.\n\nPagamentos somente na chave PIX oficial 31999758385.\n\nAtenciosamente,\nEquipe CodeCraft Solutions';
  await insertChat(s.code, 'admin', text);
  currentChatCode = s.code;
  switchAdminTab('conversas');
  renderChatProjectList();
  renderAdminChat();
  addTask('Retornar chat '+(s.name||s.code), todayISO(), 'chat');
  return s;
}

function analyzeMarket(mkt){
  const parts = [];
  if(mkt && mkt.selic!=null && Number(mkt.selic) >= 12) parts.push('Selic alta: priorize PIX à vista e recorrência com CodeCraft Gestão.');
  if(mkt && mkt.usdPct!=null && Math.abs(Number(mkt.usdPct)) >= 0.8) parts.push('Dólar volátil: destaque preço em real e entrega local.');
  if(!parts.length) parts.push('Mercado estável: responda chats e feche propostas com clareza.');
  return { copy: parts.join(' ') };
}
const MKT_BANK = [
  { cat:'strategy', title:'Posicionamento', body:'CodeCraft Solutions atende MEI, PME e grandes empresas em BH e Brasil. Sites, lojas, sistemas sob medida e CodeCraft Gestão (ERP). Toda peça: 1 problema, 1 prova, 1 CTA (chat do site ou portal).' },
  { cat:'calendar', title:'Semana padrão', body:'Seg: problema do nicho. Ter: antes/depois. Qua: CodeCraft Gestão. Qui: prova social. Sex: oferta PIX na entrega. Sáb: mercado (Selic/dólar) e o que vender. Dom: bastidor da @code.invention. 1 CTA por post.' },
  { cat:'copy', title:'Gancho', body:'3 segundos: “Sua empresa ainda perde cliente sem site profissional?” Depois a prova. Depois o que fazer. Hashtag só no fim. @code.invention uma vez. Sem enrolação.' },
  { cat:'growth', title:'Alcance', body:'Reels ensina. Carrossel salva. Story pergunta. Feed posiciona. Não poste os quatro iguais. 4 a 6 posts por semana. Piloto no máximo 2/dia no feed, com 3h de folga.' },
  { cat:'niche', title:'Quem comprar', body:'MEI, pequenas, médias e grandes empresas: clínica, loja, indústria, SaaS, varejo e corporativo. Quem precisa de site, loja, sistema ou ERP (Gestão). Freelance + chat do site + inbound.' },
  { cat:'offer', title:'Oferta', body:'PIX na entrega. Preço de partida no site. CodeCraft Gestão para quem precisa de people, finanças e operações num só lugar. Uma oferta por post. Nunca duas.' },
  { cat:'funnel', title:'Funil', body:'Conteúdo → chat do site → briefing → PIX → portal. Instagram não fecha contrato sozinho. O post tem que mandar para o chat ou para o portal.' },
  { cat:'tone', title:'Tom', body:'Português simples. BH. Sem jargão de agência. Fala como dono de oficina, não como MBA. Frase curta. Número na tela quando houver.' }
];
let mktBankLive = MKT_BANK.slice();

async function seedMarketingBank(){
  if(!supabaseClient) return;
  try{
    const { data, error } = await supabaseClient.from('marketing_intel').select('cat,title,body').eq('active', true);
    if(!error && data && data.length){
      mktBankLive = data;
      return;
    }
    const rows = MKT_BANK.map(function(x){ return { cat:x.cat, title:x.title, body:x.body, channel:'instagram', active:true }; });
    await supabaseClient.from('marketing_intel').upsert(rows, { onConflict:'title' });
    mktBankLive = MKT_BANK.slice();
  }catch(e){
    mktBankLive = MKT_BANK.slice();
  }
}
function mktPick(cat){
  const list = mktBankLive.filter(function(x){ return x.cat===cat; });
  const pool = list.length ? list : mktBankLive;
  return pool[Math.floor(Math.random()*pool.length)].body;
}
function mktStrategyReply(raw, mkt){
  const t = raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(/calend|semana|pilar/.test(t)) return mktPick('calendar');
  if(/nicho|cliente|publico|clinica|loja|mei/.test(t)) return mktPick('niche');
  if(/hook|gancho|legenda|copy|caption|escreve/.test(t)) return mktPick('copy');
  if(/reels|algorit|alcance|seguidor|crescer/.test(t)) return mktPick('growth');
  if(/oferta|preco|pix na entrega/.test(t)) return mktPick('offer');
  if(/funil|chat do site|vender/.test(t)) return mktPick('funnel');
  if(/tom|como falar|linguagem/.test(t)) return mktPick('tone');
  const extra = mkt && mkt.usd!=null ? (' Mercado agora: dólar R$ '+moneyFx(mkt.usd)+(mkt.selic!=null?', Selic '+mkt.selic+'%.':'')+' Com Selic alta, venda PIX à vista e CodeCraft Gestão.') : '';
  return mktPick('strategy')+extra;
}

/* ================= INIT ================= */
async function probeDbHealth(){
  const el = document.getElementById('ccs-db-status');
  const txt = document.getElementById('ccs-db-status-text');
  if(!el || !txt) return;
  if(!supabaseClient){
    el.classList.add('show','warn');
    txt.textContent = 'sem banco';
    return;
  }
  try{
    const { error } = await supabaseClient.from('projects').select('id', { count:'exact', head:true });
    el.classList.add('show');
    if(error){ el.classList.add('warn'); txt.textContent = 'banco com falha'; }
    else { el.classList.remove('warn'); txt.textContent = 'banco ok'; }
  }catch(e){
    el.classList.add('show','warn');
    txt.textContent = 'banco offline';
  }
}
if(window.CCS_PAGE === 'admin'){
  document.title = 'Admin · CodeCraft Solutions';
  probeDbHealth();
  renderAdminGate();
} else {
  typeHero();
  initLead();
  probeDbHealth();
  if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    document.querySelectorAll('.ccs-card, .ccs-price-card, .ccs-step, .ccs-about, .ccs-grid-3, .ccs-price-grid').forEach((el)=>el.classList.add('ccs-reveal'));
    const io = new IntersectionObserver((entries)=>{
      entries.forEach((entry)=>{ if(entry.isIntersecting){ entry.target.classList.add('in'); io.unobserve(entry.target); } });
    }, { threshold: 0.12 });
    document.querySelectorAll('.ccs-reveal').forEach((el)=>io.observe(el));
  }
}


