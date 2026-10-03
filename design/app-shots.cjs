#!/usr/bin/env node
/**
 * 对「已构建的渲染产物」出图（真实 React 应用，不是原型）。
 *
 * 为什么要绕这么一圈：
 *   渲染层要靠 window.api（preload 注入的 IPC 桥）才能工作，直接开 out/renderer/index.html
 *   会白屏。这里在页头注入一个 mock api + 一个交互驱动脚本，用真实点击把界面推到目标状态，
 *   再用「dump-dom → 剥 script → 截静态探针」两步出图（--screenshot 会早于脚本执行抢拍，
 *   直接用它会拿到未渲染的空白页）。
 *
 * 用法：node design/app-shots.cjs
 */
const fs = require('fs')
const path = require('path')
const http = require('http')
const crypto = require('crypto')
const { execFile } = require('child_process')
const { promisify } = require('util')
const run = promisify(execFile)

const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'out', 'renderer')
const TMP = path.join(process.env.TEMP || process.env.TMP || '/tmp', 'nacl-app-shots')
const SHOTS = path.join(__dirname, 'app-shots')

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].find((p) => fs.existsSync(p))
if (!CHROME) {
  console.error('找不到 Chrome/Edge')
  process.exit(1)
}

// 必须给一个独立 profile：否则 headless 会去抢用户正在用的默认 profile，
// 拿不到锁就挂住不退出（表现为进程被 SIGTERM 掉、一张图都出不来）。
const PROFILE = path.join(TMP, 'chrome-profile')
const CHROME_FLAGS = [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--no-first-run',
  '--disable-extensions',
  '--user-data-dir=' + PROFILE.replace(/\\/g, '/')
]

// 每个状态要执行的动作序列（在页面里按顺序点击推进）
const STATES = {
  '01-practice-empty-dark': [],
  '02-practice-light': ['topic', 'gen'],
  '03-practice-dark': ['topic', 'gen'],
  '04-cet-answering-light': ['topic', 'gen', 'listen'],
  '05-cet-finished-dark': ['topic', 'gen', 'listen', 'answerAll'],
  '06-words-light': ['tab:words'],
  '07-words-study-light': ['tab:words', 'study'],
  '08-words-study-back-light': ['tab:words', 'study', 'reveal'],
  '09-history-light': ['tab:history'],
  '10-history-open-light': ['tab:history', 'expand'],
  '11-settings-light': ['tab:settings'],
  '12-settings-cet-dark': ['tab:settings'],
  '13-practice-cet-light': ['topic', 'gen'],
  '14-practice-busy-dark': ['topic', 'gen'],
  '15-pick-word-light': ['topic', 'gen', 'pickword'],
  '16-pick-word-history-light': ['tab:history', 'expand', 'pickword'],
  // 复现 bug 3：练习页新加的词释义还是 null（词典/翻译还没回填）
  '17-study-back-nullmean-light': ['tab:words', 'study', 'reveal'],
  // 点词即时释义的另两种表现
  '18-pick-word-pending-light': ['topic', 'gen', 'pickword'],
  '19-pick-word-inbook-light': ['topic', 'gen', 'pickword']
}

