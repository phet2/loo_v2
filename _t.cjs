const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('D:/Develops/Webs/Fullstacks/loo-platform/frontend/node_modules/playwright');
const root='D:/Develops/Plans/loo_v2',shots='C:/Users/ASUS/AppData/Local/Temp/loo_shots';
const t={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8'};
const s=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(root,p),(e,d)=>{if(e){r.statusCode=404;return r.end('x');}r.setHeader('Content-Type',t[path.extname(p)]||'text/plain');r.end(d);});});
s.listen(0,async()=>{const port=s.address().port,base=`http://localhost:${port}`,err=[];
 const b=await chromium.launch({channel:'msedge',headless:true});
 const disp=(pg,sel)=>pg.$eval(sel,e=>getComputedStyle(e).display).catch(()=>'(none-el)');
 // MOBILE
 const M=await(await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true})).newPage();
 M.on('pageerror',e=>err.push(e.message));
 await M.goto(base+'/LOO-Customer-Brain-Overview.html',{waitUntil:'networkidle'});await M.waitForTimeout(1200);
 const ovTogM=await disp(M,'.navtoggle'); const ovNavBefore=await disp(M,'.nav nav');
 await M.click('.navtoggle');await M.waitForTimeout(500);
 const ovNavAfter=await disp(M,'.nav nav'); const ovLinkVisible=await M.$eval('.nav nav a',e=>e.offsetParent!==null);
 await M.screenshot({path:shots+'/menu-ov-open.png'});
 // Plan mobile TOC
 await M.goto(base+'/LOO-Customer-Brain-Plan.html',{waitUntil:'networkidle'});await M.waitForTimeout(1200);
 const plTogM=await disp(M,'.toctoggle'); const plOlBefore=await disp(M,'.toc ol');
 await M.click('.toctoggle');await M.waitForTimeout(500);
 const plOlAfter=await disp(M,'.toc ol');
 await M.screenshot({path:shots+'/menu-plan-open.png'});
 // DESKTOP: toggles hidden
 const D=await(await b.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1})).newPage();
 await D.goto(base+'/LOO-Customer-Brain-Overview.html',{waitUntil:'networkidle'});await D.waitForTimeout(600);
 const ovTogD=await disp(D,'.navtoggle');
 await D.goto(base+'/LOO-Customer-Brain-Plan.html',{waitUntil:'networkidle'});await D.waitForTimeout(600);
 const plTogD=await disp(D,'.toctoggle'); const plOlD=await disp(D,'.toc ol');
 console.log(JSON.stringify({
   overview:{toggleMobile:ovTogM,navBefore:ovNavBefore,navAfter:ovNavAfter,linkVisible:ovLinkVisible,toggleDesktop:ovTogD},
   plan:{toggleMobile:plTogM,olBefore:plOlBefore,olAfter:plOlAfter,toggleDesktop:plTogD,olDesktop:plOlD},
   errors:err},null,2));
 await b.close();s.close();});
