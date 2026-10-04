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
  const delimiter=detectDelimiter(text),records=[],issues=[];
  let row=[],cell="",quoted=false,line=1,rowLine=1;
  function finishCell(){row.push(cell);cell=""}
  function finishRow(){row.push(cell);records.push({cells:row,line:rowLine});row=[];cell=""}
  for(let i=0;i<text.length;i++){
    const char=text[i],next=text[i+1];
    if(char==='"'){
      if(quoted&&next==='"'){cell+='"';i++}
      else if(quoted)quoted=false;
      else if(!cell.length)quoted=true;
      else{issues.push({severity:"error",line:rowLine,message:"Quote appears inside an unquoted field."});cell+=char}
    }else if(char===delimiter&&!quoted){finishCell()}
    else if((char==="\n"||char==="\r")&&!quoted){
      if(char==="\r"&&next==="\n")i++;
      finishRow();line++;rowLine=line;
    }else{
      cell+=char;
      if(char==="\n")line++;
    }
  }
  if(cell.length||row.length)finishRow();
  if(quoted)issues.push({severity:"error",line:rowLine,message:"Quoted field is not closed."});
  return {records,issues};
}

function validateCSV(parsed){
  const records=parsed.records,header=records[0]?.cells||[],expected=header.length,issues=[...parsed.issues];
  const headerNames=new Map();
  header.forEach((value,index)=>{
    const name=value.trim();
    if(!name)issues.push({severity:"error",line:records[0]?.line||1,message:"Column "+(index+1)+" has an empty header."});
    const key=name.toLowerCase();
    if(name&&headerNames.has(key))issues.push({severity:"error",line:records[0]?.line||1,message:"Duplicate header '"+name+"' in columns "+(headerNames.get(key)+1)+" and "+(index+1)+"."});
    else if(name)headerNames.set(key,index);
  });

  let blankRows=0,duplicateRows=0,whitespaceRows=0,emptyCells=0;
  const seen=new Map();
  records.slice(1).forEach(record=>{
    const cells=record.cells;
    if(cells.every(value=>!value.trim())){
      blankRows++;issues.push({severity:"warning",line:record.line,message:"Blank row."});return;
    }
    if(cells.length!==expected)issues.push({severity:"error",line:record.line,message:"Expected "+expected+" columns but found "+cells.length+"."});
    const trimmed=cells.map(value=>value.trim());
    const whitespaceCount=cells.filter((value,index)=>value!==trimmed[index]).length;
    if(whitespaceCount){whitespaceRows++;issues.push({severity:"warning",line:record.line,message:whitespaceCount+" cell(s) contain leading or trailing whitespace."})}
    emptyCells+=Math.max(0,expected-cells.length)+cells.filter(value=>!value.trim()).length;
    const key=JSON.stringify(trimmed);
    if(seen.has(key)){duplicateRows++;issues.push({severity:"warning",line:record.line,message:"Duplicate data row; matches row "+seen.get(key)+"."})}
    else seen.set(key,record.line);
  });
  return {header,issues,blankRows,duplicateRows,whitespaceRows,emptyCells,dataRows:Math.max(0,records.length-1)};
}

const uploadCard=$("#validatorUploadCard");
const dropzone=$("#validatorDropzone");
const workspace=$("#validatorWorkspace");
let parsed={records:[
  {line:1,cells:["ID","Name","Name","Email"]},
  {line:2,cells:["1"," Ada Lovelace ","Ada Lovelace","ada@example.com"]},
  {line:3,cells:["2","Grace Hopper","Grace Hopper","grace@example.com"]},
  {line:4,cells:["2","Grace Hopper","Grace Hopper","grace@example.com"]},
  {line:5,cells:["3","Alan Turing","alan@example.com"]},
  {line:6,cells:["","","",""]}
],issues:[]};
let report=validateCSV(parsed);
let fileName="sample_data.csv";
let page=1;
const pageSize=10;
let severity="all";

