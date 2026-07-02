// The floating "remix" widget, baked into every page via the Astro Layout.
// Styled to match the site: white/#111010 surfaces, neutral grays, Kaisei
// Tokumin serif headings, dark mode via prefers-color-scheme.
//
// The widget mounts inside a Shadow DOM root with its own stylesheet, so remix
// theme CSS (which targets the page) cannot restyle it.
//
// The whole flow happens in place on whatever page you're on: start a remix,
// describe a change, the page reloads restyled.

const WIDGET_CSS = `
#remix-fab{position:fixed;right:20px;bottom:20px;width:44px;height:44px;border-radius:9999px;
border:1px solid #e5e5e5;background:#fff;color:#737373;cursor:pointer;
display:grid;place-items:center;z-index:2147483000;transition:color .15s,border-color .15s}
#remix-fab:hover{color:#171717;border-color:#a3a3a3}
#remix-panel{position:fixed;right:20px;bottom:76px;width:min(340px,calc(100vw - 32px));
max-height:75vh;overflow:auto;background:#fff;color:#262626;border:1px solid #e5e5e5;
border-radius:12px;padding:20px;box-shadow:0 8px 30px rgba(0,0,0,.08);z-index:2147483000;
font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.6}
#remix-panel h3{margin:0 0 6px;font-size:17px;font-weight:700;font-family:var(--font-kaisei,Georgia),serif}
#remix-panel h4{margin:16px 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#737373;font-weight:600}
#remix-panel .muted{color:#737373;font-size:13px}
#remix-panel textarea{width:100%;box-sizing:border-box;min-height:64px;border-radius:8px;
border:1px solid #d4d4d4;background:transparent;color:inherit;padding:10px;font-family:inherit;font-size:14px;resize:vertical}
#remix-panel textarea:focus{outline:none;border-color:#737373}
#remix-panel button.act{margin-top:10px;width:100%;padding:9px;border:1px solid #171717;border-radius:8px;
background:#171717;color:#fff;font-weight:600;font-size:14px;cursor:pointer;font-family:inherit}
#remix-panel button.act:disabled{opacity:.5;cursor:default}
#remix-panel a{color:#737373;text-decoration:underline;text-decoration-color:#d4d4d4;text-underline-offset:2px}
#remix-panel a:hover{color:#262626}
.rx-commit{border:1px solid #e5e5e5;border-radius:8px;padding:8px 10px;margin:6px 0}
.rx-commit .rx-msg{font-size:13px;margin-bottom:4px}
.rx-commit .rx-row{display:flex;align-items:center;gap:8px}
.rx-commit code{color:#737373;font-size:12px;flex:1;font-family:ui-monospace,monospace}
.rx-revert{background:transparent;color:#525252;border:1px solid #d4d4d4;border-radius:6px;
padding:3px 10px;font-size:12px;cursor:pointer;font-family:inherit}
.rx-revert:hover{border-color:#737373;color:#171717}
@media (prefers-color-scheme: dark){
#remix-fab{background:#111010;border-color:#262626;color:#a3a3a3}
#remix-fab:hover{color:#fff;border-color:#525252}
#remix-panel{background:#111010;color:#d4d4d4;border-color:#262626;box-shadow:0 8px 30px rgba(0,0,0,.5)}
#remix-panel .muted,#remix-panel h4{color:#a3a3a3}
#remix-panel textarea{border-color:#333}
#remix-panel textarea:focus{border-color:#737373}
#remix-panel button.act{background:#fff;color:#111;border-color:#fff}
#remix-panel a{color:#a3a3a3;text-decoration-color:#525252}
#remix-panel a:hover{color:#e5e5e5}
.rx-commit{border-color:#262626}
.rx-commit code{color:#a3a3a3}
.rx-revert{color:#a3a3a3;border-color:#333}
.rx-revert:hover{border-color:#737373;color:#fff}
}
`;

