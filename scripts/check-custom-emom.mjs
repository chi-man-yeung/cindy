import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const baseUrl=process.env.CINDY_TEST_URL??'http://127.0.0.1:3020';
const browser=await chromium.launch({...(process.env.CINDY_CHROMIUM_PATH?{executablePath:process.env.CINDY_CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox']});const results=[];
try{
 for(const width of [320,375,390,430]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});const page=await context.newPage();await page.goto(baseUrl);await page.waitForFunction(()=>!document.querySelector('.workout-card .primary').disabled);
  await page.getByRole('button',{name:'Select Custom EMOM',exact:true}).click();
  const boxes=await page.locator('.custom-setup input,.custom-setup select,.mode-card').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height}}));
  assert.ok(boxes.every(b=>b.left>=0&&b.right<=width+1&&b.height>=44));
  await page.getByLabel('Duration (minutes)',{exact:true}).fill('5');await page.getByLabel('Interval (seconds)',{exact:true}).selectOption('90');await page.getByText('Final interval is 30 seconds; the workout ends at 5 minutes.',{exact:true}).waitFor();
  if(width===320)await page.screenshot({path:'/tmp/custom-emom-320.png',fullPage:true});results.push({width,controlsWithinViewport:true,touchTargets44:true});await context.close();
 }
 const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();await page.goto(baseUrl);await page.waitForFunction(()=>!document.querySelector('.workout-card .primary').disabled);
 await page.getByText(/Offline shell ready/).waitFor({timeout:30000});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await page.clock.install({time:new Date()});
 await page.getByRole('button',{name:'Select Custom EMOM',exact:true}).click();await page.getByLabel('Duration (minutes)',{exact:true}).fill('5');await page.getByLabel('Interval (seconds)',{exact:true}).selectOption('90');
 await page.getByLabel('Exercise 1',{exact:true}).selectOption('burpees');await page.getByLabel('Reps for exercise 1',{exact:true}).fill('7');await page.getByLabel('Exercise 2',{exact:true}).selectOption('sit-ups');await page.getByLabel('Reps for exercise 2',{exact:true}).fill('12');await page.getByLabel('Preset name',{exact:true}).fill('Offline targets');await page.getByRole('button',{name:'Save preset',exact:true}).click();await page.getByText('Preset saved on this device.',{exact:true}).waitFor();
 await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!document.querySelector('.workout-card .primary').disabled);
 await page.getByRole('button',{name:'Select Custom EMOM',exact:true}).click();await page.getByRole('option',{name:'Offline targets',exact:true}).waitFor({state:'attached'});
 const preset=await page.getByLabel('Reuse preset',{exact:true}).evaluate(s=>[...s.options].find(o=>o.text==='Offline targets').value);await page.getByLabel('Reuse preset',{exact:true}).selectOption(preset);assert.equal(await page.getByLabel('Exercise 1',{exact:true}).inputValue(),'burpees');
 await page.getByRole('button',{name:'Start Custom EMOM Workout',exact:true}).click();assert.equal(await page.getByRole('timer').textContent(),'5');await page.clock.fastForward(6000);await page.getByRole('button',{name:/COMPLETE INTERVAL/}).click();
 await page.getByText('Current workout and results draft retained on this device.',{exact:true}).waitFor();await page.clock.fastForward(270000);await page.reload({waitUntil:'domcontentloaded'});
 await page.getByText('INTERVAL 4 OF 4 · TIME IN INTERVAL',{exact:true}).waitFor();await page.clock.fastForward(30000);await page.getByText('TRAINING SUMMARY',{exact:true}).waitFor();
 assert.ok((await page.locator('.results-card').textContent()).includes('25% completion'));await page.getByRole('button',{name:'SAVE WORKOUT',exact:true}).click();await page.getByText('Workout saved to history.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'History',exact:true}).first().click();const option=await page.getByLabel('Analytics configuration',{exact:true}).evaluate(s=>[...s.options].find(o=>o.text.includes('Custom EMOM')).value);await page.getByLabel('Analytics configuration',{exact:true}).selectOption(option);await page.getByText('COMPLETION RATE',{exact:true}).waitFor();assert.equal(await page.getByText('PERSONAL BEST',{exact:true}).count(),0);
 results.push({offlineShellReload:true,offlinePresetReuse:true,offlineStart:true,activeRecovery:true,missedIntervalsRecovered:true,offlineSave:true,noPersonalBest:true});await context.close();
 writeFileSync(process.env.CINDY_TEST_RESULTS??'/tmp/cindy-custom-browser-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close()}
