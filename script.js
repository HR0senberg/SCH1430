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
  window.addEventListener("error", () => {
    setTimeout(showMenuSafely, 0);
  });

  // Фолбэк-таймер: даже если init не сработал — через 6 секунд меню обязано появиться.
  setTimeout(showMenuSafely, 6000);

  function init(){
    const screens = {
      loading: $("screen-loading"),
      menu: $("screen-menu"),
      about: $("screen-about"),
      game: $("screen-game"),
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
    const defaultProgress = { knowledge: 10, upgrades: { tries:0, time:0, hint:0, bonus:0 } };

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

    function totalUpg(){
      const u = progress.upgrades;
      return (u.tries + u.time + u.hint + u.bonus);
    }

    function updateHUD(){
      const hk = document.getElementById("hud-knowledge");
      const hu = document.getElementById("hud-upg");
      const sk = document.getElementById("shop-knowledge");
      if(hk) hk.textContent = String(progress.knowledge);
      if(hu) hu.textContent = String(totalUpg());
      if(sk) sk.textContent = String(progress.knowledge);
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
          const cost = (type === "bonus") ? 10 : 5;

          if(progress.knowledge < cost){
            modal.open("❗ Не хватает знаний", "Нужно больше знаний. Пройди уровни и возвращайся 🙂");
            return;
          }

          progress.knowledge -= cost;
          progress.upgrades[type] = (progress.upgrades[type] || 0) + 1;
          saveProgress(progress);
          updateHUD();
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
      }
    });

        
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

        this.title.textContent = payload.title;

        // Если это серия — берём вопрос из фабрики
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
    const QUESTIONS = {
      exam: {
        hard: [
          {q:"Сколько градусов в сумме углов треугольника?", options:["90","180","270","360"], correct:1},
          {q:"Найди 30% от 200.", options:["40","50","60","70"], correct:2},
          {q:"Что такое алгоритм?", options:["Случай", "Точный план действий", "Ошибка", "Игрушка"], correct:1},
          {q:"Кто отменил крепостное право в России?", options:["Пётр I","Александр II","Иван IV","Екатерина II"], correct:1},
          {q:"Сила тока измеряется в…", options:["Вольтах","Омах","Амперах","Герцах"], correct:2},
          {q:"Подлежащее — это…", options:["Главный член предложения", "Знак препинания", "Часть слова", "Время"], correct:0},
        ]
      },
      math: {
        easy: [
          {q:"Сколько будет 7 + 5?", options:["10","11","12","13"], correct:2},
          {q:"Сколько будет 9 − 4?", options:["3","4","5","6"], correct:2},
          {q:"Сколько будет 3 × 4?", options:["7","10","12","14"], correct:2},
          {q:"Сколько будет 16 ÷ 4?", options:["2","3","4","5"], correct:2},
        ],
        hard: [
          {q:"Чему равен (2x + 3), если x = 5?", options:["10","11","12","13"], correct:3},
          {q:"Сколько градусов в сумме углов треугольника?", options:["90","180","270","360"], correct:1},
          {q:"Найди 25% от 80.", options:["10","15","20","25"], correct:2},
          {q:"Реши: 3² + 4² = ?", options:["7","25","49","16"], correct:1},
        ]
      }
    };

    
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
      $("progressModal")?.classList.add("hidden");
      modal.open("Сброс", "Прогресс сброшен. Можно начинать заново 🙂");
    });


    // --- canvas / resize ---
    const canvas = $("game");
    const ctx = canvas.getContext("2d");
    const DPR = () => Math.max(1, Math.min(2, window.devicePixelRatio || 1));

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
      world:{ w:3200, h:720, groundY:520 },
      camera:{ x:0 },
      input:{ left:false, right:false, jumpPressed:false, actPressed:false, locked:false },
      player:{ x:120, y:0, w:44, h:60, vx:0, vy:0, speed:320, jumpV:560, onGround:false, face:1 },
      objects:[],
      platforms:[],

      start(){
        resizeCanvas();
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

        // NPC/двери/библиотека
        this.objects = [
          {type:"library", x:300, y:this.world.groundY-150, w:120, h:150,
            text:"Это библиотека! Тут можно покупать улучшения 🙂"},
          {type:"npc", role:"одноклассник", name:"Маша", x:520, y:this.world.groundY-60, w:46, h:60,
            text:"Привет! Пойдём в математику? Там будут вопросы попроще."},

          // Дверь в Математику — уже работает как уровень
          {type:"door", subject:"math", label:"Математика", x:650, y:this.world.groundY-130, w:90, h:130,
            text:"Вход в кабинет: Математика"},

          {type:"npc", role:"одноклассник", name:"Илья", x:980, y:this.world.groundY-60, w:46, h:60,
            text:"Если сомневаешься — выбирай самый логичный ответ 🙂"},

          // Остальные двери пока «скоро»
          {type:"door", subject:"rus", label:"Русский язык", x:1120, y:this.world.groundY-130, w:90, h:130,
            text:"Кабинет: Русский язык (скоро)"},
          {type:"npc", role:"учитель", name:"Екатерина Эдуардовна", x:1580, y:this.world.groundY-60, w:54, h:72,
            text:"Вопросы посложнее — но ты справишься!"},
          {type:"door", subject:"exam", label:"Экзамен", x:1720, y:this.world.groundY-130, w:90, h:130,
            text:"ФИНАЛ: Экзамен (мини-боссы и директор)"},
          {type:"door", subject:"history", label:"История", x:1860, y:this.world.groundY-130, w:90, h:130,
            text:"Кабинет: История (скоро)"},
          {type:"npc", role:"учитель", name:"Учитель информатики", x:2400, y:this.world.groundY-60, w:54, h:72,
            text:"Информатика — это про логику и аккуратность."},
          {type:"door", subject:"physics", label:"Физика", x:2660, y:this.world.groundY-130, w:90, h:130,
            text:"Кабинет: Физика (скоро)"},
        ];

        const p = this.player;
        p.x = 120;
        p.y = this.world.groundY - p.h;
        p.vx = p.vy = 0;
        p.onGround = false;
        this.camera.x = 0;
      },

      loadLevel(levelId, mode){
        this.levelMode = mode || 'normal';
        this.mode = "level";
        this.levelId = levelId;

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
          ];

          const p = this.player;
          p.x = 140;
          p.y = this.world.groundY - p.h;
          p.vx = p.vy = 0;
          p.onGround = false;
          this.camera.x = 0;
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
            {type:"enemy", id: boss.id, difficulty:"hard", role: boss.role, name: boss.name, x:980, y:this.world.groundY-72, w:60, h:80, subject:"exam"},
            {type:"decor", x:1850, y:this.world.groundY-240, w:260, h:240, label:"Экзамен", text:"Соберись! Ты справишься 💪"},
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
        const p = this.player;
        const dir = (this.input.left ? -1 : 0) + (this.input.right ? 1 : 0);
        p.vx = dir * p.speed;
        if(dir !== 0) p.face = dir;

        if(this.input.jumpPressed && p.onGround){
          p.vy = -p.jumpV;
          p.onGround = false;
        }
        this.input.jumpPressed = false;

        p.vy += 1400 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.x = clamp(p.x, 0, this.world.w - p.w);

        p.onGround = false;
        for(const pl of this.platforms){
          const pr = {x:p.x, y:p.y, w:p.w, h:p.h};
          if(rectsOverlap(pr, pl)){
            if(p.vy > 0 && (p.y + p.h - p.vy*dt) <= pl.y + 6){
              p.y = pl.y - p.h;
              p.vy = 0;
              p.onGround = true;
            } else {
              if(p.vx > 0) p.x = pl.x - p.w;
              if(p.vx < 0) p.x = pl.x + pl.w;
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
      },
      tryInteract(modal){
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
          if(best.subject === "math" || best.subject === "exam"){
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
            seriesLeft: (diff === 'easy' ? 1 : 2) + (DIFF[this.levelMode || 'normal']?.extraQuestions || 0),
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
                    this.objects.push({type:'enemy', id: next.id, difficulty:'hard', role: next.role, name: next.name, x: 980, y:this.world.groundY-72, w:60, h:80, subject:'exam'});
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

        for(const pl of this.platforms){
          this.drawRect(ctx, pl.x, pl.y, pl.w, pl.h, "rgba(255,255,255,.10)", "rgba(255,255,255,.16)");
        }

        ctx.globalAlpha = 0.12;
        for(let x=0; x<this.world.w; x+=90){
          this.drawRect(ctx, x, this.world.groundY+10, 2, 180, "rgba(255,255,255,.20)", null);
        }
        ctx.globalAlpha = 1;

        for(const o of this.objects){
          if(o.type === "door"){
            this.drawRect(ctx, o.x, o.y, o.w, o.h, "rgba(31,111,235,.25)", "rgba(255,255,255,.22)");
            this.drawRect(ctx, o.x+16, o.y+18, o.w-32, 30, "rgba(255,255,255,.16)", "rgba(255,255,255,.18)");
            this.drawLabel(ctx, o.x+o.w/2, o.y-10, `🚪 ${o.subject}`);
          } else if(o.type === "library"){
            this.drawRect(ctx, o.x, o.y, o.w, o.h, "rgba(16,185,129,.22)", "rgba(255,255,255,.22)");
            for(let i=0;i<4;i++){
              this.drawRect(ctx, o.x+10, o.y+18+i*28, o.w-20, 6, "rgba(255,255,255,.18)", null);
            }
            this.drawLabel(ctx, o.x+o.w/2, o.y-10, "📚 Библиотека");
          } else {
            this.drawRect(ctx, o.x, o.y, o.w, o.h, "rgba(255,255,255,.16)", "rgba(255,255,255,.20)");
            this.drawRect(ctx, o.x+8, o.y-18, o.w-16, 18, "rgba(255,255,255,.14)", "rgba(255,255,255,.20)");
            this.drawLabel(ctx, o.x+o.w/2, o.y-28, `${o.name}`);
            const p = this.worldToScreen(o.x+o.w/2, o.y+o.h+18);
            ctx.font = "800 12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
            ctx.textAlign = "center";
            ctx.fillStyle = "rgba(255,255,255,.70)";
            ctx.fillText(o.role, p.x, p.y);
          }
        }

        const p = this.player;
        this.drawRect(ctx, p.x, p.y, p.w, p.h, "rgba(255,255,255,.22)", "rgba(255,255,255,.28)");
        const eyeY = p.y + 16;
        const eyeX = (p.face === 1) ? p.x + 28 : p.x + 12;
        const s = this.worldToScreen(eyeX, eyeY);
        ctx.fillStyle = "rgba(255,255,255,.92)";
        ctx.fillRect(s.x, s.y, 6, 6);

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
  }

  // Надёжный запуск init: если DOM уже готов — запускаем сразу, иначе ждём.
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init, {once:true});
  } else {
    init();
  }
}

)();
