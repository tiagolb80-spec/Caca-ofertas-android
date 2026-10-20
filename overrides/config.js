(()=> {
  const style=document.createElement('style');
  style.textContent='#co-setup{position:fixed;right:14px;bottom:18px;z-index:9999;font:14px Arial,sans-serif}#co-setup button{border:0;border-radius:12px;padding:11px 14px;font-weight:700;box-shadow:0 4px 18px #102a4330}#co-open{background:#102a43;color:white}#co-panel{display:none;width:min(330px,calc(100vw - 28px));background:#fff;color:#182b3a;border:1px solid #dbe5ed;border-radius:16px;padding:16px;margin-bottom:9px;box-shadow:0 12px 40px #102a4333}#co-panel h3{margin:0 0 8px;font-size:17px}#co-panel p{font-size:12px;line-height:1.45;color:#64748b}#co-url{width:100%;box-sizing:border-box;padding:12px;border:1px solid #d5e0e9;border-radius:10px;font-size:14px}#co-actions{display:flex;gap:8px;margin-top:9px}#co-actions button{flex:1;cursor:pointer}#co-save{background:#ff6b35;color:#fff}#co-test{background:#edf2f7;color:#334e68}#co-status{font-size:12px;line-height:1.4;margin-top:9px;color:#526579}';
  document.head.appendChild(style);
  const root=document.createElement('div');root.id='co-setup';
  root.innerHTML='<section id="co-panel"><h3>Conexão da busca</h3><p>Informe somente o endereço HTTPS principal do backend Caça Ofertas. Pode colar o endereço terminado em /health; o aplicativo ajustará automaticamente. Não informe a chave da SerpApi aqui.</p><input id="co-url" type="url" placeholder="https://seu-servico.onrender.com"><div id="co-actions"><button id="co-save">Salvar</button><button id="co-test">Testar</button></div><div id="co-status">A busca online exige um serviço publicado e configurado.</div></section><button id="co-open">⚙ Conexão</button>';
  document.body.appendChild(root);
  const $=id=>document.getElementById(id);
  const normalize=value=>value.trim().replace(/\/$/,'').replace(/\/(health|api\/search)$/i,'');
  const DEFAULT_API_BASE='https://caca-ofertas-api.onrender.com';
  const saved=localStorage.getItem('apiBase')||DEFAULT_API_BASE;
  if(!localStorage.getItem('apiBase')) localStorage.setItem('apiBase',DEFAULT_API_BASE);
  $('co-url').value=saved;
  $('co-open').onclick=()=>{$('co-panel').style.display=$('co-panel').style.display==='block'?'none':'block'};
  $('co-save').onclick=()=>{
    const value=normalize($('co-url').value);
    try {
      const u=new URL(value);
      if(u.protocol!=='https:' || !u.hostname) throw new Error('Use um endereço HTTPS válido.');
      localStorage.setItem('apiBase',value);
      $('co-status').textContent='Endereço salvo. Recarregando para ativar…';
      setTimeout(()=>location.reload(),350);
    } catch(e) {
      $('co-status').textContent='URL inválida. Cole o endereço público HTTPS do serviço no Render.';
    }
  };
  $('co-test').onclick=async()=>{
    const value=normalize($('co-url').value);
    try {
      const u=new URL(value);
      if(u.protocol!=='https:' || !u.hostname) throw new Error('URL inválida: use o endereço HTTPS do Render.');
      $('co-status').textContent='Testando '+u.host+'…';
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),15000);
      let r;
      try { r=await fetch(value+'/health',{method:'GET',headers:{'Accept':'application/json'},signal:controller.signal,cache:'no-store'}); }
      finally { clearTimeout(timer); }
      const body=await r.text();
      if(!r.ok) throw new Error('O servidor respondeu HTTP '+r.status+(body?' — '+body.slice(0,120):'')+'.');
      let data;
      try { data=JSON.parse(body); } catch { throw new Error('O endereço abriu, mas não retornou JSON no endpoint /health. Confira se colou a URL do backend.'); }
      if(data.status!=='ok') throw new Error('O endereço respondeu, mas não parece ser a API do Caça Ofertas.');
      $('co-status').textContent=data.provider_configured?'Conexão OK! Servidor e provedor de busca configurados.':'Servidor online, mas falta configurar SERPAPI_KEY no Render.';
    } catch(e) {
      if(e.name==='AbortError') $('co-status').textContent='Tempo esgotado ao testar. Abra a URL /health no Chrome e confirme se o serviço no Render está ativo.';
      else if(e instanceof TypeError) $('co-status').textContent='Falha de rede/CORS no aplicativo. Confira se a URL pública HTTPS abre no Chrome e se não há VPN ou bloqueio de rede.';
      else $('co-status').textContent=e.message||'Falha ao testar a conexão.';
    }
  };
  // Abre links de ofertas fora do app, preferindo a integração nativa quando disponível.
  document.addEventListener('click', function(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.target && event.target.closest && event.target.closest('#co-setup')) return;
    const anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!anchor) return;
    const raw = anchor.getAttribute('href');
    if (!raw || /^(javascript:|mailto:|tel:|#)/i.test(raw.trim())) return;
    let url;
    try { url = new URL(raw, document.baseURI); } catch (_) { return; }
    if (!/^https?:$/.test(url.protocol)) return;
    event.preventDefault();
    event.stopPropagation();
    const destination = url.href;
    // Cordova / plugins que suportam abertura explícita no navegador do aparelho.
    try {
      if (window.cordova && window.cordova.InAppBrowser && typeof window.cordova.InAppBrowser.open === 'function') {
        window.cordova.InAppBrowser.open(destination, '_system');
        return;
      }
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser &&
          typeof window.Capacitor.Plugins.Browser.open === 'function') {
        window.Capacitor.Plugins.Browser.open({ url: destination });
        return;
      }
      const popup = window.open(destination, '_system');
      if (popup) return;
      window.open(destination, '_blank');
    } catch (_) {
      window.location.href = destination;
    }
  }, true);

})();