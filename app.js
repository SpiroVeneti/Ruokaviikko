(function(){
"use strict";
const DAYS=["mon","tue","wed","thu","fri","sat","sun"];
const CH=["S","K","L"];
const CHN={S:"S-Group",K:"K-Group",L:"Lidl"};
const CAT_ORDER=["veg","bakery","meat","dairy","frozen","dry","pantry","other"];
const APPL=["stove","oven","air_fryer","microwave","slow_cooker","pressure_cooker","blender","rice_cooker"];
const DIET=["meat","fish","vegetarian","vegan","lactose_free","gluten_free","no_pork","nut_free"];
const PANTRY_OPTS=["salt","black_pepper","rapeseed_oil","olive_oil","sugar","wheat_flour","stock_cubes","soy_sauce","rice","pasta","oat_flakes","tomato_paste","garlic","pesto"];
const CITIES=["Helsinki","Espoo","Vantaa","Tampere","Turku","Oulu","Jyväskylä","Lahti","Kuopio","Muu / Other"];
const PLATE=["#f6d58f","#cfe6f5","#f5cdbb","#d9efc4","#f3e2b8","#f7e3c9","#fbefb0","#e6dcf7"];
const DEFAULTS={
  lang:"en",theme:"auto",people:2,chains:{S:true,K:true,L:false},primary:"S",city:"Helsinki",
  storeNames:{S:"Prisma",K:"K-Citymarket",L:"Lidl"},days:DAYS.slice(),budget:60,appliances:["stove","oven","air_fryer"],
  diet:["meat","fish"],goal:"high_protein",kcal:2200,protein:140,maxMinutes:40,breakfastKcal:450,breakfastProtein:25,lunchKcal:600,lunchProtein:35,
  mode:"daily",dislikes:"",liked:[],disliked:[],pantry:["salt","black_pepper","rapeseed_oil","olive_oil","sugar","wheat_flour","stock_cubes","soy_sauce"],
  planSource:"auto",newPerWeek:2,voice:false,notify:false,ai:{order:["gemini","groq","openrouter"],models:{gemini:"gemini-flash-latest",groq:"openai/gpt-oss-120b",openrouter:"openai/gpt-oss-120b:free"}},
  timers:{fromSteps:true,autoStart:false,multi:true,early:true,ring:true,sound:"bell",vibrate:true,flash:false,large:true,wake:true,presets:[1,3,5,10,15,20,30],custom:[{label:"Soft eggs",sec:390}]}
};
const S={lang:"en",settings:clone(DEFAULTS),prices:{},meta:null,plan:null,book:[],uid:null,db:null,sample:null,canImg:false,ready:false,
  view:"today",planView:"cards",listTab:"list",bookFilter:"all",bookQ:"",priceCat:"all",priceQ:"",ov:null,busy:null,toast:null,online:navigator.onLine,cook:null,confirm:null};
const origTheme=document.documentElement.getAttribute("data-theme");

/* ---------- utils ---------- */
function clone(o){return o==null?o:JSON.parse(JSON.stringify(o))}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function t(k){const d=T[S.lang]||T.en;return d[k]!==undefined?d[k]:(T.en[k]!==undefined?T.en[k]:k)}
function L(o){if(o==null)return"";if(typeof o==="string")return o;return o[S.lang]||o.en||o.fi||""}
function eur(n){n=Number(n)||0;const s=n.toFixed(2);return (S.lang==="fi"?s.replace(".",","):s)+" €"}
function nf(n,d){n=Number(n)||0;const s=d==null?String(Math.round(n)):n.toFixed(d);return S.lang==="fi"?s.replace(".",","):s}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function uid6(){return Math.random().toString(36).slice(2,8)}
const OLD_MODELS={"gemini-2.5-flash":"gemini-flash-latest","gemini-2.0-flash":"gemini-flash-latest","llama-3.3-70b-versatile":"openai/gpt-oss-120b","meta-llama/llama-3.3-70b-instruct:free":"openai/gpt-oss-120b:free"};
function fixModels(st){if(st&&st.ai&&st.ai.models)for(const k in st.ai.models)if(OLD_MODELS[st.ai.models[k]])st.ai.models[k]=OLD_MODELS[st.ai.models[k]];return st}
function merge(base,over){const o=clone(base);if(!over)return o;for(const k in over){if(over[k]&&typeof over[k]==="object"&&!Array.isArray(over[k])&&o[k]&&typeof o[k]==="object"&&!Array.isArray(o[k]))o[k]=merge(o[k],over[k]);else o[k]=clone(over[k])}return o}
function mmss(s){s=Math.max(0,Math.ceil(s));const m=Math.floor(s/60),x=s%60;return (m<10?"0":"")+m+":"+(x<10?"0":"")+x}
function fmtQty(q,u){
  u=(u||"").toLowerCase();q=Number(q)||0;
  const fi=S.lang==="fi";
  if(u==="g"){if(q>=1000)return nf(q/1000,q%1000?1:0)+" kg";return nf(Math.round(q/5)*5||q)+" g"}
  if(u==="kg")return nf(q,1)+" kg";
  if(u==="ml"){if(q>=1000)return nf(q/1000,1)+" l";if(q>=100&&q%50===0)return nf(q/100,q%100?1:0)+" dl";return nf(q)+" ml"}
  if(u==="l")return nf(q,1)+" l";if(u==="dl")return nf(q,q%1?1:0)+" dl";
  if(u==="tbsp")return nf(q,q%1?1:0)+(fi?" rkl":" tbsp");if(u==="tsp")return nf(q,q%1?1:0)+(fi?" tl":" tsp");
  if(u==="clove"||u==="cloves")return nf(q,q%1?1:0)+(fi?" kynttä":" cloves");
  const r=Math.round(q*2)/2;return nf(r,r%1?1:0)+(u&&u!=="pcs"&&u!=="pc"?" "+u:"")}
function dayIdx(k){return DAYS.indexOf(k)}
function mondayOf(d){const x=new Date(d);x.setHours(12,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x}
function isoDate(d){const x=new Date(d);return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0")}
function isoWeek(d){const x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const n=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-n);const y=new Date(Date.UTC(x.getUTCFullYear(),0,1));return Math.ceil(((x-y)/864e5+1)/7)}
function planDate(dk){const m=new Date(S.plan.weekStart+"T12:00:00");m.setDate(m.getDate()+dayIdx(dk));return m}
function dmy(d){return d.getDate()+"."+(d.getMonth()+1)+"."}
function todayRel(){if(!S.plan)return null;const ws=new Date(S.plan.weekStart+"T12:00:00");const n=new Date();n.setHours(12,0,0,0);const diff=Math.round((n-ws)/864e5);if(diff>=0&&diff<7)return DAYS[diff];if(diff===-1)return "prepday";return null}
function dayName(k,short){const i=dayIdx(k);return i<0?k:(short?t("dshort")[i]:t("days")[i])}

/* ---------- cache ---------- */
const CK="rv_cache_v1";
function loadCache(){try{const c=JSON.parse(localStorage.getItem(CK)||"null");if(c){if(c.settings)S.settings=fixModels(merge(DEFAULTS,c.settings));if(c.plan)S.plan=c.plan;if(c.book)S.book=c.book;if(c.prices)S.prices=c.prices;if(c.meta)S.meta=c.meta;if(c.ui){S.view=c.ui.view||S.view;S.planView=c.ui.planView||S.planView}}}catch(e){}}
let cacheT=null;
function saveCache(){clearTimeout(cacheT);cacheT=setTimeout(()=>{try{localStorage.setItem(CK,JSON.stringify({settings:S.settings,plan:S.plan,book:S.book,prices:S.prices,meta:S.meta,ui:{view:S.view,planView:S.planView}}));S.cached=true}catch(e){}},300)}

/* ---------- sync (private GitHub data repo) ---------- */
const SK="rv_secrets_v1";
S.sec=(function(){try{return JSON.parse(localStorage.getItem(SK)||"{}")||{}}catch(e){return {}}})();
if(!S.sec.owner)S.sec.owner="SpiroVeneti";if(!S.sec.repo)S.sec.repo="ruokaviikko-data";
S.deleted=new Set();
function refreshCaps(){S.canImg=!!(S.sec.gemini||S.sec.openrouter)}
refreshCaps();
function saveSecrets(){refreshCaps();try{localStorage.setItem(SK,JSON.stringify(S.sec))}catch(e){}}
const GH={sha:{},timers:{},busy:{},pending:{}};
function ghOn(){return !!(S.sec.token&&S.sec.owner&&S.sec.repo)}
function ghUrl(p){return "https://api.github.com/repos/"+encodeURIComponent(S.sec.owner.trim())+"/"+encodeURIComponent(S.sec.repo.trim())+"/contents/"+p}
function ghHeaders(extra){return Object.assign({Authorization:"Bearer "+S.sec.token.trim(),Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"},extra||{})}
function b64enc(s){const bytes=new TextEncoder().encode(s);let bin="";for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));return btoa(bin)}
function b64dec(b){const bin=atob(String(b).replace(/\s/g,""));const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new TextDecoder().decode(u)}
async function ghGet(p){
  const r=await fetch(ghUrl(p)+"?ts="+Date.now(),{headers:ghHeaders(),cache:"no-store"});
  if(r.status===404){delete GH.sha[p];return null}
  if(!r.ok)throw {code:"gh",status:r.status};
  const j=await r.json();GH.sha[p]=j.sha;let txt;
  if(j.content&&j.encoding==="base64")txt=b64dec(j.content);
  else{const r2=await fetch(ghUrl(p)+"?ts="+Date.now(),{headers:ghHeaders({Accept:"application/vnd.github.raw+json"}),cache:"no-store"});if(!r2.ok)throw {code:"gh",status:r2.status};txt=await r2.text()}
  return txt.trim()?JSON.parse(txt):null}
async function ghPut(p,obj,merge){
  for(let attempt=0;attempt<3;attempt++){
    const body={message:"app: "+p,content:b64enc(JSON.stringify(obj))};if(GH.sha[p])body.sha=GH.sha[p];
    const r=await fetch(ghUrl(p),{method:"PUT",headers:ghHeaders({"Content-Type":"application/json"}),body:JSON.stringify(body)});
    if(r.ok){const j=await r.json();GH.sha[p]=j.content&&j.content.sha;return true}
    if(r.status===409||r.status===422){let remote=null;try{remote=await ghGet(p)}catch(e){}if(merge&&remote)obj=merge(remote,obj);continue}
    throw {code:"gh",status:r.status}}
  throw {code:"gh",status:409}}
function queueSave(p,getObj,merge,delay){
  saveCache();if(!ghOn())return;
  clearTimeout(GH.timers[p]);GH.timers[p]=setTimeout(()=>{GH.timers[p]=null;flush(p,getObj,merge)},delay||1500)}
async function flush(p,getObj,merge){
  if(GH.busy[p]){GH.pending[p]=true;return}
  GH.busy[p]=true;
  try{do{GH.pending[p]=false;await ghPut(p,getObj(),merge)}while(GH.pending[p]);S.syncErr=null;S.lastSync=Date.now()}
  catch(e){S.syncErr=e;console.warn("sync",p,e);render()}
  finally{GH.busy[p]=false}}
function savesPending(){return Object.values(GH.timers).some(Boolean)||Object.values(GH.busy).some(Boolean)}
function saveSettings(){queueSave("settings.json",()=>clone(S.settings))}
function savePlan(){queueSave("plan.json",()=>S.plan?clone(S.plan):{empty:true},null,2500)}
function mergeLib(remote,local){const m={};for(const r of remote||[])if(!S.deleted.has(r._id))m[r._id]=r;for(const r of local||[])m[r._id]=Object.assign({},m[r._id]||{},r);return Object.values(m)}
function saveLibrary(){queueSave("library.json",()=>({recipes:S.book.map(clone)}),(remote,local)=>({recipes:mergeLib(remote.recipes,local.recipes)}),2000)}
function libById(id){return S.book.find(r=>r._id===id)}
async function saveToBook(r){
  const id=r._id||("b"+Date.now().toString(36)+uid6());const doc=clone(r);doc._id=id;doc.savedAt=doc.savedAt||new Date().toISOString();
  const i=S.book.findIndex(b=>b._id===id);if(i>=0)S.book[i]=Object.assign(S.book[i],doc);else S.book.unshift(doc);
  saveLibrary();render();return id}
async function removeFromBook(id){S.deleted.add(id);S.book=S.book.filter(b=>b._id!==id);saveLibrary();render()}
async function pull(force){
  if(!ghOn()){S.ready=true;render();return}
  if(!force&&savesPending())return;
  S.syncing=true;render();
  try{
    const [st,pl,lib,pr]=await Promise.all(["settings.json","plan.json","library.json","prices.json"].map(p=>ghGet(p)));
    if(st){S.settings=fixModels(merge(DEFAULTS,st));S.lang=S.settings.lang;applyTheme()}else saveSettings();
    if(pl){S.plan=pl.empty?null:pl}else if(S.plan)savePlan();
    if(lib&&Array.isArray(lib.recipes)){const local=S.book;S.book=mergeLib(lib.recipes,[]);
      const missing=local.filter(r=>!S.book.some(x=>x._id===r._id)&&!r._synced);if(missing.length){S.book=S.book.concat(missing);saveLibrary()}}
    else if(S.book.length)saveLibrary();
    S.book.forEach(r=>r._synced=true);
    if(pr&&pr.items){S.prices=pr.items;S.meta={updated:pr.updated}}
    S.syncErr=null;S.lastSync=Date.now()}
  catch(e){S.syncErr=e;console.warn("pull",e)}
  S.syncing=false;S.ready=true;saveCache();render()}
async function loadBundled(){
  try{if(!Object.keys(S.prices).length){const r=await fetch("prices.json",{cache:"no-cache"});if(r.ok){const j=await r.json();S.prices=j.items;S.meta={updated:j.updated}}}}catch(e){}
  try{if(!S.book.length&&!S.starterLoaded){const r=await fetch("starter-recipes.json",{cache:"no-cache"});if(r.ok){const j=await r.json();S.book=j.recipes.map(x=>Object.assign(x,{kind:x.kind||"starter"}));S.starterLoaded=true}}}catch(e){}
  saveCache();render()}
async function testConnection(){
  if(!ghOn()){toast(t("errGh"));return}
  try{const r=await fetch("https://api.github.com/repos/"+encodeURIComponent(S.sec.owner.trim())+"/"+encodeURIComponent(S.sec.repo.trim()),{headers:ghHeaders()});
    if(!r.ok)throw {code:"gh",status:r.status};
    await pull(true);
    if(!S.syncErr){saveSettings();savePlan();saveLibrary();toast("✓ "+t("connected"))}else toast(errText(S.syncErr),6000)}
  catch(e){S.syncErr=e;toast(errText(e),6000);render()}}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&ghOn()&&Date.now()-(S.lastSync||0)>60000)pull(false)});

/* ---------- prices ---------- */
function enabledChains(){return CH.filter(c=>S.settings.chains[c])}
function bestFor(id,chain){
  const p=S.prices[id];if(!p||!p.items)return null;
  if(chain){const it=p.items[chain];return it?{c:chain,it}:null}
  const pr=S.settings.primary;
  if(S.settings.chains[pr]&&p.items[pr])return {c:pr,it:p.items[pr]};
  let best=null;for(const c of enabledChains()){const it=p.items[c];if(it&&(!best||it.price/it.qty<best.it.price/best.it.qty))best={c,it}}
  if(!best)for(const c of CH){const it=p.items[c];if(it){best={c,it};break}}
  return best}
const UNIT={g:["g",1],gram:["g",1],grams:["g",1],kg:["g",1000],ml:["ml",1],l:["ml",1000],dl:["ml",100],cl:["ml",10],tbsp:["ml",15],rkl:["ml",15],tsp:["ml",5],tl:["ml",5],
  pcs:["pcs",1],pc:["pcs",1],piece:["pcs",1],pieces:["pcs",1],kpl:["pcs",1],clove:["pcs",1],cloves:["pcs",1],slice:["pcs",1],slices:["pcs",1]};
function toBase(qty,unit,p){
  const u=UNIT[String(unit||"pcs").toLowerCase()]||["pcs",1];const fam=u[0];let q=(Number(qty)||0)*u[1];
  if(fam===p.unit)return q;
  if(fam==="pcs"&&p.pcs_g&&p.unit!=="pcs")return q*p.pcs_g;
  if(p.unit==="pcs"&&p.pcs_g&&fam==="g")return q/p.pcs_g;
  if((fam==="g"&&p.unit==="ml")||(fam==="ml"&&p.unit==="g"))return q;
  return null}
function isPantry(i){return i.pantry||(i.id&&S.settings.pantry.includes(i.id))}
function ingInfo(i,f,chain){
  if(isPantry(i))return {pantry:true,cost:0};
  const p=i.id&&S.prices[i.id];
  if(p){const b=bestFor(i.id,chain);const bq=toBase(i.qty*f,i.unit,p);if(b&&bq!=null)return {cost:bq*b.it.price/b.it.qty,base:bq,c:b.c,offer:!!b.it.offer,p}}
  if(chain&&p)return {cost:(Number(i.est_eur)||0)*f,est:true,missing:true};
  return {cost:(Number(i.est_eur)||0)*f,est:true}}
function recipeCost(r,servings){
  const sv=servings||r.servings||1;const f=sv/(r.servings||1);let total=0,est=false,offer=false;
  for(const i of r.ingredients||[]){const x=ingInfo(i,f);if(x.pantry)continue;total+=x.cost||0;if(x.est&&(Number(i.est_eur)||0)>0)est=true;if(x.offer)offer=true}
  return {total,per:total/sv,est,offer}}
function catOf(p){return p&&p.cat||"other"}

/* ---------- plan derived ---------- */
function planRecipeKeys(){if(!S.plan)return[];const ks=[];for(const d of S.plan.days||[]){for(const k of [d.dinner,d.lunch])if(k&&S.plan.recipes[k]&&!ks.includes(k))ks.push(k)}return ks}
function shopping(chainOverride){
  if(!S.plan)return null;
  const agg={},other={};
  for(const k of planRecipeKeys()){const r=S.plan.recipes[k];
    for(const i of r.ingredients||[]){if(isPantry(i))continue;const p=i.id&&S.prices[i.id];const bq=p?toBase(i.qty,i.unit,p):null;
      if(p&&bq!=null){(agg[i.id]=agg[i.id]||{id:i.id,qty:0,uses:[]});agg[i.id].qty+=bq;if(!agg[i.id].uses.includes(k))agg[i.id].uses.push(k)}
      else{const nm=L(i.name)||i.id||"?";const key=nm.toLowerCase();const o=(other[key]=other[key]||{key:"o:"+key,name:i.name,emoji:i.emoji,est:0,uses:[],qty:[]});o.est+=Number(i.est_eur)||0;if(!o.uses.includes(k))o.uses.push(k);o.qty.push(fmtQty(i.qty,i.unit))}}}
  const items=[];
  for(const id in agg){const a=agg[id];const p=S.prices[id];const b=bestFor(id,chainOverride);
    if(!b){items.push({id,p,qty:a.qty,uses:a.uses,missing:true,cost:0});continue}
    const it=b.it;let packs=null,cost,left=0;
    if(p.loose){cost=a.qty*it.price/it.qty}else{packs=Math.max(1,Math.ceil(a.qty/it.qty-0.03));cost=packs*it.price;left=packs*it.qty-a.qty}
    items.push({id,p,c:b.c,it,qty:a.qty,packs,cost,left,uses:a.uses,offer:!!it.offer})}
  const others=Object.values(other);
  const total=items.reduce((s,x)=>s+(x.cost||0),0)+others.reduce((s,x)=>s+x.est,0);
  return {items,others,total}}
function comparison(){
  const base0=shopping();if(!base0)return null;const rows=[];
  for(const c of enabledChains()){const sh=shopping(c);let miss=0,total=0;
    for(const x of sh.items){if(x.missing){miss++;const fb=base0.items.find(y=>y.id===x.id);total+=fb?fb.cost:0}else total+=x.cost}
    total+=sh.others.reduce((s,x)=>s+x.est,0);rows.push({c,total,miss})}
  let mix=0;for(const x of base0.items){let best=x.cost;for(const c of CH){const b=bestFor(x.id,c);if(!b)continue;const p=x.p;const cost=p.loose?x.qty*b.it.price/b.it.qty:Math.max(1,Math.ceil(x.qty/b.it.qty-0.03))*b.it.price;if(cost<best)best=cost}mix+=best}
  mix+=base0.others.reduce((s,x)=>s+x.est,0);
  return {rows,mix,primary:base0.total}}
function dayNut(d){const st=S.settings,R=S.plan.recipes;const dr=d.dinner&&R[d.dinner],lr=d.lunch&&R[d.lunch];
  return {kcal:st.breakfastKcal+(lr?(+lr.kcal||0):st.lunchKcal)+(dr?(+dr.kcal||0):0),protein:st.breakfastProtein+(lr?(+lr.protein||0):st.lunchProtein)+(dr?(+dr.protein||0):0)}}
function weekNut(){if(!S.plan||!S.plan.days.length)return null;const a=S.plan.days.map(dayNut);return {kcal:a.reduce((s,x)=>s+x.kcal,0)/a.length,protein:a.reduce((s,x)=>s+x.protein,0)/a.length}}
function offersUsed(){const sh=shopping();return sh?sh.items.filter(x=>x.offer).length:0}
function leftovers(){const sh=shopping();if(!sh)return[];return sh.items.filter(x=>x.left>0&&["meat","dairy","veg","bakery"].includes(catOf(x.p))&&x.left/(x.it.qty)>0.15).map(x=>({id:x.id,name:{en:x.p.en,fi:x.p.fi},emoji:x.p.emoji,left:x.left,unit:x.p.unit}))}
function mealTags(r,day){
  const tg=[];const rc=recipeCost(r);
  if(rc.offer)tg.push(["t-off",t("offer")]);
  if(r.in_season)tg.push(["t-sea",t("inSeason")]);
  if(day&&day.storage)tg.push(["t-left",(day.storage==="freezer"?"❄ ":"")+t(day.storage)]);
  else if(S.plan&&S.plan.mode==="twice"&&day&&day.cook!==false)tg.push(["t-x2",t("cookTwice")]);
  if(r.veg)tg.push(["t-veg",t("veggie")]);
  return tg}
function tagsHtml(tg){return tg.map(x=>'<span class="tag '+x[0]+'">'+esc(x[1])+"</span>").join("")}
function plate(r,cls){const col=r&&r.color||PLATE[(r&&(r.title&&L(r.title).length)||0)%PLATE.length];return '<span class="plate '+(cls||"")+'" style="--pc:'+esc(col)+'"><span aria-hidden="true">'+esc(r&&r.emoji||"🍽️")+"</span></span>"}

/* ---------- AI (your own free keys) ---------- */
const AIP={gemini:"Gemini",groq:"Groq",openrouter:"OpenRouter"};
function aiReady(){return (S.settings.ai.order||[]).some(p=>S.sec[p])}
function errText(e){const c=e&&e.code;
  if(c==="nokey")return t("errNoKey");
  if(c==="gh")return e.status===401||e.status===403?t("errGhAuth"):e.status===404?t("errGh404"):t("errGh");
  if(c==="rate_limited")return t("errRate");if(c==="invalid_json"||c==="empty_completion")return t("errJson");
  if(c==="images_unavailable")return t("errImg");
  if(c==="provider"){if(e.list&&e.list.length)return t("errAllFailed")+" "+e.list.join(" · ");return (e.provider?e.provider+": ":"")+t("errProvider")}
  return t("errGeneric")}
function parseJSONLoose(txt){let s=String(txt||"").trim();if(!s)throw {code:"empty_completion"};
  const f=s.match(/```(?:json)?\s*([\s\S]*?)```/);if(f)s=f[1].trim();
  try{return JSON.parse(s)}catch(e){}
  const a=s.indexOf("{"),b=s.lastIndexOf("}");if(a>=0&&b>a){try{return JSON.parse(s.slice(a,b+1))}catch(e){}}
  throw {code:"invalid_json"}}
async function callAI(p,prompt,images,signal){try{return await callAI0(p,prompt,images,signal)}catch(e){if(e&&e.name==="AbortError")throw e;if(e instanceof TypeError)throw {code:"provider",provider:AIP[p],status:0,detail:"network/blocked"};throw e}}
async function callAI0(p,prompt,images,signal){
  const m=(S.settings.ai.models||{})[p]||DEFAULTS.ai.models[p];const key=String(S.sec[p]).trim();
  if(p==="gemini"){
    const parts=[{text:prompt}];for(const im of images||[])parts.push({inline_data:{mime_type:im.type,data:im.b64}});
    const r=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(m)+":generateContent?key="+encodeURIComponent(key),{method:"POST",signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{role:"user",parts}],generationConfig:{responseMimeType:"application/json",temperature:0.7,maxOutputTokens:24000}})});
    if(!r.ok)throw {code:r.status===429?"rate_limited":"provider",provider:AIP[p],status:r.status,detail:(await r.text()).slice(0,300)};
    const j=await r.json();const c=j.candidates&&j.candidates[0];
    return (c&&c.content&&c.content.parts||[]).map(x=>x.text||"").join("")}
  const url=p==="groq"?"https://api.groq.com/openai/v1/chat/completions":"https://openrouter.ai/api/v1/chat/completions";
  let content=prompt;
  if(images&&images.length){if(p!=="openrouter")throw {code:"images_unavailable"};content=[{type:"text",text:prompt}].concat(images.map(im=>({type:"image_url",image_url:{url:"data:"+im.type+";base64,"+im.b64}})))}
  const h={"Content-Type":"application/json",Authorization:"Bearer "+key};if(p==="openrouter"){h["HTTP-Referer"]=location.origin;h["X-Title"]="Ruokaviikko"}
  const body={model:m,messages:[{role:"user",content}],temperature:0.7};if(p==="groq")body.response_format={type:"json_object"};
  const r=await fetch(url,{method:"POST",signal,headers:h,body:JSON.stringify(body)});
  if(!r.ok)throw {code:r.status===429?"rate_limited":"provider",provider:AIP[p],status:r.status,detail:(await r.text()).slice(0,300)};
  const j=await r.json();return j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content||""}
