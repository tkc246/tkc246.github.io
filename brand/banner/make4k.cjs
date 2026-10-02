const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { execFileSync } = require('child_process');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 4096, height: 2304 }, deviceScaleFactor: 1 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, async r => r.fulfill({ body: execFileSync('curl', ['-sS', '-A', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36', r.request().url()], { maxBuffer: 1 << 26 }), contentType: r.request().url().includes('googleapis') ? 'text/css' : 'font/woff2', headers: { 'access-control-allow-origin': '*' } }));
  const p = await ctx.newPage();
  await p.goto('file://' + __dirname + '/b.html');
  await p.evaluate(() => { document.body.style.setProperty('--u', '490px'); document.body.classList.add('bg'); });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await p.screenshot({ path: __dirname + '/gp_4096_raw.png' });
  await b.close();
})();
