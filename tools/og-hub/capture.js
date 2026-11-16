// tools/og-hub/capture.js: screenshots the hub's ROP banner and the AndersCraft/AnyPS cards (needs the site served on localhost:8080). Then run compose.js.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch();
 const p = await b.newPage({ viewport: { width: 1300, height: 1000 }, deviceScaleFactor: 2 });
 await p.route(/^(?!http:\/\/localhost).*/, (r) => r.abort());
 await p.addInitScript(()=>{try{localStorage.setItem('hub.tour2','1');localStorage.setItem('site.theme','"dark"')}catch(e){}});
 await p.goto('http://localhost:8080/'); await p.evaluate(()=>{const s=document.createElement('style');s.textContent='.pl-trophy{display:none!important}';document.head.append(s)}); await p.keyboard.press('Escape'); await p.waitForTimeout(3500);
 await p.addStyleTag({content:'.pl-trophy,[class*=trophy-pop],[class*=unlock]{display:none!important} .sn-layer,.sn-sprig,.sn-canvas{display:none!important} .sx-toast,.pl-toast,[class*="toast"],.fx-leaf,[class*="leaf"],[class*="season"] canvas{display:none!important} [data-reveal]{opacity:1!important;transform:none!important}'});
 await p.evaluate(()=>{document.querySelectorAll('canvas').forEach(c=>{if(c.style.position==='fixed'||getComputedStyle(c).position==='fixed')c.style.display='none'})});
 for (const [sel,name] of [['.hb-rate','rop'],['.avenue.craft','craft'],['.avenue.anyps','anyps']]) {
   const e = await p.$(sel); await e.scrollIntoViewIfNeeded(); await p.mouse.move(2,2); await p.waitForTimeout(700);
   await e.screenshot({ path: __dirname + '/' + name + '.png', omitBackground: true }); const bb = await e.boundingBox(); console.log(name, Math.round(bb.width), Math.round(bb.height)); }
 await b.close(); })();
