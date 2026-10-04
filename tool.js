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
    <div class="viewer-upload" id="viewerUpload">
      <div class="viewer-upload-icon" aria-hidden="true">
        <svg viewBox="0 0 48 48" fill="none"><path d="M24 31V8m0 0-8 8m8-8 8 8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 27v10a4 4 0 0 0 4 4h18a4 4 0 0 0 4-4V27" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>
      </div>
      <strong>Drop your CSV file here</strong>
      <span>or choose a file from your computer</span>
      <input id="f" type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" hidden>
      <button class="viewer-primary" id="go" type="button">Browse CSV</button>
      <small>CSV or TSV · up to 50 MB · processed locally</small>
      <div id="s" class="tool-status" role="status"></div>
    </div>
    <div id="viewerWorkspace" hidden>
      <div class="viewer-filebar">
        <div class="viewer-fileinfo">
          <div class="viewer-fileicon">CSV</div>
          <div><strong id="fileName">data.csv</strong><span id="fileMeta"></span></div>
        </div>
        <button class="viewer-secondary" id="newFile" type="button">Open another</button>
      </div>
      <div class="viewer-toolbar">
        <div class="viewer-search">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="m20 20-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <input id="search" placeholder="Search rows..." autocomplete="off">
          <kbd>/</kbd>
        </div>
        <div class="viewer-actions">
          <select id="pageSize" aria-label="Rows per page"><option value="50">50 rows</option><option value="100" selected>100 rows</option><option value="250">250 rows</option></select>
          <button class="viewer-secondary" id="download" type="button">Download CSV</button>
        </div>
      </div>
      <div class="viewer-stats" id="stats"></div>
      <div id="out"></div>
    </div>`;

  let rows=[], filtered=[], page=1, pageSize=100, sortCol=-1, sortDir=1, fileLabel="data.csv";

  function formatBytes(bytes){
    if(!bytes)return "0 B";
    const units=["B","KB","MB","GB"],i=Math.min(Math.floor(Math.log(bytes)/Math.log(1024)),3);
    return (bytes/Math.pow(1024,i)).toFixed(i?1:0)+" "+units[i];
  }

  function render(){
    const out=$("#out"), controls=$("#viewerWorkspace");
    if(!rows.length){controls.hidden=true;return}
    const q=($("#search")?.value||"").trim().toLowerCase();
    filtered=rows.slice(1).map((r,i)=>({r,index:i+1})).filter(x=>!q||x.r.some(v=>String(v).toLowerCase().includes(q)));
    if(sortCol>=0){
      filtered.sort((a,b)=>String(a.r[sortCol]??"").localeCompare(String(b.r[sortCol]??""),undefined,{numeric:true,sensitivity:"base"})*sortDir);
    }
    const pages=Math.max(1,Math.ceil(filtered.length/pageSize));
    page=Math.min(page,pages);
    const start=(page-1)*pageSize;
    const visible=filtered.slice(start,start+pageSize);
    $("#stats").textContent=`${filtered.length.toLocaleString()} matching rows · ${Math.max(0,rows.length-1).toLocaleString()} total rows · ${rows[0]?.length||0} columns`;
    let html='<div class="viewer-table-wrap"><table><thead><tr>';
    html+=rows[0].map((h,i)=>'<th><button class="th-sort" data-col="'+i+'">'+escapeHTML(h||("Column "+(i+1)))+(sortCol===i?(sortDir===1?" ↑":" ↓"):"")+'</button></th>').join("");
    html+='</tr></thead><tbody>';
    if(visible.length){
      html+=visible.map(x=>'<tr><td class="row-number">'+x.index+'</td>'+x.r.map(v=>'<td>'+escapeHTML(v)+'</td>').join("")+'</tr>').join("");
    }else{
      html+='<tr><td colspan="'+(rows[0].length+1)+'" class="no-results">No matching rows found.</td></tr>';
    }
    html+='</tbody></table></div>';
    html+=`<div class="viewer-pager"><span>Showing ${visible.length?start+1:0}–${Math.min(start+visible.length,filtered.length)} of ${filtered.length.toLocaleString()}</span><div><button class="viewer-page-btn" id="prev" ${page<=1?"disabled":""}>← Previous</button><span>Page ${page} / ${pages}</span><button class="viewer-page-btn" id="next" ${page>=pages?"disabled":""}>Next →</button></div></div>`;
    out.innerHTML=html;

    $("#search").oninput=()=>{page=1;render()};
    $("#pageSize").onchange=e=>{pageSize=+e.target.value;page=1;render()};
    $("#download").onclick=()=>dl(fileLabel.replace(/\.(csv|tsv)$/i,"")+".csv",csv(rows),"text/csv");
    $("#prev").onclick=()=>{if(page>1){page--;render()}};
    $("#next").onclick=()=>{if(page<pages){page++;render()}};
    document.querySelectorAll(".th-sort").forEach(b=>b.onclick=()=>{
      const col=+b.dataset.col;
      if(sortCol===col)sortDir*=-1;else{sortCol=col;sortDir=1}
      page=1;render();
    });
  }

  async function openFile(file){
    if(!file){$("#s").textContent="Choose a CSV file first.";return}
    if(file.size>50*1024*1024){$("#s").textContent="This file is larger than 50 MB.";return}
    $("#s").textContent="Reading your CSV…";
    try{
      const text=await file.text();
      const parsed=parse(text);
      if(!parsed.length){$("#s").textContent="This CSV file is empty.";return}
      rows=parsed;fileLabel=file.name||"data.csv";page=1;sortCol=-1;sortDir=1;
      $("#viewerUpload").hidden=true;
      $("#viewerWorkspace").hidden=false;
      $("#fileName").textContent=fileLabel;
      $("#fileMeta").textContent=`${formatBytes(file.size)} · ${Math.max(0,rows.length-1).toLocaleString()} rows · ${rows[0].length} columns`;
      $("#s").textContent="";
      render();
      setTimeout(()=>$("#search")?.focus(),50);
    }catch(e){$("#s").textContent="Could not read this CSV file."}
  }

  $("#go").onclick=()=>$("#f").click();
  $("#f").onchange=()=>openFile($("#f").files[0]);
  $("#newFile").onclick=()=>{
    $("#viewerWorkspace").hidden=true;
    $("#viewerUpload").hidden=false;
    $("#f").value="";
    $("#s").textContent="";
    rows=[];filtered=[];
  };

  const upload=$("#viewerUpload");
  ["dragenter","dragover"].forEach(type=>upload.addEventListener(type,e=>{e.preventDefault();upload.classList.add("drag")}));
  ["dragleave","drop"].forEach(type=>upload.addEventListener(type,e=>{e.preventDefault();upload.classList.remove("drag")}));
  upload.addEventListener("drop",e=>openFile(e.dataTransfer.files[0]));

  document.addEventListener("keydown",e=>{
    if(e.key==="/"&&document.activeElement?.tagName!=="INPUT"&&document.activeElement?.tagName!=="TEXTAREA"){
      e.preventDefault();$("#search")?.focus();
    }
  });

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
              rows=parse(value);
              if(rows.length){
                fileLabel="data.csv";
                $("#viewerUpload").hidden=true;
                $("#viewerWorkspace").hidden=false;
                $("#fileName").textContent="data.csv";
                $("#fileMeta").textContent=`${Math.max(0,rows.length-1).toLocaleString()} rows · ${rows[0].length} columns`;
                render();
              }
            }
            db.close();resolve();
          };
          get.onerror=()=>{db.close();resolve()};
        };
        request.onerror=()=>resolve();
      }catch(e){resolve()}
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
