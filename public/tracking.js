// Alfred Web Design tracking snippet
// Usage: include <script src="/tracking.js"></script> on every page
(function(){
  window.AWD_TRACKING = window.AWD_TRACKING || {};
  AWD_TRACKING.siteId = 'CLIENT_TRACKING_ID'; // replace per-site in your deploy env
  AWD_TRACKING.send = async function(payload){
    try {
      await fetch('/api/track', { method: 'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload) });
    } catch(e){ console.error(e); }
  };
  // Capture form submissions automatically if form has data-awd="true"
  document.addEventListener('submit', function(e){
    const f = e.target;
    if (f && f.getAttribute && f.getAttribute('data-awd') === 'true') {
      const fd = new FormData(f);
      const obj = {};
      for (const [k,v] of fd.entries()) obj[k]=v;
      obj.page = location.pathname;
      obj.trackingId = AWD_TRACKING.siteId;
      AWD_TRACKING.send({type:'form', payload: obj});
      // Also send to contact endpoint
      fetch('/api/contact', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(obj) }).catch(()=>{});
    }
  }, true);
})();
