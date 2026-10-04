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
    <div class="upload-box">
      <input id="f" type="file" accept=".csv,text/csv">
      <button class="btn" id="go">Open CSV</button>
      <div id="s" class="tool-status"></div>
    </div>
    <div id="viewerControls" hidden></div>
    <div id="out"></div>`;

  let rows=[], filtered=[], page=1, pageSize=100, sortCol=-1, sortDir=1;

  function render(){
    const out=$("#out"), controls=$("#viewerControls");
    if(!rows.length){out.innerHTML="";controls.hidden=true;return}
    const query=($("#search")?.value||"").trim().toLowerCase();
    filtered=rows.slice(1).map((r,i)=>({r,index:i+1})).filter(x=>!query||x.r.some(v=>String(v).toLowerCase().includes(query)));
    if(sortCol>=0){
      filtered.sort((a,b)=>String(a.r[sortCol]??"").localeCompare(String(b.r[sortCol]??""),undefined,{numeric:true,sensitivity:"base"})*sortDir);
    }
    const pages=Math.max(1,Math.ceil(filtered.length/pageSize));
    page=Math.min(page,pages);
    const start=(page-1)*pageSize;
    const visible=filtered.slice(start,start+pageSize);

    controls.hidden=false;
    controls.innerHTML=`
      <div class="toolbar">
        <input id="search" placeholder="Search rows..." value="${escapeHTML(query)}">
        <select id="pageSize"><option value="50">50 rows</option><option value="100" selected>100 rows</option><option value="250">250 rows</option></select>
        <button class="btn" id="download">Download CSV</button>
      </div>
      <div class="stats">${filtered.length} matching rows · ${Math.max(0,rows.length-1)} total rows · ${rows[0]?.length||0} columns · Page ${page} of ${pages}</div>`;

    let html='<div class="table-wrap"><table><thead><tr>';
    html+=rows[0].map((h,i)=>'<th><button class="th-sort" data-col="'+i+'">'+escapeHTML(h||("Column "+(i+1)))+(sortCol===i?(sortDir===1?" ↑":" ↓"):"")+'</button></th>').join("");
    html+='</tr></thead><tbody>';
    html+=visible.map(x=>'<tr>'+x.r.map(v=>'<td>'+escapeHTML(v)+'</td>').join("")+'</tr>').join("");
    html+='</tbody></table></div>';
    html+=`<div class="pager"><button class="btn" id="prev" ${page<=1?"disabled":""}>Previous</button><span>Page ${page} / ${pages}</span><button class="btn" id="next" ${page>=pages?"disabled":""}>Next</button></div>`;
    out.innerHTML=html;

    $("#search").oninput=()=>{page=1;render()};
    $("#pageSize").onchange=e=>{pageSize=+e.target.value;page=1;render()};
    $("#download").onclick=()=>dl("data.csv",csv(rows),"text/csv");
    $("#prev").onclick=()=>{if(page>1){page--;render()}};
    $("#next").onclick=()=>{if(page<pages){page++;render()}};
    document.querySelectorAll(".th-sort").forEach(b=>b.onclick=()=>{
      const c=+b.dataset.col;
      if(sortCol===c)sortDir*=-1;else{sortCol=c;sortDir=1}
      page=1;render();
    });
  }

  async function openFile(file){
    if(!file){$("#s").textContent="Choose a CSV file first.";return}
    if(file.size>50*1024*1024){$("#s").textContent="For browser stability, please use a CSV under 50 MB.";return}
    $("#s").textContent="Reading CSV...";
    try{
      const text=await file.text();
      rows=parse(text);
      if(!rows.length){$("#s").textContent="The CSV file is empty.";return}
      $("#s").textContent="Loaded "+rows.length+" rows.";
      page=1;sortCol=-1;render();
    }catch(e){$("#s").textContent="Could not read this CSV file."}
  }

  $("#go").onclick=()=>openFile($("#f").files[0]);
  $("#f").onchange=()=>openFile($("#f").files[0]);

  const pending=sessionStorage.getItem("csvtools.pendingFile");
  if(pending){
    sessionStorage.removeItem("csvtools.pendingFile");
    rows=parse(pending);
    if(rows.length){$("#s").textContent="Loaded CSV from homepage.";render()}
  }
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

const light=localStorage.getItem("csvtools.theme")==="light";if(light)document.body.classList.add("light");
$("#theme").onclick=()=>{document.body.classList.toggle("light");localStorage.setItem("csvtools.theme",document.body.classList.contains("light")?"light":"dark")};
$("#menu").onclick=()=>$("#nav").classList.toggle("open");
