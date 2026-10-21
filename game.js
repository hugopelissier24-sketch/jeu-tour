(() => {
  "use strict";

  /* =====================================================================
     AETHER ASCENDANT — Jeu 3D Monolithique (Three.js)
     2 400+ Lignes de code original — Intégration non-destructive
     PARTIE 1 / 3
     ===================================================================== */

  /* ============================== CONFIGURATION ============================== */
  const MAX_LEVEL = 10;
  const LEVEL_HEIGHT = 5;           // hauteur entre deux plateformes
  const ARENA = 9;                  // limite de déplacement (la plateforme fait 20x20)
  const LIFT = { x: 0, z: -7.2, radius: 2.8 };
  const SPAWN = { x: 0, z: 6 };
  const DASH_TIME = 0.2, DASH_SPEED = 17, DASH_COOLDOWN = 1.2;

  // Multijoueur : colle ici la config de ton projet Firebase (Realtime Database).
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDDKd44AD3m862O70FMgjGE4JGWUZL-s7Q",
  authDomain: "aether-ascendant.firebaseapp.com",
  databaseURL: "https://aether-ascendant-default-rtdb.firebaseio.com",
  projectId: "aether-ascendant",
  storageBucket: "aether-ascendant.firebasestorage.app",
  messagingSenderId: "574431259587",
  appId: "1:574431259587:web:ea1c1f0bb7dfb4b755eb76",
  measurementId: "G-BGR9F4DPMZ"
};

  /* ============================== OUTILS ============================== */
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const hexCss = (h) => "#" + h.toString(16).padStart(6, "0");
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const ui = {
    canvas: $("gameCanvas"), hud: $("hud"), main: $("mainMenu"),
    settings: $("settingsScreen"), pause: $("pauseMenu"),
    upgrade: $("upgradeScreen"), end: $("endScreen"), endTitle: $("endTitle"), endStats: $("endStats"),
    scores: $("scoresScreen"), scoresBody: $("scoresBody"),
    loadError: $("loadError"), hpFill: $("hpFill"), hpText: $("hpText"),
    dodgeFill: $("dodgeFill"), level: $("levelText"), enemies: $("enemiesText"),
    time: $("timeText"), score: $("scoreText"), combo: $("comboText"), fpsText: $("fpsText"),
    bossBar: $("bossBar"), bossFill: $("bossFill"), bossName: $("bossName"),
    crosshair: $("crosshair"), hitmarker: $("hitmarker"), damageLayer: $("damageLayer"),
    prompt: $("prompt"), flash: $("flash"), banner: $("banner"), bannerTitle: $("bannerTitle"),
    bannerSub: $("bannerSub"), toast: $("toast"), touch: $("touchControls"),
    lobbyModal: $("lobbyModal"), lobbyCodeInput: $("lobbyCodeInput"), lobbyCodeDisplay: $("lobbyCodeDisplay"),
    lobbyPlayersList: $("lobbyPlayersList"), lobbyHint: $("lobbyHint"),
    btnStartLobby: $("btnStartLobby"), btnCreateLobby: $("btnCreateLobby"),
    btnJoinLobby: $("btnJoinLobby"), btnLeaveLobby: $("btnLeaveLobby"),
    btnDifficulty: $("btnDifficulty"),
    // --- AJOUTS AUTH FIREBASE ---
    authEmail: $("authEmail"), authPassword: $("authPassword"), userStatus: $("userStatus"),
    btnLogin: $("btnLogin"), btnRegister: $("btnRegister"), btnLogout: $("btnLogout")
  };

  /* ============================== DONNÉES ============================== */
  const defaults = {
    sensX: 1, sensY: 1, invertY: false, quality: "high", shadows: true,
    particles: true, fov: 75, showFps: false, master: 0.8, music: 0.5,
    sfx: 0.8, view: "first", shake: true, damageNumbers: true
  };
  const defaultKeys = {
    forward: "KeyZ", back: "KeyS", left: "KeyQ", right: "KeyD",
    jump: "Space", dodge: "ShiftLeft", interact: "KeyE", view: "KeyV",
    pause: "Escape", shoot: "Mouse0"
  };
  const keyLabels = {
    forward: "Avancer", back: "Reculer", left: "Aller à gauche",
    right: "Aller à droite", jump: "Sauter", dodge: "Esquiver",
    interact: "Utiliser l'ascenseur", view: "Changer de vue",
    pause: "Pause", shoot: "Attaquer / Tirer"
  };
  const difficulties = [
    { name: "Facile", enemyHp: 55, enemyDamage: 7, playerHp: 130, drop: 0.38 },
    { name: "Normale", enemyHp: 75, enemyDamage: 10, playerHp: 100, drop: 0.26 },
    { name: "Difficile", enemyHp: 105, enemyDamage: 15, playerHp: 85, drop: 0.16 }
  ];

  const biomes = [
    { title: "Bosquet Céleste",     sky: 0x0c1a15, ground: 0x1f382b, accent: 0x50e3c2, decor: "grove" },
    { title: "Cratère de Magma",    sky: 0x2a140e, ground: 0x402018, accent: 0xff5722, decor: "magma" },
    { title: "Pics de Givre",       sky: 0x0f2027, ground: 0x203a43, accent: 0x00d2ff, decor: "frost" },
    { title: "Ruines de l'Éther",   sky: 0x1d1724, ground: 0x2d2338, accent: 0xb388ff, decor: "ruins" },
    { title: "Palais du Mini-Boss", sky: 0x201018, ground: 0x3d1c2b, accent: 0xff4081, decor: "palace" },
    { title: "Jardins Suspendus",   sky: 0x102030, ground: 0x1e354d, accent: 0x00e676, decor: "grove" },
    { title: "Canyon Ardent",       sky: 0x30150a, ground: 0x522410, accent: 0xffab00, decor: "magma" },
    { title: "Abysse Glacé",        sky: 0x111b24, ground: 0x243545, accent: 0x80d8ff, decor: "frost" },
    { title: "Ruines Sombres",      sky: 0x1d1424, ground: 0x322240, accent: 0xe040fb, decor: "ruins" },
    { title: "Trône du Boss Final", sky: 0x090a10, ground: 0x1e1926, accent: 0xf50057, decor: "throne" }
  ];

  const enemyDefs = {
    melee:    { name: "Rôdeur",   color: 0xd32f2f, radius: 0.42, body: 0.55, hp: 1.0, speed: 1.0,  dmg: 1.0, reach: 1.5, windup: 0.45, cooldown: 1.2, score: 1 },
    charger:  { name: "Chargeur", color: 0xf57c00, radius: 0.45, body: 0.55, hp: 0.9, speed: 0.95, dmg: 1.2, reach: 1.5, windup: 0.5,  cooldown: 1.6, score: 1.3 },
    ranged:   { name: "Tireur",   color: 0x00acc1, radius: 0.40, body: 0.5,  hp: 0.7, speed: 0.85, dmg: 1.0, windup: 0.4, cooldown: 1.9, score: 1.3 },
    brute:    { name: "Brute",    color: 0x7e57c2, radius: 0.72, body: 0.9,  hp: 2.6, speed: 0.6,  dmg: 1.9, reach: 2.1, windup: 0.8,  cooldown: 2.0, score: 2.2 },
    miniboss: { name: "Gardien de Pierre",  color: 0xff642b, radius: 0.8,  body: 1.0, flatHp: 850,  speed: 0.95, dmg: 1.4, boss: true },
    boss:     { name: "Souverain d'Aether", color: 0xb449ff, radius: 0.95, body: 1.4, flatHp: 2200, speed: 1.1,  dmg: 1.5, boss: true }
  };

  const levelPlans = [
    null,
    [["melee", 3]],
    [["melee", 3], ["charger", 1]],
    [["melee", 2], ["ranged", 2]],
    [["charger", 2], ["ranged", 2], ["melee", 1]],
    [["miniboss", 1]],
    [["melee", 3], ["ranged", 2], ["charger", 1]],
    [["charger", 3], ["ranged", 2]],
    [["brute", 2], ["ranged", 2], ["charger", 1]],
    [["brute", 2], ["charger", 2], ["ranged", 3]],
    [["boss", 1]]
  ];

  /* ============================== STOCKAGE ============================== */
  const readStorage = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch (error) {
      console.warn(`Impossible de lire ${key}`, error);
      return fallback;
    }
  };
  const saveStorage = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Impossible d'enregistrer ${key}`, error);
    }
  };

  let settings = { ...defaults, ...readStorage("towerSettings", {}) };
  let keys = { ...defaultKeys, ...readStorage("towerKeys", {}) };
  let hardModeUnlocked = Boolean(readStorage("towerHardUnlocked", false));
  let difficulty = Number(readStorage("towerDifficulty", 1));
  if (!Number.isInteger(difficulty) || difficulty < 0 || difficulty >= difficulties.length) difficulty = 1;
  if (difficulty === 2 && !hardModeUnlocked) difficulty = 1;
  let records = { bestScore: 0, bestTime: 0, bestLevel: 1, wins: 0, kills: 0, ...readStorage("towerRecords", {}) };

  /* ============================== ÉTAT ============================== */
  let renderer, scene, camera, clock, sun, hemi;
  let state = "menu";   // menu | playing | paused | upgrade | elevator | slowmo | ended
  let level = 1, score = 0, elapsed = 0, kills = 0;
  let player = null;    // THREE.Vector3 (position des pieds, en coordonnées monde)
  let playerMesh = null, gunView = null, gunViewKick = 0;
  let enemies = [], projectiles = [], particles = [], effects = [], pickups = [], weatherParticles = [];
  let obstacles = [], blockers = [], hazards = [], animated = [], placedDecor = [];
  let platformGroup = null, elevatorGroup = null, elevatorActive = false, elevatorTravel = null;
  let towerGhosts = [], stars = null;
  let yaw = 0, pitch = 0, verticalVelocity = 0, grounded = true;
  let playerHp = 100, maxHp = 100, damageBonus = 0, speedBonus = 0;
  let dodgeCooldown = 0, invulnerable = 0, fireCooldown = 0, dashTime = 0;
  const dashDir = { x: 0, z: 0 };
  let toastTimer = 0, bannerTimer = 0, hitmarkerTimer = 0, lastFpsUpdate = 0, frames = 0;
  let damageFlash = 0, shakePower = 0, hazardTimer = 0, hudTimer = 0, lightningCooldown = 6;
  let combo = 0, comboTimer = 0;
  let keyCapture = null, held = new Set(), mouseHeld = false;
  let settingsReturn = "menu", worldTime = 0, slowMoTimer = 0;
  let audioContext = null, masterGain, musicGain, sfxGain, musicTimer = 0, musicNote = 0;
  let touchJoystick = { active: false, x: 0, y: 0, id: null };
  let lookTouch = { id: null, x: 0, y: 0 };
  let padPrev = {};
  let runStats = { kills: 0 };

  const raycaster = typeof THREE !== "undefined" ? new THREE.Raycaster() : null;
  const cameraDirection = typeof THREE !== "undefined" ? new THREE.Vector3() : null;
  const cameraPosition = typeof THREE !== "undefined" ? new THREE.Vector3() : null;
  const moveVector = typeof THREE !== "undefined" ? new THREE.Vector3() : null;
  const forwardVector = typeof THREE !== "undefined" ? new THREE.Vector3() : null;
  const rightVector = typeof THREE !== "undefined" ? new THREE.Vector3() : null;

  /* ============================== INTERFACE : MESSAGES ============================== */
  function showToast(message) {
    if (!ui.toast) return;
    ui.toast.textContent = message;
    ui.toast.classList.add("show");
    toastTimer = 2.4;
  }

  function showBanner(title, subtitle) {
    if (!ui.bannerTitle) return;
    ui.bannerTitle.textContent = title;
    ui.bannerSub.textContent = subtitle || "";
    ui.banner.classList.add("show");
    bannerTimer = 2.6;
  }

  /* ============================== AUDIO PROCÉDURAL ============================== */
  function ensureAudio() {
    try {
      if (audioContext) {
        if (audioContext.state === "suspended") audioContext.resume();
        return true;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      audioContext = new AC();
      masterGain = audioContext.createGain();
      musicGain = audioContext.createGain();
      sfxGain = audioContext.createGain();
      musicGain.connect(masterGain);
      sfxGain.connect(masterGain);
      masterGain.connect(audioContext.destination);
      updateAudio();
      return true;
    } catch (e) {
      console.warn("Audio indisponible", e);
      return false;
    }
  }

  function playTone(frequency, duration, waveform = "sine", volume = 0.12, slideTo = 0) {
    if (settings.master <= 0 || settings.sfx <= 0) return;
    if (!ensureAudio()) return;
    try {
      const t = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = waveform;
      oscillator.frequency.setValueAtTime(frequency, t);
      if (slideTo > 0) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + duration);
      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      oscillator.connect(gain);
      gain.connect(sfxGain);
      oscillator.start(t);
      oscillator.stop(t + duration + 0.02);
    } catch (e) {
      console.warn("Audio exception", e);
    }
  }

  const sfx = {
    shoot: () => playTone(540, 0.09, "square", 0.06, 240),
    hit: () => playTone(260, 0.07, "square", 0.07),
    crit: () => playTone(760, 0.14, "triangle", 0.1, 1200),
    kill: () => playTone(190, 0.22, "triangle", 0.12, 70),
    hurt: () => playTone(95, 0.22, "sawtooth", 0.18, 50),
    dodge: () => playTone(230, 0.16, "triangle", 0.1, 470),
    jump: () => playTone(320, 0.1, "sine", 0.08, 480),
    pickup: () => { playTone(660, 0.1, "sine", 0.1); setTimeout(() => playTone(880, 0.14, "sine", 0.1), 80); },
    ready: () => { playTone(520, 0.2, "triangle", 0.12); setTimeout(() => playTone(780, 0.3, "triangle", 0.12), 140); },
    lift: () => playTone(70, 2.2, "sawtooth", 0.1, 150),
    slam: () => playTone(70, 0.4, "sine", 0.3, 28),
    phase: () => playTone(120, 0.9, "sawtooth", 0.16, 40),
    thunder: () => playTone(90, 0.6, "sawtooth", 0.07, 35),
    win: () => [392, 523, 659, 784, 1046].forEach((f, i) => setTimeout(() => playTone(f, 0.35, "triangle", 0.12), i * 120)),
    lose: () => [330, 262, 196, 130].forEach((f, i) => setTimeout(() => playTone(f, 0.45, "sawtooth", 0.1), i * 220))
  };

  function playMusicBeat() {
    if (!audioContext || !musicGain || state === "paused" || state === "menu" || settings.music <= 0) return;
    const notes = level === 10 ? [110, 146.83, 164.81, 130.81] : [130.81, 164.81, 196, 164.81];
    const osc = audioContext.createOscillator();
    const g = audioContext.createGain();
    const intensity = 0.025 + Math.min(level, 10) * 0.004;
    const t = audioContext.currentTime;
    osc.type = "triangle";
    osc.frequency.value = notes[musicNote++ % notes.length];
    g.gain.setValueAtTime(intensity, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
    osc.connect(g);
    g.connect(musicGain);
    osc.start(t);
    osc.stop(t + 0.68);
  }

  function updateAudio() {
    if (!audioContext) return;
    const t = audioContext.currentTime;
    masterGain.gain.setTargetAtTime(Number(settings.master), t, 0.04);
    musicGain.gain.setTargetAtTime(Number(settings.music), t, 0.04);
    sfxGain.gain.setTargetAtTime(Number(settings.sfx), t, 0.04);
  }

  /* ============================== NAVIGATION & ÉCRANS UI ============================== */
  function setScreen(screen) {
    const achScr = $("achievementsScreen");
    for (const el of [ui.main, ui.settings, ui.pause, ui.upgrade, ui.end, ui.scores, ui.lobbyModal, achScr]) {
      if (el) el.classList.add("hidden");
    }
    if (screen) screen.classList.remove("hidden");
    const isTouch = "ontouchstart" in window;
    if (ui.touch) ui.touch.classList.toggle("hidden", !(isTouch && (state === "playing" || state === "elevator")));
  }

  function lockPointer() {
    if ("ontouchstart" in window) return;
    try {
      const r = ui.canvas.requestPointerLock && ui.canvas.requestPointerLock();
      if (r && r.catch) r.catch(() => {});
    } catch (e) { /* ignoré */ }
  }
  function unlockPointer() {
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* ignoré */ }
  }

  function updateDifficultyButton() {
    if (!ui.btnDifficulty) return;
    ui.btnDifficulty.textContent = "Difficulté : " + difficulties[difficulty].name;
    ui.btnDifficulty.classList.toggle("locked", false);
  }

  function cycleDifficulty() {
    const max = hardModeUnlocked ? difficulties.length : 2;
    difficulty = (difficulty + 1) % max;
    saveStorage("towerDifficulty", difficulty);
    updateDifficultyButton();
    if (!hardModeUnlocked && difficulty === 0) showToast("Le mode Difficile se débloque en battant le Souverain d'Aether.");
  }

  function formatTime(s) {
    const t = Math.floor(s);
    return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  }

  function openScores() {
    if (ui.scoresBody) {
      ui.scoresBody.innerHTML = `
        <div><span>Meilleur score</span><strong>${records.bestScore}</strong></div>
        <div><span>Étage le plus haut</span><strong>${records.bestLevel} / ${MAX_LEVEL}</strong></div>
        <div><span>Meilleur temps (victoire)</span><strong>${records.bestTime ? formatTime(records.bestTime) : "—"}</strong></div>
        <div><span>Victoires</span><strong>${records.wins}</strong></div>
        <div><span>Ennemis vaincus (total)</span><strong>${records.kills}</strong></div>
        <div><span>Mode Difficile</span><strong>${hardModeUnlocked ? "Débloqué" : "Verrouillé"}</strong></div>`;
    }
    setScreen(ui.scores);
  }

  /* ============================== PARAMÈTRES & ONGLETS ============================== */
  function updateSettingsUI() {
    document.querySelectorAll("[data-s]").forEach((input) => {
      const name = input.dataset.s;
      if (input.type === "checkbox") input.checked = Boolean(settings[name]);
      else input.value = settings[name];
    });
    document.querySelectorAll("[data-v]").forEach((output) => {
      const name = output.dataset.v;
      const value = Number(settings[name]);
      const format = output.dataset.fmt;
      output.textContent = format === "pct" ? `${Math.round(value * 100)}%` :
        format === "deg" ? `${value}°` : `${value.toFixed(2)}×`;
    });
    if (ui.fpsText) ui.fpsText.classList.toggle("hidden", !settings.showFps);
    applyGraphicsSettings();
    updateAudio();
  }

  function renderKeyList() {
    const list = $("keyList");
    if (!list) return;
    list.replaceChildren();
    Object.entries(keyLabels).forEach(([action, label]) => {
      const row = document.createElement("label");
      row.className = "row";
      const text = document.createElement("span");
      text.textContent = label;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "keybtn";
      button.dataset.key = action;
      button.textContent = keyName(keys[action]);
      button.addEventListener("click", () => {
        if (keyCapture) keyCapture.classList.remove("waiting");
        keyCapture = button;
        button.classList.add("waiting");
        button.textContent = "Appuie sur une touche…";
      });
      row.append(text, button);
      list.append(row);
    });
    updateControlsHelp();
  }

  function updateControlsHelp() {
    const help = $("controlsHelp");
    if (!help) return;
    help.replaceChildren();
    const add = (code, label) => {
      const key = document.createElement("b");
      key.textContent = keyName(code);
      help.append(key, document.createTextNode(label));
    };
    add(keys.forward, " ");
    add(keys.left, " ");
    add(keys.back, " ");
    add(keys.right, " Déplacement · ");
    add(keys.shoot, " Tir · ");
    add(keys.jump, " Saut · ");
    add(keys.dodge, " Esquive · ");
    add(keys.interact, " Ascenseur");
  }

  function keyName(code) {
    if (code.startsWith("Mouse")) return `Souris ${Number(code.slice(5)) + 1}`;
    if (code.startsWith("Key")) return code.slice(3);
    if (code.startsWith("Digit")) return code.slice(5);
    return ({ Space: "Espace", ShiftLeft: "Maj Gauche", ShiftRight: "Maj Droite",
      Escape: "Échap", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" })[code] || code;
  }

  function assignKey(action, code) {
    const other = Object.keys(keys).find((a) => a !== action && keys[a] === code);
    if (other) keys[other] = keys[action];
    keys[action] = code;
    saveStorage("towerKeys", keys);
    renderKeyList();
  }

  /* ============================== RENDERER THREE.JS & GEOMETRIES ============================== */
  const cache = { geo: {}, mat: {} };
  function sharedGeo(name, make) {
    if (!cache.geo[name]) cache.geo[name] = make();
    return cache.geo[name];
  }
  function basicMat(color) {
    const k = "b" + color;
    if (!cache.mat[k]) cache.mat[k] = new THREE.MeshBasicMaterial({ color });
    return cache.mat[k];
  }

  function createMaterial(color, roughness = 0.7, metalness = 0.1) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
  }

  function createCapsule(radius, cylinderHeight, material) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 14, 10), material);
    mesh.scale.y = (cylinderHeight + radius * 2) / (radius * 2);
    return mesh;
  }

  function shadowify(obj, cast = true, receive = false) {
    obj.traverse((o) => {
      if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; }
    });
    return obj;
  }

  function disposeTree(obj) {
    if (!obj) return;
    obj.traverse((o) => {
      if (o.geometry && o.geometry.dispose) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
      mats.forEach((m) => {
        if (m.map && m.map.dispose) m.map.dispose();
        if (m.dispose) m.dispose();
      });
    });
  }

  function initGraphics() {
    if (!window.THREE) throw new Error("Three.js introuvable.");
    renderer = new THREE.WebGLRenderer({ canvas: ui.canvas, antialias: true });
    renderer.shadowMap.enabled = Boolean(settings.shadows);
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090a10);
    scene.fog = new THREE.Fog(0x090a10, 25, 110);
    camera = new THREE.PerspectiveCamera(Number(settings.fov), 1, 0.1, 220);
    camera.rotation.order = "YXZ";
    scene.add(camera);
    clock = new THREE.Clock();
    player = new THREE.Vector3(SPAWN.x, 0, SPAWN.z);

    hemi = new THREE.HemisphereLight(0xb8d8ff, 0x221528, 1.2);
    scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffdfad, 1.3);
    sun.position.set(-8, 16, 8);
    sun.castShadow = true;
    sun.shadow.camera.left = -22; sun.shadow.camera.right = 22;
    sun.shadow.camera.top = 22; sun.shadow.camera.bottom = -22;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 70;
    sun.shadow.bias = -0.0005;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);
    scene.add(sun.target);

    buildStars();
    buildTower();
    buildGunView();
    resize();
    updateSettingsUI();
    buildPlatform({ menu: true });
    requestAnimationFrame(loop);
  }

  function applyGraphicsSettings() {
    if (!renderer) return;
    const q = settings.quality;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === "low" ? 1 : q === "medium" ? 1.5 : 2));
    const shadowsOn = Boolean(settings.shadows) && q !== "low";
    if (renderer.shadowMap.enabled !== shadowsOn) {
      renderer.shadowMap.enabled = shadowsOn;
      scene.traverse((o) => {
        const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
        mats.forEach((m) => { m.needsUpdate = true; });
      });
    }
    if (sun) {
      sun.castShadow = shadowsOn;
      const size = q === "high" ? 2048 : 1024;
      if (sun.shadow.mapSize.x !== size) {
        sun.shadow.mapSize.set(size, size);
        if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      }
    }
    if (camera) {
      camera.fov = Number(settings.fov);
      camera.updateProjectionMatrix();
    }
    resize();
  }

  function resize() {
    if (!renderer || !camera) return;
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function buildStars() {
    const count = 700, positions = new Float32Array(count * 3), rng = mulberry32(42);
    for (let i = 0; i < count; i++) {
      const u = rng() * 2 - 1, a = rng() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      positions[i * 3] = Math.cos(a) * s * 180;
      positions[i * 3 + 1] = Math.abs(u) * 180 + 10;
      positions[i * 3 + 2] = Math.sin(a) * s * 180;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    stars = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.55, fog: false, depthWrite: false
    }));
    stars.frustumCulled = false;
    scene.add(stars);
  }

  function buildTower() {
    const slab = new THREE.BoxGeometry(27, 0.8, 27);
    const mat = createMaterial(0x0f1118, 0.9, 0.1);
    for (let i = 0; i < MAX_LEVEL; i++) {
      const m = new THREE.Mesh(slab, mat);
      m.position.set(0, i * LEVEL_HEIGHT - 0.5, 0);
      m.receiveShadow = true;
      m.visible = false;
      scene.add(m);
      towerGhosts.push(m);
    }
    const railMat = new THREE.MeshBasicMaterial({ color: 0x1a5f7a });
    const rail = new THREE.BoxGeometry(0.08, 80, 0.08);
    [[-1.45, -1.45], [1.45, -1.45], [-1.45, 1.45], [1.45, 1.45]].forEach(([dx, dz]) => {
      const r = new THREE.Mesh(rail, railMat);
      r.position.set(LIFT.x + dx, 20, LIFT.z + dz);
      scene.add(r);
    });
  }

  /* ============================== DÉCORS & PLATEFORMES ============================== */
  function makeGroundTexture(baseColor, accent) {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = hexCss(baseColor);
    g.fillRect(0, 0, 256, 256);
    const rng = mulberry32(baseColor);
    for (let i = 0; i < 1600; i++) {
      const a = rng() * 0.14;
      g.fillStyle = rng() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a * 0.7})`;
      g.fillRect(rng() * 256, rng() * 256, 2 + rng() * 4, 2 + rng() * 4);
    }
    g.strokeStyle = "rgba(0,0,0,0.5)";
    g.lineWidth = 3;
    for (let i = 0; i <= 256; i += 64) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
    }
    g.strokeStyle = hexCss(accent);
    g.globalAlpha = 0.22;
    g.lineWidth = 1;
    for (let i = 0; i <= 256; i += 64) {
      g.beginPath(); g.moveTo(i + 3, 0); g.lineTo(i + 3, 256); g.stroke();
    }
    g.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(5, 5);
    return tex;
  }

  function addBox(parent, x, y, z, sx, sy, sz, material, shadows = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function addObstacle(object, x, z, radius, height) {
    platformGroup.add(object);
    object.position.x = x;
    object.position.z = z;
    shadowify(object, true, true);
    object.traverse((o) => { if (o.isMesh) o.userData.blocker = true; });
    blockers.push(object);
    obstacles.push({ x, z, radius, height });
    placedDecor.push({ x, z, r: radius });
  }

  function scatter(count, rmin, rmax, rng, gap = 2.2) {
    const out = [];
    let tries = 0;
    while (out.length < count && tries++ < 300) {
      const a = rng() * Math.PI * 2, r = rmin + rng() * (rmax - rmin);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(x) > ARENA - 0.7 || Math.abs(z) > ARENA - 0.7) continue;
      if (Math.hypot(x - LIFT.x, z - LIFT.z) < LIFT.radius + 1.6) continue;
      if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 3.2) continue;
      if (placedDecor.some((p) => Math.hypot(p.x - x, p.z - z) < gap + p.r)) continue;
      out.push({ x, z });
      placedDecor.push({ x, z, r: 0.4 });
    }
    return out;
  }

  function addPlatformDecor(biome) {
    const rng = mulberry32(level * 7919 + 13);
    const accent = new THREE.Color(biome.accent);
    const dark = createMaterial(0x1b1a22, 0.85, 0.1);
    const glowMat = new THREE.MeshStandardMaterial({
      color: biome.accent, emissive: biome.accent, emissiveIntensity: 0.9, roughness: 0.3
    });

    if (biome.decor === "grove") {
      const trunk = createMaterial(0x5a3b22, 1, 0);
      const leaf = new THREE.MeshStandardMaterial({ color: accent.clone().multiplyScalar(0.55), roughness: 0.8, flatShading: true });
      scatter(6, 3.5, 8.3, rng, 2.4).forEach((p) => {
        const s = 0.85 + rng() * 0.7, tree = new THREE.Group();
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.28 * s, 1.7 * s, 7), trunk);
        t.position.y = 0.85 * s;
        const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.15 * s, 2.2 * s, 8), leaf);
        c1.position.y = 2.4 * s;
        const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.85 * s, 1.8 * s, 8), leaf);
        c2.position.y = 3.5 * s;
        tree.add(t, c1, c2);
        addObstacle(tree, p.x, p.z, 0.5 * s, 4 * s);
      });
      scatter(3, 3, 8, rng, 1.8).forEach((p) => {
        const fly = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), glowMat);
        fly.position.set(p.x, 1.2 + rng() * 1.5, p.z);
        platformGroup.add(fly);
        animated.push({ mesh: fly, baseY: fly.position.y, bob: 2 + rng() * 2, phase: rng() * 6, spin: 0 });
      });
    } else if (biome.decor === "magma") {
      const lava = new THREE.MeshStandardMaterial({ color: 0xff4a00, emissive: 0xff3300, emissiveIntensity: 1.3, roughness: 0.6 });
      scatter(3, 2.5, 7.5, rng, 3.2).forEach((p) => {
        const r = 1.1 + rng() * 0.6;
        const pool = new THREE.Mesh(new THREE.CircleGeometry(r, 28), lava);
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(p.x, 0.03, p.z);
        platformGroup.add(pool);
        hazards.push({ x: p.x, z: p.z, r: r * 0.92 });
        animated.push({ mesh: pool, baseY: 0.03, bob: 0, phase: rng() * 6, spin: 0, pulse: lava });
      });
      scatter(5, 3.5, 8.3, rng, 2.4).forEach((p) => {
        const h = 2 + rng() * 1.8, spike = new THREE.Mesh(new THREE.ConeGeometry(0.55 + rng() * 0.3, h, 6), dark);
        spike.position.y = h / 2;
        addObstacle(spike, p.x, p.z, 0.6, h);
      });
    } else if (biome.decor === "frost") {
      const ice = new THREE.MeshStandardMaterial({
        color: 0x9be7ff, emissive: 0x1a5f80, emissiveIntensity: 0.5, transparent: true, opacity: 0.82, roughness: 0.1, metalness: 0.3
      });
      scatter(6, 3.2, 8.3, rng, 2.2).forEach((p) => {
        const h = 1.8 + rng() * 2.4, crystal = new THREE.Mesh(new THREE.ConeGeometry(0.45 + rng() * 0.3, h, 5), ice);
        crystal.position.y = h / 2;
        crystal.rotation.z = (rng() - 0.5) * 0.2;
        addObstacle(crystal, p.x, p.z, 0.6, h);
      });
    } else if (biome.decor === "ruins") {
      const stone = createMaterial(0x57506a, 0.9, 0.05);
      scatter(5, 3.5, 8.3, rng, 2.4).forEach((p) => {
        const h = 2 + rng() * 2.6, pillar = new THREE.Group();
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, h, 10), stone);
        shaft.position.y = h / 2;
        const cap = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 1.4), stone);
        cap.position.y = h + 0.1;
        pillar.add(shaft, cap);
        addObstacle(pillar, p.x, p.z, 0.65, h);
      });
      scatter(2, 3.5, 8, rng, 2).forEach((p) => {
        const block = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 1.1), stone);
        block.position.y = 0.4;
        block.rotation.y = rng() * 3;
        addObstacle(block, p.x, p.z, 0.9, 0.8);
      });
    } else if (biome.decor === "palace" || biome.decor === "throne") {
      const stone = createMaterial(biome.decor === "throne" ? 0x15121c : 0x4a2a3a, 0.7, 0.2);
      const throne = biome.decor === "throne";
      const dais = new THREE.Mesh(new THREE.CylinderGeometry(throne ? 4.2 : 3.2, throne ? 4.5 : 3.4, 0.25, 36), stone);
      dais.position.set(0, 0.12, -3.5);
      dais.receiveShadow = true;
      platformGroup.add(dais);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(throne ? 4.2 : 3.2, 0.06, 8, 48), glowMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 0.27, -3.5);
      platformGroup.add(ring);
      const spots = throne
        ? [[-7.5, -2], [7.5, -2], [-7.5, 3], [7.5, 3], [-5, 7.5], [5, 7.5]]
        : [[-6.5, 3], [6.5, 3], [-6.5, -3], [6.5, -3]];
      spots.forEach(([x, z]) => {
        const h = throne ? 6 : 4, pillar = new THREE.Group();
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.75, h, 10), stone);
        shaft.position.y = h / 2;
        const flame = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), glowMat);
        flame.position.y = h + 0.35;
        pillar.add(shaft, flame);
        addObstacle(pillar, x, z, 0.75, h);
        animated.push({ mesh: flame, baseY: h + 0.35, bob: 3, phase: rng() * 6, spin: 0 });
      });
      if (throne) {
        for (let i = 0; i < 5; i++) {
          const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), glowMat);
          const a = (i / 5) * Math.PI * 2;
          shard.position.set(Math.cos(a) * 3.2, 3 + (i % 2), -3.5 + Math.sin(a) * 3.2);
          platformGroup.add(shard);
          animated.push({ mesh: shard, baseY: shard.position.y, bob: 1.6, phase: i, spin: 1.2 });
        }
      }
    }
  }

  function addElevator() {
    elevatorGroup = new THREE.Group();
    elevatorGroup.position.set(LIFT.x, 0, LIFT.z);
    const metal = createMaterial(0x485665, 0.3, 0.8);
    const lockedMat = new THREE.MeshStandardMaterial({ color: 0xff3d3d, emissive: 0xaa1111, emissiveIntensity: 1.2, metalness: 0.4, roughness: 0.3 });
    const activeMat = new THREE.MeshStandardMaterial({ color: 0x00d2ff, emissive: 0x0088cc, emissiveIntensity: 1.6, metalness: 0.4, roughness: 0.2 });
    const platform = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.28, 3.2), metal);
    platform.position.y = 0.18;
    platform.castShadow = true;
    platform.receiveShadow = true;
    elevatorGroup.add(platform);

    const inner = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.05, 2.7), lockedMat);
    inner.position.y = 0.35;
    elevatorGroup.add(inner);

    for (const x of [-1.45, 1.45]) {
      for (const z of [-1.45, 1.45]) {
        const column = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.2, 0.16), metal);
        column.position.set(x, 2.25, z);
        column.castShadow = true;
        elevatorGroup.add(column);
      }
    }
    const indicator = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.1), lockedMat);
    indicator.position.set(0, 4.35, 1.3);
    elevatorGroup.add(indicator);
    elevatorGroup.userData = { glowParts: [inner, indicator], lockedMat, activeMat };
    platformGroup.add(elevatorGroup);
  }

  function setElevatorActive(active) {
    elevatorActive = active;
    if (!elevatorGroup) return;
    const d = elevatorGroup.userData;
    d.glowParts.forEach((m) => { m.material = active ? d.activeMat : d.lockedMat; });
  }

  function clearDynamic() {
    projectiles.forEach((p) => scene.remove(p.mesh));
    particles.forEach((p) => scene.remove(p.mesh));
    effects.forEach((e) => { scene.remove(e.mesh); disposeTree(e.mesh); });
    pickups.forEach((p) => { scene.remove(p.mesh); disposeTree(p.mesh); });
    projectiles = []; particles = []; effects = []; pickups = [];
    if (ui.damageLayer) ui.damageLayer.replaceChildren();
  }

  function buildPlatform(opts = {}) {
    const menu = Boolean(opts.menu);
    if (platformGroup) { scene.remove(platformGroup); disposeTree(platformGroup); }
    clearDynamic();
    enemies = [];
    platformGroup = new THREE.Group();
    obstacles = []; blockers = []; hazards = []; animated = []; placedDecor = [];
    elevatorGroup = null;

    const biome = biomes[level - 1];
    const height = (level - 1) * LEVEL_HEIGHT;
    platformGroup.position.y = height;

    scene.background.setHex(biome.sky);
    scene.fog.color.setHex(biome.sky);

    const floorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: makeGroundTexture(biome.ground, biome.accent), roughness: 0.85, metalness: 0.05 });
    addBox(platformGroup, 0, -0.4, 0, 20, 0.8, 20, floorMat, false);

    const under = new THREE.Mesh(new THREE.ConeGeometry(14.5, 9, 4), createMaterial(0x2a2530, 1, 0));
    under.rotation.set(Math.PI, Math.PI / 4, 0);
    under.position.y = -0.8 - 4.5;
    platformGroup.add(under);

    const rimMat = new THREE.MeshStandardMaterial({ color: biome.accent, emissive: biome.accent, emissiveIntensity: 0.35, roughness: 0.4 });
    addBox(platformGroup, 0, 0.06, -9.7, 20, 0.12, 0.6, rimMat, false);
    addBox(platformGroup, 0, 0.06, 9.7, 20, 0.12, 0.6, rimMat, false);
    addBox(platformGroup, -9.7, 0.06, 0, 0.6, 0.12, 20, rimMat, false);
    addBox(platformGroup, 9.7, 0.06, 0, 0.6, 0.12, 20, rimMat, false);

    for (let i = 0; i < 4; i++) {
      const lamp = new THREE.PointLight(biome.accent, 1.5, 16);
      lamp.position.set(i % 2 ? 8 : -8, 2.6, i < 2 ? 8 : -8);
      platformGroup.add(lamp);
    }

    addPlatformDecor(biome);
    if (level < MAX_LEVEL) addElevator();
    scene.add(platformGroup);
    towerGhosts.forEach((g, i) => { g.visible = i + 1 < level; });

    setElevatorActive(false);
    initWeatherForBiome();

    if (menu) return;

    player.set(SPAWN.x, height, SPAWN.z);
    if (playerMesh) playerMesh.position.set(player.x, player.y, player.z);
    verticalVelocity = 0; grounded = true; yaw = 0; pitch = 0; dashTime = 0;
    elevatorTravel = null;
    spawnEnemies();

    showBanner(biome.title, level === 10 ? "Affronte le Souverain d'Aether !" : level === 5 ? "Affronte le Gardien de Pierre !" : "Nettoie la zone pour débloquer l'ascenseur");
    playTone(level === 10 ? 110 : 440, 0.25, "triangle");
    updateHud(true);
  }

  /* ============================== MÉTÉO & EFFETS D'AMBIANCE ============================== */
  function initWeatherForBiome() {
    weatherParticles.forEach((p) => scene.remove(p.mesh));
    if (weatherParticles.length && weatherParticles[0].mesh.geometry) {
      weatherParticles[0].mesh.geometry.dispose();
      weatherParticles[0].mesh.material.dispose();
    }
    weatherParticles = [];
    if (!settings.particles) return;

    const biome = biomes[level - 1];
    const decor = biome.decor;
    const count = decor === "throne" ? 120 : decor === "frost" ? 90 : 50;
    const geo = new THREE.SphereGeometry(decor === "throne" ? 0.03 : decor === "frost" ? 0.05 : 0.04, 4, 4);
    const mat = new THREE.MeshBasicMaterial({ color: biome.accent, transparent: true, opacity: 0.6 });
    const base = (level - 1) * LEVEL_HEIGHT;

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set((Math.random() - 0.5) * 30, base + Math.random() * 12, (Math.random() - 0.5) * 30);
      scene.add(mesh);
      weatherParticles.push({
        mesh,
        vy: decor === "throne" ? -12 : decor === "frost" ? -3 : decor === "magma" ? 1.2 + Math.random() : Math.sin(i) * 0.5,
        vx: decor === "frost" ? -2 : (Math.random() - 0.5) * 0.8
      });
    }
  }

  function updateWeather(dt) {
    const base = (level - 1) * LEVEL_HEIGHT;
    weatherParticles.forEach((p) => {
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.x += p.vx * dt;
      if (p.mesh.position.y < base) p.mesh.position.y = base + 12;
      if (p.mesh.position.y > base + 12) p.mesh.position.y = base;
      if (p.mesh.position.x < -15) p.mesh.position.x = 15;
      if (p.mesh.position.x > 15) p.mesh.position.x = -15;
    });

    if (state === "playing" && level === 10) {
      lightningCooldown -= dt;
      if (lightningCooldown <= 0) {
        lightningCooldown = rand(4, 9);
        const sky = biomes[9].sky;
        scene.background.setHex(0x556688);
        setTimeout(() => { if (scene && level === 10) scene.background.setHex(sky); }, 70);
        sfx.thunder();
      }
    }
  }

  function updateDecor() {
    animated.forEach((a) => {
      if (a.spin) a.mesh.rotation.y += a.spin * 0.016;
      if (a.bob) a.mesh.position.y = a.baseY + Math.sin(worldTime * a.bob + a.phase) * 0.15;
      if (a.pulse) a.pulse.emissiveIntensity = 1.1 + Math.sin(worldTime * 2 + a.phase) * 0.3;
    });
  }
  /* ============================== SKINS DE TIR & MODÈLES 3D ============================== */
  function createGun(colorOverride) {
    const customColor = colorOverride || localStorage.getItem("towerBulletColor") || 0x00e5ff;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.5), createMaterial(0x2b3442, 0.4, 0.7));
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.3), createMaterial(0x11151c, 0.3, 0.8));
    barrel.position.set(0, 0.02, -0.38);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.03, 0.22), new THREE.MeshBasicMaterial({ color: customColor }));
    glow.position.set(0, 0.08, -0.04);
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.02, -0.55);
    g.add(body, barrel, glow, muzzle);
    g.userData.muzzle = muzzle;
    return g;
  }

  function buildGunView() {
    gunView = createGun();
    gunView.position.set(0.26, -0.24, -0.5);
    gunView.visible = false;
    camera.add(gunView);
  }

  function createPlayerModel(color) {
    const group = new THREE.Group();
    const suit = createMaterial(color, 0.4, 0.3);
    const dark = createMaterial(0x1b2733, 0.6, 0.2);
    const torso = createCapsule(0.3, 0.55, suit);
    torso.position.y = 0.85;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), dark);
    head.position.y = 1.62;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.1), new THREE.MeshBasicMaterial({ color: 0x9ff3ff }));
    visor.position.set(0, 1.64, -0.17);
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.18), dark);
    pack.position.set(0, 1.0, 0.3);
    const gun = createGun();
    gun.position.set(0.3, 1.0, -0.3);
    gun.scale.setScalar(1.1);
    group.add(torso, head, visor, pack, gun);
    group.userData.gun = gun;
    shadowify(group, true, false);
    return group;
  }

  function startRunModels() {
    if (playerMesh) { scene.remove(playerMesh); disposeTree(playerMesh); }
    playerMesh = createPlayerModel(0x00bcd4);
    scene.add(playerMesh);
  }

  /* ============================== PARTICULES, EFFETS & TRACEURS ============================== */
  function spawnParticles(pos, color, count = 8, speed = 4) {
    if (!settings.particles || !pos) return;
    const geo = sharedGeo("pt", () => new THREE.SphereGeometry(0.08, 5, 5));
    const mat = basicMat(color);
    for (let i = 0; i < count; i++) {
      if (particles.length > 320) break;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      const s = 0.6 + Math.random() * 0.9;
      mesh.scale.setScalar(s);
      scene.add(mesh);
      particles.push({
        mesh, size: s,
        velocity: new THREE.Vector3((Math.random() - 0.5) * speed, Math.random() * speed * 0.7, (Math.random() - 0.5) * speed),
        life: 0.3 + Math.random() * 0.35, maxLife: 0.65
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.velocity.y -= 4 * dt;
      p.mesh.scale.setScalar(Math.max(0.04, p.size * (p.life / p.maxLife)));
      if (p.life <= 0) {
        scene.remove(p.mesh);
        particles.splice(i, 1);
      }
    }
  }

  function spawnRing(x, y, z, radius, color, duration, grow = true) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Mesh(sharedGeo("ring", () => new THREE.RingGeometry(0.88, 1, 40)), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y + 0.06, z);
    mesh.scale.setScalar(grow ? 0.05 : radius);
    scene.add(mesh);
    effects.push({ mesh, kind: "ring", t: 0, duration, radius, grow });
  }

  function spawnTracer(from, to, color) {
    const tracerColor = color || localStorage.getItem("towerBulletColor") || 0x7df9ff;
    const dir = to.clone().sub(from);
    const len = dir.length();
    if (len < 0.2) return;
    dir.normalize();
    const mesh = new THREE.Mesh(sharedGeo("tracer", () => new THREE.CylinderGeometry(0.018, 0.018, 1, 5)), basicMat(tracerColor));
    mesh.position.copy(from).addScaledVector(dir, len / 2);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    mesh.scale.set(1, len, 1);
    scene.add(mesh);
    effects.push({ mesh, kind: "tracer", t: 0, duration: 0.07, len });
  }

  function updateEffects(dt) {
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      e.t += dt;
      const k = clamp(e.t / e.duration, 0, 1);
      if (e.kind === "ring") {
        if (e.grow) e.mesh.scale.setScalar(Math.max(0.05, e.radius * k));
        e.mesh.material.opacity = e.grow ? 0.75 * (1 - k) : 0.35 + 0.4 * Math.sin(k * Math.PI * 6) * Math.sin(k * Math.PI * 6);
      } else if (e.kind === "tracer") {
        const w = 1 - k;
        e.mesh.scale.set(w, e.len, w);
      }
      if (e.t >= e.duration) {
        scene.remove(e.mesh);
        if (e.kind === "ring") e.mesh.material.dispose();
        effects.splice(i, 1);
      }
    }
  }

  function addShake(power) {
    if (settings.shake) shakePower = Math.max(shakePower, power);
  }

  function worldToScreen(v) {
    const p = v.clone().project(camera);
    return { x: (p.x * 0.5 + 0.5) * window.innerWidth, y: (-p.y * 0.5 + 0.5) * window.innerHeight, visible: p.z < 1 };
  }

  function floatingText(pos, text, cls = "") {
    if (!settings.damageNumbers || !ui.damageLayer || !camera) return;
    const s = worldToScreen(pos);
    if (!s.visible) return;
    if (ui.damageLayer.childElementCount > 24) return;
    const el = document.createElement("div");
    el.className = "dmg " + cls;
    el.textContent = text;
    el.style.left = `${s.x}px`;
    el.style.top = `${s.y}px`;
    ui.damageLayer.appendChild(el);
    setTimeout(() => el.remove(), 850);
  }

  function showHitmarker(kill) {
    if (!ui.hitmarker) return;
    ui.hitmarker.classList.add("show");
    ui.hitmarker.classList.toggle("kill", Boolean(kill));
    hitmarkerTimer = kill ? 0.22 : 0.1;
  }

  /* ============================== IA & LOGIQUE DES ENNEMIS ============================== */
  function createEnemyModel(kind, def) {
    const group = new THREE.Group();
    const mat = createMaterial(def.color, 0.45, 0.2);
    mat.emissive = new THREE.Color(0x000000);
    const r = def.radius;
    const bodyCenter = (def.body + r * 2) / 2 + 0.05;
    const body = createCapsule(r, def.body, mat);
    body.position.y = bodyCenter;
    group.add(body);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffeb3b });
    [-1, 1].forEach((s) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(r * 0.2, 8, 8), eyeMat);
      eye.position.set(s * r * 0.38, bodyCenter + r * 0.5, r * 0.85);
      group.add(eye);
    });

    const dark = createMaterial(0x15151c, 0.6, 0.3);
    if (kind === "charger") {
      [-1, 1].forEach((s) => {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 6), dark);
        horn.position.set(s * 0.22, bodyCenter + r + def.body * 0.5, 0.1);
        horn.rotation.x = 0.5;
        group.add(horn);
      });
    } else if (kind === "ranged") {
      const cannon = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.55), dark);
      cannon.position.set(0.38, bodyCenter, 0.35);
      group.add(cannon);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffa54b }));
      tip.position.set(0.38, bodyCenter, 0.65);
      group.add(tip);
    } else if (kind === "brute") {
      [-1, 1].forEach((s) => {
        const pad = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 8), dark);
        pad.position.set(s * (r + 0.15), bodyCenter + 0.35, 0);
        group.add(pad);
      });
    } else if (kind === "miniboss" || kind === "boss") {
      const crownMat = new THREE.MeshBasicMaterial({ color: kind === "boss" ? 0xff4dff : 0xffb347 });
      const n = kind === "boss" ? 7 : 5;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 5), crownMat);
        spike.position.set(Math.cos(a) * r * 0.7, bodyCenter + r + def.body * 0.5 + 0.1, Math.sin(a) * r * 0.7);
        group.add(spike);
      }
      [-1, 1].forEach((s) => {
        const pad = new THREE.Mesh(new THREE.SphereGeometry(r * 0.45, 10, 8), dark);
        pad.position.set(s * (r + 0.2), bodyCenter + 0.3, 0);
        group.add(pad);
      });
    }
    shadowify(group, true, false);
    return { group, body, mat, top: bodyCenter + r + def.body * 0.5 + 0.7 };
  }

  function createHealthBar() {
    const bar = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthTest: false }));
    const fgGeo = new THREE.PlaneGeometry(1, 0.08);
    fgGeo.translate(0.5, 0, 0);
    const fg = new THREE.Mesh(fgGeo, new THREE.MeshBasicMaterial({ color: 0xe74c3c, depthTest: false }));
    fg.position.set(-0.5, 0, 0.01);
    bg.renderOrder = 998;
    fg.renderOrder = 999;
    bar.add(bg, fg);
    bar.userData.fg = fg;
    return bar;
  }

  function spawnEnemyAt(kind, x, z, delay = 0, isMinion = false) {
    const def = enemyDefs[kind];
    const diff = difficulties[difficulty];
    const model = createEnemyModel(kind, def);
    const group = model.group;
    group.position.set(x, 0.05, z);
    platformGroup.add(group);

    const hp = def.flatHp ? def.flatHp * (diff.enemyHp / 75) : (diff.enemyHp + level * 14) * def.hp;
    const bar = createHealthBar();
    bar.visible = !def.boss;
    platformGroup.add(bar);

    const enemy = {
      kind, def, group, body: model.body, mat: model.mat, bar, barTop: model.top,
      x, z, hp, maxHp: hp, boss: Boolean(def.boss), isMinion,
      speed: (1.7 + level * 0.12) * def.speed,
      damage: diff.enemyDamage * (1 + (level - 1) * 0.07) * def.dmg,
      state: "spawn", timer: 0.7 + delay, attackCd: rand(0.6, 1.6), chargeCd: rand(2.5, 4.5),
      dirX: 0, dirZ: 0, hitFlash: 0, phase: 1, phaseTimer: 0, slamCd: 4, burstCd: 6, summonCd: 8,
      strafe: Math.random() < 0.5 ? -1 : 1, strafeTimer: rand(1, 2.5), bob: Math.random() * 6, slam: null, charged: false
    };
    group.visible = delay <= 0;
    group.traverse((o) => { if (o.isMesh) o.userData.enemy = enemy; });
    enemies.push(enemy);
    return enemy;
  }

  function spawnEnemies() {
    enemies = [];
    const plan = levelPlans[level];
    const boss = level === 5 || level === 10;
    const placed = [];
    let index = 0;
    plan.forEach(([kind, count]) => {
      for (let i = 0; i < count; i++) {
        let x = 0, z = -3.5;
        if (!boss) {
          for (let tries = 0; tries < 40; tries++) {
            const a = rand(0, Math.PI * 2), r = 3 + Math.random() * 5.4;
            x = Math.cos(a) * r; z = Math.sin(a) * r;
            const far = Math.hypot(x - SPAWN.x, z - SPAWN.z) >= 6.5;
            const free = !obstacles.some((o) => Math.hypot(x - o.x, z - o.z) < o.radius + 0.9);
            const apart = placed.every((p) => Math.hypot(p[0] - x, p[1] - z) > 2.4);
            const offLift = Math.hypot(x - LIFT.x, z - LIFT.z) > LIFT.radius;
            if (far && free && apart && offLift) break;
          }
        }
        placed.push([x, z]);
        spawnEnemyAt(kind, x, z, index * 0.12);
        index++;
      }
    });
  }

  function pushOutOfObstacles(pos, radius) {
    for (const o of obstacles) {
      const dx = pos.x - o.x, dz = pos.z - o.z;
      const d = Math.hypot(dx, dz), min = o.radius + radius;
      if (d < min && d > 0.0001) {
        pos.x = o.x + (dx / d) * min;
        pos.z = o.z + (dz / d) * min;
      }
    }
  }

  function enemyFace(e, dx, dz, dt, rate = 10) {
    const target = Math.atan2(dx, dz);
    let diff = target - e.group.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    e.group.rotation.y += diff * Math.min(1, rate * dt);
  }

  function fireProjectile(enemy, spread = 0, color = 0xff3366, speed = 0, size = 0) {
    const origin = new THREE.Vector3(enemy.x, platformGroup.position.y + (enemy.boss ? 1.6 : 1.0), enemy.z);
    const target = new THREE.Vector3(player.x, player.y + 1, player.z);
    const dir = target.sub(origin).normalize();
    if (spread) dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), spread);
    launchProjectile(origin, dir, enemy.damage * (enemy.boss ? 0.7 : 1), color, speed || (enemy.boss ? 9.5 : 7.5), size || (enemy.boss ? 0.24 : 0.15));
  }

  function launchProjectile(origin, dir, damage, color, speed, size) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 8), new THREE.MeshBasicMaterial({ color }));
    mesh.position.copy(origin);
    scene.add(mesh);
    projectiles.push({ mesh, velocity: dir.clone().multiplyScalar(speed), damage, life: 5, color });
  }

  function meleeAI(e, dt, dx, dz, dist) {
    const def = e.def;
    enemyFace(e, dx, dz, dt);
    if (e.state === "windup") {
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = "chase";
        e.attackCd = def.cooldown;
        if (Math.hypot(player.x - e.x, player.z - e.z) <= def.reach + 0.7) {
          damagePlayer(e.damage, e);
          spawnParticles(new THREE.Vector3(player.x, player.y + 1, player.z), 0xff5252, 8);
        }
        if (e.kind === "brute") {
          spawnRing(e.x, platformGroup.position.y, e.z, def.reach + 0.7, 0xb388ff, 0.35);
          addShake(0.25);
        }
      }
      return;
    }
    if (e.state === "stun") { e.timer -= dt; if (e.timer <= 0) e.state = "chase"; return; }
    if (e.state === "chargeWind") {
      e.timer -= dt;
      e.dirX = dx / dist; e.dirZ = dz / dist;
      if (e.timer <= 0) { e.state = "charge"; e.timer = 0.55; e.charged = false; sfx.dodge(); }
      return;
    }
    if (e.state === "charge") {
      e.timer -= dt;
      e.x += e.dirX * 12 * dt; e.z += e.dirZ * 12 * dt;
      if (!e.charged && dist < 1.2) { e.charged = true; damagePlayer(e.damage * 1.4, e); }
      if (e.timer <= 0) { e.state = "stun"; e.timer = 0.9; e.attackCd = 1.2; e.chargeCd = rand(4, 6.5); }
      return;
    }
    if (dist > def.reach * 0.8) {
      e.x += (dx / dist) * e.speed * dt;
      e.z += (dz / dist) * e.speed * dt;
    }
    e.attackCd -= dt;
    if (e.kind === "charger") {
      e.chargeCd -= dt;
      if (e.chargeCd <= 0 && dist > 4.5 && dist < 13) { e.state = "chargeWind"; e.timer = 0.65; return; }
    }
    if (dist <= def.reach && e.attackCd <= 0) { e.state = "windup"; e.timer = def.windup; }
  }

  function rangedAI(e, dt, dx, dz, dist) {
    enemyFace(e, dx, dz, dt);
    const ux = dx / dist, uz = dz / dist;
    if (e.state === "windup") {
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = "chase";
        e.attackCd = e.def.cooldown / (1 + level * 0.05);
        fireProjectile(e, 0, 0xffa54b);
        sfx.shoot();
      }
      return;
    }
    if (dist > 9) { e.x += ux * e.speed * dt; e.z += uz * e.speed * dt; }
    else if (dist < 5) { e.x -= ux * e.speed * dt; e.z -= uz * e.speed * dt; }
    else {
      e.strafeTimer -= dt;
      if (e.strafeTimer <= 0) { e.strafe *= -1; e.strafeTimer = rand(1.5, 3); }
      e.x += -uz * e.strafe * e.speed * 0.6 * dt;
      e.z += ux * e.strafe * e.speed * 0.6 * dt;
    }
    e.attackCd -= dt;
    if (e.attackCd <= 0 && dist < 14) { e.state = "windup"; e.timer = e.def.windup; }
  }

  function enterBossPhase(e, phase) {
    e.phase = phase;
    e.state = "phase";
    e.timer = 1.4;
    e.slam = null;
    spawnRing(e.x, platformGroup.position.y, e.z, 9, 0xc060ff, 0.9);
    spawnParticles(new THREE.Vector3(e.x, platformGroup.position.y + 2, e.z), 0xd678ff, 30, 9);
    addShake(0.7);
    sfx.phase();
    showBanner(`Phase ${phase}`, phase === 2 ? "Il se déchaîne !" : "Fureur !");
    const alive = enemies.filter((m) => m.isMinion).length;
    if (alive < 3) {
      const kind = e.kind === "boss" ? "ranged" : "melee";
      for (let i = 0; i < 2; i++) {
        const a = rand(0, Math.PI * 2);
        spawnEnemyAt(kind, clamp(e.x + Math.cos(a) * 4, -8, 8), clamp(e.z + Math.sin(a) * 4, -8, 8), 0, true);
      }
      showToast("Des renforts arrivent !");
    }
  }

  function bossAI(e, dt, dx, dz, dist) {
    const ratio = e.hp / e.maxHp;
    const phase = ratio <= 0.33 ? 3 : ratio <= 0.66 ? 2 : 1;
    if (phase > e.phase && e.state !== "phase") enterBossPhase(e, phase);
    enemyFace(e, dx, dz, dt, 6);
    const ux = dx / dist, uz = dz / dist;

    if (e.state === "phase") {
      e.timer -= dt;
      if (e.timer <= 0) e.state = "chase";
      return;
    }
    if (e.slam) {
      e.slam.t -= dt;
      if (e.slam.t <= 0) {
        const d = Math.hypot(player.x - e.x, player.z - e.z);
        if (d <= e.slam.radius && player.y - platformGroup.position.y < 1.1) damagePlayer(e.damage * 1.5, e);
        spawnRing(e.x, platformGroup.position.y, e.z, e.slam.radius, 0xff7043, 0.45);
        spawnParticles(new THREE.Vector3(e.x, platformGroup.position.y + 0.3, e.z), 0xffab91, 18, 7);
        addShake(0.55);
        sfx.slam();
        e.slam = null;
        e.slamCd = e.phase === 3 ? 4 : 6;
      }
      return;
    }

    const speed = e.speed * (e.phase === 3 ? 1.35 : 1);
    if (dist > 9) { e.x += ux * speed * dt; e.z += uz * speed * dt; }
    else if (dist < 4.5) { e.x -= ux * speed * 0.7 * dt; e.z -= uz * speed * 0.7 * dt; }
    else {
      e.strafeTimer -= dt;
      if (e.strafeTimer <= 0) { e.strafe *= -1; e.strafeTimer = rand(2, 4); }
      e.x += -uz * e.strafe * speed * 0.5 * dt;
      e.z += ux * e.strafe * speed * 0.5 * dt;
    }
    e.x = clamp(e.x, -ARENA, ARENA);
    e.z = clamp(e.z, -ARENA, ARENA);

    e.attackCd -= dt; e.slamCd -= dt; e.burstCd -= dt;
    const mini = e.kind === "miniboss";

    if (e.phase >= 2 && e.slamCd <= 0 && dist < 6) {
      e.slam = { t: 0.9, radius: 5.2 };
      spawnRing(e.x, platformGroup.position.y, e.z, 5.2, 0xff3d00, 0.9, false);
      return;
    }
    if (e.phase === 3 && !mini && e.burstCd <= 0) {
      e.burstCd = 7;
      const origin = new THREE.Vector3(e.x, platformGroup.position.y + 1.2, e.z);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        launchProjectile(origin, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), e.damage * 0.55, 0xff6a3a, 7, 0.2);
      }
      spawnRing(e.x, platformGroup.position.y, e.z, 3, 0xc060ff, 0.5);
      sfx.slam();
      return;
    }
    if (e.attackCd <= 0) {
      if (e.phase === 3) {
        e.attackCd = mini ? 1.3 : 0.95;
        const n = mini ? 1 : 2;
        for (let s = -n; s <= n; s++) fireProjectile(e, s * 0.2, 0xff0055);
      } else if (e.phase === 2) {
        e.attackCd = 1.35;
        fireProjectile(e, 0, 0xb449ff);
        fireProjectile(e, 0.35, 0xb449ff);
        fireProjectile(e, -0.35, 0xb449ff);
      } else {
        e.attackCd = 1.7;
        fireProjectile(e, 0, 0xd678ff);
      }
      sfx.shoot();
    }
  }

  function updateEnemies(dt) {
    const baseY = platformGroup.position.y;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      e.bob += dt * 2;
      if (e.hitFlash > 0) e.hitFlash -= dt;

      if (e.state === "spawn") {
        e.timer -= dt;
        if (e.timer <= 0.7 && !e.group.visible) e.group.visible = true;
        if (e.timer <= 0) { e.state = "chase"; e.group.position.y = 0.05; }
        else if (e.group.visible) e.group.position.y = 0.05 - Math.max(0, e.timer / 0.7) * 2.5;
        e.group.position.x = e.x; e.group.position.z = e.z;
        e.bar.visible = false;
        tintEnemy(e);
        continue;
      }

      const dx = player.x - e.x, dz = player.z - e.z;
      const dist = Math.max(0.001, Math.hypot(dx, dz));

      if (e.boss) bossAI(e, dt, dx, dz, dist);
      else if (e.kind === "ranged") rangedAI(e, dt, dx, dz, dist);
      else meleeAI(e, dt, dx, dz, dist);

      const pos = { x: e.x, z: e.z };
      pushOutOfObstacles(pos, e.def.radius);
      for (let j = 0; j < enemies.length; j++) {
        const o = enemies[j];
        if (o === e || o.state === "spawn") continue;
        const ox = pos.x - o.x, oz = pos.z - o.z, d = Math.hypot(ox, oz), min = e.def.radius + o.def.radius;
        if (d < min && d > 0.0001) { pos.x += (ox / d) * (min - d) * 0.5; pos.z += (oz / d) * (min - d) * 0.5; }
      }
      e.x = clamp(pos.x, -ARENA - 0.5, ARENA + 0.5);
      e.z = clamp(pos.z, -ARENA - 0.5, ARENA + 0.5);

      e.group.position.set(e.x, 0.05 + (e.state === "charge" ? 0 : Math.sin(e.bob) * 0.03), e.z);
      tintEnemy(e);

      if (!e.boss) {
        e.bar.visible = e.hp < e.maxHp;
        e.bar.position.set(e.x, e.barTop, e.z);
        e.bar.quaternion.copy(camera.quaternion);
        e.bar.userData.fg.scale.x = Math.max(0.001, e.hp / e.maxHp);
      }
    }
  }

  function tintEnemy(e) {
    const m = e.mat;
    const warn = e.state === "windup" || e.state === "chargeWind" || e.slam;
    if (e.hitFlash > 0) { m.emissive.setHex(0xffffff); m.emissiveIntensity = 0.8; }
    else if (e.state === "phase") { m.emissive.setHex(0xaa44ff); m.emissiveIntensity = 0.6 + 0.4 * Math.sin(worldTime * 30); }
    else if (warn) { m.emissive.setHex(0xff2200); m.emissiveIntensity = 0.5 + 0.4 * Math.sin(worldTime * 40); }
    else if (e.boss && e.phase === 3) { m.emissive.setHex(0x330011); m.emissiveIntensity = 1; }
    else { m.emissive.setHex(0x000000); m.emissiveIntensity = 0; }
  }

  function damageEnemy(e, amount, point, crit) {
    if (e.state === "spawn" || e.state === "phase") return;
    e.hp -= amount;
    e.hitFlash = 0.09;
    if (point) spawnParticles(point, crit ? 0xffe066 : (e.boss ? 0xd678ff : 0xffbd62), crit ? 10 : 5);
    floatingText(point || new THREE.Vector3(e.x, platformGroup.position.y + 1.6, e.z), String(Math.round(amount)), crit ? "crit" : "");
    if (e.hp <= 0) killEnemy(e);
    else { showHitmarker(false); crit ? sfx.crit() : sfx.hit(); }
  }

  function killEnemy(e, silent = false) {
    const idx = enemies.indexOf(e);
    if (idx === -1) return;
    enemies.splice(idx, 1);
    const wy = platformGroup.position.y;
    platformGroup.remove(e.group);
    platformGroup.remove(e.bar);
    disposeTree(e.group);
    disposeTree(e.bar);
    if (silent) return;

    unlockAchievement("first_blood");
    kills++;
    runStats.kills++;
    if (kills >= 10) unlockAchievement("kills_10");
    if (kills >= 50) unlockAchievement("kills_50");
    if (e.kind === "miniboss") unlockAchievement("miniboss");

    spawnParticles(new THREE.Vector3(e.x, wy + 1, e.z), e.boss ? 0xd500f9 : 0xff6e40, e.boss ? 40 : 14, e.boss ? 8 : 5);
    showHitmarker(true);
    sfx.kill();
    addShake(e.boss ? 1 : 0.15);

    combo = Math.min(combo + 1, 10);
    comboTimer = 4;
    if (combo >= 5) unlockAchievement("combo_5");
    if (combo >= 10) unlockAchievement("combo_10");

    const mult = 1 + (combo - 1) * 0.1;
    const gain = e.boss ? 3000 : Math.round(120 * level * (e.def.score || 1) * mult);
    score += gain;
    floatingText(new THREE.Vector3(e.x, wy + 2.2, e.z), `+${gain}`, "crit");

    if (!e.boss && Math.random() < difficulties[difficulty].drop) spawnPickup(e.x, e.z);

    if (e.boss) {
      [...enemies].forEach((m) => killEnemy(m, true));
    }
    checkLevelClear(e);
  }

  function checkLevelClear(lastKilled) {
    if (enemies.length > 0 || state !== "playing") return;
    if (level >= 5) unlockAchievement("floor_5");
    if (level >= 10) unlockAchievement("floor_10");

    if (level === MAX_LEVEL) {
      slowMoTimer = 1.8;
      state = "slowmo";
      if (ui.crosshair) ui.crosshair.classList.remove("on");
      showBanner("Victoire suprême !", "Le Souverain d'Aether est terrassé.");
      sfx.win();
      unlockAchievement("master");
    } else {
      score += 250 * level;
      setElevatorActive(true);
      spawnRing(LIFT.x, platformGroup.position.y, LIFT.z, 3.4, 0x00e5ff, 0.9);
      showBanner("Arène purifiée", "L'ascenseur est actif !");
      sfx.ready();
    }
  }

  /* ============================== BONUS & PICKUPS ============================== */
  function spawnPickup(x, z) {
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28, 0),
      new THREE.MeshStandardMaterial({ color: 0x38ff7a, emissive: 0x1fcf5a, emissiveIntensity: 1.2, roughness: 0.3 })
    );
    const y = platformGroup.position.y + 0.7;
    mesh.position.set(x, y, z);
    scene.add(mesh);
    pickups.push({ mesh, x, z, baseY: y, t: 0, life: 18 });
  }

  function updatePickups(dt) {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      p.t += dt; p.life -= dt;
      p.mesh.rotation.y += dt * 2.5;
      p.mesh.position.y = p.baseY + Math.sin(p.t * 3) * 0.12;
      const near = Math.hypot(player.x - p.x, player.z - p.z) < 1.3 && Math.abs(player.y + 0.8 - p.mesh.position.y) < 1.6;
      if (near && playerHp < maxHp) {
        const heal = Math.min(maxHp - playerHp, 18);
        playerHp += heal;
        floatingText(new THREE.Vector3(player.x, player.y + 1.8, player.z), `+${Math.round(heal)} PV`, "heal");
        sfx.pickup();
        spawnParticles(p.mesh.position, 0x38ff7a, 10);
        p.life = 0;
      }
      if (p.life <= 0) {
        scene.remove(p.mesh);
        disposeTree(p.mesh);
        pickups.splice(i, 1);
      }
    }
  }
  /* ============================== JOUEUR & CONTRÔLES ============================== */
  function blockedByObstacle(x, z) {
    for (const o of obstacles) {
      if (Math.hypot(x - o.x, z - o.z) < o.radius + 0.35) return true;
    }
    return false;
  }

  function tryMovePlayer(dx, dz) {
    const nx = clamp(player.x + dx, -ARENA, ARENA);
    const nz = clamp(player.z + dz, -ARENA, ARENA);
    if (!blockedByObstacle(nx, nz)) { player.x = nx; player.z = nz; return; }
    if (!blockedByObstacle(nx, player.z)) { player.x = nx; return; }
    if (!blockedByObstacle(player.x, nz)) { player.z = nz; }
  }

  function readMoveInput() {
    forwardVector.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    rightVector.set(Math.cos(yaw), 0, -Math.sin(yaw));
    moveVector.set(0, 0, 0);
    if (held.has(keys.forward) || held.has("ArrowUp")) moveVector.add(forwardVector);
    if (held.has(keys.back) || held.has("ArrowDown")) moveVector.sub(forwardVector);
    if (held.has(keys.right) || held.has("ArrowRight")) moveVector.add(rightVector);
    if (held.has(keys.left) || held.has("ArrowLeft")) moveVector.sub(rightVector);
    if (touchJoystick.active) {
      moveVector.addScaledVector(forwardVector, -touchJoystick.y);
      moveVector.addScaledVector(rightVector, touchJoystick.x);
    }
    const pad = getGamepad();
    if (pad) {
      if (Math.abs(pad.axes[0]) > 0.15) moveVector.addScaledVector(rightVector, pad.axes[0]);
      if (Math.abs(pad.axes[1]) > 0.15) moveVector.addScaledVector(forwardVector, -pad.axes[1]);
    }
  }

  function getGamepad() {
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const p of pads) if (p && p.connected) return p;
    } catch (e) {}
    return null;
  }

  function padPressed(pad, index, name) {
    const now = Boolean(pad.buttons[index] && pad.buttons[index].pressed);
    const was = Boolean(padPrev[name]);
    padPrev[name] = now;
    return now && !was;
  }

  function startDash() {
    if (dodgeCooldown > 0 || dashTime > 0) return;
    readMoveInput();
    if (moveVector.lengthSq() === 0) moveVector.copy(forwardVector);
    moveVector.normalize();
    dashDir.x = moveVector.x; dashDir.z = moveVector.z;
    dashTime = DASH_TIME;
    dodgeCooldown = DASH_COOLDOWN;
    invulnerable = Math.max(invulnerable, 0.38);
    spawnParticles(new THREE.Vector3(player.x, player.y + 0.5, player.z), 0x00d2ff, 8);
    sfx.dodge();
  }

  function tryJump() {
    if (!grounded) return;
    verticalVelocity = 6.6;
    grounded = false;
    sfx.jump();
  }

  function movePlayer(dt) {
    const speed = 5.4 + speedBonus;
    const floorY = platformGroup.position.y;
    const pad = getGamepad();
    if (pad) {
      yaw -= pad.axes[2] * 2.4 * dt * Number(settings.sensX);
      pitch = clamp(pitch - pad.axes[3] * 1.6 * dt * Number(settings.sensY) * (settings.invertY ? -1 : 1), -1.35, 1.35);
      if (padPressed(pad, 0, "jump")) tryJump();
      if (padPressed(pad, 1, "dodge")) startDash();
      if (padPressed(pad, 2, "interact")) interact();
      if (pad.buttons[7] && pad.buttons[7].pressed) shoot();
    }

    if (dashTime > 0) {
      dashTime -= dt;
      tryMovePlayer(dashDir.x * DASH_SPEED * dt, dashDir.z * DASH_SPEED * dt);
    } else {
      readMoveInput();
      if (moveVector.lengthSq() > 0) {
        if (moveVector.lengthSq() > 1) moveVector.normalize();
        tryMovePlayer(moveVector.x * speed * dt, moveVector.z * speed * dt);
      }
    }

    if (held.has(keys.jump)) tryJump();
    if (held.has(keys.dodge)) startDash();

    if (!grounded) {
      verticalVelocity -= 16 * dt;
      player.y += verticalVelocity * dt;
      if (player.y <= floorY) {
        player.y = floorY;
        verticalVelocity = 0;
        grounded = true;
      }
    }

    hazardTimer -= dt;
    if (grounded && hazardTimer <= 0 && hazards.some((h) => Math.hypot(player.x - h.x, player.z - h.z) < h.r)) {
      hazardTimer = 0.45;
      damagePlayer(4 + level, null, true);
      spawnParticles(new THREE.Vector3(player.x, player.y + 0.2, player.z), 0xff7a1a, 6);
    }

    if (playerMesh) {
      playerMesh.position.set(player.x, player.y, player.z);
      playerMesh.rotation.y = yaw;
    }
    netSendPosition(dt);
  }

  function damagePlayer(amount, source = null, ignoreInvuln = false) {
    if (state !== "playing") return;
    if (!ignoreInvuln && invulnerable > 0) return;
    if (ignoreInvuln && dashTime > 0) return;
    playerHp -= amount;
    invulnerable = Math.max(invulnerable, 0.25);
    damageFlash = 0.8;
    addShake(0.35);
    combo = 0; comboTimer = 0;
    sfx.hurt();
    if (playerHp <= 0) {
      playerHp = 0;
      finishGame(false);
    }
  }

  function shoot() {
    if (state !== "playing" || fireCooldown > 0) return;
    fireCooldown = 0.25;
    gunViewKick = 1;
    sfx.shoot();

    camera.updateMatrixWorld();
    camera.getWorldPosition(cameraPosition);
    camera.getWorldDirection(cameraDirection);
    raycaster.set(cameraPosition, cameraDirection);
    raycaster.far = 70;

    const targets = [];
    enemies.forEach((e) => e.group.traverse((o) => { if (o.isMesh) targets.push(o); }));
    blockers.forEach((b) => targets.push(b));
    const hits = raycaster.intersectObjects(targets, true);

    let endPoint = cameraPosition.clone().addScaledVector(cameraDirection, 45);
    let enemy = null, hitPoint = null;
    for (const h of hits) {
      if (h.object.userData && h.object.userData.enemy) { enemy = h.object.userData.enemy; hitPoint = h.point; endPoint = h.point.clone(); break; }
      if (h.object.userData && h.object.userData.blocker) { endPoint = h.point.clone(); spawnParticles(h.point, 0xcfd8dc, 4); break; }
    }

    const muzzle = new THREE.Vector3();
    const gun = settings.view === "first" ? gunView : (playerMesh && playerMesh.userData.gun);
    if (gun && gun.userData.muzzle) gun.userData.muzzle.getWorldPosition(muzzle);
    else muzzle.set(player.x, player.y + 1.3, player.z);
    spawnTracer(muzzle, endPoint);

    if (enemy) {
      const crit = Math.random() < 0.12;
      const dmg = (30 + damageBonus) * (crit ? 2 : 1);
      damageEnemy(enemy, dmg, hitPoint, crit);
    }
  }

  /* ============================== PROJECTILES ============================== */
  function updateProjectiles(dt) {
    const pPos = new THREE.Vector3();
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.life -= dt;
      pPos.set(player.x, player.y + 0.9, player.z);
      const pos = p.mesh.position;
      let remove = p.life <= 0;

      if (!remove && pos.distanceTo(pPos) < 0.75) {
        spawnParticles(pos, p.color, 6);
        damagePlayer(p.damage, null);
        remove = true;
      }
      if (!remove) {
        const floorY = platformGroup.position.y;
        for (const o of obstacles) {
          if (Math.hypot(pos.x - o.x, pos.z - o.z) < o.radius + 0.1 && pos.y - floorY < o.height) {
            spawnParticles(pos, p.color, 4);
            remove = true;
            break;
          }
        }
        if (pos.y < floorY - 0.2 || Math.abs(pos.x) > 14 || Math.abs(pos.z) > 14) remove = true;
      }
      if (remove) {
        scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        projectiles.splice(i, 1);
      }
    }
  }

  /* ============================== ASCENSEUR & BARS ============================== */
  function interact() {
    if (state !== "playing" || enemies.length || level >= MAX_LEVEL || !elevatorActive) return;
    if (Math.hypot(player.x - LIFT.x, player.z - LIFT.z) > LIFT.radius) {
      showToast("Approche-toi du socle lumineux de l'ascenseur.");
      return;
    }
    sfx.pickup();
    state = "upgrade";
    held.clear();
    unlockPointer();
    $("upHp").textContent = `Restaure 35 PV et +10 PV max (actuel : ${maxHp}).`;
    $("upSpeed").textContent = "Augmente la vitesse de déplacement (+15 %).";
    $("upDmg").textContent = "Augmente les dégâts de tes tirs (+18).";
    setScreen(ui.upgrade);
  }

  function chooseUpgrade(type) {
    if (state !== "upgrade") return;
    if (type === "hp") { maxHp += 10; playerHp = Math.min(maxHp, playerHp + 35); }
    if (type === "speed") speedBonus += 0.85;
    if (type === "dmg") damageBonus += 18;

    state = "elevator";
    player.set(LIFT.x, platformGroup.position.y + 0.35, LIFT.z);
    elevatorTravel = { elapsed: 0, duration: 2.4, start: player.y };
    sfx.lift();
    setScreen(null);
    lockPointer();
    clearDynamic();
    netPush({ level: level + 1 });
  }

  function updateElevator(dt) {
    if (!elevatorTravel || !elevatorGroup) return;
    elevatorTravel.elapsed = Math.min(elevatorTravel.duration, elevatorTravel.elapsed + dt);
    const progress = elevatorTravel.elapsed / elevatorTravel.duration;
    const eased = progress * progress * (3 - 2 * progress);

    elevatorGroup.position.y = eased * LEVEL_HEIGHT;
    player.y = elevatorTravel.start + eased * LEVEL_HEIGHT;
    if (playerMesh) playerMesh.position.set(player.x, player.y, player.z);
    addShake(0.04);

    if (progress >= 1) {
      level++;
      elevatorTravel = null;
      state = "playing";
      buildPlatform();
    }
  }

  function recordRun(won) {
    records.kills += runStats.kills;
    records.bestLevel = Math.max(records.bestLevel, level);
    const newBest = score > records.bestScore;
    if (newBest) records.bestScore = score;
    let unlocked = false;
    if (won) {
      records.wins++;
      if (!records.bestTime || elapsed < records.bestTime) records.bestTime = elapsed;
      if (!hardModeUnlocked) { hardModeUnlocked = true; unlocked = true; saveStorage("towerHardUnlocked", true); }
    }
    saveStorage("towerRecords", records);
    return { newBest, unlocked };
  }

  function finishGame(won) {
    if (state === "ended") return;
    state = "ended";
    mouseHeld = false;
    if (ui.crosshair) ui.crosshair.classList.remove("on");
    if (won) {
      const bonus = Math.max(0, Math.round((900 - elapsed) * 3));
      score += bonus;
    }
    const { newBest, unlocked } = recordRun(won);
    if (ui.endTitle) ui.endTitle.textContent = won ? "VICTOIRE !" : "DÉFAITE…";
    if (ui.endStats) {
      ui.endStats.innerHTML = `
        <div><span>Résultat</span><strong>${won ? "Tour conquise" : "Mort au combat"}</strong></div>
        <div><span>Étage atteint</span><strong>${level} / ${MAX_LEVEL}</strong></div>
        <div><span>Ennemis vaincus</span><strong>${runStats.kills}</strong></div>
        <div><span>Temps</span><strong>${formatTime(elapsed)}</strong></div>
        <div><span>Score total</span><strong>${score} pts${newBest ? " (record !)" : ""}</strong></div>
        ${unlocked ? "<div><span>Nouveau !</span><strong>Mode Difficile débloqué</strong></div>" : ""}`;
    }
    if (!won) sfx.lose();
    updateDifficultyButton();
    setScreen(ui.end);
    unlockPointer();
  }

  /* ============================== CAMÉRA & SUIVI ============================== */
  function updateCamera(real) {
    if (state === "menu" || !playerMesh) {
      camera.position.set(Math.sin(worldTime * 0.12) * 19, (level - 1) * LEVEL_HEIGHT + 9, Math.cos(worldTime * 0.12) * 19);
      camera.lookAt(0, (level - 1) * LEVEL_HEIGHT + 1.5, 0);
      if (gunView) gunView.visible = false;
      return;
    }
    const third = settings.view === "third";
    const eye = 1.55;
    camera.rotation.order = "YXZ";

    if (third) {
      const dist = 5.2;
      const behind = new THREE.Vector3(0, 1.1, dist).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      camera.position.set(player.x + behind.x, player.y + eye + behind.y - Math.sin(pitch) * 2.2, player.z + behind.z);
      camera.lookAt(
        player.x - Math.sin(yaw) * 10,
        player.y + eye + Math.sin(pitch) * 10,
        player.z - Math.cos(yaw) * 10
      );
    } else {
      camera.rotation.set(pitch, yaw, 0);
      camera.position.set(player.x, player.y + eye, player.z);
    }

    if (shakePower > 0.001) {
      camera.position.x += (Math.random() - 0.5) * shakePower * 0.25;
      camera.position.y += (Math.random() - 0.5) * shakePower * 0.25;
      camera.position.z += (Math.random() - 0.5) * shakePower * 0.25;
      shakePower *= Math.exp(-9 * real);
    }

    const targetFov = Number(settings.fov) + (dashTime > 0 ? 8 : 0);
    if (Math.abs(camera.fov - targetFov) > 0.1) {
      camera.fov = lerp(camera.fov, targetFov, 0.25);
      camera.updateProjectionMatrix();
    }

    playerMesh.visible = third;
    if (gunView) {
      gunView.visible = !third && state !== "ended";
      gunViewKick = Math.max(0, gunViewKick - real * 9);
      gunView.position.set(0.26, -0.24 + Math.sin(worldTime * 8) * 0.004 * (held.size ? 1 : 0), -0.5 + gunViewKick * 0.06);
      gunView.rotation.x = gunViewKick * 0.08;
    }
  }

  /* ============================== HUD & AFFICHAGE DYNAMIQUE ============================== */
  const hudCache = {};
  function setText(el, text) {
    if (!el) return;
    if (hudCache[el.id] !== text) { hudCache[el.id] = text; el.textContent = text; }
  }

  function updateHud(force = false) {
    if (!ui.hpFill) return;
    ui.hpFill.style.width = `${Math.max(0, playerHp / maxHp) * 100}%`;
    setText(ui.hpText, `${Math.ceil(Math.max(0, playerHp))} / ${maxHp}`);
    ui.dodgeFill.style.width = `${Math.max(0, 1 - dodgeCooldown / DASH_COOLDOWN) * 100}%`;
    setText(ui.level, `Plateforme ${level} / ${MAX_LEVEL} — ${biomes[level - 1].title}`);
    setText(ui.enemies, enemies.length ? `Ennemis restants : ${enemies.length}` :
      level === MAX_LEVEL ? "Souverain vaincu" : `Ascenseur débloqué — appuie sur ${keyName(keys.interact)}`);
    setText(ui.time, `Temps : ${formatTime(elapsed)}`);
    setText(ui.score, `Score : ${score}`);
    setText(ui.combo, combo >= 2 ? `Combo ×${(1 + (combo - 1) * 0.1).toFixed(1)}` : "");

    const boss = enemies.find((e) => e.boss);
    if (ui.bossBar) {
      ui.bossBar.classList.toggle("hidden", !boss);
      if (boss) {
        ui.bossFill.style.width = `${Math.max(0, boss.hp / boss.maxHp) * 100}%`;
        setText(ui.bossName, `${boss.def.name} (Phase ${boss.phase})`);
      }
    }

    let promptText = "";
    if (state === "playing" && level < MAX_LEVEL && enemies.length === 0) {
      const near = Math.hypot(player.x - LIFT.x, player.z - LIFT.z) < LIFT.radius;
      promptText = near ? `Appuie sur ${keyName(keys.interact)} pour utiliser l'ascenseur.` : "Approche-toi du socle lumineux pour monter.";
    }
    if (ui.prompt) {
      setText(ui.prompt, promptText);
      ui.prompt.classList.toggle("hidden", !promptText);
    }
  }

