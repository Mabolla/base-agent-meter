export function renderHomePage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Base Agent Meter</title>
  <style>
    :root{color-scheme:dark;--bg:#0a0b0d;--panel:#121419;--line:#2a2e36;--text:#f5f7fa;--muted:#9da5b4;--blue:#3978ff;--green:#37c87a;--yellow:#e7b84b;--red:#f16d6d}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 ui-sans-serif,system-ui,sans-serif;letter-spacing:0}header{border-bottom:1px solid var(--line);padding:22px max(20px,calc((100% - 1040px)/2))}header strong{font-size:20px}header span{color:var(--muted);margin-left:12px}main{max-width:1040px;margin:0 auto;padding:44px 20px 80px}.intro{max-width:760px;margin-bottom:36px}h1{font-size:42px;line-height:1.08;margin:0 0 14px;letter-spacing:0}.intro p{color:var(--muted);font-size:18px;margin:0}.workspace{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,.85fr);gap:24px;border-top:1px solid var(--line);padding-top:28px}h2{font-size:18px;margin:0 0 18px}label{display:block;color:var(--muted);font-size:13px;margin:14px 0 6px}input,select,textarea{width:100%;border:1px solid var(--line);background:#0d0f13;color:var(--text);padding:11px 12px;border-radius:6px;font:inherit}textarea{min-height:92px;resize:vertical}.row{display:grid;grid-template-columns:120px 1fr;gap:12px}button{margin-top:18px;border:0;border-radius:6px;background:var(--blue);color:white;font-weight:700;padding:12px 16px;cursor:pointer}button:disabled{opacity:.55;cursor:wait}.result{border-left:1px solid var(--line);padding-left:24px;min-width:0}.status{font-size:28px;font-weight:800;margin-bottom:12px}.PASS{color:var(--green)}.WARN{color:var(--yellow)}.FAIL{color:var(--red)}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:14px;min-height:260px;color:#d9deea;margin:0}footer{max-width:1040px;margin:0 auto;padding:20px;border-top:1px solid var(--line);color:var(--muted)}code{color:#c6d4ff}@media(max-width:760px){h1{font-size:34px}.workspace{grid-template-columns:1fr}.result{border-left:0;border-top:1px solid var(--line);padding:24px 0 0}.row{grid-template-columns:1fr}header span{display:block;margin:3px 0 0}}
  </style>
</head>
<body>
  <header><strong>Base Agent Meter</strong><span>x402 Production Assurance</span></header>
  <main>
    <section class="intro"><h1>Verify the complete x402 production path.</h1><p>Check negotiation, Base USDC payment terms, discovery metadata, configuration drift, and declared builder attribution before running a paid canary.</p></section>
    <section class="workspace">
      <form id="check-form">
        <h2>Pre-deploy check</h2>
        <label for="url">Protected endpoint</label><input id="url" name="url" type="url" required placeholder="https://api.example.com/paid-resource">
        <div class="row"><div><label for="method">Method</label><select id="method" name="method"><option>GET</option><option>POST</option></select></div><div><label for="payTo">Expected payTo</label><input id="payTo" name="payTo" placeholder="Optional 0x address"></div></div>
        <label for="amount">Expected amount in USDC atomic units</label><input id="amount" name="amount" placeholder="Optional, for example 1000">
        <label for="body">POST body</label><textarea id="body" name="body" placeholder="{}"></textarea>
        <button id="submit" type="submit">Run assurance check</button>
      </form>
      <div class="result"><h2>Result</h2><div id="status" class="status">Not checked</div><pre id="output">Submit a public x402 endpoint to inspect its unpaid negotiation path.</pre></div>
    </section>
  </main>
  <footer>CI API: <code>POST /api/check</code> · Health: <code>GET /health</code> · No payment is made by this check.</footer>
  <script>
    const form=document.getElementById('check-form'),button=document.getElementById('submit'),status=document.getElementById('status'),output=document.getElementById('output');
    form.addEventListener('submit',async event=>{event.preventDefault();button.disabled=true;status.className='status';status.textContent='Checking';output.textContent='Negotiating with endpoint...';try{const method=form.method.value;let body;if(method==='POST'&&form.body.value.trim()){body=JSON.parse(form.body.value)}const expectations={network:'eip155:8453',asset:'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'};if(form.payTo.value.trim())expectations.payTo=form.payTo.value.trim();if(form.amount.value.trim())expectations.amount=form.amount.value.trim();const response=await fetch('/api/check',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:form.url.value,method,body,expectations})});const report=await response.json();status.textContent=report.status||'ERROR';status.className='status '+(report.status||'FAIL');output.textContent=JSON.stringify(report,null,2)}catch(error){status.textContent='FAIL';status.className='status FAIL';output.textContent=error.message}finally{button.disabled=false}});
  </script>
</body></html>`;
}