async function ask(prompt,opts){
  opts=opts||{};
  let order=(S.settings.ai.order||[]).filter(p=>S.sec[p]);
  if(opts.images&&opts.images.length)order=order.filter(p=>p!=="groq");
  if(!order.length)throw {code:opts.images&&opts.images.length?"images_unavailable":"nokey"};
  const ctl=new AbortController();
  S.busy={msg:opts.msg||"",sub:opts.sub||"",t0:Date.now(),ctl,prov:""};render();
  const iv=setInterval(()=>{const el=document.getElementById("busyc");if(el&&S.busy)el.textContent=Math.round((Date.now()-S.busy.t0)/1000)+" s"+(S.busy.prov?" · "+S.busy.prov:"")},1000);
  let last=null;const errs=[];
  try{
    for(const p of order){S.busy.prov=AIP[p];
      try{const txt=await callAI(p,prompt,opts.images,ctl.signal);return parseJSONLoose(txt)}
      catch(e){if(ctl.signal.aborted)throw {code:"cancelled"};last=e;errs.push(AIP[p]+": "+shortErr(e));console.warn("AI",p,e)}}
    if(errs.length>1||(last&&last.code==="provider"))throw {code:"provider",list:errs};
    throw last||{code:"provider",list:errs}
  }finally{clearInterval(iv);S.busy=null;render()}}
function shortErr(e){if(!e)return "?";if(e.code==="invalid_json"||e.code==="empty_completion")return "bad answer";if(e.code==="images_unavailable")return "no images";let m="";try{const j=JSON.parse(e.detail||"{}");m=(j.error&&(j.error.message||j.error))||""}catch(x){m=e.detail||""}if(e.status===0||!e.status&&!m)return "network/blocked";return (e.status?e.status+" ":"")+String(m).slice(0,90)}
function filesToImages(files){return Promise.all((files||[]).map(f=>new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>{const s=String(fr.result);res({type:f.type||"image/jpeg",b64:s.slice(s.indexOf(",")+1)})};fr.onerror=rej;fr.readAsDataURL(f)})))}
function staplesText(){
  const lines=[];
  for(const id of Object.keys(S.prices).sort()){const p=S.prices[id];if(S.settings.pantry.includes(id))continue;const b=bestFor(id);if(!b)continue;
    let per,u;if(p.unit==="pcs"){per=b.it.price/b.it.qty;u="€/pc"}else{per=b.it.price/b.it.qty*1000;u=p.unit==="g"?"€/kg":"€/l"}
    lines.push(id+" | "+p.en+" | unit "+p.unit+" | pack "+b.it.qty+" "+p.unit+(p.loose?" (loose)":"")+" | "+per.toFixed(2)+" "+u+(b.it.offer?" | OFFER":"")+(p.pcs_g?" | 1 pc ≈ "+p.pcs_g+" g":""))}
  return lines.join("\n")}
function pantryText(){return S.settings.pantry.map(id=>S.prices[id]?S.prices[id].en:id).join(", ")}
const RECIPE_SHAPE='{"title":{"en":"Chicken coconut curry & rice","fi":"Kana-kookoscurry ja riisi"},"emoji":"🍛","color":"#f6d58f","minutes":30,"servings":2,"kcal":690,"protein":48,"carbs":70,"fat":24,"appliances":["stove"],"in_season":false,"veg":false,"ingredients":[{"id":"chicken_inner_fillet","name":{"en":"Chicken inner fillet","fi":"Kanan sisäfilee"},"qty":400,"unit":"g","emoji":"🍗"},{"id":"onions","name":{"en":"Onion","fi":"Sipuli"},"qty":1,"unit":"pcs","emoji":"🧅"},{"id":null,"name":{"en":"Fresh coriander","fi":"Tuore korianteri"},"qty":1,"unit":"pcs","emoji":"🌿","est_eur":1.5},{"id":null,"name":{"en":"Curry powder","fi":"Curryjauhe"},"qty":1,"unit":"tbsp","emoji":"🧂","pantry":true}],"steps":{"en":[{"text":"Cook the rice.","timer":15}],"fi":[{"text":"Keitä riisi.","timer":15}]}}';
function ingredientRules(){return "INGREDIENT RULES\n- qty is for the whole recipe (all of its servings). Units: g, ml, pcs, tbsp or tsp.\n- When an ingredient matches a price line, set \"id\" to that id and use that line's unit family (g / ml / pcs; items with '1 pc ≈ N g' may use pcs).\n- Otherwise set id null and est_eur to your estimate of what the amount used costs in a Finnish supermarket.\n- \"pantry\": true for salt, pepper, oil, dried herbs and spices and anything in the pantry list.\n- Names in English (en) and Finnish (fi). One food emoji per ingredient and per recipe; color is a soft pastel hex.\n- kcal, protein, carbs and fat are per serving. veg true only for vegetarian recipes. appliances only from the household list.\n- steps: 4–8 short concrete steps in English (en) and Finnish (fi); timer = whole minutes for waiting steps, else null."}
function prefsText(){
  const st=S.settings;const diet=st.diet.map(d=>T.en.dietO[d]).join(", ")||"no restrictions";
  return "- People: "+st.people+"\n- Appliances available (use only these): "+st.appliances.map(a=>T.en.appl[a]).join(", ")+
  "\n- Diet: "+diet+
  "\n- Goal: "+T.en.goalO[st.goal]+". Daily target per person "+st.kcal+" kcal and "+st.protein+" g protein."+
  "\n- Max cooking time per recipe: "+st.maxMinutes+" min."+
  (st.dislikes?"\n- Never use: "+st.dislikes:"")+
  (st.liked.length?"\n- Liked before: "+st.liked.slice(-12).join("; "):"")+
  (st.disliked.length?"\n- Do not suggest again: "+st.disliked.slice(-20).join("; "):"")}
function monthName(d){return d.toLocaleString("en",{month:"long"})}
function hostOf(u){try{return new URL(u).hostname.replace(/^www\./,"")}catch(e){return ""}}
function normRecipe(r){r=r||{};r.servings=Math.max(1,+r.servings||S.settings.people);r.ingredients=(r.ingredients||[]).filter(i=>i&&i.name).map(i=>{if(typeof i.name==="string")i.name={en:i.name,fi:i.name};i.qty=+i.qty||0;if(i.id&&!S.prices[i.id])i.id=null;return i});
  ["kcal","protein","carbs","fat","minutes"].forEach(k=>r[k]=Math.round(+r[k]||0));if(!r.title)r.title={en:"Recipe",fi:"Resepti"};if(typeof r.title==="string")r.title={en:r.title,fi:r.title};
  const st={};if(r.steps&&typeof r.steps==="object"&&!Array.isArray(r.steps)){for(const lg of ["en","fi"])if(Array.isArray(r.steps[lg]))st[lg]=r.steps[lg].filter(s=>s&&s.text).map(s=>({text:String(s.text),timer:s.timer?Math.round(+s.timer):null}))}
  else if(Array.isArray(r.steps))st[S.lang]=r.steps.filter(s=>s&&s.text).map(s=>({text:String(s.text),timer:s.timer?Math.round(+s.timer):null}));
  r.steps=st;delete r.key;return r}

