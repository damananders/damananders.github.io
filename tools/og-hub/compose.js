// tools/og-hub/compose.js: fans the three captured panels into assets/og/hub.jpg (1200x630), ROP in front, with the ringed face icon.
const { chromium } = require('playwright'); const fs = require('fs'); const path=require('path');
const R=path.resolve(__dirname,'../..')+'/';
const b64=(f)=>fs.readFileSync(f).toString('base64');
const html=`<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:SG;src:url(data:font/woff2;base64,${b64(R+'assets/fonts/space-grotesk-latin.woff2')});font-weight:500 700}
@font-face{font-family:IN;src:url(data:font/woff2;base64,${b64(R+'assets/fonts/inter-latin.woff2')});font-weight:400 600}
*{box-sizing:border-box}html,body{margin:0;width:1200px;height:630px;overflow:hidden}
body{position:relative;color:#eef0f3;font-family:IN,sans-serif;
 background:radial-gradient(700px 360px at 50% 105%,rgba(54,211,154,.30),transparent 70%),radial-gradient(520px 320px at 8% 100%,rgba(255,122,31,.20),transparent 70%),radial-gradient(520px 320px at 92% 100%,rgba(61,139,255,.22),transparent 70%),linear-gradient(180deg,#07090b,#0b0f12 60%,#050607)}
body::before{content:"";position:absolute;inset:0;background-image:radial-gradient(circle,rgba(255,255,255,.07) 1px,transparent 1.4px);background-size:18px 18px;-webkit-mask-image:linear-gradient(180deg,#000,transparent 70%)}
.head{position:absolute;top:44px;left:0;right:0;display:flex;align-items:center;justify-content:center;gap:22px}
.av{width:84px;height:84px;flex:none;filter:drop-shadow(0 8px 20px rgba(0,0,0,.6))}
.t{font:700 60px/1 SG;letter-spacing:-.02em}
.t b{color:#36d39a;text-shadow:0 0 30px rgba(54,211,154,.45)}
.s{margin-top:10px;font:500 22px IN;color:#aab3bc;letter-spacing:.01em}
.fan{position:absolute;left:50%;bottom:-40px;width:0;height:0}
.c{position:absolute;border-radius:22px;box-shadow:0 30px 60px -18px rgba(0,0,0,.9),0 0 0 1px rgba(0,0,0,.4);transform-origin:50% 120%}
.c img{display:block;width:100%;height:auto;border-radius:20px}
.craft{width:300px;left:-520px;bottom:175px;transform:rotate(-12deg);box-shadow:0 30px 60px -18px rgba(0,0,0,.9),0 0 40px -10px rgba(255,122,31,.6)}
.anyps{width:300px;left:220px;bottom:175px;transform:rotate(12deg);box-shadow:0 30px 60px -18px rgba(0,0,0,.9),0 0 40px -10px rgba(61,139,255,.6)}
.rop{width:700px;left:-350px;bottom:84px;z-index:2;box-shadow:0 40px 80px -20px rgba(0,0,0,.95),0 0 60px -8px rgba(54,211,154,.55)}
</style>
<div class="head"><img class="av" src="data:image/svg+xml;base64,${b64(R+'assets/icons/logo.svg')}"><div><div class="t">DMA: <b>An Enthusiast's Haven</b></div><div class="s">Wiki-Chip Dex &nbsp;·&nbsp; AnyPS &nbsp;·&nbsp; AndersCraft &nbsp;—&nbsp; by Anders</div></div></div>
<div class="fan">
 <div class="c craft"><img src="data:image/png;base64,${b64(__dirname+'/craft.png')}"></div>
 <div class="c anyps"><img src="data:image/png;base64,${b64(__dirname+'/anyps.png')}"></div>
 <div class="c rop"><img src="data:image/png;base64,${b64(__dirname+'/rop.png')}"></div>
</div>`;
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:630}});await p.setContent(html);await p.waitForTimeout(500);
await p.screenshot({path:R+'assets/og/hub.jpg',type:'jpeg',quality:88});await b.close();console.log('ok')})();
