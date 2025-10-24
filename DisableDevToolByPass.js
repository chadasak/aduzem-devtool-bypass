// ==UserScript==
// @name         Neutralize DisableDevtool 
// @match        https://evdekal10.adu.edu.tr/*
// @run-at       document-start
// @grant        none
// ==/UserScript==
(function(){
  'use strict';

  // 1) Sabit global nesneyle disable-devtool davranışını bozar
  try{
    Object.defineProperty(window, 'DisableDevtool', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: { isRunning: false, ondevtoolopen: ()=>{}, ondevtoolclose: ()=>{} }
    });
  }catch(e){ /* ignore */ }

  // 2) Konsol çağrılarını yakala (logları sakla)
  try{
    window.__logs = window.__logs || [];
    ['log','info','warn','error','debug'].forEach(fn=>{
      const orig = console[fn] && console[fn].bind(console);
      console[fn] = function(...args){
        try{ window.__logs.push({type:fn, args:args, ts: Date.now()}); }catch(e){}
        if(orig) orig(...args);
      };
    });
    // console.clear yerine kaydet, gerçek clear'ı sessiz bırakıyoruz
    console.clear = function(){ try{ window.__logs.push({type:'clear', ts: Date.now()}); }catch(e){} };
  }catch(e){ /* ignore */ }

  // 3) DOM'a eklenen scriptleri anında yakalayıp potansiyel disable script'lerini kaldır
  try{
  // broadened: also block scripts that contain video-api endpoints or page identifiers
  const blockRE = /disable-devtool|disabledevtool|global\.js|countdown\.js|videosjapi|ders-videolari|videojsapi/i;
    const mo = new MutationObserver(records=>{
      for(const r of records){
        for(const n of r.addedNodes){
          if(n && n.tagName === 'SCRIPT'){
            try{
              const src = n.src || '';
              const txt = n.textContent || '';
              if(blockRE.test(src + ' ' + txt)) n.remove();
            }catch(e){}
          }
        }
      }
    });
    mo.observe(document.documentElement || document, { childList: true, subtree: true });
  }catch(e){ /* ignore */ }

  // 4) Klavye/contextmenu engelleme fonksiyonlarını saf dışı bırakma denemesi
  try{
    // sayfanın kendi handler'larını tetiklemeden önce engelleyiciyi pasif hale getir
    const origAdd = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options){
      try{
        if(type === 'keydown' || type === 'contextmenu'){
          const s = listener && listener.toString && listener.toString();
          if(s && /DisableDevtool|disable-devtool|preventDefault|return !1/i.test(s)) return;
        }
      }catch(e){}
      return origAdd.call(this, type, listener, options);
    };
  }catch(e){ /* ignore */ }

  // kolay kontrol için konsolda:
  // 5) Ağ ve uyarı tetiklemelerini engelleme: fetch, XHR, sendBeacon, alert/confirm/prompt ve ratechange handler'larını süz
  try{
    const blockedPatterns = [/guvenlik-uyar/i, /guvenlik-uyarisi/i, /disable-devtool/i, /uyar/i, /uyarı/i, /countdown\.js/i, /global\.js/i];

    // fetch wrapper
    const _fetch = window.fetch && window.fetch.bind(window);
    if(_fetch){
      window.fetch = function(input, init){
        try{
          const url = (typeof input === 'string') ? input : (input && input.url) || '';
          if(blockedPatterns.some(re => re.test(url))){
            try{ window.__logs = window.__logs || []; window.__logs.push({type:'fetch-block', url:url, ts:Date.now()}); }catch(e){}
            return Promise.resolve(new Response('', {status:200, statusText:'OK'}));
          }
        }catch(e){}
        return _fetch.apply(this, arguments);
      };
    }

    // XHR wrapper
    (function(){
      const XOP = XMLHttpRequest.prototype.open;
      const XSN = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function(method, url){
        try{ this.__neutralize_url = url; }catch(e){}
        return XOP.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function(body){
        try{
          const url = this.__neutralize_url || '';
          if(blockedPatterns.some(re => re.test(url))){
            try{ window.__logs = window.__logs || []; window.__logs.push({type:'xhr-block', url:url, ts:Date.now()}); }catch(e){}
            // fake success and fire events lightly so site doesn't hang
            this.readyState = 4; this.status = 200; this.responseText = '';
            if(typeof this.onload === 'function') setTimeout(()=>this.onload({target:this}),0);
            if(typeof this.onreadystatechange === 'function') setTimeout(()=>this.onreadystatechange({target:this}),0);
            return;
          }
        }catch(e){}
        return XSN.apply(this, arguments);
      };
    })();

    // sendBeacon wrapper
    if(navigator && navigator.sendBeacon){
      const _sb = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = function(url, data){
        try{
          if(blockedPatterns.some(re => re.test(url))){
            try{ window.__logs = window.__logs || []; window.__logs.push({type:'beacon-block', url:url, ts:Date.now()}); }catch(e){}
            return true; // pretend it worked
          }
        }catch(e){}
        return _sb(url, data);
      };
    }

    // suppress alert/confirm/prompt for warnings (log them instead)
    ['alert','confirm','prompt'].forEach(fn=>{
      try{
        const orig = window[fn] && window[fn].bind(window);
        window[fn] = function(msg){
          try{
            if(typeof msg === 'string' && /uyar|uyarı|alert|warning|devtool|guvenlik/i.test(msg)){
              try{ window.__logs = window.__logs || []; window.__logs.push({type:fn+'-suppressed', msg:msg, ts:Date.now()}); }catch(e){}
              if(fn === 'confirm') return true;
              if(fn === 'prompt') return null;
              return; // silence alert
            }
          }catch(e){}
          return orig ? orig(...arguments) : undefined;
        };
      }catch(e){}
    });

    // block suspicious ratechange listeners (site may attach handlers that watch for high playbackRate)
    try{
      const origAdd = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function(type, listener, options){
        try{
          if(type === 'ratechange'){
            const s = listener && listener.toString && listener.toString();
            if(s && /playbackRate|rate|uyar|uyarı|alert|warning|16x|16\s*×|16\s*x/i.test(s)){
              try{ window.__logs = window.__logs || []; window.__logs.push({type:'ratechange-block', src: (s && s.slice ? s.slice(0,200) : 'fn'), ts:Date.now()}); }catch(e){}
              return; // drop handler
            }
          }
        }catch(e){}
        return origAdd.call(this, type, listener, options);
      };
    }catch(e){}

  }catch(e){ /* ignore */ }

  console.log('Neutralizer active (aduzem). window.__logs içinde tutuluyor.');
  window.__disableNeutralized = true;

  // 6) WebSocket interception: drop connections or mask messages to known endpoints
  try{
    if(window.WebSocket){
      const OrigWebSocket = window.WebSocket;
      function FakeWebSocket(url, protocols){
        try{
          const u = (typeof url === 'string') ? url : '';
          const blocked = /videosjapi|ders-videolari|evdekal09|evdekal10|video/i;
          if(blocked.test(u)){
            // create a minimal fake socket that appears open but does nothing
            const evTarget = document.createElement('div');
            evTarget.readyState = 1; // OPEN
            evTarget.send = function(){ try{ window.__logs = window.__logs || []; window.__logs.push({type:'ws-send-block', url:u, ts:Date.now()}); }catch(e){} };
            evTarget.close = function(){ evTarget.readyState = 3; };
            setTimeout(()=>{ if(typeof evTarget.onopen === 'function') evTarget.onopen({type:'open'}); },0);
            return evTarget;
          }
        }catch(e){}
        // otherwise use real websocket
        return new OrigWebSocket(url, protocols);
      }
      FakeWebSocket.prototype = OrigWebSocket.prototype;
      window.WebSocket = FakeWebSocket;
    }
  }catch(e){ /* ignore */ }
})();

//made by chadasak | 19.10.2025 | calanin anasini bacisini sikeyim