const OVERLAY_SCRIPT = `<script>
(function(){
  if(window.__remixMounted) return; window.__remixMounted=true;
  var COOKIE="remix_fork";
  function setCookie(v){ document.cookie=COOKIE+"="+encodeURIComponent(v)+"; Path=/; Max-Age=604800; SameSite=Lax"; }
  function clearCookie(){ document.cookie=COOKIE+"=; Path=/; Max-Age=0"; }
  function stored(){ try{ return localStorage.getItem(COOKIE); }catch(e){ return null; } }
  function forkId(){
    var id=stored();
    if(!id){ id=(crypto.randomUUID && crypto.randomUUID()) || String(Date.now())+Math.random().toString(16).slice(2); try{localStorage.setItem(COOKIE,id);}catch(e){} }
    return id;
  }
  function forked(){ return !!stored(); }
  if(forked()) setCookie(stored());

  // Shadow DOM: the widget carries its own stylesheet; page/theme CSS can't
  // reach inside.
  var host=document.createElement('div');
  host.id='remix-widget';
  var root=host.attachShadow({mode:'open'});
  var style=document.createElement('style');
  style.textContent=__RX_CSS__;
  root.appendChild(style);

  var fab=document.createElement('button');
  fab.id='remix-fab';
  fab.title=forked()?'Customize your remix':'Remix this site';
  fab.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="6" r="2.2"/><circle cx="12" cy="19" r="2.2"/><path d="M6 8.2v1.3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V8.2"/><path d="M12 12.8v4"/></svg>';
  var panel=document.createElement('div');
  panel.id='remix-panel'; panel.style.display='none';
  root.appendChild(panel); root.appendChild(fab);
  document.body.appendChild(host);
  function $(id){ return root.getElementById(id); }
  var open=false;
  fab.onclick=function(){ open=!open; panel.style.display=open?'block':'none'; if(open) render(); };
  function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
  function setStatus(t,err){ var e=$('rx-status'); if(e){ e.textContent=t||''; e.style.color=err?'#dc2626':''; } }

  function render(){
    if(!forked()){
      panel.innerHTML='<h3>Remix this site</h3>'
        +'<p class="muted">Restyle it with AI. Only you see your version.</p>'
        +'<button class="act" id="rx-start">Start remixing</button>';
      $('rx-start').onclick=function(){ setCookie(forkId()); render(); };
      return;
    }
    panel.innerHTML='<h3>Customize with AI</h3>'
      +'<textarea id="rx-prompt" placeholder="Describe a look... e.g. retro pixel terminal, brutalist newspaper, soft pastel zine"></textarea>'
      +'<button class="act" id="rx-gen">Restyle this site</button>'
      +'<div id="rx-status" class="muted" style="margin-top:8px"></div>'
      +'<h4>History</h4><div id="rx-log" class="muted">Loading...</div>'
      +'<div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(115,115,115,.25);text-align:right">'
      +'<a href="#" id="rx-reset" style="font-size:12px">Discard remix</a></div>';
    $('rx-gen').onclick=generate;
    $('rx-reset').onclick=function(e){ e.preventDefault(); reset(); };
    loadLog();
  }

  function loadLog(){
    fetch('/api/remix/state').then(function(r){return r.json();}).then(function(s){
      var log=(s&&s.versions)||[];
      var el=$('rx-log'); if(!el) return;
      el.innerHTML = log.map(function(c){
        return '<div class="rx-commit"><div class="rx-msg">'+esc(c.message)+'</div>'
          +'<div class="rx-row"><code>'+esc(c.short)+'</code>'
          +(c.current?'<span class="muted">current</span>':'<button class="rx-revert" data-id="'+esc(c.id)+'">Revert</button>')+'</div></div>';
      }).join('') || '<span class="muted">No versions yet. Describe a look above.</span>';
      var b=panel.querySelectorAll('.rx-revert');
      for(var i=0;i<b.length;i++){ b[i].addEventListener('click', function(){ revert(this.getAttribute('data-id')); }); }
    }).catch(function(){});
  }

  function activity(c){
    var t=(c&&c.type)||'';
    if(t.indexOf('tool')===0 && c.toolName){ return 'working: '+c.toolName+'...'; }
    if(t.indexOf('reasoning')===0){ return 'thinking...'; }
    if(t.indexOf('text')===0){ return 'writing...'; }
    return '';
  }
  function generate(){
    var p=($('rx-prompt').value||'').trim(); if(!p) return;
    var gen=$('rx-gen'); gen.disabled=true; setStatus('Starting...');
    fetch('/api/remix/agent',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prompt:p})})
      .then(function(resp){
        if(!resp.body){ throw new Error('no stream'); }
        var reader=resp.body.getReader(); var dec=new TextDecoder(); var buf='';
        function pump(){ return reader.read().then(function(res){
          if(res.done) return;
          buf += dec.decode(res.value,{stream:true});
          var blocks=buf.split('\\n\\n'); buf=blocks.pop();
          for(var i=0;i<blocks.length;i++){
            var line=blocks[i].replace(/^data: /,''); if(!line) continue;
            var msg; try{ msg=JSON.parse(line); }catch(e){ continue; }
            if(msg.kind==='status'){ setStatus(msg.text); }
            else if(msg.kind==='event'){ var c; try{c=JSON.parse(msg.chunk);}catch(e){continue;} var a=activity(c); if(a) setStatus(a); }
            else if(msg.kind==='done'){
              if(msg.error){ setStatus(msg.error,true); gen.disabled=false; }
              else { setStatus('Done — reloading...'); setTimeout(function(){ location.reload(); },400); }
            }
          }
          return pump();
        }); }
        return pump();
      }).catch(function(e){ setStatus(String(e),true); gen.disabled=false; });
  }
  function revert(id){
    setStatus('Reverting...');
    fetch('/api/remix/revert',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:id})})
      .then(function(r){return r.json();}).then(function(s){ if(s.error){ setStatus(s.error,true); } else { location.reload(); } })
      .catch(function(e){ setStatus(String(e),true); });
  }
  function reset(){
    if(!confirm('Discard your remix and go back to the original?')) return;
    setStatus('Resetting...');
    fetch('/api/remix/reset',{method:'POST'}).then(function(){ try{localStorage.removeItem(COOKIE);}catch(e){} clearCookie(); location.reload(); })
      .catch(function(e){ setStatus(String(e),true); });
  }
})();
</script>`;

export function appOverlay(): string {
  return OVERLAY_SCRIPT.replace("__RX_CSS__", JSON.stringify(WIDGET_CSS));
}
