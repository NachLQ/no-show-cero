const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn,spawnSync}=require('node:child_process');
const {request}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const config=require('./config.json'),repo=path.resolve(__dirname,'../..');
exports.fixture=async function fixture(){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),`pasta-func-${config.slug}-`)),server=path.join(temp,'server'),original=path.join(repo,path.dirname(config.sub),'server');
 fs.cpSync(original,server,{recursive:true,filter:p=>!p.split(path.sep).some(x=>['node_modules','data','db-data','uploads','pdfs'].includes(x))&&!/\.(db|sqlite|sqlite3)(-wal|-shm)?$/.test(p)&&!/(api-token\.txt|mobile-pairing\.json|\.env(?:\..*)?|.*\.secrets)$/.test(path.basename(p))});
 fs.symlinkSync(process.env.E2E_SERVER_MODULES||path.join(original,'node_modules'),path.join(server,'node_modules'),'junction');
 const port=Number(process.env.E2E_API_PORT||config.apiPort);
 const env={...process.env,PORT:String(port),SERVER_PORT:String(port),NACH_DATA_DIR:path.join(temp,'data'),NACH_BIND:'127.0.0.1'};
 if(['cierra-mas-facil','plan-trimestral-contenido'].includes(config.slug))spawnSync(process.execPath,['src/seed.js'],{cwd:server,env,windowsHide:true});
 const pkg=JSON.parse(fs.readFileSync(path.join(server,'package.json')));let log='';
 const child=spawn(process.execPath,[pkg.main||(config.slug==='parte-firmado'?'index.js':'src/index.js')],{cwd:server,env,windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);
 let api;
 const close=async()=>{if(api)await api.dispose();if(child.exitCode===null){child.kill();await new Promise(r=>{child.once('exit',r);setTimeout(r,2000)});}assertTemp(temp);fs.rmdirSync(path.join(server,'node_modules'));await fs.promises.rm(temp,{recursive:true,force:true,maxRetries:3,retryDelay:200});};
 try{
  for(let i=0;i<150&&!/escuchando|servidor en|API en|Servidor iniciado|Servidor corriendo/i.test(log)&&child.exitCode===null;i++)await new Promise(r=>setTimeout(r,100));
  if(child.exitCode!==null)throw Error(log);
  api=await request.newContext({baseURL:`http://127.0.0.1:${port}`});
  const bootstrap=await api.get('/api/auth/bootstrap');if(bootstrap.ok()){const data=await bootstrap.json();if(data.token){await api.dispose();api=await request.newContext({baseURL:`http://127.0.0.1:${port}`,extraHTTPHeaders:{Authorization:`Bearer ${data.token}`}});}}
  const json=async(method,url,data)=>{const response=await api[method](url,data===undefined?{}:{data});if(!response.ok())throw Error(`${response.status()} ${url} ${await response.text()}`);return response.status()===204?null:response.json();};
  return {api,json,close,temp,server,port};
 }catch(e){await close();throw e;}
};
function assertTemp(p){if(!path.resolve(p).startsWith(path.resolve(os.tmpdir())+path.sep))throw Error('Limpieza fuera del temporal');}
