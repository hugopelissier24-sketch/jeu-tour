/* =====================================================================
   AETHER ASCENDANT — Extensions (Succès, Leaderboard, Skins, Audio, Spectateur)
   ===================================================================== */
(function () {
  "use strict";

  // 1. SYSTÈME DE SUCCÈS (ACHIEVEMENTS)
  const achievements = [
    { id: "first_blood", title: "Premier Sang", desc: "Vaincre ton premier ennemi", done: false },
    { id: "climber", title: "Ascension", desc: "Atteindre la 5e plateforme", done: false },
    { id: "master", title: "Maître d'Aether", desc: "Terminer le jeu", done: false }
  ];

  function unlockAchievement(id) {
    const ach = achievements.find(a => a.id === id);
    if (ach && !ach.done) {
      ach.done = true;
      localStorage.setItem("tower_ach_" + id, "true");
      showExtToast(`🏆 Succès débloqué : ${ach.title}`);
    }
  }

  // Restaure les succès enregistrés
  achievements.forEach(a => {
    if (localStorage.getItem("tower_ach_" + a.id) === "true") a.done = true;
  });

  function showExtToast(msg) {
    let t = document.getElementById("extToast");
    if (!t) {
      t = document.createElement("div");
      t.id = "extToast";
      t.style.cssText = "position:fixed; bottom:24px; left:50%; transform:translateX(-50%); background:linear-gradient(135deg, #f39c12, #d35400); color:#fff; padding:12px 24px; border-radius:10px; font-weight:bold; font-size:15px; z-index:99999; box-shadow:0 10px 30px rgba(0,0,0,0.5); transition:opacity 0.4s; pointer-events:none;";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = "1";
    setTimeout(() => { t.style.opacity = "0"; }, 3500);
  }


  // 2. LEADERBOARD MONDIAL (FIREBASE)
  window.submitLeaderboardScore = function (scoreVal, nameVal) {
    if (window.firebase && firebase.apps.length) {
      try {
        const db = firebase.database();
        db.ref("global_leaderboard").push({
          score: scoreVal,
          name: nameVal || "Aventurier",
          timestamp: Date.now()
        });
      } catch (e) {
        console.warn("Erreur envoi leaderboard", e);
      }
    }
  };


  // 3. PERSONNALISATION DES SKINS (COULEURS)
  window.playerCustomColor = localStorage.getItem("towerPlayerColor") || "#00bcd4";
  window.bulletCustomColor = localStorage.getItem("towerBulletColor") || "#7df9ff";


  // 4. SONS ADDITIONNELS (EFFETS AMBIANTS AVANCÉS)
  const extAudioCtx = window.AudioContext || window.webkitAudioContext;
  let customSoundGain = null;
  function playCustomSound(freq, duration) {
    if (!extAudioCtx) return;
    try {
      const ctx = new extAudioCtx();
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) { /* Audio ignoré si bloqué par le navigateur */ }
  }


  // 5. MODE SPECTATEUR / CAMÉRA LIBRE APRÈS LA MORT
  let spectatorActive = false;
  let spectatorAngle = 0;

  function initSpectatorMode() {
    const endScreen = document.getElementById("endScreen");
    if (!endScreen) return;
    
    // Écoute l'apparition de l'écran de fin pour activer la caméra libre
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        if (m.target.id === "endScreen" && !m.target.classList.contains("hidden")) {
          spectatorActive = true;
          unlockAchievement("master"); // Exemple d'appel si victoire ou fin
        }
      });
    });
    observer.observe(endScreen, { attributes: true, attributeFilter: ["class"] });
  }

  // Boucle d'écoute globale discrète pour tracker les actions du jeu d'origine
  setInterval(() => {
    // Vérifie si le joueur progresse pour déclencher les succès
    const levelText = document.getElementById("levelText");
    if (levelText && levelText.textContent.includes("Plateforme 5")) {
      unlockAchievement("climber");
    }
  }, 1000);

  window.addEventListener("DOMContentLoaded", () => {
    initSpectatorMode();
    console.log("Aether Ascendant — Extensions intégrées avec succès !");
  });

})();