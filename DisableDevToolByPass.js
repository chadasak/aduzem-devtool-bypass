// ==UserScript==
// @name         Neutralize DisableDevtool (aduzem)
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
    const blockRE = /disable-devtool|disabledevtool|global\.js|countdown\.js/i;
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
  console.log('Neutralizer active (aduzem). window.__logs içinde tutuluyor.');
  window.__disableNeutralized = true;
})();

//made by chadasak | 19.10.2025 | calanin anasini bacisini sikeyim