/* ---------- planner: your recipe library first, AI only for new ideas ---------- */
const FISH=["salmon_fillet","frozen_salmon","frozen_fish","tuna_can"],MEAT=["chicken_strips","chicken_inner_fillet","minced_meat","minced_beef","pork","ham","cold_cuts"];
const DAIRY=["milk","eggs","butter","cheese","cream","whipping_cream","sour_cream","feta","mozzarella","quark","yogurt_natural"],GLUTEN=["pasta","toast_bread","rye_bread","tortillas","wheat_flour"];
function mainProtein(r){for(const i of r.ingredients||[])if(i.id&&(FISH.includes(i.id)||MEAT.includes(i.id)||i.id==="tofu"||i.id==="eggs"))return i.id.replace(/_.*$/,"");return "veg"}
function fits(r){
  const st=S.settings,ids=(r.ingredients||[]).map(i=>i.id).filter(Boolean);
  const hasMeat=ids.some(i=>MEAT.includes(i)),hasFish=ids.some(i=>FISH.includes(i));
  const vegOnly=st.diet.includes("vegetarian")||st.diet.includes("vegan")||(!st.diet.includes("meat")&&!st.diet.includes("fish"));
  if(vegOnly&&(hasMeat||hasFish||r.veg===false&&!ids.length))return false;
  if(!st.diet.includes("meat")&&hasMeat)return false;if(!st.diet.includes("fish")&&hasFish)return false;
  if(st.diet.includes("vegan")&&ids.some(i=>DAIRY.includes(i)))return false;
  if(st.diet.includes("gluten_free")&&ids.some(i=>GLUTEN.includes(i)))return false;
  if(st.diet.includes("no_pork")&&ids.some(i=>["pork","ham","minced_meat"].includes(i)))return false;
  if((r.appliances||[]).some(a=>!st.appliances.includes(a)))return false;
  if((r.minutes||0)>st.maxMinutes+10)return false;
  const tt=[r.title&&r.title.en,r.title&&r.title.fi];if(tt.some(x=>x&&st.disliked.includes(x)))return false;
  const dl=String(st.dislikes||"").toLowerCase().split(/[,;]/).map(s=>s.trim()).filter(Boolean);
  if(dl.length){const txt=(tt.join(" ")+" "+(r.ingredients||[]).map(i=>(i.name.en||"")+" "+(i.name.fi||"")).join(" ")).toLowerCase();if(dl.some(w=>txt.includes(w)))return false}
  return true}
function dinnerTarget(){const st=S.settings;if(st.mode==="twice")return {k:(st.kcal-st.breakfastKcal)/2,p:(st.protein-st.breakfastProtein)/2};return {k:st.kcal-st.breakfastKcal-st.lunchKcal,p:st.protein-st.breakfastProtein-st.lunchProtein}}
function scoreRecipe(r,ws){
  const tg=dinnerTarget(),rc=recipeCost(r);let s=rc.per*1.6;if(rc.offer)s-=1;
  s+=Math.abs((r.protein||0)-tg.p)*0.05+Math.abs((r.kcal||0)-tg.k)*0.003;
  if(r.lastUsed){const w=(new Date(ws)-new Date(r.lastUsed))/6048e5;if(w<1.5)s+=4;else if(w<3)s+=1.5}
  if(r.fav||(r.title&&S.settings.liked.includes(r.title.en)))s-=0.8;if(r.in_season)s-=0.3;
  return s+Math.random()*1.4}
function pickFromLibrary(n,ws,exclude){
  const ex=new Set(exclude||[]);
  const sorted=S.book.filter(r=>r.ingredients&&r.ingredients.length&&!ex.has(r._id)&&fits(r)).map(r=>({r,s:scoreRecipe(r,ws)})).sort((a,b)=>a.s-b.s);
  const out=[];const used=new Set();let last=null;
  for(let i=0;i<n;i++){const pk=sorted.find(x=>!used.has(x.r._id)&&mainProtein(x.r)!==last)||sorted.find(x=>!used.has(x.r._id));if(!pk)break;used.add(pk.r._id);out.push(pk.r);last=mainProtein(pk.r)}
  return out}
function scaled(r,sv){const c=clone(r);const f=sv/(r.servings||sv);c.ingredients=(c.ingredients||[]).map(i=>Object.assign(i,{qty:Math.round(i.qty*f*100)/100}));c.servings=sv;return c}
function newRecipesPrompt(n,chosen,ws){
  const st=S.settings;const tg=dinnerTarget();const lo=(S.plan&&S.plan.carry)||[];
  return "You create home dinner recipes for one household in "+(st.city||"Helsinki")+", Finland. Reply with ONLY one JSON object: {\"recipes\":[...]} with exactly "+n+" NEW recipes.\n\nHOUSEHOLD\n"+prefsText()+
  "\n- Each recipe: servings = "+st.people+", about "+Math.round(tg.k)+" kcal and "+Math.round(tg.p)+" g protein per serving."+
  "\n- Week starts "+ws+" ("+monthName(new Date(ws+"T12:00:00"))+"). Prefer produce in season in Finland this month; set in_season true for recipes built around it."+
  (lo.length?"\n- Left over from last week, use these first: "+lo.map(x=>x.name.en+" "+Math.round(x.left)+" "+x.unit).join(", "):"")+
  (chosen.length?"\n- Already planned this week (do not repeat, vary the protein): "+chosen.map(r=>r.title.en).join("; "):"")+
  "\n- Avoid these existing recipes too: "+S.book.slice(0,60).map(r=>r.title.en).join("; ")+
  "\n\nPRICES (id | name | unit | pack | price | OFFER). Build meals around cheap and OFFER items, and reuse whole packs across recipes.\n"+staplesText()+
  "\n\nPANTRY (already at home, free): "+pantryText()+"\n\n"+ingredientRules()+"\n\nRecipe shape:\n"+RECIPE_SHAPE}
function makeReminders(plan){
  const R=[];const ds=plan.days;const FROZ=["frozen_salmon","frozen_fish"];
  ds.forEach((d,i)=>{const r=plan.recipes[d.dinner];if(!r)return;const di=dayIdx(d.day);const prev=i>0&&dayIdx(ds[i-1].day)===di-1?ds[i-1].day:null;
    if(d.cook!==false){for(const x of (r.ingredients||[]).filter(x=>FROZ.includes(x.id))){
      const txt={en:"Move the "+String(x.name.en||"").toLowerCase()+" from the freezer to the fridge for "+T.en.days[di]+"'s dinner",fi:"Siirrä "+String(x.name.fi||"").toLowerCase()+" pakastimesta jääkaappiin ("+["maanantain","tiistain","keskiviikon","torstain","perjantain","lauantain","sunnuntain"][di]+" illallinen)"};
      R.push(prev?{day:prev,when:"evening",text:txt}:{day:d.day,when:"morning",text:txt})}}
    if(plan.mode==="twice"&&d.cook!==false&&i<ds.length-1)R.push({day:d.day,when:"evening",text:{en:"Pack the extra portions of "+r.title.en+" for tomorrow's lunch",fi:"Pakkaa ylimääräiset annokset ("+r.title.fi+") huomisen lounaaksi"}});
    if(d.storage==="freezer"&&prev)R.push({day:prev,when:"evening",text:{en:"Move tomorrow's box ("+r.title.en+") from the freezer to the fridge",fi:"Siirrä huomisen rasia ("+r.title.fi+") pakastimesta jääkaappiin"}})});
  return R.slice(0,14)}
async function makePlan(next){
  const st=S.settings;if(!st.days.length){toast(t("noDays"));return}
  if(!Object.keys(S.prices).length){toast(t("noPrices"));return}
  const ws0=mondayOf(new Date());if(next)ws0.setDate(ws0.getDate()+7);const ws=isoDate(ws0);
  const days=DAYS.filter(d=>st.days.includes(d));
  if(S.plan)S.plan.carry=leftovers();
  const mode=st.mode;const nR=mode==="prep"?Math.min(4,Math.max(1,Math.ceil(days.length/2))):days.length;
  const canAI=aiReady();const src=st.planSource||"auto";
  let fromLib=[],need=0;
  if(src==="ai"&&canAI)need=nR;
  else if(src==="library"||!canAI){fromLib=pickFromLibrary(nR,ws);need=canAI?nR-fromLib.length:0}
  else{const fresh=Math.min(nR,Math.max(0,+st.newPerWeek||0));fromLib=pickFromLibrary(nR-fresh,ws);need=nR-fromLib.length}
  if(!fromLib.length&&!need){toast(canAI?t("errGeneric"):t("needMore"),6000);return}
  let fresh=[],planNote="";
  if(need>0){
    try{const j=await ask(newRecipesPrompt(need,fromLib,ws),{msg:t("planning"),sub:fromLib.length?t("planningMix").replace("{a}",fromLib.length).replace("{b}",need):t("planningS")});
      if(!j||!Array.isArray(j.recipes)||!j.recipes.length)throw {code:"invalid_json"};fresh=j.recipes.slice(0,need).map(normRecipe)}
    catch(e){if(e&&e.code==="cancelled")return;
      const more=pickFromLibrary(need,ws,fromLib.map(r=>r._id));
      if(fromLib.length+more.length){fromLib=fromLib.concat(more);planNote=errText(e)+" "+t("usedLib")}else{toast(errText(e),8000);return}}}
  for(const r of fresh){r._id="a"+Date.now().toString(36)+uid6();r.kind="ai";r.savedAt=new Date().toISOString();S.book.unshift(clone(r))}
  let chosen=fromLib.concat(fresh);
  if(!chosen.length)return;
  // shuffle lightly so new ideas are spread across the week
  chosen=chosen.map((r,i)=>({r,k:i%2?i+0.5:i})).sort((a,b)=>a.k-b.k).map(x=>x.r);
  const recipes={},plDays=[];
  if(mode==="prep"){
    const per=chosen.map(()=>0);days.forEach((d,j)=>per[Math.min(chosen.length-1,Math.floor(j*chosen.length/days.length))]++);
    chosen.forEach((r,i)=>{const k="r"+(i+1);recipes[k]=Object.assign(scaled(r,st.people*Math.max(1,per[i])),{key:k,libId:r._id})});
    days.forEach((d,j)=>{const i=Math.min(chosen.length-1,Math.floor(j*chosen.length/days.length));plDays.push({day:d,dinner:"r"+(i+1),lunch:null,cook:false,storage:j<3?"fridge":"freezer"})});
  }else{
    days.forEach((d,j)=>{const r=chosen[j%chosen.length];const k="r"+(j+1);recipes[k]=Object.assign(scaled(r,st.people*(mode==="twice"?2:1)),{key:k,libId:r._id});
      plDays.push({day:d,dinner:k,lunch:mode==="twice"&&j>0?"r"+j:null,cook:true,storage:null})});
  }
  for(const r of chosen){const lib=libById(r._id);if(lib){lib.lastUsed=ws;lib.uses=(lib.uses||0)+1}}
  const plan={weekStart:ws,mode,createdAt:new Date().toISOString(),recipes,days:plDays,reminders:[],prep:null,done:{},bought:{},carry:[],source:{library:fromLib.length,ai:fresh.length}};
  plan.reminders=makeReminders(plan);
  S.plan=plan;
  if(mode==="prep"&&aiReady()){
    try{const list=Object.values(recipes).map(r=>"- "+r.title.en+" ("+r.servings+" servings, "+r.minutes+" min; appliances "+(r.appliances||[]).join("/")+")").join("\n");
      const j=await ask("Plan ONE home meal-prep session that cooks these recipes in parallel and ends with cooling, portioning into boxes and labelling. Reply with ONLY JSON {\"minutes\":total,\"steps\":[{\"at\":minutes from start,\"text\":{\"en\":\"\",\"fi\":\"\"},\"appliance\":\"oven\",\"timer\":minutes or null}]} with 6–12 steps.\nAppliances: "+st.appliances.map(a=>T.en.appl[a]).join(", ")+"\nRecipes:\n"+list,{msg:t("planning"),tier:"quick"});
      if(j&&Array.isArray(j.steps))plan.prep={minutes:Math.round(+j.minutes||90),steps:j.steps}}catch(e){}
  }
  if(mode==="prep"&&!plan.prep)plan.prep={minutes:Math.round(Object.values(recipes).reduce((s,r)=>s+(r.minutes||30),0)*0.8+20),steps:Object.values(recipes).map((r,i)=>({at:i*15,text:{en:"Start: "+r.title.en,fi:"Aloita: "+r.title.fi},appliance:(r.appliances||[])[0]||"stove",timer:r.minutes||null})).concat([{at:Object.keys(recipes).length*15+30,text:{en:"Cool, portion and label the boxes",fi:"Jäähdytä, annostele ja merkitse rasiat"},appliance:"",timer:null}])};
  savePlan();saveLibrary();S.view="plan";render();
  toast(planNote||t("planDone").replace("{a}",fromLib.length).replace("{b}",fresh.length),planNote?9000:4000)}
async function ensureSteps(r,where){
  if(r.steps&&r.steps[S.lang]&&r.steps[S.lang].length)return;
  const lib=r.libId&&libById(r.libId)||(where==="book"?r:null);
  if(lib&&lib.steps&&lib.steps[S.lang]&&lib.steps[S.lang].length){r.steps=r.steps||{};r.steps[S.lang]=clone(lib.steps[S.lang]);if(where==="plan")savePlan();render();return}
  const lang=S.lang==="fi"?"Finnish":"English";
  const ings=(r.ingredients||[]).map(i=>"- "+fmtQty(i.qty,i.unit)+" "+L(i.name)).join("\n");
  const p="Write clear cooking steps in "+lang+" for this home recipe. Reply with ONLY JSON: {\"steps\":[{\"text\":\"...\",\"timer\":15}]}. timer = whole minutes for a waiting step (simmer, bake, boil, rest), otherwise null. 4–9 steps, concrete, with temperatures. Appliances available: "+S.settings.appliances.map(a=>T.en.appl[a]).join(", ")+".\n\nRecipe: "+L(r.title)+" ("+r.servings+" servings, about "+r.minutes+" min)\nIngredients:\n"+ings;
  try{const j=await ask(p,{msg:t("writing"),tier:"quick"});
    if(!j||!Array.isArray(j.steps))throw {code:"invalid_json"};
    const steps=j.steps.filter(s=>s&&s.text).map(s=>({text:String(s.text),timer:s.timer?Math.round(+s.timer):null}));
    r.steps=r.steps||{};r.steps[S.lang]=steps;
    if(lib&&lib!==r){lib.steps=lib.steps||{};lib.steps[S.lang]=clone(steps)}
    if(where==="plan")savePlan();saveLibrary();render();
  }catch(e){if(e&&e.code!=="cancelled")toast(errText(e),5000)}}
function localAlts(dayKey){
  const d=S.plan.days.find(x=>x.day===dayKey);const inPlan=Object.values(S.plan.recipes).map(r=>r.libId);
  return pickFromLibrary(6,S.plan.weekStart,inPlan).map(r=>Object.assign(scaled(r,S.plan.recipes[d.dinner].servings),{libId:r._id,_lib:true}))}
async function findSwaps(dayKey){
  const d=S.plan.days.find(x=>x.day===dayKey);const cur=S.plan.recipes[d.dinner];
  const p="Suggest 4 alternative dinners to replace \""+L(cur.title)+"\" in a weekly plan in Finland. Reply with ONLY JSON {\"recipes\":[...]} using the recipe shape below. Make one cheaper, one faster, one higher in protein and one vegetarian. servings = "+S.settings.people+", portions near "+cur.kcal+" kcal.\n\nHOUSEHOLD\n"+prefsText()+"\n\nPRICES\n"+staplesText()+"\n\nPANTRY: "+pantryText()+"\n\n"+ingredientRules()+"\n\nRecipe shape:\n"+RECIPE_SHAPE+"\nDinners this week and existing recipes (avoid repeats): "+Object.values(S.plan.recipes).map(r=>r.title.en).concat(S.book.slice(0,40).map(r=>r.title.en)).join("; ");
  try{const j=await ask(p,{msg:t("finding")});if(!j||!Array.isArray(j.recipes))throw {code:"invalid_json"};
    S.ov.alts=j.recipes.map(normRecipe).map(r=>scaled(r,cur.servings)).concat((S.ov.alts||[]).filter(a=>a._lib));render()}
  catch(e){if(e&&e.code!=="cancelled")toast(errText(e),5000)}}
