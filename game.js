(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const ui = {
    canvas: $("gameCanvas"), hud: $("hud"), main: $("mainMenu"),
    settings: $("settingsScreen"), pause: $("pauseMenu"),
    upgrade: $("upgradeScreen"), end: $("endScreen"), endTitle: $("endTitle"),
    scores: $("scoresScreen"),
    loadError: $("loadError"), hpFill: $("hpFill"), hpText: $("hpText"),
    dodgeFill: $("dodgeFill"), level: $("levelText"), enemies: $("enemiesText"),
    time: $("timeText"), score: $("scoreText"), fps: $("fpsText"),
    bossBar: $("bossBar"), bossFill: $("bossFill"), bossName: $("bossName"), crosshair: $("crosshair"),
    prompt: $("prompt"), flash: $("flash"), banner: $("banner"), bannerTitle: $("bannerTitle"),
    bannerSub: $("bannerSub"), toast: $("toast"), touch: $("touchControls"),
    lobbyModal: $("lobbyModal"), lobbyCodeInput: $("lobbyCodeInput"),
    lobbyPlayersList: $("lobbyPlayersList"), btnStartLobby: $("btnStartLobby"),
    btnCreateLobby: $("btnCreateLobby"), btnJoinLobby: $("btnJoinLobby")
  };

  const defaults = {
    sensX: 1, sensY: 1, invertY: false, quality: "high", shadows: true,
    particles: true, fov: 75, showFps: false, master: 0.8, music: 0.5,
    sfx: 0.8, view: "first", shake: true
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
    { name: "Facile", enemyHp: 55, enemyDamage: 7, playerHp: 130 },
    { name: "Normale", enemyHp: 75, enemyDamage: 10, playerHp: 100 },
    { name: "Difficile", enemyHp: 105, enemyDamage: 15, playerHp: 85 }
  ];

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

  let renderer, scene, camera, clock;
  let state = "menu";
  let level = 1, score = 0, elapsed = 0;
  let player, playerMesh, enemies = [], projectiles = [], particles = [], weatherParticles = [], obstacles = [];
  let platformGroup, elevatorGroup, elevatorActive = false, elevatorTravel = null;
  let yaw = 0, pitch = 0, verticalVelocity = 0, grounded = true;
  let playerHp = 100, maxHp = 100, damageBonus = 0, speedBonus = 0;
  let dodgeCooldown = 0, invulnerable = 0, fireCooldown = 0;
  let toastTimer = 0, bannerTimer = 0, lastFpsUpdate = 0, frames = 0;
  let keyCapture = null, held = new Set(), mouseHeld = false;
  let settingsReturn = "menu", worldTime = 0;
  let audioContext = null, masterGain, musicGain, sfxGain, musicTimer = 0, musicNote = 0, slowMoTimer = 0;
  let roomCode = null, dbRef = null, isHost = false, myPlayerId = "p_" + Math.random().toString(36).substring(2, 7);
  let touchJoystick = { active: false, x: 0, y: 0 };
  let remotePlayersMeshes = {};

  const raycaster = new THREE.Raycaster();
  const cameraDirection = new THREE.Vector3();
  const moveVector = new THREE.Vector3();
  const forwardVector = new THREE.Vector3();
  const rightVector = new THREE.Vector3();

  function showToast(message) {
    if (!ui.toast) return;
    ui.toast.textContent = message;
    ui.toast.classList.add("show");
    toastTimer = 2.0;
  }

  function showBanner(title, subtitle) {
    if (!ui.bannerTitle) return;
    ui.bannerTitle.textContent = title;
    ui.bannerSub.textContent = subtitle;
    ui.banner.classList.add("show");
    bannerTimer = 2.5;
  }

  function playTone(frequency, duration, waveform = "sine", volume = 0.12) {
    if (settings.master <= 0 || settings.sfx <= 0) return;
    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioContext.createGain();
        musicGain = audioContext.createGain();
        sfxGain = audioContext.createGain();
        musicGain.connect(masterGain);
        sfxGain.connect(masterGain);
        masterGain.connect(audioContext.destination);
      }
      if (audioContext.state === "suspended") audioContext.resume();
      masterGain.gain.setTargetAtTime(Number(settings.master), audioContext.currentTime, 0.04);
      sfxGain.gain.setTargetAtTime(Number(settings.sfx), audioContext.currentTime, 0.04);
      musicGain.gain.setTargetAtTime(Number(settings.music), audioContext.currentTime, 0.04);

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = waveform;
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      gain.gain.setValueAtTime(volume, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(sfxGain);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch (e) {
      console.warn("Audio exception", e);
    }
  }

  function playMusicBeat() {
    if (!audioContext || !musicGain || state === "paused" || state === "menu" || settings.music <= 0) return;
    const notes = level === 10 ? [110, 146.83, 164.81, 130.81] : [130.81, 164.81, 196, 164.81];
    const osc = audioContext.createOscillator();
    const g = audioContext.createGain();
    const intensity = 0.025 + Math.min(level, 10) * 0.004;
    osc.type = "triangle";
    osc.frequency.value = notes[musicNote++ % notes.length];
    g.gain.setValueAtTime(intensity, audioContext.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.65);
    osc.connect(g);
    g.connect(musicGain);
    osc.start();
    osc.stop(audioContext.currentTime + 0.68);
  }

  function updateAudio() {
    if (!audioContext) return;
    masterGain.gain.setTargetAtTime(Number(settings.master), audioContext.currentTime, 0.04);
    musicGain.gain.setTargetAtTime(Number(settings.music), audioContext.currentTime, 0.04);
    sfxGain.gain.setTargetAtTime(Number(settings.sfx), audioContext.currentTime, 0.04);
  }

  function setScreen(screen) {
    for (const el of [ui.main, ui.settings, ui.pause, ui.upgrade, ui.end, ui.scores, ui.lobbyModal]) {
      if (el) el.classList.add("hidden");
    }
    if (screen) screen.classList.remove("hidden");
    if (ui.touch) ui.touch.classList.toggle("hidden", state !== "playing" || !('ontouchstart' in window));
  }

  function goToMenu() {
    state = "menu";
    if (playerMesh) scene.remove(playerMesh);
    playerMesh = null;
    if (platformGroup) scene.remove(platformGroup);
    platformGroup = null;
    enemies.forEach(e => { if (e.warnElement) e.warnElement.remove(); });
    enemies = [];
    if (ui.hud) ui.hud.classList.add("hidden");
    if (ui.crosshair) ui.crosshair.classList.remove("on");
    document.exitPointerLock?.();
    setScreen(ui.main);
  }

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
    if (camera) {
      camera.fov = Number(settings.fov);
      camera.updateProjectionMatrix();
    }
    if (renderer) {
      const ratioLimit = settings.quality === "low" ? 1 : settings.quality === "medium" ? 1.5 : 2;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ratioLimit));
      renderer.shadowMap.enabled = Boolean(settings.shadows);
    }
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
    const entries = [
      [keys.forward, " Déplacement · "],
      [keys.shoot, " Attaque · "],
      [keys.dodge, " Esquive · "],
      [keys.interact, " Ascenseur"]
    ];
    entries.forEach(([code, label], index) => {
      const key = document.createElement("b");
      key.textContent = keyName(code);
      help.append(key, document.createTextNode(label));
      if (index === 0) {
        const left = document.createElement("b"); left.textContent = keyName(keys.left);
        const back = document.createElement("b"); back.textContent = keyName(keys.back);
        const right = document.createElement("b"); right.textContent = keyName(keys.right);
        help.append(left, document.createTextNode(" "), back, document.createTextNode(" "), right, document.createTextNode(" · "));
      }
    });
  }

  function keyName(code) {
    if (code.startsWith("Mouse")) return `Souris ${Number(code.slice(5)) + 1}`;
    if (code.startsWith("Key")) return code.slice(3);
    if (code.startsWith("Digit")) return code.slice(5);
    return ({ Space: "Espace", ShiftLeft: "Maj Gauche", ShiftRight: "Maj Droite",
      Escape: "Échap", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" })[code] || code;
  }

  function initGraphics() {
    if (!window.THREE) throw new Error("Three.js introuvable.");
    renderer = new THREE.WebGLRenderer({ canvas: ui.canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = Boolean(settings.shadows);
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090a10);
    scene.fog = new THREE.Fog(0x090a10, 20, 75);
    camera = new THREE.PerspectiveCamera(Number(settings.fov), 1, 0.1, 120);
    clock = new THREE.Clock();

    scene.add(new THREE.HemisphereLight(0xb8d8ff, 0x221528, 1.2));
    const sun = new THREE.DirectionalLight(0xffdfad, 1.4);
    sun.position.set(-8, 16, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);

    resize();
    updateSettingsUI();
    requestAnimationFrame(loop);
  }

  function resize() {
    if (!renderer || !camera) return;
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function createMaterial(color, roughness = 0.7, metalness = 0.1) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
  }

  function createCapsule(radius, cylinderHeight, material) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8), material);
    mesh.scale.y = (cylinderHeight + radius * 2) / (radius * 2);
    return mesh;
  }

  function addBox(parent, x, y, z, sx, sy, sz, color, options = {}, isObstacle = false) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), createMaterial(color, 0.7, options.metalness || 0));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    if (isObstacle) {
      obstacles.push({ x, z, radius: Math.max(sx, sz) / 2 });
    }
    return mesh;
  }

  function addElevator() {
    elevatorGroup = new THREE.Group();
    elevatorGroup.position.set(0, 0, -7.2);
    const metal = createMaterial(0x485665, 0.3, 0.8);
    const glow = new THREE.MeshStandardMaterial({
      color: 0x00d2ff, emissive: 0x0088cc, emissiveIntensity: 1.5,
      metalness: 0.4, roughness: 0.2
    });
    const platform = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.28, 3.2), metal);
    platform.position.y = 0.18;
    platform.castShadow = true;
    platform.receiveShadow = true;
    elevatorGroup.add(platform);

    const inner = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.05, 2.7), glow);
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
    const indicator = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.13, 0.1), glow);
    indicator.position.set(0, 4.35, -1.3);
    elevatorGroup.add(indicator);
    elevatorGroup.userData.indicator = indicator;
    platformGroup.add(elevatorGroup);
  }

  function initWeatherForBiome() {
    weatherParticles.forEach(p => scene.remove(p.mesh));
    weatherParticles = [];
    if (!settings.particles) return;

    const count = level === 10 ? 120 : level === 3 ? 90 : 50;
    const geo = new THREE.SphereGeometry(level === 10 ? 0.03 : level === 3 ? 0.05 : 0.04, 4, 4);
    const mat = new THREE.MeshBasicMaterial({
      color: level === 10 ? 0x88ccff : level === 3 ? 0xffffff : level === 2 ? 0xff6622 : 0x77ffaa,
      transparent: true, opacity: 0.6
    });

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set((Math.random() - 0.5) * 30, (level - 1) * 5 + Math.random() * 12, (Math.random() - 0.5) * 30);
      scene.add(mesh);
      weatherParticles.push({
        mesh,
        vy: level === 10 ? -12 : level === 3 ? -3 : Math.sin(i) * 0.5,
        vx: level === 3 ? -2 : (Math.random() - 0.5) * 0.8
      });
    }
  }

  function updateWeather(dt) {
    const baseY = (level - 1) * 5;
    weatherParticles.forEach(p => {
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.x += p.vx * dt;
      if (p.mesh.position.y < baseY) p.mesh.position.y = baseY + 12;
      if (p.mesh.position.x < -15) p.mesh.position.x = 15;
      if (p.mesh.position.x > 15) p.mesh.position.x = -15;
    });

    if (level === 10 && Math.random() < 0.012) {
      scene.background.setHex(0x556688);
      setTimeout(() => scene.background.setHex(0x090a10), 60);
      playTone(120, 0.2, "sawtooth", 0.05);
    }
  }

  function addPlatformDecor() {
    const theme = [
      { sky: 0x0c1a15, fog: 0x0c1a15, ground: 0x1f382b, accent: 0x50e3c2 },
      { sky: 0x2a140e, fog: 0x2a140e, ground: 0x402018, accent: 0xff5722 },
      { sky: 0x0f2027, fog: 0x0f2027, ground: 0x203a43, accent: 0x00d2ff },
      { sky: 0x1d1724, fog: 0x1d1724, ground: 0x2d2338, accent: 0xb388ff },
      { sky: 0x201018, fog: 0x201018, ground: 0x3d1c2b, accent: 0xff4081 },
      { sky: 0x102030, fog: 0x102030, ground: 0x1e354d, accent: 0x00e676 },
      { sky: 0x30150a, fog: 0x30150a, ground: 0x522410, accent: 0xffab00 },
      { sky: 0x111b24, fog: 0x111b24, ground: 0x243545, accent: 0x80d8ff },
      { sky: 0x1d1424, fog: 0x1d1424, ground: 0x322240, accent: 0xe040fb },
      { sky: 0x090a10, fog: 0x090a10, ground: 0x1e1926, accent: 0xf50057 }
    ][level - 1];

    scene.background.setHex(theme.sky);
    scene.fog.color.setHex(theme.fog);
    const floor = platformGroup.children.find(c => c.isMesh && c.geometry.type === "BoxGeometry");
    if (floor) floor.material.color.setHex(theme.ground);

    const accentMat = new THREE.MeshStandardMaterial({
      color: theme.accent, emissive: theme.accent, emissiveIntensity: 0.25, roughness: 0.4
    });

    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI * 2 * i) / 4 + Math.PI / 4;
      const ox = Math.cos(angle) * 7.5;
      const oz = Math.sin(angle) * 7.5;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 0), accentMat);
      rock.position.set(ox, 0.4, oz);
      platformGroup.add(rock);
      obstacles.push({ x: ox, z: oz, radius: 0.8 });
    }
  }

  function buildPlatform() {
    if (platformGroup) scene.remove(platformGroup);
    platformGroup = new THREE.Group();
    obstacles = [];
    const height = (level - 1) * 5;
    platformGroup.position.y = height;

    const colors = [0x1f2d3d, 0x2d222a, 0x1f333a, 0x2b2136, 0x2e1a24, 0x1a2e2b, 0x331e1a, 0x1b2833, 0x281b33, 0x20152b];
    addBox(platformGroup, 0, -0.4, 0, 20, 0.8, 20, colors[(level - 1) % colors.length]);
    addBox(platformGroup, 0, 0.04, -9.7, 20, 0.12, 0.6, 0x5a6978);
    addBox(platformGroup, 0, 0.04, 9.7, 20, 0.12, 0.6, 0x5a6978);
    addBox(platformGroup, -9.7, 0.04, 0, 0.6, 0.12, 20, 0x5a6978);
    addBox(platformGroup, 9.7, 0.04, 0, 0.6, 0.12, 20, 0x5a6978);

    for (let i = 0; i < 4; i++) {
      const lamp = new THREE.PointLight(level === 10 ? 0xf50057 : 0xff9100, 1.8, 9);
      lamp.position.set(i % 2 ? 8 : -8, 2.2, i < 2 ? 8 : -8);
      platformGroup.add(lamp);
    }

    addPlatformDecor();
    if (level < 10) addElevator();
    scene.add(platformGroup);

    player.set(0, height, 6);
    if (playerMesh) playerMesh.position.set(0, height + 0.85, 6);
    verticalVelocity = 0; grounded = true; yaw = 0; pitch = 0;
    elevatorActive = false; elevatorTravel = null;

    projectiles.forEach(p => scene.remove(p.mesh)); projectiles = [];
    particles.forEach(p => scene.remove(p.mesh)); particles = [];

    initWeatherForBiome();
    spawnEnemies();

    const titles = [
      "Bosquet Céleste", "Cratère de Magma", "Pics de Givre", "Ruines de l'Éther", "Palais du Mini-Boss",
      "Jardins Suspendus", "Canyon Ardent", "Abysse Glacé", "Ruines Sombres", "Trône du Boss Final"
    ];
    showBanner(titles[level - 1], level === 10 ? "Affronte le Souverain d'Aether !" : level === 5 ? "Affronte le Mini-Boss !" : "Nettoie la zone pour débloquer l'ascenseur");
    playTone(level === 10 ? 110 : 440, 0.25, "triangle");
    updateHud();
  }

  function spawnEnemies() {
    enemies.forEach(e => {
      platformGroup.remove(e.group);
      if (e.warnElement) e.warnElement.remove();
    });
    enemies = [];
    const isBoss = level === 10;
    const isMiniBoss = level === 5;
    const count = isBoss ? 1 : isMiniBoss ? 1 : 2 + Math.floor(level / 2);

    for (let i = 0; i < count; i++) {
      let x, z, distToPlayer;
      do {
        const angle = (Math.PI * 2 * i) / count + Math.random();
        x = (isBoss || isMiniBoss) ? 0 : Math.cos(angle) * (5 + Math.random() * 3);
        z = (isBoss || isMiniBoss) ? -4 : Math.sin(angle) * (5 + Math.random() * 3);
        distToPlayer = Math.hypot(x - 0, z - 6);
      } while (distToPlayer < 5 && !isBoss && !isMiniBoss);

      const group = new THREE.Group();
      group.position.set(x, 0.05, z);

      const kind = isBoss ? "boss" : isMiniBoss ? "miniboss" : level % 3 === 0 ? "ranged" : level % 2 === 0 ? "charger" : "melee";
      const radius = isBoss ? 0.95 : isMiniBoss ? 0.75 : 0.42;
      const hp = isBoss ? 2200 : isMiniBoss ? 850 : difficulties[difficulty].enemyHp + level * 14;
      const colors = { boss: 0xb449ff, miniboss: 0xff642b, ranged: 0x00acc1, charger: 0xf57c00, melee: 0xd32f2f };

      const body = createCapsule(radius, isBoss ? 1.4 : isMiniBoss ? 0.9 : 0.55, createMaterial(colors[kind], 0.5));
      body.position.y = isBoss ? 1.3 : isMiniBoss ? 0.9 : 0.72;
      body.castShadow = true;
      group.add(body);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(isBoss ? 0.14 : 0.08, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffeb3b }));
      eye.position.set(0, isBoss ? 1.5 : 0.9, 0.36);
      group.add(eye);

      platformGroup.add(group);

      const warnElement = document.createElement("div");
      warnElement.className = "world-warning hidden";
      warnElement.textContent = "!";
      if (ui.hud) ui.hud.appendChild(warnElement);

      enemies.push({
        group, body, hp, maxHp: hp, kind,
        speed: isBoss ? 1.1 : isMiniBoss ? 0.95 : 0.8 + level * 0.03,
        attack: Math.random() * 0.8, boss: isBoss || isMiniBoss, phase: 1,
        phaseTime: 0, chargeTime: 0, chargeVector: new THREE.Vector3(), warnElement
      });
    }
  }

  function startGame(code = null, startedByHost = false) {
    if (playerMesh) scene.remove(playerMesh);
    roomCode = code;
    level = 1; score = 0; elapsed = 0; damageBonus = 0; speedBonus = 0;
    maxHp = difficulties[difficulty].playerHp; playerHp = maxHp;
    player = new THREE.Vector3(0, 0, 6);
    playerMesh = createCapsule(0.32, 0.65, createMaterial(0x00bcd4));
    playerMesh.castShadow = true;
    scene.add(playerMesh);

    state = "playing";
    if (ui.hud) ui.hud.classList.remove("hidden");
    if (ui.crosshair) ui.crosshair.classList.add("on");
    setScreen(null);
    buildPlatform();
    held.clear();
    playMusicBeat();
    clock.getDelta();

    if (roomCode && window.firebase) {
      dbRef = firebase.database().ref("rooms/" + roomCode);
      dbRef.child("players/" + myPlayerId).set({
        x: player.x, y: player.y, z: player.z, hp: playerHp, level: level
      });
      dbRef.child("players/" + myPlayerId).onDisconnect().remove();

      dbRef.on("value", (snapshot) => {
        const val = snapshot.val();
        if (!val) return;
        if (!startedByHost && val.status === "playing" && state === "menu") {
          level = val.level || 1;
          state = "playing";
          if (ui.hud) ui.hud.classList.remove("hidden");
          if (ui.crosshair) ui.crosshair.classList.add("on");
          setScreen(null);
          buildPlatform();
        }
        if (val.players) {
          Object.keys(val.players).forEach(id => {
            if (id === myPlayerId) return;
            const pData = val.players[id];
            if (!remotePlayersMeshes[id]) {
              const rMesh = createCapsule(0.32, 0.65, createMaterial(0xe74c3c));
              scene.add(rMesh);
              remotePlayersMeshes[id] = rMesh;
            }
            remotePlayersMeshes[id].position.set(pData.x, pData.y + 0.85, pData.z);
          });
        }
      });
    }
  }

  function updateHud() {
    if (!ui.hpFill) return;
    ui.hpFill.style.width = `${Math.max(0, playerHp / maxHp) * 100}%`;
    ui.hpText.textContent = `${Math.ceil(Math.max(0, playerHp))} / ${maxHp}`;
    ui.dodgeFill.style.width = `${Math.max(0, 1 - dodgeCooldown / 1.2) * 100}%`;
    ui.level.textContent = `Plateforme ${level} / 10`;
    ui.enemies.textContent = enemies.length ? `Ennemis restants : ${enemies.length}` : "Ascenseur débloqué — Appuie sur E";
    ui.time.textContent = `Temps : ${formatTime(elapsed)}`;
    ui.score.textContent = `Score : ${score}`;
    if (ui.fpsText) ui.fpsText.classList.toggle("hidden", !settings.showFps);

    if (ui.bossBar) {
      ui.bossBar.classList.toggle("hidden", level !== 5 && level !== 10 || enemies.length === 0);
      const boss = enemies.find(e => e.boss);
      if (boss && ui.bossFill && ui.bossName) {
        ui.bossFill.style.width = `${Math.max(0, boss.hp / boss.maxHp) * 100}%`;
        ui.bossName.textContent = level === 10 ? `Souverain d'Aether (Phase ${boss.phase})` : `Gardien de Pierre (Phase ${boss.phase})`;
      }
    }

    const nearLift = elevatorGroup && Math.hypot(player.x, player.z + 7.2) < 2.8;
    const promptText = (level === 10 || level === 5 && enemies.length > 0) ? "" : enemies.length ? "" : nearLift ?
      `Appuie sur ${keyName(keys.interact)} pour utiliser l'ascenseur.` : "Approche-toi du socle pour monter.";
    if (ui.prompt) {
      ui.prompt.textContent = promptText;
      ui.prompt.classList.toggle("hidden", !promptText);
    }
  }

  function formatTime(s) {
    const t = Math.floor(s);
    return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  }

  function updateCamera() {
    const eye = settings.view === "third" ? 1.5 : 1.55;
    camera.rotation.order = "YXZ";
    camera.rotation.set(pitch, yaw, 0);
    camera.position.set(player.x, player.y + eye, player.z);

    if (settings.view === "third") {
      const behind = new THREE.Vector3(0, 1.4, 5.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      camera.position.add(behind);
      camera.lookAt(player.x - Math.sin(yaw) * 10, player.y + eye - Math.sin(pitch) * 10, player.z - Math.cos(yaw) * 10);
      if (playerMesh) playerMesh.visible = true;
    } else {
      if (playerMesh) playerMesh.visible = false;
    }

    if (invulnerable > 0 && settings.shake && state === "playing") {
      camera.position.x += (Math.random() - 0.5) * 0.08;
      camera.position.y += (Math.random() - 0.5) * 0.08;
    }
  }

  function movePlayer(dt) {
    const speed = 5.4 + speedBonus;
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

    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    if (gamepads[0]) {
      const gp = gamepads[0];
      if (Math.abs(gp.axes[0]) > 0.1) moveVector.addScaledVector(rightVector, gp.axes[0]);
      if (Math.abs(gp.axes[1]) > 0.1) moveVector.addScaledVector(forwardVector, -gp.axes[1]);
      yaw -= gp.axes[2] * 0.03;
      pitch -= gp.axes[3] * 0.03;
      if (gp.buttons[0].pressed && grounded) { verticalVelocity = 6.5; grounded = false; }
    }

    if (moveVector.lengthSq() > 0) {
      moveVector.normalize().multiplyScalar(speed * dt);
      const nextX = player.x + moveVector.x;
      const nextZ = player.z + moveVector.z;

      let blocked = false;
      for (const obs of obstacles) {
        if (Math.hypot(nextX - obs.x, nextZ - obs.z) < obs.radius + 0.35) {
          blocked = true;
          break;
        }
      }

      if (!blocked) {
        player.x = THREE.MathUtils.clamp(nextX, -9, 9);
        player.z = THREE.MathUtils.clamp(nextZ, -9, 9);
      }
    }

    if (held.has(keys.jump) && grounded) {
      verticalVelocity = 6.6;
      grounded = false;
      playTone(320, 0.1, "sine", 0.08);
    }

    if (held.has(keys.dodge) && dodgeCooldown <= 0) {
      dodgeCooldown = 1.2;
      invulnerable = 0.42;
      if (moveVector.lengthSq() === 0) moveVector.copy(forwardVector);
      player.addScaledVector(moveVector.normalize(), 3.0);
      player.x = THREE.MathUtils.clamp(player.x, -9, 9);
      player.z = THREE.MathUtils.clamp(player.z, -9, 9);
      spawnParticles(player, 0x00d2ff, 8);
      playTone(220, 0.15, "triangle", 0.1);
    }

    if (!grounded) {
      verticalVelocity -= 16 * dt;
      player.y += verticalVelocity * dt;
      if (player.y <= (level - 1) * 5) {
        player.y = (level - 1) * 5;
        verticalVelocity = 0;
        grounded = true;
      }
    }
    if (playerMesh) playerMesh.position.set(player.x, player.y + 0.85, player.z);

    if (roomCode && dbRef && Math.random() < 0.2) {
      dbRef.child("players/" + myPlayerId).update({
        x: player.x, y: player.y, z: player.z, hp: playerHp, level: level
      });
    }
  }

  function spawnParticles(pos, color, count = 8) {
    if (!settings.particles) return;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.06 + Math.random() * 0.05, 5, 5),
        new THREE.MeshBasicMaterial({ color })
      );
      mesh.position.copy(pos);
      scene.add(mesh);
      particles.push({
        mesh, velocity: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4),
        life: 0.3 + Math.random() * 0.35, maxLife: 0.65
      });
    }
  }

  function fireProjectile(enemy, spread = 0, color = 0xff3366) {
    const origin = new THREE.Vector3();
    enemy.group.getWorldPosition(origin);
    origin.y += enemy.boss ? 1.5 : 1;
    const target = new THREE.Vector3(player.x, player.y + 1, player.z);
    const dir = target.sub(origin).normalize();
    if (spread) dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), spread);

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(enemy.boss ? 0.24 : 0.15, 8, 8),
      new THREE.MeshBasicMaterial({ color })
    );
    mesh.position.copy(origin);
    scene.add(mesh);
    projectiles.push({
      mesh, velocity: dir.multiplyScalar(enemy.boss ? 9.5 : 7.5),
      damage: difficulties[difficulty].enemyDamage * (enemy.boss ? 1.4 : 1),
      life: 4, color
    });
  }

  function damagePlayer(amount, attackerPos = null) {
    if (invulnerable > 0 || state !== "playing") return;
    playerHp -= amount;
    invulnerable = 0.25;

    if (ui.flash) {
      ui.flash.style.opacity = "0.85";
      setTimeout(() => { ui.flash.style.opacity = "0"; }, 120);
    }

    playTone(90, 0.2, "sawtooth", 0.18);
    if (playerHp <= 0) {
      playerHp = 0;
      finishGame(false);
    }
  }

  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.life -= dt;
      const pPos = new THREE.Vector3(player.x, player.y + 0.9, player.z);

      if (p.mesh.position.distanceTo(pPos) < 0.75) {
        spawnParticles(p.mesh.position, p.color, 6);
        damagePlayer(p.damage, p.mesh.position);
        p.life = 0;
      }
      if (p.life <= 0) {
        scene.remove(p.mesh);
        projectiles.splice(i, 1);
      }
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.velocity.y -= 4 * dt;
      p.mesh.scale.setScalar(Math.max(0.04, p.life / p.maxLife));
      if (p.life <= 0) {
        scene.remove(p.mesh);
        particles.splice(i, 1);
      }
    }
  }

  function updateEnemies(dt) {
    for (const enemy of enemies) {
      const pos = enemy.group.position;
      const dx = player.x - pos.x; const dz = player.z - pos.z;
      const dist = Math.hypot(dx, dz);

      enemy.phaseTime += dt * 2;
      enemy.body.position.y = (enemy.boss ? 1.2 : 0.72) + Math.sin(enemy.phaseTime) * 0.05;
      enemy.attack -= dt;

      if (enemy.boss) {
        const hpRatio = enemy.hp / enemy.maxHp;
        if (hpRatio <= 0.33) enemy.phase = 3;
        else if (hpRatio <= 0.66) enemy.phase = 2;
        else enemy.phase = 1;

        if (enemy.phase === 3 && enemy.attack <= 0) {
          enemy.attack = 0.9;
          for (let s = -2; s <= 2; s++) fireProjectile(enemy, s * 0.2, 0xff0055);
        } else if (enemy.phase === 2 && enemy.attack <= 0) {
          enemy.attack = 1.3;
          fireProjectile(enemy, 0, 0xb449ff);
          fireProjectile(enemy, 0.35, 0xb449ff);
          fireProjectile(enemy, -0.35, 0xb449ff);
        } else if (enemy.phase === 1 && enemy.attack <= 0) {
          enemy.attack = 1.6;
          fireProjectile(enemy, 0, 0xd678ff);
        }
      } else if (enemy.kind === "ranged") {
        if (dist > 7) pos.addScaledVector(new THREE.Vector3(dx, 0, dz).normalize(), enemy.speed * dt);
        else if (dist < 4) pos.addScaledVector(new THREE.Vector3(-dx, 0, -dz).normalize(), enemy.speed * dt);
        if (enemy.attack <= 0 && dist < 12) {
          enemy.attack = 1.8; fireProjectile(enemy, 0, 0xffa54b);
        }
      } else if (dist > 1.35) {
        pos.addScaledVector(new THREE.Vector3(dx, 0, dz).normalize(), enemy.speed * dt);
      } else if (enemy.attack <= 0) {
        enemy.attack = 1.25;
        damagePlayer(difficulties[difficulty].enemyDamage, pos);
      }
      enemy.group.lookAt(player.x, pos.y + 0.8, player.z);
    }
  }

  function shoot() {
    if (state !== "playing" || fireCooldown > 0 || enemies.length === 0) return;
    fireCooldown = 0.25;
    camera.getWorldDirection(cameraDirection);
    raycaster.set(camera.position, cameraDirection);

    const targets = [];
    enemies.forEach(e => e.group.traverse(obj => { if (obj.isMesh) targets.push(obj); }));
    const hit = raycaster.intersectObjects(targets, false)[0];
    if (!hit) return;

    const enemy = enemies.find(e => e.group === hit.object.parent);
    if (!enemy) return;

    enemy.hp -= 30 + damageBonus;
    spawnParticles(hit.point, enemy.boss ? 0xd678ff : 0xffbd62, enemy.boss ? 12 : 6);
    playTone(260, 0.08, "square", 0.08);

    if (enemy.hp <= 0) {
      if (enemy.warnElement) enemy.warnElement.remove();
      const deathPos = new THREE.Vector3();
      enemy.group.getWorldPosition(deathPos);
      spawnParticles(deathPos.add(new THREE.Vector3(0, 1, 0)), enemy.boss ? 0xd500f9 : 0xff3d00, enemy.boss ? 40 : 14);
      platformGroup.remove(enemy.group);
      enemies = enemies.filter(e => e !== enemy);

      score += enemy.boss ? 3000 : 120 * level;
      playTone(enemy.boss ? 700 : 200, enemy.boss ? 0.8 : 0.2, "triangle");

      if (!enemies.length) {
        if (level === 10) {
          slowMoTimer = 1.5;
          state = "slowmo";
          if (ui.crosshair) ui.crosshair.classList.remove("on");
          showBanner("Victoire Suprême !", "Le Souverain d'Aether est terrassé.");
        } else {
          elevatorActive = true;
          showBanner("Arène Purifiée", "L'ascenseur est actif !");
        }
      }
    }
  }

  function interact() {
    if (state !== "playing" || enemies.length || level >= 10 || !elevatorActive) return;
    if (Math.hypot(player.x, player.z + 7.2) > 2.8) {
      showToast("Approche-toi du socle lumineux de l'ascenseur.");
      return;
    }
    playTone(340, 0.15, "triangle");
    state = "upgrade";
    if (ui.upgrade) {
      $("upHp").textContent = `Restaure 35 PV (Max: ${maxHp}).`;
      $("upSpeed").textContent = "Augmente la vitesse globale (+15%).";
      $("upDmg").textContent = "Augmente les dégâts de base (+18).";
      setScreen(ui.upgrade);
    }
  }

  function chooseUpgrade(type) {
    if (state !== "upgrade") return;
    if (type === "hp") playerHp = Math.min(maxHp, playerHp + 35);
    if (type === "speed") speedBonus += 0.85;
    if (type === "dmg") damageBonus += 18;

    state = "elevator";
    player.set(0, platformGroup.position.y + 0.35, -7.2);
    elevatorTravel = { elapsed: 0, duration: 1.8, start: player.y };
    playTone(180, 0.5, "sawtooth");
    setScreen(null);

    if (roomCode && dbRef && isHost) {
      dbRef.update({ level: level + 1 });
    }
  }

  function updateElevator(dt) {
    if (!elevatorTravel || !elevatorGroup) return;
    elevatorTravel.elapsed = Math.min(elevatorTravel.duration, elevatorTravel.elapsed + dt);
    const progress = elevatorTravel.elapsed / elevatorTravel.duration;
    const eased = progress * progress * (3 - 2 * progress);

    elevatorGroup.position.y = eased * 5;
    player.y = elevatorTravel.start + eased * 5;
    if (playerMesh) playerMesh.position.set(player.x, player.y + 0.85, player.z);

    if (progress >= 1) {
      level++;
      elevatorTravel = null;
      state = "playing";
      buildPlatform();
    }
  }

  function finishGame(won) {
    state = "ended";
    if (ui.crosshair) ui.crosshair.classList.remove("on");
    if (ui.endTitle) ui.endTitle.textContent = won ? "VICTOIRE !" : "RIPOSTE ÉCHOUÉE";

    if ($("endStats")) {
      $("endStats").innerHTML = `
        <div><span>Résultat</span><strong>${won ? "Tour conquise" : "Mort au combat"}</strong></div>
        <div><span>Étage atteint</span><strong>${level} / 10</strong></div>
        <div><span>Score Total</span><strong>${score} pts</strong></div>`;
    }
    setScreen(ui.end);
    document.exitPointerLock?.();
  }

  function openSettings(from) {
    settingsReturn = from;
    updateSettingsUI();
    renderKeyList();
    setScreen(ui.settings);
  }

  function closeSettings() {
    setScreen(settingsReturn === "pause" ? ui.pause : ui.main);
  }

  function pauseGame() {
    if (state === "playing") {
      state = "paused";
      held.clear();
      document.exitPointerLock?.();
      setScreen(ui.pause);
    } else if (state === "paused") {
      state = "playing";
      setScreen(null);
      clock.getDelta();
    }
  }

  function onKeyDown(event) {
    if (keyCapture) {
      event.preventDefault();
      if (event.code !== "Escape") {
        keys[keyCapture.dataset.key] = event.code;
        saveStorage("towerKeys", keys);
        renderKeyList();
      } else {
        keyCapture.classList.remove("waiting");
      }
      keyCapture = null;
      return;
    }
    if (Object.values(keys).includes(event.code)) event.preventDefault();
    if (event.code === keys.pause && ui.settings.classList.contains("hidden")) {
      pauseGame(); return;
    }

    if (state === "playing") {
      held.add(event.code);
      if (event.code === keys.interact) interact();
      if (event.code === keys.shoot && !event.code.startsWith("Mouse")) shoot();
      if (event.code === keys.view) {
        settings.view = settings.view === "first" ? "third" : "first";
        saveStorage("towerSettings", settings);
        showToast(settings.view === "first" ? "Vue 1re Personne" : "Vue 3e Personne");
      }
    } else if (state === "upgrade") {
      if (event.code === "Digit1") chooseUpgrade("hp");
      if (event.code === "Digit2") chooseUpgrade("speed");
      if (event.code === "Digit3") chooseUpgrade("dmg");
    }
  }

  function openCreateLobby() {
    roomCode = "ROOM_" + Math.floor(Math.random() * 9000 + 1000);
    isHost = true;
    if (ui.lobbyCodeInput) ui.lobbyCodeInput.value = roomCode;
    setScreen(ui.lobbyModal);
    setupLobbyFirebase(roomCode);
  }

  function openJoinLobby() {
    const code = ui.lobbyCodeInput ? ui.lobbyCodeInput.value.trim().toUpperCase() : "";
    if (!code) { showToast("Veuillez entrer un code de salle valide."); return; }
    roomCode = code;
    isHost = false;
    setScreen(ui.lobbyModal);
    setupLobbyFirebase(roomCode);
  }

  function setupLobbyFirebase(code) {
    if (!window.firebase) {
      showToast("Firebase non disponible. Mode local activé.");
      startGame(code, true);
      return;
    }
    dbRef = firebase.database().ref("rooms/" + code);
    dbRef.child("players/" + myPlayerId).set({ name: "Joueur_" + myPlayerId, ready: true });
    dbRef.child("players/" + myPlayerId).onDisconnect().remove();

    dbRef.on("value", (snapshot) => {
      const val = snapshot.val();
      if (!val) return;
      if (ui.lobbyPlayersList && val.players) {
        ui.lobbyPlayersList.replaceChildren();
        Object.keys(val.players).forEach(id => {
          const div = document.createElement("div");
          div.textContent = val.players[id].name + (id === myPlayerId ? " (Toi - Hôte)" : "");
          ui.lobbyPlayersList.append(div);
        });
      }
      if (ui.btnStartLobby) {
        ui.btnStartLobby.classList.toggle("hidden", !isHost);
      }
      if (!isHost && val.status === "playing" && state === "menu") {
        startGame(code, false);
      }
    });
  }

  function bindEvents() {
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", (e) => held.delete(e.code));
    window.addEventListener("blur", () => held.clear());

    window.addEventListener("mousedown", (e) => {
      if (!keyCapture) return;
      e.preventDefault(); e.stopImmediatePropagation();
      keys[keyCapture.dataset.key] = `Mouse${e.button}`;
      saveStorage("towerKeys", keys);
      keyCapture = null; renderKeyList();
    }, true);

    if (ui.canvas) {
      ui.canvas.addEventListener("mousemove", (e) => {
        if (document.pointerLockElement !== ui.canvas || state !== "playing") return;
        yaw -= e.movementX * 0.002 * Number(settings.sensX);
        pitch -= e.movementY * 0.002 * Number(settings.sensY) * (settings.invertY ? -1 : 1);
        pitch = THREE.MathUtils.clamp(pitch, -1.35, 1.35);
      });
      ui.canvas.addEventListener("mousedown", (e) => {
        if (state !== "playing") return;
        if (document.pointerLockElement !== ui.canvas) ui.canvas.requestPointerLock?.();
        if (keys.shoot === `Mouse${e.button}`) {
          mouseHeld = true; shoot();
        }
      });
    }

    window.addEventListener("mouseup", () => { mouseHeld = false; });
    window.addEventListener("contextmenu", (e) => e.preventDefault());

    if ($("btnPlay")) $("btnPlay").addEventListener("click", () => startGame());
    
    if (ui.btnCreateLobby) ui.btnCreateLobby.addEventListener("click", openCreateLobby);
    if (ui.btnJoinLobby) ui.btnJoinLobby.addEventListener("click", openJoinLobby);
    if (ui.btnStartLobby) ui.btnStartLobby.addEventListener("click", () => {
      if (dbRef) dbRef.update({ status: "playing" });
      startGame(roomCode, true);
    });

    if ($("btnSettings")) $("btnSettings").addEventListener("click", () => openSettings("menu"));
    if ($("btnPauseSettings")) $("btnPauseSettings").addEventListener("click", () => openSettings("pause"));
    if ($("btnSettingsBack")) $("btnSettingsBack").addEventListener("click", closeSettings);
    if ($("btnResume")) $("btnResume").addEventListener("click", pauseGame);
    if ($("btnQuit")) $("btnQuit").addEventListener("click", goToMenu);
    if ($("btnReplay")) $("btnReplay").addEventListener("click", () => startGame(roomCode));
    if ($("btnToMenu")) $("btnToMenu").addEventListener("click", goToMenu);
    if ($("btnResetKeys")) $("btnResetKeys").addEventListener("click", () => {
      keys = { ...defaultKeys };
      saveStorage("towerKeys", keys);
      renderKeyList();
    });

    document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => {
      document.querySelectorAll(".tab, .tabpanel").forEach(el => el.classList.remove("active"));
      tab.classList.add("active");
      $(tab.dataset.tab).classList.add("active");
    }));

    document.querySelectorAll("[data-s]").forEach(input => input.addEventListener("input", () => {
      const name = input.dataset.s;
      settings[name] = input.type === "checkbox" ? input.checked :
        input.type === "range" ? Number(input.value) : input.value;
      saveStorage("towerSettings", settings);
      updateSettingsUI();
    }));

    document.querySelectorAll(".card[data-up]").forEach(card => card.addEventListener("click", () => chooseUpgrade(card.dataset.up)));

    const joyZone = $("joystickZone");
    if (joyZone) {
      joyZone.addEventListener("touchmove", (e) => {
        const rect = joyZone.getBoundingClientRect();
        const touch = e.touches[0];
        touchJoystick.x = THREE.MathUtils.clamp((touch.clientX - (rect.left + 70)) / 50, -1, 1);
        touchJoystick.y = THREE.MathUtils.clamp((touch.clientY - (rect.top + 70)) / 50, -1, 1);
        touchJoystick.active = true;
      });
      joyZone.addEventListener("touchend", () => { touchJoystick.active = false; touchJoystick.x = 0; touchJoystick.y = 0; });
    }
    if ($("tJump")) $("tJump").addEventListener("touchstart", () => { if (grounded) { verticalVelocity = 6.5; grounded = false; } });
    if ($("tShoot")) $("tShoot").addEventListener("touchstart", shoot);
    if ($("tInteract")) $("tInteract").addEventListener("touchstart", interact);
  }

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

      movePlayer(dt);
      if (mouseHeld) shoot();
      updateEnemies(dt);
      updateProjectiles(dt);
      updateParticles(dt);
      updateWeather(dt);
      updateCamera();
      updateHud();

      frames++;
      if (worldTime - lastFpsUpdate >= 0.5) {
        if (ui.fpsText) ui.fpsText.textContent = `${Math.round(frames / (worldTime - lastFpsUpdate))} FPS`;
        frames = 0; lastFpsUpdate = worldTime;
      }
    } else if (state === "elevator") {
      updateElevator(realDt);
      updateWeather(realDt);
      updateCamera();
    } else if (state === "slowmo") {
      slowMoTimer -= realDt;
      updateParticles(dt);
      updateCamera();
      if (slowMoTimer <= 0) finishGame(true);
    } else if (camera) {
      camera.position.set(Math.sin(worldTime * 0.12) * 18, 12, Math.cos(worldTime * 0.12) * 18);
      camera.lookAt(0, 0, 0);
    }

    if (toastTimer > 0 && (toastTimer -= dt) <= 0 && ui.toast) ui.toast.classList.remove("show");
    if (bannerTimer > 0 && (bannerTimer -= dt) <= 0 && ui.banner) ui.banner.classList.remove("show");

    if (state === "playing" || state === "elevator") {
      musicTimer -= realDt;
      if (musicTimer <= 0) {
        playMusicBeat();
        musicTimer = level === 10 ? 0.42 : 0.68;
      }
    }
    if (renderer && scene && camera) renderer.render(scene, camera);
  }

  try {
    bindEvents();
    renderKeyList();
    initGraphics();
  } catch (err) {
    console.error("Initialisation impossible :", err);
    if (ui.loadError) {
      ui.loadError.textContent = `Erreur au chargement : ${err.message}`;
      ui.loadError.classList.add("show");
    }
  }
})();