const $=selector=>document.querySelector(selector);

function escapeHTML(value){
  return String(value??"").replace(/[&<>\"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char]));
}

const detectDelimiter=(text)=>RomitCSV.detectDelimiter(text);
const parseCSV=(text)=>RomitCSV.parseCSV(text).rows;
const serializeCSV=(rows,delimiter=",")=>RomitCSV.serializeCSV(rows,delimiter);

function makeParts(rows,rowLimit,repeatHeader){
  const header=rows[0]||[];
  const data=rows.slice(1);
  const parts=[];
  for(let start=0;start<data.length;start+=rowLimit){
    const chunk=data.slice(start,start+rowLimit);
    parts.push({start:start+1,dataRows:chunk.length,rows:repeatHeader?[header,...chunk]:chunk});
  }
  if(!parts.length)parts.push({start:0,dataRows:0,rows:repeatHeader?[header]:[]});
  return parts;
}

const uploadCard=$("#splitterUploadCard");
const dropzone=$("#splitterDropzone");
const workspace=$("#splitterWorkspace");
let rows=[
  ["ID","Name","Email"],
  ["1","Ada Lovelace","ada@example.com"],
  ["2","Grace Hopper","grace@example.com"],
  ["3","Alan Turing","alan@example.com"],
  ["4","Katherine Johnson","kj@example.com"],
  ["5","Edsger Dijkstra","ed@example.com"],
  ["6","Barbara Liskov","barbara@example.com"],
  ["7","Donald Knuth","donald@example.com"],
  ["8","Margaret Hamilton","margaret@example.com"],
  ["9","Tim Berners-Lee","tim@example.com"],
  ["10","Frances Allen","frances@example.com"],
  ["11","Mary Jackson","mary@example.com"],
  ["12","John Backus","john@example.com"]
];
let fileName="sample_data.csv";
let rowLimit=5;
let repeatHeader=true;
let parts=makeParts(rows,rowLimit,repeatHeader);
let currentPart=0;

function render(){
  const part=parts[currentPart];
  const header=rows[0]||[];
  const previewRows=repeatHeader?part.rows.slice(1):part.rows;
  workspace.hidden=false;
  workspace.innerHTML=`
    <div class="splitter-data-card">
      <div class="splitter-filebar">
        <div class="viewer-fileinfo"><div class="viewer-fileicon"><span>CSV</span></div><div><strong title="${escapeHTML(fileName)}">${escapeHTML(fileName)}</strong><span>${Math.max(0,rows.length-1).toLocaleString()} data rows · ${header.length} columns · ${parts.length} parts</span></div></div>
        <div class="splitter-actions"><button class="viewer-clear" id="clearSplitter" type="button">Clear</button></div>
      </div>
      <div class="splitter-controls">
        <label>Rows per part <input id="rowsPerPart" type="number" min="1" step="1" value="${rowLimit}" inputmode="numeric"></label>
        <label class="splitter-header-option"><input id="repeatHeader" type="checkbox" ${repeatHeader?"checked":""}> Repeat header in every part</label>
        <button class="viewer-primary" id="runSplit" type="button">Split CSV</button>
        <span id="splitterError" class="splitter-error" role="status" hidden></span>
      </div>
      <div class="splitter-partbar">
        <label>Preview part
          <select id="partSelect">${parts.map((item,index)=>`<option value="${index}" ${index===currentPart?"selected":""}>Part ${index+1} · ${item.dataRows} rows</option>`).join("")}</select>
        </label>
        <span>Rows ${part.dataRows?part.start+"–"+(part.start+part.dataRows-1):"0"} of ${Math.max(0,rows.length-1)}</span>
        <button class="viewer-download" id="downloadPart" type="button">Download part ${currentPart+1}</button>
      </div>
      <div class="editor-table-wrap splitter-table-wrap"><table><thead><tr><th class="row-num-head">#</th>${header.map(column=>`<th>${escapeHTML(column)}</th>`).join("")}</tr></thead><tbody>${previewRows.map((row,index)=>`<tr><td class="row-number">${part.start+index}</td>${row.map(value=>`<td title="${escapeHTML(value)}">${escapeHTML(value)}</td>`).join("")}</tr>`).join("")||`<tr><td colspan="${header.length+1}" class="no-results">This part contains no data rows.</td></tr>`}</tbody></table></div>
      <div class="viewer-pager"><span>Part ${currentPart+1} of ${parts.length}</span><div class="pager-buttons"><button id="splitterPrev" type="button" ${currentPart<=0?"disabled":""}>‹</button><b>${currentPart+1}</b><button id="splitterNext" type="button" ${currentPart>=parts.length-1?"disabled":""}>›</button></div></div>
    </div>`;

  $("#rowsPerPart").onchange=event=>{rowLimit=Math.max(1,Number.parseInt(event.target.value,10)||1)};
  $("#repeatHeader").onchange=event=>{repeatHeader=event.target.checked};
  $("#runSplit").onclick=()=>{
    const requested=Number.parseInt($("#rowsPerPart").value,10);
    if(!Number.isInteger(requested)||requested<1){$("#splitterError").textContent="Enter a row limit of at least 1.";$("#splitterError").hidden=false;return}
    $("#splitterError").hidden=true;
    rowLimit=requested;repeatHeader=$("#repeatHeader").checked;parts=makeParts(rows,rowLimit,repeatHeader);currentPart=0;render();
  };
  $("#partSelect").onchange=event=>{currentPart=Number(event.target.value);render()};
  $("#downloadPart").onclick=()=>{
    const link=document.createElement("a");link.href=URL.createObjectURL(new Blob([serializeCSV(part.rows)],{type:"text/csv;charset=utf-8"}));link.download=fileName.replace(/\.(csv|tsv)$/i,"")+"-part-"+String(currentPart+1).padStart(3,"0")+".csv";document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
  };
  $("#clearSplitter").onclick=()=>{rows=[];parts=[];workspace.hidden=true;uploadCard.hidden=false;$("#splitterFile").value="";$("#splitterStatus").textContent=""};
  $("#splitterPrev").onclick=()=>{if(currentPart>0){currentPart--;render()}};
  $("#splitterNext").onclick=()=>{if(currentPart<parts.length-1){currentPart++;render()}};
}

function openText(text,name){
  const parsed=parseCSV(text);
  if(!parsed.length||parsed.every(row=>row.every(value=>!value.trim()))){$("#splitterStatus").textContent="This CSV file is empty.";return}
  rows=parsed;fileName=name||"data.csv";parts=makeParts(rows,rowLimit,repeatHeader);currentPart=0;uploadCard.hidden=true;render();
  requestAnimationFrame(()=>workspace.scrollIntoView({behavior:"smooth",block:"start"}));
}

render();
$("#splitterBrowse").onclick=()=>$("#splitterFile").click();
$("#splitterFile").onchange=async event=>{
  const file=event.target.files?.[0];if(!file)return;
  if(file.size>50*1024*1024){$("#splitterStatus").textContent="This file is larger than 50MB.";return}
  try{openText(await file.text(),file.name)}catch(error){$("#splitterStatus").textContent="Could not read this CSV file."}
};
["dragenter","dragover"].forEach(type=>dropzone.addEventListener(type,event=>{event.preventDefault();dropzone.classList.add("drag")}));
["dragleave","drop"].forEach(type=>dropzone.addEventListener(type,event=>{event.preventDefault();dropzone.classList.remove("drag")}));
dropzone.addEventListener("drop",async event=>{
  const file=event.dataTransfer?.files?.[0];if(!file)return;
  if(file.size>50*1024*1024){$("#splitterStatus").textContent="This file is larger than 50MB.";return}
  try{openText(await file.text(),file.name)}catch(error){$("#splitterStatus").textContent="Could not read this CSV file."}
});

const dark=localStorage.getItem("romitcsv.theme")==="dark";
document.body.classList.toggle("dark",dark);
$("#splitterTheme").setAttribute("aria-pressed",String(dark));
$("#splitterTheme").onclick=()=>{const nextDark=!document.body.classList.contains("dark");document.body.classList.toggle("dark",nextDark);$("#splitterTheme").setAttribute("aria-pressed",String(nextDark));localStorage.setItem("romitcsv.theme",nextDark?"dark":"light")};
$("#splitterMenu").onclick=()=>$("#splitterNav").classList.toggle("open");