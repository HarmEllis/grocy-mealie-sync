/* Sample snapshots for the Shopping prototype. Three switchable states: busy, clear, none.
   Every value is illustrative demo content. No network calls, no stock mutations. */
(function(){
const shopName={ah:'Albert Heijn',jumbo:'Jumbo',picnic:'Picnic',crisp:'Crisp'};
const shopShort={ah:'AH',jumbo:'JU',picnic:'PN',crisp:'CR'};

/* ---------- own products (Products tab) ---------- */
const productSeed=[
 {id:'apple',name:'Appels',mealieFood:'Appel',target:'G+M',unit:'stuk',mealieUnit:'stuk',loose:true,warning:'',
  items:{ah:['AH Appels Elstar','per kg',6,'Available',99],jumbo:['Jumbo Appels Elstar','per kg',6,'Available',98],picnic:['Picnic Appels Elstar','per kg',6,'Available',94]},
  preset:{amount:6,unit:'stuk',settles:true},mapped:true},
 {id:'milk',name:'Melk halfvol',mealieFood:'Melk, halfvol',target:'G+M',unit:'ml',mealieUnit:'milliliter',warning:'',
  items:{ah:['AH Halfvolle melk','1 l',1000,'Available',98],jumbo:['Jumbo Halfvolle melk','1 l',1000,'Available',96],picnic:['Picnic Halfvolle melk','1 l',1000,'Available',93]},mapped:false},
 {id:'cucumber',name:'Komkommer',mealieFood:'Komkommer',target:'G+M',unit:'piece',mealieUnit:'Count (no unit)',warning:'',
  items:{ah:['AH Komkommer','1 piece',1,'Available',97],jumbo:['Jumbo Komkommer','1 piece',1,'Available',95],picnic:['Picnic Komkommer','1 piece',1,'Available',92]},mapped:false},
 {id:'chicken',name:'Kipfilet',target:'G',unit:'g',mealieUnit:'gram',warning:'Unit changed',
  items:{ah:['AH Kipfilet','500 g',500,'Available',94],jumbo:['Jumbo Kipfilet','600 g',600,'Available',92],picnic:['Picnic Kipfilet','500 g',500,'Available',88]},mapped:false},
 {id:'tomato',name:'Tomaten los',mealieFood:'Tomaat',target:'G+M',unit:'stuk',mealieUnit:'stuk',loose:true,warning:'Unconfirmed amount',
  items:{ah:['AH Tomaten los','per kg',6,'Available',95],jumbo:['Jumbo Trostomaten los','per kg',6,'Available',93],picnic:['Picnic Tomaten los','per kg',6,'Available',90]},mapped:false},
 {id:'penne',name:'Pasta penne',target:'M',unit:'g',mealieUnit:'gram',warning:'Discontinued',
  items:{ah:['AH Penne rigate','500 g',500,'Discontinued',96],jumbo:['Jumbo Penne rigate','500 g',500,'Available',91],picnic:['Picnic Penne rigate','500 g',500,'Available',89]},
  retired:{shop:'ah',name:'AH Biologische penne',pack:'500 g'},
  replacement:{plugin:'jumbo',account:'Main account',old:'Jumbo Penne rigate 500 g',paused:true},mapped:false},
 {id:'oil',name:'Olijfolie',mealieFood:'Olijfolie',target:'G+M',unit:'ml',mealieUnit:'milliliter',warning:'',
  items:{ah:['AH Olijfolie mild','1 l',1000,'Available',98],jumbo:['Jumbo Olijfolie mild','1 l',1000,'Available',97],picnic:['Picnic Olijfolie mild','500 ml',500,'Available',91]},
  replacement:{plugin:'ah',account:'Household list',old:'AH Olijfolie extra vierge 750 ml',paused:false},
  seedAlts:{ah:[['AH Olijfolie extra vierge','750 ml',750,'Available',91]]},mapped:true},
 {id:'rice',name:'Rijst basmati',target:'G',unit:'g',mealieUnit:'gram',warning:'',
  items:{ah:['AH Basmati rijst','1 kg',1000,'Available',97],jumbo:['Jumbo Basmati rijst','1 kg',1000,'Temporarily out of stock',96],picnic:['Picnic Basmati rijst','1 kg',1000,'Available',90]},mapped:true},
 {id:'oats',name:'Havermout',target:'M',unit:'g',mealieUnit:'gram',warning:'',
  items:{ah:['AH Havermout','500 g',500,'Available',96],jumbo:['Jumbo Havermout','500 g',500,'Available',96],picnic:['Picnic Havermout','500 g',500,'Availability unknown',92]},mapped:true},
 {id:'yoghurt',name:'Yoghurt naturel',mealieFood:'Yoghurt, naturel',target:'G+M',unit:'ml',mealieUnit:'milliliter',warning:'Missing conversion',
  items:{ah:['AH Yoghurt naturel','1 l',1000,'Available',95],jumbo:['Jumbo Yoghurt naturel','1 l',1000,'Available',94],picnic:['Picnic Yoghurt naturel','1 l',1000,'Available',90]},mapped:false}
];

const suggestionSeed=[
 {id:'s-milk',product:'milk',shop:'ah',score:98},
 {id:'s-cucumber',product:'cucumber',shop:'jumbo',score:95},
 {id:'s-chicken',product:'chicken',shop:'ah',score:82},
 {id:'s-yoghurt',product:'yoghurt',shop:'jumbo',score:94},
 {id:'s-penne',product:'penne',shop:'jumbo',score:79},
 {id:'s-tomato',product:'tomato',shop:'ah',score:95},
 {id:'s-oats',product:'oats',shop:'picnic',score:77}
];

const ingredientSeed=[
 {id:'i-1',name:'volle yoghurt',plugin:'ah',status:'found',count:7},
 {id:'i-2',name:'tahin',plugin:'ah',status:'searching'},
 {id:'i-3',name:'korianderzaad gemalen',plugin:'jumbo',status:'error',error:'Catalogue search refused the request (HTTP 429). gm-sync will not retry on its own.'},
 {id:'i-4',name:'bloem patent',plugin:'jumbo',status:'found',count:12},
 {id:'i-5',name:'gist verse',plugin:'ah',status:'found',count:0}
];

/* ---------- plugin installations ---------- */
const pluginsBusy=[
 {id:'ah',name:shopName.ah,short:shopShort.ah,connected:true,catalogue:true,textItems:true,listSync:true,receipts:true,writePending:true,
  accounts:[{id:'ah-home',label:'Household list',bound:true},{id:'ah-second',label:'Second account',bound:true},{id:'ah-shared',label:'Shared household',bound:false}],
  state:'Connected',lastCheck:'09:58 · 12 min ago',nextCheck:'10:28',
  lastListSync:{status:'Completed with conflicts',applied:14,failed:1,conflicts:2,message:'1 line is paused because someone reduced it on the shared list.'},lastError:''},
 {id:'jumbo',name:shopName.jumbo,short:shopShort.jumbo,connected:false,catalogue:true,textItems:false,listSync:true,receipts:true,writePending:false,
  accounts:[{id:'ju-main',label:'Main account',bound:true}],
  state:'Waiting for retailer sign-in',lastCheck:'Yesterday 21:14',nextCheck:'Blocked',
  lastListSync:{status:'Partially applied',applied:6,failed:2,conflicts:0,message:'Two writes could not be confirmed and are waiting for your decision.'},
  lastError:'Session expired while fetching receipts: the retailer returned 401 after the stored token was refreshed.'},
 {id:'picnic',name:shopName.picnic,short:shopShort.picnic,connected:true,catalogue:true,textItems:false,listSync:true,receipts:false,writePending:false,
  accounts:[{id:'pn-main',label:'Main account',bound:true}],
  state:'Plugin does not support receipts',lastCheck:'—',nextCheck:'Not applicable',
  lastListSync:{status:'Applied',applied:3,failed:0,conflicts:0,message:'Shared list matches the current demand.'},lastError:''},
 {id:'crisp',name:shopName.crisp,short:shopShort.crisp,connected:false,catalogue:false,textItems:false,listSync:true,receipts:false,writePending:false,
  accounts:[{id:'cr-main',label:'Main account',bound:false}],
  state:'Waiting for plugin connection and active scheduler',lastCheck:'—',nextCheck:'Waiting',
  lastListSync:{status:'Not run yet',applied:0,failed:0,conflicts:0,message:'The scheduler starts as soon as the plugin reports a connection.'},lastError:''}
];
const pluginsClear=[
 {id:'ah',name:shopName.ah,short:shopShort.ah,connected:true,catalogue:true,textItems:true,listSync:true,receipts:true,writePending:false,
  accounts:[{id:'ah-home',label:'Household list',bound:true},{id:'ah-second',label:'Second account',bound:true}],
  state:'Connected',lastCheck:'10:04 · 6 min ago',nextCheck:'10:34',
  lastListSync:{status:'Applied',applied:9,failed:0,conflicts:0,message:'Shared list matches the current demand.'},lastError:''},
 {id:'jumbo',name:shopName.jumbo,short:shopShort.jumbo,connected:true,catalogue:true,textItems:false,listSync:true,receipts:true,writePending:false,
  accounts:[{id:'ju-main',label:'Main account',bound:true}],
  state:'Connected',lastCheck:'10:02 · 8 min ago',nextCheck:'10:32',
  lastListSync:{status:'Applied',applied:4,failed:0,conflicts:0,message:'Shared list matches the current demand.'},lastError:''},
 {id:'picnic',name:shopName.picnic,short:shopShort.picnic,connected:true,catalogue:true,textItems:false,listSync:true,receipts:false,writePending:false,
  accounts:[{id:'pn-main',label:'Main account',bound:true}],
  state:'Receipt processing disabled',lastCheck:'—',nextCheck:'Not applicable',
  lastListSync:{status:'Applied',applied:2,failed:0,conflicts:0,message:'Shared list matches the current demand.'},lastError:''}
];

/* ---------- Overview collections ---------- */
const projectionBusy=[
 {id:'p1',label:'tahin',plugin:'ah',reason:'No product',detail:'This shopping row has no Mealie ingredient behind it yet. Select one so gm-sync knows what to buy.',fix:'Select a Mealie ingredient'},
 {id:'p2',label:'Yoghurt naturel · 2 l',plugin:'jumbo',reason:'No preferred retailer product mapped',detail:'A Jumbo mapping exists as a remembered alternative only. Mark one product as preferred.',fix:'Open the mapping'},
 {id:'p3',label:'Kipfilet · 600 g',plugin:'ah',reason:'Mapping unconfirmed',detail:'The suggested match was accepted but the package amount was never confirmed.',fix:'Confirm the amount'},
 {id:'p4',label:'Tomaten los · 4 stuks',plugin:'ah',reason:'Mapped base unit changed, confirm amount again',detail:'The retailer moved AH Tomaten los from per piece to per kg. Your old conversion no longer applies.',fix:'Re-confirm the conversion'},
 {id:'p5',label:'kalkoenfilet',plugin:'jumbo',reason:'Grocy product or stock unit missing',detail:'The Mealie ingredient has no Grocy counterpart, so there is no stock unit to project into.',fix:'Create the Grocy product'},
 {id:'p6',label:'kaneel',plugin:'ah',reason:'Missing unit',detail:'The recipe line has an amount but no unit, so the package count cannot be derived.',fix:'Add a unit'},
 {id:'p7',label:'Olijfolie · 750 ml',plugin:'picnic',reason:'Purchase unit differs from stock unit',detail:'Picnic sells this in bottles while Grocy keeps stock in ml, and no package size is stored.',fix:'Set the package amount'},
 {id:'p8',label:'Bloem patent · 3 cup',plugin:'ah',reason:'No conversion between Mealie unit and base unit',detail:'There is no cup → gram conversion for this product or for flour in general.',fix:'Add a conversion'}
];
const sharedListBusy=[
 {plugin:'ah',product:'Melk halfvol',packages:'3 × 1 l',since:'Today 09:12'},
 {plugin:'ah',product:'Appels Elstar',packages:'1 × per kg',since:'Today 09:12'},
 {plugin:'ah',product:'Komkommer',packages:'2 × 1 piece',since:'Yesterday 18:40'},
 {plugin:'jumbo',product:'Penne rigate',packages:'1 × 500 g',since:'Yesterday 18:40'},
 {plugin:'jumbo',product:'Basmati rijst',packages:'1 × 1 kg',since:'25 Oct 20:02'},
 {plugin:'picnic',product:'Havermout',packages:'2 × 500 g',since:'25 Oct 20:02'}
];
const notesBusy=[
 {note:'250 g pasta penne',plugin:'ah',replaces:'AH Biologische penne · 500 g'},
 {note:'1 bakje verse gist',plugin:'ah',replaces:'AH Verse gist 2 × 21 g'}
];
const pausedBusy=[
 {id:'l1',product:'Melk halfvol',plugin:'ah',reason:'Someone reduced this line',detail:'now 1 × 1 l, last written 3 × 1 l',kind:'reduced'},
 {id:'l2',product:'Komkommer',plugin:'ah',reason:'The line disappeared',detail:'now absent, last written 2 × 1 piece',kind:'gone'},
 {id:'l3',product:'Basmati rijst',plugin:'jumbo',reason:'Product on the list more than once',detail:'now 2 lines of 1 × 1 kg, last written 1 × 1 kg',kind:'duplicate'},
 {id:'l4',product:'Penne rigate',plugin:'jumbo',reason:'Line now holds another product',detail:'now Jumbo Fusilli 500 g, last written Jumbo Penne rigate 500 g',kind:'reused'},
 {id:'l5',product:'Verse gist',plugin:'picnic',reason:'Product discontinued, plugin cannot add a text item',detail:'now absent, last written 1 × 2 × 21 g',kind:'note'}
];

/* ---------- Receipts ---------- */
const receiptsBusy=[
 {id:'r1',ref:'AH-20261026-8841',date:'26 Oct 2026 · 17:42',store:shopName.ah,plugin:'ah',status:'Needs review',tone:'warning',total:'€ 48,12',lines:[
  {desc:'AH HALFVOLLE MELK 1L',qty:'3',unit:'pack',amount:'€ 3,87',mapping:'Mapped to Melk halfvol, 1000 ml per package',state:'Reference only',tone:'',attribution:['stock 3','list 1']},
  {desc:'AH APPELS ELSTAR 0,742KG',qty:'0,742',unit:'kg',amount:'€ 2,08',mapping:'Mapped to Appels, 6 stuks per kg',state:'Reference only',tone:'',attribution:['stock 4','list 1']},
  {desc:'AH TOMATEN LOS 0,382KG',qty:'0,382',unit:'kg',amount:'€ 1,34',mapping:'Mapped to Tomaten los, package amount not confirmed',state:'Needs review',tone:'warning',reason:'Package amount not confirmed',attribution:[]},
  {desc:'BONUS KORTING',qty:'1',unit:'',amount:'− € 1,20',mapping:'Not a product line',state:'Ignored',tone:'',attribution:[]},
  {desc:'AH TAHIN 350G',qty:'1',unit:'pack',amount:'€ 3,49',mapping:'No mapping yet',state:'Needs review',tone:'warning',reason:'No mapping yet',unmapped:true,attribution:[]}]},
 {id:'r2',ref:'JU-20261024-5107',date:'24 Oct 2026 · 11:08',store:shopName.jumbo,plugin:'jumbo',status:'Processed',tone:'success',total:'€ 22,40',lines:[
  {desc:'JUMBO PENNE RIGATE 500G',qty:'1',unit:'pack',amount:'€ 1,09',mapping:'Mapped to Pasta penne, 500 g per package',state:'Reference only',tone:'',attribution:['stock 500 g','list 1']},
  {desc:'JUMBO BASMATI RIJST 1KG',qty:'1',unit:'pack',amount:'€ 2,69',mapping:'Mapped to Rijst basmati, 1000 g per package',state:'Reference only',tone:'',attribution:['stock 1000 g']},
  {desc:'JUMBO KALKOENFILET 300G',qty:'1',unit:'pack',amount:'€ 4,29',mapping:'No mapping yet',state:'Needs review',tone:'warning',reason:'Retailer did not identify product',unmapped:true,attribution:[]}]},
 {id:'r3',ref:'AH-20260918-2210',date:'18 Sep 2026 · 19:31',store:shopName.ah,plugin:'ah',status:'Reference only, setup',tone:'',total:'€ 61,55',headerOnly:true},
 {id:'r4',ref:'AH-20261019-7733',date:'19 Oct 2026 · 16:12',store:shopName.ah,plugin:'ah',status:'Processed',tone:'success',total:'€ 31,06',lines:[
  {desc:'AH OLIJFOLIE MILD 1L',qty:'1',unit:'pack',amount:'€ 7,99',mapping:'Mapped to Olijfolie, 1000 ml per package',state:'Reference only',tone:'',attribution:['stock 1000 ml','list 1']},
  {desc:'AH HAVERMOUT 500G',qty:'2',unit:'pack',amount:'€ 2,38',mapping:'Mapped to Havermout, 500 g per package',state:'Reference only',tone:'',attribution:['stock 1000 g']}]}
];
const receiptsClear=[receiptsBusy[1],receiptsBusy[3]].map(r=>({...r,status:'Processed',tone:'success',lines:r.lines.filter(l=>!l.unmapped)}));

/* ---------- Review ---------- */
const reviewLinesBusy=[
 {id:'rv1',desc:'AH TAHIN 350G',qty:'1',unit:'pack',amount:'€ 3,49',receipt:'AH-20261026-8841',reason:'No mapping yet',
  note:'The retailer product is new to this workspace.'},
 {id:'rv2',desc:'AH TOMATEN LOS 0,382KG',qty:'0,382',unit:'kg',amount:'€ 1,34',receipt:'AH-20261026-8841',reason:'Package amount not confirmed',
  note:'Loose produce: gm-sync will not guess how many pieces 0,382 kg is.'},
 {id:'rv3',desc:'JUMBO KALKOENFILET 300G',qty:'1',unit:'pack',amount:'€ 4,29',receipt:'JU-20261024-5107',reason:'Retailer did not identify product',
  note:'The receipt line has no product code, only free text.'},
 {id:'rv4',desc:'AH RETOUR MELK 1L',qty:'−1',unit:'pack',amount:'− € 1,29',receipt:'AH-20261026-8841',reason:'Return or correction',
  note:'A negative line. Nothing is booked back automatically.'},
 {id:'rv5',desc:'AH KIPFILET 0,540KG',qty:'0,540',unit:'kg',amount:'€ 5,94',receipt:'AH-20261026-8841',reason:'Receipt unit does not fit mapping',
  note:'The mapping expects packages of 500 g, the receipt bills by weight.'},
 {id:'rv6',desc:'AH YOGHURT NATUREL 1L',qty:'2',unit:'pack',amount:'€ 2,18',receipt:'AH-20261026-8841',reason:'Product unit changed, confirm again',
  note:'The Grocy stock unit moved from l to ml after this mapping was saved.'},
 {id:'rv7',desc:'AH KOMKOMMER',qty:'2',unit:'piece',amount:'€ 1,78',receipt:'AH-20261026-8841',reason:'Several manual checks could match',
  note:'Two checked-off shopping rows could both be the purchase behind this line.'}
];
const openRows=[
 {id:'or1',label:'Melk halfvol · 3 × 1 l · Albert Heijn'},
 {id:'or2',label:'Tomaten los · 4 stuks · Albert Heijn'},
 {id:'or3',label:'Tahin · 1 pot · Albert Heijn'},
 {id:'or4',label:'Kipfilet · 600 g · Albert Heijn'}
];
const checkedRows=[
 {id:'cr1',label:'Komkommer · 2 pieces · checked off 26 Oct 17:05'},
 {id:'cr2',label:'Havermout · 2 × 500 g · checked off 19 Oct 16:30'}
];
const grocyTargets=['Tahin','Sesampasta','Kipfilet','Kalkoenfilet','Tomaten los','Yoghurt naturel','Melk halfvol','Komkommer','Havermout'];

const discrepanciesBusy=[
 {id:'d1',kind:'manual-vs-receipt',title:'A manual check booked 2 stuks, the receipt shows 0,742 kg',
  product:'Appels',plugin:'ah',transaction:'#4821',
  evidence:[['Booked by','Manual check on the shopping list'],['Booked at','26 Oct 2026 · 17:05'],['Booked amount','2 stuk'],['Receipt amount','0,742 kg ≈ 4 stuk'],['Difference','+2 stuk in stock'],['Transaction','#4821']],
  suggest:'2'},
 {id:'d2',kind:'substitute-booked',title:'A substitute was bought but the original was already booked',
  product:'Pasta penne',plugin:'jumbo',transaction:'#4788',
  evidence:[['Original booking','Pasta penne · 500 g · 24 Oct 11:20'],['Receipt line','JUMBO FUSILLI 500G'],['Receipt amount','1 × 500 g'],['Transaction','#4788']]},
 {id:'d3',kind:'checked-off',title:'A shopping row was checked off while a receipt was already fulfilling it',
  product:'Komkommer',plugin:'ah',transaction:'#4830',
  evidence:[['Shopping row','Komkommer · 2 pieces'],['Checked off','26 Oct 2026 · 17:05 (manual)'],['Receipt line','AH KOMKOMMER · 2 piece · 26 Oct 17:42'],['Booked twice','4 pieces in stock, 2 expected'],['Transaction','#4830']]}
];
const writesBusy=[
 {id:'w1',label:'Add Jumbo Penne rigate · 1 × 500 g',status:'unknown',kind:'Add list item',source:'Shopping list sync · 10:04',attempts:'2',
  lastError:'The retailer accepted the request but returned no line id, so the result cannot be confirmed.',
  evidence:[['Request','POST /list/items'],['Response','202 Accepted, empty body'],['Idempotency key','gm-9f31c2'],['Observed list','Line not found at 10:05']]},
 {id:'w2',label:'Reduce managed quantity of Jumbo Basmati rijst to 0',status:'failed',kind:'Update quantity',source:'List cleanup · 10:04',attempts:'3',
  lastError:'HTTP 409: the line was modified by another household member while the write was in flight.',
  evidence:[['Request','PATCH /list/items/8831'],['Response','409 Conflict'],['Managed qty','1 × 1 kg'],['Household qty','1 × 1 kg']]},
 {id:'w3',label:'Add text item “250 g pasta penne”',status:'unknown',kind:'Add text item',source:'Replacement note · 09:58',attempts:'1',
  lastError:'Connection reset before the response was read.',
  evidence:[['Request','POST /list/notes'],['Response','none'],['Idempotency key','gm-4b70ae'],['Observed list','Note present once at 10:01']]}
];
const cleanupBusy=[
 {product:'Melk halfvol',plugin:'ah',managed:'3 × 1 l',household:'1 × 1 l',desired:'3 × 1 l',pause:'Someone reduced this line'},
 {product:'Komkommer',plugin:'ah',managed:'2 × 1 piece',household:'0',desired:'0',pause:'The line disappeared'},
 {product:'Pasta penne',plugin:'ah',managed:'1 note',household:'0',desired:'Not applicable (replacement note)',pause:'—'},
 {product:'Basmati rijst',plugin:'jumbo',managed:'1 × 1 kg',household:'1 × 1 kg',desired:'1 × 1 kg',pause:'Product on the list more than once'},
 {product:'Havermout',plugin:'picnic',managed:'2 × 500 g',household:'0',desired:'2 × 500 g',pause:'—'}
];

/* ---------- state assembly ---------- */
const clone=v=>JSON.parse(JSON.stringify(v));
function mappedProducts(){return clone(productSeed).map(p=>({...p,mapped:true,warning:'',retired:null,replacement:null}))}

window.DEMO={
 shopName,shopShort,grocyTargets,openRows,checkedRows,
 states:{
  busy:{
   id:'busy',heroTone:'needs',
   plugins:clone(pluginsBusy),
   products:clone(productSeed),suggestions:clone(suggestionSeed),ingredients:clone(ingredientSeed),
   projection:clone(projectionBusy),sharedList:clone(sharedListBusy),notes:clone(notesBusy),paused:clone(pausedBusy),
   receipts:clone(receiptsBusy),reviewLines:clone(reviewLinesBusy),discrepancies:clone(discrepanciesBusy),writes:clone(writesBusy),
   cleanup:clone(cleanupBusy),
   diag:{lastFetch:'26 Oct 2026 · 17:46',nextFetch:'10:28',countdown:612,due:false,lastJob:'Today 10:04 · completed with 2 conflicts',jobTone:'warning'}
  },
  clear:{
   id:'clear',heroTone:'',
   plugins:clone(pluginsClear),
   products:mappedProducts(),suggestions:[],ingredients:[{id:'i-1',name:'volle yoghurt',plugin:'ah',status:'found',count:7}],
   projection:[],sharedList:clone(sharedListBusy).slice(0,4),notes:[clone(notesBusy)[0]],paused:[],
   receipts:clone(receiptsClear),reviewLines:[],discrepancies:[],writes:[],
   cleanup:clone(cleanupBusy).filter(c=>c.pause==='—'),
   diag:{lastFetch:'Today · 10:04',nextFetch:'10:34',countdown:1440,due:false,lastJob:'Today 10:04 · completed',jobTone:'success'}
  },
  none:{
   id:'none',heroTone:'',
   plugins:[],
   products:clone(productSeed),suggestions:[],ingredients:[],
   projection:[],sharedList:[],notes:[],paused:[],
   receipts:[],reviewLines:[],discrepancies:[],writes:[],cleanup:[],
   diag:{lastFetch:'—',nextFetch:'—',countdown:0,due:false,lastJob:'—',jobTone:''}
  }
 }
};
})();