async function importRecipe(text,url,files){
  let page="";
  if(url&&S.sec.tavily&&!text.trim()){
    S.busy={msg:t("openingLink"),sub:hostOf(url),t0:Date.now()};render();
    try{const r=await fetch("https://api.tavily.com/extract",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+String(S.sec.tavily).trim()},body:JSON.stringify({urls:[url]})});
      if(r.ok){const j=await r.json();page=(j.results&&j.results[0]&&j.results[0].raw_content)||""}}catch(e){console.warn("tavily",e)}
    S.busy=null;render();
    if(!page){toast(t("errLink"),6000)}}
  const body=(text||"")+(page?"\n\n"+page:"");
  if(!body.trim()&&!(files&&files.length)){toast(t("errNeedInput"));return}
  let images=[];try{images=await filesToImages(files)}catch(e){}
  const p="Read the recipe in the text and/or images and convert it to JSON. Reply with ONLY JSON: {\"recipe\":{...}} using the recipe shape below plus \"servings_original\" (servings in the source) and \"source\":{\"name\":\"site or book name if known\"}. Scale ingredient quantities to "+S.settings.people+" servings and set servings to "+S.settings.people+". Include steps in both en and fi. If there is no recipe, reply {\"error\":\"no recipe\"}.\n\nPRICES (match ids where possible)\n"+staplesText()+"\n\nPANTRY: "+pantryText()+"\n\n"+ingredientRules()+"\n\nRecipe shape:\n"+RECIPE_SHAPE+(url?"\n\nSource link: "+url:"")+(body.trim()?"\n\nRECIPE TEXT:\n"+body.slice(0,12000):"");
  try{const j=await ask(p,{msg:t("reading"),images});
    if(!j||j.error||!j.recipe)throw {code:"norecipe"};
    const src=j.recipe.source;const r=normRecipe(j.recipe);
    r.source={name:(src&&src.name)||(url?hostOf(url):""),url:url||""};r.kind=url||images.length||r.source.name?"web":"mine";r.fav=true;
    S.ov={type:"recipe",from:"preview",r,servings:r.servings};render();
  }catch(e){if(e&&e.code==="cancelled")return;toast(e&&e.code==="norecipe"?t("errNoRecipe"):errText(e),6000)}}

/* ---------- timers ---------- */
const TM={list:[],iv:null,ac:null,lastBeep:0,wl:null};
function audio(){if(!TM.ac){try{TM.ac=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}}if(TM.ac&&TM.ac.state==="suspended")TM.ac.resume().catch(()=>{});return TM.ac}
function beep(kind){const ac=audio();if(!ac)return;const now=ac.currentTime;
  const pat=kind==="alarm"?[[880,0,.14,"square"],[880,.22,.14,"square"],[880,.44,.14,"square"],[660,.66,.3,"square"]]:kind==="chime"?[[660,0,.6,"sine"],[990,.22,.8,"sine"]]:[[1320,0,1.3,"sine"],[1760,0,.9,"sine"],[2640,0,.5,"sine"]];
  for(const [f,t0,d,type] of pat){const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(0.0001,now+t0);g.gain.exponentialRampToValueAtTime(type==="square"?0.12:0.3,now+t0+0.01);g.gain.exponentialRampToValueAtTime(0.0001,now+t0+d);o.connect(g);g.connect(ac.destination);o.start(now+t0);o.stop(now+t0+d+0.05)}}
function vib(p){if(S.settings.timers.vibrate&&navigator.vibrate){try{navigator.vibrate(p)}catch(e){}}}
function addTimer(label,sec,start,stepKey){
  if(!S.settings.timers.multi)TM.list=TM.list.filter(x=>x.state==="ring");
  const tm={id:uid6(),label,total:sec,left:sec,endAt:start?Date.now()+sec*1000:null,state:start?"run":"idle",warned:sec<=90,stepKey:stepKey||null};
  TM.list.push(tm);audio();if(!TM.iv)TM.iv=setInterval(tick,250);render();return tm}
function tick(){
  const now=Date.now();let ringing=false,changed=false;
  for(const x of TM.list){
    if(x.state==="run"){x.left=Math.max(0,(x.endAt-now)/1000);
      if(S.settings.timers.early&&!x.warned&&x.left<=60){x.warned=true;beep("chime");vib([80])}
      if(x.left<=0){x.state="ring";x.rangAt=now;changed=true;notifyRing(x)}}
    if(x.state==="ring"){ringing=true;const keep=S.settings.timers.ring||now-x.rangAt<6000;if(keep&&now-TM.lastBeep>1700){TM.lastBeep=now;if(S.settings.timers.sound!=="none")beep(S.settings.timers.sound);vib([220,90,220])}}}
  document.querySelectorAll("[data-tleft]").forEach(el=>{const x=TM.list.find(y=>y.id===el.dataset.tleft);if(x)el.textContent=mmss(x.left)});
  document.body.classList.toggle("flash",ringing&&S.settings.timers.flash&&Math.floor(now/450)%2===0);
  if(changed)render();
  if(!TM.list.length){clearInterval(TM.iv);TM.iv=null;document.body.classList.remove("flash")}}
function timerAct(id,act){const x=TM.list.find(y=>y.id===id);if(!x)return;audio();
  if(act==="toggle"){if(x.state==="ring"){TM.list=TM.list.filter(y=>y!==x)}else if(x.state==="run"){x.left=Math.max(0,(x.endAt-Date.now())/1000);x.state="pause";x.endAt=null}else{x.endAt=Date.now()+x.left*1000;x.state="run"}}
  else if(act==="plus"){x.left=60;x.total=60;x.endAt=Date.now()+60000;x.state="run";x.warned=true}
  else if(act==="del"){TM.list=TM.list.filter(y=>y!==x)}
  render()}
async function wakeOn(){if(!S.settings.timers.wake)return;try{if(navigator.wakeLock&&!TM.wl){TM.wl=await navigator.wakeLock.request("screen");TM.wl.addEventListener&&TM.wl.addEventListener("release",()=>{TM.wl=null})}}catch(e){}}
function wakeOff(){try{TM.wl&&TM.wl.release()}catch(e){}TM.wl=null}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&S.cook)wakeOn()});

/* ---------- theme ---------- */
function applyTheme(){const th=S.settings.theme;const el=document.documentElement;if(th==="light"||th==="dark")el.setAttribute("data-theme",th);else{if(origTheme)el.setAttribute("data-theme",origTheme);else el.removeAttribute("data-theme")}}

/* ---------- toast ---------- */
let toastT=null;
function toast(msg,ms){S.toast=msg;render();clearTimeout(toastT);toastT=setTimeout(()=>{S.toast=null;render()},ms||2600)}