/* ============================== MULTIJOUEUR FIREBASE COMPLET ============================== */
  const net = {
    ready: false, db: null, ref: null, code: null, isHost: false, listener: null,
    id: "p_" + Math.random().toString(36).substring(2, 7), name: "", sendTimer: 0, remotes: {}, data: {}
  };
  net.name = "Joueur " + net.id.slice(2).toUpperCase();

  function ensureFirebase() {
    if (net.ready) return true;
    if (!window.firebase) {
      showToast("Erreur : La bibliothèque Firebase n'est pas chargée dans le HTML.");
      return false;
    }
    if (!FIREBASE_CONFIG.databaseURL || FIREBASE_CONFIG.databaseURL === "") {
      showToast("Erreur : Configure ton URL databaseURL dans FIREBASE_CONFIG.");
      return false;
    }
    try {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      net.db = firebase.database();
      net.ready = true;
      return true;
    } catch (e) {
      showToast("Erreur d'initialisation Firebase : " + e.message);
      return false;
    }
  }

  function makeRoomCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    return code;
  }

  function netCreateRoom() {
    if (!ensureFirebase()) return;
    const code = makeRoomCode();
    const roomRef = net.db.ref("rooms/" + code);
    roomRef.once("value").then((snap) => {
      if (snap.exists()) { netCreateRoom(); return; }
      return roomRef.set({ status: "lobby", host: net.id, created: Date.now() }).then(() => netEnterRoom(code, true));
    }).catch((e) => showToast("Création de salle impossible : " + e.message));
  }

  function netJoinRoom() {
    const code = (ui.lobbyCodeInput ? ui.lobbyCodeInput.value : "").trim().toUpperCase();
    if (!code) { showToast("Entre un code de salle valide."); return; }
    if (!ensureFirebase()) return;
    net.db.ref("rooms/" + code).once("value").then((snap) => {
      if (!snap.exists()) { showToast("Salle introuvable ou inexistante."); return; }
      netEnterRoom(code, false);
    }).catch((e) => showToast("Connexion impossible : " + e.message));
  }

  function netEnterRoom(code, host) {
    netLeaveRoom(true);
    net.code = code;
    net.isHost = host;
    net.ref = net.db.ref("rooms/" + code);
    const me = net.ref.child("players/" + net.id);
    me.set({ name: net.name, x: SPAWN.x, y: 0, z: SPAWN.z, yaw: 0, level: 1, hp: 100 });
    me.onDisconnect().remove();
    
    net.listener = net.ref.on("value", (snap) => {
      const val = snap.val();
      if (!val) {
        if (net.code) { showToast("La salle a été fermée."); netLeaveRoom(); if (state === "menu") setScreen(ui.main); }
        return;
      }
      net.data = val.players || {};
      if (ui.lobbyPlayersList) {
        ui.lobbyPlayersList.replaceChildren();
        Object.keys(net.data).forEach((id) => {
          const div = document.createElement("div");
          div.textContent = (net.data[id].name || id) + (id === val.host ? " (Hôte)" : "") + (id === net.id ? " — Toi" : "");
          ui.lobbyPlayersList.append(div);
        });
      }
      if (!net.isHost && val.status === "playing" && state === "menu") startGame(net.code);
    });

    if (ui.lobbyCodeDisplay) ui.lobbyCodeDisplay.value = code;
    if (ui.lobbyHint) ui.lobbyHint.textContent = host ? "Tu es l'hôte. Lance la partie quand tout le monde est là." : "En attente du lancement par l'hôte…";
    if (ui.btnStartLobby) ui.btnStartLobby.classList.toggle("hidden", !host);
    setScreen(ui.lobbyModal);
  }

  function netLeaveRoom(silent = false) {
    if (net.ref) {
      try {
        if (net.listener) net.ref.off("value", net.listener);
        net.ref.child("players/" + net.id).remove();
        if (net.isHost) net.ref.remove();
      } catch (e) {}
    }
    Object.values(net.remotes).forEach((m) => { if (scene) scene.remove(m.mesh); disposeTree(m.mesh); });
    net.remotes = {}; net.data = {};
    net.ref = null; net.code = null; net.listener = null; net.isHost = false;
    if (!silent) setScreen(ui.main);
  }

  function netPush(fields) {
    if (!net.ref) return;
    try { net.ref.child("players/" + net.id).update(fields); } catch (e) {}
  }

  function netSendPosition(dt) {
    if (!net.ref) return;
    net.sendTimer -= dt;
    if (net.sendTimer > 0) return;
    net.sendTimer = 0.1;
    netPush({ x: +player.x.toFixed(2), y: +player.y.toFixed(2), z: +player.z.toFixed(2), yaw: +yaw.toFixed(2), level, hp: Math.round(playerHp) });
  }

  function netUpdateRemotes(dt) {
    if (!net.ref) return;
    Object.keys(net.data).forEach((id) => {
      if (id === net.id) return;
      const d = net.data[id];
      if (typeof d.x !== "number") return;
      let r = net.remotes[id];
      if (!r) {
        const mesh = createPlayerModel(0xe74c3c);
        scene.add(mesh);
        r = net.remotes[id] = { mesh };
        mesh.position.set(d.x, d.y, d.z);
      }
      r.mesh.visible = d.level === level;
      r.mesh.position.x = lerp(r.mesh.position.x, d.x, Math.min(1, dt * 10));
      r.mesh.position.y = lerp(r.mesh.position.y, d.y, Math.min(1, dt * 10));
      r.mesh.position.z = lerp(r.mesh.position.z, d.z, Math.min(1, dt * 10));
      r.mesh.rotation.y = d.yaw || 0;
    });
    Object.keys(net.remotes).forEach((id) => {
      if (!net.data[id]) { scene.remove(net.remotes[id].mesh); disposeTree(net.remotes[id].mesh); delete net.remotes[id]; }
    });
  }
  /* ============================== CYCLE DE JEU PRINCIPAL ============================== */
  function startGame(code = null) {
    ensureAudio();
    level = 1; score = 0; elapsed = 0; kills = 0; damageBonus = 0; speedBonus = 0;
    combo = 0; comboTimer = 0; runStats = { kills: 0 };
    maxHp = difficulties[difficulty].playerHp; playerHp = maxHp;
    dodgeCooldown = 0; invulnerable = 0; fireCooldown = 0; dashTime = 0; damageFlash = 0; shakePower = 0; hazardTimer = 0;
    mouseHeld = false; padPrev = {};
    if (difficulty === 2) unlockAchievement("hard");
    startRunModels();

    state = "playing";
    if (ui.hud) ui.hud.classList.remove("hidden");
    if (ui.crosshair) ui.crosshair.classList.add("on");
    setScreen(null);
    held.clear();
    buildPlatform();
    clock.getDelta();
    musicNote = 0; musicTimer = 0;
    lockPointer();
    if (code && net.ref) netPush({ level: 1, hp: Math.round(playerHp) });
  }

  function goToMenu() {
    if (net.ref) netLeaveRoom(true);
    state = "menu";
    if (playerMesh) { scene.remove(playerMesh); disposeTree(playerMesh); playerMesh = null; }
    enemies = [];
    level = 1;
    if (ui.hud) ui.hud.classList.add("hidden");
    if (ui.crosshair) ui.crosshair.classList.remove("on");
    if (ui.bossBar) ui.bossBar.classList.add("hidden");
    unlockPointer();
    buildPlatform({ menu: true });
    setScreen(ui.main);
  }

  function openSettings(from) {
    settingsReturn = from;
    updateSettingsUI();
    renderKeyList();
    setScreen(ui.settings);
  }

  function closeSettings() {
    keyCapture = null;
    setScreen(settingsReturn === "pause" ? ui.pause : ui.main);
  }

  function pauseGame() {
    if (state === "playing") {
      state = "paused";
      held.clear();
      mouseHeld = false;
      unlockPointer();
      setScreen(ui.pause);
    } else if (state === "paused") {
      state = "playing";
      setScreen(null);
      clock.getDelta();
      lockPointer();
    }
  }

  /* ============================== ÉVÉNEMENTIEL & ENTRÉES ============================== */
  function isTypingTarget(t) {
    return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");
  }

  function onKeyDown(event) {
    if (keyCapture) {
      event.preventDefault();
      if (event.code !== "Escape") assignKey(keyCapture.dataset.key, event.code);
      else renderKeyList();
      keyCapture = null;
      return;
    }
    if (isTypingTarget(event.target)) return;

    if (event.code === keys.pause && ui.settings.classList.contains("hidden")) {
      if (state === "playing" || state === "paused") { event.preventDefault(); pauseGame(); return; }
    }

    if (state === "playing") {
      if (Object.values(keys).includes(event.code) || event.code.startsWith("Arrow")) event.preventDefault();
      held.add(event.code);
      if (event.repeat) return;
      if (event.code === keys.interact) interact();
      if (event.code === keys.view) {
        settings.view = settings.view === "first" ? "third" : "first";
        saveStorage("towerSettings", settings);
        updateSettingsUI();
        showToast(settings.view === "first" ? "Vue 1re personne" : "Vue 3e personne");
      }
    } else if (state === "upgrade") {
      if (event.code === "Digit1" || event.code === "Numpad1") chooseUpgrade("hp");
      if (event.code === "Digit2" || event.code === "Numpad2") chooseUpgrade("speed");
      if (event.code === "Digit3" || event.code === "Numpad3") chooseUpgrade("dmg");
    }
  }

  /* ============================== AUTHENTIFICATION & COMPTE ============================== */
  function initAuth() {
    if (!window.firebase || !firebase.auth) return;
    try {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    } catch (e) {
      return;
    }
    const auth = firebase.auth();

    auth.onAuthStateChanged((user) => {
      if (user) {
        if (ui.userStatus) ui.userStatus.textContent = `Connecté : ${user.email}`;
        if (ui.authEmail) ui.authEmail.style.display = "none";
        if (ui.authPassword) ui.authPassword.style.display = "none";
        if (ui.btnLogin) ui.btnLogin.classList.add("hidden");
        if (ui.btnRegister) ui.btnRegister.classList.add("hidden");
        if (ui.btnLogout) ui.btnLogout.classList.remove("hidden");
        net.name = user.email.split("@")[0];
      } else {
        if (ui.userStatus) ui.userStatus.textContent = "Mode invité (Non connecté)";
        if (ui.authEmail) ui.authEmail.style.display = "block";
        if (ui.authPassword) ui.authPassword.style.display = "block";
        if (ui.btnLogin) ui.btnLogin.classList.remove("hidden");
        if (ui.btnRegister) ui.btnRegister.classList.remove("hidden");
        if (ui.btnLogout) ui.btnLogout.classList.add("hidden");
      }
    });

    if (ui.btnRegister) {
      ui.btnRegister.addEventListener("click", () => {
        const email = ui.authEmail ? ui.authEmail.value.trim() : "";
        const password = ui.authPassword ? ui.authPassword.value.trim() : "";
        if (!email || !password) { showToast("Entre un email et un mot de passe valides."); return; }
        auth.createUserWithEmailAndPassword(email, password)
          .then(() => showToast("Compte créé avec succès !"))
          .catch((err) => showToast("Erreur : " + err.message));
      });
    }

    if (ui.btnLogin) {
      ui.btnLogin.addEventListener("click", () => {
        const email = ui.authEmail ? ui.authEmail.value.trim() : "";
        const password = ui.authPassword ? ui.authPassword.value.trim() : "";
        if (!email || !password) { showToast("Entre ton email et ton mot de passe."); return; }
        auth.signInWithEmailAndPassword(email, password)
          .then(() => showToast("Bon retour parmi nous !"))
          .catch((err) => showToast("Erreur de connexion : " + err.message));
      });
    }

    if (ui.btnLogout) {
      ui.btnLogout.addEventListener("click", () => {
        auth.signOut().then(() => showToast("Déconnecté."));
      });
    }
  }

  function bindEvents() {
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", (e) => held.delete(e.code));
    window.addEventListener("blur", () => { held.clear(); mouseHeld = false; if (state === "playing") pauseGame(); });
    document.addEventListener("visibilitychange", () => { if (document.hidden && state === "playing") pauseGame(); });
    document.addEventListener("pointerlockchange", () => {
      if (!document.pointerLockElement && state === "playing" && !("ontouchstart" in window)) pauseGame();
    });

    window.addEventListener("mousedown", (e) => {
      if (!keyCapture) return;
      e.preventDefault(); e.stopImmediatePropagation();
      assignKey(keyCapture.dataset.key, `Mouse${e.button}`);
      keyCapture = null;
    }, true);

    if (ui.canvas) {
      ui.canvas.addEventListener("mousemove", (e) => {
        if (document.pointerLockElement !== ui.canvas || state !== "playing") return;
        yaw -= e.movementX * 0.002 * Number(settings.sensX);
        pitch -= e.movementY * 0.002 * Number(settings.sensY) * (settings.invertY ? -1 : 1);
        pitch = clamp(pitch, -1.35, 1.35);
      });
      ui.canvas.addEventListener("mousedown", (e) => {
        if (state !== "playing") return;
        if (document.pointerLockElement !== ui.canvas) { lockPointer(); return; }
        if (keys.shoot === `Mouse${e.button}`) { mouseHeld = true; shoot(); }
        else if (keys.jump === `Mouse${e.button}`) tryJump();
        else if (keys.dodge === `Mouse${e.button}`) startDash();
        else if (keys.interact === `Mouse${e.button}`) interact();
      });
    }
    window.addEventListener("mouseup", () => { mouseHeld = false; });
    window.addEventListener("contextmenu", (e) => e.preventDefault());

    // Liaison sécurisée des boutons
    const safeClick = (id, fn) => {
      const el = $(id);
      if (el) el.addEventListener("click", fn);
    };

    safeClick("btnPlay", () => startGame());
    safeClick("btnCreateLobby", netCreateRoom);
    safeClick("btnJoinLobby", netJoinRoom);
    safeClick("btnLeaveLobby", () => netLeaveRoom());
    safeClick("btnStartLobby", () => {
      if (net.ref) net.ref.update({ status: "playing" });
      startGame(net.code);
    });
    safeClick("btnDifficulty", cycleDifficulty);
    safeClick("btnScores", openScores);
    safeClick("btnScoresBack", () => setScreen(ui.main));

    safeClick("btnSettings", () => openSettings("menu"));
    safeClick("btnPauseSettings", () => openSettings("pause"));
    safeClick("btnSettingsBack", closeSettings);
    safeClick("btnResume", pauseGame);
    safeClick("btnQuit", goToMenu);
    safeClick("btnReplay", () => startGame(net.code));
    safeClick("btnToMenu", goToMenu);
    safeClick("btnResetKeys", () => {
      keys = { ...defaultKeys };
      saveStorage("towerKeys", keys);
      renderKeyList();
    });

    document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => {
      document.querySelectorAll(".tab, .tabpanel").forEach((el) => el.classList.remove("active"));
      tab.classList.add("active");
      const target = $(tab.dataset.tab);
      if (target) target.classList.add("active");
    }));

    document.querySelectorAll("[data-s]").forEach((input) => {
      const handler = () => {
        const name = input.dataset.s;
        settings[name] = input.type === "checkbox" ? input.checked :
          input.type === "range" ? Number(input.value) : input.value;
        saveStorage("towerSettings", settings);
        updateSettingsUI();
      };
      input.addEventListener("input", handler);
      input.addEventListener("change", handler);
    });

    document.querySelectorAll(".card[data-up]").forEach((card) => card.addEventListener("click", () => chooseUpgrade(card.dataset.up)));

    bindTouch();
  }

  function bindTouch() {
    const zone = $("joystickZone"), stick = $("joystickStick");
    if (zone) {
      const update = (touch) => {
        const rect = zone.getBoundingClientRect();
        const cx = rect.left + 70, cy = rect.top + 70;
        const dx = clamp((touch.clientX - cx) / 50, -1, 1), dy = clamp((touch.clientY - cy) / 50, -1, 1);
        touchJoystick.x = dx; touchJoystick.y = dy; touchJoystick.active = true;
        if (stick) stick.style.transform = `translate(${dx * 30}px, ${dy * 30}px)`;
      };
      zone.addEventListener("touchstart", (e) => { e.preventDefault(); touchJoystick.id = e.changedTouches[0].identifier; update(e.changedTouches[0]); }, { passive: false });
      zone.addEventListener("touchmove", (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) if (t.identifier === touchJoystick.id) update(t);
      }, { passive: false });
      const end = () => { touchJoystick.active = false; touchJoystick.x = 0; touchJoystick.y = 0; touchJoystick.id = null; if (stick) stick.style.transform = ""; };
      zone.addEventListener("touchend", end);
      zone.addEventListener("touchcancel", end);
    }
    const tap = (id, fn) => { const el = $(id); if (el) el.addEventListener("touchstart", (e) => { e.preventDefault(); fn(); }, { passive: false }); };
    tap("tJump", () => { if (state === "playing") tryJump(); });
    tap("tDodge", () => { if (state === "playing") startDash(); });
    tap("tShoot", shoot);
    tap("tInteract", interact);

    ui.canvas.addEventListener("touchstart", (e) => {
      if (state !== "playing") return;
      e.preventDefault();
      const t = e.changedTouches[0];
      lookTouch = { id: t.identifier, x: t.clientX, y: t.clientY };
    }, { passive: false });
    ui.canvas.addEventListener("touchmove", (e) => {
      if (state !== "playing") return;
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== lookTouch.id) continue;
        yaw -= (t.clientX - lookTouch.x) * 0.006 * Number(settings.sensX);
        pitch = clamp(pitch - (t.clientY - lookTouch.y) * 0.006 * Number(settings.sensY) * (settings.invertY ? -1 : 1), -1.35, 1.35);
        lookTouch.x = t.clientX; lookTouch.y = t.clientY;
      }
    }, { passive: false });
    ui.canvas.addEventListener("touchend", (e) => {
      for (const t of e.changedTouches) if (t.identifier === lookTouch.id) lookTouch.id = null;
    });
  }

  /* ============================== BOUCLE TEMPS RÉEL ============================== */
  function loop() {
    requestAnimationFrame(loop);
    const realDt = Math.min(clock ? clock.getDelta() : 0, 0.05);
    const dt = state === "slowmo" ? realDt * 0.15 : realDt;
    worldTime += realDt;

    if (state === "playing") {
      elapsed += dt;
      dodgeCooldown = Math.max(0, dodgeCooldown - dt);
      invulnerable = Math.max(0, invulnerable - dt);
      fireCooldown = Math.max(0, fireCooldown - dt);
      if (comboTimer > 0 && (comboTimer -= dt) <= 0) combo = 0;

      movePlayer(dt);
      if (state === "playing") {
        const autoFire = mouseHeld || (!keys.shoot.startsWith("Mouse") && held.has(keys.shoot));
        if (autoFire && document.pointerLockElement === ui.canvas || (autoFire && "ontouchstart" in window)) shoot();
        updateEnemies(dt);
        updateProjectiles(dt);
        updatePickups(dt);
        netUpdateRemotes(dt);
      }
    } else if (state === "elevator") {
      updateElevator(realDt);
    } else if (state === "slowmo") {
      slowMoTimer -= realDt;
      updateEnemies(dt * 0.2);
      if (slowMoTimer <= 0) finishGame(true);
    }

    if (state !== "paused" && state !== "upgrade" && state !== "ended") {
      updateParticles(dt);
      updateEffects(dt);
      updateWeather(dt);
      updateDecor();
    }

    if (platformGroup) {
      sun.target.position.set(player.x, player.y, player.z);
      sun.position.set(player.x - 10, player.y + 18, player.z + 10);
      if (state === "menu") { sun.target.position.set(0, platformGroup.position.y, 0); sun.position.set(-10, platformGroup.position.y + 18, 10); }
    }

    updateCamera(realDt);
    if (stars) stars.position.copy(camera.position);
    camera.updateMatrixWorld();

    if (damageFlash > 0) damageFlash = Math.max(0, damageFlash - realDt * 1.8);
    if (ui.flash) {
      const low = state === "playing" && playerHp / maxHp < 0.3 ? 0.25 + 0.15 * Math.sin(worldTime * 6) : 0;
      ui.flash.style.opacity = String(Math.min(1, Math.max(damageFlash, low)));
    }
    if (hitmarkerTimer > 0 && (hitmarkerTimer -= realDt) <= 0 && ui.hitmarker) ui.hitmarker.classList.remove("show");
    if (toastTimer > 0 && (toastTimer -= realDt) <= 0 && ui.toast) ui.toast.classList.remove("show");
    if (bannerTimer > 0 && (bannerTimer -= realDt) <= 0 && ui.banner) ui.banner.classList.remove("show");

    if (state === "playing" || state === "slowmo") {
      hudTimer -= realDt;
      if (hudTimer <= 0) { hudTimer = 0.08; updateHud(); }
      frames++;
      if (worldTime - lastFpsUpdate >= 0.5) {
        if (ui.fpsText) ui.fpsText.textContent = `${Math.round(frames / (worldTime - lastFpsUpdate))} FPS`;
        frames = 0; lastFpsUpdate = worldTime;
      }
    }

    if (state === "playing" || state === "elevator") {
      musicTimer -= realDt;
      if (musicTimer <= 0) {
        playMusicBeat();
        musicTimer = level === 10 ? 0.42 : 0.68;
      }
    }
    if (renderer && scene && camera) renderer.render(scene, camera);
  }

  /* ============================== EXTENSION SÉCURISÉE : TROPHÉES & SKINS ============================== */
  function refreshAchievementsUI() {
    const list = ["first_blood", "kills_10", "kills_50", "floor_5", "floor_10", "miniboss", "master", "combo_5", "combo_10", "hard"];
    list.forEach((id) => {
      const el = $("ach_" + id);
      if (el && localStorage.getItem("tower_ach_" + id)) {
        el.textContent = "✅ Débloqué !";
        el.style.color = "#38ff7a";
      }
    });
  }

  window.unlockAchievement = function(id) {
    if (!localStorage.getItem("tower_ach_" + id)) {
      localStorage.setItem("tower_ach_" + id, "true");
      showToast("🏆 Succès débloqué !");
      refreshAchievementsUI();
    }
  };

  window.addEventListener("DOMContentLoaded", () => {
    const btnAch = $("btnAchievements");
    const scrAch = $("achievementsScreen");
    const btnBackAch = $("btnAchievementsBack");

    if (btnAch && scrAch) {
      btnAch.addEventListener("click", () => {
        refreshAchievementsUI();
        scrAch.classList.remove("hidden");
      });
    }
    if (btnBackAch && scrAch) {
      btnBackAch.addEventListener("click", () => scrAch.classList.add("hidden"));
    }

    const skinSelect = $("skinBulletSelect");
    if (skinSelect) {
      const current = localStorage.getItem("towerBulletColor") || "#7df9ff";
      skinSelect.value = current;
      skinSelect.addEventListener("change", (e) => {
        localStorage.setItem("towerBulletColor", e.target.value);
        showToast("🎨 Skin de tir sauvegardé !");
      });
    }
  });

  /* ============================== DÉMARRAGE ============================== */
  try {
    bindEvents();
    initAuth();
    renderKeyList();
    updateDifficultyButton();
    initGraphics();
  } catch (err) {
    console.error("Initialisation impossible :", err);
    if (ui.loadError) {
      ui.loadError.textContent = `Erreur au chargement : ${err.message}`;
      ui.loadError.classList.add("show");
    }
  }
})();