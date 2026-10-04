const host=document.getElementById('view');
const root=host.attachShadow({mode:'open'});
let tabId=null;
const tags=new Set(['style','section','header','span','button','div','p','label','input','select','option','small','dialog','h2','h3','a','img']);
function create(data) {
  if(typeof data==='string') return document.createTextNode(data);
  if(!data || !tags.has(data.tag)) return document.createTextNode('');
  const element=document.createElement(data.tag==='dialog'?'section':data.tag);
  for(const [key,value] of Object.entries(data.attrs||{})) {
    if(key.startsWith('on') || key==='srcdoc' || key==='style') continue;
    if((key==='href'||key==='src') && !String(value).startsWith('https://')) continue;
    element.setAttribute(key,value);
  }
  if(data.tag==='dialog') {element.id='native-gallery';element.hidden=!('open' in data.attrs);}
  for(const child of data.children||[]) element.append(create(child));
  if(data.value!==undefined) element.value=data.value;
  if(data.checked!==undefined) element.checked=data.checked;
  if(data.attrs?.['data-size']) element.style.setProperty('--thumbnail-size',data.attrs['data-size']+'px');
  return element;
}
function render(snapshot) {
  const focus=root.activeElement?.id;
  const scroll=document.scrollingElement.scrollTop;
  host.toggleAttribute('data-dark',snapshot.dark);
  document.body.style.background=snapshot.dark?'#202124':'#fff';
  root.replaceChildren(...snapshot.tree.map(create));
  const override=document.createElement('style');
  override.textContent='.panel{position:static;width:100%;border:0;box-shadow:none;padding:16px}.panel[hidden]{display:block!important}#collapse{display:none}#native-gallery{padding:16px}#results{height:auto;overflow:visible}#native-gallery .grid{grid-template-columns:repeat(auto-fill,minmax(min(var(--thumbnail-size,170px),100%),1fr))}';
  root.append(override);
  if(focus) root.getElementById(focus)?.focus({preventScroll:true});
  document.scrollingElement.scrollTop=scroll;
}
function send(command) {
  if(tabId===null)return;
  chrome.tabs.sendMessage(tabId,{kind:'command',command}).catch(()=>{tabId=null;root.textContent='Recargá Google Fotos para conectar GalleryPRO.';});
}
root.addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(button?.id) send({id:button.id,action:'click'});
});
root.addEventListener('change',event=>{
  if(event.target.id)send({id:event.target.id,action:'change',value:event.target.value,checked:event.target.checked});
});
root.addEventListener('keydown',event=>{
  const grid=event.target.closest('.grid');
  if(!grid)return;
  const links=[...grid.querySelectorAll('a')],index=links.indexOf(event.target);
  const columns=Math.max(1,Math.round(grid.clientWidth/(links[0]?.offsetWidth+16)));
  const steps={ArrowRight:1,ArrowLeft:-1,ArrowDown:columns,ArrowUp:-columns,Home:-index,End:links.length-1-index};
  if(index>=0 && event.key in steps){event.preventDefault();links[Math.max(0,Math.min(links.length-1,index+steps[event.key]))].focus();}
});
chrome.runtime.onMessage.addListener((message,sender)=>{
  if(message?.kind==='view' && sender.tab?.id===tabId)render(message.snapshot);
});
async function connect() {
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!tab)return;
  if(tabId!==tab.id){tabId=tab.id;root.textContent='Conectando con Google Fotos…';}
  send({action:'sync'});
}
chrome.tabs.onActivated.addListener(connect);
chrome.tabs.onUpdated.addListener((id,change)=>{
  if(id!==tabId)return;
  if(change.status==='loading')root.textContent='Actualizando Google Fotos…';
  if(change.status==='complete')connect();
});
connect();
