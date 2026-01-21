// Школа 1430 — Этап 3 (FIX5): стабильный запуск без зависания
(() => {
  // --- маленькие помощники ---
  const $ = (id) => document.getElementById(id);
  // Глобальные (внутри файла) ссылки, чтобы ими могли пользоваться методы игры
  let DIFF;
  let examHud;
  let EXAM_BOSSES;
  const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
  const rectsOverlap = (a,b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  // --- безопасный показ меню (если что-то сломалось) ---
  function showMenuSafely(){
    try{
      const loading = $("screen-loading");
      const menu = $("screen-menu");
      const about = $("screen-about");
      const game = $("screen-game");
      if(loading) loading.classList.add("hidden");
      if(about) about.classList.add("hidden");
      if(game) game.classList.add("hidden");
      if(menu) menu.classList.remove("hidden");
    }catch(_){}
  }

  // Если вообще случится JS-ошибка — не зависаем на загрузке.
  window.addEventListener("error", (e) => {
    console.error(e?.error || e);
    try{
      const msg = (e && e.error && e.error.message) ? e.error.message : "Неизвестная ошибка";
      const dbg = document.getElementById("hud-debug");
      if(dbg) dbg.textContent = "Ошибка: " + msg;

      // Если ошибка произошла на экране загрузки — гарантируем переход в меню
      const loading = document.getElementById("screen-loading");
      if(loading && !loading.classList.contains("hidden")){
        showMenuSafely();
      }
    }catch(_){}
  });

  // Фолбэк-таймер: даже если init не сработал — через 6 секунд меню обязано появиться.
  setTimeout(showMenuSafely, 6000);

  function init(){
    const screens = {
      loading: $("screen-loading"),
      menu: $("screen-menu"),
      about: $("screen-about"),
      game: $("screen-game"),
      // Экран настроек
      settings: $("screen-settings"),
    };

    if(!screens.loading || !screens.menu || !screens.about || !screens.game){
      // Если по какой-то причине элементы не нашли — показать меню.
      showMenuSafely();
      return;
    }

    function show(name){
      for(const k of Object.keys(screens)){
        screens[k].classList.toggle("hidden", k !== name);
      }
    }

    // --- модалка ---
    const modal = {
      root: $("modal"),
      title: $("modal-title"),
      text: $("modal-text"),
      ok: $("modal-ok"),
      open(t, txt){
        modal.title.textContent = t;
        modal.text.textContent = txt;
        modal.root.classList.remove("hidden");
        game.input.locked = true;
      },
      close(){
        modal.root.classList.add("hidden");
        // Не разблокируем управление, если открыта библиотека
        const shopEl = document.getElementById("shop");
        if(!shopEl || shopEl.classList.contains("hidden")){
          game.input.locked = false;
        }
      }
    };


    // === ПРОГРЕСС (localStorage) ===
    const STORE_KEY = "school1430_progress_v1";
    
function normalizeSubject(s){
  const m = {
    rus:"russian", ru:"russian", russian:"russian",
    math:"math",
    physics:"physics", phys:"physics",
    history:"history", hist:"history",
    cs:"cs", inf:"cs", info:"cs", it:"cs",
    chemistry:"chemistry", chem:"chemistry",
    gym:"gym", pe:"gym", sport:"gym",
    // Новые предметы: биология и география
    biology:"biology", bio:"biology",
    geography:"geography", geo:"geography",
    exam:"exam"
  };
  return m[s] || s;
}

// Значения прогресса по умолчанию. Добавлены новые улучшения speed и jump для прокачки героя.
// Добавляем блок settings для сохранения пользовательских настроек
const defaultProgress = {
  knowledge: 10,
  upgrades: { tries:0, time:0, hint:0, bonus:0, speed:0, jump:0 },
  // Настройки пользователя: режим управления (gestures или buttons) и порог свайпа
  settings: { control: "gestures", swipeThresh: 24 }
};

    function loadProgress(){
      try{
        const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
        if(!raw) return JSON.parse(JSON.stringify(defaultProgress));
        // Мягкое объединение, чтобы не ломалось при обновлениях
        const p = JSON.parse(JSON.stringify(defaultProgress));
        if(typeof raw.knowledge === "number") p.knowledge = raw.knowledge;
        if(raw.upgrades && typeof raw.upgrades === "object"){
          for(const k of Object.keys(p.upgrades)){
            if(typeof raw.upgrades[k] === "number") p.upgrades[k] = raw.upgrades[k];
          }
        }

        // Загружаем пользовательские настройки, если есть
        if(raw.settings && typeof raw.settings === "object"){
          if(typeof raw.settings.control === "string") p.settings.control = raw.settings.control;
          if(typeof raw.settings.swipeThresh === "number") p.settings.swipeThresh = raw.settings.swipeThresh;
        }
        
        if(raw.defeated && typeof raw.defeated === "object") p.defeated = raw.defeated;
        if(raw.completedLevels && typeof raw.completedLevels === "object") p.completedLevels = raw.completedLevels;
        if(raw.achievements && typeof raw.achievements === "object") p.achievements = raw.achievements;
        if(raw.levelDifficulty && typeof raw.levelDifficulty === "object") p.levelDifficulty = raw.levelDifficulty;
return p;
      }catch(e){
        return JSON.parse(JSON.stringify(defaultProgress));
      }
    }
    function saveProgress(p){ localStorage.setItem(STORE_KEY, JSON.stringify(p)); }


    function unlockAchievement(key, title){
      if(!progress.achievements) progress.achievements = {};
      if(progress.achievements[key]) return false;
      progress.achievements[key] = { title, ts: Date.now() };
      saveProgress(progress);
      modal.open("🏅 Достижение!", title);
      return true;
    }

    let progress = loadProgress();
    // Характеристики игрока (speed/jump) применяются при старте игры через refreshPlayerStats()

    // Визуальное переключение режима управления (кнопки/жесты)
    function applyControlModeUI(mode){
      try{
        document.body.classList.toggle('touch-mode-buttons', mode === 'buttons');
        document.body.classList.toggle('touch-mode-gestures', mode === 'gestures');
      }catch(_){ }
    }
    // Применяем режим управления из сохранения сразу при загрузке
    applyControlModeUI((progress.settings && progress.settings.control) || defaultProgress.settings.control);

    // ===== Функции работы с настройками =====
    // Обновляет форму настроек на экране настроек, подставляя текущие значения
    function updateSettingsUI(){
      try{
        const mode = (progress.settings && progress.settings.control) || defaultProgress.settings.control;
        const thresh = (progress.settings && typeof progress.settings.swipeThresh === 'number') ? progress.settings.swipeThresh : defaultProgress.settings.swipeThresh;
        const radios = document.querySelectorAll('input[name="control-mode"]');
        radios.forEach(r => { r.checked = (r.value === mode); });
        const slider = document.getElementById('control-threshold');
        const valEl = document.getElementById('control-threshold-val');
        if(slider){
          slider.value = String(thresh);
          if(valEl) valEl.textContent = String(thresh);
        }
      }catch(_){}
    }
    // Сохраняет значения из формы настроек и применяет их к игре
    function saveSettingsFromUI(){
      try{
        const checked = document.querySelector('input[name="control-mode"]:checked');
        const mode = checked ? checked.value : defaultProgress.settings.control;
        const slider = document.getElementById('control-threshold');
        const val = slider ? parseInt(slider.value) : defaultProgress.settings.swipeThresh;
        if(!progress.settings) progress.settings = {};
        progress.settings.control = mode;
        progress.settings.swipeThresh = val;
        saveProgress(progress);
        // применяем настройки к игре
        game.controlMode = mode;
        game.swipeThreshold = val;
        applyControlModeUI(mode);
      }catch(_){}
    }
    // Обновление текста у ползунка чувствительности свайпа
    const thresholdSlider = document.getElementById('control-threshold');
    if(thresholdSlider){
      thresholdSlider.addEventListener('input', (e) => {
        const valEl = document.getElementById('control-threshold-val');
        if(valEl) valEl.textContent = e.target.value;
      });
    }

    function totalUpg(){
      const u = (progress && progress.upgrades) ? progress.upgrades : {};
      return ((u.tries||0) + (u.time||0) + (u.hint||0) + (u.bonus||0) + (u.speed||0) + (u.jump||0));
    }

    function updateHUD(){
      const hk = document.getElementById("hud-knowledge");
      const hu = document.getElementById("hud-upg");
      const sk = document.getElementById("shop-knowledge");
      if(hk) hk.textContent = String(progress.knowledge);
      if(hu) hu.textContent = String(totalUpg());
      if(sk) sk.textContent = String(progress.knowledge);

      // Обновляем индикатор прогресса по предметам: сколько кабинетов пройдено
      const pValEl = document.getElementById('hud-progress-val');
      if(pValEl){
        const subjects = ['math','russian','history','physics','cs','chemistry','gym','biology','geography'];
        let doneCount = 0;
        for(const s of subjects){
          const norm = normalizeSubject(s);
          if(progress.completedLevels && progress.completedLevels[norm]) doneCount++;
        }
        const pct = Math.round((doneCount / subjects.length) * 100);
        pValEl.textContent = pct + '%';
      }
    }

    // === БИБЛИОТЕКА (магазин) ===
    const shop = document.getElementById("shop");
    const shopClose = document.getElementById("shop-close");
    const shopReset = document.getElementById("shop-reset");

    function openShop(){
      updateHUD();
      if(shop){
        shop.classList.remove("hidden");
        game.input.locked = true;
      }
    }
    function closeShop(){
      if(shop){
        shop.classList.add("hidden");
        game.input.locked = false;
      }
    }

    if(shopClose) shopClose.addEventListener("click", closeShop);
    if(shop) shop.addEventListener("click", (e)=>{ if(e.target === shop) closeShop(); });

    // Покупки
    if(shop){
      shop.querySelectorAll("[data-buy]").forEach((btn)=>{
        btn.addEventListener("click", ()=>{
          const type = btn.getAttribute("data-buy");
          // Стоимость улучшений: стандартные улучшения стоят 5, бонус 10, а новые улучшения speed и jump – 8
          let cost;
          if(type === "bonus"){
            cost = 10;
          } else if(type === "speed" || type === "jump"){
            cost = 8;
          } else {
            cost = 5;
          }

          if(progress.knowledge < cost){
            modal.open("❗ Не хватает знаний", "Нужно больше знаний. Пройди уровни и возвращайся 🙂");
            return;
          }

          progress.knowledge -= cost;
          progress.upgrades[type] = (progress.upgrades[type] || 0) + 1;
          saveProgress(progress);
          updateHUD();
          // После покупки обновляем характеристики игрока (скорость и высоту прыжка)
          if(typeof refreshPlayerStats === "function") refreshPlayerStats();
        unlockAchievement('first_buy','Первая покупка в библиотеке! 📚');
          modal.open("✅ Куплено!", "Отлично! Улучшение сохранено и будет работать на уровнях.");
        });
      });
    }

    // Сброс прогресса (для тестов)
    if(shopReset) shopReset.addEventListener("click", ()=>{
      if(confirm("Сбросить знания и улучшения?")){
        localStorage.removeItem(STORE_KEY);
        const fresh = loadProgress();
        progress.knowledge = fresh.knowledge;
        progress.upgrades = fresh.upgrades;
        saveProgress(progress);
        updateHUD();
        // После сброса прогресса возвращаем базовые характеристики игрока
        if(typeof refreshPlayerStats === "function") refreshPlayerStats();
      }
    });

    /**
     * Обновляет характеристики игрока (скорость и высоту прыжка) на основе купленных улучшений.
     * Базовые значения: скорость 320 px/сек, высота прыжка 560 px/сек.
     * Каждое улучшение "speed" добавляет +50 к скорости, каждое улучшение "jump" добавляет +80 к прыжку.
     */
    function refreshPlayerStats(){
      try{
        const baseSpeed = 320;
        const baseJump = 560;
        const u = progress && progress.upgrades ? progress.upgrades : {};
        const speedBonus = (u.speed || 0) * 50;
        const jumpBonus = (u.jump || 0) * 80;
        if(game && game.player){
          game.player.speed = baseSpeed + speedBonus;
          game.player.jumpV = baseJump + jumpBonus;
        }
      }catch(_){/* nothing */}
    }

        
    // === УРОВНИ (Этап 5) ===
    // Храним: какие уровни пройдены и какие враги побеждены.
    if(!progress.completedLevels) progress.completedLevels = {};
    if(!progress.defeated) progress.defeated = {}; // { levelId: { enemyId:true } }

    function isDefeated(levelId, enemyId){
      return !!(progress.defeated[levelId] && progress.defeated[levelId][enemyId]);
    }
    function setDefeated(levelId, enemyId){
      if(!progress.defeated) progress.defeated = {};
      if(!progress.defeated[levelId]) progress.defeated[levelId] = {};
      progress.defeated[levelId][enemyId] = true;
      saveProgress(progress);
      updateHUD();
    }

    function addKnowledge(base){
      const bonusPct = (progress.upgrades.bonus || 0) * 0.10; // +10% за покупку
      const add = Math.round(base * (1 + bonusPct));
      progress.knowledge += add;
      saveProgress(progress);
      updateHUD();
      // Создаём визуальный эффект: всплывающая надпись с прибавкой знаний
      try{
        if(game && game.effects){
          // Помещаем текст чуть выше головы героя
          const px = game.player.x + game.player.w/2;
          const py = game.player.y - 20;
          game.effects.push({ x: px, y: py, text: '+' + add, ttl: 1.5 });
        }
      }catch(_){/* ignore if game is not ready */}
      return add;
    }

    // === ЭКЗАМЕН (Этап 7) ===
    examHud = {
      root: document.getElementById("exam-hud"),
      bar: document.getElementById("exam-bar"),
      val: document.getElementById("exam-val"),
      show(){ this.root && this.root.classList.remove("hidden"); },
      hide(){ this.root && this.root.classList.add("hidden"); },
      set(pct){
        const v = Math.max(0, Math.min(100, Math.round(pct)));
        if(this.bar) this.bar.style.width = v + "%";
        if(this.val) this.val.textContent = v + "%";
        // цвет по уровню
        if(this.bar){
          if(v >= 60) this.bar.style.background = "rgba(34,197,94,.85)";
          else if(v >= 30) this.bar.style.background = "rgba(245,158,11,.85)";
          else this.bar.style.background = "rgba(239,68,68,.85)";
        }
      }
    };

    EXAM_BOSSES = [
      {id:"t1", role:"учитель", name:"Учитель математики", series:2},
      {id:"z1", role:"завуч", name:"Завуч", series:3},
      {id:"t2", role:"учитель", name:"Учитель информатики", series:2},
      {id:"boss", role:"директор", name:"Директор школы", series:4},
    ];

    // Квиз UI
    const quiz = {
      root: document.getElementById("quiz"),
      title: document.getElementById("quiz-title"),
      meta: document.getElementById("quiz-meta"),
      q: document.getElementById("quiz-q"),
      opts: document.getElementById("quiz-opts"),
      msg: document.getElementById("quiz-msg"),
      timeEl: document.getElementById("quiz-time"),
      hintBtn: document.getElementById("quiz-hint"),
      closeBtn: document.getElementById("quiz-close"),

      timer: null,
      timeLeft: 0,
      attemptsLeft: 0,
      hintLeft: 0,
      correctIndex: 0,
      locked: false,
      onWin: null,
      onFail: null,
      seriesLeft: 1,
      makeNext: null,

      open(payload){
        // payload: {title, question, options, correct, difficulty, onWin}
        this.locked = false;
        this.onWin = payload.onWin || null;
        this.onFail = payload.onFail || null;

        // ВАЖНО: сбрасываем и ставим фабрику СРАЗУ, чтобы не подтягивать старую
        this.makeNext = payload.makeNext || null;

        this.title.textContent = payload.title;

        // Если это серия — берём вопрос из фабрики, иначе из payload
        const first = this.makeNext ? this.makeNext() : {q: payload.question, options: payload.options, correct: payload.correct};

        this.q.textContent = first.q;

        // Параметры с учётом улучшений и сложности уровня
        const mode = payload.mode || "normal";
        const cfg = DIFF[mode] || DIFF.normal;

        const baseAttempts = cfg.baseAttempts;
        const baseTime = cfg.baseTime;
        const baseHints = 0;

        this.attemptsLeft = baseAttempts + (progress.upgrades.tries||0);
        this.timeLeft = baseTime + (progress.upgrades.time||0)*5;
        this.hintLeft = baseHints + (progress.upgrades.hint||0);

        // Серия вопросов (сколько правильных ответов нужно)
        this.seriesLeft = Math.max(1, payload.seriesLeft || 1);
        this.makeNext = payload.makeNext || null;
        this.correctIndex = first.correct;
        this.msg.textContent = "";
        this.opts.innerHTML = "";

        first.options.forEach((txt, i)=>{
          const b = document.createElement("button");
          b.className = "quiz__opt";
          b.textContent = txt;
          b.addEventListener("click", ()=>this.pick(i, b));
          this.opts.appendChild(b);
        });

        this.updateMeta();
        this.updateTime();

        // Кнопка подсказки
        this.hintBtn.disabled = (this.hintLeft <= 0);
        this.hintBtn.textContent = this.hintLeft>0 ? `💡 Подсказка (${this.hintLeft})` : "💡 Подсказка";
        this.hintBtn.onclick = ()=>{
          const cur = Array.from(this.opts.querySelectorAll('button')).map(b=>b.textContent);
          this.useHint(cur);
        };

        this.closeBtn.onclick = ()=>this.close();
        this.root.classList.remove("hidden");
        game.input.locked = true;

        // Таймер
        if(this.timer) clearInterval(this.timer);
        this.timer = setInterval(()=>{
          if(this.locked) return;
          this.timeLeft -= 1;
          this.updateTime();
          if(this.timeLeft <= 0){
            this.fail("Время вышло ⏱");
          }
        }, 1000);
      },

      updateMeta(){
        const s = (this.seriesLeft && this.seriesLeft>1) ? ` · В серии осталось: ${this.seriesLeft}` : (this.seriesLeft===1 && this.makeNext ? ` · Осталось: 1` : "");
        this.meta.textContent = `Попытки: ${this.attemptsLeft} · Время: ${this.timeLeft}с${s}`;
      },
      updateTime(){
        this.timeEl.textContent = String(Math.max(0, this.timeLeft));
        this.updateMeta();
      },

      useHint(options){
        if(this.locked) return;
        if(this.hintLeft <= 0) return;

        // Убираем 1 неправильный вариант (делаем кнопку disabled)
        const buttons = Array.from(this.opts.querySelectorAll("button"));
        const wrong = buttons
          .map((b, i)=>({b,i}))
          .filter(x => x.i !== this.correctIndex && !x.b.classList.contains("disabled"));
        if(wrong.length === 0) return;

        const pick = wrong[Math.floor(Math.random()*wrong.length)];
        pick.b.classList.add("disabled");
        pick.b.disabled = true;

        this.hintLeft -= 1;
        this.hintBtn.disabled = (this.hintLeft <= 0);
        this.hintBtn.textContent = this.hintLeft>0 ? `💡 Подсказка (${this.hintLeft})` : "💡 Подсказка";
        this.msg.textContent = "Подсказка: один неправильный вариант убран 🙂";
      },

      pick(i, btn){
        if(this.locked) return;

        if(i === this.correctIndex){
          this.locked = true;
          btn.classList.add("good");
          this.msg.textContent = "✅ Правильно!";
          this.seriesLeft -= 1;

          setTimeout(()=>{
            if(this.seriesLeft > 0 && this.makeNext){
              // Следующий вопрос в серии
              this.locked = false;
              this.msg.textContent = `👍 Отлично! Осталось вопросов: ${this.seriesLeft}`;
              // Пересобираем варианты
              const next = this.makeNext();
              this.q.textContent = next.q;
              this.correctIndex = next.correct;
              this.opts.innerHTML = "";
              if(!next || !Array.isArray(next.options)){
                this.close(false);
                return;
              }
              next.options.forEach((txt, i)=>{
                const b = document.createElement("button");
                b.className = "quiz__opt";
                b.textContent = txt;
                b.addEventListener("click", ()=>this.pick(i, b));
                this.opts.appendChild(b);
              });
              // Сброс подсказок на следующий вопрос (честно: подсказки общие, не возвращаем)
              this.updateMeta();
            } else {
              this.close(true);
            }
          }, 450);
        } else {
          btn.classList.add("bad");
          this.attemptsLeft -= 1;
          if(this.attemptsLeft <= 0){
            this.fail("Попытки закончились 😅");
          } else {
            this.msg.textContent = "❌ Неправильно. Попробуй ещё раз!";
            this.updateMeta();
          }
        }
      },

      fail(reason){
        this.locked = true;
        this.msg.textContent = `❌ ${reason} (враг остаётся на месте)`;
        setTimeout(()=>{ this.close(false); if(typeof this.onFail==='function') this.onFail(); }, 700);
      },

      close(won=false){
        if(this.timer){ clearInterval(this.timer); this.timer = null; }
        this.root.classList.add("hidden");

        // Не разблокируем, если открыта библиотека
        const shopEl = document.getElementById("shop");
        if(!shopEl || shopEl.classList.contains("hidden")){
          game.input.locked = false;
        }

        if(won && typeof this.onWin === "function"){
          this.onWin();
        }
      }
    };

    // Вопросы по предметам (пока один уровень: Математика)
    
    const QUESTIONS = window.QUESTIONS || {};


    
    // Настройки сложности (Этап 6)
    DIFF = {
      easy:   { baseAttempts: 2, baseTime: 14, extraQuestions: 0, label:"Легко" },
      normal: { baseAttempts: 1, baseTime: 10, extraQuestions: 0, label:"Нормально" },
      hard:   { baseAttempts: 1, baseTime: 8,  extraQuestions: 1, label:"Сложно" },
    };

    // Окно выбора сложности
    const diffUI = {
      root: document.getElementById("difficulty"),
      cancel: document.getElementById("diff-cancel"),
      pendingDoor: null, // объект двери, на которую нажали

      open(doorObj){
        this.pendingDoor = doorObj;
        this.root.classList.remove("hidden");
        game.input.locked = true;
      },
      close(){
        this.root.classList.add("hidden");
        // не разблокируем, если открыта библиотека/квиз
        const shopEl = document.getElementById("shop");
        const quizEl = document.getElementById("quiz");
        if((!shopEl || shopEl.classList.contains("hidden")) && (!quizEl || quizEl.classList.contains("hidden"))){
          game.input.locked = false;
        }
      }
    };

    if(diffUI.cancel) diffUI.cancel.addEventListener("click", ()=>diffUI.close());
    if(diffUI.root) diffUI.root.addEventListener("click", (e)=>{ if(e.target === diffUI.root) diffUI.close(); });

    if(diffUI.root){
      diffUI.root.querySelectorAll("[data-diff]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const d = btn.getAttribute("data-diff");
          const door = diffUI.pendingDoor;
          diffUI.close();
          if(!door) return;

          // Сохраняем выбранную сложность (на будущее)
          if(!progress.levelDifficulty) progress.levelDifficulty = {};
          progress.levelDifficulty[door.subject] = d;
          saveProgress(progress);

          // Загружаем уровень
          game.loadLevel(door.subject, d);
        });
      });
    }
function pickQuestion(subject, difficulty){
      const pool = QUESTIONS[subject][difficulty];
      return pool[Math.floor(Math.random()*pool.length)];
    }
// --- переходы экранов ---
    show("loading");
    setTimeout(() => show("menu"), 5000);

    $("btn-about").addEventListener("click", () => show("about"));
    $("btn-back").addEventListener("click", () => show("menu"));

    $("btn-start").addEventListener("click", () => {
      show("game");
      updateHUD();
      game.start();
    });

    // === Настройки ===
    // Кнопка «Настройки» в меню
    const btnSettings = $("btn-settings");
    if(btnSettings){
      btnSettings.addEventListener("click", () => {
        updateSettingsUI();
        show("settings");
      });
    }
    // Сохранить настройки и вернуться в меню
    const btnSettingsSave = $("btn-settings-save");
    if(btnSettingsSave){
      btnSettingsSave.addEventListener("click", () => {
        saveSettingsFromUI();
        show("menu");
      });
    }
    // Вернуться из настроек без сохранения
    const btnSettingsBack = $("btn-settings-back");
    if(btnSettingsBack){
      btnSettingsBack.addEventListener("click", () => {
        show("menu");
      });
    }

    $("btn-exit-to-menu").addEventListener("click", () => {
      closeShop();
      game.stop();
      show("menu");
    });

    modal.ok.addEventListener("click", () => modal.close());
    modal.root.addEventListener("click", (e) => { if(e.target === modal.root) modal.close(); });

    // === Окно прогресса (Этап 8) ===
    $("btn-progress")?.addEventListener("click", () => {
      const pm = $("progressModal");
      const body = $("progressBody");
      if(!pm || !body) return;

      const done = Object.keys(progress.completedLevels || {}).filter(k => progress.completedLevels[k]);
      const defeated = progress.defeated ? Object.values(progress.defeated).reduce((acc, map)=>acc + Object.keys(map||{}).length, 0) : 0;
      const ach = progress.achievements || {};
      const achList = Object.keys(ach).map(k => ach[k].title);

      body.innerHTML = [
        `<b>Знания:</b> ${progress.knowledge}`,
        `<b>Улучшения:</b> попытки +${progress.upgrades.tries||0}, время +${(progress.upgrades.time||0)*5}с, подсказки +${progress.upgrades.hint||0}, бонус +${(progress.upgrades.bonus||0)*10}%`,
        `<b>Побеждено противников:</b> ${defeated}`,
        `<b>Пройдено уровней:</b> ${done.length ? done.join(", ") : "пока нет"}`,
        `<b>Достижения:</b> ${achList.length ? achList.map(x=>`• ${x}`).join("<br>") : "пока нет"}`
      ].join("<br><br>");

      pm.classList.remove("hidden");
    });

    $("btn-progress-close")?.addEventListener("click", ()=>$("progressModal")?.classList.add("hidden"));
    $("progressModal")?.addEventListener("click", (e)=>{ if(e.target === $("progressModal")) $("progressModal").classList.add("hidden"); });

    $("btn-progress-reset")?.addEventListener("click", ()=>{
      localStorage.removeItem("school1430_progress_v1");
      progress = loadProgress();
      if(!progress.achievements) progress.achievements = {};
      updateHUD();
      // После сброса прогресса возвращаем базовые характеристики героя
      if(typeof refreshPlayerStats === "function") refreshPlayerStats();
      $("progressModal")?.classList.add("hidden");
      modal.open("Сброс", "Прогресс сброшен. Можно начинать заново 🙂");
    });


    // --- canvas / resize ---
    const canvas = $("game");
    const ctx = canvas.getContext("2d");
    const DPR = () => Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    // --- ассеты (спрайты) ---
    const ASSETS = {
      playerSheet: {
        img: new Image(),
        loaded: false,
        tileW: 72,
        tileH: 72,
        frames: { idle:[0,1], walk:[2,3,4,5], jump:6, fall:7 }
      }
    };
    ASSETS.playerSheet.img.onload = () => { ASSETS.playerSheet.loaded = true; };
    ASSETS.playerSheet.img.onerror = (e) => { console.warn('Не удалось загрузить ассет игрока', e); };
    ASSETS.playerSheet.img.src = 'assets/player_sheet.png';


    function resizeCanvas(){
      const dpr = DPR();
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener("resize", resizeCanvas);

    // --- игра ---
    const game = {
      running:false, raf:0, lastT:0,
      // Добавляем константу g для гравитации. Это устраняет ошибку, когда в AI врагов
      // используется this.world.g, которого раньше не существовало (вызывало NaN).
      world:{ w:3200, h:720, groundY:520, g:1400 },
      camera:{ x:0 },
      input:{
        left:false,
        right:false,
        // Аналоговая ось для сенсорного управления (джойстик/перетаскивание)
        axisX:0,
        axisXTarget:0,
        usingAnalog:false,
        // Сигналы действий (сбрасываются кадр за кадром)
        jumpPressed:false,
        actPressed:false,
        // Буфер прыжка для отзывчивого управления
        jumpBuffer:0,
        locked:false
      },
      player:{ x:120, y:0, w:44, h:60, vx:0, vy:0, speed:320, jumpV:560, onGround:false, face:1,
        // Таймер «кёйот-тайма»: позволяет прыгнуть чуть позже схода с платформы
        coyote:0,
        // Анимация спрайта
        animT:0,
        animFrame:0,
        animState:'idle',
        renderBob:0
      },
      objects:[],
      platforms:[],

      // Эффекты для визуального отображения (например, всплывающие очки знаний).
      // Каждый объект: {x,y,text,ttl}. ttl — время жизни в секундах.
      effects:[],

      // Время, оставшееся до конца уровня (в секундах). Когда null, таймер отключён.
      levelTime: null,

      // Настройки управления: читаем из progress.settings. Если нет, используем значения по умолчанию.
      controlMode: (typeof progress !== 'undefined' && progress.settings && progress.settings.control) || "gestures",
      swipeThreshold: (typeof progress !== 'undefined' && progress.settings && typeof progress.settings.swipeThresh === 'number' ? progress.settings.swipeThresh : 24),

      start(){
        resizeCanvas();
        // Применяем купленные улучшения (скорость/прыжок) при каждом запуске игры
        if(typeof refreshPlayerStats === "function") refreshPlayerStats();
        this.resetWorld();
        this.running = true;
        this.lastT = performance.now();
        this.loop(this.lastT);
      },
      stop(){
        this.running = false;
        cancelAnimationFrame(this.raf);
      },
      resetWorld(){
        // По умолчанию запускаем ХАБ
        this.loadHub();
      },

      loadHub(){
        this.mode = "hub";
        this.levelMode = "normal";
        examHud.hide();
        this.levelId = null;

        // Сбрасываем таймер уровня и скрываем его
        this.levelTime = null;
        const timerEl = document.getElementById('hud-timer');
        if(timerEl) timerEl.classList.add('hidden');
        const badge = document.querySelector(".badge");
        if(badge) badge.textContent = "Хаб: школьный коридор";
        $("hud-tip").innerHTML = "Подойди к объекту и нажми <b>E</b>/<b>У</b> (или ✋). Библиотека — для улучшений.";

        this.world.w = 3200;
        this.world.groundY = 520;

        this.platforms = [
          {x:0, y:this.world.groundY, w:this.world.w, h:200},
          {x:760, y:this.world.groundY-80, w:180, h:18},
          {x:1280, y:this.world.groundY-120, w:240, h:18},
          {x:2050, y:this.world.groundY-90, w:160, h:18},
        ];

        // === Дополнительный этаж и лифт ===
        // Организуем второй уровень хаба: второй этаж располагается выше на 200 пикселей. На нём будут новые кабинеты.
        const secondFloorY = this.world.groundY - 200;
        // Длинная платформа второго этажа по всей ширине мира
        this.platforms.push({ x: 0, y: secondFloorY, w: this.world.w, h: 18 });
        // Лифт — движущаяся платформа, которая поднимает игрока на второй этаж. Начинается у земли и движется вверх/вниз на 200px.
        this.platforms.push({ x: 200, y: this.world.groundY - 18, w: 60, h: 18, move:{ axis:'y', range: 200, speed: 50 } });

        // NPC/двери/библиотека.
        // Каждому npc в коридоре добавляем параметр move, чтобы они ходили туда-сюда и коридор выглядел живым.
        this.objects = [
          {type:"library", x:300, y:this.world.groundY-150, w:120, h:150,
            text:"Это библиотека! Тут можно покупать улучшения 🙂"},
          {type:"npc", role:"одноклассник", name:"Маша", x:520, y:this.world.groundY-60, w:46, h:60,
            text:"Привет! Пойдём в математику? Там будут вопросы попроще.",
            move:{axis:'x', range:40, speed:30}},

          // Дверь в Математику — уже работает как уровень
          {type:"door", subject:"math", label:"Математика", x:650, y:this.world.groundY-130, w:90, h:130,
            text:"Вход в кабинет: Математика"},

          {type:"npc", role:"одноклассник", name:"Илья", x:980, y:this.world.groundY-60, w:46, h:60,
            text:"Если сомневаешься — выбирай самый логичный ответ 🙂",
            move:{axis:'x', range:60, speed:40}},

          // Дополнительные одноклассники в коридоре для оживления хаба
          {type:"npc", role:"одноклассник", name:"Кирилл", x:380, y:this.world.groundY-60, w:46, h:60,
            text:"Я обожаю биологию! Когда откроется кабинет, обязательно попробуй пройти.",
            move:{axis:'x', range:50, speed:20}},
          {type:"npc", role:"одноклассник", name:"Света", x:720, y:this.world.groundY-60, w:46, h:60,
            text:"Потом загляни в кабинет географии — там очень интересно!",
            move:{axis:'x', range:40, speed:25}},

          // Остальные двери пока «скоро», тексты будут обновлены в зависимости от прогресса
          {type:"door", subject:"rus", label:"Русский язык", x:1120, y:this.world.groundY-130, w:90, h:130,
            text:"Кабинет: Русский язык (скоро)"},
          {type:"npc", role:"учитель", name:"Екатерина Эдуардовна", x:1580, y:this.world.groundY-60, w:54, h:72,
            text:"Вопросы посложнее — но ты справишься!",
            move:{axis:'x', range:30, speed:25}},
          {type:"door", subject:"exam", label:"Экзамен", x:1720, y:this.world.groundY-130, w:90, h:130,
            text:"ФИНАЛ: Экзамен (мини-боссы и директор)"},
          {type:"door", subject:"history", label:"История", x:1860, y:this.world.groundY-130, w:90, h:130,
            text:"Кабинет: История (скоро)"},
          {type:"npc", role:"учитель", name:"Учитель информатики", x:2400, y:this.world.groundY-60, w:54, h:72,
            text:"Информатика — это про логику и аккуратность.",
            move:{axis:'x', range:50, speed:35}},
          {type:"door", subject:"physics", label:"Физика", x:2660, y:this.world.groundY-130, w:90, h:130,
            text:"Кабинет: Физика (скоро)"},

          // ==== Второй этаж: двери и NPC ====
          // Дверь на второй этаж в кабинет информатики. Расположена на высоте второго этажа.
          {type:"door", subject:"cs", label:"Информатика", x:420, y: (this.world.groundY - 200) - 130, w:90, h:130,
            text:"Кабинет: Информатика (скоро)"},
          // Дверь в кабинет химии на втором этаже. Открывается после информатики.
          {type:"door", subject:"chemistry", label:"Химия", x:650, y: (this.world.groundY - 200) - 130, w:90, h:130,
            text:"Кабинет: Химия (скоро)"},
          // Дверь в спортзал (физкультуру) на втором этаже. Открывается после химии.
          {type:"door", subject:"gym", label:"Физкультура", x:900, y: (this.world.groundY - 200) - 130, w:90, h:130,
            text:"Кабинет: Физкультура (скоро)"},
          // Одноклассник на втором этаже, чтобы подсказать игроку про лифт
          {type:"npc", role:"одноклассник", name:"Тимур", x:520, y: (this.world.groundY - 200) - 60, w:46, h:60,
            text:"Информатика на втором этаже! Используй лифт, чтобы подняться.",
            move:{axis:'x', range:40, speed:30}},

          // Новые кабинеты на втором этаже (этап расширения)
          {type:"door", subject:"biology", label:"Биология", x:1150, y:(this.world.groundY - 200) - 130, w:90, h:130,
            text:"Кабинет: Биология (скоро)"},
          {type:"door", subject:"geography", label:"География", x:1400, y:(this.world.groundY - 200) - 130, w:90, h:130,
            text:"Кабинет: География (скоро)"},
          // Ещё один одноклассник на втором этаже, рассказывает о новых кабинетах
          {type:"npc", role:"одноклассник", name:"Лиза", x:1050, y:(this.world.groundY - 200) - 60, w:46, h:60,
            text:"Привет! На втором этаже появились новые кабинеты: биология и география. Пройди их по порядку!",
            move:{axis:'x', range:40, speed:30}},
        ];

        // Динамические изменения хаба на основе пройденных уровней.
        // Если игрок прошёл определённый уровень, обновляем тексты дверей, диалогов, и добавляем новых NPC.
        const completed = progress && progress.completedLevels ? progress.completedLevels : {};

        // Функция для поиска двери по предмету
        const findDoor = (subj) => {
          return this.objects.find(o => o.type === 'door' && normalizeSubject(o.subject) === normalizeSubject(subj));
        };

        // Обновляем реплики у Маши в зависимости от прогресса
        for(const obj of this.objects){
          if(obj.type === 'npc' && obj.name === 'Маша'){
            if(completed.math && !completed.russian){
              obj.text = "Привет! Математика пройдена 🎉 Давай попробуем русский?";
            } else if(completed.math && completed.russian){
              obj.text = "Ты уже прошёл математику и русский! Следующая остановка — история!";
            }
          }
          // Обновляем реплику у Ильи, чтобы он подбадривал игрока
          if(obj.type === 'npc' && obj.name === 'Илья'){
            if(Object.keys(completed).length > 0){
              obj.text = "Отлично! Твои знания растут. Не сдавайся и проходи новые кабинеты!";
            }
          }
          // Учитель информатики – поздравления после прохождения информатики
          if(obj.type === 'npc' && obj.name === 'Учитель информатики'){
            if(completed.cs){
              obj.text = "Поздравляю! Ты покорил информатику. Готов к экзамену?";
            }
          }
        }

        // Математика завершена — открываем русский и добавляем учителя математики
        if(completed.math){
          const doorRus = findDoor('rus');
          if(doorRus){ doorRus.text = "Вход в кабинет: Русский язык"; }
          // добавляем учителя математики в коридор
          this.objects.push({
            type:'npc',
            role:'учитель',
            name:'Учитель математики',
            x:1400,
            y:this.world.groundY-72,
            w:54,
            h:72,
            text:'Молодец! Ты справился с математикой. Теперь попробуй русский язык!',
            move:{axis:'x', range:40, speed:25}
          });
        }

        // Русский завершён — открываем историю и добавляем учителя русского
        if(completed.russian){
          const doorHist = findDoor('history');
          if(doorHist){ doorHist.text = "Вход в кабинет: История"; }
          this.objects.push({
            type:'npc',
            role:'учитель',
            name:'Учитель русского',
            x:1600,
            y:this.world.groundY-72,
            w:60,
            h:80,
            text:'Отличная работа по русскому! История ждёт тебя.',
            move:{axis:'x', range:40, speed:25}
          });
        }

        // История завершена — открываем физику и добавляем учителя истории
        if(completed.history){
          const doorPhys = findDoor('physics');
          if(doorPhys){ doorPhys.text = "Вход в кабинет: Физика"; }
          this.objects.push({
            type:'npc',
            role:'учитель',
            name:'Учитель истории',
            x:1800,
            y:this.world.groundY-72,
            w:60,
            h:80,
            text:'Здорово! История пройдена. Следующая — физика.',
            move:{axis:'x', range:40, speed:25}
          });
        }

        // Физика завершена — открываем информатику и добавляем учителя физики
        if(completed.physics){
          // Открываем дверь на второй этаж в кабинет информатики
          const doorCS = findDoor('cs');
          if(doorCS){ doorCS.text = "Вход в кабинет: Информатика"; }
          this.objects.push({
            type:'npc',
            role:'учитель',
            name:'Учитель физики',
            x:2000,
            y:this.world.groundY-72,
            w:60,
            h:80,
            text:'Поздравляю с прохождением физики! Теперь попробуй свои силы в информатике.',
            move:{axis:'x', range:40, speed:25}
          });
        }

        // Информатика завершена — поздравляем и готовим к экзамену
        if(completed.cs){
          this.objects.push({
            type:'npc',
            role:'учитель',
            name:'Директор',
            x:2200,
            y:this.world.groundY-72,
            w:60,
            h:80,
            text:'Отлично! Все предметы пройдены. Ты готов к экзамену!',
            move:{axis:'x', range:40, speed:25}
          });
        }

        // После прохождения информатики открываем химию
        if(completed.cs){
          const doorChem = findDoor('chemistry');
          if(doorChem){ doorChem.text = 'Вход в кабинет: Химия'; }
        }

        // После прохождения химии открываем спортзал
        if(completed.chemistry){
          const doorGym = findDoor('gym');
          if(doorGym){ doorGym.text = 'Вход в кабинет: Физкультура'; }
          // Добавляем учителя химии, чтобы направить в спортзал
          this.objects.push({
            type:'npc',
            role:'учитель',
            name:'Учитель химии',
            x:2400,
            y:this.world.groundY-72,
            w:60,
            h:80,
            text:'Поздравляю с прохождением химии! Теперь тебя ждёт спортзал.',
            move:{axis:'x', range:40, speed:25}
          });
        }

        // После прохождения спортзала открываем биологию и поздравляем
        if(completed.gym){
          // Обновляем дверь Биологии
          const doorBio = findDoor('biology');
          if(doorBio){ doorBio.text = 'Вход в кабинет: Биология'; }
          // Поздравление от учителя физкультуры и подсказка идти в биологию
          this.objects.push({
            type:'npc',
            role:'учитель',
            name:'Учитель физкультуры',
            x:2500,
            y:this.world.groundY-72,
            w:60,
            h:80,
            text:'Физкультура пройдена! Теперь тебя ждёт Биология на втором этаже.',
            move:{axis:'x', range:40, speed:25}
          });
        }

        // После прохождения биологии открываем географию
        if(completed.biology){
          const doorGeo = findDoor('geography');
          if(doorGeo){ doorGeo.text = 'Вход в кабинет: География'; }
          // Учитель биологии направляет к географии
          this.objects.push({
            type:'npc',
            role:'учитель',
            name:'Учитель биологии',
            x:2700,
            y:this.world.groundY-72,
            w:60,
            h:80,
            text:'Отлично! Биология позади. Следующий кабинет — География.',
            move:{axis:'x', range:40, speed:25}
          });
        }

        // После прохождения географии добавляем учителя географии с финальными пожеланиями
        if(completed.geography){
          this.objects.push({
            type:'npc',
            role:'учитель',
            name:'Учитель географии',
            x:2900,
            y:this.world.groundY-72,
            w:60,
            h:80,
            text:'Молодец! География пройдена. Ты готов к экзамену!',
            move:{axis:'x', range:40, speed:25}
          });
        }

        const p = this.player;
        p.x = 120;
        p.y = this.world.groundY - p.h;
        p.vx = p.vy = 0;
        p.onGround = false;
        this.camera.x = 0;
      },

      loadLevel(levelId, mode){
        // Нормализуем идентификатор уровня, чтобы "rus", "phys" и другие сокращения
        // корректно преобразовывались в полные названия (russian, physics, history, cs, exam).
        levelId = normalizeSubject(levelId);
        this.levelMode = mode || 'normal';
        this.mode = "level";
        this.levelId = levelId;

        // Запускаем таймер уровня: по умолчанию 150 секунд, для экзамена чуть больше
        const baseTime = (levelId === 'exam') ? 200 : 150;
        this.levelTime = baseTime;
        const timerEl = document.getElementById('hud-timer');
        if(timerEl) timerEl.classList.remove('hidden');

        // Пока делаем 1 уровень: math
        if(levelId === "math"){
          const badge = document.querySelector(".badge");
          if(badge) badge.textContent = `Уровень: Математика (${(DIFF[this.levelMode]||DIFF.normal).label})`;
          $("hud-tip").innerHTML = "Победи врагов-вопросы 🙂 Подойди и нажми <b>E</b>/<b>У</b> (или ✋).";

          this.world.w = 2400;
          this.world.groundY = 540;

          this.platforms = [
            {x:0, y:this.world.groundY, w:this.world.w, h:220},

            // Платформы
            {x:260, y:this.world.groundY-90, w:160, h:18},
            {x:540, y:this.world.groundY-150, w:170, h:18},
            {x:860, y:this.world.groundY-110, w:200, h:18},
            {x:1180, y:this.world.groundY-170, w:200, h:18},
            {x:1500, y:this.world.groundY-120, w:180, h:18},
            {x:1820, y:this.world.groundY-90, w:210, h:18},
            // Движущаяся платформа: двигается влево и вправо
            {x:1200, y:this.world.groundY-200, w:140, h:18, move:{axis:'x', range:160, speed:60}},
          ];

          // Враги-вопросы (одноклассник = easy, учитель = hard)
          const enemies = [
            {type:"enemy", id:"m1", difficulty:"easy", role:"одноклассник", name:"Дима", x:520, y:this.world.groundY-60, w:46, h:60, subject:"math"},
            {type:"enemy", id:"m2", difficulty:"hard", role:"учитель", name:"Учитель математики", x:1350, y:this.world.groundY-72, w:54, h:72, subject:"math"},
          ].filter(e => !isDefeated(levelId, e.id));

          this.objects = [
            {type:"exit", x:80, y:this.world.groundY-130, w:90, h:130, label:"Выход", text:"Выход в коридор"},
            ...enemies,
            {type:"decor", x:2100, y:this.world.groundY-220, w:220, h:220, label:"Доска", text:"Математика — это тренировка мозга 🧠"},
            // Коллекционный предмет для математики
            {type:'collectible', id:'math_c1', x:1600, y:this.world.groundY-250, w:26, h:26, value:5},
          ];

          const p = this.player;
          p.x = 140;
          p.y = this.world.groundY - p.h;
          p.vx = p.vy = 0;
          p.onGround = false;
          this.camera.x = 0;
        }

        // Русский язык
        if(levelId === "russian"){
          this.world.w = 2000;
          this.world.groundY = 540;
          this.platforms = [
            {x:0, y:this.world.groundY, w:this.world.w, h:220},
            {x:260, y:this.world.groundY-120, w:240, h:18},
            {x:650, y:this.world.groundY-190, w:240, h:18},
            {x:1050, y:this.world.groundY-150, w:240, h:18},
            {x:1480, y:this.world.groundY-210, w:240, h:18},
            // Движущаяся вертикальная платформа
            {x:800, y:this.world.groundY-220, w:140, h:18, move:{axis:'y', range:100, speed:40}},
          ];
          this.objects = [
            {type:"exit", x:80, y:this.world.groundY-130, w:90, h:130, label:"Выход", text:"Вернуться в коридор"},
            {type:"enemy", id:"ru_s1", difficulty:"easy", role:"одноклассник", name:"Аня", x:740, y:this.world.groundY-72, w:60, h:80, subject:"russian", speed:50},
            {type:"enemy", id:"ru_t1", difficulty:"hard", role:"учитель", name:"Учитель русского", x:1320, y:this.world.groundY-72, w:60, h:80, subject:"russian", speed:50},
            // Коллекционный предмет для русского
            {type:'collectible', id:'rus_c1', x:1700, y:this.world.groundY-260, w:26, h:26, value:5},
          ];
          const p=this.player;
          p.x=140; p.y=this.world.groundY-p.h; p.vx=p.vy=0; p.onGround=false;
          this.camera.x=0;
          const badge=document.querySelector(".badge");
          if(badge) badge.textContent = `Уровень: Русский (${(DIFF[this.levelMode]||DIFF.normal).label})`;
          $("hud-tip").innerHTML = "Русский: отвечай на вопросы 🙂 Победи всех врагов и выйди через «Выход».";
        }

        // История
        if(levelId === "history"){
          this.world.w = 2100;
          this.world.groundY = 540;
          this.platforms = [
            {x:0, y:this.world.groundY, w:this.world.w, h:220},
            {x:340, y:this.world.groundY-110, w:260, h:18},
            {x:760, y:this.world.groundY-180, w:260, h:18},
            {x:1200, y:this.world.groundY-140, w:260, h:18},
            {x:1640, y:this.world.groundY-200, w:260, h:18},
            // Движущаяся горизонтальная платформа для истории
            {x:900, y:this.world.groundY-220, w:140, h:18, move:{axis:'x', range:160, speed:50}},
          ];
          this.objects = [
            {type:"exit", x:80, y:this.world.groundY-130, w:90, h:130, label:"Выход", text:"Вернуться в коридор"},
            {type:"enemy", id:"hi_s1", difficulty:"easy", role:"одноклассник", name:"Дима", x:800, y:this.world.groundY-72, w:60, h:80, subject:"history", speed:60},
            {type:"enemy", id:"hi_t1", difficulty:"hard", role:"учитель", name:"Учитель истории", x:1460, y:this.world.groundY-72, w:60, h:80, subject:"history", speed:60},
            // Коллекционный предмет для истории
            {type:'collectible', id:'history_c1', x:1500, y:this.world.groundY-260, w:26, h:26, value:5},
          ];
          const p=this.player;
          p.x=140; p.y=this.world.groundY-p.h; p.vx=p.vy=0; p.onGround=false;
          this.camera.x=0;
          const badge=document.querySelector(".badge");
          if(badge) badge.textContent = `Уровень: История (${(DIFF[this.levelMode]||DIFF.normal).label})`;
          $("hud-tip").innerHTML = "История: отвечай на вопросы 🙂 Победи всех врагов и выйди через «Выход».";
        }

        // Физика
        if(levelId === "physics"){
          this.world.w = 2100;
          this.world.groundY = 540;
          this.platforms = [
            {x:0, y:this.world.groundY, w:this.world.w, h:220},
            {x:280, y:this.world.groundY-140, w:260, h:18},
            {x:700, y:this.world.groundY-220, w:260, h:18},
            {x:1140, y:this.world.groundY-160, w:260, h:18},
            {x:1560, y:this.world.groundY-230, w:260, h:18},
            // Движущаяся платформа для физики
            {x:900, y:this.world.groundY-220, w:140, h:18, move:{axis:'x', range:160, speed:50}},
            // Дополнительные платформы для вертикального исследования
            {x:500, y:this.world.groundY-320, w:200, h:18},
            {x:900, y:this.world.groundY-380, w:220, h:18},
            {x:1300, y:this.world.groundY-340, w:200, h:18},
            // Вертикально движущаяся платформа, соединяющая уровни
            {x:700, y:this.world.groundY-260, w:100, h:18, move:{axis:'y', range:160, speed:60}},
          ];
          this.objects = [
            {type:"exit", x:80, y:this.world.groundY-130, w:90, h:130, label:"Выход", text:"Вернуться в коридор"},
            {type:"enemy", id:"ph_s1", difficulty:"easy", role:"одноклассник", name:"Игорь", x:760, y:this.world.groundY-72, w:60, h:80, subject:"physics", speed:80},
            {type:"enemy", id:"ph_t1", difficulty:"hard", role:"учитель", name:"Учитель физики", x:1420, y:this.world.groundY-72, w:60, h:80, subject:"physics", speed:80},
            // Коллекционный предмет для физики
            {type:'collectible', id:'physics_c1', x:1500, y:this.world.groundY-260, w:26, h:26, value:5},
            // Дополнительный коллекционный предмет, спрятанный на верхнем уровне
            {type:'collectible', id:'physics_c2', x:1700, y:this.world.groundY-420, w:26, h:26, value:5},
          ];
          const p=this.player;
          p.x=140; p.y=this.world.groundY-p.h; p.vx=p.vy=0; p.onGround=false;
          this.camera.x=0;
          const badge=document.querySelector(".badge");
          if(badge) badge.textContent = `Уровень: Физика (${(DIFF[this.levelMode]||DIFF.normal).label})`;
          $("hud-tip").innerHTML = "Физика: отвечай на вопросы 🙂 Победи всех врагов и выйди через «Выход».";
        }

        // Информатика
        if(levelId === "cs"){
          this.world.w = 2200;
          this.world.groundY = 540;
          this.platforms = [
            {x:0, y:this.world.groundY, w:this.world.w, h:220},
            {x:320, y:this.world.groundY-120, w:260, h:18},
            {x:760, y:this.world.groundY-200, w:260, h:18},
            {x:1220, y:this.world.groundY-150, w:260, h:18},
            {x:1680, y:this.world.groundY-220, w:260, h:18},
            // Движущаяся вертикальная платформа для информатики
            {x:900, y:this.world.groundY-220, w:140, h:18, move:{axis:'y', range:100, speed:40}},
            // Дополнительные платформы для многоуровневого прохождения
            {x:480, y:this.world.groundY-300, w:200, h:18},
            {x:1000, y:this.world.groundY-360, w:220, h:18},
            {x:1500, y:this.world.groundY-320, w:200, h:18},
            // Вертикально движущаяся платформа, соединяющая уровни
            {x:1400, y:this.world.groundY-260, w:100, h:18, move:{axis:'y', range:180, speed:60}},
          ];
          this.objects = [
            {type:"exit", x:80, y:this.world.groundY-130, w:90, h:130, label:"Выход", text:"Вернуться в коридор"},
            {type:"enemy", id:"cs_s1", difficulty:"easy", role:"одноклассник", name:"Маша", x:860, y:this.world.groundY-72, w:60, h:80, subject:"cs", speed:70},
            {type:"enemy", id:"cs_t1", difficulty:"hard", role:"учитель", name:"Учитель информатики", x:1500, y:this.world.groundY-72, w:60, h:80, subject:"cs", speed:70},
            // Коллекционный предмет для информатики
            {type:'collectible', id:'cs_c1', x:1700, y:this.world.groundY-260, w:26, h:26, value:5},
            // Дополнительный коллекционный предмет, спрятанный на верхнем уровне
            {type:'collectible', id:'cs_c2', x:1800, y:this.world.groundY-420, w:26, h:26, value:5},
          ];
          const p=this.player;
          p.x=140; p.y=this.world.groundY-p.h; p.vx=p.vy=0; p.onGround=false;
          this.camera.x=0;
          const badge=document.querySelector(".badge");
          if(badge) badge.textContent = `Уровень: Информатика (${(DIFF[this.levelMode]||DIFF.normal).label})`;
          $("hud-tip").innerHTML = "Информатика: отвечай на вопросы 🙂 Победи всех врагов и выйди через «Выход».";
        }

        // Химия
        if(levelId === "chemistry"){
          this.world.w = 2200;
          this.world.groundY = 540;
          this.platforms = [
            {x:0, y:this.world.groundY, w:this.world.w, h:220},
            {x:300, y:this.world.groundY-130, w:240, h:18},
            {x:700, y:this.world.groundY-200, w:240, h:18},
            {x:1150, y:this.world.groundY-150, w:240, h:18},
            {x:1600, y:this.world.groundY-210, w:240, h:18},
            // Движущаяся горизонтальная платформа
            {x:900, y:this.world.groundY-240, w:140, h:18, move:{axis:'x', range:150, speed:50}},
            // Дополнительные платформы для вертикального исследования
            {x:500, y:this.world.groundY-300, w:200, h:18},
            {x:900, y:this.world.groundY-350, w:220, h:18},
            {x:1400, y:this.world.groundY-320, w:200, h:18},
            // Вертикально движущаяся платформа
            {x:1100, y:this.world.groundY-280, w:100, h:18, move:{axis:'y', range:150, speed:50}},
          ];
          this.objects = [
            {type:"exit", x:80, y:this.world.groundY-130, w:90, h:130, label:"Выход", text:"Вернуться в коридор"},
            {type:"enemy", id:"ch_s1", difficulty:"easy", role:"одноклассник", name:"Лена", x:750, y:this.world.groundY-72, w:60, h:80, subject:"chemistry", speed:65},
            {type:"enemy", id:"ch_t1", difficulty:"hard", role:"учитель", name:"Учитель химии", x:1500, y:this.world.groundY-72, w:60, h:80, subject:"chemistry", speed:85},
            // Коллекционные предметы для химии
            {type:'collectible', id:'chem_c1', x:1700, y:this.world.groundY-260, w:26, h:26, value:5},
            {type:'collectible', id:'chem_c2', x:1800, y:this.world.groundY-420, w:26, h:26, value:5},
          ];
          const p=this.player;
          p.x=140; p.y=this.world.groundY-p.h; p.vx=p.vy=0; p.onGround=false;
          this.camera.x=0;
          const badge=document.querySelector(".badge");
          if(badge) badge.textContent = `Уровень: Химия (${(DIFF[this.levelMode]||DIFF.normal).label})`;
          $("hud-tip").innerHTML = "Химия: отвечай на вопросы 🙂 Победи всех врагов и выйди через «Выход».";
        }

        // Физкультура / Спортзал
        if(levelId === "gym"){
          this.world.w = 2200;
          this.world.groundY = 540;
          this.platforms = [
            {x:0, y:this.world.groundY, w:this.world.w, h:220},
            {x:280, y:this.world.groundY-120, w:240, h:18},
            {x:680, y:this.world.groundY-200, w:240, h:18},
            {x:1100, y:this.world.groundY-150, w:240, h:18},
            {x:1500, y:this.world.groundY-220, w:240, h:18},
            // Движущаяся горизонтальная платформа
            {x:900, y:this.world.groundY-240, w:140, h:18, move:{axis:'x', range:160, speed:60}},
            // Дополнительные многоуровневые платформы
            {x:450, y:this.world.groundY-300, w:200, h:18},
            {x:900, y:this.world.groundY-360, w:220, h:18},
            {x:1400, y:this.world.groundY-320, w:200, h:18},
            // Вертикально движущаяся платформа для соединения уровней
            {x:1200, y:this.world.groundY-280, w:100, h:18, move:{axis:'y', range:180, speed:70}},
          ];
          this.objects = [
            {type:"exit", x:80, y:this.world.groundY-130, w:90, h:130, label:"Выход", text:"Вернуться в коридор"},
            {type:"enemy", id:"gm_s1", difficulty:"easy", role:"одноклассник", name:"Саша", x:800, y:this.world.groundY-72, w:60, h:80, subject:"gym", speed:90},
            {type:"enemy", id:"gm_t1", difficulty:"hard", role:"учитель", name:"Учитель физкультуры", x:1420, y:this.world.groundY-72, w:60, h:80, subject:"gym", speed:100},
            // Коллекционные предметы для физкультуры
            {type:'collectible', id:'gym_c1', x:1600, y:this.world.groundY-260, w:26, h:26, value:5},
            {type:'collectible', id:'gym_c2', x:1800, y:this.world.groundY-420, w:26, h:26, value:5},
          ];
          const p=this.player;
          p.x=140; p.y=this.world.groundY-p.h; p.vx=p.vy=0; p.onGround=false;
          this.camera.x=0;
          const badge=document.querySelector(".badge");
          if(badge) badge.textContent = `Уровень: Физкультура (${(DIFF[this.levelMode]||DIFF.normal).label})`;
          $("hud-tip").innerHTML = "Физкультура: двигайся и отвечай на вопросы 🙂 Победи всех врагов и выйди через «Выход».";
        }

        // Биология
        if(levelId === "biology"){
          this.world.w = 2200;
          this.world.groundY = 540;
          this.platforms = [
            {x:0, y:this.world.groundY, w:this.world.w, h:220},
            {x:320, y:this.world.groundY-130, w:240, h:18},
            {x:760, y:this.world.groundY-200, w:240, h:18},
            {x:1180, y:this.world.groundY-150, w:240, h:18},
            {x:1600, y:this.world.groundY-210, w:240, h:18},
            // Движущаяся горизонтальная платформа
            {x:900, y:this.world.groundY-240, w:140, h:18, move:{axis:'x', range:150, speed:55}},
            // Дополнительные платформы для вертикального исследования
            {x:500, y:this.world.groundY-300, w:200, h:18},
            {x:900, y:this.world.groundY-350, w:220, h:18},
            {x:1400, y:this.world.groundY-320, w:200, h:18},
            // Вертикально движущаяся платформа, соединяющая уровни
            {x:1100, y:this.world.groundY-280, w:100, h:18, move:{axis:'y', range:150, speed:50}},
          ];
          this.objects = [
            {type:"exit", x:80, y:this.world.groundY-130, w:90, h:130, label:"Выход", text:"Вернуться в коридор"},
            {type:"enemy", id:"bio_s1", difficulty:"easy", role:"одноклассник", name:"Олег", x:760, y:this.world.groundY-72, w:60, h:80, subject:"biology", speed:65},
            {type:"enemy", id:"bio_t1", difficulty:"hard", role:"учитель", name:"Учитель биологии", x:1500, y:this.world.groundY-72, w:60, h:80, subject:"biology", speed:85},
            {type:'collectible', id:'bio_c1', x:1700, y:this.world.groundY-260, w:26, h:26, value:5},
            {type:'collectible', id:'bio_c2', x:1800, y:this.world.groundY-420, w:26, h:26, value:5},
          ];
          const p=this.player;
          p.x=140; p.y=this.world.groundY-p.h; p.vx=p.vy=0; p.onGround=false;
          this.camera.x=0;
          const badge=document.querySelector(".badge");
          if(badge) badge.textContent = `Уровень: Биология (${(DIFF[this.levelMode]||DIFF.normal).label})`;
          $("hud-tip").innerHTML = "Биология: отвечай на вопросы 🙂 Победи всех врагов и выйди через «Выход».";
        }

        // География
        if(levelId === "geography"){
          this.world.w = 2200;
          this.world.groundY = 540;
          this.platforms = [
            {x:0, y:this.world.groundY, w:this.world.w, h:220},
            {x:300, y:this.world.groundY-120, w:240, h:18},
            {x:700, y:this.world.groundY-200, w:240, h:18},
            {x:1150, y:this.world.groundY-150, w:240, h:18},
            {x:1600, y:this.world.groundY-220, w:240, h:18},
            // Движущаяся горизонтальная платформа
            {x:900, y:this.world.groundY-230, w:140, h:18, move:{axis:'x', range:170, speed:60}},
            // Дополнительные многоуровневые платформы
            {x:450, y:this.world.groundY-300, w:200, h:18},
            {x:900, y:this.world.groundY-360, w:220, h:18},
            {x:1400, y:this.world.groundY-320, w:200, h:18},
            // Вертикально движущаяся платформа для соединения уровней
            {x:1200, y:this.world.groundY-280, w:100, h:18, move:{axis:'y', range:190, speed:70}},
          ];
          this.objects = [
            {type:"exit", x:80, y:this.world.groundY-130, w:90, h:130, label:"Выход", text:"Вернуться в коридор"},
            {type:"enemy", id:"geo_s1", difficulty:"easy", role:"одноклассник", name:"Пётр", x:800, y:this.world.groundY-72, w:60, h:80, subject:"geography", speed:70},
            {type:"enemy", id:"geo_t1", difficulty:"hard", role:"учитель", name:"Учитель географии", x:1420, y:this.world.groundY-72, w:60, h:80, subject:"geography", speed:90},
            {type:'collectible', id:'geo_c1', x:1600, y:this.world.groundY-260, w:26, h:26, value:5},
            {type:'collectible', id:'geo_c2', x:1800, y:this.world.groundY-420, w:26, h:26, value:5},
          ];
          const p=this.player;
          p.x=140; p.y=this.world.groundY-p.h; p.vx=p.vy=0; p.onGround=false;
          this.camera.x=0;
          const badge=document.querySelector(".badge");
          if(badge) badge.textContent = `Уровень: География (${(DIFF[this.levelMode]||DIFF.normal).label})`;
          $("hud-tip").innerHTML = "География: отвечай на вопросы 🙂 Победи всех врагов и выйди через «Выход».";
        }


        // Экзамен: финальный уровень
        if(levelId === "exam"){
          this.world.w = 2200;
          this.world.groundY = 540;
          this.platforms = [
            {x:0, y:this.world.groundY, w:this.world.w, h:220},
            {x:320, y:this.world.groundY-110, w:220, h:18},
            {x:720, y:this.world.groundY-170, w:240, h:18},
            {x:1150, y:this.world.groundY-130, w:220, h:18},
            {x:1550, y:this.world.groundY-190, w:260, h:18},
            // Движущаяся платформа на экзамене
            {x:1200, y:this.world.groundY-210, w:140, h:18, move:{axis:'x', range:160, speed:60}},
          ];

          // Состояние экзамена
          this.exam = {
            confidence: 100,
            bossIndex: 0
          };
          examHud.show();
          examHud.set(this.exam.confidence);

          const boss = EXAM_BOSSES[this.exam.bossIndex];
          this.objects = [
            {type:"exit", x:80, y:this.world.groundY-130, w:90, h:130, label:"Выход", text:"Вернуться в коридор"},
            {type:"enemy", id: boss.id, difficulty:"hard", role: boss.role, name: boss.name, x:980, y:this.world.groundY-72, w:60, h:80, subject:"exam", speed:75},
            {type:"decor", x:1850, y:this.world.groundY-240, w:260, h:240, label:"Экзамен", text:"Соберись! Ты справишься 💪"},
            // Коллекционный предмет на экзамене
            {type:'collectible', id:'exam_c1', x:1600, y:this.world.groundY-260, w:26, h:26, value:7},
          ];

          const p = this.player;
          p.x = 140;
          p.y = this.world.groundY - p.h;
          p.vx = p.vy = 0;
          p.onGround = false;
          this.camera.x = 0;

          const badge = document.querySelector(".badge");
          if(badge) badge.textContent = `Уровень: Экзамен (${(DIFF[this.levelMode]||DIFF.normal).label})`;
          $("hud-tip").innerHTML = "Экзамен: победи мини-боссов и директора 🙂 Подходи и отвечай на вопросы!";
        }

      },
      loop(t){
        if(!this.running) return;
        const dt = clamp((t - this.lastT)/1000, 0, 1/20);
        this.lastT = t;
        this.update(dt);
        this.render(ctx, canvas);
        this.raf = requestAnimationFrame((tt)=>this.loop(tt));
      },
      update(dt){
        if(this.input.locked){
          this.input.jumpPressed = false;
          this.input.actPressed = false;
          return;
        }

        // Обновляем таймер уровня. Если он активен, отображаем значение и, если время закончилось, завершаем уровень
        if(this.mode === 'level' && this.levelTime != null){
          this.levelTime -= dt;
          if(this.levelTime < 0) this.levelTime = 0;
          const tv = document.getElementById('hud-timer-val');
          if(tv) tv.textContent = String(Math.ceil(this.levelTime));
          if(this.levelTime <= 0){
            // Время вышло: возвращаемся в хаб
            if(typeof modal !== 'undefined' && modal && typeof modal.open === 'function'){
              modal.open('⌛ Время вышло', 'Время на уровень закончилось! Попробуй снова.');
            }
            this.loadHub();
            return;
          }
        }
        const p = this.player;
        // --- Плавное горизонтальное сенсорное управление (аналоговая ось) ---
        let targetDir = (this.input.left ? -1 : 0) + (this.input.right ? 1 : 0);
        if(this.input.usingAnalog){
          targetDir = this.input.axisXTarget || 0;
          const k = 18; // скорость сглаживания
          this.input.axisX += (targetDir - this.input.axisX) * Math.min(1, dt * k);
          targetDir = this.input.axisX;
        } else {
          // клавиатура/кнопки — мгновенно
          this.input.axisX = targetDir;
        }
        p.vx = targetDir * p.speed;
        if(Math.abs(targetDir) > 0.01) p.face = targetDir > 0 ? 1 : -1;

        // --- Отзывчивый прыжок: coyote time + jump buffer ---
        p.coyote = Math.max(0, (p.coyote || 0) - dt);
        if(p.onGround) p.coyote = 0.12;
        this.input.jumpBuffer = Math.max(0, (this.input.jumpBuffer || 0) - dt);
        if(this.input.jumpPressed) this.input.jumpBuffer = 0.12;
        this.input.jumpPressed = false;

        if(this.input.jumpBuffer > 0 && (p.onGround || p.coyote > 0)){
          p.vy = -p.jumpV;
          p.onGround = false;
          p.coyote = 0;
          this.input.jumpBuffer = 0;
          // лёгкая вибрация (если доступна)
          try{ if(navigator.vibrate) navigator.vibrate(10); }catch(_){ }
        }

        // Обновляем движущиеся платформы (если есть). У каждой такой платформы должно быть поле move:{axis:'x'|'y', range, speed}
        for(const pl of this.platforms){
          if(pl && pl.move){
            if(pl.startX === undefined){ pl.startX = pl.x; pl.startY = pl.y; pl.dir = pl.dir || 1; }
            const m = pl.move;
            if(m.axis === 'x'){
              pl.x += m.speed * dt * pl.dir;
              if(pl.x < pl.startX - m.range){
                pl.x = pl.startX - m.range;
                pl.dir = 1;
              }
              if(pl.x > pl.startX + m.range){
                pl.x = pl.startX + m.range;
                pl.dir = -1;
              }
            } else if(m.axis === 'y'){
              pl.y += m.speed * dt * pl.dir;
              if(pl.y < pl.startY - m.range){
                pl.y = pl.startY - m.range;
                pl.dir = 1;
              }
              if(pl.y > pl.startY + m.range){
                pl.y = pl.startY + m.range;
                pl.dir = -1;
              }
            }
          }
        }

        // Движение NPC в хабе: если у NPC задано поле move, он ходит туда-сюда
        if(this.mode === 'hub' && Array.isArray(this.objects)){
          for(const o of this.objects){
            if(o && o.type === 'npc' && o.move){
              if(o.startX === undefined){
                o.startX = o.x;
                o.startY = o.y;
                o.dir = o.dir || 1;
              }
              const m = o.move;
              // движение по указанной оси
              if(m.axis === 'x'){
                o.x += m.speed * dt * o.dir;
                if(o.x < o.startX - m.range){
                  o.x = o.startX - m.range;
                  o.dir = 1;
                }
                if(o.x > o.startX + m.range){
                  o.x = o.startX + m.range;
                  o.dir = -1;
                }
              } else if(m.axis === 'y'){
                o.y += m.speed * dt * o.dir;
                if(o.y < o.startY - m.range){
                  o.y = o.startY - m.range;
                  o.dir = 1;
                }
                if(o.y > o.startY + m.range){
                  o.y = o.startY + m.range;
                  o.dir = -1;
                }
              }
            }
          }
        }

        p.vy += 1400 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.x = clamp(p.x, 0, this.world.w - p.w);

        p.onGround = false;
        for(const pl of this.platforms){
          const pr = {x:p.x, y:p.y, w:p.w, h:p.h};
          if(rectsOverlap(pr, pl)){
            /*
             * Корректируем детекцию приземления, чтобы игрок мог прыгать даже когда его вертикальная
             * скорость равна 0. Изначальная проверка требовала, чтобы p.vy > 0 и предыдущее
             * положение было выше на несколько пикселей. Это приводило к тому, что в редких
             * ситуациях (например, при низком fps или после остановки на платформе) p.onGround
             * оставалось ложным и персонаж не мог прыгнуть. Теперь мы также считаем игрока
             * приземлённым, если его низ находится на уровне поверхности платформы с небольшим
             * допуском (6px) и вертикальная скорость неотрицательная.
             */
            const wasFalling = (p.vy > 0 && (p.y + p.h - p.vy*dt) <= pl.y + 6);
            const isAtSurface = (p.vy === 0 && (p.y + p.h) <= pl.y + 6);
            if(wasFalling || isAtSurface){
              p.y = pl.y - p.h;
              p.vy = 0;
              p.onGround = true;
            } else {
              if(p.vx > 0) p.x = pl.x - p.w;
              if(p.vx < 0) p.x = pl.x + pl.w;
            }
          }
        }

        // Если приземлились в этом кадре — обновим coyote-time и применим буфер прыжка
        if(p.onGround){
          p.coyote = 0.12;
          if(this.input.jumpBuffer > 0){
            p.vy = -p.jumpV;
            p.onGround = false;
            p.coyote = 0;
            this.input.jumpBuffer = 0;
            try{ if(navigator.vibrate) navigator.vibrate(10); }catch(_){ }
          }
        }

        // --- PLAYER_ANIM: выбор кадра из спрайт-листа (один файл) ---
        {
          const moving = Math.abs(p.vx) > 8;
          let state = 'idle';
          if(!p.onGround) state = (p.vy < 0) ? 'jump' : 'fall';
          else if(moving) state = 'walk';

          if(p.animState !== state){
            p.animState = state;
            p.animT = 0;
          } else {
            p.animT = (p.animT || 0) + dt;
          }

          if(state === 'walk'){
            const speedNorm = Math.min(1.6, Math.abs(p.vx) / Math.max(1, p.speed));
            const fps = 8 + speedNorm * 6; // 8..17 fps
            const idx = Math.floor(p.animT * fps) % 4;
            p.animFrame = 2 + idx;
            p.renderBob = Math.sin(p.animT * fps * (Math.PI/2)) * 1.2;
          } else if(state === 'idle'){
            const fps = 1.2;
            const idx = Math.floor(p.animT * fps) % 2;
            p.animFrame = idx;
            p.renderBob = Math.sin(p.animT * 2.0) * 0.35;
          } else if(state === 'jump'){
            p.animFrame = 6;
            p.renderBob = -0.8;
          } else {
            p.animFrame = 7;
            p.renderBob = 0.8;
          }
        }


        
        // --- ENEMY_AI: простое движение врагов (чтобы не стояли столбиками) ---
        if(this.mode === "level" && Array.isArray(this.objects)){
          for(const o of this.objects){
            if(o && o.type === "enemy"){
              // init
              if(o.aiInit !== true){
                o.aiInit = true;
                o.startX = o.x;
                o.vx = 0;
                o.vy = 0;
                o.onGround = false;
                o.aiDir = (Math.random() < 0.5) ? -1 : 1;
                // скорость движения: если объекту назначена собственная скорость, используем её, иначе случайную
                if(typeof o.speed === 'number'){
                  o.aiSpeed = o.speed;
                } else {
                  o.aiSpeed = 60 + Math.random()*30; // пикс/сек
                }
                // диапазон движения: если указан, используем, иначе случайный
                if(typeof o.range === 'number'){
                  o.aiRange = o.range;
                } else {
                  o.aiRange = 120 + Math.random()*60; // туда-сюда
                }
                o.jumpCD = 0.6 + Math.random()*1.4;    // сек
                o.jumpT = o.jumpCD;
              }

              // туда-сюда
              const leftX = o.startX - o.aiRange;
              const rightX = o.startX + o.aiRange;
              if(o.x < leftX) o.aiDir = 1;
              if(o.x > rightX) o.aiDir = -1;

              o.vx = o.aiDir * o.aiSpeed;

              // гравитация
              o.vy += this.world.g * dt;

              // прыжок иногда (только если на земле)
              o.jumpT -= dt;
              if(o.onGround && o.jumpT <= 0){
                o.vy = -(260 + Math.random()*60);
                o.onGround = false;
                o.jumpT = o.jumpCD;
              }

              // движение
              o.x += o.vx * dt;
              o.y += o.vy * dt;

              // границы мира
              o.x = clamp(o.x, 0, this.world.w - o.w);

              // земля
              if(o.y + o.h >= this.world.groundY){
                o.y = this.world.groundY - o.h;
                o.vy = 0;
                o.onGround = true;
              }

              // коллизии с платформами (упрощённо как у игрока)
              const or = {x:o.x, y:o.y, w:o.w, h:o.h};
              for(const pl of this.platforms){
                const pr = or;
                if(rectsOverlap(pr, pl)){
                  // падал сверху
                  if(o.vy > 0 && (o.y + o.h - o.vy*dt) <= pl.y + 6){
                    o.y = pl.y - o.h;
                    o.vy = 0;
                    o.onGround = true;
                  } else {
                    // отталкиваем по X
                    if(o.vx > 0) o.x = pl.x - o.w;
                    if(o.vx < 0) o.x = pl.x + pl.w;
                    o.aiDir *= -1;
                  }
                }
              }
            }
          }
        }

        const viewW = canvas.getBoundingClientRect().width;
        const target = p.x + p.w/2 - viewW/2;
        this.camera.x = clamp(target, 0, this.world.w - viewW);

        if(this.input.actPressed){
          this.tryInteract(modal);
        }
        this.input.actPressed = false;

        // Подбор коллекционных предметов: если игрок сталкивается с объектом типа collectible, добавляем знания и удаляем предмет
        if(Array.isArray(this.objects)){
          for(let i = this.objects.length - 1; i >= 0; i--){
            const obj = this.objects[i];
            if(obj && obj.type === 'collectible'){
              const pr = {x: p.x, y: p.y, w: p.w, h: p.h};
              if(rectsOverlap(pr, obj)){
                const val = obj.value || 1;
                this.objects.splice(i, 1);
                const gained = addKnowledge(val);
                modal.open('⭐ Предмет найден!', `Поздравляем! Вы нашли предмет и получили +${gained} знаний.`);
              }
            }
          }
        }

        // Обновляем визуальные эффекты: всплывающие надписи (например +знаний)
        if(Array.isArray(this.effects)){
          for(let i = this.effects.length - 1; i >= 0; i--){
            const ef = this.effects[i];
            ef.y -= 50 * dt; // поднимаем текст вверх
            ef.ttl -= dt;
            if(ef.ttl <= 0){
              this.effects.splice(i, 1);
            }
          }
        }
      },
      tryInteract(modal){
        try{
        const dbg = $("hud-debug");
        if(dbg) dbg.textContent = "Статус: ищу объект рядом…";

        const p = this.player;

        const overlap = (a,b)=>!(a.x+a.w<b.x || b.x+b.w<a.x || a.y+a.h<b.y || b.y+b.h<a.y);

        let best = null;
        let bestD = 1e9;

        // 1) приоритет — пересечение
        for(const o of this.objects){
          const t = o.type || (o.subject ? "door" : (o.id ? "enemy" : "npc"));
          if(overlap(p, o)){ best = o; bestD = 0; break; }
        }

        // 2) иначе — ближайший в радиусе
        if(!best){
          const px = p.x + p.w/2;
          const py = p.y + p.h/2;
          for(const o of this.objects){
            const ox = o.x + o.w/2;
            const oy = o.y + o.h/2;
            const dx = ox - px;
            const dy = oy - py;
            const d = Math.hypot(dx, dy);
            if(d < 220 && d < bestD){
              best = o; bestD = d;
            }
          }
        }

        if(!best){
          if(dbg) dbg.textContent = "Статус: рядом ничего нет (подойди ближе)";
          return;
        }

        if(dbg) dbg.textContent = "Статус: взаимодействие ✅";

        const t = best.type || (best.subject ? 'door' : (best.id ? 'enemy' : 'npc'));

        if(t === "npc"){
          modal.open(`${(best.role||'персонаж').toUpperCase()}: ${best.name||'Кто-то'}`, best.text);

        } else if(t === "library"){
          openShop();

        } else if(t === "door"){
          const s = normalizeSubject(best.subject);
        if(s === "math" || s === "exam" || s === "russian" || s === "history" || s === "physics" || s === "cs"){
            // Показываем выбор сложности
            diffUI.open(best);
          } else {
            modal.open(`🚪 Кабинет: ${best.label || best.subject}`, "Этот уровень мы добавим в следующих этапах 🙂");
          }

        } else if(t === "exit"){
          this.loadHub();

        } else if(t === "enemy"){
          const subj = best.subject;
          const diff = best.difficulty; // easy/hard
          const q = pickQuestion(subj, diff);

          const title = (diff === "easy")
            ? `👩‍🎓 ${best.role}: ${best.name} (просто)`
            : `👩‍🏫 ${best.role}: ${best.name} (сложно)`;

          quiz.open({
            title,
            mode: this.levelMode || 'normal',
            seriesLeft: (diff === 'easy' ? 1 : 2)
              + (DIFF[this.levelMode || 'normal']?.extraQuestions || 0)
              + ((this.levelMode || 'normal') === 'hard' ? 1 : 0),
            makeNext: () => pickQuestion(subj, diff),
            onFail: () => {
              // На экзамене ошибки уменьшают уверенность
              if(this.levelId === 'exam' && this.exam){
                const loss = (this.levelMode === 'hard') ? 25 : (this.levelMode === 'easy' ? 15 : 20);
                this.exam.confidence -= loss;
                examHud.set(this.exam.confidence);
                if(this.exam.confidence <= 0){
                  modal.open('😵 Экзамен провален', 'Уверенность закончилась. Ничего страшного — потренируйся и попробуй снова!');
                  this.loadHub();
                } else {
                  modal.open('⚠ Ошибка', `Минус уверенность: -${loss}%. Осталось: ${Math.max(0, Math.round(this.exam.confidence))}%`);
                }
              }
            },
            onWin: () => {
              const add = addKnowledge(diff === "easy" ? 2 : 3);
              setDefeated(this.levelId, best.id);
              this.objects = this.objects.filter(o => o !== best);
              modal.open("🎉 Победа!", `Верно! +${add} знаний. Враг пропал 🙂`);

              // Экзамен: если победили босса — следующий босс
              if(this.levelId === 'exam'){
                // увеличить знания чуть-чуть
                const left = this.objects.filter(o => o.type === "enemy").length;
                if(left === 0){
                  this.exam.bossIndex += 1;
                  if(this.exam.bossIndex >= EXAM_BOSSES.length){
                    progress.completedLevels['exam'] = true;
                    unlockAchievement('exam_pass','Экзамен сдан! 🎓');
                    saveProgress(progress);
                    const extra = addKnowledge(25);
                    modal.open('🎓 Экзамен сдан!', `Поздравляю! Ты победил директора 🎉\n+${extra} знаний. Возвращайся в коридор через дверь «Выход».`);
                  } else {
                    const next = EXAM_BOSSES[this.exam.bossIndex];
                    this.objects.push({type:'enemy', id: next.id, difficulty:'hard', role: next.role, name: next.name, x: 980, y:this.world.groundY-72, w:60, h:80, subject:'exam', speed:75});
                    modal.open('⚔ Следующий противник!', `${next.role.toUpperCase()}: ${next.name}. Готов?`);
                  }
                }
              }

              const left = this.objects.filter(o => o.type === "enemy").length;
              if(left === 0 && this.levelId !== 'exam'){
                progress.completedLevels[this.levelId] = true;
                unlockAchievement('first_level','Первый пройденный уровень! 🏆');
                saveProgress(progress);
                const extra = addKnowledge(10);
                modal.open("🏆 Уровень пройден!", `Молодец! Уровень «Математика» пройден. +${extra} знаний.\nТеперь можно выйти через дверь «Выход» слева.`);
              }
            }
          });
        }
        }catch(err){
          console.error(err);
          const dbg = $("hud-debug");
          if(dbg) dbg.textContent = "Ошибка взаимодействия: " + (err && err.message ? err.message : String(err));
          if(modal && typeof modal.open === 'function'){
            modal.open("⚠ Ошибка", "Похоже, случилась маленькая ошибка при взаимодействии. Попробуй ещё раз 🙂");
          }
        }
      },
      worldToScreen(x,y){ return { x: x - this.camera.x, y }; },
      drawRect(ctx, x,y,w,h,fill,stroke){
        const p = this.worldToScreen(x,y);
        if(fill){ ctx.fillStyle = fill; ctx.fillRect(p.x,p.y,w,h); }
        if(stroke){ ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.strokeRect(p.x+1,p.y+1,w-2,h-2); }
      },
      drawLabel(ctx, x,y,text,alpha=0.92){
        const p = this.worldToScreen(x,y);
        ctx.globalAlpha = alpha;
        ctx.font = "800 14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,255,255,.92)";
        ctx.fillText(text, p.x, p.y);
        ctx.globalAlpha = 1;
      },
      drawPlayer(ctx){
        const p = this.player;
        const ps = this.worldToScreen(p.x, p.y);

        // тень под ногами
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(ps.x + p.w/2, ps.y + p.h + 6, p.w*0.55, 6, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();

        // если спрайт загружен — рисуем его; иначе — старый прямоугольник (фолбэк)
        try{
          if(typeof ASSETS !== 'undefined' && ASSETS.playerSheet && ASSETS.playerSheet.loaded){
            const sheet = ASSETS.playerSheet;
            const tw = sheet.tileW, th = sheet.tileH;
            const frame = (p.animFrame ?? 0);
            const sx = frame * tw;

            // Рисуем чуть больше коллизии, чтобы персонаж был «красивее», но хитбокс остался прежним
            const dw = p.w * 1.55;
            const dh = p.h * 1.35;
            const dx = ps.x + p.w/2 - dw/2;
            const dy = ps.y + p.h - dh + (p.renderBob || 0);

            ctx.save();
            if(p.face === -1){
              ctx.translate(dx + dw, dy);
              ctx.scale(-1, 1);
              ctx.drawImage(sheet.img, sx, 0, tw, th, 0, 0, dw, dh);
            } else {
              ctx.drawImage(sheet.img, sx, 0, tw, th, dx, dy, dw, dh);
            }
            ctx.restore();
            return;
          }
        }catch(e){
          // тихий фолбэк
        }

        // fallback
        this.drawRect(ctx, p.x, p.y, p.w, p.h, 'rgba(255,255,255,.22)', 'rgba(255,255,255,.28)');
        const eyeY = p.y + 16;
        const eyeX = (p.face === 1) ? p.x + 28 : p.x + 12;
        const es = this.worldToScreen(eyeX, eyeY);
        ctx.fillStyle = 'rgba(255,255,255,.92)';
        ctx.fillRect(es.x, es.y, 6, 6);
      },
      render(ctx, canvas){
        const rect = canvas.getBoundingClientRect();
        const W = rect.width, H = rect.height;

        ctx.clearRect(0,0,W,H);

        const grad = ctx.createLinearGradient(0,0,0,H);
        grad.addColorStop(0, "#101a3b");
        grad.addColorStop(1, "#070b1d");
        ctx.fillStyle = grad;
        ctx.fillRect(0,0,W,H);

        ctx.globalAlpha = 0.35;
        for(let i=0;i<10;i++){
          const x = (i*340 - (this.camera.x*0.3)%340);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(x+60, 55, 170, 6);
        }
        ctx.globalAlpha = 1;

        // Рисуем всплывающие эффекты (например, +знаний)
        if(Array.isArray(this.effects)){
          for(const ef of this.effects){
            const ps = this.worldToScreen(ef.x, ef.y);
            // плавно уменьшаем прозрачность по мере окончания ttl (макс ttl ~1.5с)
            const alpha = Math.max(0, Math.min(1, ef.ttl / 1.5));
            ctx.globalAlpha = alpha;
            ctx.font = "700 20px system-ui, -apple-system, Segoe UI, Roboto, Arial";
            ctx.textAlign = "center";
            ctx.fillStyle = "rgba(253,224,71,.92)";
            ctx.fillText(ef.text, ps.x, ps.y);
            ctx.globalAlpha = 1;
          }
        }

        for(const pl of this.platforms){
          this.drawRect(ctx, pl.x, pl.y, pl.w, pl.h, "rgba(255,255,255,.10)", "rgba(255,255,255,.16)");
        }

        ctx.globalAlpha = 0.12;
        for(let x=0; x<this.world.w; x+=90){
          this.drawRect(ctx, x, this.world.groundY+10, 2, 180, "rgba(255,255,255,.20)", null);
        }
        ctx.globalAlpha = 1;

        for(const o of this.objects){
          if(o.type === 'collectible'){
            // Рисуем предметы для сбора (звёзды) ярким цветом
            this.drawRect(ctx, o.x, o.y, o.w, o.h, "rgba(253,224,71,.65)", "rgba(255,255,255,.25)");
            this.drawLabel(ctx, o.x + o.w/2, o.y - 10, "⭐");
          } else if(o.type === "door"){
            // Draw the door body
            this.drawRect(ctx, o.x, o.y, o.w, o.h, "rgba(31,111,235,.25)", "rgba(255,255,255,.22)");
            // Inner panel
            this.drawRect(ctx, o.x+16, o.y+18, o.w-32, 30, "rgba(255,255,255,.16)", "rgba(255,255,255,.18)");
            // Use a human‑readable label if available; fallback to subject; avoid printing 'undefined'
            const doorLabel = (o.label && o.label.trim()) || (o.subject && o.subject.trim()) || "";
            if(doorLabel){
              this.drawLabel(ctx, o.x+o.w/2, o.y-10, `🚪 ${doorLabel}`);
            }
          } else if(o.type === "library"){
            this.drawRect(ctx, o.x, o.y, o.w, o.h, "rgba(16,185,129,.22)", "rgba(255,255,255,.22)");
            for(let i=0;i<4;i++){
              this.drawRect(ctx, o.x+10, o.y+18+i*28, o.w-20, 6, "rgba(255,255,255,.18)", null);
            }
            this.drawLabel(ctx, o.x+o.w/2, o.y-10, "📚 Библиотека");
          } else {
            this.drawRect(ctx, o.x, o.y, o.w, o.h, "rgba(255,255,255,.16)", "rgba(255,255,255,.20)");
            this.drawRect(ctx, o.x+8, o.y-18, o.w-16, 18, "rgba(255,255,255,.14)", "rgba(255,255,255,.20)");
            // Prefer name; if missing, fallback to label; skip drawing if neither exists to avoid 'undefined'
            const objLabel = (o.name && String(o.name).trim()) || (o.label && String(o.label).trim()) || "";
            if(objLabel){
              this.drawLabel(ctx, o.x+o.w/2, o.y-28, `${objLabel}`);
            }
            const p = this.worldToScreen(o.x+o.w/2, o.y+o.h+18);
            ctx.font = "800 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
            ctx.textAlign = "center";
            ctx.fillStyle = "rgba(255,255,255,.70)";
            if(o.role){
              ctx.fillText(o.role, p.x, p.y);
            }
          }
        }

        this.drawPlayer(ctx);

        // Большая надпись для атмосферы
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = "#ffffff";
        ctx.font = "900 72px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        ctx.textAlign = "center";
        ctx.fillText(this.mode === "level" ? "КАБИНЕТ" : "КОРИДОР", W/2, 200);
        ctx.globalAlpha = 1;
      }
    };

    // --- клавиатура: работает и на русской, и на английской ---
    window.addEventListener("keydown", (e) => {
      const code = e.code;
      const key = (e.key || "").toLowerCase();

      if(code === "ArrowLeft" || code === "KeyA") game.input.left = true;
      if(code === "ArrowRight" || code === "KeyD") game.input.right = true;

      if(code === "Space" || code === "ArrowUp" || code === "KeyW"){
        e.preventDefault();
        if(!game.input.locked) game.input.jumpPressed = true;
      }

      // действие: физическая клавиша KeyE + символ 'у' на русской раскладке
      if(code === "KeyE" || key === "e" || key === "у"){
        if(!game.input.locked) game.input.actPressed = true;
        const dbg = $("hud-debug");
        if(dbg) dbg.textContent = "Статус: нажата кнопка действия";
      }
    }, {passive:false});

    window.addEventListener("keyup", (e) => {
      const code = e.code;
      if(code === "ArrowLeft" || code === "KeyA") game.input.left = false;
      if(code === "ArrowRight" || code === "KeyD") game.input.right = false;
    });

    // --- тач-кнопки ---
    const touchButtons = document.querySelectorAll("[data-touch]");
    function setTouch(name, down){
      if(name === "left") game.input.left = down;
      if(name === "right") game.input.right = down;
      if(name === "jump" && down && !game.input.locked) game.input.jumpPressed = true;
      if(name === "act" && down && !game.input.locked) game.input.actPressed = true;
    }
    for(const btn of touchButtons){
      const name = btn.getAttribute("data-touch");
      const onDown = (e) => {
        e.preventDefault();
        try{ btn.setPointerCapture(e.pointerId); }catch(_){}
        setTouch(name, true);
        btn.classList.add("is-down");
      };
      const onUp = (e) => {
        e.preventDefault();
        setTouch(name, false);
        btn.classList.remove("is-down");
      };
      btn.addEventListener("pointerdown", onDown, {passive:false});
      btn.addEventListener("pointerup", onUp, {passive:false});
      btn.addEventListener("pointercancel", onUp, {passive:false});
      btn.addEventListener("pointerleave", onUp, {passive:false});
    }

    // --- жесты (gesture-first) ---
    // Улучшенное сенсорное управление:
    // - Мульти-тач: левый палец = движение (аналоговый "джойстик"), правый = прыжок/действие
    // - Плавность: аналоговая ось сглаживается в update()
    // - Отзывчивость: coyote-time + jump buffer в логике прыжка
    (function(){
      const canvasEl = $("game");
      if(!canvasEl) return;

      // Мы обрабатываем как touch, так и pen (стилус)
      const isTouchLike = (e) => (!e.pointerType || e.pointerType === "touch" || e.pointerType === "pen");

      // Параметры
      const JOY_RADIUS = 80;       // радиус джойстика (px)
      const DEADZONE = 0.18;       // мёртвая зона по оси X (0..1)
      const TAP_MAX_MS = 220;      // максимум длительности тапа
      const DOUBLE_TAP_MS = 280;   // окно дабл-тапа
      const LEFT_ZONE = 0.55;      // левый сектор экрана под движение

      let moveId = null;
      let actId = null;

      // Джойстик
      let joyStartX = 0, joyStartY = 0;

      // Правая рука: прыжок/действие
      let actStartX = 0, actStartY = 0;
      let actDownTime = 0;
      let actMoved = false;
      let lastTapTime = 0;

      const clamp1 = (v) => Math.max(-1, Math.min(1, v));

      function setAnalogTarget(x){
        game.input.usingAnalog = true;
        game.input.axisXTarget = x;
      }
      function clearAnalog(){
        game.input.axisXTarget = 0;
        game.input.usingAnalog = false;
      }

      function relPos(e){
        const r = canvasEl.getBoundingClientRect();
        return { r, x: e.clientX - r.left, y: e.clientY - r.top };
      }

      function handleDown(e){
        if(!isTouchLike(e)) return;
        if(game.controlMode !== "gestures") return;
        if(game.input.locked) return;

        const { r, x, y } = relPos(e);
        const leftSide = x < r.width * LEFT_ZONE;

        // Левый палец — движение
        if(leftSide && moveId === null){
          moveId = e.pointerId;
          joyStartX = x; joyStartY = y;
          try{ canvasEl.setPointerCapture(e.pointerId); }catch(_){ }
          e.preventDefault();
          return;
        }
        // Правый палец — прыжок/действие
        if(!leftSide && actId === null){
          actId = e.pointerId;
          actStartX = x; actStartY = y;
          actDownTime = performance.now();
          actMoved = false;
          try{ canvasEl.setPointerCapture(e.pointerId); }catch(_){ }
          e.preventDefault();
          return;
        }
      }

      function handleMove(e){
        if(!isTouchLike(e)) return;
        if(game.controlMode !== "gestures") return;
        if(game.input.locked) return;

        const { x, y } = relPos(e);

        // Джойстик
        if(e.pointerId === moveId){
          const dx = x - joyStartX;
          const max = Math.max(30, JOY_RADIUS);
          let ax = dx / max;
          if(Math.abs(ax) < DEADZONE) ax = 0;
          ax = clamp1(ax);
          setAnalogTarget(ax);
          e.preventDefault();
          return;
        }

        // Правая рука: свайп вверх => прыжок
        if(e.pointerId === actId){
          const THRESH = game.swipeThreshold || 24;
          const dx = x - actStartX;
          const dy = y - actStartY;

          if(Math.abs(dx) > 3 || Math.abs(dy) > 3) actMoved = true;

          if(dy < -THRESH){
            game.input.jumpPressed = true;
            // сбрасываем точку, чтобы не спамить прыжками одним свайпом
            actStartX = x;
            actStartY = y;
            actMoved = true;
            try{ if(navigator.vibrate) navigator.vibrate(8); }catch(_){ }
          }
          e.preventDefault();
          return;
        }
      }

      function handleUp(e){
        if(!isTouchLike(e)) return;
        const now = performance.now();
        const { x, y } = relPos(e);

        // Отпустили джойстик
        if(e.pointerId === moveId){
          moveId = null;
          clearAnalog();
          e.preventDefault();
          return;
        }

        // Отпустили правую руку: тап => прыжок, дабл-тап => действие
        if(e.pointerId === actId){
          const dt = now - actDownTime;
          const THRESH = game.swipeThreshold || 24;
          const dx = x - actStartX;
          const dy = y - actStartY;
          const moved = actMoved || Math.abs(dx) > THRESH || Math.abs(dy) > THRESH;

          if(!moved && dt < TAP_MAX_MS){
            if(now - lastTapTime < DOUBLE_TAP_MS){
              game.input.actPressed = true;
              lastTapTime = 0;
              try{ if(navigator.vibrate) navigator.vibrate(12); }catch(_){ }
            } else {
              game.input.jumpPressed = true;
              lastTapTime = now;
              try{ if(navigator.vibrate) navigator.vibrate(8); }catch(_){ }
            }
          }

          actId = null;
          e.preventDefault();
          return;
        }
      }

      canvasEl.addEventListener('pointerdown', handleDown, {passive:false});
      canvasEl.addEventListener('pointermove', handleMove, {passive:false});
      canvasEl.addEventListener('pointerup', handleUp, {passive:false});
      canvasEl.addEventListener('pointercancel', handleUp, {passive:false});
    })();

    // Дополнительное управление на мобильных устройствах через гироскоп/акселерометр.
    // Если поддерживается DeviceOrientationEvent (наклон), используем гамма (лево-право) для движения.
    // Отключаем управление наклоном устройства (гироскоп), оставляем только свайпы и кнопки
    if(false && window.DeviceOrientationEvent){
      const ORIENT_THRESH = 10; // в градусах: чувствительность наклона
      window.addEventListener('deviceorientation', (e)=>{
        if(game.input.locked) return;
        const g = e.gamma;
        if(typeof g === 'number'){
          if(g > ORIENT_THRESH){
            game.input.right = true;
            game.input.left = false;
          } else if(g < -ORIENT_THRESH){
            game.input.left = true;
            game.input.right = false;
          } else {
            // небольшой наклон — прекращаем движение, если управление не задействовано тачем/клавишами
            game.input.left = false;
            game.input.right = false;
          }
        }
      });
    }
  }

  // Надёжный запуск init: если DOM уже готов — запускаем сразу, иначе ждём.
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init, {once:true});
  } else {
    init();
  }
}

)();
