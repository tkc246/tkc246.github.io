// reel.js に出てくる文字だけを含む Google Fonts を fonts/ に取得して fonts.css を書き出す（getfonts.py の Node 版）
const fs = require('fs');
const path = require('path');

(async () => {
  const js = fs.readFileSync(path.join(__dirname, 'reel.js'), 'utf8');
  const chars = [...new Set(js)].filter(ch => ch >= ' ' && ch !== '\x7f').sort().join('');
  const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
  const fams = ['Outfit:wght@500;600;700;800;900', 'Zen+Kaku+Gothic+New:wght@500;700;900', 'DotGothic16'];
  let cssAll = '';
  for (const [i, f] of fams.entries()) {
    const url = `https://fonts.googleapis.com/css2?family=${f}&display=block&text=${encodeURIComponent(chars)}`;
    let css = await (await fetch(url, { headers: { 'User-Agent': UA } })).text();
    const urls = [...css.matchAll(/url\((https:\/\/[^)]+)\)/g)].map(m => m[1]);
    for (const [j, u] of urls.entries()) {
      const fn = `fonts/f${i}_${j}.woff2`;
      fs.writeFileSync(path.join(__dirname, fn), Buffer.from(await (await fetch(u)).arrayBuffer()));
      css = css.replace(u, fn);
    }
    cssAll += css;
  }
  fs.writeFileSync(path.join(__dirname, 'fonts.css'), cssAll);
  console.log('chars', chars.length);
})();
