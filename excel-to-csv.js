const $=selector=>document.querySelector(selector);

function escapeHTML(value){
  return String(value??"").replace(/[&<>\"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char]));
}

function csvEscape(value,delimiter){
  value=String(value??"");
  const pattern=new RegExp('["\\r\\n'+delimiter.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+']');
  return pattern.test(value)?'"'+value.replace(/"/g,'""')+'"':value;
}

const uploadCard=$("#excelCsvUploadCard");
const dropzone=$("#excelCsvDropzone");
const workspace=$("#excelCsvWorkspace");
const sampleRows=[["ID","Name","Email","City"],["001","Ada Lovelace","ada@example.com","London"],["002","Grace Hopper","grace@example.com","New York"],["003","Alan Turing","alan@example.com","Manchester"]];
let workbook=null;
let sheetNames=["Sample"];
let selectedSheet="Sample";
let rows=sampleRows;
let fileName="sample-workbook.xlsx";
let delimiter=",";
let csvOutput="";

function readSheet(name){
  if(!workbook)return sampleRows;
  const sheet=workbook.Sheets[name];
  const data=XLSX.utils.sheet_to_json(sheet,{header:1,defval:"",raw:false,blankrows:false});
  const width=data.reduce((max,row)=>Math.max(max,row.length),0);
  return data.map(row=>Array.from({length:width},(_,index)=>row[index]??""));
}

function serializeRows(data){
  return data.map(row=>row.map(value=>csvEscape(value,delimiter)).join(delimiter)).join("\r\n");
}

function render(){
  csvOutput=serializeRows(rows);
  const rowCount=rows.length;
  const columnCount=rows.reduce((max,row)=>Math.max(max,row.length),0);
  const previewRows=rows.slice(0,11);
  const delimiterOptions=[[",","Comma (,)"],[";","Semicolon (;)"],["\t","Tab"],["|","Pipe (|)"]];
  workspace.hidden=false;
  workspace.innerHTML=`
    <div class="excel-csv-data-card">
      <div class="excel-csv-filebar"><div class="viewer-fileinfo"><div class="viewer-fileicon"><span>XLSX</span></div><div><strong title="${escapeHTML(fileName)}">${escapeHTML(fileName)}</strong><span>${sheetNames.length} worksheet${sheetNames.length===1?"":"s"} · ${rowCount.toLocaleString()} rows · ${columnCount} columns</span></div></div><button class="viewer-clear" id="clearExcelCsv" type="button">Clear</button></div>
      <div class="excel-csv-options"><label>Worksheet <select id="worksheetSelect">${sheetNames.map(name=>`<option value="${escapeHTML(name)}" ${name===selectedSheet?"selected":""}>${escapeHTML(name)}</option>`).join("")}</select></label><label>Delimiter <select id="csvDelimiter">${delimiterOptions.map(([value,label])=>`<option value="${escapeHTML(value)}" ${value===delimiter?"selected":""}>${label}</option>`).join("")}</select></label><div class="excel-csv-actions"><button class="viewer-edit" id="copyExcelCsv" type="button">Copy CSV</button><button class="viewer-download" id="downloadExcelCsv" type="button">Download CSV</button></div></div>
      <div class="editor-table-wrap excel-csv-table-wrap"><table><thead><tr>${(previewRows[0]||[]).map(value=>`<th>${escapeHTML(value)}</th>`).join("")}</tr></thead><tbody>${previewRows.slice(1).map(row=>`<tr>${row.map(value=>`<td title="${escapeHTML(value)}">${escapeHTML(value)}</td>`).join("")}</tr>`).join("")||`<tr><td colspan="${Math.max(1,columnCount)}" class="no-results">No rows in this worksheet.</td></tr>`}</tbody></table></div>
      <div class="excel-csv-footer"><span>Previewing ${Math.max(0,previewRows.length-1)} of ${Math.max(0,rowCount-1)} data rows</span><span id="excelCsvCopyStatus" role="status"></span></div>
    </div>`;
  $("#worksheetSelect").onchange=event=>{selectedSheet=event.target.value;rows=readSheet(selectedSheet);render()};
  $("#csvDelimiter").onchange=event=>{delimiter=event.target.value;render()};
  $("#copyExcelCsv").onclick=async()=>{
    try{await navigator.clipboard.writeText(csvOutput);$("#excelCsvCopyStatus").textContent="CSV copied."}
    catch(error){$("#excelCsvCopyStatus").textContent="Clipboard access is unavailable in this browser."}
  };
  $("#downloadExcelCsv").onclick=()=>{
    const link=document.createElement("a");link.href=URL.createObjectURL(new Blob([csvOutput],{type:"text/csv;charset=utf-8"}));link.download=fileName.replace(/\.(xlsx|xlsm?|xlsb|ods)$/i,"")+"-"+selectedSheet.replace(/[\\/?*\[\]:]/g,"_")+".csv";document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
  };
  $("#clearExcelCsv").onclick=()=>{workbook=null;rows=[];sheetNames=[];workspace.hidden=true;uploadCard.hidden=false;$("#excelCsvFile").value="";$("#excelCsvStatus").textContent=""};
}

async function openWorkbook(file){
  if(file.size>50*1024*1024){$("#excelCsvStatus").textContent="This workbook is larger than 50MB.";return}
  if(!window.XLSX){$("#excelCsvStatus").textContent="Excel workbook support could not load. Check your internet connection and reload this page.";return}
  try{
    workbook=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:true});
    sheetNames=workbook.SheetNames;
    if(!sheetNames.length)throw new Error("This workbook has no worksheets.");
    selectedSheet=sheetNames[0];fileName=file.name;rows=readSheet(selectedSheet);uploadCard.hidden=true;$("#excelCsvStatus").textContent="";render();
    requestAnimationFrame(()=>workspace.scrollIntoView({behavior:"smooth",block:"start"}));
  }catch(error){console.error(error);$("#excelCsvStatus").textContent="Could not read this Excel workbook."}
}

render();
$("#excelCsvBrowse").onclick=()=>$("#excelCsvFile").click();
$("#excelCsvFile").onchange=event=>{const file=event.target.files?.[0];if(file)openWorkbook(file)};
["dragenter","dragover"].forEach(type=>dropzone.addEventListener(type,event=>{event.preventDefault();dropzone.classList.add("drag")}));
["dragleave","drop"].forEach(type=>dropzone.addEventListener(type,event=>{event.preventDefault();dropzone.classList.remove("drag")}));
dropzone.addEventListener("drop",event=>{const file=event.dataTransfer?.files?.[0];if(file)openWorkbook(file)});

const dark=localStorage.getItem("romitcsv.theme")==="dark";
document.body.classList.toggle("dark",dark);
$("#excelCsvTheme").setAttribute("aria-pressed",String(dark));
$("#excelCsvTheme").onclick=()=>{const nextDark=!document.body.classList.contains("dark");document.body.classList.toggle("dark",nextDark);$("#excelCsvTheme").setAttribute("aria-pressed",String(nextDark));localStorage.setItem("romitcsv.theme",nextDark?"dark":"light")};
$("#excelCsvMenu").onclick=()=>$("#excelCsvNav").classList.toggle("open");