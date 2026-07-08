// The floating "remix" widget, baked into every page via the Astro Layout
// (and re-appended serve-time on fork-served pages — see serving.ts).
// Styled to match the site: white/#111010 surfaces, neutral grays, Kaisei
// Tokumin serif headings, dark mode via prefers-color-scheme.
//
// The widget mounts inside a Shadow DOM root with its own stylesheet, so remix
// theme CSS (which targets the page) cannot restyle it.
//
// The flow happens in place: sign in with ChatGPT, describe a change, and watch
// GPT-5.5 edit the workspace with live hot reload. Every restyle runs on the
// visitor's own ChatGPT plan; tokens stay in the fork's Durable Object.

import { HOTRELOAD_JS } from "./hotreload";

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
#remix-panel .code{font-size:22px;font-weight:700;font-family:ui-monospace,monospace;letter-spacing:.08em;margin:6px 0}
.rx-commit{border:1px solid #e5e5e5;border-radius:8px;padding:8px 10px;margin:6px 0}
.rx-commit .rx-msg{font-size:13px;margin-bottom:4px}
.rx-commit .rx-row{display:flex;align-items:center;gap:8px}
.rx-commit code{color:#737373;font-size:12px;flex:1;font-family:ui-monospace,monospace}
.rx-revert{background:transparent;color:#525252;border:1px solid #d4d4d4;border-radius:6px;
padding:3px 10px;font-size:12px;cursor:pointer;font-family:inherit}
.rx-revert:hover{border-color:#737373;color:#171717}
.prov{margin-top:10px;width:100%;padding:9px 12px;border:1px solid #d4d4d4;border-radius:8px;
background:#fff;color:#1f1f1f;font-weight:500;font-size:14px;cursor:pointer;font-family:inherit;
display:flex;align-items:center;justify-content:center;gap:10px;transition:border-color .15s,background .15s}
.prov:hover{border-color:#a3a3a3;background:#fafafa}
.prov svg{flex:none}
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
.prov{background:#131314;border-color:#333;color:#e3e3e3}
.prov:hover{border-color:#525252;background:#1a1a1b}
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

  var GPT_ICON='<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/></svg>';

__RX_HOT__

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
  fab.onclick=function(){ open=!open; panel.style.display=open?'block':'none'; if(open){ render(); } else { stopDevicePoll(); } };
  function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
  function setStatus(t,err){ var e=$('rx-status'); if(e){ e.textContent=t||''; e.style.color=err?'#dc2626':''; } }

  var devTimer=null;
  function stopDevicePoll(){ if(devTimer){ clearInterval(devTimer); devTimer=null; } }

  // ── top-level render: sign in first, then the remix UI ────────────────
  function render(){
    stopDevicePoll();
    if(!forked()){ showSignin(true); return; }
    panel.innerHTML='<h3>Customize with AI</h3><p class="muted">Loading...</p>';
    fetch('/api/remix/state').then(function(r){return r.json();}).then(function(s){
      if(s&&s.auth&&s.auth.signedIn){ showRemix(s); } else { showSignin(false); }
    }).catch(function(){ showSignin(false); });
  }

  // ── sign in with ChatGPT (device-code flow) ───────────────────────────
  function showSignin(first){
    panel.innerHTML='<h3>Remix this site</h3>'
      +'<p class="muted">Restyle mattzcarey.com with GPT-5.5 on your own ChatGPT account. Only you see your version.</p>'
      +'<div id="rx-signin"></div>'
      +'<p class="muted" style="font-size:12px;margin-top:10px">You approve access on OpenAI\\'s site. Usage is billed to your ChatGPT plan; nothing is stored in your browser.</p>';
    renderSigninButton();
  }
  function renderSigninButton(){
    var el=$('rx-signin'); if(!el) return;
    el.innerHTML='<button class="prov" id="rx-gpt">'+GPT_ICON+'<span>Sign in with ChatGPT</span></button>';
    $('rx-gpt').onclick=startChatgpt;
  }

  function startChatgpt(){
    if(!forked()) setCookie(forkId());
    var el=$('rx-signin'); if(!el) return;
    el.innerHTML='<p class="muted">Starting ChatGPT sign-in...</p>';
    fetch('/api/remix/auth/start',{method:'POST'}).then(function(r){return r.json();}).then(function(d){
      if(!d||!d.userCode){ el.innerHTML='<p class="muted" style="color:#dc2626">'+esc((d&&d.error)||'Could not start sign-in.')+'</p>'; renderSigninButton(); return; }
      el.innerHTML='<div class="muted">Enter this code at <a href="'+esc(d.verifyUrl)+'" target="_blank" rel="noopener">auth.openai.com/codex/device</a>:</div>'
        +'<div class="code">'+esc(d.userCode)+'</div>'
        +'<div class="muted" style="font-size:12px">Requires "device code login" enabled in ChatGPT Settings &rarr; Security.</div>'
        +'<div class="muted" id="rx-dev-status" style="margin-top:6px">Waiting for approval...</div>';
      var every=Math.max(3,Number(d.interval)||5)*1000;
      stopDevicePoll();
      devTimer=setInterval(function(){
        fetch('/api/remix/auth/poll',{method:'POST'}).then(function(r){return r.json();}).then(function(res){
          if(!res) return;
          if(res.status==='authorized'){ stopDevicePoll(); render(); return; }
          if(res.status==='pending') return;
          stopDevicePoll();
          var ds=$('rx-dev-status');
          if(ds){ ds.textContent=(res.error)||'Sign-in failed — try again.'; ds.style.color='#dc2626'; }
          renderRetry();
        }).catch(function(){});
      },every);
    }).catch(function(){ el.innerHTML='<p class="muted" style="color:#dc2626">Could not start sign-in.</p>'; renderSigninButton(); });
  }
  function renderRetry(){
    var el=$('rx-signin'); if(!el) return;
    var btn=document.createElement('button'); btn.className='prov'; btn.innerHTML=GPT_ICON+'<span>Try again</span>';
    btn.onclick=startChatgpt; el.appendChild(btn);
  }

  function signOut(){
    stopDevicePoll();
    fetch('/api/remix/auth/signout',{method:'POST'}).then(function(){ render(); }).catch(function(){ render(); });
  }

  // ── the remix UI (signed in) ──────────────────────────────────────────
  function showRemix(s){
    var label=(s&&s.auth&&s.auth.label)||'ChatGPT';
    panel.innerHTML='<h3>Customize with AI</h3>'
      +'<div class="muted" style="margin:2px 0 10px">Signed in as '+esc(label)+' &middot; <a href="#" id="rx-signout" style="font-size:12px">sign out</a></div>'
      +'<textarea id="rx-prompt" placeholder="Describe a look... e.g. retro pixel terminal, brutalist newspaper, soft pastel zine"></textarea>'
      +'<button class="act" id="rx-gen">Restyle this site</button>'
      +'<div id="rx-status" class="muted" style="margin-top:8px"></div>'
      +'<h4>History</h4><div id="rx-log" class="muted">Loading...</div>'
      +'<div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(115,115,115,.25);text-align:right">'
      +'<a href="#" id="rx-reset" style="font-size:12px">Discard remix</a></div>';
    $('rx-signout').onclick=function(e){ e.preventDefault(); signOut(); };
    $('rx-gen').onclick=generate;
    $('rx-reset').onclick=function(e){ e.preventDefault(); reset(); };
    renderLog((s&&s.versions)||[]);
  }

  function loadLog(){
    fetch('/api/remix/state').then(function(r){return r.json();}).then(function(s){
      if(!(s&&s.auth&&s.auth.signedIn)){ render(); return; }
      renderLog((s&&s.versions)||[]);
    }).catch(function(){});
  }
  function renderLog(log){
    var el=$('rx-log'); if(!el) return;
    el.innerHTML = log.map(function(c){
      return '<div class="rx-commit"><div class="rx-msg">'+esc(c.message)+'</div>'
        +'<div class="rx-row"><code>'+esc(c.short)+'</code>'
        +(c.current?'<span class="muted">current</span>':'<button class="rx-revert" data-id="'+esc(c.id)+'">Revert</button>')+'</div></div>';
    }).join('') || '<span class="muted">No versions yet. Describe a look above.</span>';
    var b=panel.querySelectorAll('.rx-revert');
    for(var i=0;i<b.length;i++){ b[i].addEventListener('click', function(){ revert(this.getAttribute('data-id')); }); }
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
    rxBeginTurn();
    fetch('/api/remix/agent',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prompt:p,route:location.pathname})})
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
            if(msg.kind==='status'){ setStatus(msg.text); console.log('[remix]',msg.text); }
            else if(msg.kind==='event'){
              var c; try{c=JSON.parse(msg.chunk);}catch(e){continue;}
              if(c.type==='tool-input-available'){ console.log('[remix] tool call:',c.toolName,c.input); }
              else if(c.type==='tool-output-available'){ console.log('[remix] tool result:',c.output); }
              else if(c.type==='tool-output-error'){ console.log('[remix] tool error:',c.errorText); }
              else { console.debug('[remix:event]',c.type,c); }
              var a=activity(c); if(a) setStatus(a);
            }
            else if(msg.kind==='css'||msg.kind==='page'||msg.kind==='file'){
              console.log('[remix]',msg.kind,msg.path||'',msg.change||'',msg.kind==='css'?(String(msg.css||'').length+' bytes'):'');
              rxHandleHot(msg);
              if(msg.kind==='file'){ setStatus((msg.change==='delete'?'deleting ':'writing ')+String(msg.path||'').replace('/site/','')+'...'); }
              else if(msg.kind==='css'){ setStatus('restyling theme.css...'); }
            }
            else if(msg.kind==='done'){
              console.log('[remix] done',msg.error?('error: '+msg.error):('ok, version '+((msg.version&&msg.version.short)||'')));
              if(msg.error){ rxFinishTurn(false); setStatus(msg.error,true); if(msg.auth==='expired'){ render(); } }
              else { rxFinishTurn(true); setStatus('Applied — this is your remix now.'); $('rx-prompt').value=''; loadLog(); }
              gen.disabled=false;
            }
          }
          return pump();
        }); }
        return pump();
      }).catch(function(e){ rxFinishTurn(false); setStatus(String(e),true); gen.disabled=false; });
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
    fetch('/api/remix/reset',{method:'POST'}).then(function(r){return r.json();}).then(function(s){
      if(s&&s.error){ setStatus(s.error,true); return; }
      try{localStorage.removeItem(COOKIE);}catch(e){} clearCookie(); location.reload();
    }).catch(function(e){ setStatus(String(e),true); });
  }
})();
</script>`;

export function appOverlay(): string {
  return OVERLAY_SCRIPT.replace("__RX_CSS__", JSON.stringify(WIDGET_CSS)).replace(
    "__RX_HOT__",
    HOTRELOAD_JS,
  );
}
