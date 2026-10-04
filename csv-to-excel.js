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
  const delimiter=detectDelimiter(text),rows=[],row=[];
  let cell="",quoted=false;
  for(let i=0;i<text.length;i++){
    const char=text[i],next=text[i+1];
    if(char==='"'){
      if(quoted&&next==='"'){cell+='"';i++}
      else quoted=!quoted;
    }else if(char===delimiter&&!quoted){row.push(cell);cell=""}
    else if((char==="\n"||char==="\r")&&!quoted){
      if(char==="\r"&&next==="\n")i++;
      row.push(cell);cell="";
      if(row.some(value=>value.trim()))rows.push(row.slice());
      row.length=0;
    }else cell+=char;
  }
  if(cell.length||row.length){row.push(cell);if(row.some(value=>value.trim()))rows.push(row.slice())}
  const width=rows.reduce((max,current)=>Math.max(max,current.length),0);
  return rows.map(current=>Array.from({length:width},(_,index)=>current[index]??""));
}

const uploadCard=$("#excelUploadCard");
const dropzone=$("#excelDropzone");
const workspace=$("#excelWorkspace");
let rows=[
  ["ID","Name","Email","City"],
  ["001","Ada Lovelace","ada@example.com","London"],
  ["002","Grace Hopper","grace@example.com","New York"],
  ["003","Alan Turing","alan@example.com","Manchester"]
];
let fileName="sample_data.csv";
let firstRowHeaders=true;
let convertNumbers=false;
let sheetName="Data";
let conversionError="";

function render(){
  const headers=rows[0]||[];
  const preview=rows.slice(0,11);
  const recordCount=Math.max(0,rows.length-(firstRowHeaders?1:0));
  workspace.hidden=false;
  workspace.innerHTML=`
    <div class="excel-data-card">
      <div class="excel-filebar"><div class="viewer-fileinfo"><div class="viewer-fileicon"><span>XLSX</span></div><div><strong title="${escapeHTML(fileName)}">${escapeHTML(fileName)}</strong><span>${recordCount.toLocaleString()} rows · ${headers.length} columns</span></div></div><button class="viewer-clear" id="clearExcel" type="button">Clear</button></div>
      <div class="excel-options"><label>Worksheet name <input id="sheetName" type="text" maxlength="31" value="${escapeHTML(sheetName)}"></label><label><input id="firstRowHeaders" type="checkbox" ${firstRowHeaders?"checked":""}> First row contains headers</label><label><input id="convertNumbers" type="checkbox" ${convertNumbers?"checked":""}> Convert number-like cells to numbers</label><button class="viewer-download" id="downloadExcel" type="button">Download Excel (.xlsx)</button></div>
      ${conversionError?`<p class="excel-error" role="alert">${escapeHTML(conversionError)}</p>`:""}
      <div class="editor-table-wrap excel-table-wrap"><table><thead><tr>${preview[0]?.map((value,index)=>`<th>${escapeHTML(firstRowHeaders?value:"Column "+(index+1))}</th>`).join("")||""}</tr></thead><tbody>${preview.slice(1).map(row=>`<tr>${row.map(value=>`<td title="${escapeHTML(value)}">${escapeHTML(value)}</td>`).join("")}</tr>`).join("")||`<tr><td colspan="${Math.max(1,headers.length)}" class="no-results">No rows to preview.</td></tr>`}</tbody></table></div>
      <div class="excel-preview-footer">Previewing ${Math.max(0,preview.length-(firstRowHeaders?1:0))} of ${recordCount.toLocaleString()} rows</div>
    </div>`;
  $("#sheetName").oninput=event=>{sheetName=event.target.value};
  $("#firstRowHeaders").onchange=event=>{firstRowHeaders=event.target.checked;render()};
  $("#convertNumbers").onchange=event=>{convertNumbers=event.target.checked};
  $("#clearExcel").onclick=()=>{rows=[];conversionError="";workspace.hidden=true;uploadCard.hidden=false;$("#excelFile").value="";$("#excelStatus").textContent=""};
  $("#downloadExcel").onclick=downloadExcel;
}

function openText(text,name){
  const parsed=parseCSV(text);
  if(!parsed.length||parsed.every(row=>row.every(value=>!value.trim()))){$("#excelStatus").textContent="This CSV file is empty.";return}
  rows=parsed;fileName=name||"data.csv";conversionError="";uploadCard.hidden=true;render();
  requestAnimationFrame(()=>workspace.scrollIntoView({behavior:"smooth",block:"start"}));
}

function excelValue(value){
  if(!convertNumbers||!value.trim())return value;
  if(!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value))return value;
  const number=Number(value);
  return Number.isFinite(number)?number:value;
}

function downloadExcel(){
  if(!window.XLSX){conversionError="Excel workbook support could not load. Check your internet connection and reload this page.";render();return}
  try{
    sheetName=$("#sheetName").value;
    const values=rows.map(row=>row.map(excelValue));
    const workbook=XLSX.utils.book_new();
    const worksheet=XLSX.utils.aoa_to_sheet(values);
    const safeName=(sheetName.trim()||"Data").replace(/[\\/?*\[\]:]/g,"_").slice(0,31)||"Data";
    if(firstRowHeaders&&rows.length>1)worksheet["!autofilter"]={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:rows.length-1,c:(rows[0]?.length||1)-1}})};
    worksheet["!cols"]=(rows[0]||[]).map((_,column)=>({wch:Math.min(42,Math.max(12,...rows.slice(0,101).map(row=>String(row[column]??"").length+2)))}));
    XLSX.utils.book_append_sheet(workbook,worksheet,safeName);
    const data=XLSX.write(workbook,{bookType:"xlsx",type:"array",compression:true});
    const link=document.createElement("a");link.href=URL.createObjectURL(new Blob([data],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));link.download=fileName.replace(/\.(csv|tsv)$/i,"")+".xlsx";document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
    conversionError="";
  }catch(error){console.error(error);conversionError="Could not create the Excel workbook.";render()}
}

render();
$("#excelBrowse").onclick=()=>$("#excelFile").click();
$("#excelFile").onchange=async event=>{
  const file=event.target.files?.[0];if(!file)return;
  if(file.size>50*1024*1024){$("#excelStatus").textContent="This CSV file is larger than 50MB.";return}
  try{openText(await file.text(),file.name)}catch(error){$("#excelStatus").textContent="Could not read this CSV file."}
};
["dragenter","dragover"].forEach(type=>dropzone.addEventListener(type,event=>{event.preventDefault();dropzone.classList.add("drag")}));
["dragleave","drop"].forEach(type=>dropzone.addEventListener(type,event=>{event.preventDefault();dropzone.classList.remove("drag")}));
dropzone.addEventListener("drop",async event=>{
  const file=event.dataTransfer?.files?.[0];if(!file)return;
  if(file.size>50*1024*1024){$("#excelStatus").textContent="This CSV file is larger than 50MB.";return}
  try{openText(await file.text(),file.name)}catch(error){$("#excelStatus").textContent="Could not read this CSV file."}
});

const dark=localStorage.getItem("romitcsv.theme")==="dark";
document.body.classList.toggle("dark",dark);
$("#excelTheme").setAttribute("aria-pressed",String(dark));
$("#excelTheme").onclick=()=>{const nextDark=!document.body.classList.contains("dark");document.body.classList.toggle("dark",nextDark);$("#excelTheme").setAttribute("aria-pressed",String(nextDark));localStorage.setItem("romitcsv.theme",nextDark?"dark":"light")};
$("#excelMenu").onclick=()=>$("#excelNav").classList.toggle("open");