// usage (run from showreel/): node render.cjs preview 0.4,1.2,...   |   node render.cjs full out.mp4 [audio.wav]
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.join(__dirname, '..');  // repo root, so ../assets resolves
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); return res.end(); }
    const ext = path.extname(p);
    res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.css': 'text/css', '.woff2': 'font/woff2' }[ext] || 'application/octet-stream' });
    res.end(d);
  });
});

(async () => {
  await new Promise(r => server.listen(8765, r));
  const browser = await chromium.launch({ args: ['--disable-gpu-vsync', '--force-device-scale-factor=1'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, ignoreHTTPSErrors: true });
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto('http://localhost:8765/showreel/index.html?render=1');
  await page.waitForFunction(() => window.READY === true, null, { timeout: 60000 });
  const mode = process.argv[2];
  if (mode === 'logo') { console.log(JSON.stringify(await page.evaluate(() => window.LOGO_INFO()))); }
  else if (mode === 'preview') {
    fs.mkdirSync(path.join(__dirname, 'preview'), { recursive: true });
    for (const ts of process.argv[3].split(',')) {
      const f = Math.round(parseFloat(ts) * 60);
      const url = await page.evaluate(([f]) => window.renderFrame(f, 1), [f]);
      fs.writeFileSync(path.join(__dirname, 'preview', `t${ts}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
    }
  } else if (mode === 'full') {
    const outFile = process.argv[3], audio = process.argv[4];
    const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '60', '-c:v', 'mjpeg', '-i', '-'];
    if (audio) args.push('-i', audio);
    args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', '60');
    if (audio) args.push('-c:a', 'aac', '-b:a', '256k', '-shortest');
    args.push('-movflags', '+faststart', outFile);
    const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let f = 0; f < 900; f++) {
      const url = await page.evaluate(([f]) => window.renderFrame(f), [f]);
      const buf = Buffer.from(url.split(',')[1], 'base64');
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (f % 60 === 0) console.log(`frame ${f} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
  }
  await browser.close(); server.close();
})();
