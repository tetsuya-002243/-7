if("serviceWorker"in navigator){addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}))}
pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const $=id=>document.getElementById(id);
let db; const DB="fieldbook-v10-db";
const st={currentBridge:null,currentPdfId:null,tool:"move",sel:null,pending:null,relocate:null,pdfDoc:null,page:1,pages:0,w:0,h:0,scale:1,tx:0,ty:0,pts:new Map(),pan:null,pinch:null,drawing:false,stroke:null,down:null,history:["homePage"]};
const app={bridges:{},settings:{}};
$("newBridge").value="試作橋";

function openDB(){return new Promise((res,rej)=>{let r=indexedDB.open(DB,1);r.onupgradeneeded=e=>{let d=e.target.result;if(!d.objectStoreNames.contains("files"))d.createObjectStore("files")};r.onsuccess=e=>{db=e.target.result;res()};r.onerror=e=>rej(e)})}
function putFile(key,blob){return new Promise((res,rej)=>{let t=db.transaction("files","readwrite");t.objectStore("files").put(blob,key);t.oncomplete=res;t.onerror=rej})}
function getFile(key){return new Promise((res,rej)=>{let t=db.transaction("files","readonly");let r=t.objectStore("files").get(key);r.onsuccess=()=>res(r.result);r.onerror=rej})}
function save(){localStorage.setItem("fieldbook_v10",JSON.stringify(app))}
function load(){let raw=localStorage.getItem("fieldbook_v10");if(raw)Object.assign(app,JSON.parse(raw));renderBridgeList();updateCurrent()}
function safe(s){return String(s||"").replace(/[\\/:*?"<>| \u3000]/g,"_")}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
function currentBridge(){return app.bridges[st.currentBridge]}
function currentPdf(){let b=currentBridge();return b?.pdfs?.find(p=>p.id===st.currentPdfId)}
function show(id,push=true){document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));$(id).classList.add("active");if(push&&st.history[st.history.length-1]!==id)st.history.push(id);if(id==="syncPage")renderSync();if(id==="pdfPage")renderPdfList()}
$("backBtn").onclick=()=>{if(st.history.length>1)st.history.pop();show(st.history[st.history.length-1]||"homePage",false)}
$("navHome").onclick=()=>show("homePage");$("navPdf").onclick=()=>show("pdfPage");$("navEdit").onclick=()=>{show("editorPage");renderPdfSelect()};$("navSync").onclick=()=>show("syncPage");

$("createBridge").onclick=()=>{let name=$("newBridge").value.trim();if(!name)return alert("橋梁名を入力してください");let id=safe(name);if(!app.bridges[id])app.bridges[id]={id,name,pdfs:[],photos:[],photoSeq:1};st.currentBridge=id;save();renderBridgeList();updateCurrent();show("pdfPage")}
function renderBridgeList(){let a=$("bridgeList");let ids=Object.keys(app.bridges);a.innerHTML=ids.length?"":"<p class='note'>まだ橋梁がありません。</p>";ids.forEach(id=>{let b=app.bridges[id],div=document.createElement("div");div.className="bridgeItem"+(id===st.currentBridge?" active":"");div.innerHTML=`<b>${b.name}</b><span>PDF ${b.pdfs.length} / 写真 ${b.photos.length}</span>`;let open=document.createElement("button");open.textContent="開く";open.onclick=()=>{st.currentBridge=id;save();renderBridgeList();updateCurrent();show("pdfPage")};div.appendChild(open);a.appendChild(div)})}
function updateCurrent(){let b=currentBridge();$("currentBridgeBox").textContent=b?`現在の橋梁：${b.name}　PDF:${b.pdfs.length}　写真:${b.photos.length}`:"橋梁未選択"}
$("pdfInput").onchange=async e=>{let b=currentBridge();if(!b)return alert("先に橋梁を作成してください");for(let f of [...e.target.files]){let id=uid(),key=`pdf_${b.id}_${id}`;await putFile(key,f);b.pdfs.push({id,name:f.name,key,checked:{},icons:[],draw:[],texts:[]})}save();renderPdfList();renderPdfSelect();show("editorPage");if(b.pdfs.length)await openPdf(b.pdfs[b.pdfs.length-1].id)}
function renderPdfList(){let b=currentBridge(),a=$("pdfList");updateCurrent();if(!b){a.innerHTML="<p class='note'>橋梁を選択してください。</p>";return}a.innerHTML=b.pdfs.length?"":"<p class='note'>PDF未登録です。</p>";b.pdfs.forEach(p=>{let div=document.createElement("div");div.className="pdfItem";div.innerHTML=`<b>${p.name}</b><span>${Object.values(p.checked||{}).filter(Boolean).length}ページチェック済</span>`;let btn=document.createElement("button");btn.textContent="編集";btn.onclick=async()=>{show("editorPage");await openPdf(p.id)};div.appendChild(btn);a.appendChild(div)})}
function renderPdfSelect(){let b=currentBridge();$("pdfSelect").innerHTML="";if(!b)return;b.pdfs.forEach(p=>{let o=document.createElement("option");o.value=p.id;o.textContent=p.name;$("pdfSelect").appendChild(o)});if(st.currentPdfId)$("pdfSelect").value=st.currentPdfId}
$("pdfSelect").onchange=()=>openPdf($("pdfSelect").value);
async function openPdf(id){let p=currentBridge().pdfs.find(x=>x.id===id);if(!p)return;st.currentPdfId=id;$("pdfSelect").value=id;let blob=await getFile(p.key);let buf=await blob.arrayBuffer();st.pdfDoc=await pdfjsLib.getDocument({data:buf}).promise;st.pages=st.pdfDoc.numPages;st.page=1;await renderPage()}
$("prev").onclick=()=>goPage(st.page-1);$("next").onclick=()=>goPage(st.page+1);
async function goPage(n){if(!st.pdfDoc||n<1||n>st.pages)return;st.page=n;st.sel=null;await renderPage()}
$("reset").onclick=()=>fit();
$("checkPage").onclick=()=>{let p=currentPdf();p.checked[st.page]=!p.checked[st.page];pageLabel();save()}
function pageLabel(){let p=currentPdf();let c=p?.checked?.[st.page]?" ✓チェック済":" 未チェック";$("pageInfo").textContent=st.pages?`${st.page} / ${st.pages}ページ${c}`:"PDF未読込"}
async function renderPage(){let pg=await st.pdfDoc.getPage(st.page),v0=pg.getViewport({scale:1}),sc=Math.min(1.9,Math.max(1200,$("view").clientWidth*1.9)/v0.width),v=pg.getViewport({scale:sc});["pdfCanvas","inkCanvas"].forEach(id=>{$(id).width=v.width;$(id).height=v.height});st.w=v.width;st.h=v.height;$("stage").style.width=v.width+"px";$("stage").style.height=v.height+"px";$("icons").style.width=v.width+"px";$("icons").style.height=v.height+"px";$("empty").style.display="none";pageLabel();await pg.render({canvasContext:$("pdfCanvas").getContext("2d"),viewport:v}).promise;fit();renderAll()}
function fit(){let vw=$("view").clientWidth,vh=$("view").clientHeight;st.scale=Math.min(vw/st.w,vh/st.h)*.98;st.tx=(vw-st.w*st.scale)/2;st.ty=10;tf()}
function tf(){$("stage").style.transform=`translate(${st.tx}px,${st.ty}px) scale(${st.scale})`}
function toPdf(x,y){let r=$("view").getBoundingClientRect();return{x:(x-r.left-st.tx)/st.scale,y:(y-r.top-st.ty)/st.scale}}
function setTool(t){st.tool=t;st.relocate=null;document.querySelectorAll(".tool").forEach(b=>b.classList.remove("active"));$(t).classList.add("active");$("inkCanvas").style.pointerEvents=(["pen","marker","eraser"].includes(t))?"auto":"none"}
["move","photoIcon","pen","marker","text","eraser"].forEach(id=>$(id).onclick=()=>setTool(id));
$("view").onpointerdown=e=>{$("view").setPointerCapture(e.pointerId);st.pts.set(e.pointerId,{x:e.clientX,y:e.clientY});st.down={x:e.clientX,y:e.clientY,t:Date.now(),tool:st.tool};let p=toPdf(e.clientX,e.clientY);if(st.relocate){moveIconTo(st.relocate,p);return}if(st.tool==="photoIcon"){createIcon(p);return}if(st.tool==="text"){addText(p);return}if(["pen","marker","eraser"].includes(st.tool)){startStroke(e);return}st.pan={x:e.clientX,y:e.clientY}}
$("view").onpointermove=e=>{if(!st.pts.has(e.pointerId))return;st.pts.set(e.pointerId,{x:e.clientX,y:e.clientY});if(["pen","marker","eraser"].includes(st.tool)&&st.drawing){moveStroke(e);return}if(st.tool!=="move")return;let a=[...st.pts.values()];if(a.length===1&&st.pan){st.tx+=e.clientX-st.pan.x;st.ty+=e.clientY-st.pan.y;st.pan={x:e.clientX,y:e.clientY};tf()}else if(a.length>=2){let d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),c={x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2};if(st.pinch){let before=toPdf(c.x,c.y);st.scale=Math.min(6,Math.max(.15,st.scale*d/st.pinch.d));let r=$("view").getBoundingClientRect();st.tx=c.x-r.left-before.x*st.scale;st.ty=c.y-r.top-before.y*st.scale;tf()}st.pinch={d,c}}}
$("view").onpointerup=$("view").onpointercancel=e=>{if(["pen","marker","eraser"].includes(st.tool)&&st.drawing)endStroke();if(st.down&&st.down.tool==="move"&&st.pts.size===1&&!st.relocate){let dx=e.clientX-st.down.x,dy=e.clientY-st.down.y,dt=Date.now()-st.down.t;if(Math.abs(dx)>120&&Math.abs(dx)>Math.abs(dy)*1.4&&dt<900)goPage(dx<0?st.page+1:st.page-1)}st.pts.delete(e.pointerId);st.pan=null;st.pinch=null;st.down=null}
function createIcon(p){let pdf=currentPdf(),id=uid();pdf.icons.push({id,no:pdf.icons.length+1,page:st.page,x:p.x/st.w,y:p.y/st.h,photoIds:[]});st.pending=id;st.sel=id;renderAll();save();setTool("move");setTimeout(()=>$("autoPhoto").click(),120)}
$("autoPhoto").onchange=async e=>{let ic=findIcon(st.pending);if(ic)await addFiles(ic,[...e.target.files]);st.pending=null;e.target.value=""}
$("addPhoto").onchange=async e=>{let ic=findIcon(st.sel);if(ic)await addFiles(ic,[...e.target.files]);e.target.value=""}
async function addFiles(icon,files){let b=currentBridge();for(let f of files){let src=await resize(f),seq=b.photoSeq++,name=`${safe(b.name)}_${String(seq).padStart(3,"0")}.jpg`,id=uid();b.photos.push({id,name,src,sync:"pending"});icon.photoIds.push(id)}save();renderAll();openPhotos(icon.id);renderSync()}
function resize(file){return new Promise(res=>{let r=new FileReader();r.onload=()=>{let im=new Image();im.onload=()=>{let sc=Math.min(1,1800/im.width),cv=document.createElement("canvas");cv.width=Math.round(im.width*sc);cv.height=Math.round(im.height*sc);cv.getContext("2d").drawImage(im,0,0,cv.width,cv.height);res(cv.toDataURL("image/jpeg",.86))};im.src=r.result};r.readAsDataURL(file)})}
function findIcon(id){return currentPdf()?.icons.find(i=>i.id===id)}
function iconPhotos(ic){let b=currentBridge();return ic.photoIds.map(id=>b.photos.find(p=>p.id===id)).filter(Boolean)}
function moveIconTo(id,p){let i=findIcon(id);if(!i)return;i.page=st.page;i.x=p.x/st.w;i.y=p.y/st.h;st.relocate=null;setTool("move");st.sel=id;renderAll();save();alert("位置を変更しました")}
function addText(p){let t=prompt("記入文字");if(!t)return;currentPdf().texts.push({page:st.page,x:p.x/st.w,y:p.y/st.h,text:t,color:$("penColor").value});renderAll();save()}
function startStroke(e){let p=toPdf(e.clientX,e.clientY),size=Number($("penSize").value),color=$("penColor").value,alpha=1;if(st.tool==="marker"){color="#facc15";size=18;alpha=.35}if(st.tool==="eraser"){color="#fff";size=Number($("eraserSize").value);alpha=1}st.drawing=true;st.stroke={page:st.page,pts:[{x:p.x/st.w,y:p.y/st.h}],color,width:size,alpha,erase:st.tool==="eraser"}}
function moveStroke(e){let p=toPdf(e.clientX,e.clientY);st.stroke.pts.push({x:p.x/st.w,y:p.y/st.h});drawInk(true)}
function endStroke(){if(st.stroke&&st.stroke.pts.length>1)currentPdf().draw.push(st.stroke);st.stroke=null;st.drawing=false;drawInk();save()}
$("undo").onclick=()=>{let p=currentPdf();if(!p)return;if(p.draw.length)p.draw.pop();else if(p.texts.length)p.texts.pop();renderAll();save()}
$("clearPage").onclick=()=>{let p=currentPdf();if(p&&confirm("このページの記入を削除しますか？")){p.draw=p.draw.filter(d=>d.page!==st.page);p.texts=p.texts.filter(t=>t.page!==st.page);renderAll();save()}}
function renderAll(){icons();drawInk();texts()}
function icons(){let p=currentPdf(),l=$("icons");l.innerHTML="";if(!p)return;p.icons.filter(i=>i.page===st.page).forEach(i=>{let ps=iconPhotos(i),d=document.createElement("div");d.className="ico"+(i.id===st.sel?" selected":"")+(ps.length?"":" noPhoto");d.style.left=i.x*st.w+"px";d.style.top=i.y*st.h+"px";d.innerHTML=ps.length?`<img src="${ps[0].src}"><span class="num">${i.no}</span>`:`<span class="num">${i.no}</span>`;d.onclick=e=>{e.stopPropagation();st.sel=i.id;renderAll();openPhotos(i.id)};l.appendChild(d)});texts()}
function texts(){let p=currentPdf(),l=$("icons");l.querySelectorAll(".txt").forEach(x=>x.remove());if(!p)return;p.texts.filter(t=>t.page===st.page).forEach(t=>{let d=document.createElement("div");d.className="txt";d.textContent=t.text;d.style.color=t.color||"#dc2626";d.style.left=t.x*st.w+"px";d.style.top=t.y*st.h+"px";l.appendChild(d)})}
function drawInk(cur=false){let c=$("inkCanvas").getContext("2d");c.clearRect(0,0,st.w,st.h);let p=currentPdf();if(!p)return;let arr=p.draw.filter(d=>d.page===st.page);if(cur&&st.stroke)arr.push(st.stroke);arr.forEach(s=>{if(s.pts.length<2)return;c.save();c.globalAlpha=s.alpha??1;c.globalCompositeOperation=s.erase?"destination-out":"source-over";c.strokeStyle=s.color;c.lineWidth=s.width;c.lineCap="round";c.lineJoin="round";c.beginPath();c.moveTo(s.pts[0].x*st.w,s.pts[0].y*st.h);s.pts.slice(1).forEach(p=>c.lineTo(p.x*st.w,p.y*st.h));c.stroke();c.restore()})}
function openPhotos(id){let ic=findIcon(id);if(!ic)return;let ps=iconPhotos(ic);$("modalTitle").textContent=`写真アイコン${ic.no}：${ps.length}枚`;$("modalPhotos").innerHTML=ps.length?ps.map(p=>`<div class="photoBox"><img src="${p.src}"><span>${p.name}</span><span class="sync ${p.sync==='done'?'done':''}">${p.sync==='done'?'同期済み':'未同期'}</span></div>`).join(""):"<p>まだ写真がありません。</p>";$("photoModal").classList.remove("hidden")}
$("closePhoto").onclick=()=>$("photoModal").classList.add("hidden");$("modalAddPhoto").onclick=()=>{$("photoModal").classList.add("hidden");$("addPhoto").click()};$("modalMoveIcon").onclick=()=>{if(st.sel){st.relocate=st.sel;$("photoModal").classList.add("hidden");alert("新しい位置をPDF上で1回タップしてください")}};$("modalDeleteIcon").onclick=()=>{let p=currentPdf();if(!p||!st.sel)return;if(confirm("削除しますか？")){p.icons=p.icons.filter(i=>i.id!==st.sel);p.icons.forEach((i,n)=>i.no=n+1);st.sel=null;$("photoModal").classList.add("hidden");renderAll();save()}};
$("thumbBtn").onclick=async()=>{if(!st.pdfDoc)return alert("PDFを開いてください");$("thumbModal").classList.remove("hidden");await thumbs()};$("closeThumb").onclick=()=>$("thumbModal").classList.add("hidden");
async function thumbs(){let g=$("thumbGrid"),p=currentPdf();g.innerHTML="";for(let n=1;n<=st.pages;n++){let card=document.createElement("div");card.className="pageCard"+(p.checked[n]?" checked":"");card.innerHTML=`<div class="pageNo">${n}ページ</div><canvas></canvas><label><input type="checkbox" ${p.checked[n]?"checked":""}>チェック済み</label>`;g.appendChild(card);let pg=await st.pdfDoc.getPage(n),vp=pg.getViewport({scale:.22}),cv=card.querySelector("canvas");cv.width=vp.width;cv.height=vp.height;await pg.render({canvasContext:cv.getContext("2d"),viewport:vp}).promise;card.querySelector("input").onchange=e=>{p.checked[n]=e.target.checked;card.classList.toggle("checked",e.target.checked);pageLabel();save()};cv.onclick=async()=>{$("thumbModal").classList.add("hidden");await goPage(n)}}}
function renderSync(){let b=currentBridge();if(!b){$("syncSummary").textContent="橋梁未選択";$("photoSummary").innerHTML="";return}let pending=b.photos.filter(p=>p.sync!=="done").length,done=b.photos.filter(p=>p.sync==="done").length;$("syncSummary").innerHTML=`橋梁：<b>${b.name}</b><br>写真：${b.photos.length}枚　未同期：${pending}枚　同期済み：${done}枚`;$("photoSummary").innerHTML=b.photos.map(p=>`<div class="photoBox"><img src="${p.src}"><span>${p.name}</span><span class="sync ${p.sync==='done'?'done':''}">${p.sync==='done'?'同期済み':'未同期'}</span></div>`).join("")}
function folderName(){let b=currentBridge();return safe($("folderName").value||b?.name||"橋梁写真")}
async function exportPhotoZip(){
  let b=currentBridge();
  if(!b||!b.photos.length){ alert("写真がありません"); return; }
  let z=new JSZip();
  b.photos.forEach(p=>z.file(p.name,p.src.split(",")[1],{base64:true}));
  download(await z.generateAsync({type:"blob"}),safe(b.name)+"_写真.zip");
}
$("zipBtn").onclick=()=>exportPhotoZip();
$("csvBtn").onclick=()=>{let b=currentBridge();if(!b)return;let rows=[["橋梁名","PDF名","PDFページ","アイコン番号","写真名","同期","X","Y"]];b.pdfs.forEach(pdf=>pdf.icons.forEach(i=>rows.push([b.name,pdf.name,i.page,i.no,i.photoIds.map(id=>b.photos.find(p=>p.id===id)?.name).filter(Boolean).join(" / "),i.photoIds.map(id=>b.photos.find(p=>p.id===id)?.sync).filter(Boolean).join(" / "),i.x.toFixed(4),i.y.toFixed(4)])));download(new Blob(["\ufeff"+rows.map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n")],{type:"text/csv"}),safe(b.name)+"_野帳.csv")}
function download(blob,name){let a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click()}

function openOneDrive(){
  window.open("https://onedrive.live.com/", "_blank");
}
$("openOneDriveBtn").onclick=()=>openOneDrive();
$("zipAndOpenOneDriveBtn").onclick=async()=>{
  await exportPhotoZip();
  $("syncMessage").textContent="写真ZIPを出力しました。OneDriveを開きます。出力したZIPをOneDriveに保存してください。";
  setTimeout(openOneDrive, 500);
}
openDB().then(()=>load());