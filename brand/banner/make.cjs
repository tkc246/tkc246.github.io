const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { execFileSync } = require('child_process');
const jobs = [
  ['tkc-works_banner_1920x1080.png', 1920, 1080, 230, true],
  ['tkc-works_x-header_1500x500.png', 1500, 500, 150, true],
  ['tkc-works_google-play-feature_1024x500.png', 1024, 500, 135, true],
  ['tkc-works_square_1080x1080.png', 1080, 1080, 175, true],
  ['tkc-works_logo-transparent_2400x900.png', 2400, 900, 380, false],
];
(async () => {
  const b = await chromium.launch();
  for (const [file, w, h, u, bg] of jobs) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, async r => r.fulfill({ body: execFileSync('curl', ['-sS', '-A', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36', r.request().url()], { maxBuffer: 1 << 26 }), contentType: r.request().url().includes('googleapis') ? 'text/css' : 'font/woff2', headers: { 'access-control-allow-origin': '*' } }));
    const p = await ctx.newPage();
    await p.goto('file://' + __dirname + '/b.html');
    await p.evaluate(([u, bg]) => { document.body.style.setProperty('--u', u + 'px'); if (bg) document.body.classList.add('bg'); }, [u, bg]);
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
    await p.screenshot({ path: __dirname + '/' + file, omitBackground: !bg });
    await ctx.close();
  }
  await b.close();
})();