/* ---------- icons ---------- */
const IC={
 today:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>',
 plan:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="M8 14h3M8 17h6"/></svg>',
 cookbook:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/><path d="M9 8h6"/></svg>',
 list:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 12h11L21 7H6.2"/></svg>',
 gear:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>'};

/* ---------- views ---------- */
function topbar(over,title,right){return '<div class="topbar"><div class="grow">'+(over?'<div class="over">'+over+"</div>":"")+"<h1>"+title+'</h1></div>'+(right||"")+'<button class="iconbtn" data-a="settings" aria-label="'+esc(t("settings"))+'">'+IC.gear+"</button></div>"}
function storePill(){const c=S.settings.primary;return '<span class="pill"><span class="logo '+c+'">'+c.replace("L","L")+"</span>"+esc(S.settings.storeNames[c]||CHN[c])+"</span>"}
function emptyPlan(){return '<div class="empty"><div class="big" aria-hidden="true">🥗</div><h2>'+t("noPlanT")+"</h2><p>"+t("noPlanP")+'</p><div style="display:grid;gap:8px"><button class="btn" data-a="makeplan" data-next="'+(new Date().getDay()%6===0||new Date().getDay()===5?1:0)+'">'+((new Date().getDay()%6===0||new Date().getDay()===5)?t("planNext"):t("planThis"))+'</button><button class="btn ghost" data-a="settings">'+t("prefs")+"</button></div></div>"}

function vToday(){
  const now=new Date();const di=(now.getDay()+6)%7;
  let h=topbar(esc(t("days")[di])+" "+dmy(now),esc(t("today")));
  h+='<div class="main" id="scroll">';
  if(!S.online)h+='<div class="note">'+t("offlineNow")+"</div>";
  if(!ghOn()&&!S.dismissConnect)h+='<div class="info"><b>'+t("connectT")+"</b><br>"+t("connectP")+'<div style="margin-top:8px"><button class="btn small" data-a="settings">'+t("settings")+"</button></div></div>";
  else if(S.syncErr)h+='<div class="note">'+esc(errText(S.syncErr))+' <button class="btn ghost small" data-a="syncnow">↻</button></div>';
  if(!S.plan){return h+emptyPlan()+"</div>"}
  const rel=todayRel();
  if(rel==="prepday"&&S.plan.prep){h+=prepCard(true)}
  const d=rel&&rel!=="prepday"?S.plan.days.find(x=>x.day===rel):null;
  if(d){const r=S.plan.recipes[d.dinner];const rc=recipeCost(r);
    h+='<div class="hero">'+plate(r,"lg")+'<div class="ov">'+tagsHtml(mealTags(r,d))+"<h3>"+esc(L(r.title))+'</h3><div class="meta"><b style="color:#fff">'+r.kcal+" kcal · "+r.protein+" g "+t("protein")+"</b> · "+r.minutes+" "+t("min")+" · "+eur(rc.per)+"/"+t("serving")+"</div></div></div>";
    h+='<div class="btnrow" style="margin-bottom:6px">'+(d.cook!==false?'<button class="btn" data-a="cook" data-day="'+d.day+'">▶ '+t("startCook")+"</button>":'<button class="btn" data-a="recipe" data-key="'+d.dinner+'" data-day="'+d.day+'">'+t("fromBox")+"</button>")+'<button class="btn ghost" style="flex:0 0 auto;width:auto" data-a="recipe" data-key="'+d.dinner+'" data-day="'+d.day+'">'+t("open")+"</button></div>";
    if(d.cook!==false)h+='<button class="btn ghost small" style="margin-bottom:8px" data-a="swap" data-day="'+d.day+'">⇄ '+t("swap")+"</button>";
  }else{
    const nx=S.plan.days.find(x=>planDate(x.day)>=new Date(new Date().setHours(0,0,0,0)));
    h+='<div class="card"><b>'+t("noDinner")+"</b>"+(nx?'<div class="small" style="margin-top:4px">'+t("nextUp")+": "+dayName(nx.day)+" · "+esc(L(S.plan.recipes[nx.dinner].title))+"</div>":"")+"</div>";
    if(!nx&&rel!=="prepday")h+='<button class="btn" data-a="makeplan" data-next="'+(planDate("sun")<new Date()?0:1)+'">'+t("planNext")+"</button>";
  }
  const rem=(S.plan.reminders||[]).map((r,i)=>Object.assign({i},r)).filter(r=>r.day===rel||(rel==="prepday"&&r.day==="prep"));
  if(rem.length){h+="<h2>"+t("reminders")+'</h2><div class="card tight">'+rem.map(r=>{const k="r"+r.i;const on=!!S.plan.done[k];return '<div class="li"><span class="ic" aria-hidden="true">'+(r.when==="evening"?"🌙":"☀️")+'</span><div class="tx"><b>'+esc(L(r.text))+"</b><small>"+(r.when==="evening"?(S.lang==="fi"?"Illalla":"Evening"):(S.lang==="fi"?"Aamulla":"Morning"))+'</small></div><button class="ck" role="checkbox" aria-checked="'+on+'" aria-label="'+esc(L(r.text))+'" data-a="done" data-k="'+k+'"></button></div>'}).join("")+"</div>"}
  if(d&&d.lunch){const lr=S.plan.recipes[d.lunch];h+="<h2>"+t("lunchToday")+'</h2><button class="lrow card" style="padding:12px" data-a="recipe" data-key="'+d.lunch+'">'+plate(lr,"sm")+'<span class="n">'+esc(L(lr.title))+"<small>"+t("leftover")+"</small></span><span class=\"r\"><b>"+lr.kcal+" kcal</b>"+lr.protein+" g</span></button>"}
  const lo=leftovers();
  if(lo.length){h+="<h2>"+t("useSoon")+'</h2><div class="card tight">'+lo.slice(0,6).map(x=>'<div class="li"><span class="ic" aria-hidden="true">'+esc(x.emoji)+'</span><div class="tx"><b>'+esc(L(x.name))+", "+fmtQty(x.left,x.unit)+"</b><small>"+t("leftAfter")+". "+t("nextPlanUses")+"</small></div></div>").join("")+"</div>"}
  const sh=shopping();if(sh){const pct=Math.min(100,sh.total/S.settings.budget*100);h+='<h2>'+t("week")+" "+isoWeek(new Date(S.plan.weekStart+"T12:00:00"))+'</h2><div class="stat2"><div class="tile"><div class="k">'+t("estCost")+"</div><b class=\"num\">"+eur(sh.total)+" <small>/ "+eur(S.settings.budget)+'</small></b><div class="bar"><i class="'+(pct>=100?"over":"")+'" style="width:'+pct+'%"></i></div></div><button class="tile sky" style="text-align:left" data-a="go" data-v="list"><div class="k">'+t("shopping")+'</div><b>'+t("list")+'</b><div class="small">'+Object.values(S.plan.bought||{}).filter(Boolean).length+"/"+(sh.items.length+sh.others.length)+" "+t("bought")+"</div></button></div>"}
  return h+"</div>"}

function prepCard(today){
  const p=S.plan.prep;if(!p)return"";
  const boxes=S.plan.days.map(d=>'<div class="'+(d.storage==="freezer"?"fz":"")+'"><b>'+dayName(d.day,true)+"</b>"+esc(L(S.plan.recipes[d.dinner].title).split(/[ ,&]/)[0])+"<br>"+(d.storage==="freezer"?"❄ ":"")+t(d.storage||"fridge")+"</div>").join("");
  return '<div class="gcard"><div class="over">'+(today?t("prepToday"):t("prepSession")+" · "+t("dayBefore"))+'</div><div class="row"><b style="font-family:var(--f-display);font-size:24px;font-weight:600">'+Math.floor(p.minutes/60)+" h "+(p.minutes%60)+' min</b><span class="small">'+S.plan.days.length*S.settings.people+" "+t("portions")+'</span></div><div class="box4" style="margin:10px 0">'+boxes+'</div><button class="btn" data-a="cookprep">▶ '+t("startPrep")+"</button></div>"}

function vPlan(){
  let h=topbar(S.plan?t("week")+" "+isoWeek(new Date(S.plan.weekStart+"T12:00:00"))+" · "+dmy(new Date(S.plan.weekStart+"T12:00:00"))+"–"+dmy(planDate("sun")):"",esc(t("plan")));
  h+='<div class="main" id="scroll">';
  const st=S.settings;
  h+='<div class="seg" role="group" style="margin-bottom:6px">'+[["daily","modeDaily"],["twice","modeTwice"],["prep","modePrep"]].map(m=>'<button aria-pressed="'+(st.mode===m[0])+'" data-a="mode" data-v="'+m[0]+'">'+t(m[1])+"</button>").join("")+"</div>";
  if(S.plan&&S.plan.mode!==st.mode)h+='<div class="small" style="margin:0 4px 8px">'+t("modeNote")+"</div>";
  if(!S.plan)return h+'<div style="height:8px"></div>'+emptyPlan()+"</div>";
  const sh=shopping();const wn=weekNut();const pct=Math.min(100,sh.total/st.budget*100);const ou=offersUsed();
  h+='<div class="stat2" style="margin-top:8px"><div class="tile"><div class="k">'+t("estCost")+'</div><b class="num">'+eur(sh.total)+" <small>/ "+eur(st.budget)+'</small></b><div class="bar"><i class="'+(pct>=100?"over":"")+'" style="width:'+pct+'%"></i></div>'+(ou?'<div class="small" style="color:var(--offer);font-weight:800;margin-top:4px">🏷 '+ou+" "+t("offersUsed")+"</div>":"")+'</div><div class="tile sky"><div class="k">'+t("avgDay")+'</div><b class="num">'+nf(wn.kcal)+' <small>kcal</small></b><div class="small">'+nf(wn.protein)+" g "+t("protein")+" · "+st.kcal+" / "+st.protein+"</div></div></div>";
  if(S.plan.prep)h+=prepCard(false);
  h+='<div class="row" style="margin:4px 0 10px"><h2 style="margin:0">'+storePill()+'</h2><div class="seg" style="width:170px"><button aria-pressed="'+(S.planView==="cards")+'" data-a="pv" data-v="cards">'+t("cards")+'</button><button aria-pressed="'+(S.planView==="list")+'" data-a="pv" data-v="list">'+t("listv")+"</button></div></div>";
  if(S.planView==="cards"){
    for(const d of S.plan.days){const r=S.plan.recipes[d.dinner];const rc=recipeCost(r);const lr=d.lunch&&S.plan.recipes[d.lunch];
      h+='<div style="position:relative"><button class="meal" data-a="recipe" data-key="'+d.dinner+'" data-day="'+d.day+'"><span class="dayp">'+dayName(d.day)+"</span>"+plate(r)+'<span class="grow"><span class="mt">'+esc(L(r.title))+"</span>"+tagsHtml(mealTags(r,d))+'<span class="meta" style="display:block"><span class="kc">🔥 '+r.kcal+" kcal</span> · 💪 "+r.protein+" g · ⏱ "+r.minutes+" "+t("min")+'</span><span class="meta" style="display:block">👤 '+st.people+" · <b>"+eur(rc.per*st.people)+"</b> ("+eur(rc.per)+"/"+t("serving")+")"+(rc.est?" *":"")+"</span>"+(lr?'<span class="meta" style="display:block">🥡 '+t("lunch")+": "+esc(L(lr.title))+"</span>":"")+"</span></button>"+(d.cook!==false?'<button class="swapbtn" data-a="swap" data-day="'+d.day+'">⇄ '+t("swap")+"</button>":"")+"</div>"}
  }else{
    h+='<div class="card tight">'+S.plan.days.map(d=>{const r=S.plan.recipes[d.dinner];const rc=recipeCost(r);const tg=mealTags(r,d).map(x=>x[1]).join(", ");return '<button class="lrow" data-a="recipe" data-key="'+d.dinner+'" data-day="'+d.day+'"><span class="d">'+dayName(d.day,true)+'</span><span class="n">'+esc(L(r.title))+"<small>"+r.minutes+" "+t("min")+" · "+r.protein+" g "+t("protein")+(tg?" · "+esc(tg):"")+'</small></span><span class="r"><b>'+r.kcal+" kcal</b>"+eur(rc.per*st.people)+"</span></button>"}).join("")+"</div>";
  }
  h+=nutritionCard();
  h+='<div style="display:grid;gap:8px;margin-top:12px"><button class="btn ghost" data-a="makeplan" data-next="0">↻ '+t("planThis")+'</button><button class="btn ghost" data-a="makeplan" data-next="1">'+t("planNext")+"</button></div>";
  h+='<p class="small" style="margin:12px 4px">'+t("priceSrc")+(Object.values(S.plan.recipes).some(r=>recipeCost(r).est)?" * "+t("estNote")+".":"")+"</p>";
  return h+"</div>"}

function nutritionCard(){
  if(!S.plan)return"";const st=S.settings;const max=Math.max(st.kcal*1.25,...S.plan.days.map(d=>dayNut(d).kcal))*1.05;
  let bars="";const prot=[];
  for(const dk of DAYS){const d=S.plan.days.find(x=>x.day===dk);if(!d){bars+='<div class="c"><div class="b none" style="height:4%"></div>'+dayName(dk,true)+"</div>";prot.push('<span class="plow" style="opacity:.3">–</span>');continue}
    const n=dayNut(d);bars+='<div class="c" title="'+n.kcal+' kcal"><div class="b'+(n.kcal>st.kcal*1.08?" over":"")+'" style="height:'+(n.kcal/max*85)+'%"></div>'+dayName(dk,true)+"</div>";prot.push('<span class="'+(n.protein>=st.protein*0.95?"pok":"plow")+'">'+n.protein+"</span>")}
  return '<div class="card" style="margin-top:12px"><div class="row"><b>'+t("nutrition")+'</b><span class="small">'+t("perPerson")+'</span></div><div class="small">'+t("kcalDay")+'</div><div class="chart"><div class="tl" style="bottom:calc('+(st.kcal/max*85*0.97)+'% + 18px)">'+st.kcal+"</div>"+bars+'</div><div class="small" style="margin-top:8px">'+t("protDay")+" ("+st.protein+' g)</div><div class="prot">'+prot.join("")+"</div></div>"}

function vBook(){
  let h=topbar("",esc(t("cookbook")));h+='<div class="main" id="scroll">';
  h+='<div class="ybox"><h2>'+t("saveRecipe")+"</h2><p>"+t("saveRecipeP")+'</p><div class="chips"><button data-a="import" data-v="link">🔗 '+t("pasteLink")+"</button>"+(S.canImg?'<button data-a="import" data-v="shot">📷 '+t("photo")+"</button>":"")+'<button data-a="import" data-v="write">✏️ '+t("write")+"</button></div></div>";
  h+='<label class="sr" for="bookq">'+t("search")+'</label><input id="bookq" class="search" type="search" placeholder="🔍 '+esc(t("search"))+'" value="'+esc(S.bookQ)+'" data-in="bookQ">';
  h+='<div class="chips" style="margin-bottom:12px">'+[["all","all"],["fav","favourites"],["web","fromWeb"],["mine","mine"],["ai","fromAi"]].map(f=>'<button class="chip" aria-pressed="'+(S.bookFilter===f[0])+'" data-a="bf" data-v="'+f[0]+'">'+t(f[1])+(f[0]==="all"?" "+S.book.length:"")+"</button>").join("")+"</div>";
  let list=S.book.slice();const q=S.bookQ.trim().toLowerCase();
  if(q)list=list.filter(r=>(L(r.title)+" "+(r.ingredients||[]).map(i=>L(i.name)).join(" ")).toLowerCase().includes(q));
  if(S.bookFilter==="fav")list=list.filter(r=>r.fav);if(S.bookFilter==="ai")list=list.filter(r=>r.kind==="ai"||r.kind==="starter");if(S.bookFilter==="web")list=list.filter(r=>r.kind==="web");if(S.bookFilter==="mine")list=list.filter(r=>r.kind==="mine");
  if(!list.length)h+='<div class="empty"><div class="big" aria-hidden="true">📖</div><p>'+t("emptyBook")+"</p></div>";
  else h+='<div class="grid2">'+list.map(r=>{const rc=recipeCost(r,S.settings.people);const src=(r.fav?"♥ ":"")+(r.kind==="mine"?"✏️ "+t("mine"):r.source&&r.source.name?"🔗 "+r.source.name:r.kind==="starter"?"⭐ "+t("starter"):"✨ AI");return '<button class="rc" data-a="bookopen" data-id="'+esc(r._id)+'"><div style="position:relative">'+plate(r,"full")+'<span class="src">'+esc(src)+"</span></div><b>"+esc(L(r.title))+'</b><span class="meta">'+r.minutes+" "+t("min")+" · "+r.kcal+" kcal · "+eur(rc.per)+"</span></button>"}).join("")+"</div>";
  return h+"</div>"}

function vList(){
  const sh=shopping();
  let h='<div class="topbar"><div class="grow"><h1>'+t("shopping")+'</h1></div><span class="offline'+(S.online?"":" off")+'">'+(S.online?"✓ "+t("offlineOk"):t("offlineNow"))+"</span></div>";
  h+='<div class="main" id="scroll"><div class="seg" style="margin-bottom:12px"><button aria-pressed="'+(S.listTab==="list")+'" data-a="lt" data-v="list">'+t("list")+(sh?" · "+Object.values(S.plan.bought||{}).filter(Boolean).length+"/"+(sh.items.length+sh.others.length):"")+'</button><button aria-pressed="'+(S.listTab==="prices")+'" data-a="lt" data-v="prices">'+t("prices")+"</button></div>";
  if(S.listTab==="prices")return h+pricesTab()+"</div>";
  if(!sh)return h+'<div class="empty"><div class="big" aria-hidden="true">🛒</div><p>'+t("noList")+'</p><button class="btn" data-a="go" data-v="plan">'+t("plan")+"</button></div></div>";
  const cmp=comparison();
  if(cmp&&cmp.rows.length){const min=Math.min(...cmp.rows.map(r=>r.total),cmp.mix);h+='<div class="card"><b>'+t("cheapest")+'</b><div class="cmp" style="margin-top:8px">'+cmp.rows.map(r=>'<span><span class="logo '+r.c+'" style="margin-right:6px">'+r.c+"</span>"+t("allAt")+" "+esc(S.settings.storeNames[r.c]||CHN[r.c])+(r.miss?' <span class="small">('+r.miss+" "+t("missing")+")</span>":"")+'</span><b class="num'+(Math.abs(r.total-min)<0.005?" best":"")+'">'+eur(r.total)+"</b>").join("")+(enabledChains().length>1?"<span>"+t("mix")+'</span><b class="num'+(Math.abs(cmp.mix-min)<0.005?" best":"")+'">'+eur(cmp.mix)+"</b>":"")+"</div></div>"}
  h+='<button class="btn ghost small" style="margin-bottom:4px" data-a="copylist">'+t("copy")+"</button>";
  const groups={};for(const x of sh.items){const c=catOf(x.p);(groups[c]=groups[c]||[]).push(x)}
  let n=0;
  for(const c of CAT_ORDER){const g=groups[c];if(!g||!g.length)continue;n++;
    g.sort((a,b)=>(!!S.plan.bought[a.id])-(!!S.plan.bought[b.id]));
    h+='<div class="cat"><span class="n">'+n+"</span>"+esc(t("cat")[c])+'</div><div class="card tight">'+g.map(x=>{const on=!!S.plan.bought[x.id];const pk=x.missing?"–":x.p.loose?"~"+fmtQty(x.qty,x.p.unit):(x.packs>1?x.packs+" × ":"")+fmtQty(x.it.qty,x.p.unit);
      return '<div class="item'+(on?" done":"")+'"><span class="em" aria-hidden="true">'+esc(x.p.emoji)+'</span><div class="nm">'+esc(L(x.p))+(x.offer?' <span class="tag t-off">'+t("offer")+"</span>":"")+"<small>"+fmtQty(x.qty,x.p.unit)+" "+t("needed")+(x.c&&x.c!==S.settings.primary?" · "+esc(S.settings.storeNames[x.c]||CHN[x.c]):"")+'</small></div><div class="pk">'+pk+'<b class="num">'+(x.missing?"–":eur(x.cost))+'</b></div><button class="ck" role="checkbox" aria-checked="'+on+'" aria-label="'+esc(L(x.p))+'" data-a="buy" data-k="'+x.id+'"></button></div>'}).join("")+"</div>"}
  if(sh.others.length){h+='<div class="cat"><span class="n">'+(n+1)+"</span>"+t("other")+'</div><div class="card tight">'+sh.others.map(o=>{const on=!!S.plan.bought[o.key];return '<div class="item'+(on?" done":"")+'"><span class="em" aria-hidden="true">'+esc(o.emoji||"🛒")+'</span><div class="nm">'+esc(L(o.name))+"<small>"+esc(o.qty.join(" + "))+'</small></div><div class="pk">'+(o.est?t("est")+'<b class="num">'+eur(o.est)+'</b>':"–")+'</div><button class="ck" role="checkbox" aria-checked="'+on+'" aria-label="'+esc(L(o.name))+'" data-a="buy" data-k="'+esc(o.key)+'"></button></div>'}).join("")+"</div>"}
  if(S.copyText)h+='<label class="sr" for="copyta">'+t("copy")+'</label><p class="small">'+t("copyFallback")+'</p><textarea id="copyta" class="search" style="border-radius:14px;min-height:200px" readonly>'+esc(S.copyText)+"</textarea>";
  return h+'<p class="small" style="margin:12px 4px">'+t("priceSrc")+"</p></div>"}

function pricesTab(){
  const ids=Object.keys(S.prices);if(!ids.length)return '<div class="empty"><p>'+t("noPrices")+"</p></div>";
  let h="";
  const inPlan=S.plan?shopping().items.filter(x=>x.offer):[];
  const allOffers=ids.filter(id=>CH.some(c=>S.prices[id].items[c]&&S.prices[id].items[c].offer));
  const offs=inPlan.length?inPlan.map(x=>x.id):allOffers;
  if(offs.length){h+="<h2>🏷 "+t("offersPlan")+'</h2><div class="card tight">'+offs.map(id=>{const p=S.prices[id];const c=CH.find(c=>p.items[c]&&p.items[c].offer);const it=p.items[c];return '<div class="li"><span class="ic" aria-hidden="true">'+esc(p.emoji)+'</span><div class="tx"><b>'+esc(it.product)+"</b><small>"+esc(S.settings.storeNames[c]||CHN[c])+'</small></div><b class="num" style="color:var(--offer)">'+eur(it.price)+"</b></div>"}).join("")+"</div>"}
  const upd=S.meta&&S.meta.updated;
  h+='<div class="row" style="margin:16px 2px 8px"><h2 style="margin:0">'+t("allStaples")+"</h2>"+(upd?'<span class="small">'+t("updated")+" "+dmy(new Date(upd+"T12:00:00"))+"</span>":"")+"</div>";
  h+='<label class="sr" for="priceq">'+t("search")+'</label><input id="priceq" class="search" type="search" placeholder="🔍 '+esc(t("search"))+'" value="'+esc(S.priceQ)+'" data-in="priceQ">';
  h+='<div class="chips" style="margin-bottom:10px">'+["all","veg","meat","dairy","frozen","dry","bakery","pantry"].map(c=>'<button class="chip" aria-pressed="'+(S.priceCat===c)+'" data-a="pc" data-v="'+c+'">'+(c==="all"?t("all"):esc(t("cat")[c]))+"</button>").join("")+"</div>";
  let list=ids.map(id=>S.prices[id]);const q=S.priceQ.trim().toLowerCase();
  if(S.priceCat!=="all")list=list.filter(p=>p.cat===S.priceCat);if(q)list=list.filter(p=>(p.en+" "+p.fi+" "+CH.map(c=>p.items[c]?p.items[c].product:"").join(" ")).toLowerCase().includes(q));
  list.sort((a,b)=>CAT_ORDER.indexOf(a.cat)-CAT_ORDER.indexOf(b.cat)||L(a).localeCompare(L(b)));
  h+='<div class="card" style="padding:6px 10px"><div class="tablewrap"><table class="ptable"><thead><tr><th>'+(S.lang==="fi"?"Tuote":"Item")+"</th>"+CH.map(c=>'<th><span class="logo '+c+'">'+c+"</span></th>").join("")+"</tr></thead><tbody>"+list.map(p=>{
    const per=c=>{const it=p.items[c];return it?it.price/it.qty:null};let best=null;CH.forEach(c=>{const v=per(c);if(v!=null&&(best==null||v<per(best)))best=c});
    return "<tr><td>"+esc(p.emoji)+" "+esc(L(p))+"<small>"+esc((p.items.S||p.items.K||p.items.L).product)+"</small></td>"+CH.map(c=>{const it=p.items[c];if(!it)return '<td class="na">—</td>';const u=p.unit==="pcs"?"/"+(S.lang==="fi"?"kpl":"pc"):p.unit==="g"?"/kg":"/l";const pv=p.unit==="pcs"?it.price/it.qty:it.price/it.qty*1000;
      return '<td class="num'+(c===best?" best":"")+(it.offer?" off":"")+'">'+(it.url?'<a href="'+esc(it.url)+'" target="_blank" rel="noopener" style="color:inherit">'+nf(it.price,2)+"</a>":nf(it.price,2))+"<small>"+nf(pv,2)+u+(it.source==="wolt"?" · Wolt":"")+"</small></td>"}).join("")+"</tr>"}).join("")+"</tbody></table></div></div>";
  return h+'<p class="small" style="margin:10px 4px">'+t("priceSrc")+"</p>"}

/* ---------- overlays ---------- */
function ovRecipe(){
  const o=S.ov;let r=o.r||(o.key&&S.plan&&S.plan.recipes[o.key])||(o.bookId&&S.book.find(b=>b._id===o.bookId));
  if(!r){S.ov=null;return""}
  const sv=o.servings||r.servings;const f=sv/(r.servings||1);const rc=recipeCost(r,sv);
  const day=o.day&&S.plan?S.plan.days.find(d=>d.day===o.day):null;
  const title=L(r.title);const st=S.settings;const liked=st.liked.includes(title),dis=st.disliked.includes(title);
  const libE=(r.libId&&libById(r.libId))||(o.bookId&&libById(o.bookId))||S.book.find(b=>L(b.title)===title);const inBook=!!(libE&&libE.fav);
  let h='<div class="sheet" role="dialog" aria-label="'+esc(title)+'"><div class="main" style="padding-top:12px">';
  h+='<div class="hero">'+plate(r,"lg")+'<button class="corner" style="left:12px" data-a="close" aria-label="'+t("close")+'">←</button>'+(o.from!=="preview"?'<button class="corner" style="right:12px" data-a="fav" aria-label="'+t("saveBook")+'">'+(inBook?"♥":"♡")+"</button>":"")+'<div class="ov">'+tagsHtml(mealTags(r,day))+"<h3>"+esc(title)+'</h3><div class="meta">'+(day?dayName(day.day)+" · ":"")+r.minutes+" "+t("min")+(r.source&&r.source.name?" · "+esc(r.source.name):"")+"</div></div></div>";
  h+='<div class="gcard"><div class="stats6"><div><div class="e">🔥</div><b>'+r.kcal+'</b><span>KCAL</span></div><div><div class="e">⏱</div><b>'+r.minutes+"m</b><span>"+t("time").toUpperCase()+'</span></div><div><div class="e">👥</div><b>'+sv+"</b><span>"+t("serves").toUpperCase()+'</span></div><div><div class="e">🌾</div><b>'+r.carbs+"g</b><span>"+t("carbs").toUpperCase()+'</span></div><div><div class="e">🥩</div><b>'+r.protein+"g</b><span>"+t("protein").toUpperCase()+'</span></div><div><div class="e">💧</div><b>'+r.fat+"g</b><span>"+t("fat").toUpperCase()+"</span></div></div>";
  h+='<div class="small" style="text-align:center;margin-top:6px">'+t("perServing")+'</div><div class="thumbs"><button aria-pressed="'+liked+'" aria-label="'+t("like")+'" data-a="like" data-v="1">👍</button><button aria-pressed="'+dis+'" aria-label="'+t("dislike")+'" data-a="like" data-v="0">👎</button></div></div>';
  h+='<div class="card row"><div class="stepper"><button data-a="sv" data-v="-1" aria-label="−">−</button><b>'+sv+'</b><button data-a="sv" data-v="1" aria-label="+">+</button></div><div style="text-align:right"><b class="num" style="font-size:19px">'+eur(rc.total)+'</b><div class="small">'+eur(rc.per)+" / "+t("serving")+(rc.est?" *":"")+"</div></div></div>";
  if(S.plan&&S.plan.mode==="twice"&&day&&day.cook!==false&&r.servings>S.settings.people)h+='<div class="info">🍱 '+t("cookTwice")+": "+(r.servings-S.settings.people)+" "+t("portions")+" → "+t("lunch")+"</div>";
  h+="<h2>"+t("ingredients")+'</h2><div class="gcard" style="padding:4px 14px">';
  const pantry=[];
  for(const i of r.ingredients||[]){const x=ingInfo(i,f);if(x.pantry){pantry.push(L(i.name));continue}
    h+='<div class="ing"><span class="em" aria-hidden="true">'+esc(i.emoji||"•")+'</span><span class="nm">'+esc(L(i.name))+(x.offer?' <span class="tag t-off">'+t("offer")+"</span>":"")+'</span><span class="amt">'+fmtQty(i.qty*f,i.unit)+'</span><span class="c num">'+(x.est?(x.cost?"~"+eur(x.cost):"–"):eur(x.cost))+"</span></div>"}
  h+="</div>";if(pantry.length)h+='<div class="small" style="margin:-4px 4px 10px">'+t("pantryNote")+": "+esc(pantry.join(", "))+"</div>";
  h+="<h2>"+t("steps")+"</h2>";
  const steps=r.steps&&r.steps[S.lang];
  if(steps&&steps.length)h+='<div class="card"><ol class="steps">'+steps.map(s=>"<li><span>"+esc(s.text)+(s.timer?'<span class="tmr">⏱ '+s.timer+" "+t("min")+"</span>":"")+"</span></li>").join("")+"</ol></div>";
  else h+='<button class="btn ghost" data-a="getsteps">✍️ '+t("getSteps")+"</button>";
  if(r.source&&r.source.url)h+='<p class="small" style="margin:10px 4px">'+t("source")+': <a href="'+esc(r.source.url)+'" target="_blank" rel="noopener" style="color:var(--leaf)">'+esc(r.source.name||r.source.url)+"</a></p>";
  let extra="";
  h+='<div class="sticky">';
  if(o.from==="preview"){h+='<button class="btn" data-a="savepreview">♥ '+t("saveBook")+"</button>";extra=addWeekCtl()}
  else if(o.from==="book"){h+='<button class="btn" data-a="cookr">▶ '+t("startCook")+"</button>";extra=addWeekCtl()+'<button class="btn danger small" style="width:100%;margin-top:8px" data-a="delbook">'+(S.confirm==="delbook"?t("confirmDel"):t("remove"))+"</button>"}
  else{if(!day||day.cook!==false)h+='<button class="btn" data-a="cookr">▶ '+t("startCook")+"</button>";if(day&&day.cook!==false)extra='<button class="btn ghost" data-a="swap" data-day="'+day.day+'">⇄ '+t("swap")+"</button>"}
  h+="</div>"+(extra?'<div style="margin-top:8px">'+extra+"</div>":"")+"</div></div>";return h}
function addWeekCtl(){if(!S.plan)return"";return '<div class="row"><label class="sr" for="addday">'+t("chooseDay")+'</label><select id="addday" class="search" style="margin:0;flex:1">'+S.plan.days.map(d=>'<option value="'+d.day+'">'+dayName(d.day)+" · "+esc(L(S.plan.recipes[d.dinner].title))+"</option>").join("")+'</select><button class="btn ghost small" data-a="addweek">'+t("addWeek")+"</button></div>"}

function ovSwap(){
  const o=S.ov;const d=S.plan.days.find(x=>x.day===o.day);const cur=S.plan.recipes[d.dinner];const cc=recipeCost(cur).per;
  let h='<div class="dim" data-a="close"></div><div class="half" role="dialog" aria-label="'+t("swapT")+'"><div class="grab"></div><div class="main" style="padding-top:4px"><div class="row"><b style="font-size:18px">'+t("swapT")+" · "+dayName(o.day)+'</b><button class="iconbtn" data-a="close" aria-label="'+t("close")+'">✕</button></div><div class="small" style="margin-bottom:10px">'+t("now")+": "+esc(L(cur.title))+" · "+eur(cc)+"/"+t("serving")+" · "+cur.kcal+" kcal</div>";
  if(!o.alts){h+='<button class="btn" data-a="findswaps">✨ '+t("suggest")+"</button>"}
  else{
    h+='<div class="chips" style="margin-bottom:6px">'+[["all","all"],["cheaper","cheaper"],["faster","faster"],["prot","moreProt"],["veg","veggie"]].map(f=>'<button class="chip" aria-pressed="'+((o.filter||"all")===f[0])+'" data-a="swf" data-v="'+f[0]+'">'+t(f[1])+"</button>").join("")+"</div>";
    let alts=o.alts.map((r,i)=>({r,i,c:recipeCost(r).per}));const fl=o.filter||"all";
    if(fl==="cheaper")alts=alts.filter(a=>a.c<cc);if(fl==="faster")alts=alts.filter(a=>a.r.minutes<cur.minutes);if(fl==="prot")alts=alts.filter(a=>a.r.protein>cur.protein);if(fl==="veg")alts=alts.filter(a=>a.r.veg);
    h+=alts.map(a=>{const dc=a.c-cc,dk=a.r.kcal-cur.kcal;return '<button class="alt" data-a="pickalt" data-i="'+a.i+'">'+plate(a.r,"sm")+'<span class="tx"><b>'+esc(L(a.r.title))+"</b> "+tagsHtml(mealTags(a.r))+'<span class="small" style="display:block">'+a.r.minutes+" "+t("min")+" · "+a.r.kcal+" kcal · "+a.r.protein+" g "+t("protein")+'</span></span><span class="d '+(dc>0.004?"up":"dn")+'">'+(Math.abs(dc)<0.005?"±0 €":(dc>0?"+":"−")+eur(Math.abs(dc)))+"<small>"+(dk===0?"±0":(dk>0?"+":"−")+Math.abs(dk))+" kcal</small></span></button>"}).join("")||'<p class="small">–</p>';
    h+='<button class="btn ghost small" style="margin-top:8px" data-a="findswaps">✨ '+t("newIdeas")+"</button>"}
  if(S.book.some(r=>r.fav)){h+='<div class="sec">'+t("favourites")+"</div>"+S.book.filter(r=>r.fav).slice(0,8).map(r=>{const dc=recipeCost(r,cur.servings).per-cc;return '<button class="alt" data-a="pickbook" data-id="'+esc(r._id)+'">'+plate(r,"sm")+'<span class="tx"><b>'+esc(L(r.title))+'</b><span class="small" style="display:block">'+r.minutes+" "+t("min")+" · "+r.kcal+' kcal</span></span><span class="d '+(dc>0?"up":"dn")+'">'+(dc>0?"+":"−")+eur(Math.abs(dc))+"</span></button>"}).join("")}
  h+='<p class="small">'+(S.lang==="fi"?"Hinnat annosta kohden.":"Prices are per serving.")+"</p></div></div>";return h}

function ovImport(){
  const o=S.ov;
  let h='<div class="sheet" role="dialog" aria-label="'+t("importT")+'"><div class="sheettop"><button class="iconbtn" data-a="close" aria-label="'+t("close")+'">✕</button><h1>'+t("importT")+'</h1><span style="width:42px"></span></div><div class="main">';
  h+='<div class="field"><label for="imurl">'+t("link")+'</label><input id="imurl" type="url" inputmode="url" placeholder="https://" value="'+esc(o.url||"")+'"><span class="small">'+t("linkHint")+"</span></div>";
  h+='<div class="field"><label for="imtext">'+(o.v==="write"?t("write"):t("recipeText"))+'</label><textarea id="imtext" placeholder="'+esc(t("recipeTextHint"))+'">'+esc(o.text||"")+"</textarea></div>";
  if(S.canImg)h+='<div class="field"><label for="imfile">'+t("shot")+'</label><input id="imfile" type="file" accept="image/*" multiple></div>';
  h+='<button class="btn" data-a="doimport">✨ '+t("readRecipe")+"</button></div></div>";return h}

function chipSet(key,opts,labels){const cur=S.settings[key];return '<div class="chips">'+opts.map(v=>'<button class="chip" aria-pressed="'+(Array.isArray(cur)?cur.includes(v):cur===v)+'" data-a="tog" data-k="'+key+'" data-v="'+v+'">'+esc(labels[v]||v)+"</button>").join("")+"</div>"}
function sw(path,on,label,sub){return '<div class="set"><div class="tx">'+label+(sub?"<small>"+sub+"</small>":"")+'</div><button class="switch" role="switch" aria-checked="'+!!on+'" aria-label="'+esc(label)+'" data-a="sw" data-k="'+path+'"></button></div>'}
function ovSettings(){
  const st=S.settings,tm=st.timers;
  let h='<div class="sheet" role="dialog" aria-label="'+t("settings")+'"><div class="sheettop"><button class="iconbtn" data-a="close" aria-label="'+t("close")+'">✕</button><h1>'+t("settings")+'</h1><span style="width:42px"></span></div><div class="main">';
  h+='<div class="sec">'+t("lang")+'</div><div class="seg"><button aria-pressed="'+(st.lang==="en")+'" data-a="set" data-k="lang" data-v="en">English</button><button aria-pressed="'+(st.lang==="fi")+'" data-a="set" data-k="lang" data-v="fi">Suomi</button></div>';
  h+='<div class="sec">'+t("theme")+'</div><div class="seg">'+["auto","light","dark"].map(v=>'<button aria-pressed="'+(st.theme===v)+'" data-a="set" data-k="theme" data-v="'+v+'">'+t(v)+"</button>").join("")+"</div>";
  h+='<div class="sec">'+t("household")+'</div><div class="card row"><span>'+t("people")+'</span><div class="stepper"><button data-a="num" data-k="people" data-v="-1" aria-label="−">−</button><b>'+st.people+'</b><button data-a="num" data-k="people" data-v="1" aria-label="+">+</button></div></div>';
  h+='<div class="sec">'+t("stores")+'</div><div class="card">'+CH.map(c=>'<div class="set"><span class="logo '+c+'">'+c+'</span><div class="tx">'+CHN[c]+(c==="L"?"<small>"+(S.lang==="fi"?"Ei verkkohintoja vielä":"No online prices yet")+"</small>":"")+'</div><label class="sr" for="sn'+c+'">'+t("storeName")+'</label><input id="sn'+c+'" style="width:120px;border:1px solid var(--line);border-radius:10px;padding:8px;background:var(--surface)" value="'+esc(st.storeNames[c])+'" data-in="store" data-k="'+c+'"><button class="switch" role="switch" aria-checked="'+!!st.chains[c]+'" aria-label="'+CHN[c]+'" data-a="chain" data-k="'+c+'"></button></div>').join("")+
    '<div class="field" style="margin-top:10px"><label for="prim">'+t("primary")+'</label><select id="prim" data-ch="primary">'+enabledChains().map(c=>'<option value="'+c+'"'+(st.primary===c?" selected":"")+">"+esc(st.storeNames[c]||CHN[c])+"</option>").join("")+'</select></div><div class="field"><label for="city">'+t("city")+'</label><select id="city" data-ch="city">'+CITIES.map(c=>"<option"+(st.city===c?" selected":"")+">"+esc(c)+"</option>").join("")+'</select><button class="btn ghost small" data-a="gps">📍 '+t("useLoc")+'</button><span class="small">'+t("gpsNote")+"</span></div></div>";
  h+='<div class="sec">'+t("cookDays")+"</div>"+'<div class="chips">'+DAYS.map(d=>'<button class="chip" aria-pressed="'+st.days.includes(d)+'" data-a="tog" data-k="days" data-v="'+d+'">'+dayName(d,true)+"</button>").join("")+"</div>";
  h+='<div class="sec">'+t("budget")+'</div><div class="field"><label class="sr" for="budget">'+t("budget")+'</label><input id="budget" type="number" min="10" step="5" inputmode="numeric" value="'+st.budget+'" data-ch="budget"></div>';
  h+='<div class="sec">'+t("kitchen")+"</div>"+chipSet("appliances",APPL,t("appl"));
  h+='<div class="sec">'+t("diet")+"</div>"+chipSet("diet",DIET,t("dietO"));
  h+='<div class="sec">'+t("goal")+"</div>"+chipSet("goal",["balanced","high_protein","low_carb"],t("goalO"));
  h+='<div class="inline" style="margin-top:10px"><div class="field"><label for="kcal">'+t("kcalT")+'</label><input id="kcal" type="number" step="50" inputmode="numeric" value="'+st.kcal+'" data-ch="kcal"></div><div class="field"><label for="prot">'+t("protT")+'</label><input id="prot" type="number" step="5" inputmode="numeric" value="'+st.protein+'" data-ch="protein"></div></div><div class="field"><label for="maxm">'+t("maxMin")+'</label><input id="maxm" type="number" step="5" inputmode="numeric" value="'+st.maxMinutes+'" data-ch="maxMinutes"></div>';
  h+='<div class="sec">'+t("outside")+'</div><div class="inline"><div class="field"><label for="bk">'+t("breakfast")+' kcal</label><input id="bk" type="number" step="25" value="'+st.breakfastKcal+'" data-ch="breakfastKcal"></div><div class="field"><label for="bp">'+t("breakfast")+' g</label><input id="bp" type="number" step="5" value="'+st.breakfastProtein+'" data-ch="breakfastProtein"></div><div class="field"><label for="lk">'+t("lunch")+' kcal</label><input id="lk" type="number" step="25" value="'+st.lunchKcal+'" data-ch="lunchKcal"></div><div class="field"><label for="lp">'+t("lunch")+' g</label><input id="lp" type="number" step="5" value="'+st.lunchProtein+'" data-ch="lunchProtein"></div></div>';
  const pl={};PANTRY_OPTS.forEach(id=>pl[id]=S.prices[id]?L(S.prices[id]):id.replace(/_/g," "));
  h+='<div class="sec">'+t("pantry")+"</div>"+chipSet("pantry",PANTRY_OPTS,pl);
  h+='<div class="sec">'+t("dislikes")+'</div><div class="field"><label class="sr" for="disl">'+t("dislikes")+'</label><input id="disl" placeholder="'+esc(t("dislikesHint"))+'" value="'+esc(st.dislikes)+'" data-in="dislikes"></div>';
  h+='<div class="sec">'+t("timerSet")+'</div><div class="card tight">'+sw("fromSteps",tm.fromSteps,t("tFrom"),t("tFromS"))+sw("autoStart",tm.autoStart,t("tAuto"),t("tAutoS"))+sw("multi",tm.multi,t("tMulti"))+sw("early",tm.early,t("tEarly"),t("tEarlyS"))+sw("ring",tm.ring,t("tRing"))+sw("large",tm.large,t("tLarge"))+sw("wake",tm.wake,t("tWake"))+"</div>";
  h+='<div class="small" style="margin:8px 4px 4px;font-weight:700">'+t("alert")+'</div><div class="chips">'+'<button class="chip" aria-pressed="'+(tm.sound!=="none")+'" data-a="tsound" data-v="'+(tm.sound==="none"?"bell":"none")+'">🔔 '+t("sound")+'</button><button class="chip" aria-pressed="'+tm.vibrate+'" data-a="sw" data-k="vibrate">📳 '+t("vibrate")+'</button><button class="chip" aria-pressed="'+tm.flash+'" data-a="sw" data-k="flash">💡 '+t("flash")+"</button></div>";
  h+='<div class="chips" style="margin-top:8px">'+["bell","chime","alarm"].map(v=>'<button class="chip" aria-pressed="'+(tm.sound===v)+'" data-a="tsound" data-v="'+v+'">'+t(v)+"</button>").join("")+'<button class="chip" data-a="testsound">▶ '+t("test")+"</button></div>";
  h+='<div class="small" style="margin:12px 4px 4px;font-weight:700">'+t("custom")+'</div><div class="card tight">'+tm.custom.map((c,i)=>'<div class="set"><div class="tx">'+esc(c.label)+"<small>"+mmss(c.sec)+'</small></div><button class="btn danger small" data-a="delcustom" data-i="'+i+'">✕</button></div>').join("")+'<div class="set"><label class="sr" for="cl">'+t("label")+'</label><input id="cl" placeholder="'+esc(t("label"))+'" style="flex:1;min-width:0;border:1px solid var(--line);border-radius:10px;padding:9px;background:var(--surface)"><label class="sr" for="cm">'+t("minutes")+'</label><input id="cm" type="number" step="0.5" min="0.5" placeholder="min" style="width:76px;border:1px solid var(--line);border-radius:10px;padding:9px;background:var(--surface)"><button class="btn small" data-a="addcustom">'+t("addCustom")+"</button></div></div>";
  h+=settingsExtra();
  if(S.plan)h+='<div class="sec"></div><button class="btn danger" data-a="delplan">'+(S.confirm==="delplan"?t("confirmDel"):t("resetPlan"))+"</button>";
  h+='<p class="small" style="margin:14px 4px">'+t("priceSrc")+(S.meta&&S.meta.updated?" "+t("updated")+" "+dmy(new Date(S.meta.updated+"T12:00:00")):"")+"</p></div></div>";return h}

function timersBlock(){
  const tm=S.settings.timers;
  let h=TM.list.map(x=>{const lab=x.state==="ring"?"🔔 "+esc(x.label):esc(x.label);const sub=x.state==="ring"?t("done")+" "+t("tapStop"):x.state==="pause"?t("paused"):x.state==="idle"?"▶":"";
    return '<div class="timer'+(x.state==="ring"?" ring":"")+'"><span class="tt" data-tleft="'+x.id+'">'+mmss(x.left)+'</span><span class="nm"><b>'+lab+"</b>"+sub+'</span>'+(x.state==="ring"?'<button class="x" data-a="tm" data-id="'+x.id+'" data-v="plus" aria-label="'+t("plus1")+'">+1</button>':"")+'<button class="x" data-a="tm" data-id="'+x.id+'" data-v="toggle" aria-label="'+(x.state==="run"?"Pause":"Start")+'">'+(x.state==="ring"?"✓":x.state==="run"?"❚❚":"▶")+'</button>'+(x.state==="ring"?"":'<button class="x" data-a="tm" data-id="'+x.id+'" data-v="del" aria-label="✕">✕</button>')+'</div>'}).join("");
  h+='<div class="cmute" style="margin:10px 0 6px">'+t("quick")+'</div><div class="presets">'+tm.presets.map(m=>'<button data-a="quick" data-v="'+m*60+'" data-l="'+m+' min">'+m+" m</button>").join("")+tm.custom.map(c=>'<button data-a="quick" data-v="'+c.sec+'" data-l="'+esc(c.label)+'">'+esc(c.label.slice(0,8))+"</button>").join("")+"</div>";
  return h}
function ovCook(){
  const c=S.cook;const steps=c.steps||[];const i=Math.min(c.i,Math.max(0,steps.length-1));const s=steps[i];
  let h='<div class="cookmode" role="dialog" aria-label="'+esc(c.title)+'"><div class="sheettop"><button class="iconbtn" data-a="cookclose" aria-label="'+t("close")+'">✕</button><h1 style="font-size:14px;font-family:var(--f-body);font-weight:600;color:var(--cookmute)">'+esc(c.title)+(steps.length?" · "+t("step")+" "+(i+1)+" "+t("of")+" "+steps.length:"")+'</h1>'+(S.settings.voice&&(window.SpeechRecognition||window.webkitSpeechRecognition)?'<button class="iconbtn" data-a="mic" aria-pressed="'+!!S.listening+'" aria-label="'+t("voice")+'" style="'+(S.listening?"background:#c0392b;color:#fff":"")+'">🎤</button>':"")+'<button class="iconbtn" data-a="settings" aria-label="'+t("settings")+'">'+IC.gear+'</button></div><div class="main">';
  if(steps.length){h+='<div class="cprog"><i style="width:'+((i+1)/steps.length*100)+'%"></i></div><div class="bigstep'+(S.settings.timers.large?" large":"")+'" aria-live="polite">'+esc(s.text)+"</div>";
    const sk=c.key+":"+i;const has=TM.list.some(x=>x.stepKey===sk);
    if(s.timer&&S.settings.timers.fromSteps&&!has)h+='<button class="startt" data-a="steptimer">⏱ '+t("startTimer").replace("{n}",s.timer)+"</button>"}
  else h+='<div class="bigstep">'+t("writing")+"</div>";
  h+=timersBlock();
  h+='<div class="cmute" style="margin-top:12px">☀ '+t("screenOn")+"</div></div>";
  h+='<div class="cooknav"><button data-a="cstep" data-v="-1"'+(i===0?" disabled":"")+'>‹ '+t("back")+'</button><button class="nx" data-a="cstep" data-v="1">'+(i>=steps.length-1?t("finish")+" ✓":t("next")+" ›")+"</button></div></div>";return h}
function ovTimers(){return '<div class="dim" data-a="close"></div><div class="half" style="background:var(--cook);color:var(--cookink)"><div class="grab"></div><div class="main"><div class="row" style="margin-bottom:8px"><b style="font-size:18px">'+t("timers")+'</b><button class="iconbtn" style="background:var(--cook2);border-color:var(--cook3);color:var(--cookink)" data-a="close" aria-label="'+t("close")+'">✕</button></div>'+timersBlock()+"</div></div>"}

/* ---------- cooking ---------- */
function startCook(r,key,day){
  S.cook={key:key||("x"+uid6()),title:L(r.title),r,steps:(r.steps&&r.steps[S.lang])||null,i:0,day:day||null};
  S.ov=null;audio();wakeOn();render();
  if(!S.cook.steps){ensureSteps(r,key&&S.plan&&S.plan.recipes[key]?"plan":(r._id?"book":null)).then(()=>{if(S.cook){S.cook.steps=(r.steps&&r.steps[S.lang])||[];render();autoStepTimer()}})}else autoStepTimer()}
function startPrep(){const p=S.plan.prep;const steps=p.steps.map(s=>({text:(s.at!=null?"["+Math.floor(s.at/60)+":"+String(s.at%60).padStart(2,"0")+"] ":"")+L(s.text),timer:s.timer||null}));
  S.cook={key:"prep",title:t("prepSession"),r:null,steps,i:0};S.ov=null;audio();wakeOn();render();autoStepTimer()}
function autoStepTimer(){const c=S.cook;if(!c||!c.steps)return;const s=c.steps[c.i];if(s&&s.timer&&S.settings.timers.fromSteps&&S.settings.timers.autoStart){const sk=c.key+":"+c.i;if(!TM.list.some(x=>x.stepKey===sk))addTimer(shortLabel(s.text),s.timer*60,true,sk)}}
function shortLabel(s){s=String(s).replace(/^\[[^\]]*\]\s*/,"");const w=s.split(/\s+/).slice(0,4).join(" ");return w.length<s.length?w+"…":w}

