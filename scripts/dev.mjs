// One foreground process owns both services; Ctrl+C stops its children.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
const root=process.cwd();
if(existsSync(path.join(root,'.env')))process.loadEnvFile(path.join(root,'.env'));
const venv=path.join(root,'python_backend','.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
const python=process.env.ATLAS_PYTHON || (existsSync(venv)?venv:'python');
const apiPort=process.env.ATLAS_API_PORT || '8000';
const apiUrl=`http://127.0.0.1:${apiPort}`;
const env={...process.env,ATLAS_BACKEND_URL:apiUrl,NEXT_PUBLIC_ATLAS_LOCATIONS:process.env.NEXT_PUBLIC_ATLAS_LOCATIONS || '1'};
const children=[];
let stopping=false;
function stop(code=0){
 if(stopping)return;stopping=true;
 for(const child of children)child.kill('SIGTERM');
 process.exitCode=code;
}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>stop());
async function main(){
 const api=spawn(python,['-m','uvicorn','atlas_api.main:app','--app-dir','python_backend','--host','127.0.0.1','--port',apiPort],{cwd:root,env,stdio:'inherit'});
 children.push(api);api.on('error',()=>{console.error('Python could not start. Install python_backend requirements first.');stop(1);});
 api.on('exit',code=>{if(!stopping)stop(code || 1);});
 let ready=false;
 for(let attempt=0;attempt<100&&!stopping;attempt++){
  try{const r=await fetch(`${apiUrl}/health`,{signal:AbortSignal.timeout(500)});if(r.ok&&(await r.json()).backend==='python'){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 if(!ready){console.error('Python backend did not become ready.');stop(1);return;}
 const web=spawn(process.execPath,['node_modules/next/dist/bin/next','dev',...process.argv.slice(2)],{cwd:root,env,stdio:'inherit'});
 children.push(web);web.on('exit',code=>{if(!stopping)stop(code || 0);});
}
await main();
