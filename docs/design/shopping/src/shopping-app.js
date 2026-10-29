/* Shopping page shell: toolbar, status hero, KPI tiles, section router and the
   Overview / Receipts / Review / Diagnostics sections. Prototype: no network, no stock writes. */
(function(){
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TABS=[['overview','Overview','grid'],['products','Products','link'],['receipts','Receipts','receipt'],['review','Review','warning'],['diagnostics','Diagnostics','clock']];
const STORE='gms-shopping-demo-v1';

let state=null,stateId='busy',active='overview';
let refreshing=false,autoIn=30,fetchIn=0;
let receiptLoading=false,receiptRetailer='all',receiptCount='5';
let groups={projection:true,lines:true,disc:true,writes:true},projectionOpen=false;
let subOpen=null,subFulfilOnly=false;

const plugin=id=>state.plugins.find(p=>p.id===id)||{short:'?',name:id};
const logo=id=>`<span class="shop-logo" aria-hidden="true">${esc(plugin(id).short)}</span>`;
const plug=id=>`<span class="plug">${logo(id)}<span class="plug-name">${esc(plugin(id).name)}</span></span>`;
const attentionCount=()=>state.projection.length+state.reviewLines.length+state.discrepancies.length+state.writes.length+state.paused.length;
const mmss=s=>`${Math.floor(Math.max(s,0)/60)}:${String(Math.max(s,0)%60).padStart(2,'0')}`;

/* ---------- frame ---------- */
function renderToolbar(){
 const n=attentionCount(),none=!state.plugins.length;
 $('toolbar').innerHTML=none?`<span class="chip-hint">Plugins are added under Settings → Shop plugins.</span>`:`
  <button class="attention ${n?'':'calm'}" onclick="shopApp.go('review')" data-od-id="attention-badge">${ui.icon(n?'warning':'check')}${n?`<strong>${n}</strong> ${n===1?'item needs':'items need'} attention`:'Nothing needs attention'}</button>
  <div class="refresh" data-od-id="refresh-control">
   <div class="refresh-meta"><span>${refreshing?'Refreshing…':'Auto-refresh on'}</span><span id="auto-in">every 30s · next in ${autoIn}s</span></div>
   <button class="icon-button" onclick="shopApp.refresh()" aria-label="Refresh shopping data now" ${refreshing?'disabled':''} data-od-id="refresh-now">${refreshing?'<span class="spinner"></span>':ui.icon('swap')}</button>
  </div>
  <button class="button primary" onclick="shopApp.sync()" data-od-id="sync-lists-now">${ui.icon('cart')} Sync lists now</button>`;
 $('plugin-chips').innerHTML=none?'':state.plugins.map(p=>`<span class="chip ${p.connected?'':'down'}" data-od-id="chip-${p.id}">${logo(p.id)}${esc(p.name)}<span class="chip-state"><span class="dot"></span>${p.connected?'connected':'offline'}</span></span>`).join('')+`<span class="chip-hint">${state.plugins.length} plugin${state.plugins.length===1?'':'s'} installed</span>`;
}
function renderHero(){
 const sent=state.sharedList.length,blocked=state.projection.length,total=sent+blocked;
 const percent=total?Math.round(sent/total*100):100,n=attentionCount();
 $('hero').className='hero'+(n?' needs':'');
 $('hero').innerHTML=`<div class="hero-main"><div class="hero-ring">${ui.ring(percent)}<span>${percent}%</span></div>
  <div class="hero-copy"><h2 data-od-id="hero-headline">${n?`${n} ${n===1?'item needs':'items need'} your decision`:'Everything is in sync'}</h2>
  <p>${n?`${sent} of ${total} shopping rows reached a retailer list. The rest are listed below with the reason they were held back — fix the mapping or unit and the next sync retries automatically.`:'Every shopping row reached its retailer list, every receipt line is settled and no write is waiting for a decision.'}</p></div></div>
  <div class="kpis" data-od-id="kpi-tiles">
  ${kpi('On the shared list',sent,'packages exported','overview','good')}
  ${kpi('Not sent to retailer',blocked,'rows held back','review',blocked?'warn':'')}
  ${kpi('Receipt lines to review',state.reviewLines.length,'nothing booked yet','review',state.reviewLines.length?'warn':'')}
  ${kpi('Stock discrepancies',state.discrepancies.length,'receipt vs. manual check','review',state.discrepancies.length?'bad':'')}
  ${kpi('Writes to decide',state.writes.length,'never retried on their own','review',state.writes.length?'warn':'')}
  </div>`;
}
const kpi=(label,value,foot,tab,tone)=>`<button class="kpi" onclick="shopApp.go('${tab}')" data-od-id="kpi-${label.toLowerCase().replace(/[^a-z]+/g,'-')}"><span class="kpi-label">${label}</span><span class="kpi-value ${tone}">${value}</span><span class="kpi-foot">${foot}</span></button>`;

function renderTabs(){
 const n=attentionCount();
 $('sectabs').innerHTML=TABS.map(([id,label,icon])=>`<button class="sectab" id="tab-${id}" role="tab" aria-selected="${active===id}" aria-controls="panel-${id}" onclick="shopApp.go('${id}')" data-od-id="tab-${id}">${ui.icon(icon)}${label}${id==='review'&&n?`<span class="count alert">${n}</span>`:''}</button>`).join('');
 TABS.forEach(([id])=>{$('panel-'+id).hidden=id!==active});
}

/* ---------- Overview ---------- */
function panelHead(icon,title,copy,tools){
 return `<div class="panel-head"><div class="panel-titling"><h2>${ui.icon(icon)} ${title}</h2>${copy?`<p>${copy}</p>`:''}</div>${tools?`<div class="panel-tools">${tools}</div>`:''}</div>`;
}
const emptyState=(icon,title,copy)=>`<div class="state"><div class="state-icon">${ui.icon(icon)}</div><h3>${title}</h3><p>${copy}</p></div>`;

function renderOverview(){
 const pluginRows=state.plugins.map(p=>`<div class="rowitem" data-od-id="plugin-${p.id}"><div class="row-main"><strong>${esc(p.name)}</strong>
  <div class="row-sub">${logo(p.id)}${ui.badge(p.connected?'connected':'offline',p.connected?'success':'warning')}
  ${p.textItems?ui.badge('text items','info'):''}${p.listSync?ui.badge('list sync','info'):''}${p.receipts?ui.badge('receipts','info'):''}</div>
  ${p.textItems?'<p class="row-hint">Supports <span class="mono">list.notes</span>, so a discontinued product can be replaced by an ingredient + quantity note.</p>':'<p class="row-hint">No text-item support: a discontinued product pauses the line instead of becoming a note.</p>'}
  ${p.writePending?`<div class="row-reason">${ui.badge('list write pending confirmation','warning')} One write to this list could not be confirmed. It is waiting for your decision under Review.</div>`:''}</div>
  <div class="row-actions"><button class="button ghost" onclick="shopApp.go('diagnostics')" data-od-id="plugin-diag-${p.id}">${ui.icon('clock')} Diagnostics</button></div></div>`).join('');

 const projRows=projectionOpen?state.projection:state.projection.slice(0,3);
 const projection=state.projection.length?`<div class="rows">${projRows.map(r=>`<div class="rowitem" data-od-id="projection-${r.id}"><div class="row-main"><strong>${esc(r.label)}</strong>
  <div class="row-sub">${logo(r.plugin)}${esc(plugin(r.plugin).name)}</div>
  <div class="row-badges">${ui.badge(r.reason,'warning')}</div>
  <p class="row-reason">${esc(r.detail)}</p></div>
  <div class="row-actions"><button class="button ghost" onclick="shopApp.openProducts('${esc(r.label)}')" data-od-id="projection-fix-${r.id}">${ui.icon('link')} ${esc(r.fix)}</button></div></div>`).join('')}</div>
  ${state.projection.length>3?`<div class="show-more"><button class="button ghost" onclick="shopApp.toggleProjection()" aria-expanded="${projectionOpen}" data-od-id="projection-show-all">${ui.icon('chevron')} ${projectionOpen?'Show first 3 only':'Show all '+state.projection.length}</button><button class="button ghost" onclick="shopApp.go('review')" data-od-id="projection-open-review">${ui.icon('arrow')} Open in Review</button><p>Fix the mapping or the unit — the next sync retries every row automatically.</p></div>`:`<div class="panel-foot">${ui.icon('clock')}<span>Fix the mapping or the unit — the next sync retries every row automatically.</span></div>`}`
  :emptyState('check','No blocked shopping rows reported','Every row that gm-sync wanted to project reached its retailer list.');

 const sharedRows=state.sharedList.length?`<div class="dtable" style="--cols:minmax(130px,.8fr) minmax(0,1.6fr) minmax(90px,.7fr) minmax(110px,.8fr)">
  <div class="dt-head"><span>Plugin</span><span>Product</span><span>Packages</span><span>Since</span></div>
  ${state.sharedList.map((r,i)=>`<div class="dt-row" data-od-id="shared-${i}"><span data-label="Plugin">${plug(r.plugin)}</span><span data-label="Product"><strong>${esc(r.product)}</strong></span><span data-label="Packages" class="mono">${esc(r.packages)}</span><span data-label="Since" class="mono">${esc(r.since)}</span></div>`).join('')}</div>`
  :emptyState('cart','Nothing exported','gm-sync has no packages to put on a shared retailer list right now.');

 const notes=state.notes.length?`<div class="rows">${state.notes.map((nt,i)=>`<div class="rowitem" data-od-id="note-${i}"><div class="row-main"><strong class="mono">${esc(nt.note)}</strong><div class="row-sub">${logo(nt.plugin)}${esc(plugin(nt.plugin).name)}${ui.badge('text item','info')}</div><p class="row-reason">Replaces <b>${esc(nt.replaces)}</b>.</p></div><div class="row-actions"><button class="button ghost" onclick="ui.toast('Receipts decide what was bought. Checking a note off changes nothing in Mealie.')" data-od-id="note-explain-${i}">${ui.icon('receipt')} Why is this a note?</button></div></div>`).join('')}</div>`
  :emptyState('recipe','No replacement notes','Every product on your lists still has a catalogue match.');

 const paused=state.paused.length?`<div class="rows">${state.paused.map(l=>{
  const onlyRelease=l.kind==='note'||l.kind==='duplicate'||l.kind==='reused';
  return `<div class="rowitem" data-od-id="paused-${l.id}"><div class="row-main"><strong>${esc(l.product)}</strong>
  <div class="row-sub">${logo(l.plugin)}${esc(plugin(l.plugin).name)}</div>
  <div class="row-badges">${ui.badge(l.reason,'warning')}</div>
  <p class="row-reason mono">${esc(l.detail)}</p>
  <p class="row-hint">gm-sync never guesses whose units disappeared, so this line stays untouched until you decide.</p></div>
  <div class="row-actions">
   <button class="button" onclick="shopApp.resolveLine('${l.id}','removed')" ${onlyRelease?'disabled':''} data-od-id="line-removed-${l.id}">Someone removed their own units</button>
   <button class="button" onclick="shopApp.resolveLine('${l.id}','readd')" ${onlyRelease?'disabled':''} data-od-id="line-readd-${l.id}">Add mine again</button>
   <button class="button ghost" onclick="shopApp.resolveLine('${l.id}','release')" data-od-id="line-release-${l.id}">Release this line</button>
  </div></div>`}).join('')}</div>`
  :emptyState('check','No paused lines','Every managed line on your shared lists matches what gm-sync last wrote.');

 $('panel-overview').innerHTML=`
 <section class="panel" data-od-id="panel-plugins">${panelHead('api','Shop plugins',`One card per installation. Capabilities come from the plugin itself.`)}<div class="rows">${pluginRows}</div></section>
 <section class="panel" data-od-id="panel-projection">${panelHead('warning','Not sent to retailer',`Shopping rows gm-sync wanted to project but could not. Nothing is lost — each row is retried on the next sync once its cause is fixed.`+(state.projection.length>3?` Showing ${projectionOpen?'all':'the first'} ${projectionOpen?state.projection.length:3} of ${state.projection.length}.`:''))}${projection}</section>
 <section class="panel" data-od-id="panel-shared">${panelHead('cart','On the shared list',`The packages gm-sync currently wants on each retailer list.`)}${sharedRows}<div class="panel-foot">${ui.icon('leaf')}<span>Your own additions are kept. gm-sync only ever manages the quantity it wrote itself.</span></div></section>
 <section class="panel" data-od-id="panel-notes">${panelHead('recipe','Replacement text items',`A discontinued product is represented by one ingredient + quantity note.`)}${notes}<div class="panel-foot">${ui.icon('warning')}<span>Checking or removing a note never fulfils Mealie demand. Receipts determine what was actually purchased.</span></div></section>
 <section class="panel" data-od-id="panel-paused">${panelHead('clock','Paused list lines',`A managed line is paused as soon as the list no longer matches what gm-sync wrote.`)}${paused}</section>`;
}

/* ---------- Receipts ---------- */
function renderReceipts(){
 const controls=`<div class="receipt-controls">
  <label class="field"><span>Retailer</span><select onchange="shopApp.setRetailer(this.value)" data-od-id="receipt-retailer">
   <option value="all" ${receiptRetailer==='all'?'selected':''}>All retailers</option>
   ${state.plugins.filter(p=>p.receipts).map(p=>`<option value="${p.id}" ${receiptRetailer===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}
  </select></label>
  <label class="field"><span>How many</span><select onchange="shopApp.setCount(this.value)" data-od-id="receipt-count">
   <option value="5" ${receiptCount==='5'?'selected':''}>Latest 5 receipts</option>
   <option value="10" ${receiptCount==='10'?'selected':''}>Latest 10 receipts</option>
  </select></label>
  <div class="field field-actions"><button class="button" onclick="shopApp.loadReceipts()" ${receiptLoading?'disabled':''} data-od-id="load-receipts">${receiptLoading?'<span class="spinner"></span>':ui.icon('receipt')} ${receiptLoading?'Loading…':'Load receipts for setup'}</button></div>
 </div>`;
 const cards=receiptLoading?`<div class="skeleton" aria-hidden="true"><div class="sk w40"></div><div class="sk"></div><div class="sk w80"></div><div class="sk w60"></div></div>`
  :visibleReceipts().length?`<div class="rcards" style="padding:18px 20px">${visibleReceipts().map(receiptCard).join('')}</div>`
  :emptyState('receipt','No receipts stored yet','Pull receipts to build up a reference history. Receipts help configure mappings — they never book stock and never check items off.');
 $('panel-receipts').innerHTML=`
 <section class="panel" data-od-id="panel-receipt-pull">${panelHead('receipt','Receipts',`Reference only. Receipts help you configure mappings and explain what was bought — they never book stock and never check items off a list.`,`<button class="button" onclick="shopApp.pullReceipts()" ${receiptLoading?'disabled':''} data-od-id="pull-receipts">${ui.icon('swap')} Pull receipts now</button><a class="button ghost" href="shop-mappings.html" data-od-id="bulk-receipt-mapping">${ui.icon('grid')} From-receipt bulk mapping</a>`)}
 ${errorBanner()}${controls}${cards}
 <div class="panel-foot">${ui.icon('leaf')}<span>Stored receipts stay on this device. Mapping a line here only teaches gm-sync which product the retailer text means.</span></div></section>`;
}
function errorBanner(){
 const broken=state.plugins.filter(p=>p.receipts&&p.lastError);
 if(!broken.length)return '';
 return `<div style="padding:18px 20px 0">${broken.map(p=>`<div class="errorbar" data-od-id="receipt-error-${p.id}">${ui.icon('warning')}<div><strong>${esc(p.name)}: the last receipt check failed</strong>${esc(p.lastError)}<br><button class="button" onclick="shopApp.pullReceipts()" data-od-id="receipt-retry-${p.id}">${ui.icon('swap')} Try this retailer again</button></div></div>`).join('')}</div>`;
}
const visibleReceipts=()=>state.receipts.filter(r=>receiptRetailer==='all'||r.plugin===receiptRetailer).slice(0,Number(receiptCount));
function receiptCard(r){
 const lines=r.headerOnly?`<div class="state" style="padding:24px"><p>Bought before receipt processing was enabled; kept as a header only.</p></div>`
  :`<div class="rlines">${r.lines.map((l,i)=>`<div class="rline" data-od-id="rline-${r.id}-${i}"><div class="rline-main">
   <div class="rline-desc">${esc(l.desc)}</div>
   <div class="rline-map ${l.unmapped?'unmapped':''}">${ui.icon(l.unmapped?'search':'check')}<span>${esc(l.mapping)}</span></div>
   <div class="rline-tags">${ui.badge(l.state,l.tone)}${l.reason?ui.badge(l.reason,'warning'):''}${l.attribution.map(a=>ui.badge(a,'info')).join('')}</div>
  </div><div class="rline-right"><span class="rline-qty">${esc(l.qty)}${l.unit?' '+esc(l.unit):''}</span><span class="rline-amount">${esc(l.amount)}</span>
   <button class="button ghost" onclick="shopApp.mapLine('${r.id}',${i})" data-od-id="map-line-${r.id}-${i}">${ui.icon('link')} ${l.unmapped?'Map product':'Change mapping'}</button></div></div>`).join('')}</div>`;
 return `<article class="rcard" data-od-id="receipt-${r.id}">
 <div class="rcard-head">${logo(r.plugin)}<div class="rcard-id"><strong>${esc(r.store)}</strong><small>${esc(r.date)} · ${esc(r.ref)}</small></div>${ui.badge(r.status,r.tone)}<span class="rcard-total">${esc(r.total)}</span></div>
 ${lines}</article>`;
}

/* ---------- Review ---------- */
function group(key,icon,title,count,copy,body){
 return `<section class="review-group" data-od-id="review-${key}"><button class="group-head" aria-expanded="${groups[key]}" onclick="shopApp.toggleGroup('${key}')" data-od-id="review-toggle-${key}">${ui.icon(icon)}<h2>${title}</h2><span class="count">${count}</span>${ui.icon('chevron')}</button>${groups[key]?`${copy?`<div class="panel-foot" style="border-top:0;border-bottom:1px solid var(--border)">${ui.icon('leaf')}<span>${copy}</span></div>`:''}${body}`:''}</section>`;
}
function renderReview(){
 if(!attentionCount()){
  $('panel-review').innerHTML=`<section class="panel" data-od-id="review-clear"><div class="state celebrate"><div class="state-icon">${ui.icon('check')}</div><h3>Nothing needs your decision</h3><p>Every shopping row reached a retailer, every receipt line is settled and every write is confirmed. gm-sync will keep the lists in step on its own.</p><button class="button ghost" onclick="shopApp.go('overview')" data-od-id="review-back">${ui.icon('back')} Back to the overview</button></div></section>`;
  return}
 const projection=state.projection.length?`<div class="rows">${state.projection.map(r=>`<div class="rowitem"><div class="row-main"><strong>${esc(r.label)}</strong><div class="row-sub">${logo(r.plugin)}${esc(plugin(r.plugin).name)}</div><div class="row-badges">${ui.badge(r.reason,'warning')}</div><p class="row-reason">${esc(r.detail)}</p></div><div class="row-actions"><button class="button ghost" onclick="shopApp.openProducts('${esc(r.label)}')">${ui.icon('link')} ${esc(r.fix)}</button></div></div>`).join('')}</div>`
  :emptyState('check','No blocked shopping rows reported','Nothing was held back on the last projection.');

 const lines=state.reviewLines.length?`<div class="rows">${state.reviewLines.map(l=>`<div class="rowitem" data-od-id="review-line-${l.id}"><div class="row-main"><strong class="mono">${esc(l.desc)}</strong>
  <div class="row-sub"><span class="mono">${esc(l.qty)} ${esc(l.unit)}</span><span class="mono">${esc(l.amount)}</span><span class="mono">${esc(l.receipt)}</span></div>
  <div class="row-badges">${ui.badge(l.reason,'warning')}${ui.badge('nothing booked','')}</div>
  <p class="row-reason">${esc(l.note)}</p></div>
  <div class="row-actions">
   <button class="button" onclick="shopApp.openSub('${l.id}')" aria-expanded="${subOpen===l.id}" data-od-id="substitution-${l.id}">${ui.icon('swap')} One-off substitution</button>
   <button class="button ghost" onclick="shopApp.resolveLineReview('${l.id}','again')" data-od-id="process-again-${l.id}">${ui.icon('clock')} Process again (after mapping)</button>
   <button class="button ghost" onclick="shopApp.resolveLineReview('${l.id}','dismiss')" data-od-id="dismiss-${l.id}">${ui.icon('close')} Dismiss</button>
  </div>${subOpen===l.id?subForm(l):''}</div>`).join('')}</div>`
  :emptyState('check','No receipt lines to review','Every receipt line matched a mapping.');

 const disc=state.discrepancies.length?`<div class="rows">${state.discrepancies.map(d=>`<div class="rowitem" data-od-id="discrepancy-${d.id}"><div class="row-main"><strong>${esc(d.title)}</strong>
  <div class="row-sub">${logo(d.plugin)}${esc(d.product)}${ui.badge('stock discrepancy','danger')}</div>
  <div class="evidence">${d.evidence.map(([k,v])=>`<div><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('')}</div></div>
  <div class="row-actions">${d.kind==='checked-off'
   ?`<button class="button" onclick="shopApp.resolveDisc('${d.id}','covers')" data-od-id="disc-covers-${d.id}">The receipt covers it</button>
     <button class="button ghost" onclick="shopApp.resolveDisc('${d.id}','extra')" data-od-id="disc-extra-${d.id}">It was an additional purchase, book it</button>`
   :`<button class="button" onclick="shopApp.resolveDisc('${d.id}','undo')" data-od-id="disc-undo-${d.id}">${ui.icon('back')} Undo booking ${esc(d.transaction)}</button>
     <label class="field" style="min-width:120px"><span>Consume</span><input type="number" step="any" min="0" value="${d.suggest||''}" aria-label="Amount to consume for ${esc(d.product)}" data-od-id="disc-amount-${d.id}"></label>
     <button class="button" onclick="shopApp.resolveDisc('${d.id}','consume')" data-od-id="disc-consume-${d.id}">Consume difference</button>
     <button class="button ghost" onclick="shopApp.resolveDisc('${d.id}','keep')" data-od-id="disc-keep-${d.id}">Keep stock as is</button>`}
  </div></div>`).join('')}</div>`
  :emptyState('check','No stock discrepancies','Receipts and manual checks agree on every booking.');

 const writes=state.writes.length?`<div class="rows">${state.writes.map(w=>`<div class="rowitem" data-od-id="write-${w.id}"><div class="row-main"><strong>${esc(w.label)}</strong>
  <div class="row-sub">${ui.badge(w.status,w.status==='failed'?'danger':'warning')}${ui.badge(w.kind,'info')}<span>${esc(w.source)}</span><span class="mono">${esc(w.attempts)} attempt${w.attempts==='1'?'':'s'}</span></div>
  <p class="row-reason">${esc(w.lastError)}</p>
  <div class="evidence">${w.evidence.map(([k,v])=>`<div><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('')}</div></div>
  <div class="row-actions"><button class="button" onclick="shopApp.resolveWrite('${w.id}','happened')" data-od-id="write-happened-${w.id}">It happened</button>
  ${w.status==='unknown'?`<button class="button" onclick="shopApp.resolveWrite('${w.id}','retry')" data-od-id="write-retry-${w.id}">It did not happen, retry</button>`:''}
  <button class="button ghost" onclick="shopApp.resolveWrite('${w.id}','skip')" data-od-id="write-skip-${w.id}">Skip</button></div></div>`).join('')}</div>`
  :emptyState('check','All writes are settled','Nothing is waiting on an uncertain retailer response.');

 $('panel-review').innerHTML=
  group('projection','warning','Not sent to retailer',state.projection.length,'Each row is retried automatically on the next sync once its cause is fixed.',projection)+
  group('lines','receipt','Receipt lines to review',state.reviewLines.length,'<b>Nothing here was booked.</b> Receipts are reference material until you decide what a line means.',lines)+
  group('disc','swap','Stock discrepancies',state.discrepancies.length,'A manual check and a receipt disagree. Pick the version that reflects what is in your kitchen.',disc)+
  group('writes','api','Writes needing a decision',state.writes.length,'gm-sync never retries an uncertain write on its own — a double write would silently add units to a shared list.',writes);
}
function subForm(l){
 return `<div class="subform" data-od-id="subform-${l.id}">
 <h3>One-off substitution for <span class="mono">${esc(l.desc)}</span></h3>
 <label class="checkline"><input type="checkbox" ${subFulfilOnly?'checked':''} onchange="shopApp.setFulfilOnly(this.checked)" data-od-id="fulfil-only-${l.id}"><span><b>Fulfil demand only, book nothing in Grocy.</b> Use this when the purchase covers a recipe but should not change your stock.</span></label>
 <div class="fields">
  <label class="field"><span>Grocy product</span><input list="grocy-targets" placeholder="Search a Grocy product…" aria-label="Grocy product for ${esc(l.desc)}" ${subFulfilOnly?'disabled':''} data-od-id="sub-product-${l.id}"></label>
  <label class="field"><span>Stock amount</span><input type="number" step="any" min="0" placeholder="e.g. 350" aria-label="Stock amount to book" ${subFulfilOnly?'disabled':''} data-od-id="sub-amount-${l.id}"></label>
 </div>
 <label class="checkline"><input type="checkbox" data-od-id="sub-remember-${l.id}"><span>Remember as an alternative, so this retailer text maps itself next time.</span></label>
 <div class="fields">
  <div class="field"><span>Open shopping rows this purchase fulfils</span><div class="pickbox">${window.DEMO.openRows.map(r=>`<label class="checkline"><input type="checkbox" data-od-id="sub-open-${r.id}"><span>${esc(r.label)}</span></label>`).join('')}</div><p class="subform-note">Selected rows are removed from the shared list.</p></div>
  <div class="field"><span>Rows already checked off that this covers</span><div class="pickbox">${window.DEMO.checkedRows.map(r=>`<label class="checkline"><input type="checkbox" data-od-id="sub-checked-${r.id}"><span>${esc(r.label)}</span></label>`).join('')}</div><p class="subform-note">Their original booking is flagged for review instead of being changed silently.</p></div>
 </div>
 <div class="subform-actions"><button class="button ghost" onclick="shopApp.closeSub()" data-od-id="sub-cancel-${l.id}">Cancel</button><button class="button primary" onclick="shopApp.confirmSub('${l.id}')" data-od-id="confirm-substitution-${l.id}">${ui.icon('check')} Confirm substitution</button></div></div>`;
}

/* ---------- Diagnostics ---------- */
function renderDiagnostics(){
 const d=state.diag;
 const cards=state.plugins.length?state.plugins.map(p=>`<article class="diag-card" data-od-id="diag-${p.id}">
  <div class="diag-card-head">${logo(p.id)}<h3>${esc(p.name)}</h3>${ui.badge(p.state,p.state==='Connected'?'success':p.state.startsWith('Waiting')?'warning':'')}</div>
  <div class="kv">
   <div><span>Last receipt check</span><span>${esc(p.lastCheck)}</span></div>
   <div><span>Next check</span><span>${esc(p.nextCheck)}</span></div>
   <div><span>Last list sync</span><span>${esc(p.lastListSync.status)}</span></div>
   <div><span>Applied / failed / conflicts</span><span>${p.lastListSync.applied} / ${p.lastListSync.failed} / ${p.lastListSync.conflicts}</span></div>
  </div>
  <p class="row-hint">${esc(p.lastListSync.message)}</p>
  ${p.lastError?`<div class="diag-error"><strong>Last check error</strong>${esc(p.lastError)}</div>`:''}</article>`).join('')
  :emptyState('api','No plugins to report on','Diagnostics appear once a shop plugin is installed.');

 const cleanup=state.cleanup.length?`<div class="dtable" style="--cols:minmax(0,1.3fr) minmax(100px,.7fr) minmax(90px,.6fr) minmax(90px,.6fr) minmax(120px,.9fr) minmax(130px,1fr)">
  <div class="dt-head"><span>Product</span><span>Plugin</span><span>Managed qty</span><span>Household qty</span><span>Desired packages</span><span>Pause reason</span></div>
  ${state.cleanup.map((c,i)=>`<div class="dt-row" data-od-id="cleanup-${i}"><span data-label="Product"><strong>${esc(c.product)}</strong></span><span data-label="Plugin">${plug(c.plugin)}</span><span data-label="Managed qty" class="mono">${esc(c.managed)}</span><span data-label="Household qty" class="mono">${esc(c.household)}</span><span data-label="Desired packages" class="mono">${esc(c.desired)}</span><span data-label="Pause reason">${c.pause==='—'?'<span class="muted">—</span>':ui.badge(c.pause,'warning')}</span></div>`).join('')}</div>`
  :emptyState('check','Nothing to clean up','Every managed quantity matches the current demand.');

 $('panel-diagnostics').innerHTML=`
 <section class="panel" data-od-id="panel-sync-diagnostics">${panelHead('clock','Sync diagnostics','',`<button class="button ghost" onclick="ui.toast('Full history opens in the History workspace page.')" data-od-id="view-full-history">${ui.icon('arrow')} View full history</button>`)}
  <div class="diag-top">
   <div class="diag-cell"><span>Last receipt fetch</span><strong>${esc(d.lastFetch)}</strong><small>Reference data only</small></div>
   <div class="diag-cell"><span>Next receipt fetch</span><strong id="next-fetch">${d.due?'Due / waiting for worker':esc(d.nextFetch)}</strong><small id="next-fetch-countdown">${d.due?'The worker picks this up within a minute':'in '+mmss(fetchIn)}</small></div>
   <div class="diag-cell"><span>Last shopping job</span><strong>${esc(d.lastJob.split(' · ')[0])}</strong><small>${d.lastJob.includes('·')?ui.badge(d.lastJob.split(' · ')[1],d.jobTone):''}</small></div>
  </div></section>
 <section class="panel" data-od-id="panel-plugin-diagnostics">${panelHead('api','Per plugin','State, schedule and the result of the last list sync.')}<div class="diag-grid">${cards}</div>
  <div class="panel-foot">${ui.icon('clock')}<span>Receipt checks run every 30 minutes and on reconnect or a new-receipt notification. The worker checks the schedule every minute. Processing follows the regular sync cycle, so a busy job can delay it.</span></div></section>
 <section class="panel" data-od-id="panel-cleanup">${panelHead('leaf','List cleanup','When open demand disappears gm-sync removes its own managed quantity. Household quantities stay exactly as they are.')}${cleanup}</section>`;
}

/* ---------- state plumbing ---------- */
function renderActive(){
 if(active==='overview')renderOverview();
 else if(active==='receipts')renderReceipts();
 else if(active==='review')renderReview();
 else if(active==='diagnostics')renderDiagnostics();
}
function renderAll(){
 const none=!state.plugins.length;
 $('shop-body').hidden=none;
 $('no-plugins').hidden=!none;
 renderToolbar();
 if(none){
  $('no-plugins').innerHTML=`<div class="panel noplugins" data-od-id="no-plugins-panel"><div class="state"><div class="state-icon">${ui.icon('cart')}</div><h3>No shop plugins are installed</h3><p>Add one under Settings → Shop plugins. Without plugins the regular sync is unchanged.</p><button class="button primary" onclick="ui.toast('Settings → Shop plugins opens in its own workspace page.')" data-od-id="open-plugin-settings">${ui.icon('settings')} Open Settings → Shop plugins</button></div></div>`;
  return}
 renderHero();renderTabs();renderActive();
 if(window.productsTab&&active==='products')productsTab.render();
}
function loadState(id){
 stateId=id;
 state=JSON.parse(JSON.stringify(window.DEMO.states[id]));
 fetchIn=state.diag.countdown;autoIn=30;subOpen=null;subFulfilOnly=false;receiptLoading=false;receiptRetailer='all';receiptCount='5';
 groups={projection:true,lines:true,disc:true,writes:true};projectionOpen=false;
 try{localStorage.setItem(STORE,id)}catch{}
 document.querySelectorAll('#demo-seg button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.state===id)));
 if(window.productsTab)productsTab.mount(state);
 renderAll();
}
const drop=(arr,id)=>{const i=arr.findIndex(x=>x.id===id);if(i>-1)arr.splice(i,1)};

window.shopApp={
 go(tab){active=tab;renderTabs();renderActive();if(tab==='products')productsTab.render()},
 refreshCounts(){renderToolbar();renderHero();renderTabs()},
 refresh(auto){if(refreshing)return;refreshing=true;renderToolbar();setTimeout(()=>{refreshing=false;autoIn=30;renderToolbar();renderHero();if(!auto)renderActive();if(!auto)ui.toast('Shopping data refreshed from the local sample snapshot.')},1100)},
 sync(){ui.toast('Sync queued. gm-sync projects the open demand onto every connected retailer list.')},
 openProducts(label){active='products';renderTabs();productsTab.render();ui.toast(`Opening the mapping workflow for “${label}”.`)},
 setRetailer(v){receiptRetailer=v;renderReceipts()},
 setCount(v){receiptCount=v;renderReceipts()},
 loadReceipts(){receiptLoading=true;renderReceipts();setTimeout(()=>{receiptLoading=false;renderReceipts();ui.toast('Sample receipts loaded for mapping setup. No stock was booked.')},1200)},
 pullReceipts(){receiptLoading=true;renderReceipts();setTimeout(()=>{receiptLoading=false;renderReceipts();ui.toast('Receipt pull finished. Receipts are reference material only.')},1300)},
 mapLine(rid,i){active='products';renderTabs();productsTab.render();ui.toast('Mapping editor opened for this receipt line.')},
 toggleGroup(key){groups[key]=!groups[key];renderReview()},
 toggleProjection(){projectionOpen=!projectionOpen;renderOverview()},
 openSub(id){subOpen=subOpen===id?null:id;subFulfilOnly=false;renderReview();const f=document.querySelector(`[data-od-id="sub-product-${id}"]`);if(f)f.focus()},
 closeSub(){subOpen=null;renderReview()},
 setFulfilOnly(v){subFulfilOnly=v;renderReview()},
 confirmSub(id){drop(state.reviewLines,id);subOpen=null;renderAll();ui.toast('Substitution confirmed. Selected shopping rows were removed and earlier bookings flagged for review.')},
 resolveLineReview(id,how){drop(state.reviewLines,id);subOpen=null;renderAll();ui.toast(how==='again'?'Queued to process again after the mapping is saved.':'Receipt line dismissed. Nothing was booked.')},
 resolveLine(id,how){drop(state.paused,id);renderAll();ui.toast(how==='removed'?'Noted: the other units were removed by their owner. gm-sync keeps its own quantity.':how==='readd'?'Your units will be written again on the next sync.':'Line released. gm-sync stops managing this line.')},
 resolveDisc(id,how){drop(state.discrepancies,id);renderAll();ui.toast(how==='undo'?'Booking undone. Stock is back to the value before the manual check.':how==='consume'?'Difference consumed. Stock now matches the receipt.':how==='covers'?'The receipt covers this row. No extra booking was made.':how==='extra'?'Booked as an additional purchase.':'Stock kept as is. The discrepancy is closed.')},
 resolveWrite(id,how){drop(state.writes,id);renderAll();ui.toast(how==='happened'?'Marked as applied. gm-sync treats the line as written.':how==='retry'?'Write queued once more. It is never retried automatically.':'Write skipped. gm-sync will not touch this line again.')},
 setDemo(id){loadState(id);this.go(active==='products'?'products':active);ui.toast(`Sample snapshot: ${id==='busy'?'busy kitchen':id==='clear'?'all clear':'no plugins installed'}.`)}
};

/* globals used by the shared detail-panel chrome */
window.closeSheet=()=>productsTab.closeSheet();
window.nextProduct=d=>productsTab.next(d);

/* ---------- boot ---------- */
document.querySelectorAll('.sidebar .nav-item.active, .bottom-tabs .bottom-tab.active').forEach(a=>a.setAttribute('href','shopping.html'));
document.querySelectorAll('#demo-seg button').forEach(b=>b.onclick=()=>shopApp.setDemo(b.dataset.state));
document.body.insertAdjacentHTML('beforeend',`<datalist id="grocy-targets">${window.DEMO.grocyTargets.map(t=>`<option value="${t}"></option>`).join('')}</datalist>`);

let saved='busy';try{saved=localStorage.getItem(STORE)||'busy'}catch{}
if(!window.DEMO.states[saved])saved='busy';
loadState(saved);
productsTab.bindFilters();
shopApp.go('overview');

setInterval(()=>{
 if(!state||!state.plugins.length)return;
 if(!refreshing){autoIn--;if(autoIn<=0){autoIn=30;shopApp.refresh(true)}}
 const a=$('auto-in');if(a&&!refreshing)a.textContent=`every 30s · next in ${autoIn}s`;
 if(fetchIn>0)fetchIn--;
 const c=$('next-fetch-countdown');
 if(c){if(fetchIn<=0){const n=$('next-fetch');if(n)n.textContent='Due / waiting for worker';c.textContent='The worker picks this up within a minute'}else c.textContent='in '+mmss(fetchIn)}
},1000);

/* keyboard: tab switching with arrow keys on the tablist, Escape closes the mobile sheet */
$('sectabs').addEventListener('keydown',e=>{
 if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;
 e.preventDefault();
 const i=TABS.findIndex(t=>t[0]===active),next=TABS[(i+(e.key==='ArrowRight'?1:TABS.length-1))%TABS.length][0];
 shopApp.go(next);$('tab-'+next).focus();
});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){productsTab.closeSheet();if(subOpen)shopApp.closeSub();return}
 if(active!=='products'||e.altKey||e.ctrlKey||e.metaKey)return;
 if(['INPUT','SELECT','TEXTAREA','SUMMARY','BUTTON','A'].includes(e.target.tagName))return;
 if(['ArrowDown','j','ArrowUp','k'].includes(e.key)){e.preventDefault();productsTab.next(['ArrowDown','j'].includes(e.key)?1:-1)}
});

/* swipe between sections on touch devices */
let sx=0,sy=0;
const sections=$('sections');
sections.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY},{passive:true});
sections.addEventListener('touchend',e=>{
 const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;
 if(Math.abs(dx)<70||Math.abs(dy)>50)return;
 const i=TABS.findIndex(t=>t[0]===active);
 shopApp.go(TABS[(i+(dx<0?1:TABS.length-1))%TABS.length][0]);
},{passive:true});
})();
