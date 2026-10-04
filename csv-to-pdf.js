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

const uploadCard=$("#pdfUploadCard");
const dropzone=$("#pdfDropzone");
const workspace=$("#pdfWorkspace");
let rows=[
  ["ID","Name","Email","City"],
  ["1","Ada Lovelace","ada@example.com","London"],
  ["2","Grace Hopper","grace@example.com","New York"],
  ["3","Alan Turing","alan@example.com","Manchester"],
  ["4","Katherine Johnson","kj@example.com","White Sulphur Springs"]
];
let fileName="sample_data.csv";
let orientation="landscape";
let pageSize="a4";
let includeHeader=true;
let fontSize=9;
let generationError="";

function render(){
  const dataRows=rows.slice(includeHeader?1:0);
  const headers=includeHeader?(rows[0]||[]):Array.from({length:rows.reduce((max,row)=>Math.max(max,row.length),0)},(_,index)=>"Column "+(index+1));
  const previewRows=dataRows.slice(0,10);
  workspace.hidden=false;
  workspace.innerHTML=`
    <div class="pdf-data-card">
      <div class="pdf-filebar"><div class="viewer-fileinfo"><div class="viewer-fileicon"><span>PDF</span></div><div><strong title="${escapeHTML(fileName)}">${escapeHTML(fileName)}</strong><span>${dataRows.length.toLocaleString()} rows · ${headers.length} columns</span></div></div><button class="viewer-clear" id="clearPdf" type="button">Clear</button></div>
      <div class="pdf-options"><label>Page size<select id="pdfPageSize"><option value="a4">A4</option><option value="letter">Letter</option></select></label><label>Orientation<select id="pdfOrientation"><option value="landscape">Landscape</option><option value="portrait">Portrait</option></select></label><label>Font size<select id="pdfFontSize"><option value="7">Small</option><option value="9">Regular</option><option value="11">Large</option></select></label><label><input id="pdfIncludeHeader" type="checkbox" ${includeHeader?"checked":""}> Include first row as headers</label><button class="viewer-download" id="downloadPdf" type="button">Download PDF</button></div>
      ${generationError?`<p class="pdf-error" role="alert">${escapeHTML(generationError)}</p>`:""}
      <div class="editor-table-wrap pdf-table-wrap"><table><thead><tr>${headers.map(header=>`<th>${escapeHTML(header)}</th>`).join("")}</tr></thead><tbody>${previewRows.map(row=>`<tr>${row.map(value=>`<td title="${escapeHTML(value)}">${escapeHTML(value)}</td>`).join("")}</tr>`).join("")||`<tr><td colspan="${Math.max(1,headers.length)}" class="no-results">No data rows.</td></tr>`}</tbody></table></div>
      <div class="pdf-preview-footer">Previewing ${previewRows.length} of ${dataRows.length.toLocaleString()} rows</div>
    </div>`;
  $("#pdfPageSize").value=pageSize;
  $("#pdfOrientation").value=orientation;
  $("#pdfFontSize").value=String(fontSize);
  $("#pdfPageSize").onchange=event=>{pageSize=event.target.value};
  $("#pdfOrientation").onchange=event=>{orientation=event.target.value};
  $("#pdfFontSize").onchange=event=>{fontSize=Number(event.target.value)};
  $("#pdfIncludeHeader").onchange=event=>{includeHeader=event.target.checked;render()};
  $("#clearPdf").onclick=()=>{rows=[];workspace.hidden=true;uploadCard.hidden=false;$("#pdfFile").value="";$("#pdfStatus").textContent=""};
  $("#downloadPdf").onclick=downloadPDF;
}

function downloadPDF(){
  const PdfConstructor=window.jspdf?.jsPDF;
  if(!PdfConstructor){generationError="PDF support could not load. Check your internet connection and reload this page.";render();return}
  try{
    const dataRows=rows.slice(includeHeader?1:0);
    const columnCount=rows.reduce((max,row)=>Math.max(max,row.length),0);
    const headers=includeHeader?(rows[0]||[]):Array.from({length:columnCount},(_,index)=>"Column "+(index+1));
    const documentPDF=new PdfConstructor({orientation,unit:"mm",format:pageSize});
    const title=fileName.replace(/\.(csv|tsv)$/i,"");
    documentPDF.setFontSize(14);documentPDF.text(title,12,13);
    documentPDF.autoTable({
      head:[headers],
      body:dataRows.map(row=>Array.from({length:columnCount},(_,index)=>String(row[index]??""))),
      startY:19,
      margin:{top:12,right:10,bottom:14,left:10},
      styles:{fontSize,cellPadding:2,overflow:"linebreak"},
      headStyles:{fillColor:[28,49,68],textColor:[255,255,255]},
      didDrawPage:context=>{
        const pageCount=documentPDF.internal.getNumberOfPages();
        documentPDF.setFontSize(8);
        documentPDF.text("Page "+context.pageNumber+" of "+pageCount,documentPDF.internal.pageSize.getWidth()-12,documentPDF.internal.pageSize.getHeight()-5,{align:"right"});
      }
    });
    documentPDF.save(title+".pdf");
    generationError="";
  }catch(error){console.error(error);generationError="Could not create the PDF. Try a smaller font size or a narrower table.";render()}
}

function openText(text,name){
  const parsed=parseCSV(text);
  if(!parsed.length||parsed.every(row=>row.every(value=>!value.trim()))){$("#pdfStatus").textContent="This CSV file is empty.";return}
  rows=parsed;fileName=name||"data.csv";generationError="";uploadCard.hidden=true;render();
  requestAnimationFrame(()=>workspace.scrollIntoView({behavior:"smooth",block:"start"}));
}

render();
$("#pdfBrowse").onclick=()=>$("#pdfFile").click();
$("#pdfFile").onchange=async event=>{
  const file=event.target.files?.[0];if(!file)return;
  if(file.size>50*1024*1024){$("#pdfStatus").textContent="This CSV file is larger than 50MB.";return}
  try{openText(await file.text(),file.name)}catch(error){$("#pdfStatus").textContent="Could not read this CSV file."}
};
["dragenter","dragover"].forEach(type=>dropzone.addEventListener(type,event=>{event.preventDefault();dropzone.classList.add("drag")}));
["dragleave","drop"].forEach(type=>dropzone.addEventListener(type,event=>{event.preventDefault();dropzone.classList.remove("drag")}));
dropzone.addEventListener("drop",async event=>{
  const file=event.dataTransfer?.files?.[0];if(!file)return;
  if(file.size>50*1024*1024){$("#pdfStatus").textContent="This CSV file is larger than 50MB.";return}
  try{openText(await file.text(),file.name)}catch(error){$("#pdfStatus").textContent="Could not read this CSV file."}
});

const dark=localStorage.getItem("romitcsv.theme")==="dark";
document.body.classList.toggle("dark",dark);
$("#pdfTheme").setAttribute("aria-pressed",String(dark));
$("#pdfTheme").onclick=()=>{const nextDark=!document.body.classList.contains("dark");document.body.classList.toggle("dark",nextDark);$("#pdfTheme").setAttribute("aria-pressed",String(nextDark));localStorage.setItem("romitcsv.theme",nextDark?"dark":"light")};
$("#pdfMenu").onclick=()=>$("#pdfNav").classList.toggle("open");