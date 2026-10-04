const $=selector=>document.querySelector(selector);

function escapeHTML(value){
  return String(value??"").replace(/[&<>\"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char]));
}

function detectDelimiter(text){
  const first=text.replace(/^\uFEFF/,"").split(/\r?\n/).find(line=>line.trim())||"";
  return [",",";","\t","|"].map(delimiter=>[delimiter,first.split(delimiter).length-1]).sort((a,b)=>b[1]-a[1])[0][0];
}

function parseCSV(text){
  text=String(text||"").replace(/^\uFEFF/,"");
  const delimiter=detectDelimiter(text),rows=[],row=[],cell=[];
  let quoted=false;
  for(let i=0;i<text.length;i++){
    const char=text[i],next=text[i+1];
    if(char==='"'){
      if(quoted&&next==='"'){cell.push('"');i++}
      else quoted=!quoted;
    }else if(char===delimiter&&!quoted){
      row.push(cell.join(""));cell.length=0;
    }else if((char==="\n"||char==="\r")&&!quoted){
      if(char==="\r"&&next==="\n")i++;
      row.push(cell.join(""));cell.length=0;
      if(row.length)rows.push(row.slice());
      row.length=0;
    }else cell.push(char);
  }
  if(cell.length||row.length){row.push(cell.join(""));rows.push(row.slice())}
  const width=rows.reduce((max,current)=>Math.max(max,current.length),0);
  return rows.map(current=>Array.from({length:width},(_,index)=>current[index]??""));
}

function serializeCSV(rows){
  return rows.map(row=>row.map(value=>{
    value=String(value??"");
    return /[",\n\r]/.test(value)?'"'+value.replace(/"/g,'""')+'"':value;
  }).join(",")).join("\r\n");
}

const uploadCard=$("#mergerUploadCard");
const dropzone=$("#mergerDropzone");
const workspace=$("#mergerWorkspace");
function combineSourceTables(tables){
  if(!tables.length)return [];
  const firstHeader=tables[0].rows[0];
  const columnCount=Math.max(...tables.flatMap(file=>file.rows.map(row=>row.length)));
  const header=Array.from({length:columnCount},(_,column)=>firstHeader[column]??("Column "+(column+1)));
  const combined=[header];
  tables.forEach(file=>file.rows.slice(1).forEach(row=>{
    if(row.some(value=>value.trim()))combined.push(Array.from({length:columnCount},(_,column)=>row[column]??""));
  }));
  return combined;
}
let sourceTables=[
  {name:"customers.csv",rows:[["Name","Email","City"],["Ada Lovelace","ada@example.com","London"],["Grace Hopper","grace@example.com","New York"]]},
  {name:"contacts.csv",rows:[["Name","Email","City"],["Alan Turing","alan@example.com","Manchester"],["Katherine Johnson","kj@example.com","White Sulphur Springs"]]}
];
let hasRealFiles=false;
let mergedRows=combineSourceTables(sourceTables);
let sources=sourceTables.map(file=>({name:file.name,rows:file.rows.slice(1).filter(row=>row.some(value=>value.trim())).length}));
let fileName="merged-sample.csv";
let page=1;
const pageSize=10;

function render(){
  const totalRows=Math.max(0,mergedRows.length-1);
  const totalPages=Math.max(1,Math.ceil(totalRows/pageSize));
  page=Math.min(page,totalPages);
  const start=(page-1)*pageSize;
  const visible=mergedRows.slice(start+1,start+1+pageSize);
  workspace.hidden=false;
  workspace.innerHTML=`
    <div class="merger-data-card">
      <div class="merger-filebar">
        <div class="viewer-fileinfo"><div class="viewer-fileicon"><span>CSV</span></div><div><strong title="${escapeHTML(fileName)}">${escapeHTML(fileName)}</strong><span>${sources.length} files · ${totalRows.toLocaleString()} rows · ${mergedRows[0]?.length||0} columns</span></div></div>
        <div class="merger-actions"><button class="viewer-edit" id="addMoreFiles" type="button">Add more files</button><input id="mergerMoreFiles" type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" multiple hidden><button class="viewer-download" id="mergeDownload" type="button">Download Merged CSV</button><button class="viewer-clear" id="clearMerger" type="button">Clear</button></div>
      </div>
      <div class="merger-sources" aria-label="Merged source files">${sources.map(source=>`<span>${escapeHTML(source.name)} · ${source.rows.toLocaleString()} rows</span>`).join("")}</div>
      <p class="merger-note">Rows are combined by column position. The first file provides column headers.</p>
      <div class="editor-table-wrap merger-table-wrap"><table><thead><tr><th class="row-num-head">#</th>${(mergedRows[0]||[]).map(header=>`<th>${escapeHTML(header)}</th>`).join("")}</tr></thead><tbody>${visible.map((row,offset)=>`<tr><td class="row-number">${start+offset+1}</td>${row.map(value=>`<td title="${escapeHTML(value)}">${escapeHTML(value)}</td>`).join("")}</tr>`).join("")||`<tr><td colspan="${(mergedRows[0]?.length||0)+1}" class="no-results">No rows to display.</td></tr>`}</tbody></table></div>
      <div class="viewer-pager"><span>Showing ${totalRows?start+1:0} to ${Math.min(start+visible.length,totalRows)} of ${totalRows.toLocaleString()} rows</span><div class="pager-buttons"><button id="mergerPrev" type="button" ${page<=1?"disabled":""}>‹</button><b>${page}</b><button id="mergerNext" type="button" ${page>=totalPages?"disabled":""}>›</button></div></div>
    </div>`;
  $("#addMoreFiles").onclick=()=>$("#mergerMoreFiles").click();
  $("#mergerMoreFiles").onchange=event=>mergeFiles([...event.target.files],true);
  $("#mergeDownload").onclick=()=>{
    const link=document.createElement("a");link.href=URL.createObjectURL(new Blob([serializeCSV(mergedRows)],{type:"text/csv;charset=utf-8"}));link.download=fileName;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
  };
  $("#clearMerger").onclick=()=>{sourceTables=[];sources=[];mergedRows=[];hasRealFiles=false;workspace.hidden=true;uploadCard.hidden=false;$("#mergerFiles").value="";$("#mergerStatus").textContent=""};
  $("#mergerPrev").onclick=()=>{if(page>1){page--;render()}};
  $("#mergerNext").onclick=()=>{if(page<totalPages){page++;render()}};
}

async function mergeFiles(files,append=false){
  if(!files.length)return;
  if(files.some(file=>file.size>50*1024*1024)){$("#mergerStatus").textContent="Each file must be 50MB or smaller.";return}
  try{
    const parsed=await Promise.all(files.map(async file=>({name:file.name,rows:parseCSV(await file.text())})));
    if(parsed.some(file=>!file.rows.length)){$("#mergerStatus").textContent="One or more files are empty.";return}
    sourceTables=append&&hasRealFiles?[...sourceTables,...parsed]:parsed;
    hasRealFiles=true;
    mergedRows=combineSourceTables(sourceTables);
    sources=sourceTables.map(file=>({name:file.name,rows:file.rows.slice(1).filter(row=>row.some(value=>value.trim())).length}));
    fileName=sourceTables[0].name.replace(/\.(csv|tsv)$/i,"")+"-merged.csv";
    page=1;uploadCard.hidden=sources.length>1;
    $("#mergerStatus").textContent=sources.length===1?"1 file loaded. Add another file to merge.":"";
    render();
    $("#mergerMoreFiles").value="";
    requestAnimationFrame(()=>workspace.scrollIntoView({behavior:"smooth",block:"start"}));
  }catch(error){console.error(error);$("#mergerStatus").textContent="Could not read one or more CSV files."}
}

render();
$("#mergerBrowse").onclick=()=>$("#mergerFiles").click();
$("#mergerFiles").onchange=event=>mergeFiles([...event.target.files],hasRealFiles);
["dragenter","dragover"].forEach(type=>dropzone.addEventListener(type,event=>{event.preventDefault();dropzone.classList.add("drag")}));
["dragleave","drop"].forEach(type=>dropzone.addEventListener(type,event=>{event.preventDefault();dropzone.classList.remove("drag")}));
dropzone.addEventListener("drop",event=>mergeFiles([...event.dataTransfer.files]));

const dark=localStorage.getItem("romitcsv.theme")==="dark";
document.body.classList.toggle("dark",dark);
$("#mergerTheme").setAttribute("aria-pressed",String(dark));
$("#mergerTheme").onclick=()=>{const nextDark=!document.body.classList.contains("dark");document.body.classList.toggle("dark",nextDark);$("#mergerTheme").setAttribute("aria-pressed",String(nextDark));localStorage.setItem("romitcsv.theme",nextDark?"dark":"light")};
$("#mergerMenu").onclick=()=>$("#mergerNav").classList.toggle("open");