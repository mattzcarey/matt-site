// Client-side hot reload, spliced into the overlay widget's IIFE (shared
// scope: it may call the overlay's function declarations and vice versa).
//
// Applies each artifact live as the agent writes it:
//   css  -> swap #remix-theme textContent (Vite's CSS-HMR move: instant
//           repaint, cascade order preserved, no fetch)
//   page -> fetch the workspace preview and MORPH the live DOM (a small
//           idiomorph-lite; a naive innerHTML swap would kill every listener
//           bound by Astro's inline scripts, lose focus/scroll, and flash)
//   js   -> dispose + cache-busted dynamic import of fork.js
//
// The morph hard-ignores #remix-widget (host, shadow root, listeners),
// #remix-theme, and ALL script elements (never re-execute inline scripts).
// Preview accumulates during the turn; commit keeps it; error/timeout rolls
// back (cached CSS restored, reload if the DOM was morphed or JS ran).

export const HOTRELOAD_JS = `
  var rxTurn=null, rxJsExecuted=false, rxBC=null;
  try{ rxBC=new BroadcastChannel('remix'); }catch(e){}
  if(rxBC){ rxBC.onmessage=function(ev){
    var d=ev.data||{};
    if(d.type!=='commit'||rxTurn) return;
    if(d.js||(d.html&&d.html.indexOf(rxCurrentRoute())>-1)){ location.reload(); return; }
    if(d.css){ fetch('/api/remix/preview/theme').then(function(r){return r.text();}).then(rxApplyCss).catch(function(){}); }
  }; }

  function rxThemeEl(create){
    var el=document.getElementById('remix-theme');
    if(!el&&create){ el=document.createElement('style'); el.id='remix-theme'; document.head.appendChild(el); }
    return el;
  }
  function rxApplyCss(css){
    var el=rxThemeEl(true);
    if(el.textContent!==css) el.textContent=css;
  }
  function rxCurrentRoute(){
    var p=location.pathname;
    if(p.slice(-5)!=='.html'){ if(p.slice(-1)!=='/') p+='/'; p+='index.html'; }
    return p;
  }

  // ---- idiomorph-lite ------------------------------------------------
  function rxIgnored(n){
    return n.nodeType===1&&(n.id==='remix-widget'||n.id==='remix-theme'||n.nodeName==='SCRIPT');
  }
  function rxKey(n){
    return n.nodeType+':'+n.nodeName+':'+(n.nodeType===1?(n.id||''):'');
  }
  function rxStrip(n){
    var c=document.importNode(n,true);
    if(c.nodeType===1){
      if(rxIgnored(c)) return null;
      var bad=c.querySelectorAll('script,#remix-widget,#remix-theme');
      for(var i=0;i<bad.length;i++){ if(bad[i].parentNode) bad[i].parentNode.removeChild(bad[i]); }
    }
    return c;
  }
  function rxSyncAttrs(from,to){
    var i,a;
    for(i=to.attributes.length-1;i>=0;i--){ a=to.attributes[i]; if(from.getAttribute(a.name)!==a.value) from.setAttribute(a.name,a.value); }
    for(i=from.attributes.length-1;i>=0;i--){ a=from.attributes[i]; if(!to.hasAttribute(a.name)) from.removeAttribute(a.name); }
  }
  function rxMorphNode(from,to){
    if(from.nodeType===3||from.nodeType===8){ if(from.nodeValue!==to.nodeValue) from.nodeValue=to.nodeValue; return; }
    if(from.nodeType!==1) return;
    rxSyncAttrs(from,to);
    rxMorphChildren(from,to);
  }
  function rxMorphChildren(from,to){
    var f=from.firstChild, t=to.firstChild, m, c, next;
    while(t){
      if(rxIgnored(t)){ t=t.nextSibling; continue; }
      while(f&&rxIgnored(f)) f=f.nextSibling;
      if(f&&rxKey(f)===rxKey(t)){ rxMorphNode(f,t); f=f.nextSibling; }
      else{
        m=f?f.nextSibling:null;
        while(m&&(rxIgnored(m)||rxKey(m)!==rxKey(t))) m=m.nextSibling;
        if(m){ from.insertBefore(m,f); rxMorphNode(m,t); }
        else{ c=rxStrip(t); if(c) from.insertBefore(c,f); }
      }
      t=t.nextSibling;
    }
    while(f){ next=f.nextSibling; if(!rxIgnored(f)) from.removeChild(f); f=next; }
  }
  function rxMorphPage(html){
    try{
      var doc=new DOMParser().parseFromString(html,'text/html');
      if(doc.title) document.title=doc.title;
      rxMorphNode(document.body,doc.body);
    }catch(e){ location.reload(); }
  }

  // ---- turn lifecycle ------------------------------------------------
  function rxBeginTurn(){
    var el=rxThemeEl(false);
    rxTurn={preCss:el?el.textContent:'',css:false,morph:false,js:false,cssSeq:0,routes:[],pageWant:0,pageDone:0,pageBusy:false,pageRoute:''};
    return rxTurn;
  }
  function rxHandleHot(msg){
    if(!rxTurn) return;
    if(msg.kind==='css'&&typeof msg.css==='string'){
      if(msg.seq>rxTurn.cssSeq){ rxTurn.cssSeq=msg.seq; rxTurn.css=true; rxApplyCss(msg.css); }
    }else if(msg.kind==='page'&&msg.route){
      if(rxTurn.routes.indexOf(msg.route)<0) rxTurn.routes.push(msg.route);
      if(msg.route===rxCurrentRoute()&&msg.seq>rxTurn.pageWant){ rxTurn.pageWant=msg.seq; rxTurn.pageRoute=msg.route; rxPagePump(); }
    }else if(msg.kind==='file'&&msg.artifact==='js'&&msg.change!=='delete'){
      rxApplyJs(msg.seq);
    }
  }
  // Notify+fetch with seq coalescing: fetch the latest state once, drop stale.
  function rxPagePump(){
    var t=rxTurn;
    if(!t||t.pageBusy||t.pageWant<=t.pageDone) return;
    t.pageBusy=true;
    var want=t.pageWant;
    fetch('/api/remix/preview/page?route='+encodeURIComponent(t.pageRoute))
      .then(function(r){ return r.ok?r.text():null; })
      .then(function(html){
        t.pageBusy=false; t.pageDone=want;
        if(html!==null&&rxTurn===t){ t.morph=true; rxMorphPage(html); }
        rxPagePump();
      })
      .catch(function(){ t.pageBusy=false; });
  }
  // Modules can't be unloaded: once preview JS has run without a dispose
  // hook, the tab is tainted — skip re-execution and apply on reload instead.
  function rxApplyJs(v){
    if(!rxTurn) return;
    rxTurn.js=true;
    if(rxJsExecuted&&!(window.__remixApp&&window.__remixApp.dispose)) return;
    try{ if(window.__remixApp&&window.__remixApp.dispose) window.__remixApp.dispose(); }catch(e){}
    rxJsExecuted=true;
    import('/remix-assets/fork.js?v=live-'+v).catch(function(){});
  }
  function rxFinishTurn(ok){
    var t=rxTurn; rxTurn=null;
    if(!t) return;
    if(ok){
      if(rxBC){ try{ rxBC.postMessage({type:'commit',css:t.css,html:t.routes,js:t.js}); }catch(e){} }
      return;
    }
    if(t.css) rxApplyCss(t.preCss);
    if(t.morph||t.js) location.reload();
  }
`;
