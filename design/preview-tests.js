window.__errs=[];
window.addEventListener('error', (e)=>window.__errs.push('JS错误: '+(e.message||e.type)));
window.addEventListener('unhandledrejection', (e)=>window.__errs.push('Promise拒绝: '+e.reason));
(async function(){
  const log=[]; const ok=(n,c)=>log.push((c?'PASS':'FAIL')+' :: '+n);
  const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
  const q=(x)=>document.querySelector(x);
  const qa=(x)=>Array.from(document.querySelectorAll(x));
  const rows=()=>qa('.score-row');
  try{
    /* ===== A 轮：完整真题节奏，含一次超时 ===== */
    STATE.system='cet'; STATE.level='四级'; STATE.generated=true;
    CETSTATE.phase='idle'; CETSTATE.answers=[null,null,null,null];
    CETSTATE.revealed=new Set(); CETSTATE.transcript=false;
    renderPractice();
    ok('A1 渲染出答题器', !!q('#startExam'));
    ok('A2 16 个选项从一开始就全部可见', qa('.opt').length===16);
    ok('A3 题干默认隐藏(试卷只印选项)', qa('.q .stem').length===0);
    ok('A4 四段流程轨齐全', qa('.rail-step').length===4);
    q('#startExam').click(); await wait(60);
    ok('A5 开始听力 -> 播考试说明', CETSTATE.phase==='intro' && !!q('.rail-step.active'));
    await wait(1800); ok('A6 -> 播对话材料', CETSTATE.phase==='dialogue');
    await wait(3200); ok('A7 -> 朗读题干 且题号归零', CETSTATE.phase==='stem' && CETSTATE.q===0);
    await wait(1700); ok('A8 -> 进入作答窗口', CETSTATE.phase==='answering');
    ok('A9 倒计时已启动', CETSTATE.countdown>0 && CETSTATE.countdown<=15);
    ok('A10 倒计时环已渲染', !!q('.ring .rf'));
    q('[data-q="0"][data-o="0"]').click(); await wait(30);
    ok('A11 答对第1题 -> 停表', CETSTATE.phase==='answered' && CETSTATE.answers[0]===0);
    ok('A12 答完自动显示题干', !!q('.q .stem'));
    ok('A13 答完显示中文解析', !!q('.q .exp'));
    q('[data-next]').click(); await wait(1700);
    ok('A14 下一题 -> 第2题作答窗口', CETSTATE.q===1 && CETSTATE.phase==='answering');
    await wait(17000);
    ok('A15 第2题超时 -> 记 null 并自动推进', CETSTATE.answers[1]===null && CETSTATE.q===2);
    q('[data-q="2"][data-o="2"]').click(); await wait(30);
    ok('A16 第3题答错被记录', CETSTATE.answers[2]===2 && CETSTATE.phase==='answered');
    q('[data-next]').click(); await wait(1700);
    ok('A17 推进到第4题', CETSTATE.q===3 && CETSTATE.phase==='answering');
    q('[data-q="3"][data-o="2"]').click(); await wait(60);
    ok('A18 有超时未答时答完末题不自动出成绩', CETSTATE.phase==='answered');
    ok('A19 末题按钮为「查看结果」', q('[data-next]') && q('[data-next]').textContent.indexOf('查看结果')>-1);
    q('[data-next]').click(); await wait(60);
    ok('A20 点「查看结果」-> 出成绩', CETSTATE.phase==='finished');
    ok('A21 自动展开原文', CETSTATE.transcript===true);
    ok('A22 成绩卡出现', !!q('.big-score'));
    ok('A23 答对数 = 2 (对1/未答2/错3/对4)', q('.big-score .n').textContent.trim()==='2');
    ok('A24 未作答在明细里标「未作答」', rows()[1].textContent.indexOf('未作答')>-1);
    ok('A25 4 个完成步骤显示对勾', qa('.rail-dot .i-xs').length===4);

    /* ===== B 轮：全部即时作答，应自动出成绩 ===== */
    q('#startExam').click(); await wait(60);
    ok('B1 重做一遍清空作答', CETSTATE.answers.every(a=>a===null) && CETSTATE.phase==='intro');
    await wait(5000); await wait(1700);
    q('[data-q="0"][data-o="0"]').click(); await wait(30); q('[data-next]').click(); await wait(1700);
    q('[data-q="1"][data-o="1"]').click(); await wait(30); q('[data-next]').click(); await wait(1700);
    q('[data-q="2"][data-o="1"]').click(); await wait(30); q('[data-next]').click(); await wait(1700);
    q('[data-q="3"][data-o="2"]').click(); await wait(80);
    ok('B2 全部答完自动出成绩(无超时)', CETSTATE.phase==='finished');
    ok('B3 满分 4/4', q('.big-score .n').textContent.trim()==='4');
    ok('B4 4 条明细全部标「对」', rows().every(r=>r.textContent.indexOf('对')>-1));
    ok('B5 底部可展开原文与翻译', !!q('#transBtn'));

    /* ===== 字幕播放器：焦点与降调 ===== */
    STATE.system='cefr'; STATE.generated=true; renderPractice(); await wait(30);
    ok('C1 播放器渲染 8 句', qa('#sentList .sent').length===8);
    ok('C2 未播放时无任何音波', qa('#sentList .eq:not([hidden])').length===0);
    qa('#sentList .sent-play')[1].click(); await wait(30);
    ok('C3 点第2句(角色B) -> 高亮落在第2句', qa('#sentList .sent')[1].classList.contains('playing'));
    ok('C4 只有该句高亮', qa('#sentList .sent.playing').length===1);
    ok('C5 角色B 也有音波指示', !!qa('#sentList .sent')[1].querySelector('.eq:not([hidden])'));
    ok('C6 全文档音波只 1 个可见', qa('#sentList .eq:not([hidden])').length===1);
    ok('C7 其余 7 句降调聚焦', qa('#sentList .sent.dim').length===7);
    qa('#sentList .sent-play')[4].click(); await wait(30);
    ok('C8 改点第5句 -> 高亮跟着移动', qa('#sentList .sent')[4].classList.contains('playing') && qa('#sentList .sent')[1].classList.contains('dim'));
    q('#playAll').click(); await wait(30);
    ok('C9 点连续播放 -> 停止并清掉所有态', qa('.sent.playing').length===0 && qa('.sent.dim').length===0);
    q('#playAll').click(); await wait(30);
    ok('C10 再点 -> 从第1句开始', qa('#sentList .sent')[0].classList.contains('playing'));

    /* ===== 点词加入单词本 ===== */
    q('#sentList .w').click(); await wait(20);
    ok('D1 点单词 -> 反白选中', !!q('.w.sel'));
    ok('D2 浮出加入动作条', !!q('.pickbar [data-add]'));
    ok('D3 动作条显示所选词', q('.pick-word') && q('.pick-word').textContent.length>0);
    q('.pickbar [data-add]').click(); await wait(20);
    ok('D4 加入后给出反馈', !!q('.toast-inline'));
    qa('#sentList .w')[3].click(); await wait(20);
    ok('D5 改点另一个词 -> 选中态只有一个', qa('#sentList .w.sel').length===1);
    q('#sentList .sent-zh').click(); await wait(20);
    ok('D6 可展开中文', !!q('#sentList .zh'));
    q('#slowChip').click(); await wait(10);
    ok('D7 慢速 chip 可切换', q('#slowChip').getAttribute('aria-pressed')==='true');
    q('#loopChip').click(); await wait(10);
    ok('D8 单句循环 chip 可切换', q('#loopChip').getAttribute('aria-pressed')==='true');

    /* ===== 背单词卡 ===== */
    WSTATE.studying=true; WSTATE.queue=null; WSTATE.total=0; WSTATE.flipped=false; renderWords(); await wait(20);
    ok('E1 进入背单词卡', !!q('#flipCard'));
    ok('E2 开局进度 0/5', q('.study-count').textContent.trim()==='0 / 5');
    ok('E3 正面不泄露释义', q('#flipCard .face-front').textContent.indexOf('预订')<0);
    ok('E4 未翻面时没有判定按钮', !q('#studyOk'));
    q('#reveal').click(); await wait(20);
    ok('E5 显示中文 -> 翻面', WSTATE.flipped===true && !!q('.flip.back'));
    ok('E6 翻面后出现两个判定按钮', !!q('#studyAgain') && !!q('#studyOk'));
    q('#studyOk').click(); await wait(20);
    ok('E7 点会背 -> 队列减至 4 且词标记已背',
       WSTATE.queue.length===4 && WORDS.filter(w=>w.w==='reservation')[0].st==='mastered');
    ok('E8 进度推进到 1/5(分母不随背词缩小)', q('.study-count').textContent.trim()==='1 / 5');
    ok('E9 进度条宽度 20%', q('.study-prog i').style.width==='20%');
    ok('E10 判定后自动回到正面(换下一个词)', WSTATE.flipped===false && !!q('#reveal'));
    q('#reveal').click(); await wait(20);
    q('#studyAgain').click(); await wait(20);
    ok('E11 点还不会 -> 词移到队尾', WSTATE.queue.length===4 && WSTATE.queue[3].w!=='reservation');
    ok('E12 「还不会」不消耗进度', q('.study-count').textContent.trim()==='1 / 5');

    /* ===== 设置：体系与等级 ===== */
    q('.nav-btn[data-go="settings"]').click(); await wait(30);
    ok('F1 切到设置页', STATE.tab==='settings' && q('.view[data-view="settings"]').classList.contains('on'));
    ok('F2 设置页 5 个分组卡', qa('#settingsRoot .grp-card').length===5);
    q('#settingsRoot [data-sys="ielts"]').click(); await wait(30);
    ok('F3 切体系 -> 雅思', STATE.system==='ielts');
    ok('F4 等级收敛到新体系(4.0)', STATE.level==='4.0');
    q('#settingsRoot [data-sys="cet"]').click(); await wait(30);
    ok('F5 四六级多出题干朗读音色', qa('#settingsRoot .select[data-slot]').length===3);
    q('#settingsRoot [data-sys="cefr"]').click(); await wait(30);
    ok('F6 切回 CEFR 音色回到 2 组', qa('#settingsRoot .select[data-slot]').length===2);
    q('#levelSel .select-btn').click(); await wait(30);
    const c2=q('#levelMenu .menu-item[data-sys="cefr"][data-lv="C2"]');
    ok('F7 练习页下拉列出 CEFR C2', !!c2);
    c2.click(); await wait(30);
    ok('F8 选 C2 落定，未被「切体系」覆盖成 A1', STATE.system==='cefr' && STATE.level==='C2');
    ok('F9 选完自动收起', !q('#levelSel').classList.contains('open'));
    q('#clearBtn').click(); await wait(30);
    ok('F10 清空数据 -> 就地二次确认', !!q('#clearYes') && !!q('#clearNo'));
    q('#clearNo').click(); await wait(30);
    ok('F11 取消后回到单按钮', !!q('#clearBtn') && !q('#clearYes'));

    /* ===== 历史 ===== */
    q('.nav-btn[data-go="history"]').click(); await wait(30);
    ok('G1 历史 5 条', qa('.hist').length===5);
    q('.hist[data-h="0"] .hist-main').click(); await wait(30);
    ok('G2 展开 -> 出现播放器', !!q('.hist[data-h="0"] .hist-body .sent-list'));
    q('.hist[data-h="0"] .hist-main').click(); await wait(30);
    ok('G3 再点收起', !q('.hist[data-h="0"] .hist-body'));
    q('.hist[data-h="0"] .hist-del').click(); await wait(30);
    ok('G4 删除 -> 剩 4 条', qa('.hist').length===4);

    /* ===== 单词本 ===== */
    q('.nav-btn[data-go="words"]').click(); await wait(30);
    const cnt = (st) => WORDS.filter(w=>w.st===st).length;
    const shown = () => qa('#wordsRoot .row-word').length;
    ok('H1 未背列表行数 = 数据里的未背数', shown()===cnt('learning'));
    ok('H2 分类计数与数据一致',
       q('#segFilter .seg-btn[data-f="unlearned"] em').textContent===String(cnt('learning')) &&
       q('#segFilter .seg-btn[data-f="mastered"] em').textContent===String(cnt('mastered')));
    const m0 = cnt('mastered');
    q('#segFilter .seg-btn[data-f="mastered"]').click(); await wait(30);
    ok('H3 切「已背」行数 = 已背数', shown()===m0);
    q('#wordsRoot [data-master="0"]').click(); await wait(30);
    ok('H4 移回未背 -> 已背少 1', cnt('mastered')===m0-1);
    ok('H5 移回后该分类行数同步', shown()===cnt('mastered'));
    const u1 = cnt('learning');
    q('#segFilter .seg-btn[data-f="unlearned"]').click(); await wait(30);
    ok('H6 未背行数 = 未背数(比之前多 1)', shown()===u1 && u1===cnt('learning'));
    q('#wordsRoot [data-del="0"]').click(); await wait(30);
    ok('H7 删除 -> 总数少 1', WORDS.length===5 && shown()===cnt('learning'));
    ok('H8 删除后分类计数同步',
       q('#segFilter .seg-btn[data-f="unlearned"] em').textContent===String(cnt('learning')));

    /* ===== 主题 / 标注 / 面板 ===== */
    q('#themeSw').click(); await wait(30);
    ok('I1 主题开关可切换', document.documentElement.dataset.theme==='light');
    q('#themeSw').click(); await wait(30);
    ok('I2 可切回暗色', document.documentElement.dataset.theme==='dark');
    q('#annoSw').click(); await wait(30);
    ok('I3 标注开关 -> 图例出现', document.body.dataset.anno==='on' && !q('#insLegend').hidden);
    { const nums=qa('.anno').map(e=>e.textContent.trim());
      ok('I4 当前页可见的标注编号无重复', new Set(nums).size===nums.length);
      ok('I5 编号都落在 1~11 之间', nums.every(n=>+n>=1 && +n<=11)); }
    q('#semSw').click(); await wait(30);
    ok('I6 语义色可关成纯黑白', document.documentElement.dataset.semantic==='off');
    q('#insFold').click(); await wait(30);
    ok('I7 预览面板可收起', document.body.dataset.ins==='fold');
  }catch(e){ log.push('THROW :: '+(e && e.message)); }
  const p=log.filter(l=>l[0]==='P').length, f=log.filter(l=>l[0]==='F').length;
  const errs = window.__errs.length ? ' 未捕获错误('+window.__errs.length+'): '+window.__errs.join(' ; ') : ' 无未捕获错误';
  log.push('SUMMARY :: 通过 '+p+' / 失败 '+f+errs);
  document.body.setAttribute('data-test', log.join('~~'));
})();
