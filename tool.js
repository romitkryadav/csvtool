const $=s=>document.querySelector(s);
const kind=new URLSearchParams(location.search).get("tool")||"viewer";
const app=$("#app");

function escapeHTML(v){
  return String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
}

function detectDelimiter(text){
  const first=text.replace(/^\uFEFF/,"").split(/\r?\n/).find(x=>x.trim())||"";
  const choices=[",",";","\t","|"];
  return choices.map(d=>[d,(first.split(d).length-1)]).sort((a,b)=>b[1]-a[1])[0][0];
}

function parse(text){
  text=String(text||"").replace(/^\uFEFF/,"");
  const d=detectDelimiter(text), rows=[], row=[], cell=[];
  let inQuotes=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i], next=text[i+1];
    if(ch==='"'){
      if(inQuotes&&next==='"'){cell.push('"');i++}
      else inQuotes=!inQuotes;
    }else if(ch===d&&!inQuotes){
      row.push(cell.join(""));cell.length=0;
    }else if((ch==="\n"||ch==="\r")&&!inQuotes){
      if(ch==="\r"&&next==="\n")i++;
      row.push(cell.join(""));cell.length=0;
      if(row.some(v=>v.trim()!=="")) rows.push(row.slice());
      row.length=0;
    }else cell.push(ch);
  }
  if(cell.length||row.length){
    row.push(cell.join(""));
    if(row.some(v=>v.trim()!=="")) rows.push(row.slice());
  }
  const width=rows.reduce((m,r)=>Math.max(m,r.length),0);
  return rows.map(r=>Array.from({length:width},(_,i)=>r[i]??""));
}

