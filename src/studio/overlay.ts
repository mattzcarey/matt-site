// The floating "remix" widget, baked into every page via the Astro Layout
// (and re-appended serve-time on fork-served pages — see serving.ts).
// Styled to match the site: white/#111010 surfaces, neutral grays, Kaisei
// Tokumin serif headings, dark mode via prefers-color-scheme.
//
// The widget mounts inside a Shadow DOM root with its own stylesheet, so remix
// theme CSS (which targets the page) cannot restyle it.
//
// The whole flow happens in place on whatever page you're on: start a remix,
// pick a model (sign in with ChatGPT / Cloudflare, or the free one), describe
// a change, and watch the page restyle live as the agent writes — hot reload,
// no page load (hotreload.ts is spliced into this IIFE).

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
.rx-commit{border:1px solid #e5e5e5;border-radius:8px;padding:8px 10px;margin:6px 0}
.rx-commit .rx-msg{font-size:13px;margin-bottom:4px}
.rx-commit .rx-row{display:flex;align-items:center;gap:8px}
.rx-commit code{color:#737373;font-size:12px;flex:1;font-family:ui-monospace,monospace}
.rx-revert{background:transparent;color:#525252;border:1px solid #d4d4d4;border-radius:6px;
padding:3px 10px;font-size:12px;cursor:pointer;font-family:inherit}
.rx-revert:hover{border-color:#737373;color:#171717}
.prov{margin-top:8px;width:100%;padding:9px 12px;border:1px solid #d4d4d4;border-radius:8px;
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
  var CF_ICON='<svg width="18" height="18" viewBox="0 0 24 24" fill="#F38020" aria-hidden="true"><path d="M16.5088 16.8447c.1475-.5068.0908-.9707-.1553-1.3154-.2246-.3164-.6045-.499-1.0615-.5205l-8.6592-.1123a.1559.1559 0 0 1-.1333-.0713c-.0283-.042-.0351-.0986-.021-.1553.0278-.084.1123-.1484.2036-.1562l8.7359-.1123c1.0351-.0489 2.1601-.8868 2.5537-1.9136l.499-1.3013c.0215-.0561.0293-.1128.0147-.168-.5625-2.5463-2.835-4.4453-5.5499-4.4453-2.5039 0-4.6284 1.6177-5.3876 3.8614-.4927-.3658-1.1187-.5625-1.794-.499-1.2026.119-2.1665 1.083-2.2861 2.2856-.0283.31-.0069.6128.0635.894C1.5683 13.171 0 14.7754 0 16.752c0 .1748.0142.3515.0352.5273.0141.083.0844.1475.1689.1475h15.9814c.0909 0 .1758-.0645.2032-.1553l.12-.4268zm2.7568-5.5634c-.0771 0-.1611 0-.2383.0112-.0566 0-.1054.0415-.127.0976l-.3378 1.1744c-.1475.5068-.0918.9707.1543 1.3164.2256.3164.6055.498 1.0625.5195l1.8437.1133c.0557 0 .1055.0263.1329.0703.0283.043.0351.1074.0214.1562-.0283.084-.1132.1485-.204.1553l-1.921.1123c-1.041.0488-2.1582.8867-2.5527 1.914l-.1406.3585c-.0283.0713.0215.1416.0986.1416h6.5977c.0771 0 .1474-.0489.169-.126.1122-.4082.1757-.837.1757-1.2803 0-2.6025-2.125-4.727-4.7344-4.727"/></svg>';

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
  fab.onclick=function(){ open=!open; panel.style.display=open?'block':'none'; if(open) render(); else stopDevicePoll(); };
  function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
  function setStatus(t,err){ var e=$('rx-status'); if(e){ e.textContent=t||''; e.style.color=err?'#dc2626':''; } }

  // Two mutually exclusive screens: pick a model, or customize. The customize
  // screen is only reachable with a model chosen (signed in, or explicit free).
  function render(){
    if(!forked()){ renderChoice(); return; }
    renderCustomize();
  }

  function renderChoice(){
    panel.innerHTML='<h3>Remix this site</h3>'
      +'<p class="muted">Restyle it with AI. Only you see your version. Pick a model to start:</p>'
      +'<button class="prov" id="rx-start-gpt" style="margin-top:2px">'+GPT_ICON+'<span>Sign in with ChatGPT</span></button>'
      +'<button class="prov" id="rx-start-cf">'+CF_ICON+'<span>Sign in with Cloudflare</span></button>'
      +'<div style="text-align:center;margin-top:10px"><a href="#" id="rx-start-free" class="muted" style="font-size:12px">use free model</a></div>'
      +'<div id="rx-auth" style="margin-top:10px"></div>';
    $('rx-start-gpt').onclick=function(){ setCookie(forkId()); startChatgpt(); };
    $('rx-start-cf').onclick=function(){ setCookie(forkId()); location.href='/oauth/cloudflare?return_to='+encodeURIComponent(location.pathname); };
    $('rx-start-free').onclick=function(e){ e.preventDefault(); setCookie(forkId()); setFree(true); renderCustomize(); };
  }

  function renderCustomize(){
    panel.innerHTML='<h3>Customize with AI</h3>'
      +'<div id="rx-auth" style="margin:6px 0 10px"></div>'
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

  // ── model auth (sign in with ChatGPT / Cloudflare, or the free model) ──
  var FREE_KEY='remix_free';
  var devTimer=null;
  function stopDevicePoll(){ if(devTimer){ clearInterval(devTimer); devTimer=null; } }
  function freeChosen(){ try{ return localStorage.getItem(FREE_KEY)==='1'; }catch(e){ return false; } }
  function setFree(v){ try{ if(v){ localStorage.setItem(FREE_KEY,'1'); } else { localStorage.removeItem(FREE_KEY); } }catch(e){} }

  function renderAuth(a){
    var el=$('rx-auth'); if(!el) return;
    if(devTimer) return; // a device-code sign-in owns the slot until it resolves
    if(a&&a.provider&&!a.expired){
      var line=a.provider==='chatgpt'?'Using ChatGPT ('+esc(a.label||'')+')':'Using Workers AI on '+esc(a.label||'');
      el.innerHTML='<span class="muted" style="font-size:13px">'+line+'</span> &middot; <a href="#" id="rx-signout" style="font-size:12px">sign out</a>';
      $('rx-signout').onclick=function(e){ e.preventDefault(); signOut(); };
      return;
    }
    if(freeChosen()){
      el.innerHTML='<span class="muted" style="font-size:13px">Using the free model.</span> <a href="#" id="rx-switch" style="font-size:12px">switch model</a>';
      $('rx-switch').onclick=function(e){ e.preventDefault(); setFree(false); renderChoice(); };
      return;
    }
    // No model chosen (or session expired): the customize screen is not a
    // valid place to be — back to the choice screen.
    renderChoice();
    if(a&&a.expired){
      var slot=$('rx-auth');
      if(slot){ slot.innerHTML='<div class="muted" style="font-size:12px;text-align:center">Session expired — sign in again.</div>'; }
    }
  }

  function startChatgpt(){
    var el=$('rx-auth'); if(!el) return;
    el.innerHTML='<span class="muted">Starting ChatGPT sign-in...</span>';
    fetch('/auth/chatgpt',{method:'POST'}).then(function(r){return r.json();}).then(function(d){
      if(!d||!d.user_code){ el.innerHTML='<span class="muted" style="color:#dc2626">'+esc((d&&d.error)||'Could not start sign-in.')+'</span>'; return; }
      el.innerHTML='<div class="muted" style="font-size:13px">Enter this code at <a href="'+d.verify_url+'" target="_blank" rel="noopener">auth.openai.com/codex/device</a>:</div>'
        +'<div style="font-size:22px;font-weight:700;font-family:ui-monospace,monospace;letter-spacing:.08em;margin:6px 0">'+esc(d.user_code)+'</div>'
        +'<div class="muted" style="font-size:12px">Requires "device code login" enabled in ChatGPT Settings &rarr; Security.</div>'
        +'<div class="muted" id="rx-dev-status" style="font-size:12px;margin-top:6px">Waiting for approval...</div>';
      var every=Math.max(3,Number(d.interval)||5)*1000;
      devTimer=setInterval(function(){
        fetch('/auth/chatgpt/callback',{method:'POST'}).then(function(r){
          return r.json().then(function(j){ return { status:r.status, body:j }; });
        }).then(function(res){
          if(res.body&&res.body.ok){ stopDevicePoll(); setFree(false); renderCustomize(); return; }
          if(res.status===429||(res.body&&res.body.pending)) return;
          stopDevicePoll();
          var ds=$('rx-dev-status');
          if(ds){ ds.textContent=(res.body&&res.body.error)||'Sign-in failed - try again.'; ds.style.color='#dc2626'; }
        }).catch(function(){});
      },every);
    }).catch(function(){ el.innerHTML='<span class="muted" style="color:#dc2626">Could not start sign-in.</span>'; });
  }

  function signOut(){
    fetch('/auth/logout',{method:'POST'}).then(function(){ setFree(false); loadLog(); }).catch(function(){});
  }

  function loadLog(){
    fetch('/api/remix/state').then(function(r){return r.json();}).then(function(s){
      renderAuth((s&&s.auth)||null);
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
    rxBeginTurn();
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
              if(msg.error){ rxFinishTurn(false); setStatus(msg.error,true); if(msg.auth==='expired'){ loadLog(); } }
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
      try{localStorage.removeItem(COOKIE);localStorage.removeItem(FREE_KEY);}catch(e){} clearCookie(); location.reload();
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