/* ---------- installed-app extras: voice, notifications, GPS, share ---------- */
function cookStep(delta){
  const c=S.cook;if(!c)return;const n=c.i+delta;
  if(c.steps&&n>=c.steps.length){if(c.day&&S.plan){S.plan.done["cook_"+c.day]=true;savePlan()}S.cook=null;voiceStop();wakeOff();render();return}
  c.i=Math.max(0,n);render();autoStepTimer();if(S.listening)speakStep()}
let REC=null;
function speakStep(){try{const c=S.cook;const s=c&&c.steps&&c.steps[c.i];if(!s||!window.speechSynthesis)return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(s.text);u.lang=S.lang==="fi"?"fi-FI":"en-GB";speechSynthesis.speak(u)}catch(e){}}
function voiceStart(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){toast(t("noVoice"));return}
  try{REC=new SR()}catch(e){toast(t("noVoice"));return}
  REC.lang=S.lang==="fi"?"fi-FI":"en-US";REC.continuous=true;REC.interimResults=false;
  REC.onresult=e=>{const r=e.results[e.results.length-1];if(r&&r[0])voiceCmd(r[0].transcript.toLowerCase().trim())};
  REC.onerror=e=>{if(e.error==="not-allowed"||e.error==="service-not-allowed"){S.listening=false;render();toast(t("micDenied"),5000)}};
  REC.onend=()=>{if(S.listening&&S.cook){try{REC.start()}catch(e){}}};
  S.listening=true;try{REC.start()}catch(e){}audio();render();toast("🎤 "+t("listening"),3500)}
