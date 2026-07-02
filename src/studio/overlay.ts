// Floating "remix" widget, shown on every page (baked into the Astro Layout and
// also injected onto the /remix studio HTML). It figures out its own state in
// the browser, so it needs no server-rendered flag:
//   - off /remix ("entry" mode): invites you into the studio (or opens your
//     existing remix). The actual restyling happens in the studio.
//   - on /remix ("studio" mode): the full fork / customize-with-AI panel.

const OVERLAY_STYLE = `<style>
#remix-fab{position:fixed;right:16px;bottom:16px;width:54px;height:54px;border-radius:50%;
border:0;background:#f6821f;color:#111;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.4);
display:grid;place-items:center;z-index:2147483000}
#remix-panel{position:fixed;right:16px;bottom:80px;width:min(360px,calc(100vw - 24px));
max-height:75vh;overflow:auto;background:#16161d;color:#eaeaea;border:1px solid #2b2b35;
border-radius:14px;padding:16px;box-shadow:0 12px 40px rgba(0,0,0,.5);z-index:2147483000;
font-family:system-ui,sans-serif}
@media(max-width:480px){#remix-panel{left:12px;right:12px;width:auto;bottom:78px;max-height:72vh}}
#remix-panel h3{margin:0 0 8px;font-size:16px}
#remix-panel h4{margin:16px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#9a9aa6}
#remix-panel .muted{color:#9a9aa6;font-size:12px}
#remix-panel textarea{width:100%;box-sizing:border-box;min-height:64px;border-radius:9px;
border:1px solid #33333d;background:#0b0b0f;color:#eee;padding:10px;font-family:inherit;font-size:16px;resize:vertical}
#remix-panel input{width:100%;box-sizing:border-box;border-radius:9px;border:1px solid #33333d;
background:#0b0b0f;color:#eee;padding:10px;font-size:16px}
#remix-panel button.act{margin-top:8px;width:100%;padding:10px;border:0;border-radius:9px;
background:#f6821f;color:#111;font-weight:600;cursor:pointer}
.rx-commit{border:1px solid #26262e;border-radius:8px;padding:8px 10px;margin:6px 0}
.rx-commit .rx-msg{font-size:13px;margin-bottom:4px}
.rx-commit .rx-row{display:flex;align-items:center;gap:8px}
.rx-commit code{color:#f6821f;font-size:12px;flex:1}
.rx-revert{background:#1b1b22;color:#eee;border:1px solid #33333d;border-radius:7px;padding:3px 10px;font-size:12px;cursor:pointer}
.rx-toggle{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:2px 0 8px}
.rx-mode{background:#0b0b0f;color:#9a9aa6;border:1px solid #33333d;border-radius:7px;padding:4px 9px;font-size:12px;cursor:pointer}
.rx-mode.on{background:#f6821f;color:#111;border-color:#f6821f;font-weight:600}
</style>`;

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
  function isStudio(){ var p=location.pathname; return p==="/remix"||p.indexOf("/remix/")===0; }
  function forked(){ return !!stored(); }
  // keep the routing cookie in sync with the device's saved fork id
  if(forked()) setCookie(stored());

  var fab=document.createElement('button');
  fab.id='remix-fab';
  fab.title=forked()?'Your remix':'Remix this site';
  fab.innerHTML='<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="6" r="2.2"/><circle cx="12" cy="19" r="2.2"/><path d="M6 8.2v1.3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V8.2"/><path d="M12 12.8v4"/></svg>';
  var panel=document.createElement('div');
  panel.id='remix-panel'; panel.style.display='none';
  document.body.appendChild(panel); document.body.appendChild(fab);
  var open=false;
  fab.onclick=function(){ open=!open; panel.style.display=open?'block':'none'; if(open) render(); };
  function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
  function setStatus(t,err){ var e=document.getElementById('rx-status'); if(e){ e.textContent=t||''; e.style.color=err?'#ff6b6b':'#9a9aa6'; } }

  var toggleHtml='<div class="rx-toggle"><span class="muted">Model</span>'
    +'<button class="rx-mode" data-m="fast">&#9889; Fast</button>'
    +'<button class="rx-mode" data-m="capable">&#129504; Capable</button></div>';
  function curModel(){ try{ return localStorage.getItem('remixModel')==='capable'?'capable':'fast'; }catch(e){ return 'fast'; } }
  function paintToggle(){ var cur=curModel(); var b=panel.querySelectorAll('.rx-mode'); for(var i=0;i<b.length;i++){ b[i].className='rx-mode'+(b[i].getAttribute('data-m')===cur?' on':''); } }
  function wireToggle(){ var b=panel.querySelectorAll('.rx-mode'); for(var i=0;i<b.length;i++){ b[i].addEventListener('click', function(){ try{localStorage.setItem('remixModel',this.getAttribute('data-m'));}catch(e){} paintToggle(); }); } paintToggle(); }

  function render(){
    // Off the studio: an entry point. The restyling happens in the studio.
    if(!isStudio()){
      if(!forked()){
        panel.innerHTML='<h3>Remix this site</h3>'
          +'<p class="muted">Get your own private, throwaway copy of this site and restyle it with AI. The content stays Matt\\'s — you change the look.</p>'
          +'<button class="act" id="rx-open">Start remixing &#8594;</button>';
        document.getElementById('rx-open').onclick=function(){ setCookie(forkId()); location.href='/remix'; };
      } else {
        panel.innerHTML='<h3>Your remix</h3>'
          +'<p class="muted">You have a saved remix of this site on this device.</p>'
          +'<button class="act" id="rx-open">Open your remix &#8594;</button>'
          +'<div style="margin-top:14px;padding-top:12px;border-top:1px solid #26262e;text-align:right">'
          +'<a href="#" id="rx-reset" style="color:#9a9aa6;font-size:12px;text-decoration:none">Discard remix &#8617;</a></div>';
        document.getElementById('rx-open').onclick=function(){ location.href='/remix'; };
        document.getElementById('rx-reset').onclick=function(e){ e.preventDefault(); reset(); };
      }
      return;
    }
    // In the studio: fork, then the full customize panel.
    if(!forked()){
      panel.innerHTML='<h3>Remix this site</h3>'
        +'<p class="muted">Get your own private, throwaway copy you can restyle with AI. The content stays Matt\\'s — you change the look.</p>'
        +'<button class="act" id="rx-start">Start remixing</button>';
      document.getElementById('rx-start').onclick=function(){ setCookie(forkId()); location.reload(); };
      return;
    }
    panel.innerHTML='<h3>Customize with AI</h3>'
      +toggleHtml
      +'<textarea id="rx-prompt" placeholder="Describe a change... e.g. make it a retro pixel terminal, or a soft pastel magazine layout"></textarea>'
      +'<button class="act" id="rx-gen">Generate new version</button>'
      +'<div id="rx-status" class="muted" style="margin-top:8px"></div>'
      +'<h4>History</h4><div id="rx-log" class="muted">Loading...</div>'
      +'<div style="margin-top:14px;padding-top:12px;border-top:1px solid #26262e;text-align:right">'
      +'<a href="#" id="rx-reset" style="color:#9a9aa6;font-size:12px;text-decoration:none">Discard remix &#8617;</a></div>';
    document.getElementById('rx-gen').onclick=generate;
    document.getElementById('rx-reset').onclick=function(e){ e.preventDefault(); reset(); };
    wireToggle();
    loadLog();
  }

  function loadLog(){
    fetch('/api/remix/state').then(function(r){return r.json();}).then(function(s){
      var log=(s&&s.versions)||[];
      var el=document.getElementById('rx-log'); if(!el) return;
      el.innerHTML = log.map(function(c){
        return '<div class="rx-commit"><div class="rx-msg">'+esc(c.message)+'</div>'
          +'<div class="rx-row"><code>'+esc(c.short)+'</code>'
          +(c.current?'<span class="muted">current</span>':'<button class="rx-revert" data-id="'+esc(c.id)+'">Revert</button>')+'</div></div>';
      }).join('') || '<span class="muted">No versions yet. Describe a change above.</span>';
      var b=panel.querySelectorAll('.rx-revert');
      for(var i=0;i<b.length;i++){ b[i].addEventListener('click', function(){ revert(this.getAttribute('data-id')); }); }
    }).catch(function(){});
  }

  function activity(c){
    var t=(c&&c.type)||'';
    if(t.indexOf('tool')===0 && c.toolName){ return '&#128295; '+c.toolName+'...'; }
    if(t.indexOf('reasoning')===0){ return '&#128173; thinking...'; }
    if(t.indexOf('text')===0){ return '&#9997; writing...'; }
    return '';
  }
  function generate(){
    var p=(document.getElementById('rx-prompt').value||'').trim(); if(!p) return;
    var gen=document.getElementById('rx-gen'); gen.disabled=true; setStatus('Agent starting...');
    fetch('/api/remix/agent',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prompt:p,model:curModel()})})
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
              else { setStatus('Done - reloading...'); setTimeout(function(){ location.reload(); },500); }
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
  return OVERLAY_STYLE + OVERLAY_SCRIPT;
}
