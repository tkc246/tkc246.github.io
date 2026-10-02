import re, subprocess, urllib.parse
js=open('reel.js',encoding='utf8').read()
chars=''.join(sorted(set(js)))  # every char in source (covers all strings)
chars=''.join(ch for ch in chars if ch.isprintable())
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
fams=['Outfit:wght@500;600;700;800;900','Zen+Kaku+Gothic+New:wght@500;700;900','DotGothic16']
css_all=''
for i,f in enumerate(fams):
    url='https://fonts.googleapis.com/css2?family='+f+'&display=block&text='+urllib.parse.quote(chars)
    css=subprocess.run(['curl','-sS','-A',UA,url],capture_output=True,text=True).stdout
    for j,u in enumerate(re.findall(r'url\((https://[^)]+)\)',css)):
        fn=f'fonts/f{i}_{j}.woff2'
        subprocess.run(['curl','-sS','-o',fn,u],check=True)
        css=css.replace(u,fn)
    css_all+=css
open('fonts.css','w').write(css_all)
print(css_all[:1500]); print(len(chars))