function voiceStop(){S.listening=false;try{REC&&REC.stop()}catch(e){}REC=null;try{window.speechSynthesis&&speechSynthesis.cancel()}catch(e){}}
const NUMW={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,fifteen:15,twenty:20,thirty:30,yksi:1,kaksi:2,kolme:3,neljä:4,viisi:5,kuusi:6,seitsemän:7,kahdeksan:8,yhdeksän:9,kymmenen:10,viisitoista:15,kaksikymmentä:20,kolmekymmentä:30};
function voiceCmd(x){
  if(!S.cook)return;
  if(/\b(next|seuraava|eteenpäin)\b/.test(x)){cookStep(1);return}
  if(/\b(back|previous|takaisin|edellinen)\b/.test(x)){cookStep(-1);return}
  if(/\b(repeat|again|toista|uudestaan)\b/.test(x)){speakStep();return}
  if(/\b(stop|seis|lopeta|hiljaa)\b/.test(x)){TM.list=TM.list.filter(y=>y.state!=="ring");render();return}
  if(/(timer|ajastin|ajastus)/.test(x)){let m=x.match(/(\d+(?:[.,]\d+)?)/);let n=m?parseFloat(m[1].replace(",",".")):null;
    if(n==null){for(const w in NUMW)if(new RegExp("\\b"+w+"\\b").test(x)){n=NUMW[w];break}}
    if(n){const sec=/(sec|sekun)/.test(x)?Math.round(n):Math.round(n*60);addTimer((sec>=60?Math.round(sec/60)+" min":sec+" s"),sec,true);toast("⏱ "+mmss(sec))}}}
function notifyRing(x){
  if(!S.settings.notify||!("Notification" in window)||Notification.permission!=="granted")return;
  if(document.visibilityState==="visible")return;
  if(navigator.serviceWorker)navigator.serviceWorker.ready.then(reg=>reg.showNotification("⏱ "+x.label,{body:t("done"),tag:"rv-timer-"+x.id,vibrate:[300,120,300,120,300],requireInteraction:true,renotify:true})).catch(()=>{})}
const CITYPOS={Helsinki:[60.17,24.94],Espoo:[60.21,24.66],Vantaa:[60.29,25.04],Tampere:[61.5,23.76],Turku:[60.45,22.27],Oulu:[65.01,25.47],"Jyväskylä":[62.24,25.75],Lahti:[60.98,25.66],Kuopio:[62.89,27.68]};
function useGps(){
  if(!navigator.geolocation){toast(t("locFail"));return}
  navigator.geolocation.getCurrentPosition(p=>{let best=null,bd=1e9;for(const c in CITYPOS){const q=CITYPOS[c];const d=Math.pow(q[0]-p.coords.latitude,2)+Math.pow((q[1]-p.coords.longitude)*0.5,2);if(d<bd){bd=d;best=c}}
    S.settings.city=bd<1.2?best:"Muu / Other";saveSettings();toast("📍 "+S.settings.city);render()},()=>toast(t("locFail"),5000),{timeout:12000,maximumAge:600000})}
function handleShare(){
  let q;try{q=new URLSearchParams(location.search)}catch(e){return}
  const url=q.get("url")||"",text=q.get("text")||"",title=q.get("title")||"";
  if(!url&&!text)return;
  let u=url;if(!u){const m=text.match(/https?:\/\/\S+/);if(m)u=m[0]}
  let rest=text.replace(u,"").trim();if(rest===title)rest="";
  try{history.replaceState(null,"",location.pathname)}catch(e){}
  S.view="cookbook";S.ov={type:"import",v:"link",url:u,text:rest};render();
  if(u&&S.sec.tavily&&!rest&&aiReady())importRecipe("",u,[])}
function swTop(k,label,sub){return '<div class="set"><div class="tx">'+label+(sub?"<small>"+sub+"</small>":"")+'</div><button class="switch" role="switch" aria-checked="'+!!S.settings[k]+'" aria-label="'+esc(label)+'" data-a="swtop" data-k="'+k+'"></button></div>'}
function secField(k,label,hint,ph){const v=S.sec[k]||"";return '<div class="field"><label for="sec_'+k+'">'+label+(v?' <span class="tag t-veg">✓</span>':"")+'</label><input id="sec_'+k+'" type="'+(k==="owner"||k==="repo"?"text":"password")+'" autocomplete="off" spellcheck="false" placeholder="'+esc(ph||"")+'" value="'+esc(v)+'" data-in="sec" data-k="'+k+'">'+(hint?'<span class="small">'+hint+"</span>":"")+"</div>"}
function settingsExtra(){
  const st=S.settings;let h="";
  h+='<div class="card tight" style="margin-top:10px">'+swTop("voice",t("voice"),t("voiceS"))+swTop("notify",t("notify"),t("notifyS"))+"</div>";
  h+='<div class="sec">'+t("planSrc")+'</div><div class="seg">'+[["auto","srcAuto"],["library","srcLib"],["ai","srcAi"]].map(o=>'<button aria-pressed="'+((st.planSource||"auto")===o[0])+'" data-a="set" data-k="planSource" data-v="'+o[0]+'">'+t(o[1])+"</button>").join("")+'</div><p class="small" style="margin:6px 4px">'+t("planSrcHint")+"</p>";
  if((st.planSource||"auto")==="auto")h+='<div class="card row"><span>'+t("newPerWeek")+'</span><div class="stepper"><button data-a="num2" data-v="-1" aria-label="−">−</button><b>'+(+st.newPerWeek||0)+'</b><button data-a="num2" data-v="1" aria-label="+">+</button></div></div>';
  h+='<p class="small" style="margin:0 4px 6px">📖 '+S.book.length+" "+t("inLibrary")+"</p>";
  h+='<div class="sec">'+t("ai")+'</div><div class="card"><p class="small" style="margin-top:0">'+t("keysLocal")+"</p>"+
    secField("gemini","Google Gemini",t("geminiHint"),"AIza…")+secField("groq","Groq",t("groqHint"),"gsk_…")+secField("openrouter","OpenRouter",t("orHint"),"sk-or-…")+secField("tavily","Tavily",t("tavilyHint"),"tvly-…")+
    '<div class="field"><label for="aiprim">'+t("aiPrimary")+'</label><select id="aiprim" data-ch="aiPrimary">'+["gemini","groq","openrouter"].map(p=>'<option value="'+p+'"'+(st.ai.order[0]===p?" selected":"")+">"+AIP[p]+"</option>").join("")+'</select><span class="small">'+t("aiOrderHint")+"</span></div>"+
    '<details><summary class="small" style="cursor:pointer;font-weight:700">'+t("models")+'</summary><div style="margin-top:8px">'+["gemini","groq","openrouter"].map(p=>'<div class="field"><label for="mdl_'+p+'">'+AIP[p]+'</label><input id="mdl_'+p+'" spellcheck="false" value="'+esc(st.ai.models[p]||"")+'" data-in="model" data-k="'+p+'"></div>').join("")+"</div></details></div>";
  const status=S.syncErr?'<span style="color:var(--danger)">'+esc(errText(S.syncErr))+"</span>":ghOn()?(S.lastSync?"✓ "+t("lastSync")+" "+new Date(S.lastSync).toLocaleTimeString(S.lang==="fi"?"fi-FI":"en-GB",{hour:"2-digit",minute:"2-digit"}):t("notSynced")):t("notConnected");
  h+='<div class="sec">'+t("sync")+'</div><div class="card"><p class="small" style="margin-top:0">'+t("syncHint")+"</p>"+
    '<div class="inline">'+secField("owner",t("ghUser"),"","SpiroVeneti")+secField("repo",t("ghRepo"),"","ruokaviikko-data")+"</div>"+
    secField("token",t("ghToken"),t("ghTokenHint"),"github_pat_…")+
    '<div class="row"><span class="small">'+status+'</span><button class="btn small" data-a="testconn">'+t("testSync")+"</button></div></div>";
  return h}

