/* Products tab: own-product mapping workflow (queue, suggestions inbox, catalogue search,
   conversions, alternatives, mapping targets). Prototype only: nothing leaves this device. */
(function(){
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TARGETS={'G+M':['link','Grocy + Mealie'],'G':['box','Grocy only'],'M':['recipe','Mealie only']};
const MEALIE_UNITS=['Count (no unit)','gram','kilogram','milliliter','liter','stuk','piece','cup','tablespoon'];
const CONV_UNITS=['ml','l','g','kg','piece','stuk'];
const FACTORS={'ml:ml':1,'l:ml':1000,'ml:l':.001,'l:l':1,'g:g':1,'kg:g':1000,'g:kg':.001,'kg:kg':1,'piece:piece':1,'stuk:stuk':1,'piece:stuk':1,'stuk:piece':1};

let S=null,shops=[],products=[],suggestions=[],ingredients=[];
let tab='todo',selected=null,query='',srcFilter='all',statusFilter='all';
let drafts={},searches={},searchTimers={},offline={},inboxCollapsed=false,showAll=false,convRetried={},moveWarn={},textCfg={};

const target=t=>`<span class="source">${ui.icon(TARGETS[t][0])}${TARGETS[t][1]}</span>`;
const current=()=>products.find(p=>p.id===selected);
const mapOf=(p,s)=>drafts[p.id]&&Object.hasOwn(drafts[p.id],s)?drafts[p.id][s]:p.maps&&p.maps[s];
const avail=item=>ui.badge(item[3],item[3]==='Discontinued'?'danger':item[3]!=='Available'?'warning':'available');
const mappedCount=p=>shops.filter(s=>mapOf(p,s.id)).length;
const AVAIL={'Discontinued':['bad','warning','list sync needs a text item or a new preferred product'],
 'Temporarily out of stock':['warn','clock','preferred product stays on the list'],
 'Availability unknown':['','search','the retailer did not report a status']};
function availLine(item){const a=AVAIL[item&&item[3]];if(!a)return '';
 return `<p class="avail-line ${a[0]}">${ui.icon(a[1])}<span><b>${esc(item[3])}</b> · ${a[2]}</span></p>`}
function worstAvail(p){for(const st of ['Discontinued','Temporarily out of stock','Availability unknown'])
 for(const s of shops){const m=mapOf(p,s.id),it=m?m.item:p.items[s.id];if(it&&it[3]===st)return st}
 return ''}
function newMapping(p,shop,item){
 const pl=S.plugins.find(x=>x.id===shop)||{},acc=(pl.accounts||[])[0];
 return {item,amount:p.warning==='Unconfirmed amount'?null:item[2],unit:isWeight({item})?'kg':p.unit,
  role:'Preferred',settles:!!p.loose,fallback:'',alternatives:[],
  textAccount:acc?acc.id:'',textItem:'off',mealieAmount:item[2],mealieUnit:p.mealieUnit};
}
/* Text items are configured per product per retailer account, with or without a product mapping. */
function tiCfg(p,shop){const k=p.id+':'+shop;
 if(!textCfg[k]){const pl=S.plugins.find(x=>x.id===shop)||{},acc=(pl.accounts||[])[0];
  textCfg[k]={account:acc?acc.id:'',mode:'off',fallback:''}}
 return textCfg[k]}
function tiState(p,s){
 const pl=S.plugins.find(x=>x.id===s.id)||{},accounts=pl.accounts||[],cfg=tiCfg(p,s.id);
 const acc=accounts.find(a=>a.id===cfg.account)||accounts[0]||{id:'',label:'no account',bound:false};
 const m=mapOf(p,s.id),item=m?m.item:p.items[s.id];
 const discontinued=!!item&&item[3]==='Discontinued';
 const noNotes=!pl.textItems,unbound=!acc.bound,disabled=noNotes||unbound;
 return {pl,accounts,cfg,acc,discontinued,noNotes,unbound,disabled,on:!disabled&&(discontinued||cfg.mode==='on')};
}

function mount(state){
 S=state;shops=state.plugins.filter(p=>p.catalogue).map(p=>({id:p.id,name:p.name,short:p.short}));
 products=state.products;suggestions=state.suggestions;ingredients=state.ingredients;
 drafts={};searches={};offline={};convRetried={};moveWarn={};textCfg={};showAll=false;inboxCollapsed=false;
 products.forEach(p=>{p.maps??={};if(p.mapped&&!Object.keys(p.maps).length)shops.forEach(s=>{
  const m=newMapping(p,s.id,p.items[s.id]);
  if(p.preset){m.amount=p.preset.amount;m.unit=p.preset.unit;m.settles=!!p.preset.settles}
  if(p.seedAlts&&p.seedAlts[s.id])m.alternatives=p.seedAlts[s.id].map(it=>({item:it,amount:it[2],unit:p.unit,role:'Alternative'}));
  p.maps[s.id]=m})});
 tab=products.some(p=>!p.mapped)?'todo':'mapped';
 selected=filtered()[0]?filtered()[0].id:null;
 render();
}

function filtered(){
 return products.filter(p=>(tab==='mapped'?p.mapped:tab==='attention'?!!p.warning:!p.mapped)
  &&p.name.toLowerCase().includes(query.toLowerCase())
  &&(srcFilter==='all'||p.target===srcFilter)
  &&(statusFilter==='all'||p.warning===statusFilter));
}

/* ---------- suggestions inbox ---------- */
function renderInbox(){
 const host=$('inbox');if(!host)return;
 const visible=showAll?suggestions:suggestions.slice(0,5);
 const cards=visible.map(sg=>{const p=products.find(x=>x.id===sg.product);if(!p)return '';const item=p.items[sg.shop];const shop=S.plugins.find(x=>x.id===sg.shop);
  return `<article class="suggestion" data-od-id="suggestion-${sg.id}"><div class="suggestion-top"><strong>${esc(p.name)}</strong><span class="score">${sg.score}%</span></div><p>${esc(item[0])} · ${esc(item[1])}</p><div class="suggestion-bottom"><span class="small muted">${esc(shop?shop.name:sg.shop)}</span><div><button class="accept" onclick="productsTab.accept('${sg.id}')" aria-label="Accept the ${esc(p.name)} suggestion for ${esc(shop?shop.name:sg.shop)}" data-od-id="accept-${sg.id}">${ui.icon('check')} Accept</button><button class="icon-button" onclick="productsTab.reject('${sg.id}')" aria-label="Reject the ${esc(p.name)} suggestion for ${esc(shop?shop.name:sg.shop)}" data-od-id="reject-${sg.id}">${ui.icon('close')}</button></div></div></article>`}).join('');
 host.innerHTML=`<div class="inbox-head ${inboxCollapsed||!suggestions.length?'collapsed':''}"><div class="inbox-title">${ui.icon('spark')} Suggestions <span class="count">${suggestions.length}</span></div><div class="inbox-actions">${suggestions.length>5?`<button class="button ghost" onclick="productsTab.toggleAll()" data-od-id="toggle-suggestion-count">${showAll?'Show 5':'Show all '+suggestions.length}</button>`:''}<button class="button ghost" onclick="productsTab.acceptHigh()" ${suggestions.some(s=>s.score>85)?'':'disabled'} data-od-id="accept-high-confidence">${ui.icon('check')} Accept all above 85%</button><button class="icon-button" onclick="productsTab.toggleInbox()" aria-label="${inboxCollapsed?'Expand':'Collapse'} suggestions" aria-expanded="${!inboxCollapsed}">${ui.icon(inboxCollapsed?'chevron':'close')}</button></div></div>${inboxCollapsed?'':suggestions.length?`<div class="suggestions">${cards}</div>`:'<p class="inbox-empty">No open suggestions. New catalogue matches appear here with their score.</p>'}`;
}

/* ---------- shopping ingredients to map ---------- */
function renderIngredients(){
 const host=$('ingredients-panel');if(!host)return;
 const body=ingredients.length?`<div class="rows">${ingredients.map(i=>{
  const shop=S.plugins.find(x=>x.id===i.plugin);
  const status=i.status==='searching'?`<span class="ing-status"><span class="spinner"></span>Waiting for catalogue search…</span>`
   :i.status==='error'?`<span class="ing-status bad">${ui.icon('warning')}Catalogue search failed</span>`
   :i.count?`<span class="ing-status ok">${ui.icon('check')}Found ${i.count} products</span>`
   :`<span class="ing-status">${ui.icon('search')}Found 0 products</span>`;
  return `<div class="rowitem" data-od-id="ingredient-${i.id}"><div class="row-main"><strong>${esc(i.name)}</strong><div class="row-sub"><span class="shop-logo" aria-hidden="true">${esc(shop?shop.short:'?')}</span>${esc(shop?shop.name:i.plugin)}</div>${status}${i.status==='error'?`<p class="row-hint">${esc(i.error)}</p>`:''}</div><div class="row-actions"><button class="button ghost" onclick="productsTab.searchAgain('${i.id}')" data-od-id="search-again-${i.id}">${ui.icon('swap')} Search again</button>${i.status==='found'&&i.count?`<button class="button ghost" onclick="ui.toast('Catalogue results open in the shop panel below.')">${ui.icon('arrow')} Review results</button>`:''}</div></div>`}).join('')}</div>`
  :`<div class="state"><div class="state-icon">${ui.icon('check')}</div><h3>Every shopping ingredient is mapped</h3><p>Ingredients that reach the shopping list without a retailer product show up here with their catalogue search status.</p></div>`;
 host.innerHTML=`<div class="panel-head"><div class="panel-titling"><h2>${ui.icon('recipe')} Shopping ingredients to map</h2><p>Ingredients that arrived from Mealie without a retailer product. gm-sync searches the catalogue once; a failed search is never retried on its own.</p></div></div>${body}`;
}

/* ---------- queue ---------- */
function renderQueue(){
 const mapped=products.filter(p=>p.mapped).length,percent=products.length?Math.round(mapped/products.length*100):0;
 $('progress').innerHTML=ui.ring(percent)+`<span class="ring-number">${percent}%</span>`;
 $('progress-text').textContent=`${mapped} of ${products.length} products mapped`;
 $('tabs').innerHTML=[['todo','To map',products.length-mapped],['mapped','Mapped',mapped],['attention','Needs attention',products.filter(p=>p.warning).length]]
  .map(([id,title,count])=>`<button class="tab ${tab===id?'active':''}" role="tab" aria-selected="${tab===id}" data-od-id="queue-tab-${id}" onclick="productsTab.changeTab('${id}')">${title} <span class="count">${count}</span></button>`).join('');
 const list=filtered();
 $('list-count').textContent=`${list.length} PRODUCT${list.length===1?'':'S'}`;
 $('product-list').innerHTML=list.length?list.map(p=>`<button class="product-row ${selected===p.id?'selected':''}" data-od-id="product-${p.id}" onclick="productsTab.select('${p.id}',true)" aria-pressed="${selected===p.id}"><span class="product-symbol">${ui.icon(TARGETS[p.target][0])}</span><span class="product-copy"><strong>${esc(p.name)}</strong>${target(p.target)}${p.warning?'<br>'+ui.badge(p.warning,p.warning==='Discontinued'?'danger':'warning'):''}${rowFlags(p)}</span><span class="row-tail">${mappedCount(p)}/${shops.length} ${ui.icon('chevron')}</span></button>`).join('')
  :`<div class="empty-state"><div class="empty-icon">${ui.icon(tab==='todo'&&mapped===products.length?'check':'search')}</div><h3>${tab==='todo'&&mapped===products.length?'All products mapped':'No matching products'}</h3><p>${tab==='todo'&&mapped===products.length?'Every product has a confirmed retailer mapping. The next sync will project packages straight onto the shared lists.':'Try a different search term, target or status filter.'}</p><button class="button ghost" onclick="productsTab.${tab==='todo'&&mapped===products.length?"changeTab('mapped')":'clearFilters()'}" data-od-id="queue-empty-action">${tab==='todo'&&mapped===products.length?'View mapped products':'Clear filters'}</button></div>`;
 $('queue-note').innerHTML=ui.icon('link')+'Linked products share one mapping across Grocy and Mealie.';
 const pending=S.plugins.filter(p=>!p.catalogue);
 $('target-legend').innerHTML=`<span><b>Mapping target</b></span><span>${ui.icon('link')}<b>G + M</b> linked, recommended</span><span>${ui.icon('box')}<b>G</b> Grocy only</span><span>${ui.icon('recipe')}<b>M</b> Mealie only</span><span class="muted">A linked target keeps one amount for stock and recipes.</span>${pending.length?`<span class="muted">${pending.map(x=>esc(x.name)).join(', ')} ${pending.length===1?'has':'have'} no catalogue yet, so ${pending.length===1?'it':'they'} cannot be mapped.</span>`:''}`;
}

/* ---------- conversion helpers ---------- */
function lookup(p,m){
 if(!m)return{ok:false,reason:'none'};
 if(p.warning==='Missing conversion'&&!convRetried[p.id])return{ok:false,reason:'failed'};
 const f=FACTORS[m.unit+':'+p.unit];
 if(f===undefined)return{ok:false,reason:'incompatible'};
 const n=Number(m.amount);
 if(!n||n<=0)return{ok:false,reason:'empty'};
 return{ok:true,factor:f,amount:n};
}
function previewHtml(p,s,m){
 const r=lookup(p,m),loose=isWeight(m);
 if(r.ok){const per=r.amount*r.factor;
  return `<div class="preview-box" id="preview-${s.id}">${ui.icon('check')}<span>${loose?`Buying <b class="mono">0,5 kg</b> adds <b class="mono">${+(per/2).toFixed(3)} ${esc(p.unit)}</b> to Grocy stock.`:`Buying <b class="mono">2 packages</b> adds <b class="mono">${+(per*2).toFixed(3)} ${esc(p.unit)}</b> to Grocy stock.`}<br><span class="muted">Conversion available: 1 ${esc(m.unit)} → ${+r.factor.toFixed(3)} ${esc(p.unit)}.</span></span></div>`}
 const msg=r.reason==='failed'?'The conversion lookup failed. Nothing was saved.'
  :r.reason==='incompatible'?`No conversion between <b>${esc(m?m.unit:'?')}</b> and the Grocy stock unit <b>${esc(p.unit)}</b>.`
  :'Enter an amount greater than zero.';
 return `<div class="preview-box bad" id="preview-${s.id}">${ui.icon('warning')}<span>${msg}<div class="unit-link">${r.reason==='failed'?`<button class="text-action" onclick="productsTab.retryConversion()" data-od-id="retry-conversion-${s.id}">Retry</button>`:''}<a href="#units" onclick="ui.toast('Units &amp; Conversions opens in its own workspace page.');return false" data-od-id="units-link-${s.id}">Open Units &amp; Conversions</a></div></span></div>`;
}
const isWeight=m=>!!m&&/^per /.test(m.item[1]);

/* ---------- shop section ---------- */
function shopSection(p,s){
 const m=mapOf(p,s.id),base=p.items[s.id],plugin=S.plugins.find(x=>x.id===s.id),down=offline[s.id];
 const confirmed=p.mapped&&!(drafts[p.id]&&drafts[p.id][s.id]);
 return `<section class="shop-section" data-od-id="shop-${s.id}">
 <div class="shop-heading"><div class="shop-name"><span class="shop-logo" aria-hidden="true">${esc(s.short)}</span><div><h3>${esc(s.name)}</h3><small>${down?'Plugin disconnected':plugin&&plugin.textItems?'Supports list notes · sample catalogue':'Sample catalogue'}</small></div></div><span class="saved-state">${ui.icon(m?'check':'link')}${m?(confirmed?'Confirmed':'Ready to confirm'):'Not mapped'}</span></div>
 ${m?`${itemCard(p,s,m.item,'change')}${availLine(m.item)}${replacementNotice(p,s)}${roleLine(p,s,m)}${mealieRow(p,s,m)}${conversionBlock(p,s,m)}${textItemDetails(p,s)}${alternatives(p,s,m)}`
  :`<div class="match-label"><span>${ui.icon('spark')} Suggested match</span><span class="score">${base[4]}% match</span></div>${itemCard(p,s,base,'pick','base')}${availLine(base)}${p.retired&&p.retired.shop===s.id?`<div class="warning-banner inline">${ui.icon('warning')}<div><strong>Previous match discontinued</strong><p>${esc(p.retired.name)} · ${esc(p.retired.pack)}. ${tiState(p,s).on?'A replacement text item is covering this demand for now. Pick an available product to go back to a catalogue match.':'Choose a replacement above, or let gm-sync write a replacement text item if this plugin supports notes.'}</p></div></div>`:''}${replacementNotice(p,s)}${textItemDetails(p,s)}`}
 <div class="search catalogue-search">${ui.icon('search')}<input value="${esc(searches[s.id]||'')}" aria-label="Search the ${esc(s.name)} catalogue" placeholder="${m?'Find an alternative':'Or search the catalogue'}..." oninput="productsTab.search('${s.id}',this.value)" data-od-id="catalogue-search-${s.id}"></div>
 <div class="search-help"><span>${m?'Adding a result keeps your preferred product and remembers the new one as an alternative.':'Search by product name or barcode.'}</span><button class="text-action" onclick="productsTab.toggleOffline('${s.id}')" data-od-id="connection-${s.id}">${down?'Reconnect plugin':'Disconnect plugin'}</button></div>
 <div class="search-results" id="results-${s.id}" aria-live="polite"></div></section>`;
}
function itemCard(p,s,item,action,index){
 return `<div class="match-card"><div class="match-top"><div class="match-info"><strong>${esc(item[0])}</strong><div class="match-meta"><span>${esc(item[1])}</span>${avail(item)}</div></div>${action==='pick'
  ?`<button class="button ghost" onclick="productsTab.pick('${s.id}','${index}')" ${item[3]==='Discontinued'?'disabled':''} data-od-id="use-${s.id}-${index}">Use this ${ui.icon('arrow')}</button>`
  :`<button class="text-action" onclick="productsTab.changeMatch('${s.id}')" data-od-id="change-${s.id}">Change</button>`}</div></div>`;
}
function roleLine(p,s,m){
 return `<div class="role-line"><span class="badge ${m.role==='Preferred'?'success':''}">${m.role==='Preferred'?'Preferred product':'Remembered alternative'}</span>${m.role==='Preferred'?'<span>Used for the shared list and for receipt matching.</span>':`<button class="text-action" onclick="productsTab.promote('${s.id}')" data-od-id="use-preferred-${s.id}">Use as preferred</button>`}<button class="icon-button" onclick="productsTab.removeMapping('${s.id}')" aria-label="Remove the ${esc(s.name)} mapping for ${esc(p.name)}" data-od-id="remove-mapping-${s.id}">${ui.icon('trash')}</button></div>`;
}
function conversionBlock(p,s,m){
 const loose=isWeight(m);
 return `<div class="conversion" data-od-id="conversion-${s.id}">
 <div class="conversion-label"><strong>${loose?'Set the weight conversion':'Set the package amount'}</strong><span class="muted">Grocy stock unit: <span class="mono">${esc(p.unit)}</span></span></div>
 <div class="conversion-line"><span>${loose?'1 kg purchased =':'1 package ='}</span><input type="number" min="0.001" step="any" value="${m.amount==null?'':m.amount}" aria-label="${esc(s.name)} amount per ${loose?'kilogram':'package'}" oninput="productsTab.draft('${s.id}','amount',this.value)" data-od-id="amount-${s.id}"><select aria-label="${esc(s.name)} conversion unit" onchange="productsTab.draft('${s.id}','unit',this.value,true)" data-od-id="unit-${s.id}">${CONV_UNITS.map(u=>`<option ${m.unit===u?'selected':''}>${u}</option>`).join('')}</select></div>
 <button class="text-action" onclick="productsTab.useSuggested('${s.id}')" data-od-id="suggested-amount-${s.id}">Use suggested amount: ${esc(m.item[1])} = ${m.item[2]} ${esc(p.unit)}</button>
 ${previewHtml(p,s,m)}
 ${loose?`<label class="settle-produce"><input type="checkbox" ${m.settles?'checked':''} onchange="productsTab.draft('${s.id}','settles',this.checked)" data-od-id="settles-${s.id}"><span><b>Fulfils all demand when bought</b><br>Loose produce is billed by weight, so the piece count is never exact. With this on, buying this product clears every open shopping row for ${esc(p.name)}. The conversion above still decides how much enters stock.</span></label>`:''}
 <details class="advanced"><summary data-od-id="more-options-${s.id}">More options</summary><div class="advanced-fields">
  <label>Mapping target <select onchange="productsTab.moveTarget(this.value)" data-od-id="target-${s.id}">${Object.keys(TARGETS).map(t=>`<option value="${t}" ${p.target===t?'selected':''}>${TARGETS[t][1]}${t==='G+M'?' (recommended)':''}</option>`).join('')}</select></label>
  ${moveWarn[p.id]?`<div class="warning-banner" style="margin:0">${ui.icon('warning')}<div><strong>Moving this mapping removes its link to ${esc(moveWarn[p.id])}</strong><p>Check the amount in the new target unit before you confirm.</p></div></div>`:''}
  ${p.target!=='G'?`<label>Mealie unit <select onchange="productsTab.setMealieUnit(this.value)" data-od-id="mealie-unit-${s.id}">${MEALIE_UNITS.map(u=>`<option ${p.mealieUnit===u?'selected':''}>${u}</option>`).join('')}</select></label><p class="small muted">“Count (no unit)” is for ingredients written without a unit, such as “2 komkommers”.</p>`:''}
 </div></details></div>`;
}
function replacementNotice(p,s){
 const r=p.replacement;if(!r||r.plugin!==s.id)return '';
 return `<div class="warning-banner inline" data-od-id="replacement-${s.id}">${ui.icon('warning')}<div>
 <strong>Waiting for ${esc(r.old)} to leave the list (${esc(r.account)})</strong>
 <p>Review the old line in Overview → Paused list lines if it remains paused.</p>
 ${r.paused?`<p><b>Waiting for the paused product line.</b> Resolve it before the text item can replace it.</p>`:''}
 <p><button class="text-action" onclick="productsTab.gotoPaused()" data-od-id="replacement-link-${s.id}">Open Overview → Paused list lines</button></p></div></div>`;
}
function mealieRow(p,s,m){
 if(p.target!=='G+M'||!p.mealieFood)return '';
 const unit=m.mealieUnit||p.mealieUnit;
 return `<div class="mealie-row" data-od-id="mealie-row-${s.id}">
 <div class="mealie-head">${ui.icon('recipe')}<strong>Linked Mealie mapping</strong><span class="muted">·</span><span class="mealie-food">${esc(p.mealieFood)}</span></div>
 <div class="mealie-fields"><span>1 package =</span><input type="number" min="0.001" step="any" value="${m.mealieAmount==null?'':m.mealieAmount}" aria-label="Mealie amount per package for ${esc(s.name)}" oninput="productsTab.draft('${s.id}','mealieAmount',this.value)" data-od-id="mealie-amount-${s.id}"><select aria-label="Mealie unit for ${esc(s.name)}" onchange="productsTab.draft('${s.id}','mealieUnit',this.value,true)" data-od-id="mealie-food-unit-${s.id}">${MEALIE_UNITS.map(u=>`<option ${unit===u?'selected':''}>${esc(u)}</option>`).join('')}</select></div>
 <p class="ti-note">Recipes consume <b>${esc(p.mealieFood)}</b> in ${esc(unit)}. This amount is edited separately from the Grocy stock amount below.</p></div>`;
}
function textItemDetails(p,s){
 const t=tiState(p,s);
 const why=t.noNotes?`${esc(t.pl.name)} cannot add list notes, so a text item is not possible here. A discontinued product pauses the line instead.`
  :t.unbound?'Sign in to the retailer first.':'';
 const tag=t.on?ui.badge('active','success'):t.disabled?ui.badge('not available',''):'';
 return `<details class="advanced" ${t.on||t.discontinued?'open':''}><summary data-od-id="textitem-${s.id}">Text item${tag}</summary><div class="textitem">
 <h4>${ui.icon('recipe')} Ingredient + quantity text item</h4>
 ${t.accounts.length>1
  ?`<label class="field"><span>Text item account for ${esc(t.pl.name)}</span><select onchange="productsTab.setText('${s.id}','account',this.value)" data-od-id="text-account-${s.id}">${t.accounts.map(a=>`<option value="${a.id}" ${a.id===t.acc.id?'selected':''}>${esc(t.pl.name)} — ${esc(a.label)}${a.bound?'':' (not signed in)'}</option>`).join('')}</select></label>`
  :`<p class="ti-note">Account: <b>${esc(t.pl.name)} — ${esc(t.acc.label)}</b>${t.acc.bound?'':' · not signed in'}</p>`}
 <label class="ti-toggle"><input type="checkbox" ${t.on?'checked':''} ${t.discontinued||t.disabled?'disabled':''} onchange="productsTab.setText('${s.id}','mode',this.checked?'on':'off')" data-od-id="text-item-toggle-${s.id}"><span>Use an ingredient + quantity text item instead of the preferred product${t.discontinued&&!t.disabled?'<br><b>Locked on</b> — this retailer product is discontinued, so gm-sync writes the text item automatically.':''}</span></label>
 ${why?`<p class="ti-note">${why}</p>`:''}
 <label class="field"><span>Text-item fallback</span><input type="text" value="${esc(t.cfg.fallback)}" placeholder="e.g. ${esc(p.name)}" ${t.disabled?'disabled':''} oninput="productsTab.setText('${s.id}','fallback',this.value,true)" data-od-id="fallback-${s.id}"></label>
 <p class="ti-note">Written as one note, for example “250 g ${esc(p.name.toLowerCase())}”. Checking a note off never fulfils Mealie demand — receipts decide what was bought.</p>
 </div></details>`;
}
function rowFlags(p){
 const out=[],w=worstAvail(p);
 if(w){const a=AVAIL[w],dup=p.warning===w;
  out.push(`<span class="flag ${a[0]}">${ui.icon(a[1])}<span>${dup?a[2].charAt(0).toUpperCase()+a[2].slice(1):`<b>${esc(w)}</b><span class="flag-why"> · ${a[2]}</span>`}</span></span>`)}
 const accs=shops.filter(s=>tiState(p,s).on).map(s=>`${s.short} — ${tiState(p,s).acc.label}`);
 if(accs.length)out.push(`<span class="flag">${ui.icon('recipe')}<span>Text item for ${esc(accs.join(', '))}</span></span>`);
 if(p.replacement)out.push(`<span class="flag warn">${ui.icon('clock')}<span><b>Waiting</b> for ${esc(p.replacement.old)} to leave the list<span class="flag-why"> (${esc(p.replacement.account)})</span></span></span>`);
 const alts=shops.reduce((n,s)=>{const m=mapOf(p,s.id);return n+(m&&m.alternatives?m.alternatives.length:0)},0);
 if(alts)out.push(`<span class="flag">${ui.icon('swap')}<span>${alts} alternative${alts===1?'':'s'}</span></span>`);
 return out.length?`<span class="row-flags">${out.join('')}</span>`:'';
}
function alternatives(p,s,m){
 if(!m.alternatives||!m.alternatives.length)return '';
 return `<div class="alternative-title">Remembered alternatives · ${m.alternatives.length}</div>`+m.alternatives.map((a,i)=>`<div class="alternative" data-od-id="alternative-${s.id}-${i}"><span>${esc(a.item[0])}<br><span class="muted">${esc(a.item[1])} · ${a.amount} ${esc(a.unit)}</span></span><button class="text-action" onclick="productsTab.makePreferred('${s.id}',${i})">Use as preferred</button><button class="icon-button" onclick="productsTab.removeAlternative('${s.id}',${i})" aria-label="Remove the alternative ${esc(a.item[0])}">${ui.icon('trash')}</button></div>`).join('');
}

/* ---------- detail ---------- */
const WARN={'Unit changed':['Stock unit changed from piece to gram','Review the package amount before confirming. The previous conversion is no longer valid.'],
 'Unconfirmed amount':['Confirm the weight conversion','Clearing the shopping list and booking stock are separate decisions. Review both below.'],
 'Discontinued':['A retailer product is discontinued','Choose an available replacement, or rely on a replacement text item where the plugin supports notes.'],
 'Missing conversion':['No conversion between the Mealie unit and the base unit','Add the conversion, then retry the preview below.']};
function renderDetail(){
 const host=$('detail');if(!host)return;
 const p=current();
 if(!p){host.innerHTML=`<div class="detail-empty"><div class="empty-state"><div class="empty-icon">${ui.icon('check')}</div><h3>${products.every(x=>x.mapped)?'All products mapped':'Pick a product to map'}</h3><p>${products.every(x=>x.mapped)?'Every product has a confirmed retailer match, so the next sync can project packages without guesswork.':'Select a product on the left to review its retailer matches, package amount and conversion.'}</p></div></div>`;return}
 host.innerHTML=ui.detailPanel({eyebrow:'Product mapping',title:esc(p.name),subline:target(p.target),
  stockLabel:'Grocy stock unit',stockValue:esc(p.unit),
  body:`${p.warning?`<div class="warning-banner" data-od-id="product-warning">${ui.icon('warning')}<div><strong>${WARN[p.warning][0]}</strong><p>${WARN[p.warning][1]}</p></div></div>`:''}${shops.map(s=>shopSection(p,s)).join('')}`,
  footer:`<p id="save-hint"></p><button class="button primary" id="confirm-mapping" onclick="productsTab.confirm()" data-od-id="confirm-mapping">${ui.icon('check')} Confirm &amp; next <span class="small">↵</span></button>`,
  backLabel:'All products'});
 shops.forEach(s=>{if(offline[s.id]||searches[s.id])showResults(s.id)});
 updateSave();
}
function updateSave(){
 const p=current(),btn=$('confirm-mapping');if(!p||!btn)return;
 const settled=s=>{if(tiState(p,s).on)return true;const m=mapOf(p,s.id);return !!m&&lookup(p,m).ok&&m.item[3]!=='Discontinued'};
 const complete=shops.length&&shops.every(settled);
 btn.disabled=!complete;
 const byText=shops.filter(s=>tiState(p,s).on&&!mapOf(p,s.id)).length;
 $('save-hint').textContent=complete
  ?(byText?`Saves every retailer for this product. ${byText} ${byText===1?'retailer is':'retailers are'} covered by a text item.`:'Saves every retailer for this product and moves to the next one.')
  :'Give every retailer a valid match, or switch it to a text item.';
}

/* ---------- catalogue search ---------- */
function results(p,s){
 const base=p.items[s.id];
 return [base,
  [`${s.short} ${p.name.toLowerCase()} voordeelverpakking`,p.unit==='ml'?'1,5 l':p.unit==='g'?'1 kg':'4 pieces',p.unit==='ml'?1500:p.unit==='g'?1000:4,'Available',87],
  [`${s.short} ${p.name.toLowerCase()} biologisch`,base[1],base[2],'Available',84],
  [`${s.short} ${p.name.toLowerCase()} XL`,p.unit==='ml'?'2 l':'2 kg',2000,'Temporarily out of stock',72]];
}
function showResults(shop){
 const host=$('results-'+shop);if(!host)return;
 if(offline[shop]){host.innerHTML=`<div class="search-state">${ui.icon('wifi')}<strong>Plugin is disconnected</strong>Your saved mapping is safe. Reconnect to search the catalogue again.<br><button class="text-action" onclick="productsTab.toggleOffline('${shop}')">Retry connection</button></div>`;return}
 const q=(searches[shop]||'').trim().toLowerCase();
 if(!q){host.innerHTML='';return}
 const p=current(),s=shops.find(x=>x.id===shop);if(!p||!s){host.innerHTML='';return}
 const all=results(p,s),hits=all.map((item,index)=>({item,index})).filter(({item})=>item[0].toLowerCase().includes(q)||p.name.toLowerCase().includes(q)||q==='8710400000001');
 host.innerHTML=hits.length?hits.map(({item,index})=>itemCard(p,s,item,'pick',index)).join('')
  :`<div class="search-state"><strong>No results for “${esc(searches[shop])}”</strong>Try “${esc(p.name)}”, a broader term, or a barcode.</div>`;
}

/* ---------- actions ---------- */
function ensureDraft(shop){const p=current();drafts[p.id]??={};if(!drafts[p.id][shop]&&p.maps[shop])drafts[p.id][shop]=JSON.parse(JSON.stringify(p.maps[shop]));return drafts[p.id][shop]}
function render(){renderInbox();renderIngredients();renderQueue();renderDetail()}

window.productsTab={
 mount,render,
 changeTab(next){tab=next;const f=filtered();selected=f[0]?f[0].id:null;renderQueue();renderDetail()},
 clearFilters(){query='';srcFilter=statusFilter='all';$('queue-search').value='';$('source-filter').value='all';$('status-filter').value='all';const f=filtered();selected=f[0]?f[0].id:null;renderQueue();renderDetail()},
 select(id,open){selected=id;renderQueue();renderDetail();if(open&&matchMedia('(max-width:650px)').matches){$('detail').classList.add('sheet-open');document.body.style.overflow='hidden';const b=$('detail').querySelector('.mobile-back');if(b)b.focus()}},
 next(dir){const list=filtered();if(!list.length)return;const i=list.findIndex(p=>p.id===selected);this.select(list[(i+dir+list.length)%list.length].id)},
 closeSheet(){$('detail').classList.remove('sheet-open');document.body.style.overflow='';const r=document.querySelector(`[data-od-id="product-${selected}"]`);if(r)r.focus()},
 toggleInbox(){inboxCollapsed=!inboxCollapsed;renderInbox()},
 toggleAll(){showAll=!showAll;renderInbox()},
 accept(id,silent){const sg=suggestions.find(s=>s.id===id);if(!sg)return;const p=products.find(x=>x.id===sg.product);const item=p.items[sg.shop];
  p.maps[sg.shop]=newMapping(p,sg.shop,item);
  if(drafts[p.id])delete drafts[p.id][sg.shop];
  suggestions=suggestions.filter(s=>s.id!==id);S.suggestions=suggestions;
  if(!silent){selected=p.id;render();ui.toast(`${p.name} match accepted. Review the amount for every retailer, then confirm.`)}},
 reject(id){suggestions=suggestions.filter(s=>s.id!==id);S.suggestions=suggestions;renderInbox();ui.toast('Suggestion rejected. You can still search the catalogue.')},
 acceptHigh(){const high=suggestions.filter(s=>s.score>85);high.forEach(s=>this.accept(s.id,true));render();ui.toast(`${high.length} suggestions accepted. Confirm the package amounts before the next sync.`)},
 searchAgain(id){const i=ingredients.find(x=>x.id===id);if(!i)return;const was=i.status;i.status='searching';delete i.error;renderIngredients();
  setTimeout(()=>{if(was==='error'){i.status='found';i.count=5}else{i.status='found';i.count=i.count||3}renderIngredients();ui.toast(`Catalogue search finished for “${i.name}”.`)},900)},
 pick(shop,index){const p=current(),s=shops.find(x=>x.id===shop);const item=index==='base'?p.items[shop]:results(p,s)[Number(index)];
  drafts[p.id]??={};const existing=mapOf(p,shop);
  if(existing){const m=ensureDraft(shop);m.alternatives??=[];
   if(m.item[0]===item[0]||m.alternatives.some(a=>a.item[0]===item[0]))return ui.toast('That product is already part of this mapping.');
   m.alternatives.push({item,amount:item[2],unit:p.unit,role:'Alternative'});ui.toast('Remembered as an alternative. Confirm to save.')}
  else drafts[p.id][shop]=newMapping(p,shop,item);
  searches[shop]='';renderDetail();const f=$('detail').querySelector(`[data-od-id="amount-${shop}"]`);if(f)f.focus()},
 changeMatch(shop){const p=current();drafts[p.id]??={};drafts[p.id][shop]=null;searches[shop]='';renderQueue();renderDetail()},
 removeMapping(shop){const p=current();drafts[p.id]??={};drafts[p.id][shop]=null;if(p.maps[shop]){delete p.maps[shop];p.mapped=false}searches[shop]='';renderQueue();renderDetail();ui.toast('Mapping removed. This retailer is skipped until you map it again.')},
 promote(shop){const m=ensureDraft(shop);m.role='Preferred';renderDetail();ui.toast('Marked as the preferred product. Confirm to save.')},
 draft(shop,key,value,rerender){const m=ensureDraft(shop);m[key]=value;if(rerender)return renderDetail();const box=$('preview-'+shop);if(box)box.outerHTML=previewHtml(current(),shops.find(x=>x.id===shop),m);updateSave()},
 useSuggested(shop){const m=ensureDraft(shop);m.amount=m.item[2];m.unit=isWeight(m)?'kg':current().unit;renderDetail();ui.toast('Suggested amount applied from the package size.')},
 setText(shop,key,value,quiet){const p=current();if(!p)return;const cfg=tiCfg(p,shop);cfg[key]=value;
  if(quiet)return;renderQueue();renderDetail();
  if(key==='mode')ui.toast(value==='on'?'Text item switched on for this retailer account.':'Text item switched off. The preferred product goes back on the list.')},
 gotoPaused(){if(window.shopApp){shopApp.go('overview');ui.toast('Paused list lines are at the bottom of the Overview.')}},
 retryConversion(){const p=current();convRetried[p.id]=true;renderDetail();ui.toast('Conversion lookup retried and resolved.')},
 moveTarget(value){const p=current();if(p.target==='G+M'&&value!=='G+M')moveWarn[p.id]=value==='G'?'Mealie':'Grocy';else delete moveWarn[p.id];p.target=value;renderQueue();renderDetail()},
 setMealieUnit(value){current().mealieUnit=value;renderDetail();ui.toast('Mealie unit set to '+value+'.')},
 makePreferred(shop,index){const m=ensureDraft(shop),a=m.alternatives[index];m.alternatives[index]={item:m.item,amount:m.amount,unit:m.unit,role:'Alternative'};m.item=a.item;m.amount=a.amount;m.unit=a.unit;renderDetail();ui.toast('Preferred product changed. Confirm to save.')},
 removeAlternative(shop,index){ensureDraft(shop).alternatives.splice(index,1);renderDetail()},
 search(shop,value){searches[shop]=value;clearTimeout(searchTimers[shop]);
  if(offline[shop])return showResults(shop);
  if(!value.trim()){const h=$('results-'+shop);if(h)h.innerHTML='';return}
  const h=$('results-'+shop);if(h)h.innerHTML='<div class="search-state" role="status">Searching the sample catalogue…</div>';
  const pid=selected;searchTimers[shop]=setTimeout(()=>{if(selected===pid)showResults(shop)},650)},
 toggleOffline(shop){offline[shop]=!offline[shop];renderDetail();ui.toast(offline[shop]?'Sample plugin disconnected. Saved mappings stay untouched.':'Sample plugin reconnected.')},
 confirm(){const p=current(),btn=$('confirm-mapping');if(!p||!btn||btn.disabled)return;
  shops.forEach(s=>{const t=tiState(p,s),src=mapOf(p,s.id);
   if(src){const m=JSON.parse(JSON.stringify(src));m.role='Preferred';m.textItem=t.on?'on':'off';m.textAccount=t.acc.id;m.fallback=t.cfg.fallback;p.maps[s.id]=m}
   else delete p.maps[s.id]});
  p.mapped=true;p.warning='';p.retired=null;delete drafts[p.id];delete moveWarn[p.id];
  suggestions=suggestions.filter(s=>s.product!==p.id);S.suggestions=suggestions;
  const left=products.filter(x=>!x.mapped).length;
  ui.toast(`${p.name} saved for ${shops.length} retailer${shops.length===1?'':'s'}. ${left} left to map.`);
  const nextP=products.find(x=>!x.mapped);selected=nextP?nextP.id:null;if(nextP)tab='todo';
  render();if(!selected)this.closeSheet();else{const b=$('confirm-mapping');if(b)b.focus()}
  if(window.shopApp)window.shopApp.refreshCounts()},
 bindFilters(){
  $('queue-search').oninput=e=>{query=e.target.value;renderQueue()};
  $('source-filter').onchange=e=>{srcFilter=e.target.value;renderQueue()};
  $('status-filter').onchange=e=>{statusFilter=e.target.value;renderQueue()}},
 isActive(){return !$('panel-products').hidden}
};
})();
