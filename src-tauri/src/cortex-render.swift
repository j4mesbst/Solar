// A real, isolated WebKit renderer. No second model, browser download or CDN.
// CSS/WAAPI and exposed GSAP timelines are sampled; arbitrary JS clocks are not virtualized.
import AppKit
import WebKit
import Foundation

struct Viewport: Decodable { let width: Double; let height: Double }
struct ExpectedAttribute: Codable { let name:String; let value:String?; let present:Bool? }
struct Expectation: Codable { let selector:String; let text:String?; let value:String?; let visible:Bool?; let attribute:ExpectedAttribute?; let style:[String:String]? }
struct Interaction: Codable { let selector: String; let type: String; let value: String?; let expect:[Expectation]? }
struct Input: Decodable { let html: String; let times: [Double]; let reference: String?; let url: String?; let viewport: Viewport?; let interactions: [Interaction]?; let reducedMotion: Bool?; let selectors:[String]?; let expectations:[Expectation]?; let transitionCapture:Bool?; let referenceOnly:Bool?; let motionClock:String? }
let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let input = try JSONDecoder().decode(Input.self, from: Data(contentsOf: inputURL))
let app = NSApplication.shared
app.setActivationPolicy(.accessory)

func pixels(_ image: NSImage) -> [UInt8]? {
    var rect = CGRect(x: 0, y: 0, width: 64, height: 40)
    guard let cg = image.cgImage(forProposedRect: &rect, context: nil, hints: nil) else { return nil }
    var bytes = [UInt8](repeating: 0, count: 64 * 40 * 4)
    let ok = bytes.withUnsafeMutableBytes { ptr -> Bool in
        guard let context = CGContext(data: ptr.baseAddress, width: 64, height: 40, bitsPerComponent: 8, bytesPerRow: 64*4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
        context.draw(cg, in: CGRect(x: 0, y: 0, width: 64, height: 40)); return true
    }
    return ok ? bytes : nil
}
func referenceImage() -> NSImage? {
    guard let ref=input.reference, ref.hasPrefix("data:image/"), let comma=ref.firstIndex(of: ","), let data=Data(base64Encoded:String(ref[ref.index(after:comma)...])) else { return nil }
    return NSImage(data:data)
}
func rasterCells(_ bytes:[UInt8]) -> [[String:Any]] {
    var cells:[[String:Any]]=[]
    for row in 0..<4 { for col in 0..<4 {
        var rgb=[0.0,0.0,0.0]
        for y in (row*10)..<((row+1)*10) { for x in (col*16)..<((col+1)*16) { for channel in 0..<3 { rgb[channel]+=Double(bytes[(y*64+x)*4+channel])/160 } } }
        cells.append(["x":Double(col)/4,"y":Double(row)/4,"width":0.25,"height":0.25,"rgb":rgb.map{Int($0.rounded())}])
    } }
    return cells
}
func analyzeReference(_ image:NSImage) -> [String:Any]? {
    guard let rep=NSBitmapImageRep(data:image.tiffRepresentation ?? Data()),rep.pixelsWide>0,rep.pixelsHigh>0,rep.pixelsWide<=8192,rep.pixelsHigh<=8192,rep.pixelsWide*rep.pixelsHigh<=20_000_000,let bytes=pixels(image) else { return nil }
    var colors:[String:Int]=[:]
    for i in stride(from:0,to:bytes.count,by:4) { let key=(0..<3).map{String(Int(bytes[i+$0])/32*32)}.joined(separator:",");colors[key,default:0]+=1 }
    let palette=colors.sorted{a,b in a.value==b.value ? a.key<b.key : a.value>b.value}.prefix(6).map { ["rgb":$0.key.split(separator:",").compactMap{Int($0)},"share":Double($0.value)/2560] as [String:Any] }
    return ["width":rep.pixelsWide,"height":rep.pixelsHigh,"method":"raster-64x40","palette":palette,"cells":rasterCells(bytes)]
}
if input.referenceOnly == true {
    let observation=referenceImage().flatMap(analyzeReference)
    var result:[String:Any] = ["supported":observation != nil,"frames":[],"errors":observation == nil ? ["Image de référence illisible"] : [],"width":0,"height":0]
    if let observation=observation { result["referenceAnalysis"]=observation }
    try JSONSerialization.data(withJSONObject:result).write(to:inputURL.deletingLastPathComponent().appendingPathComponent("report.json"),options:.atomic)
    exit(0)
}
final class Renderer: NSObject, WKNavigationDelegate {
    let web: WKWebView
    let window: NSWindow
    var frames: [[String: Any]] = []
    var errors: [String] = []
    var firstImage: NSImage?
    var lastImage: NSImage?
    var finished = false
    var interactions: [[String: Any]] = []
    var motionClock = "waapi"
    override init() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        let reduced = input.reducedMotion == true ? "true" : "false"
        config.userContentController.addUserScript(WKUserScript(source: "const originalMatch=window.matchMedia.bind(window);window.matchMedia=q=>{if(!q.includes('prefers-reduced-motion'))return originalMatch(q);const reduce=\(reduced);return {matches:q.includes('no-preference')?!reduce:reduce,media:q,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}};", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        config.userContentController.addUserScript(WKUserScript(source: "window.__cortexErrors=[];addEventListener('error',e=>window.__cortexErrors.push(String(e.message)));addEventListener('unhandledrejection',e=>window.__cortexErrors.push(String(e.reason)));", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let width = max(320, min(1920, input.viewport?.width ?? 1280))
        let height = max(240, min(1200, input.viewport?.height ?? 800))
        web = WKWebView(frame: NSRect(x: 0, y: 0, width: width, height: height), configuration: config)
        window = NSWindow(contentRect: NSRect(x: -3000, y: 0, width: width, height: height), styleMask: .borderless, backing: .buffered, defer: false)
        super.init(); web.navigationDelegate = self; window.contentView = web; window.orderFront(nil)
    }
    func start() {
        let csp = "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'\">"
        if let address=input.url,let url=URL(string:address){web.load(URLRequest(url:url))}else{web.loadHTMLString(csp + input.html, baseURL: nil)}
        DispatchQueue.main.asyncAfter(deadline: .now() + 25) { if !self.finished { self.errors.append("Délai de rendu dépassé"); self.finish() } }
    }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let scheme = action.request.url?.scheme ?? ""
        let local = input.url.flatMap(URL.init(string:)).map { action.request.url?.host == $0.host && action.request.url?.port == $0.port } ?? false
        decisionHandler(scheme == "about" || scheme == "data" || scheme.isEmpty || local ? .allow : .cancel)
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // Wait for local fonts/layout, then freeze the animation timeline.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { self.prepare() }
    }
    func prepare() {
        let data = (try? JSONEncoder().encode(input.interactions ?? [])) ?? Data("[]".utf8)
        let encoded = String(data: data, encoding: .utf8) ?? "[]"
        let reduce = input.reducedMotion == true ? "true" : "false"
        let script = """
        (async()=>{
          await document.fonts.ready;
          const reduced=\(reduce);
          const rewrite=rules=>{for(const rule of rules){if(rule.media&&rule.media.mediaText.includes('prefers-reduced-motion'))rule.media.mediaText=rule.media.mediaText.replace(/[(]prefers-reduced-motion *: *(reduce|no-preference)[)]/g,(_,v)=>(v==='reduce'?reduced:!reduced)?'(min-width: 0px)':'(max-width: 0px)');if(rule.cssRules)rewrite(rule.cssRules)}};
          for(const sheet of document.styleSheets){try{rewrite(sheet.cssRules)}catch{}}
          // Force the before-state style before triggering CSS transitions.
          document.documentElement.getBoundingClientRect();
          const results=[];
          const actions=\(encoded);
          const clockMode='\(input.motionClock ?? "auto")';
          const gsapTimeline=clockMode==='waapi'?null:(window.__cortexGsapTimeline||window.gsap?.globalTimeline);
          if(clockMode==='gsap'&&!gsapTimeline)window.__cortexErrors.push('Horloge GSAP demandée mais timeline exposée absente');
          const sleep=()=>new Promise(resolve=>setTimeout(resolve,16));
          const until=async predicate=>{const start=performance.now();while(!predicate()&&performance.now()-start<1200)await sleep();return {ready:predicate(),waitMs:Math.round(performance.now()-start)}};
          const observe=expect=>{const e=document.querySelector(expect.selector);if(!e)return {selector:expect.selector,found:false};const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {selector:expect.selector,found:true,tag:e.tagName.toLowerCase(),text:(e.textContent||'').trim().slice(0,500),value:e.value??'',styles:Object.fromEntries(Object.keys(expect.style||{}).map(key=>[key,s.getPropertyValue(key)||s[key]||''])),visible:s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>.05&&r.width>0&&r.height>0,attributes:Object.fromEntries([...e.attributes].slice(0,24).map(a=>[a.name,a.value.slice(0,200)]))};};
          const matches=(expect,o)=>{if(!o.found)return expect.visible===false&&expect.text===undefined&&expect.value===undefined&&expect.attribute===undefined&&expect.style===undefined;const a=expect.attribute,present=a?Object.hasOwn(o.attributes,a.name):false;return (expect.text===undefined||o.text===expect.text)&&(expect.value===undefined||o.value===expect.value)&&(expect.visible===undefined||o.visible===expect.visible)&&(!a||(a.present===undefined||present===a.present)&&(a.value===undefined||o.attributes[a.name]===a.value))&&(!expect.style||Object.entries(expect.style).every(([key,value])=>o.styles[key]===value));};
          for(const [index,action] of actions.entries()){
            const targetReady=await until(()=>Boolean(document.querySelector(action.selector)));
            const target=document.querySelector(action.selector);if(!target){results.push({selector:action.selector,success:false,detail:'Élément absent après attente conditionnelle',waitMs:targetReady.waitMs});continue;}
            if(action.type==='click'){
              if(action.value!==undefined||typeof target.click!=='function'){results.push({selector:action.selector,type:action.type,success:false,detail:'Contrat click invalide'});continue;}
              target.click();
            }
            else if(action.type==='fill'){
              if(!['INPUT','TEXTAREA','SELECT'].includes(target.tagName)||typeof action.value!=='string'){results.push({selector:action.selector,type:action.type,success:false,detail:'Contrat fill invalide : cible non éditable ou value absente'});continue;}
              const descriptor=Object.getOwnPropertyDescriptor(target.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:target.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value');
              descriptor?.set?.call(target,action.value);target.dispatchEvent(new Event('input',{bubbles:true}));target.dispatchEvent(new Event('change',{bubbles:true}));
            }else{results.push({selector:action.selector,type:action.type,success:false,detail:'Type d’action interdit'});continue;}
            // Let the event microtask complete; then wait for actual observable
            // assertions rather than assuming React settled after 40 ms.
            document.documentElement.getBoundingClientRect();
            await new Promise(resolve=>setTimeout(resolve,0));
            // Offscreen WebKit may suspend its animation clock. For a prefix
            // action only, seek the *existing* finite WAAPI animations to their
            // real endpoint before the next trigger. Never add an animation or
            // write a computed style. The final trigger is sampled from zero.
            if(\(input.transitionCapture == true ? "true" : "false")&&index<actions.length-1){
              for(const animation of document.getAnimations()){const end=Number(animation.effect?.getComputedTiming().endTime);if(Number.isFinite(end)&&end<=10000){animation.currentTime=end;animation.finish();}}
              if(gsapTimeline&&Number.isFinite(gsapTimeline.totalDuration())&&gsapTimeline.totalDuration()<=10)gsapTimeline.totalTime(gsapTimeline.totalDuration(),false);
              document.documentElement.getBoundingClientRect();
              await new Promise(resolve=>setTimeout(resolve,0));
            }
            document.documentElement.getBoundingClientRect();
            const readiness=await until(()=>(action.expect||[]).every(expect=>matches(expect,observe(expect))));
            const observations=(action.expect||[]).map(observe);
            results.push({selector:action.selector,success:true,type:action.type,value:target.value??'',observations,readiness:readiness.ready?'observed':'timed-out',waitMs:targetReady.waitMs+readiness.waitMs});
          }
          document.getAnimations().forEach(a=>{a.pause();a.currentTime=0});
          if(gsapTimeline){gsapTimeline.pause();window.__cortexGsapClock={timeline:gsapTimeline,origin:gsapTimeline===window.gsap?.globalTimeline&&actions.length?gsapTimeline.totalTime():0};}
          return results;
        })()
        """
        web.callAsyncJavaScript("return await " + script, arguments: [:], in: nil, in: .page, completionHandler: { result in
            switch result {
            case .success(let value): self.interactions=value as? [[String: Any]] ?? []
            case .failure(let error): self.errors.append(error.localizedDescription)
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) { self.capture(0) }
        })
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { errors.append(error.localizedDescription); finish() }
    func capture(_ index: Int) {
        if finished { return }
        if index >= input.times.count { finish(); return }
        let time = input.times[index]
        let selectorData = (try? JSONEncoder().encode(input.selectors ?? [])) ?? Data("[]".utf8)
        let encodedSelectors = String(data:selectorData,encoding:.utf8) ?? "[]"
        let styleNames = Array(Set((input.expectations ?? []).flatMap { Array(($0.style ?? [:]).keys) } + (input.interactions ?? []).flatMap { ($0.expect ?? []).flatMap { Array(($0.style ?? [:]).keys) } }))
        let styleData = (try? JSONEncoder().encode(styleNames)) ?? Data("[]".utf8)
        let encodedStyles = String(data:styleData,encoding:.utf8) ?? "[]"
        let js = """
        (()=>{
          document.getAnimations().forEach(a=>{a.pause();a.currentTime=\(time)});
          const gsapClock=window.__cortexGsapClock;if(gsapClock)gsapClock.timeline.totalTime(gsapClock.origin+\(time)/1000,false);
          // Give WebKit a compositor frame after every sampled timeline seek.
          // The Swift side takes the bitmap on the next run-loop turn below;
          // this marker also makes the synchronization observable in telemetry.
          window.__cortexFrameReady=false;requestAnimationFrame(()=>{window.__cortexFrameReady=true});
          const all=[...document.querySelectorAll('[id],[data-cortex],nav,aside,main,button,input,textarea,h1,h2,h3,p,li,label,section,[role],.card,.sidebar,.questionnaire')].slice(0,100);
          const requested=\(encodedSelectors),aliases=new Map();for(const selector of requested){const target=document.querySelector(selector);if(target){if(!all.includes(target))all.push(target);aliases.set(target,[...(aliases.get(target)||[]),selector]);}}
          const items=all.map((e,i)=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e),text=(e.textContent||"").trim().slice(0,160);return {e,selector:e.id?'#'+e.id:e.tagName.toLowerCase()+':'+i,r,s,text}}),telemetry=[];
          for(const item of items){const {e,selector,r,s,text}=item;if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)<.05)continue;if(r.right>innerWidth+2||r.left<-2)telemetry.push({selector,issue:'horizontal-overflow',detail:`${Math.round(Math.max(r.right-innerWidth,-r.left))}px hors viewport`});if(r.bottom>innerHeight+2&&r.height<innerHeight*.9)telemetry.push({selector,issue:'vertical-overflow',detail:`${Math.round(r.bottom-innerHeight)}px hors viewport`});if(text&&e.scrollWidth>e.clientWidth+2)telemetry.push({selector,issue:'text-clipped',detail:'texte tronqué'})};
          const modal=document.querySelector('dialog:modal');
          const interactive=items.filter(x=>/^(BUTTON|INPUT|TEXTAREA|A|SELECT)$/.test(x.e.tagName)&&x.s.pointerEvents!=='none'&&x.s.visibility!=='hidden'&&x.r.width>0&&x.r.height>0&&(!modal||modal.contains(x.e)));for(let i=0;i<interactive.length;i++)for(let j=i+1;j<interactive.length;j++){const a=interactive[i],b=interactive[j],overlap=Math.max(0,Math.min(a.r.right,b.r.right)-Math.max(a.r.left,b.r.left))*Math.max(0,Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.top,b.r.top));if(overlap>16)telemetry.push({selector:`${a.selector}, ${b.selector}`,issue:'collision',detail:`collision ${Math.round(overlap)}px²`})};
          return {elements:items.map(({e,selector,r,s,text})=>({selector,aliases:aliases.get(e)||[],styles:Object.fromEntries(\(encodedStyles).map(key=>[key,s.getPropertyValue(key)||s[key]||''])),visible:s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>.05&&r.width>0&&r.height>0,attributes:Object.fromEntries([...e.attributes].slice(0,24).map(a=>[a.name,a.value.slice(0,200)])),tag:e.tagName.toLowerCase(),value:e.value??null,x:r.x,y:r.y,width:r.width,height:r.height,opacity:Number(s.opacity),transform:s.transform,filter:s.filter,text,color:s.color,backgroundColor:s.backgroundColor,fontFamily:s.fontFamily,fontSize:parseFloat(s.fontSize)||0,fontWeight:s.fontWeight,lineHeight:s.lineHeight,letterSpacing:s.letterSpacing,borderRadius:s.borderRadius})),telemetry,motionClock:gsapClock?'gsap':'waapi',reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,frameRequested:true,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),overflowY:Math.max(0,document.documentElement.scrollHeight-innerHeight),errors:window.__cortexErrors||[]};
        })()
        """
        web.evaluateJavaScript(js) { value, error in
            if let error = error { self.errors.append(error.localizedDescription) }
            let metrics = value as? [String: Any] ?? [:]
            self.motionClock=metrics["motionClock"] as? String ?? "waapi"
            self.errors.append(contentsOf: metrics["errors"] as? [String] ?? [])
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.045) {
                let config = WKSnapshotConfiguration(); config.rect = self.web.bounds; config.snapshotWidth = 640
                self.web.takeSnapshot(with: config) { image, error in
                    if let error = error { self.errors.append(error.localizedDescription) }
                    if let image = image, let tiff = image.tiffRepresentation, let bitmap = NSBitmapImageRep(data: tiff), let data = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.6]) {
                        if self.firstImage == nil { self.firstImage = image }
                        self.lastImage = image
                        self.frames.append(["timestamp":time,"image":"data:image/jpeg;base64,"+data.base64EncodedString(),"elements":metrics["elements"] ?? [],"telemetry":metrics["telemetry"] ?? [],"reducedMotion":metrics["reducedMotion"] ?? false,"overflow":metrics["overflow"] ?? 0,"overflowY":metrics["overflowY"] ?? 0])
                    }
                    self.capture(index + 1)
                }
            }
        }
    }
    func finish() {
        if finished { return }; finished = true
        var result: [String: Any] = ["supported":true,"frames":frames,"errors":Array(Set(errors)),"width":web.bounds.width,"height":web.bounds.height,"interactions":interactions,"reducedMotionEmulated":true,"observedSelectors":input.selectors ?? [],"motionClock":motionClock,"captureMode":"webkit"]
        if let reference=referenceImage(), let actual = lastImage, let a = pixels(actual), let b = pixels(reference) {
            let sum = zip(a,b).enumerated().filter { $0.offset % 4 != 3 }.reduce(0.0) { $0 + abs(Double($1.element.0) - Double($1.element.1)) }
            result["referenceDifference"] = sum / Double(64 * 40 * 3 * 255)
            result["referenceAnalysis"]=analyzeReference(reference)
            let measuredA=rasterCells(a),measuredB=rasterCells(b)
            let regions=zip(measuredA,measuredB).enumerated().map { index,pair -> [String:Any] in
                let (left,_) = pair
                var region=left;region.removeValue(forKey:"rgb")
                let row=index/4,col=index%4
                var difference=0.0
                for y in (row*10)..<((row+1)*10) { for x in (col*16)..<((col+1)*16) { for channel in 0..<3 {
                    let offset=(y*64+x)*4+channel
                    difference+=Double(abs(Int(a[offset])-Int(b[offset])))
                } } }
                region["error"]=difference/Double(16*10*3*255)
                return region
            }
            let ratio=reference.size.width/max(1,reference.size.height),actualRatio=web.bounds.width/web.bounds.height
            result["referenceComparison"]=["aspectCompatible":abs(ratio/actualRatio-1)<0.03,"meanError":sum / Double(64 * 40 * 3 * 255),"cells":regions]
        }
        do { let data = try JSONSerialization.data(withJSONObject: result); try data.write(to: inputURL.deletingLastPathComponent().appendingPathComponent("report.json"), options: .atomic) }
        catch { fputs(error.localizedDescription, stderr); exit(1) }
        window.close(); app.stop(nil); exit(0)
    }
}
let renderer = Renderer()
renderer.start()
app.run()
