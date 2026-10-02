const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { execFileSync } = require('child_process'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext();
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, async r => r.fulfill({ body: execFileSync('curl', ['-sS', '-A', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36', r.request().url()], { maxBuffer: 1 << 26 }),
    contentType: r.request().url().includes('googleapis') ? 'text/css' : 'font/woff2', headers: { 'access-control-allow-origin': '*' } }));
  const p = await ctx.newPage(); await p.goto('file://' + __dirname + '/icon.html');
  const out = await p.evaluate(() => window.make());
  for (const [k, v] of Object.entries(out)) fs.writeFileSync(__dirname + '/' + k, Buffer.from(v.split(',')[1], 'base64'));
  await b.close();
})();
