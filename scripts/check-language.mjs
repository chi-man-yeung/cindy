import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const base=process.env.CINDY_TEST_URL??'http://127.0.0.1:3020';
const browser=await chromium.launch({...(process.env.CINDY_CHROMIUM_PATH?{executablePath:process.env.CINDY_CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox']});
const results=[];
async function ready(page){await page.waitForFunction(()=>{const b=document.querySelector('.workout-card .primary');return b&&!b.disabled})}
async function fits(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Page must not overflow horizontally')}
try{
 for(const width of [320,375,390,430]){
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});const page=await context.newPage();await page.goto(base);await ready(page);await page.getByRole('button',{name:'繁體中文',exact:true}).click();
  assert.equal(await page.locator('html').getAttribute('lang'),'zh-Hant');await fits(page);
  const targets=await page.locator('.language-switch button').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height,width:r.width}}));assert.ok(targets.every(b=>b.height>=44&&b.width>=44&&b.left>=0&&b.right<=width));const cards=await page.locator('.mode-card').evaluateAll(nodes=>nodes.slice(0,2).map(n=>n.getBoundingClientRect().height));assert.ok(Math.abs(cards[0]-cards[1])<1);
  await page.getByRole('button',{name:'選擇 Chelsea',exact:true}).click();await page.getByRole('button',{name:'開始 Chelsea 訓練',exact:true}).waitFor();await fits(page);
  await page.getByRole('button',{name:'選擇 自訂 EMOM',exact:true}).click();await page.getByLabel('訓練時長（分鐘）',{exact:true}).fill('5');await page.getByLabel('間歇長度（秒）',{exact:true}).selectOption('90');await fits(page);
  await page.getByLabel('預設訓練名稱',{exact:true}).fill('Strength 力量');await page.getByRole('button',{name:'儲存預設訓練',exact:true}).click();await page.getByText('預設訓練已儲存在此裝置。',{exact:true}).waitFor();
  if(width===390)await page.screenshot({path:'/tmp/cindy-chinese-overview.png',fullPage:true});
  results.push({width,languageControls44:true,equalBenchmarkCards:true,chineseLayoutFits:true,customSetup:true});await context.close();
 }
 for(const mode of ['Cindy','Chelsea','自訂 EMOM']){
  const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();await page.goto(base);await ready(page);await page.getByRole('button',{name:'繁體中文',exact:true}).click();await page.getByText(/離線功能已就緒/).waitFor({timeout:30000});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await page.getByRole('button',{name:'選擇 '+mode,exact:true}).click();await page.clock.install({time:new Date()});await page.getByRole('button',{name:mode==='自訂 EMOM'?'開始自訂 EMOM 訓練':'開始 '+mode+' 訓練',exact:true}).click();assert.equal(await page.getByRole('timer').textContent(),'5');await page.clock.fastForward(6000);
  const completion=mode==='Chelsea'?'完成本分鐘':mode==='自訂 EMOM'?'完成此間歇':'完成一輪';await page.getByRole('button',{name:new RegExp(completion)}).click();await page.getByText('本次訓練及成績草稿已保留在此裝置。',{exact:true}).waitFor();
  const before=await page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('cindy-workouts');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});return new Promise(resolve=>{const tx=db.transaction('active-session');const r=tx.objectStore('active-session').get('current');tx.oncomplete=()=>{db.close();resolve({id:r.result.id,reps:r.result.totalReps,rounds:r.result.completedRoundTimestamps})}})});
  assert.ok(before.reps>0);await page.getByRole('button',{name:'English',exact:true}).click();await page.getByRole('button',{name:'Pause',exact:true}).waitFor();await page.getByRole('button',{name:'繁體中文',exact:true}).click();await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'暫停',exact:true}).waitFor();assert.equal(await page.locator('html').getAttribute('lang'),'zh-Hant');await fits(page);
  await page.getByRole('button',{name:'結束',exact:true}).click();await page.getByRole('button',{name:'結束訓練',exact:true}).click();await page.getByLabel('訓練筆記',{exact:false}).fill('English 保留原文');await page.getByRole('button',{name:'儲存訓練',exact:true}).click();await page.getByText('訓練已儲存至紀錄。',{exact:true}).waitFor();
  await page.getByRole('button',{name:'紀錄',exact:true}).last().click();await page.getByRole('button',{name:/開啟 /}).click();assert.equal(await page.getByLabel('訓練筆記',{exact:true}).inputValue(),'English 保留原文');await page.getByRole('button',{name:'刪除訓練',exact:true}).click();await page.getByRole('button',{name:'取消',exact:true}).click();await page.getByRole('button',{name:'English',exact:true}).click();await page.getByRole('button',{name:'Delete workout',exact:true}).waitFor();assert.equal(await page.getByLabel('Session notes',{exact:true}).inputValue(),'English 保留原文');await fits(page);
  const saved=await page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('cindy-workouts');r.onsuccess=()=>resolve(r.result)});return new Promise(resolve=>{const tx=db.transaction('sessions');const r=tx.objectStore('sessions').getAll();tx.oncomplete=()=>{db.close();resolve(r.result)}})});assert.equal(saved.length,1);assert.equal(saved[0].id,before.id);assert.equal(saved[0].totalReps,before.reps);assert.deepEqual(saved[0].completedRoundTimestamps,before.rounds);assert.equal(saved[0].notes,'English 保留原文');
  results.push({mode,preparation5:true,languageSwitchDuringWorkout:true,offlineRefreshLanguageRecovery:true,sameRecordAndScore:true,chineseSaveAndHistory:true,deleteCancel:true,notesUnchanged:true});await context.close();
 }
 writeFileSync('/tmp/cindy-language-browser-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close()}