const INJECT = `
<script>
(function(){
  // 整个注入脚本套一层 try：任何一处取不到节点也不至于「整页白屏且毫无线索」，
  // 出错信息会落到 title 上，由 app-shots 直接打出来。
  try {
  var NAME = (location.hash||'').replace(/^#/,'') || '01-practice-empty-dark';
  var CET   = /cet/.test(NAME);
  var BUSY  = /busy/.test(NAME);
  // 模拟「刚加进单词本、后台释义还没回填」的词（meaning / phonetic 为空）
  var NULLMEAN = /nullmean/.test(NAME);
  // 点词释义的三种表现：ok=查到 / pending=查询中不返回 / inbook=已在单词本
  // 注意别写成 /pick-pending/ —— 状态名是 18-pick-word-pending-light，中间隔着 word
  var PREVIEW = /pending/.test(NAME) ? 'pending' : (/inbook/.test(NAME) ? 'inbook' : 'ok');
  try { localStorage.setItem('theme', /light/.test(NAME) ? 'light' : 'dark'); } catch(e) {}

  function sentences(){
    var raw = [
      ['A','Hi, I have a reservation under the name Chen.','你好，我用陈这个名字订了房。'],
      ['B','Let me check. Yes — a double room for three nights.','我查一下。是的——一间双人房，住三晚。'],
      ['A',"That's right. Is breakfast included?",'没错。含早餐吗？'],
      ['B','It is, and it\\u2019s served from seven to ten on the second floor.','含的，二楼七点到十点供应。'],
      ['A','Great. Could I also ask for a late check-out?','太好了。我还能申请延迟退房吗？'],
      ['B','We can offer one o\\u2019clock, but after that there\\u2019s a half-day charge.','可以给到一点，再晚就要收半天房费。'],
      ['A','One o\\u2019clock works. One more thing \\u2014 is the airport shuttle still running?','一点可以。还有一件事——机场班车还运行吗？'],
      ['B','It runs every thirty minutes, and you can book it right at this desk.','每三十分钟一班，直接在这个前台就能预约。']
    ];
    return raw.map(function(r,i){
      return { id:'s'+i, conversationId:'c1', seq:i, speaker:r[0], english:r[1], chinese:r[2],
               audioPath:'x', slowAudioPath:'x', ttsStatus:'done',
               audioUrl:'data:audio/mpeg;base64,', slowAudioUrl:'data:audio/mpeg;base64,' };
    });
  }
  var QUESTIONS = [
    ['What is the man\\u2019s problem?','男士遇到了什么问题？',
     ['He cannot register for a course he wants to take.','He has failed a required mathematics course.','He missed the deadline for course selection.','He does not get along with his academic adviser.'],
     0,'原文开头男士说 "I am having trouble with my course selection"，随后说明想选高级统计学但没修先修课——属于「想选却选不上」，A 正确。B 与原文相反（他的数学成绩不错）；C、D 原文均未提及，是典型的「出现过相关词但答非所问」选项。'],
    ['What grade did the man receive in calculus last term?','男士上学期微积分得了什么成绩？',
     ['A B plus.','An A minus.','A C plus.','An incomplete.'],
     1,'女士问 "What did you get in calculus last term?"，男士回答 "An A minus"。B 正确。A 用 "B plus" 作近音干扰，C、D 原文未出现。'],
    ['What does the woman suggest the man do?','女士建议男士做什么？',
     ['Talk to the professor in person.','Take an easier statistics course.','Wait until next semester to register.','Ask his adviser to sign a waiver.'],
     0,'女士说 "You should go and talk to the professor directly"，A 正确。C 与原文的「先修课是硬性要求」矛盾，D 属原文 "waiver" 一词的过度引申。'],
    ['Where does this conversation most probably take place?','这段对话最可能发生在哪里？',
     ['In a lecture hall.','At a registrar\\u2019s office.','In a library.','At a student cafeteria.'],
     1,'男士要办选课、女士提到 "I will send it to the registrar"，且涉及成绩单与先修课审核，B 正确。A、C、D 均为校园场景的常见干扰项。']
  ].map(function(q,i){
    return { id:'q'+i, conversationId:'c1', seq:i, stem:q[0], stemChinese:q[1], options:q[2],
             answerIndex:q[3], explanation:q[4], stemAudioPath:'x', ttsStatus:'done',
             stemAudioUrl:'data:audio/mpeg;base64,' };
  });
  var WORDS = [
    ['w1','reservation','n. 预订；预约（的房间、座位等）','/\\u02ccrez\\u0259\\u02c8ve\\u026a\\u0283n/','I have a reservation under the name Chen.','我用陈这个名字订了房。','learning'],
    ['w2','shuttle','n. 班车；穿梭巴士  v. 往返运送','/\\u02c8\\u0283\\u028ctl/','Is the airport shuttle still running?','机场班车还运行吗？','learning'],
    ['w3','prerequisite','n. 先修课程；前提条件  adj. 必备的','/\\u02ccpri\\u02d0\\u02c8rekw\\u0259z\\u026at/','The prerequisite is Introduction to Data Analysis.','先修课程是《数据分析导论》。','learning'],
    ['w4','waiver','n. 豁免；放弃（权利、要求）','/\\u02c8we\\u026av\\u0259(r)/','Then you would need a waiver.','那你需要一份豁免。','learning'],
    ['w5','registrar','n. 教务主任；注册主管','/\\u02ccred\\u0292\\u026a\\u02c8str\\u0251\\u02d0(r)/','I will send it to the registrar.','我会转给教务处。','learning'],
    ['w6','allowance','n. 限额；津贴；折扣','/\\u0259\\u02c8la\\u028a\\u0259ns/','There is a ten-kilo baggage allowance.','行李限额是十公斤。','mastered']
  ].map(function(w){
    return { id:w[0], word:w[1], meaning:w[2], phonetic:w[3], example:w[4], exampleTranslation:w[5],
             wordAudioPath:'x', exampleAudioPath:'x', sourceSentenceId:'s0', addedAt:Date.now()-86400000,
             reviewCount:1, nextReviewAt:Date.now()+86400000, status:w[6],
             wordAudioUrl:'data:audio/mpeg;base64,', exampleAudioUrl:'data:audio/mpeg;base64,' };
  });
  if (NULLMEAN) { WORDS[0].meaning = null; WORDS[0].phonetic = null; }
  var CONVS = [
    ['c1','酒店入住 · 延迟退房与机场班车','cefr','B1','酒店入住 · 延迟退房与机场班车'],
    ['c2','选课咨询','cet','CET4',''],
    ['c3','求职面试 · 期望薪资','ielts','6.5','求职面试 · 期望薪资'],
    ['c4','图书馆借书与逾期罚款','cefr','A2',''],
    ['c5','邻里噪音投诉','cefr','B2','邻里噪音投诉']
  ].map(function(c,i){
    return { id:c[0], topic:c[1], system:c[2], level:c[3], title:c[4], createdAt:Date.now()-i*5400000 };
  });

  var noop = function(){ return Promise.resolve(); };
  window.api = {
    getConfig: function(key){
      if (key === 'exam_system') return Promise.resolve(CET ? 'cet' : 'cefr');
      if (key === 'last_level')  return Promise.resolve(CET ? 'CET4' : 'B1');
      if (key === 'deepseek_api_key') return Promise.resolve('sk-demo-0123456789abcdef');
      return Promise.resolve(null);
    },
    setConfig: noop,
    setSystem: function(){ return Promise.resolve(CET ? 'CET4' : 'B1'); },
    setVoice: noop,
    previewVoice: function(){ return Promise.resolve('data:audio/mpeg;base64,'); },
    generateDialogue: function(){
      if (BUSY) return new Promise(function(){});
      return new Promise(function(res){
        setTimeout(function(){
          res({ conversationId:'c1', system: CET ? 'cet' : 'cefr', mode: CET ? 'exam' : 'conversation',
                dialogue:{ title:'酒店入住 · 延迟退房与机场班车', difficulty:'B1', dialogue:[] } });
        }, 40);
      });
    },
    listConversations: function(){ return Promise.resolve(CONVS); },
    getConversation: function(id){ return Promise.resolve(CONVS.filter(function(c){return c.id===id})[0]||null); },
    deleteConversation: noop,
    listSentences: function(){ return Promise.resolve(sentences()); },
    listQuestions: function(){ return Promise.resolve(CET ? QUESTIONS : []); },
    getExamIntro: function(){ return Promise.resolve(CET ? 'data:audio/mpeg;base64,' : null); },
    synthesizeAll: noop,
    clearAllData: noop,
    addWord: noop,
    previewWord: function(word){
      var MEAN = { 'Hi': 'int. 你好；嗨（打招呼用语）', 'I': 'pron. 我', 'have': 'v. 有；拥有；已经' };
      if (PREVIEW === 'pending') return new Promise(function(){});      // 一直查不完 → 截 loading 态
      if (PREVIEW === 'inbook')  return Promise.resolve({ word:word, meaning: MEAN[word] || 'n. 示例释义', phonetic:'/test/', inBook:true });
      return new Promise(function(res){
        setTimeout(function(){
          res({ word:word, meaning: MEAN[word] || 'n. 示例释义', phonetic:'/' + word.toLowerCase() + '/', inBook:false });
        }, 60);
      });
    },
    // 预取：真实实现是「点第一个词时顺手把整句查好」，出图时不需要真的查
    prefetchWords: function(){ return Promise.resolve(0); },
    listWords: function(){ return Promise.resolve(WORDS); },
    getDueWords: function(){ return Promise.resolve([]); },
    deleteWord: noop,
    markWordMastered: noop,
    reviewWord: noop,
    getStats: function(){ return Promise.resolve({ total:6, learning:5, mastered:1, due:0 }); },
    randomTopic: function(){ return Promise.resolve('图书馆借书'); }
  };

  /* ---------------- 交互驱动 ---------------- */
  var TRACE = [];
  function $(s){ return document.querySelector(s); }
  function $$(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function byText(sel, txt){ return $$(sel).filter(function(e){ return (e.textContent||'').indexOf(txt) >= 0; })[0]; }
  function click(el){
    if(!el){ TRACE.push('click:nil'); return false; }
    if(typeof el.dispatchEvent !== 'function'){
      TRACE.push('click:bad-target-' + Object.prototype.toString.call(el) + '-' + (el.tagName||'?'));
      return false;
    }
    el.dispatchEvent(new MouseEvent('click',{ bubbles:true }));
    return true;
  }
  function type(el, v){
    if(!el){ TRACE.push('type:nil'); return false; }
    var d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    TRACE.push('type:tag=' + el.tagName + ',ctor=' + (el.constructor && el.constructor.name) +
               ',hasSetter=' + !!(d && d.set));
    try {
      d.set.call(el, v);
    } catch(e){
      TRACE.push('type:setter-failed=' + e.message);
      el.value = v;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    TRACE.push('type:value-now=' + el.value);
    return true;
  }

  var STEPS = {
    'topic':     function(){ type($('.field .input'), '酒店入住'); },
    'gen':       function(){ click(byText('.toolbar .btn-primary','生成')); },
    'listen':    function(){ click(byText('.toolbar .btn-primary','开始听力')); },
    'answerAll': function(){ $$('.q').forEach(function(card){ click(card.querySelector('.opt')); }); },
    'tab:words':   function(){ click(byText('.nav-btn','单词本')); },
    'tab:history': function(){ click(byText('.nav-btn','历史')); },
    'tab:settings':function(){ click(byText('.nav-btn','设置')); },
    'study':     function(){ click(byText('.toolbar .btn-primary','开始背单词')); },
    'reveal':    function(){ click(byText('.btn-primary','显示中文')); },
    'expand':    function(){ click($('.hist-main')); },
    'pickword':  function(){ click($('.sent-list .en .w')); }
  };

  var seq = ${JSON.stringify(STATES)}[NAME] || [];
  var errs = [];
  window.__errs = errs;
  window.addEventListener('error', function(e){ errs.push(String(e.message)); });
  var i = 0;

  function step(){
    if (i >= seq.length) {
      // report 万一抛错（例如某个诊断字段取了不存在的节点），也要让 title 带到错误信息，
      // 否则页面看起来「没有诊断」，无从下手
      try { report('done'); } catch(e){ document.title = 'DIAGEX ' + String(e && e.message); }
      return;
    }
    var key = seq[i++];
    try { (STEPS[key]||function(){})(); } catch(e){ errs.push(key + ': ' + e.message); }
    TRACE.push('step:' + key);
    var wait = (key === 'gen' || key === 'listen' || key === 'expand') ? 320 : 140;
    setTimeout(step, wait);
  }

  function report(phase){
    var el = $('.field .input');
    // ——— 点词诊断：选中块是否压住邻居 / 引号内容是否可读 ———
    function rect(e){ if(!e) return null; var r=e.getBoundingClientRect();
      return { x:Math.round(r.x), r:Math.round(r.right), w:Math.round(r.width), t:(e.textContent||'').slice(0,24) }; }
    var sel = $('.w.picked');
    var enEl = $('.en');
    var pwEl = $('.pick-word');
    var pick = sel ? {
      sel: rect(sel),
      prev: rect(sel.previousElementSibling),
      next: rect(sel.nextElementSibling),
      gapPrev: sel.previousElementSibling ? Math.round(sel.getBoundingClientRect().left - sel.previousElementSibling.getBoundingClientRect().right) : null,
      gapNext: sel.nextElementSibling ? Math.round(sel.nextElementSibling.getBoundingClientRect().left - sel.getBoundingClientRect().right) : null,
      overflow: function(){ var e=sel; var bad=[];
        for (var k=0;k<e.childNodes.length;k++){}
        return bad; }(),
      selScrollW: sel.scrollWidth,
      selClientW: sel.clientWidth
    } : null;
    var enInfo = enEl ? {
      w: Math.round(enEl.getBoundingClientRect().width),
      display: getComputedStyle(enEl).display,
      wrap: getComputedStyle(enEl).flexWrap,
      colGap: getComputedStyle(enEl).columnGap,
      textAlign: getComputedStyle(enEl).textAlign,
      lineH: getComputedStyle(enEl).lineHeight,
      childCount: enEl.children.length,
      wMargins: enEl.firstElementChild ? getComputedStyle(enEl.firstElementChild).margin : null,
      wPad: enEl.firstElementChild ? getComputedStyle(enEl.firstElementChild).padding : null,
      /* 每个词的 flex 简写：查「谁把第一个词撑成一条长条」 */
      flexes: Array.prototype.slice.call(enEl.children).map(function(c){ return getComputedStyle(c).flex; }),
      wDisplay: enEl.firstElementChild ? getComputedStyle(enEl.firstElementChild).display : null,
      wWidth: enEl.firstElementChild ? getComputedStyle(enEl.firstElementChild).width : null,
      flexDir: getComputedStyle(enEl).flexDirection,
      justify: getComputedStyle(enEl).justifyContent,
      /* 把每个词的 rect 列出来，看是谁把行撑出空白 */
      items: Array.prototype.slice.call(enEl.children, 0, 8).map(function(c){ return rect(c); })
    } : null;
    var meanEl = $('.pick-mean');
    var pwInfo = pwEl ? {
      text: pwEl.textContent,
      codes: Array.prototype.map.call(pwEl.textContent, function(c){ return c.charCodeAt(0); }),
      before: getComputedStyle(pwEl, '::before').content,
      after: getComputedStyle(pwEl, '::after').content,
      /* 点词即时释义：这一行是本次改动的验收点 */
      mean: meanEl ? meanEl.textContent : null,
      meanCls: meanEl ? meanEl.className : null,
      phon: ($('.pick-phon') || {}).textContent || null,
      note: ($('.pick-note') || {}).textContent || null,
      hasAddBtn: !!$('.pickbar .btn-primary')
    } : null;
    var faceBack = $('.face-back');
    var backInfo = faceBack ? {
      mean: (($('.face-mean')||{}).textContent) || null,
      ex: (($('.face-ex')||{}).textContent) || null,
      exZh: (($('.face-ex-zh')||{}).textContent) || null,
      html: faceBack.innerHTML.replace(/\s+/g,' ').slice(0, 260)
    } : null;
    document.title = 'DIAG ' + JSON.stringify({
      phase: phase,
      state: NAME,
      steps: seq.length,
      topic: el ? el.value : null,
      errs: errs,
      trace: TRACE,
      nav: $$('.nav-btn').map(function(b){ return b.textContent.trim() }).join('|'),
      hasPrimary: !!byText('.toolbar .btn-primary','生成'),
      panels: $$('.note,.busy-box,.sent-list,.q-list,.list,.grp-card,.flip').length,
      pick: pick,
      enInfo: enInfo,
      pwInfo: pwInfo,
      backInfo: backInfo
    });
  }
  window.__report = report;

  window.addEventListener('DOMContentLoaded', function(){ setTimeout(step, 140); });
  } catch(e){ document.title = 'IIFE-ERR ' + (e && e.message); }
})();
</script>
`;

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error('没有 out/renderer，先跑 npm run build')
    process.exit(1)
  }

  // 1) 把构建产物拷到临时目录，注入 mock + 驱动
  // 注意：这里不能用 fs.cpSync —— 在本机环境下它会无声地杀掉进程（退出码 127），
  // 逐文件 readFileSync/writeFileSync 才稳。
  fs.rmSync(TMP, { recursive: true, force: true })
  fs.mkdirSync(path.join(TMP, 'assets'), { recursive: true })
  const copies = ['index.html'].concat(
    fs.readdirSync(path.join(SRC, 'assets')).map((f) => 'assets/' + f)
  )
  for (const rel of copies) {
    fs.writeFileSync(path.join(TMP, rel), fs.readFileSync(path.join(SRC, rel)))
  }
  const index = path.join(TMP, 'index.html')
  let html = fs.readFileSync(index, 'utf8')
  // 注意：替换串必须用「函数」形式。String.replace 会把替换文本里的 $$ 当成转义序列，
  // 直接写 html.replace('</head>', INJECT + '</head>') 会把注入代码里的 $$ 吃掉、
  // 让 $ 被后声明的函数覆盖成「返回数组」，症状是点击/输错对象（dispatchEvent is not a function）。
  html = html.replace('</head>', () => INJECT + '</head>')
  fs.writeFileSync(index, html)

  // 2) 起一个本地静态服务（file:// 下 <script type="module"> 会被 CORS 拦掉）
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0].split('#')[0])
    const file = path.join(TMP, url === '/' ? 'index.html' : url)
    if (!file.startsWith(TMP) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404)
      res.end('nope')
      return
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' })
    res.end(fs.readFileSync(file))
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const PORT = server.address().port

  fs.mkdirSync(SHOTS, { recursive: true })
  fs.readdirSync(SHOTS).forEach((f) => fs.rmSync(path.join(SHOTS, f)))

  // ONLY=关键字 只跑匹配的状态（调试用，例如 ONLY=pick-word）
  const names = Object.keys(STATES).filter((n) => !process.env.ONLY || n.includes(process.env.ONLY))
  for (const name of names) {
    const url = `http://127.0.0.1:${PORT}/#${name}`
    // 3a) 先拿「状态已生效」的真实 DOM
    const { stdout: dom } = await run(
      CHROME,
      [
        ...CHROME_FLAGS, '--hide-scrollbars',
        '--virtual-time-budget=12000', '--window-size=1200,860', '--dump-dom', url
      ],
      { maxBuffer: 1 << 28 }
    )
    if (!dom || dom.length < 2000 || /neterror/.test(dom)) {
      console.error(`  !! ${name} 渲染失败（DOM ${dom.length} 字节）`)
      continue
    }
    if (/id="root"><\/div>/.test(dom)) {
      console.error(`  !! ${name} React 没挂载上（root 为空）`)
      continue
    }
    const diag = (dom.match(/<title>DIAG ([^<]*)<\/title>/) || [])[1]
    if (!diag) {
      // 诊断脚本没跑起来时的兜底：把 title 和 root 内容落盘，便于定位
      fs.writeFileSync(path.join(TMP, `dom-${name}.html`), dom)
      const t = (dom.match(/<title>([^<]*)<\/title>/) || [])[1] || '(no title)'
      const root = (dom.match(/<div id="root">([\s\S]{0,160})/) || [])[1] || '(no root)'
      console.log(`  [${name}] !! 无诊断 | title=${t.replace(/\n/g, ' ')} | root=${root.replace(/\n/g, ' ').slice(0, 120)}`)
    }
    console.log(`  [${name}] ${diag ? diag.replace(/&quot;/g, '"').slice(0, 1200) : '（没有诊断信息）'}`)
    // 3b) 剥掉全部 script：否则重新加载探针时应用会回到初始状态
    //     同时注入「定格」样式：静态探针重新加载时，入场动画 / 过渡会从头再播一遍，
    //     不关掉就会把 3D 翻面、viewIn 淡入这些中间帧拍下来（看起来像配色发灰、文字被压扁）。
    const FREEZE =
      '<style>*,*::before,*::after{animation:none!important;transition:none!important}</style>'
    const probe = path.join(TMP, `probe-${name}.html`)
    const baked = dom.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace('</head>', () => FREEZE + '</head>')
    fs.writeFileSync(probe, baked)
    // 3c) 截这份静态探针
    await run(CHROME, [
      ...CHROME_FLAGS, '--hide-scrollbars',
      '--virtual-time-budget=3000', '--window-size=1200,860',
      `--screenshot=${path.join(SHOTS, name + '.png')}`,
      `http://127.0.0.1:${PORT}/probe-${name}.html`
    ])
    const size = fs.statSync(path.join(SHOTS, name + '.png')).size
    console.log(`  -> ${name}.png  (${(size / 1024).toFixed(0)} KB)`)
  }

  server.close()

  // 4) 自检：不同状态不能是同一张图
  const sums = fs
    .readdirSync(SHOTS)
    .filter((f) => f.endsWith('.png'))
    .map((f) => crypto.createHash('md5').update(fs.readFileSync(path.join(SHOTS, f))).digest('hex'))
  const uniq = new Set(sums).size
  console.log(
    `\n生成 ${sums.length} 张；不同内容 ${uniq} 张（${sums.length === uniq ? 'OK' : '警告：有重复'})`
  )
  console.log('目录：' + SHOTS)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
