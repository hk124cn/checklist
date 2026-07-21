(function () {
  'use strict';

  var STORE = {
    tasks: 'checklist.tasks.v1',
    completions: 'checklist.completions.v1',
    theme: 'checklist.theme.v1'
  };

  function load(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function todayKey(d) {
    d = d || new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function shiftDay(key, delta) {
    var p = key.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    d.setDate(d.getDate() + delta);
    return todayKey(d);
  }
  var WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  var WD = ['日', '一', '二', '三', '四', '五', '六'];

  var state = {
    tasks: load(STORE.tasks, null),
    completions: load(STORE.completions, {}),
    theme: load(STORE.theme, 'light')
  };

  // 当前查看的日期（默认今天；回顾模式下切换到过去/某天）
  var viewDate = todayKey();

  // 首次使用：预置饭后服药任务（每天）
  if (state.tasks === null) {
    state.tasks = [
      { id: uid(), text: '早餐后服药', category: '饭后', schedule: { type: 'everyday' } },
      { id: uid(), text: '午餐后服药', category: '饭后', schedule: { type: 'everyday' } },
      { id: uid(), text: '晚餐后服药', category: '饭后', schedule: { type: 'everyday' } }
    ];
    save(STORE.tasks, state.tasks);
  }

  // ---------- 排程 ----------
  function taskActiveOn(task, key) {
    var s = task.schedule;
    if (!s || s.type === 'everyday' || !s.type) return true;
    var d = new Date(key + 'T00:00:00');
    var dow = d.getDay();
    if (s.type === 'weekdays') return !!(s.weekdays && s.weekdays.indexOf(dow) !== -1);
    if (s.type === 'dates') return !!(s.dates && s.dates.indexOf(key) !== -1);
    return true;
  }
  function activeTasks(key) {
    return state.tasks.filter(function (t) { return taskActiveOn(t, key); });
  }
  function scheduleLabel(t) {
    var s = t.schedule;
    if (!s || s.type === 'everyday' || !s.type) return '每天';
    if (s.type === 'weekdays') {
      if (!s.weekdays || !s.weekdays.length) return '每天';
      return '周' + s.weekdays.map(function (d) { return WD[d]; }).join('');
    }
    if (s.type === 'dates') {
      if (s.dates && s.dates.length === 1) {
        var p = s.dates[0].split('-');
        return Number(p[1]) + '/' + Number(p[2]);
      }
      return '指定' + (s.dates ? s.dates.length : 0) + '天';
    }
    return '每天';
  }

  // ---------- 完成度逻辑 ----------
  function dayCompletion(key) {
    return state.completions[key] || {};
  }
  function isDone(key, id) {
    return !!dayCompletion(key)[id];
  }
  function setDone(key, id, val) {
    if (!state.completions[key]) state.completions[key] = {};
    state.completions[key][id] = val;
    save(STORE.completions, state.completions);
  }
  function allDone(key) {
    var act = activeTasks(key);
    if (!act.length) return false;
    var c = dayCompletion(key);
    return act.every(function (t) { return c[t.id]; });
  }
  function dayProgress(key) {
    var act = activeTasks(key);
    var c = dayCompletion(key);
    var done = 0;
    act.forEach(function (t) { if (c[t.id]) done++; });
    return { done: done, total: act.length };
  }
  function computeStreak() {
    var s = 0;
    var t = todayKey();
    if (allDone(t)) s++;
    var d = shiftDay(t, -1);
    var guard = 0;
    while (guard++ < 4000) {
      if (allDone(d)) { s++; d = shiftDay(d, -1); } else break;
    }
    return s;
  }

  // ---------- 渲染 ----------
  var $ = function (id) { return document.getElementById(id); };

  function renderDate() {
    var d = new Date();
    $('dateLine').textContent =
      d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + WEEK[d.getDay()];
  }

  function renderProgress() {
    var p = dayProgress(viewDate);
    $('doneCount').textContent = p.done;
    $('totalCount').textContent = p.total;
    var pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
    $('pctText').textContent = pct + '%';
    $('barFill').style.width = pct + '%';
    $('streakNum').textContent = computeStreak();
    $('progressLabel').textContent = (viewDate === todayKey()) ? '今日已完成' : '该日已完成';
  }

  function renderSuggest() {
    var el = $('suggest');
    if (viewDate !== todayKey()) { el.classList.remove('show'); return; }
    var txt = $('suggestText');
    var h = new Date().getHours();
    var meal = null;
    if (h < 10) meal = '早餐';
    else if (h < 14) meal = '午餐';
    else if (h < 20) meal = '晚餐';
    if (!meal) { el.classList.remove('show'); return; }
    var key = todayKey();
    var hit = activeTasks(key).filter(function (t) {
      return t.text.indexOf(meal) !== -1 && t.text.indexOf('药') !== -1 && !isDone(key, t.id);
    });
    if (hit.length) {
      txt.textContent = '现在该吃' + meal + '后的药了，记得打勾 ✓';
      el.classList.add('show');
    } else {
      el.classList.remove('show');
    }
  }

  function renderGroups() {
    var box = $('groups');
    box.innerHTML = '';
    var act = activeTasks(viewDate);
    if (!act.length) {
      box.innerHTML = '<div class="empty">这一天没有安排的任务。</div>';
      return;
    }
    var key = viewDate;
    var order = [];
    var map = {};
    act.forEach(function (t) {
      var c = t.category || '日常';
      if (!map[c]) { map[c] = []; order.push(c); }
      map[c].push(t);
    });
    order.forEach(function (c) {
      var title = document.createElement('div');
      title.className = 'group-title';
      title.textContent = c;
      box.appendChild(title);
      var ul = document.createElement('ul');
      ul.className = 'list';
      map[c].forEach(function (t) {
        var li = document.createElement('li');
        li.className = 'item' + (isDone(key, t.id) ? ' done' : '');
        li.dataset.id = t.id;
        li.innerHTML =
          '<span class="check"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 L10 17.5 L19 7"/></svg></span>' +
          '<span class="label"></span>' +
          '<span class="tag sched"></span>' +
          (t.category ? '<span class="tag cat"></span>' : '') +
          '<button class="del" title="删除">×</button>';
        li.querySelector('.label').textContent = t.text;
        li.querySelector('.tag.sched').textContent = scheduleLabel(t);
        if (t.category) li.querySelector('.tag.cat').textContent = t.category;
        ul.appendChild(li);
      });
      box.appendChild(ul);
    });
  }

  function renderHistory() {
    var box = $('history');
    box.innerHTML = '';
    var t = todayKey();
    for (var i = 13; i >= 0; i--) {
      var key = shiftDay(t, -i);
      var p = dayProgress(key);
      var wrap = document.createElement('div');
      var d = new Date(key.split('-')[0], Number(key.split('-')[1]) - 1, Number(key.split('-')[2]));
      var ratio = p.total ? p.done / p.total : 0;
      var cls = 'day';
      if (p.total === 0) cls += ' none';
      else if (ratio === 1) cls += ' full';
      if (key === viewDate) cls += ' active';
      wrap.className = cls;
      wrap.dataset.key = key;
      wrap.innerHTML =
        '<div class="d">' + (d.getMonth() + 1) + '/' + d.getDate() + '</div>' +
        '<div class="dot"><i style="height:' + Math.round(ratio * 100) + '%"></i></div>';
      box.appendChild(wrap);
    }
  }

  function renderCatList() {
    var dl = $('catList');
    dl.innerHTML = '';
    var seen = {};
    state.tasks.forEach(function (t) {
      if (t.category && !seen[t.category]) {
        seen[t.category] = true;
        var o = document.createElement('option');
        o.value = t.category;
        dl.appendChild(o);
      }
    });
  }

  function updateReviewBanner() {
    var banner = $('reviewBanner');
    if (viewDate === todayKey()) {
      banner.classList.remove('show');
      $('clearToday').textContent = '清空今日勾选';
      return;
    }
    banner.classList.add('show');
    var p = viewDate.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    $('reviewLabel').textContent = '回顾：' + Number(p[1]) + '月' + Number(p[2]) + '日 ' + WEEK[d.getDay()];
    $('clearToday').textContent = '清空该日勾选';
  }

  function renderAll() {
    renderDate();
    renderProgress();
    renderSuggest();
    renderGroups();
    renderHistory();
    renderCatList();
    updateReviewBanner();
  }

  // ---------- 交互 ----------
  $('groups').addEventListener('click', function (e) {
    var li = e.target.closest('li.item');
    if (!li) return;
    var id = li.dataset.id;
    if (e.target.closest('.del')) {
      if (confirm('确定删除这件任务？')) {
        state.tasks = state.tasks.filter(function (t) { return t.id !== id; });
        save(STORE.tasks, state.tasks);
        renderAll();
      }
      return;
    }
    var key = viewDate;
    var now = !isDone(key, id);
    setDone(key, id, now);
    if (now) li.classList.add('done'); else li.classList.remove('done');
    renderProgress();
    renderSuggest();
    renderHistory();
    if (now && allDone(key)) toast('这一天全部完成 🎉');
  });

  function buildSchedule() {
    var t = $('newSched').value;
    if (t === 'weekdays') {
      var ds = [];
      document.querySelectorAll('#schedWeekdays .wd.on').forEach(function (b) { ds.push(Number(b.dataset.dow)); });
      if (!ds.length) return { type: 'everyday' };
      return { type: 'weekdays', weekdays: ds };
    }
    if (t === 'dates') {
      var v = $('schedDate').value;
      if (!v) return { type: 'everyday' };
      return { type: 'dates', dates: [v] };
    }
    return { type: 'everyday' };
  }
  function resetSchedUI() {
    $('newSched').value = 'everyday';
    $('schedWeekdays').hidden = true;
    $('schedDate').hidden = true;
    document.querySelectorAll('#schedWeekdays .wd.on').forEach(function (b) { b.classList.remove('on'); });
  }

  function addTask() {
    var text = $('newTask').value.trim();
    if (!text) return;
    var cat = $('newCat').value.trim() || '日常';
    state.tasks.push({ id: uid(), text: text, category: cat, schedule: buildSchedule() });
    save(STORE.tasks, state.tasks);
    $('newTask').value = '';
    $('newCat').value = '';
    resetSchedUI();
    $('newTask').focus();
    renderAll();
  }
  $('addBtn').addEventListener('click', addTask);
  $('newTask').addEventListener('keydown', function (e) { if (e.key === 'Enter') addTask(); });
  $('newCat').addEventListener('keydown', function (e) { if (e.key === 'Enter') addTask(); });

  $('newSched').addEventListener('change', function () {
    var v = this.value;
    $('schedWeekdays').hidden = v !== 'weekdays';
    $('schedDate').hidden = v !== 'dates';
  });
  document.querySelectorAll('#schedWeekdays .wd').forEach(function (b) {
    b.addEventListener('click', function () { b.classList.toggle('on'); });
  });

  $('history').addEventListener('click', function (e) {
    var day = e.target.closest('.day');
    if (!day || !day.dataset.key) return;
    viewDate = day.dataset.key;
    renderAll();
  });

  $('prevDay').addEventListener('click', function () { viewDate = shiftDay(viewDate, -1); renderAll(); });
  $('nextDay').addEventListener('click', function () {
    var nd = shiftDay(viewDate, 1);
    if (nd <= todayKey()) { viewDate = nd; renderAll(); }
  });
  $('backToday').addEventListener('click', function () { viewDate = todayKey(); renderAll(); });

  $('clearToday').addEventListener('click', function () {
    var label = (viewDate === todayKey()) ? '今日' : '该日';
    if (confirm('清空' + label + '的勾选？任务会保留，之后可重新打勾。')) {
      delete state.completions[viewDate];
      save(STORE.completions, state.completions);
      renderAll();
      toast(label + '勾选已清空');
    }
  });

  $('resetAll').addEventListener('click', function () {
    if (confirm('确定清空全部任务并重置所有记录？此操作不可恢复。')) {
      state.tasks = [];
      state.completions = {};
      save(STORE.tasks, state.tasks);
      save(STORE.completions, state.completions);
      renderAll();
      toast('已重置');
    }
  });

  var toastTimer;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1800);
  }

  // 主题
  function applyTheme() {
    if (state.theme === 'dark') {
      document.body.classList.add('dark');
      $('themeToggle').textContent = '☀️';
    } else {
      document.body.classList.remove('dark');
      $('themeToggle').textContent = '🌙';
    }
  }
  $('themeToggle').addEventListener('click', function () {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    save(STORE.theme, state.theme);
    applyTheme();
  });

  // 跨天自动刷新（停留在页面时，过了午夜重新加载当日状态）
  var lastDay = todayKey();
  setInterval(function () {
    var t = todayKey();
    if (t !== lastDay) {
      lastDay = t;
      if (viewDate === lastDay) renderAll();
      else { renderHistory(); renderProgress(); }
    }
  }, 30000);

  // 备份导出 / 导入：数据只留在你自己的设备/云盘，不上传、不进仓库
  function exportBackup() {
    var data = {
      app: 'daily-checklist',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        tasks: state.tasks,
        completions: state.completions,
        theme: state.theme
      }
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var d = new Date();
    var name = '完成清单备份-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '.json';
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('已导出备份，请存到手机/云盘');
  }
  function importBackup(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        var d = parsed && parsed.data ? parsed.data : parsed;
        if (!d || !Array.isArray(d.tasks)) throw new Error('不是有效的备份文件');
        if (!confirm('导入备份会覆盖当前数据，确定继续？')) return;
        state.tasks = d.tasks;
        state.completions = d.completions || {};
        state.theme = d.theme || 'light';
        save(STORE.tasks, state.tasks);
        save(STORE.completions, state.completions);
        save(STORE.theme, state.theme);
        applyTheme();
        renderAll();
        toast('备份已导入恢复');
      } catch (e) {
        alert('备份文件无法识别：' + e.message);
      }
    };
    reader.readAsText(file);
  }
  $('exportBtn').addEventListener('click', exportBackup);
  $('importBtn').addEventListener('click', function () { $('importFile').click(); });
  $('importFile').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    if (f) importBackup(f);
    e.target.value = '';
  });

  applyTheme();
  renderAll();

  // PWA service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    });
  }
})();
