const input=document.getElementById("fileInput"),drop=document.getElementById("dropzone"),status=document.getElementById("fileStatus"),theme=document.getElementById("themeBtn"),menu=document.getElementById("menuBtn");
const go=t=>location.href="tool.html?tool="+t;
function choose(){if(input)input.click()}
function handle(file){
  if(!file)return;
  if(file.size>50*1024*1024){if(status)status.textContent="File is larger than 50 MB.";return}
  if(!/\.(csv|tsv)$/i.test(file.name)&&!["text/csv","text/tab-separated-values"].includes(file.type)){if(status)status.textContent="Please choose a CSV or TSV file.";return}
  if(status)status.textContent="Opening file...";
  const r=new FileReader;
  r.onload=()=>{try{sessionStorage.setItem("csvtools.pendingFile",r.result);location.href="tool.html?tool=viewer"}catch(e){if(status)status.textContent="Could not open the file. Please try a smaller file."}};
  r.onerror=()=>{if(status)status.textContent="Could not read this file."};
  r.readAsText(file);
}
if(input){
  input.onchange=()=>handle(input.files[0]);
  const browse=document.getElementById("browseBtn");
  if(browse)browse.onclick=e=>{e.stopPropagation();choose()};
  const cta=document.getElementById("ctaBtn");
  if(cta)cta.onclick=choose;
  if(drop){
    drop.onclick=e=>{if(e.target.id!=="browseBtn")choose()};
    ["dragenter","dragover"].forEach(x=>drop.addEventListener(x,e=>{e.preventDefault();drop.classList.add("drag")}));
    ["dragleave","drop"].forEach(x=>drop.addEventListener(x,e=>{e.preventDefault();drop.classList.remove("drag")}));
    drop.addEventListener("drop",e=>handle(e.dataTransfer.files[0]));
  }
}
document.querySelectorAll(".tool-card").forEach(c=>c.addEventListener("click",()=>{}));
if(theme){
  if(localStorage.getItem("csvtools.theme")==="light")document.body.classList.add("light");
  theme.onclick=()=>{document.body.classList.toggle("light");localStorage.setItem("csvtools.theme",document.body.classList.contains("light")?"light":"dark")};
}
if(menu)menu.onclick=()=>{const nav=document.getElementById("mainNav");if(nav)nav.classList.toggle("open")};
