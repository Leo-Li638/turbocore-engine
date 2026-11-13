// 构建单文件版（内联 JS/CSS），可直接双击用浏览器打开，无需服务器
import { readFile, writeFile, readdir, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';

const DIST = 'E:\\developer-file\\dev\\DeepseekHarness\\work\\turbocore-engine\\dist';
const APPS = 'E:\\Apps\\turbocore';

const html = await readFile(path.join(DIST, 'index.html'), 'utf8');
const assets = await readdir(path.join(DIST, 'assets'));
const jsFile = assets.find(f => f === 'index-BAOWPrAb.js') ?? assets.filter(f => f.endsWith('.js')).sort().pop();
const cssFile = assets.find(f => f.endsWith('.css'));
if (!jsFile || !cssFile) throw new Error('assets not found: ' + JSON.stringify(assets));

let js = await readFile(path.join(DIST, 'assets', jsFile), 'utf8');
let css = await readFile(path.join(DIST, 'assets', cssFile), 'utf8');
js = js.replace(/<\/script/gi, '<\\/script');
css = css.replace(/<\/style/gi, '<\\/style');

// 清掉 sourceMappingURL 行（单文件里没意义）
js = js.replace(/\/\/# sourceMappingURL=.*$/m, '');
css = css.replace(/\/\*# sourceMappingURL=.*?\*\//g, '');

const tagRe = /<script[^>]*src="\.?\/?assets\/[^"]+"[^>]*><\/script>/;
const linkRe = /<link[^>]*href="\.?\/?assets\/[^"]+\.css"[^>]*>/;
if (!tagRe.test(html)) throw new Error('script tag not found');
if (!linkRe.test(html)) throw new Error('link tag not found');
// 注意：必须用函数替换，字符串替换会把 bundle 里的 $& / $' 当成替换模式
const out = html
  .replace(tagRe, () => '<script type="module">\n' + js + '\n</script>')
  .replace(linkRe, () => '<style>\n' + css + '\n</style>')
  .replace(/ crossorigin/g, '');

await writeFile(path.join(DIST, 'turbocore-standalone.html'), out, 'utf8');
await mkdir(APPS, { recursive: true });
await copyFile(path.join(DIST, 'turbocore-standalone.html'), path.join(APPS, 'TURBOCORE.html'));
const kb = (Buffer.byteLength(out) / 1024).toFixed(0);
console.log('standalone built:', path.join(APPS, 'TURBOCORE.html'), kb + ' KB', 'js=' + jsFile, 'css=' + cssFile);