function csv(rows){
  return rows.map(r=>r.map(v=>{
    v=String(v??"");
    return /[",\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;
  }).join(",")).join("\r\n");
}

function dl(name,data,type){
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([data],{type}));
  a.download=name;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

function viewer(){
  app.innerHTML=`
    <div class="viewer-upload-inner" id="viewerUpload">
      <div class="viewer-upload-icon" aria-hidden="true">
        <svg viewBox="0 0 48 48" fill="none"><path d="M24 31V8m0 0-8 8m8-8 8 8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 27v10a4 4 0 0 0 4 4h18a4 4 0 0 0 4-4V27" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>
      </div>
      <strong>Drag &amp; drop your CSV file here</strong>
      <span>or</span>
      <input id="f" type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" hidden>
      <button class="viewer-primary" id="go" type="button"><svg viewBox="0 0 24 24" fill="none"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H14l6 6v7.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11Z" stroke="currentColor" stroke-width="1.8"/><path d="M14 4v6h6" stroke="currentColor" stroke-width="1.8"/><path d="M8 15h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>Browse CSV File</button>
      <small>Supports CSV, TSV &nbsp;•&nbsp; Max file size: 50MB</small>
      <div id="s" class="tool-status" role="status"></div>
    </div>`;

  const workspace=$("#workspace");
  let rows=[], filtered=[], page=1, pageSize=10, sortCol=-1, sortDir=1, fileLabel="sample_data.csv";

  function formatBytes(bytes){
    if(!bytes)return "0 B";
    const units=["B","KB","MB","GB"],i=Math.min(Math.floor(Math.log(bytes)/Math.log(1024)),3);
    return (bytes/Math.pow(1024,i)).toFixed(i?1:0)+" "+units[i];
  }

  function showWorkspace(){
    workspace.hidden=false;
    workspace.classList.add("visible");
  }

  function render(){
    if(!rows.length){workspace.innerHTML="";workspace.hidden=true;return}
    const q=($("#search")?.value||"").trim().toLowerCase();
    filtered=rows.slice(1).map((r,i)=>({r,index:i+1})).filter(x=>!q||x.r.some(v=>String(v).toLowerCase().includes(q)));
    if(sortCol>=0){
      filtered.sort((a,b)=>String(a.r[sortCol]??"").localeCompare(String(b.r[sortCol]??""),undefined,{numeric:true,sensitivity:"base"})*sortDir);
    }
    const pages=Math.max(1,Math.ceil(filtered.length/pageSize));
    page=Math.min(page,pages);
    const start=(page-1)*pageSize;
    const visible=filtered.slice(start,start+pageSize);
    workspace.innerHTML=`
      <div class="viewer-data-card">
        <div class="viewer-filebar">
          <div class="viewer-fileinfo">
            <div class="viewer-fileicon"><span>CSV</span></div>
            <div><strong>${escapeHTML(fileLabel)}</strong><span>${formatBytes(rows._size||0)} &nbsp;•&nbsp; ${Math.max(0,rows.length-1).toLocaleString()} rows &nbsp;•&nbsp; ${rows[0]?.length||0} columns</span></div>
          </div>
          <div class="viewer-file-actions">
            <button class="viewer-download" id="download" type="button"><svg viewBox="0 0 24 24" fill="none"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Download CSV <span>⌄</span></button>
            <button class="viewer-edit" id="edit" type="button"><svg viewBox="0 0 24 24" fill="none"><path d="m14.5 6.5 3 3M5 19l3.2-.7L18.5 8a2.1 2.1 0 0 0-3-3L5.2 15.3 5 19Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>Edit</button>
            <button class="viewer-clear" id="clear" type="button"><svg viewBox="0 0 24 24" fill="none"><path d="M6 7h12m-9 0V4h6v3m-7 0 1 13h6l1-13M10 10v4m4-4v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>Clear</button>
          </div>
        </div>
        <div class="viewer-table-tools">
          <div class="viewer-search">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="m20 20-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            <input id="search" placeholder="Search in table..." autocomplete="off">
          </div>
          <div class="viewer-selects">
            <label>Rows per page <select id="pageSize"><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></label>
            <label>Sort by <select id="sortSelect"><option value="-1">None</option>${rows[0].map((h,i)=>'<option value="'+i+'">'+escapeHTML(h||("Column "+(i+1)))+'</option>').join("")}</select></label>
          </div>
        </div>
        <div class="viewer-table-wrap"><table><thead><tr><th class="row-num-head">#</th>${rows[0].map((h,i)=>'<th>'+escapeHTML(h||("Column "+(i+1)))+'<button class="th-sort" data-col="'+i+'">↕</button></th>').join("")}</tr></thead><tbody>${visible.length?visible.map(x=>'<tr><td class="row-number">'+x.index+'</td>'+x.r.map(v=>'<td>'+escapeHTML(v)+'</td>').join("")+'</tr>').join(""):'<tr><td colspan="'+(rows[0].length+1)+'" class="no-results">No matching rows found.</td></tr>'}</tbody></table></div>
        <div class="viewer-pager"><span>Showing ${visible.length?start+1:0} to ${Math.min(start+visible.length,filtered.length)} of ${filtered.length.toLocaleString()} rows</span><div class="pager-buttons"><button id="prev" ${page<=1?"disabled":""}>‹</button><b>${page}</b><button id="next" ${page>=pages?"disabled":""}>›</button></div></div>
      </div>`;
    $("#pageSize").value=String(pageSize);
    $("#sortSelect").value=String(sortCol);
    $("#search").oninput=()=>{page=1;render()};
    $("#pageSize").onchange=e=>{pageSize=+e.target.value;page=1;render()};
    $("#sortSelect").onchange=e=>{sortCol=+e.target.value;sortDir=1;page=1;render()};
    $("#download").onclick=()=>dl(fileLabel.replace(/\.(csv|tsv)$/i,"")+".csv",csv(rows),"text/csv");
    $("#edit").onclick=()=>{location.href="tool.html?tool=editor"};
    $("#clear").onclick=()=>{rows=[];workspace.classList.remove("visible");workspace.hidden=true};
    $("#prev").onclick=()=>{if(page>1){page--;render()}};
    $("#next").onclick=()=>{if(page<pages){page++;render()}};
    document.querySelectorAll(".th-sort").forEach(b=>b.onclick=()=>{const col=+b.dataset.col;if(sortCol===col)sortDir*=-1;else{sortCol=col;sortDir=1}page=1;render()});
  }

  async function openFile(file){
    if(!file){$("#s").textContent="Choose a CSV file first.";return}
    if(file.size>50*1024*1024){$("#s").textContent="This file is larger than 50MB.";return}
    $("#s").textContent="Reading your CSV…";
    try{
      const text=await file.text(),parsed=parse(text);
      if(!parsed.length){$("#s").textContent="This CSV file is empty.";return}
      parsed._size=file.size;
      rows=parsed;fileLabel=file.name||"data.csv";page=1;pageSize=10;sortCol=-1;sortDir=1;
      $("#s").textContent="";
      showWorkspace();render();
    }catch(e){$("#s").textContent="Could not read this CSV file."}
  }

  $("#go").onclick=()=>$("#f").click();
  $("#f").onchange=()=>openFile($("#f").files[0]);
  const upload=$("#viewerUpload")||app;
  ["dragenter","dragover"].forEach(type=>upload.addEventListener(type,e=>{e.preventDefault();app.classList.add("drag")}));
  ["dragleave","drop"].forEach(type=>upload.addEventListener(type,e=>{e.preventDefault();app.classList.remove("drag")}));
  app.addEventListener("drop",e=>openFile(e.dataTransfer.files[0]));

  function sample(){
    rows=[
      ["ID","Name","Email","Age","City"],
      ["1","John Doe","john@example.com","28","New York"],
      ["2","Jane Smith","jane@example.com","32","London"],
      ["3","Mike Johnson","mike@example.com","24","Paris"],
      ["4","Emily Brown","emily@example.com","29","Berlin"],
      ["5","David Wilson","david@example.com","33","Tokyo"],
      ["6","Sarah Miller","sarah@example.com","27","Sydney"],
      ["7","James Taylor","james@example.com","41","Toronto"],
      ["8","Olivia Anderson","olivia@example.com","35","Singapore"],
      ["9","Daniel Thomas","daniel@example.com","22","Mumbai"],
      ["10","Sophia Jackson","sophia@example.com","26","Madrid"]
    ];
    rows._size=12.4*1024;fileLabel="sample_data.csv";page=1;pageSize=10;sortCol=-1;showWorkspace();render();
  }

  function loadPending(){
    return new Promise(resolve=>{
      try{
        const request=indexedDB.open("RomitCSVDB",1);
        request.onupgradeneeded=()=>request.result.createObjectStore("files");
        request.onsuccess=()=>{
          const db=request.result,tx=db.transaction("files","readwrite"),store=tx.objectStore("files"),get=store.get("pendingCsv");
          get.onsuccess=()=>{
            const value=get.result;
            if(value){
              store.delete("pendingCsv");
              const parsed=parse(value);
              if(parsed.length){rows=parsed;rows._size=0;fileLabel="data.csv";page=1;pageSize=10;showWorkspace();render()}
            }else sample();
            db.close();resolve();
          };
          get.onerror=()=>{db.close();sample();resolve()};
        };
        request.onerror=()=>{sample();resolve()};
      }catch(e){sample();resolve()}
    });
  }
  loadPending();
}

function input(m=false){
  app.innerHTML='<input id="f" type="file" accept=".csv,text/csv" '+(m?"multiple":"")+'> <button class="btn" id="go">Process</button><div id="s" class="tool-status"></div><div id="out"></div>';
}
function files(){
  return Promise.all([...$("#f").files].map(f=>new Promise(z=>{const r=new FileReader;r.onload=()=>z(parse(r.result));r.readAsText(f)})));
}
function clean(){
  input();$("#go").onclick=async()=>{const r=(await files())[0];if(!r?.length)return;
    const seen=new Set,o=[r[0]];r.slice(1).forEach(x=>{const k=JSON.stringify(x);if(x.some(v=>v.trim())&&!seen.has(k)){seen.add(k);o.push(x)}});
    $("#out").innerHTML='<p>Removed '+(r.length-o.length)+' rows.</p><button class="btn" id="d">Download cleaned CSV</button>';
    $("#d").onclick=()=>dl("cleaned.csv",csv(o),"text/csv");
  };
}
function merge(){
  input(true);$("#go").onclick=async()=>{const a=await files();if(!a.length)return;const o=[a[0][0],...a.flatMap(x=>x.slice(1))];
    $("#out").innerHTML='<p>Created '+(o.length-1)+' combined rows.</p><button class="btn" id="d">Download merged CSV</button>';
    $("#d").onclick=()=>dl("merged.csv",csv(o),"text/csv");
  };
}
function split(){
  input();app.insertAdjacentHTML("afterbegin",'<input id="n" type="number" value="1000" min="1">');
  $("#go").onclick=async()=>{const r=(await files())[0],n=+$("#n").value||1000;if(!r?.length)return;
    const p=[];for(let i=1;i<r.length;i+=n)p.push([r[0],...r.slice(i,i+n)]);
    $("#out").innerHTML=p.map((x,i)=>'<button class="btn" data-i="'+i+'">Download part '+(i+1)+'</button> ').join("");
    document.querySelectorAll("[data-i]").forEach(b=>b.onclick=()=>dl("part-"+(+b.dataset.i+1)+".csv",csv(p[+b.dataset.i]),"text/csv"));
  };
}
function validate(){
  input();$("#go").onclick=async()=>{const r=(await files())[0];if(!r?.length)return;const n=r[0].length,b=r.slice(1).filter(x=>x.length!==n).length;
    $("#out").innerHTML='<p>'+Math.max(0,r.length-1)+' rows · '+n+' columns.</p><p>'+(b?b+" rows have inconsistent columns.":"CSV structure looks consistent.")+'</p>';
  };
}
function cjson(){
  input();$("#go").onclick=async()=>{const r=(await files())[0];if(!r?.length)return;const h=r[0],j=JSON.stringify(r.slice(1).map(x=>Object.fromEntries(h.map((k,i)=>[k,x[i]??""]))),null,2);
    $("#out").innerHTML='<pre>'+escapeHTML(j)+'</pre><button class="btn" id="d">Download JSON</button>';
    $("#d").onclick=()=>dl("data.json",j,"application/json");
  };
}
function jcsv(){
  app.innerHTML='<textarea id="j" placeholder="Paste JSON array of objects"></textarea><br><button class="btn" id="go">Convert</button><div id="s" class="tool-status"></div><div id="out"></div>';
  $("#go").onclick=()=>{try{const a=JSON.parse($("#j").value);if(!Array.isArray(a)||!a.every(x=>x&&typeof x==="object"&&!Array.isArray(x)))throw 0;
    const h=[...new Set(a.flatMap(x=>Object.keys(x)))],r=[h,...a.map(x=>h.map(k=>x[k]??""))];
    $("#out").innerHTML='<p>Converted '+a.length+' records.</p><button class="btn" id="d">Download CSV</button>';
    $("#d").onclick=()=>dl("data.csv",csv(r),"text/csv");
  }catch(e){$("#s").textContent="Invalid JSON. Use an array of objects."}};
}
const names={viewer:["CSV Viewer","Open, search, sort and inspect CSV data."],cleaner:["CSV Cleaner","Remove blank and duplicate rows."],merger:["CSV Merger","Combine multiple CSV files."],splitter:["CSV Splitter","Split CSV into smaller files."],validator:["CSV Validator","Check CSV row consistency."],csvjson:["CSV to JSON","Convert CSV rows to JSON."],jsoncsv:["JSON to CSV","Convert JSON objects to CSV."]};
const n=names[kind]||["CSV Tool","Work with CSV data in your browser."];
$("#title").textContent=n[0];$("#desc").textContent=n[1];
({viewer,cleaner:clean,merger:merge,splitter:split,validator,csvjson:cjson,jsoncsv:jcsv})[kind]?.();
if(kind==="sql")viewer();

const savedTheme=localStorage.getItem("romitcsv.theme")==="dark"?"dark":"light";
document.body.classList.toggle("dark",savedTheme==="dark");
$("#theme").onclick=()=>{
  const dark=!document.body.classList.contains("dark");
  document.body.classList.toggle("dark",dark);
  localStorage.setItem("romitcsv.theme",dark?"dark":"light");
};
$("#menu").onclick=()=>$("#nav").classList.toggle("open");
