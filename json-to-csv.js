const $=selector=>document.querySelector(selector);

function escapeHTML(value){
  return String(value??"").replace(/[&<>\"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char]));
}

function csvEscape(value){
  value=String(value??"");
  return /[",\n\r]/.test(value)?'"'+value.replace(/"/g,'""')+'"':value;
}

const sampleJSON=JSON.stringify([
  {id:1,name:"Ada Lovelace",email:"ada@example.com",city:"London"},
  {id:2,name:"Grace Hopper",email:"grace@example.com",city:"New York"},
  {id:3,name:"Alan Turing",email:"alan@example.com",city:"Manchester"}
],null,2);
const uploadCard=$("#jsonCsvUploadCard");
const dropzone=$("#jsonCsvDropzone");
const workspace=$("#jsonCsvWorkspace");
let inputText=sampleJSON;
let fileName="sample_data.json";
let output="";
let lastError="";
let includeHeader=true;
let nullAsEmpty=true;
let stringifyNested=true;
let dirty=false;

function cellValue(value,stringifyNested,emptyAsNull){
  if(value===null)return emptyAsNull?"":"null";
  if(typeof value==="object")return stringifyNested?JSON.stringify(value):String(value);
  return String(value);
}

function convertJSON(){
  const parsed=JSON.parse(inputText);
  const records=Array.isArray(parsed)?parsed:[parsed];
  if(!records.length)throw new Error("The JSON array is empty.");
  if(!records.every(value=>value&&typeof value==="object"&&!Array.isArray(value)))throw new Error("Use a JSON object or an array of objects.");
  const fields=[...new Set(records.flatMap(record=>Object.keys(record)))];
  if(!fields.length)throw new Error("No object fields were found to convert.");
  const data=records.map(record=>fields.map(field=>cellValue(record[field]??null,stringifyNested,nullAsEmpty)));
  const csvRows=includeHeader?[fields,...data]:data;
  return {fields,records,csvRows,csv:csvRows.map(row=>row.map(csvEscape).join(",")).join("\r\n")};
}

function render(){
  let result;
  try{result=convertJSON();lastError=""}catch(error){lastError=error.message;result={fields:[],records:[],csvRows:[],csv:""}}
  output=result.csv;
  const previewRows=includeHeader?result.csvRows.slice(1,11):result.csvRows.slice(0,10);
  workspace.hidden=false;
  workspace.innerHTML=`
    <div class="json-csv-card">
      <div class="json-csv-filebar"><div class="viewer-fileinfo"><div class="viewer-fileicon"><span>JSON</span></div><div><strong title="${escapeHTML(fileName)}">${escapeHTML(fileName)}</strong><span>${result.records.length.toLocaleString()} records · ${result.fields.length} fields</span></div></div><button class="viewer-clear" id="clearJsonCsv" type="button">Clear</button></div>
      <div class="json-csv-workbench">
        <section class="json-csv-input"><div class="json-csv-panel-heading"><h2>JSON input</h2><button class="viewer-edit" id="convertJsonCsv" type="button">Convert</button></div><textarea id="jsonCsvText" spellcheck="false" aria-label="JSON input">${escapeHTML(inputText)}</textarea><div class="json-csv-options"><label><input id="includeHeader" type="checkbox" ${includeHeader?"checked":""}> Include header row</label><label><input id="nullAsEmpty" type="checkbox" ${nullAsEmpty?"checked":""}> Empty cells for null values</label><label><input id="stringifyNested" type="checkbox" ${stringifyNested?"checked":""}> Serialize nested values as JSON</label></div>${lastError?`<p class="json-csv-error" role="alert">${escapeHTML(lastError)}</p>`:""}</section>
        <section class="json-csv-output"><div class="json-csv-panel-heading"><h2>CSV preview</h2><div class="json-actions"><button class="viewer-edit" id="copyJsonCsv" type="button" ${lastError||dirty?"disabled":""}>Copy CSV</button><button class="viewer-download" id="downloadJsonCsv" type="button" ${lastError||dirty?"disabled":""}>Download CSV</button></div></div><div class="editor-table-wrap json-csv-table-wrap"><table><thead><tr>${result.fields.map(field=>`<th>${escapeHTML(field)}</th>`).join("")}</tr></thead><tbody>${previewRows.map(row=>`<tr>${row.map(value=>`<td title="${escapeHTML(value)}">${escapeHTML(value)}</td>`).join("")}</tr>`).join("")||`<tr><td colspan="${Math.max(1,result.fields.length)}" class="no-results">${lastError?"Fix the JSON input to see a preview.":"No rows to display."}</td></tr>`}</tbody></table></div><div class="json-csv-output-footer">${lastError?"":`Showing ${previewRows.length} of ${result.records.length} records`}</div></section>
      </div>
    </div>`;
  $("#jsonCsvText").oninput=event=>{inputText=event.target.value;dirty=true;$("#copyJsonCsv").disabled=true;$("#downloadJsonCsv").disabled=true};
  $("#convertJsonCsv").onclick=()=>{inputText=$("#jsonCsvText").value;dirty=false;render()};
  $("#includeHeader").onchange=event=>{inputText=$("#jsonCsvText").value;includeHeader=event.target.checked;dirty=false;render()};
  $("#nullAsEmpty").onchange=event=>{inputText=$("#jsonCsvText").value;nullAsEmpty=event.target.checked;dirty=false;render()};
  $("#stringifyNested").onchange=event=>{inputText=$("#jsonCsvText").value;stringifyNested=event.target.checked;dirty=false;render()};
  $("#copyJsonCsv").onclick=async()=>{
    inputText=$("#jsonCsvText").value;
    try{await navigator.clipboard.writeText(output);$("#jsonCsvStatus").textContent="CSV copied."}
    catch(error){$("#jsonCsvStatus").textContent="Clipboard access is unavailable in this browser."}
  };
  $("#downloadJsonCsv").onclick=()=>{
    inputText=$("#jsonCsvText").value;
    const link=document.createElement("a");link.href=URL.createObjectURL(new Blob([output],{type:"text/csv;charset=utf-8"}));link.download=fileName.replace(/\.json$/i,"")+".csv";document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
  };
  $("#clearJsonCsv").onclick=()=>{inputText="";output="";dirty=false;workspace.hidden=true;uploadCard.hidden=false;$("#jsonCsvStatus").textContent="";$("#jsonCsvFile").value=""};
}

function openJSON(text,name){
  inputText=text;fileName=name||"data.json";uploadCard.hidden=true;render();
  requestAnimationFrame(()=>workspace.scrollIntoView({behavior:"smooth",block:"start"}));
}

render();
$("#jsonCsvBrowse").onclick=()=>$("#jsonCsvFile").click();
$("#jsonCsvFile").onchange=async event=>{
  const file=event.target.files?.[0];if(!file)return;
  if(file.size>50*1024*1024){$("#jsonCsvStatus").textContent="This JSON file is larger than 50MB.";return}
  try{openJSON(await file.text(),file.name)}catch(error){$("#jsonCsvStatus").textContent="Could not read this JSON file."}
};
["dragenter","dragover"].forEach(type=>dropzone.addEventListener(type,event=>{event.preventDefault();dropzone.classList.add("drag")}));
["dragleave","drop"].forEach(type=>dropzone.addEventListener(type,event=>{event.preventDefault();dropzone.classList.remove("drag")}));
dropzone.addEventListener("drop",async event=>{
  const file=event.dataTransfer?.files?.[0];if(!file)return;
  if(file.size>50*1024*1024){$("#jsonCsvStatus").textContent="This JSON file is larger than 50MB.";return}
  try{openJSON(await file.text(),file.name)}catch(error){$("#jsonCsvStatus").textContent="Could not read this JSON file."}
});

const dark=localStorage.getItem("romitcsv.theme")==="dark";
document.body.classList.toggle("dark",dark);
$("#jsonCsvTheme").setAttribute("aria-pressed",String(dark));
$("#jsonCsvTheme").onclick=()=>{const nextDark=!document.body.classList.contains("dark");document.body.classList.toggle("dark",nextDark);$("#jsonCsvTheme").setAttribute("aria-pressed",String(nextDark));localStorage.setItem("romitcsv.theme",nextDark?"dark":"light")};
$("#jsonCsvMenu").onclick=()=>$("#jsonCsvNav").classList.toggle("open");