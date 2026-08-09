import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import process from 'node:process';

const external=process.env.BASE_URL;let server=null;const wait=ms=>new Promise(r=>setTimeout(r,ms));
if(!external){server=spawn('python3',['-m','http.server','4191','--bind','127.0.0.1'],{stdio:['ignore','pipe','pipe']});await wait(900)}
const base=(external||'http://127.0.0.1:4191').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:760}}),errors=[];
page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
const state=()=>page.evaluate(()=>({modal:window.ToonValley?.state?.modalOpen,overlay:Boolean(document.querySelector('.life-overlay')),pauseHidden:document.getElementById('pause-screen')?.classList.contains('hidden'),suppressed:window.ToonValleyPointerGuard?.suppressedModalUnlocks?.()||0}));

async function moveTo(area,prompt){await page.evaluate(({area,prompt})=>{const TV=window.ToonValley;TV.enterInterior(area,{x:0,z:10});const i=TV.interactables.find(x=>x.area===area&&x.prompt===prompt&&typeof x.action==='function');if(!i)throw new Error(`Missing ${prompt}`);TV.player.position.set(i.x,0,i.z);TV.playerVelocity.set(0,0,0)}, {area,prompt});await page.waitForFunction(prompt=>window.ToonValley.state.nearestInteractable?.prompt===prompt,prompt,{timeout:6000})}
async function openCurrent(label){await page.evaluate(()=>{const TV=window.ToonValley,i=TV.state.nearestInteractable;if(!i||typeof i.action!=='function')throw new Error('No current interaction to open');i.action()});await page.waitForFunction(()=>Boolean(document.querySelector('.life-overlay'))&&window.ToonValley.state.modalOpen===true,null,{timeout:6000});await page.evaluate(()=>{const pause=document.getElementById('pause-screen');pause.classList.remove('hidden');document.dispatchEvent(new Event('pointerlockchange'))});const s=await state();if(!s.modal||!s.overlay||!s.pauseHidden||s.suppressed<1)throw new Error(`${label} modal pause regression ${JSON.stringify(s)}`)}
async function closeModal(label){await page.evaluate(()=>document.querySelector('.life-close')?.click());await page.waitForFunction(()=>!document.querySelector('.life-overlay')&&window.ToonValley.state.modalOpen===false,null,{timeout:6000});const s=await state();if(s.overlay||s.modal)throw new Error(`${label} close regression ${JSON.stringify(s)}`)}

try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.ToonValley&&window.ToonValleyLife&&window.ToonValleyPointerGuard?.modalPauseSuppression,null,{timeout:45000});
  await page.evaluate(()=>{const TV=window.ToonValley;TV.state.started=true;document.getElementById('start-screen')?.classList.add('hidden');document.getElementById('hud')?.classList.remove('hidden')});

  await moveTo('home','Open decorating menu');await openCurrent('home decorating');await closeModal('home decorating');
  await moveTo('furnitureStore','Browse furniture catalog');await openCurrent('furniture catalog');await closeModal('furniture catalog');

  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Modal/popover lifecycle passed',{base,final:await state()});
}finally{await browser.close();if(server)server.kill('SIGTERM')}
