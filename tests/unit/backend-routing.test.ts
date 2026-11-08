import {afterEach,describe,expect,it,vi} from 'vitest';
import config from '../../next.config';

afterEach(()=>vi.unstubAllEnvs());
const routes=()=>config.rewrites!();
function setup(values:Record<string,string|undefined>={}){
 for(const key of ['VERCEL','ATLAS_TYPESCRIPT_REFERENCE','ATLAS_USE_PYTHON_BACKEND','ATLAS_BACKEND_URL'])vi.stubEnv(key,values[key]);
}
describe('deployment backend selection',()=>{
 it('preserves TypeScript routes without a configured Python service',async()=>{
  setup();expect(await routes()).toEqual([]);
 });
 it('keeps Vercel on TypeScript even when a backend URL is present',async()=>{
  setup({VERCEL:'1',ATLAS_BACKEND_URL:'http://127.0.0.1:8000'});expect(await routes()).toEqual([]);
 });
 it('routes all five local application APIs to the explicitly configured service',async()=>{
  setup({ATLAS_BACKEND_URL:'http://127.0.0.1:8001/'});
  const result=await routes();
  expect(result).toEqual({beforeFiles:['analyze','research','suggest','locations','location-advice'].map(route=>({source:`/api/${route}`,destination:`http://127.0.0.1:8001/api/${route}`}))});
 });
 it('allows an explicitly enabled deployed Python backend on Vercel',async()=>{
  setup({VERCEL:'1',ATLAS_USE_PYTHON_BACKEND:'1',ATLAS_BACKEND_URL:'https://api.example.com'});
  expect(await routes()).toMatchObject({beforeFiles:expect.arrayContaining([{source:'/api/research',destination:'https://api.example.com/api/research'}])});
 });
 it('rejects localhost and insecure production Python URLs',async()=>{
  for(const backend of ['http://127.0.0.1:8000','https://localhost','http://api.example.com']){
   setup({VERCEL:'1',ATLAS_USE_PYTHON_BACKEND:'1',ATLAS_BACKEND_URL:backend});await expect(routes()).rejects.toThrow(/deployed HTTPS/);
  }
 });
 it('allows the TypeScript override even with Python configured',async()=>{
  setup({ATLAS_TYPESCRIPT_REFERENCE:'1',ATLAS_BACKEND_URL:'http://127.0.0.1:8000'});expect(await routes()).toEqual([]);
 });
});