function render(){
  const header=report.header;
  const visibleRecords=parsed.records.slice(1).slice((page-1)*pageSize,page*pageSize);
  const filteredIssues=report.issues.filter(issue=>severity==="all"||issue.severity===severity);
  const totalPages=Math.max(1,Math.ceil(Math.max(0,parsed.records.length-1)/pageSize));
  const rowIssueLines=new Set(report.issues.map(issue=>issue.line));
  workspace.hidden=false;
  workspace.innerHTML=`
    <div class="validator-data-card">
      <div class="validator-filebar"><div class="viewer-fileinfo"><div class="viewer-fileicon"><span>CSV</span></div><div><strong title="${escapeHTML(fileName)}">${escapeHTML(fileName)}</strong><span>${report.dataRows.toLocaleString()} data rows · ${header.length} columns</span></div></div><button class="viewer-clear" id="clearValidator" type="button">Clear</button></div>
      <div class="validator-stats"><div><strong>${report.dataRows.toLocaleString()}</strong><span>Rows checked</span></div><div><strong>${report.issues.filter(issue=>issue.severity==="error").length.toLocaleString()}</strong><span>Errors</span></div><div><strong>${report.issues.filter(issue=>issue.severity==="warning").length.toLocaleString()}</strong><span>Warnings</span></div><div><strong>${report.blankRows.toLocaleString()}</strong><span>Blank rows</span></div><div><strong>${report.emptyCells.toLocaleString()}</strong><span>Empty cells</span></div></div>
      <section class="validator-findings"><div class="validator-findings-head"><h2>Findings <span>${filteredIssues.length}</span></h2><label>Show <select id="severityFilter"><option value="all" ${severity==="all"?"selected":""}>All</option><option value="error" ${severity==="error"?"selected":""}>Errors</option><option value="warning" ${severity==="warning"?"selected":""}>Warnings</option></select></label></div><div class="validator-issue-list">${filteredIssues.map(issue=>`<div class="validator-issue ${issue.severity}"><span>Row ${issue.line}</span><strong>${issue.severity==="error"?"Error":"Warning"}</strong><p>${escapeHTML(issue.message)}</p></div>`).join("")||'<p class="validator-empty">No issues found for this filter.</p>'}</div></section>
      <div class="validator-preview-head"><h2>Data preview</h2><span>Rows with findings are highlighted</span></div>
      <div class="editor-table-wrap validator-table-wrap"><table><thead><tr><th class="row-num-head">#</th>${header.map(value=>`<th>${escapeHTML(value)}</th>`).join("")}</tr></thead><tbody>${visibleRecords.map(record=>`<tr class="${rowIssueLines.has(record.line)?"has-issue":""}"><td class="row-number">${record.line}</td>${Array.from({length:Math.max(header.length,record.cells.length)},(_,column)=>`<td title="${escapeHTML(record.cells[column]??"")}">${escapeHTML(record.cells[column]??"")}</td>`).join("")}</tr>`).join("")||`<tr><td colspan="${header.length+1}" class="no-results">No data rows.</td></tr>`}</tbody></table></div>
      <div class="viewer-pager"><span>Showing ${visibleRecords.length?(page-1)*pageSize+1:0} to ${Math.min(page*pageSize,report.dataRows)} of ${report.dataRows.toLocaleString()} rows</span><div class="pager-buttons"><button id="validatorPrev" type="button" ${page<=1?"disabled":""}>‹</button><b>${page}</b><button id="validatorNext" type="button" ${page>=totalPages?"disabled":""}>›</button></div></div>
    </div>`;
  $("#severityFilter").onchange=event=>{severity=event.target.value;render()};
  $("#clearValidator").onclick=()=>{parsed={records:[],issues:[]};report={header:[],issues:[],blankRows:0,duplicateRows:0,whitespaceRows:0,emptyCells:0,dataRows:0};workspace.hidden=true;uploadCard.hidden=false;$("#validatorFile").value="";$("#validatorStatus").textContent=""};
  $("#validatorPrev").onclick=()=>{if(page>1){page--;render()}};
  $("#validatorNext").onclick=()=>{if(page<totalPages){page++;render()}};
}

function openText(text,name){
  parsed=parseCSV(text);
  if(!parsed.records.length||parsed.records.every(record=>record.cells.every(value=>!value.trim()))){$("#validatorStatus").textContent="This CSV file is empty.";return}
  report=validateCSV(parsed);fileName=name||"data.csv";page=1;severity="all";uploadCard.hidden=true;render();
  requestAnimationFrame(()=>workspace.scrollIntoView({behavior:"smooth",block:"start"}));
}

render();
$("#validatorBrowse").onclick=()=>$("#validatorFile").click();
$("#validatorFile").onchange=async event=>{
  const file=event.target.files?.[0];if(!file)return;
  if(file.size>50*1024*1024){$("#validatorStatus").textContent="This file is larger than 50MB.";return}
  try{openText(await file.text(),file.name)}catch(error){$("#validatorStatus").textContent="Could not read this CSV file."}
};
["dragenter","dragover"].forEach(type=>dropzone.addEventListener(type,event=>{event.preventDefault();dropzone.classList.add("drag")}));
["dragleave","drop"].forEach(type=>dropzone.addEventListener(type,event=>{event.preventDefault();dropzone.classList.remove("drag")}));
dropzone.addEventListener("drop",async event=>{
  const file=event.dataTransfer?.files?.[0];if(!file)return;
  if(file.size>50*1024*1024){$("#validatorStatus").textContent="This file is larger than 50MB.";return}
  try{openText(await file.text(),file.name)}catch(error){$("#validatorStatus").textContent="Could not read this CSV file."}
});

const dark=localStorage.getItem("romitcsv.theme")==="dark";
document.body.classList.toggle("dark",dark);
$("#validatorTheme").setAttribute("aria-pressed",String(dark));
$("#validatorTheme").onclick=()=>{const nextDark=!document.body.classList.contains("dark");document.body.classList.toggle("dark",nextDark);$("#validatorTheme").setAttribute("aria-pressed",String(nextDark));localStorage.setItem("romitcsv.theme",nextDark?"dark":"light")};
$("#validatorMenu").onclick=()=>$("#validatorNav").classList.toggle("open");