/* ---------- render ---------- */
let lastView=null;
function render(){
  const app=document.getElementById("app");if(!app)return;
  S.lang=S.settings.lang||"en";document.documentElement.lang=S.lang;
  const sc=document.getElementById("scroll");const st=sc?sc.scrollTop:0;
  const ovm=document.querySelector(".sheet .main,.half .main,.cookmode .main");const ost=ovm?ovm.scrollTop:0;const ovSig=S.ov?S.ov.type+(S.ov.key||S.ov.bookId||""):S.cook?"cook":"";
  let h="";
  if(S.view==="today")h+=vToday();else if(S.view==="plan")h+=vPlan();else if(S.view==="cookbook")h+=vBook();else h+=vList();
  const ringing=TM.list.find(x=>x.state==="ring");const first=ringing||TM.list.find(x=>x.state==="run")||TM.list[0];
  if(first&&!S.cook&&!(S.ov&&S.ov.type==="timers"))h+='<button class="floattimer'+(ringing?" ring":"")+'" data-a="timers">⏱ <span data-tleft="'+first.id+'">'+mmss(first.left)+"</span> "+esc(first.label.slice(0,14))+(TM.list.length>1?" +"+(TM.list.length-1):"")+"</button>";
  h+='<nav class="tabs" aria-label="Main">'+["today","plan","cookbook","list"].map(v=>'<button data-a="go" data-v="'+v+'"'+(S.view===v?' aria-current="page"':"")+">"+IC[v]+"<span>"+t(v)+"</span></button>").join("")+"</nav>";
  if(S.cook)h+=ovCook();
  if(S.ov){if(S.ov.type==="recipe")h+=ovRecipe();else if(S.ov.type==="swap")h+=ovSwap();else if(S.ov.type==="import")h+=ovImport();else if(S.ov.type==="settings")h+=ovSettings();else if(S.ov.type==="timers")h+=ovTimers()}
  if(S.busy)h+='<div class="busy" role="status"><div class="box"><div class="spin"></div><b>'+esc(S.busy.msg)+"</b>"+(S.busy.sub?'<p class="small">'+esc(S.busy.sub)+"</p>":"")+'<p class="small num" id="busyc">'+(S.busy.prov?S.busy.prov:"")+'</p><button class="btn ghost small" data-a="cancelbusy">'+t("cancel")+"</button></div></div>";
  if(S.toast)h+='<div class="toast" role="status">'+esc(S.toast)+"</div>";
  // preserve focus for text inputs
  const fa=document.activeElement;const fid=fa&&fa.id;const sel=fa&&fa.selectionStart!=null?[fa.selectionStart,fa.selectionEnd]:null;
  app.innerHTML=h;
  const sc2=document.getElementById("scroll");if(sc2&&lastView===S.view)sc2.scrollTop=st;lastView=S.view;
  const ovm2=document.querySelector(".sheet .main,.half .main,.cookmode .main");if(ovm2&&ovSig===render.lastOv)ovm2.scrollTop=ost;render.lastOv=ovSig;
  if(fid){const el=document.getElementById(fid);if(el&&el!==document.activeElement&&(el.tagName==="INPUT"||el.tagName==="TEXTAREA")){el.focus();if(sel&&el.setSelectionRange)try{el.setSelectionRange(sel[0],sel[1])}catch(e){}}}
}

/* ---------- events ---------- */
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-a]");if(!b)return;const a=b.dataset.a,v=b.dataset.v;
  if(a!=="delplan"&&a!=="delbook")S.confirm=null;
  const st=S.settings;
  switch(a){
  case "go":S.view=v;S.ov=null;S.copyText=null;saveCache();render();document.getElementById("scroll")&&(document.getElementById("scroll").scrollTop=0);break;
  case "settings":S.ov={type:"settings"};render();break;
  case "close":S.ov=null;render();break;
  case "makeplan":makePlan(b.dataset.next==="1");break;
  case "mode":st.mode=v;saveSettings();render();break;
  case "pv":S.planView=v;saveCache();render();break;
  case "lt":S.listTab=v;render();break;
  case "bf":S.bookFilter=v;render();break;
  case "pc":S.priceCat=v;render();break;
  case "recipe":S.ov={type:"recipe",key:b.dataset.key,day:b.dataset.day||null,from:"plan"};render();break;
  case "bookopen":{const r=S.book.find(x=>x._id===b.dataset.id);if(r)S.ov={type:"recipe",bookId:r._id,from:"book",servings:S.settings.people};render();break}
  case "sv":{const o=S.ov;const r=o.r||(o.key&&S.plan.recipes[o.key])||S.book.find(x=>x._id===o.bookId);o.servings=Math.max(1,Math.min(24,(o.servings||r.servings)+(+v)));render();break}
  case "fav":{const o=S.ov;const r=o.key?S.plan.recipes[o.key]:S.book.find(x=>x._id===o.bookId);const ex=(r.libId&&libById(r.libId))||(o.bookId&&libById(o.bookId))||S.book.find(x=>L(x.title)===L(r.title));if(ex){ex.fav=!ex.fav;saveLibrary();render();if(ex.fav)toast(t("saved"))}else{const c=clone(r);c.kind=c.kind||"ai";c.fav=true;delete c._id;delete c.key;saveToBook(c);toast(t("saved"))}break}
  case "like":{const o=S.ov;const r=o.r||(o.key&&S.plan.recipes[o.key])||S.book.find(x=>x._id===o.bookId);const ti=L(r.title);const up=v==="1";st.liked=st.liked.filter(x=>x!==ti);st.disliked=st.disliked.filter(x=>x!==ti);
    if(up&&!(b.getAttribute("aria-pressed")==="true"))st.liked.push(ti);if(!up&&!(b.getAttribute("aria-pressed")==="true"))st.disliked.push(ti);saveSettings();render();break}
  case "getsteps":{const o=S.ov;const r=o.r||(o.key&&S.plan.recipes[o.key])||S.book.find(x=>x._id===o.bookId);ensureSteps(r,o.key?"plan":o.bookId?"book":null);break}
  case "cook":{const d=S.plan.days.find(x=>x.day===b.dataset.day);startCook(S.plan.recipes[d.dinner],d.dinner,d.day);break}
  case "cookr":{const o=S.ov;const r=o.r||(o.key&&S.plan.recipes[o.key])||S.book.find(x=>x._id===o.bookId);startCook(r,o.key||o.bookId,o.day);break}
  case "cookprep":startPrep();break;
  case "cstep":cookStep(+v);break;
  case "mic":if(S.listening)voiceStop();else voiceStart();break;
  case "testconn":testConnection();break;
  case "syncnow":pull(true);break;
  case "gps":useGps();break;
  case "swtop":{const k=b.dataset.k;st[k]=!st[k];if(k==="notify"&&st[k]&&"Notification" in window&&Notification.permission!=="granted"){Notification.requestPermission().then(p=>{if(p!=="granted"){st.notify=false;toast(t("notifyDenied"))}saveSettings();render()})}saveSettings();render();break}
  case "num2":st.newPerWeek=Math.max(0,Math.min(7,(+st.newPerWeek||0)+(+v)));saveSettings();render();break;
  case "cookclose":S.cook=null;voiceStop();wakeOff();render();break;
  case "steptimer":{const c=S.cook;const s=c.steps[c.i];addTimer(shortLabel(s.text),s.timer*60,true,c.key+":"+c.i);break}
  case "quick":addTimer(b.dataset.l,+v,true);break;
  case "tm":timerAct(b.dataset.id,v);break;
  case "timers":S.ov={type:"timers"};render();break;
  case "swap":S.ov={type:"swap",day:b.dataset.day,alts:localAlts(b.dataset.day)};render();break;
  case "findswaps":findSwaps(S.ov.day);break;
  case "swf":S.ov.filter=v;render();break;
  case "pickalt":case "pickbook":{const d=S.plan.days.find(x=>x.day===S.ov.day);const old=S.plan.recipes[d.dinner];let r=a==="pickalt"?clone(S.ov.alts[+b.dataset.i]):clone(S.book.find(x=>x._id===b.dataset.id));if(a==="pickbook")r.libId=r._id;delete r._id;delete r._lib;
    if(a==="pickalt"&&!r.libId){const lr=clone(r);lr._id="a"+Date.now().toString(36)+uid6();lr.kind="ai";lr.savedAt=new Date().toISOString();S.book.unshift(lr);r.libId=lr._id;saveLibrary()}
    if(a==="pickbook"&&r.servings!==old.servings){const f=old.servings/r.servings;r.ingredients.forEach(i=>i.qty=i.qty*f);r.servings=old.servings}
    r.key=d.dinner;r.steps=r.steps||{};S.plan.recipes[d.dinner]=r;savePlan();S.ov=null;render();break}
  case "import":S.ov={type:"import",v};render();break;
  case "doimport":{const url=(document.getElementById("imurl")||{}).value||"";const text=(document.getElementById("imtext")||{}).value||"";const fe=document.getElementById("imfile");const files=fe&&fe.files?Array.from(fe.files):[];S.ov.url=url;S.ov.text=text;importRecipe(text,url.trim(),files);break}
  case "savepreview":{const r=clone(S.ov.r);saveToBook(r).then(id=>{S.ov={type:"recipe",bookId:id,from:"book",servings:r.servings};render()});toast(t("saved"));break}
  case "addweek":{const sel=document.getElementById("addday");if(!sel||!S.plan)break;const d=S.plan.days.find(x=>x.day===sel.value);const src=S.ov.r||S.book.find(x=>x._id===S.ov.bookId);const r=clone(src);r.libId=src._id;delete r._id;const old=S.plan.recipes[d.dinner];if(r.servings!==old.servings){const f=old.servings/r.servings;r.ingredients.forEach(i=>i.qty=i.qty*f);r.servings=old.servings}r.key=d.dinner;r.steps=r.steps||{};S.plan.recipes[d.dinner]=r;savePlan();S.ov=null;S.view="plan";toast("✓ "+dayName(d.day));break}
  case "delbook":if(S.confirm==="delbook"){const id=S.ov.bookId;S.ov=null;S.confirm=null;removeFromBook(id)}else{S.confirm="delbook";render()}break;
  case "delplan":if(S.confirm==="delplan"){S.plan=null;S.confirm=null;S.ov=null;savePlan();render()}else{S.confirm="delplan";render()}break;
  case "done":S.plan.done[b.dataset.k]=!S.plan.done[b.dataset.k];savePlan();render();break;
  case "buy":S.plan.bought[b.dataset.k]=!S.plan.bought[b.dataset.k];savePlan();render();break;
  case "copylist":{const txt=listText();S.copyText=null;if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(()=>toast(t("copied"))).catch(()=>{S.copyText=txt;render()})}else{S.copyText=txt;render()}break}
  case "set":st[b.dataset.k]=v;if(b.dataset.k==="theme")applyTheme();saveSettings();render();break;
  case "num":st[b.dataset.k]=Math.max(1,Math.min(12,(+st[b.dataset.k]||1)+(+v)));saveSettings();render();break;
  case "tog":{const k=b.dataset.k;if(Array.isArray(st[k])){const i=st[k].indexOf(v);if(i>=0)st[k].splice(i,1);else st[k].push(v);if(k==="days")st[k].sort((x,y)=>dayIdx(x)-dayIdx(y))}else st[k]=v;saveSettings();render();break}
  case "chain":{const c=b.dataset.k;st.chains[c]=!st.chains[c];if(!enabledChains().length)st.chains[c]=true;if(!st.chains[st.primary])st.primary=enabledChains()[0];saveSettings();render();break}
  case "sw":st.timers[b.dataset.k]=!st.timers[b.dataset.k];saveSettings();render();break;
  case "tsound":st.timers.sound=v;saveSettings();if(v!=="none")beep(v);render();break;
  case "testsound":beep(st.timers.sound==="none"?"bell":st.timers.sound);vib([200,80,200]);break;
  case "addcustom":{const l=(document.getElementById("cl")||{}).value||"";const m=parseFloat(((document.getElementById("cm")||{}).value||"").replace(",","."));if(l.trim()&&m>0){st.timers.custom.push({label:l.trim().slice(0,24),sec:Math.round(m*60)});saveSettings();render()}break}
  case "delcustom":st.timers.custom.splice(+b.dataset.i,1);saveSettings();render();break;
  case "cancelbusy":if(S.busy&&S.busy.ctl)S.busy.ctl.abort();break;
  }
});
document.addEventListener("input",e=>{const el=e.target;const k=el.dataset&&el.dataset.in;if(!k)return;
  if(k==="bookQ"){S.bookQ=el.value;render()}else if(k==="priceQ"){S.priceQ=el.value;render()}
  else if(k==="dislikes"){S.settings.dislikes=el.value;saveSettings()}
  else if(k==="store"){S.settings.storeNames[el.dataset.k]=el.value;saveSettings()}
  else if(k==="sec"){S.sec[el.dataset.k]=el.value.trim();saveSecrets()}
  else if(k==="model"){S.settings.ai.models[el.dataset.k]=el.value.trim();saveSettings()}});
document.addEventListener("change",e=>{const el=e.target;const k=el.dataset&&el.dataset.ch;if(!k)return;
  if(k==="aiPrimary"){S.settings.ai.order=[el.value].concat(["gemini","groq","openrouter"].filter(x=>x!==el.value));saveSettings();render();return}
  if(["budget","kcal","protein","maxMinutes","breakfastKcal","breakfastProtein","lunchKcal","lunchProtein"].includes(k)){const n=parseFloat(String(el.value).replace(",","."));if(isFinite(n)&&n>=0)S.settings[k]=n}else S.settings[k]=el.value;saveSettings();render()});
window.addEventListener("online",()=>{S.online=true;render()});window.addEventListener("offline",()=>{S.online=false;render()});
function listText(){const sh=shopping();if(!sh)return"";const lines=["Ruokaviikko · "+(S.settings.storeNames[S.settings.primary]||"")+" · "+eur(sh.total),""];
  const groups={};for(const x of sh.items){(groups[catOf(x.p)]=groups[catOf(x.p)]||[]).push(x)}
  for(const c of CAT_ORDER){const g=groups[c];if(!g)continue;lines.push(t("cat")[c].toUpperCase());for(const x of g)lines.push((S.plan.bought[x.id]?"☑ ":"☐ ")+L(x.p)+" – "+(x.p.loose?"~"+fmtQty(x.qty,x.p.unit):(x.packs>1?x.packs+" × ":"")+fmtQty(x.it.qty,x.p.unit))+" – "+eur(x.cost));lines.push("")}
  if(sh.others.length){lines.push(t("other").toUpperCase());for(const o of sh.others)lines.push("☐ "+L(o.name)+" – "+o.qty.join(" + "))}
  return lines.join("\n")}

/* ---------- boot ---------- */
loadCache();S.lang=S.settings.lang;applyTheme();render();
loadBundled().then(()=>pull(true));handleShare();
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
window.__rv=S;
})();
