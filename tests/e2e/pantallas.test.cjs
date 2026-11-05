const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn,spawnSync}=require('node:child_process'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const config=require('./config.json');
const repo=path.resolve(__dirname,'../..'),client=path.join(repo,config.sub);
const audit=require('./contrast.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const out=process.env.E2E_OUTPUT||path.join(repo,'test-results');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.name==='node_modules'?[]:e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}

test(`${config.slug}: pantallas, dos tamaños, claro/oscuro, demo/vacía`,{timeout:600000},async()=>{
 fs.mkdirSync(out,{recursive:true});
 const report={slug:config.slug,scope:'Recorrido de pantallas y controles de navegación. Los flujos de escritura se verifican en pruebas funcionales separadas.',checks:[],failures:[],excluded:[]};
 const fixture=fs.mkdtempSync(path.join(os.tmpdir(),`pasta-${config.slug}-`));
 let browser,vite,child;
 const server=config.server?path.join(fixture,'server'):null;
 try{
  if(server){
   const original=path.join(repo,path.dirname(config.sub),'server');
   fs.cpSync(original,server,{recursive:true,filter:p=>!p.split(path.sep).some(x=>['node_modules','data','db-data','uploads','pdfs'].includes(x))&&!/\.(db|sqlite|sqlite3)(-wal|-shm)?$/.test(p)&&!/(api-token\.txt|mobile-pairing\.json|\.env(?:\..*)?|.*\.secrets)$/.test(path.basename(p))});
   const modules=process.env.E2E_SERVER_MODULES||path.join(original,'node_modules');fs.symlinkSync(modules,path.join(server,'node_modules'),'junction');
   const pkg=JSON.parse(fs.readFileSync(path.join(server,'package.json')));
   const env={...process.env,PORT:String(config.apiPort),SERVER_PORT:String(config.apiPort),NACH_BIND:'127.0.0.1',NACH_DATA_DIR:path.join(fixture,'data')};
   if(['cierra-mas-facil','plan-trimestral-contenido'].includes(config.slug))spawnSync(process.execPath,['src/seed.js'],{cwd:server,env,windowsHide:true});
   let log='';child=spawn(process.execPath,[pkg.main||(config.slug==='parte-firmado'?'index.js':'src/index.js')],{cwd:server,env,windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);
   for(let i=0;i<150&&!/escuchando|servidor en|API en|Servidor iniciado|Servidor corriendo/i.test(log)&&child.exitCode===null;i++)await sleep(100);
   assert.equal(child.exitCode,null,log);fs.writeFileSync(path.join(out,'servidor.log'),log);
  }
  process.chdir(client);
  const viteModule=path.join(path.dirname(require.resolve('vite/package.json',{paths:[client]})),'dist/node/index.js');
  const {createServer}=await import(pathToFileURL(viteModule));
  vite=await createServer({root:client,configFile:path.join(client,'vite.config.js'),server:{host:'127.0.0.1',port:config.port,strictPort:true,proxy:server?{'/api':`http://127.0.0.1:${config.apiPort}`,'/uploads':`http://127.0.0.1:${config.apiPort}`}:{}}});await vite.listen();
  browser=await chromium.launch({executablePath:process.env.E2E_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const paths=new Set([config.main]);
  for(const f of walk(path.join(client,'src')).filter(f=>/\.[jt]sx?$/.test(f))){
   for(const m of fs.readFileSync(f,'utf8').matchAll(/<Route\s[^>]*?path=["']([^"']+)["']/g)){
    let route=m[1];if(route==='*'){paths.add('/qa-ruta-desconocida');continue;}if(route==='movil'||route.includes(':token')){report.excluded.push(route);continue;}
    if(!route.startsWith('/'))route='/'+route;paths.add(route);
   }
  }
  for(const mode of ['demo','vacia']){
   if(mode==='vacia'&&server){
    if(config.slug==='no-show-cero'){
     const boot=await fetch(`http://127.0.0.1:${config.apiPort}/api/auth/bootstrap`).then(r=>r.json());
     const reset=await fetch(`http://127.0.0.1:${config.apiPort}/api/config/restablecer`,{method:'POST',headers:{Authorization:`Bearer ${boot.token}`,'Content-Type':'application/json'},body:JSON.stringify({confirmar:'BORRAR'})});assert.equal(reset.status,200);
    }else if(config.slug==='parte-firmado'){
     const boot=await fetch(`http://127.0.0.1:${config.apiPort}/api/auth/bootstrap`).then(r=>r.json());
     const reset=await fetch(`http://127.0.0.1:${config.apiPort}/api/restablecer`,{method:'POST',headers:{Authorization:`Bearer ${boot.token}`,'Content-Type':'application/json'},body:JSON.stringify({confirmar:'BORRAR'})});assert.equal(reset.status,200);
    }else{
    const Database=require(path.join(process.env.E2E_SERVER_MODULES||path.join(server,'node_modules'),'better-sqlite3'));
    const databases=walk(fixture).filter(f=>/\.(db|sqlite|sqlite3)$/.test(f));
    assert.ok(databases.length,'No se ha encontrado la base aislada: no se puede asegurar el estado vacío.');
    for(const file of databases){const db=new Database(file);db.pragma('foreign_keys = OFF');const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r=>r.name).filter(n=>!/(config|ajuste|empresa|migration|version|settings|perfil|plantilla|tarifario|servicio)/i.test(n));db.transaction(()=>{for(const table of tables)db.exec(`DELETE FROM "${table.replaceAll('"','""')}"`);})();db.close();}
    }
   }
   for(const [size,width,height]of [['desktop',1280,800],['movil',390,844]])for(const theme of ['dark','light']){
    const context=await browser.newContext({viewport:{width,height},colorScheme:theme,reducedMotion:'reduce'});
    if(mode==='vacia'&&!server&&config.slug==='leads-que-avanzan')await context.addInitScript(()=>localStorage.setItem('lqa_state',JSON.stringify({leads:[],secuencias:[],interacciones:[],alertas:[],settings:{diasSinActividadAlerta:3},vista:'kanban',leadActivoId:null,secuenciaActivaId:null})));
    if(mode==='vacia'&&config.slug==='cuanto-me-queda')await context.addInitScript(()=>localStorage.setItem('cmq_estado_v1',JSON.stringify({facturacion:0,gastos:0,horas:0,regimen:'manual',cuotaManual:0})));
    const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[],api=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(/\/api\/|\/uploads\//.test(r.url())&&r.status()>=400)api.push(`${r.status()} ${new URL(r.url()).pathname}`);});
    for(const route of paths){
     if(mode==='vacia'&&route.includes(':'))continue;
     const url=route.replace(/:[\w]+/g,'1');
     await page.goto(`http://127.0.0.1:${config.port}${url}`,{waitUntil:'domcontentloaded'});await page.waitForSelector('#root > *');await sleep(350);
     // Select the actual theme control where present; CSS-only forcing is reported.
     const isDark=await page.locator('html').evaluate(e=>e.classList.contains('dark'));
     if(isDark!==(theme==='dark')){
      const toggle=page.locator('button[aria-label="Cambiar tema"]:visible,button[title="Cambiar tema"]:visible,button[aria-label="Activar tema claro"]:visible,button[aria-label="Activar tema oscuro"]:visible');
      if(await toggle.count())await toggle.first().click();
      else {await page.locator('html').evaluate((e,d)=>e.classList.toggle('dark',d),theme==='dark');report.excluded.push('Selector de tema no localizado en '+url);}
     }
     await sleep(400);
     const control=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,brokenImages:[...document.images].filter(i=>i.getBoundingClientRect().width>0&&i.complete&&!i.naturalWidth).map(i=>i.getAttribute('src')),buttons:[...document.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>({name:b.getAttribute('aria-label')||b.getAttribute('title')||b.innerText.trim(),disabled:b.disabled})),text:document.body.innerText.slice(0,1200)}));
     const contrast=await page.evaluate(audit),file=`matrix-${mode}-${size}-${theme}-${url.replace(/[^a-z0-9]/gi,'_')||'root'}.png`;
     await page.screenshot({path:path.join(out,file),fullPage:true});
     const check={mode,size,theme,route:url,...control,contrast,errors:[...errors],apiErrors:[...api],capture:file};report.checks.push(check);
     if(control.brokenImages.length||control.scrollWidth>width||contrast.failures.length||errors.length||api.length||control.buttons.some(b=>!b.name&&!b.disabled))report.failures.push(check);
     errors.length=0;api.length=0;
    }
    const tabs=config.tabs||(config.internal.startsWith('button:')?[config.internal.slice(7)]:[]);
    for(const tab of tabs){
     await page.goto(`http://127.0.0.1:${config.port}${config.main}`,{waitUntil:'domcontentloaded'});await sleep(400);
     const nav=page.getByRole('button',{name:tab,exact:true}).filter({visible:true});
     if(!await nav.count()){report.excluded.push({mode,size,theme,tab,reason:'Control no disponible en este estado; pendiente prueba del flujo que lo habilita.'});continue;}
     const currentDark=await page.locator('html').evaluate(e=>e.classList.contains('dark'));
     if(currentDark!==(theme==='dark')){const toggle=page.locator('button[aria-label="Cambiar tema"]:visible,button[title="Cambiar tema"]:visible');if(await toggle.count())await toggle.first().click();else{await page.locator('html').evaluate((e,d)=>e.classList.toggle('dark',d),theme==='dark');report.excluded.push('Selector de tema no localizado en '+tab);}}
     await nav.first().click();await sleep(500);
     const control=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,brokenImages:[...document.images].filter(i=>i.getBoundingClientRect().width>0&&i.complete&&!i.naturalWidth).map(i=>i.getAttribute('src')),buttons:[...document.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>({name:b.getAttribute('aria-label')||b.getAttribute('title')||b.innerText.trim(),disabled:b.disabled}))}));
     const check={mode,size,theme,route:'button:'+tab,...control,contrast:await page.evaluate(audit),errors:[...errors],apiErrors:[...api],capture:`matrix-${mode}-${size}-${theme}-tab-${tab.replace(/[^a-z0-9]/gi,'_')}.png`};report.checks.push(check);
     if(control.brokenImages.length||control.scrollWidth>width||check.contrast.failures.length||errors.length||api.length||control.buttons.some(b=>!b.name&&!b.disabled))report.failures.push(check);
     await page.screenshot({path:path.join(out,check.capture),fullPage:true});errors.length=0;api.length=0;
    }
    await context.close();
   }
  }
  assert.equal(report.failures.length,0,JSON.stringify(report.failures.map(c=>({mode:c.mode,size:c.size,theme:c.theme,route:c.route,errors:c.errors,api:c.apiErrors,overflow:c.scrollWidth>c.width,contrast:c.contrast.failures.slice(0,5),buttons:c.buttons.filter(b=>!b.name)})),null,2));
 }finally{
  fs.writeFileSync(path.join(out,'matriz-pantallas.json'),JSON.stringify(report,null,2));
  if(browser)await browser.close();if(vite)await vite.close();if(child&&child.exitCode===null){child.kill();await new Promise(r=>{child.once('exit',r);setTimeout(r,2000)});}
  assert.ok(path.resolve(fixture).startsWith(path.resolve(os.tmpdir())+path.sep),'La limpieza debe quedar dentro del directorio temporal.');
  // Detach the dependency junction before removing the isolated data tree.
  const modules=server&&path.join(server,'node_modules');
  if(modules&&fs.existsSync(modules))fs.rmdirSync(modules);
  try{await fs.promises.rm(fixture,{recursive:true,force:true,maxRetries:1,retryDelay:200});}catch(e){report.cleanupWarning={code:e.code,path:fixture};fs.writeFileSync(path.join(out,'matriz-pantallas.json'),JSON.stringify(report,null,2));console.warn('Temporal retenido por Windows:',fixture,e.code);}
 }
});
