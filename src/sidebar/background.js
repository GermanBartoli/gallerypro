// El panel nativo reduce el ancho real de la pestaña y Google reorganiza sus fotos.
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if (message?.kind !== 'open-panel' || !sender.tab || !sender.url?.startsWith('https://photos.google.com/')) return;
  chrome.sidePanel.open({tabId:sender.tab.id}).then(()=>reply({ok:true}),()=>reply({ok:false}));
  return true;
});
