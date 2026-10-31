// GET-only demo verification against a local production build on port 3100.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const out = require('node:path').join(require('node:os').homedir(), 'Desktop/maang-deck-shots/demo');
fs.mkdirSync(out, {recursive: true});
const paths = ['/demo', ...['toys','electronics'].flatMap(s => ['board','insights','settings'].map(v => `/demo/${s}/${v}`))];
const secrets = ['MERCHANT_KEY','RESET_KEY','SUPABASE_SERVICE_ROLE_KEY','SARVAM_API_KEY'].map(k => process.env[k]).filter(Boolean);
(async () => {
 const browser = await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE});
 const results = [];
 for (const width of [1440,390,360]) for (const path of paths) {
  const context = await browser.newContext({viewport:{width,height:width===1440?900:844}});
  const page = await context.newPage(); const issues = []; const responses = [];
  page.on('pageerror', () => issues.push('page error'));
  page.on('request', req => {
   const u = new URL(req.url());
   if(req.headers()['x-merchant-key'] || u.searchParams.has('k')) issues.push('key request');
   if(req.method() !== 'GET') issues.push('non-GET request');
   if(u.pathname.startsWith('/api/merchant/')) issues.push('real merchant API');
   if(secrets.some(s=>req.url().includes(s) || JSON.stringify(req.headers()).includes(s))) issues.push('secret request');
  });
  page.on('response', r => {if(r.url().includes('/api/demo/')) responses.push(r);});
  const r = await page.goto(`http://localhost:3100${path}`);
  assert.equal(r.status(),200);
  await page.getByText('Demo view, synthetic data',{exact:true}).waitFor();
  if(path.endsWith('/board')) await page.getByRole('heading',{level:1,name:path.includes('/toys/') ? 'Neighbourhood Toys (demo)' : 'Galaxy Digital, Andheri',exact:true}).waitFor();
  if(path.endsWith('/insights')) await page.getByTestId('headline').waitFor();
  if(path.endsWith('/settings')) {
   if (!responses.length) await page.waitForResponse(r=>r.url().includes('/api/demo/insights/') && r.status()===200);
   await responses[0].finished();
   await page.getByRole('button',{name:'Save',exact:true}).waitFor();
   const radios=page.locator('input[type=radio]'); await radios.last().check();
   await page.locator('#locs').fill('5');
   assert.ok(await radios.last().isChecked());
   assert.equal(await page.locator('#locs').inputValue(),'5');
  }
  assert.match(await page.locator('meta[name=robots]').getAttribute('content'),/noindex/);
  assert.ok(await page.getByText('Demo view is read-only. The presenter runs the live flow.',{exact:true}).isVisible());
  for(const a of await page.locator('a[href]').all()) {
   const href=await a.getAttribute('href'); assert.ok(href.startsWith('/demo') || href.startsWith('/s/'), `unsafe navigation ${path}`);
  }
  // Expand request lists and stock preview to check hidden write controls too.
  while(await page.getByRole('button',{name:/^Show \d+ requests$/}).count()) await page.getByRole('button',{name:/^Show \d+ requests$/}).first().click();
  const stock=page.getByRole('button',{name:'Stock aa gaya',exact:true});
  if(await stock.count()) await stock.first().click();
  for(const button of await page.locator('button').all()) {
   const label=(await button.innerText()).trim();
   if(/Save|batao|Notify|Reserve|Pickup|Le gaye|Nahi ho|Soundbox|Cannot meet|Not stockable|Duplicate|No longer needed/i.test(label)) assert.ok(await button.isDisabled(), `enabled write control ${label}`);
  }
  if(await stock.count()) { const close = page.getByRole('button',{name:'Band karo',exact:true}); if(await close.count()) await close.first().click(); }
  while(await page.getByRole('button',{name:/^Hide \d+ requests$/}).count()) await page.getByRole('button',{name:/^Hide \d+ requests$/}).first().click();
  for(const response of responses) {
   assert.equal(response.status(),200); const text=await response.text();
   assert.ok(!secrets.some(s=>text.includes(s)), 'secret response');
   assert.ok(!/"[^" ]*(?:phone|token|merchant.?key)[^" ]*"\s*:/i.test(text),'sensitive response field');
  }
  assert.deepEqual(issues,[]);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth), `horizontal overflow ${path} ${width}`);
  await page.screenshot({path:`${out}/${path.slice(1).replaceAll('/','-')}-${width}.png`,fullPage:true});
  results.push({path,width,pass:true}); console.log(`PASS ${path} ${width}`);
  await context.close();
 }
 for(const slug of ['neighbourhood-toys','electronics-andheri']) for(const view of ['board','insights']) {
  const r=await fetch(`http://localhost:3100/api/merchant/${slug}/${view}`);assert.equal(r.status,401);
 }
 for(const view of ['board','insights','settings','notify','reserve','pickup','close','reset','speak']) {
  assert.equal((await fetch(`http://localhost:3100/api/demo/${view}/not-allowed`)).status,404);
 }
 await browser.close(); fs.writeFileSync(`${out}/verification.json`,JSON.stringify(results,null,2));
})().catch(e=>{console.error(e.message);process.exit(1)});
