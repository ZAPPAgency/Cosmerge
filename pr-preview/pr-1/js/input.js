// Godspark - pointer input (drag/tap merge) + all button/action handlers
"use strict";

function localPos(e) {
  if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  if (e.changedTouches && e.changedTouches[0]) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}
function cellIdxAtPoint(x, y) {
  const target = document.elementFromPoint(x, y);
  if (!target) return null;
  const cellEl = target.closest(".cell");
  if (!cellEl) return null;
  return parseInt(cellEl.dataset.idx, 10);
}
function createGhost(tier, x, y) {
  const g = document.createElement("div");
  g.className = "ghostTile";
  g.style.cssText += tierStyle(tier);
  g.appendChild(tierIconNode(tier));
  g.style.left = x + "px"; g.style.top = y + "px";
  document.body.appendChild(g);
  return g;
}

let pointerState = null;
let pointerWatchdog = null;

// Bug report (Loris' friend, screenshot): tapping very fast repeatedly left
// one cell permanently stuck - invisible/unresponsive, "je n'arrive pas à
// utiliser la case". Root cause: this listens to BOTH "pointerdown" AND
// "touchstart" (see wireEvents below) so a single physical touch on a
// touchscreen fires onPointerDown TWICE. Previously the 2nd call silently
// overwrote the module-scope `pointerState` with a fresh session - if the
// 1st call had already started a drag (ghost tile appended to <body>, the
// tile given the .dragging class which sets opacity:0), that ghost/class
// were orphaned forever: nothing held a reference to them any more, so
// onPointerUp's cleanup could never reach them, and the real tile stayed
// invisible under the leftover ghost until a full page reload. The same
// leak could also happen from any dropped up/cancel event (more likely
// inside an in-app browser like WhatsApp's, which is where the repro
// screenshot was taken).
// Fixed with: (1) ignoring a new pointerdown while a session is already in
// flight instead of clobbering it, (2) handling pointercancel/touchcancel
// so an interrupted gesture still cleans up, (3) a watchdog timeout as a
// last-resort safety net in case a webview drops both the up and cancel
// events outright.
function onPointerDown(e) {
  if (!dom.panelOverlay.classList.contains("hidden") || !dom.drawerOverlay.classList.contains("hidden")) return;
  if (pointerState) return; // a gesture is already being tracked - see note above
  const pos = localPos(e);
  const idx = cellIdxAtPoint(pos.x, pos.y);
  if (idx === null) return;
  e.preventDefault();
  ensureAudio();

  const state = Game.state;
  if (!state.unlocked[idx]) {
    handleLockedTap(idx);
    return;
  }

  pointerState = { idx, startX: pos.x, startY: pos.y, dragging: false, ghostEl: null };
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerCancel);
  window.addEventListener("touchmove", onPointerMove, { passive: false });
  window.addEventListener("touchend", onPointerUp);
  window.addEventListener("touchcancel", onPointerCancel);
  clearTimeout(pointerWatchdog);
  pointerWatchdog = setTimeout(() => { if (pointerState) onPointerCancel(); }, 6000);
}

function endPointerListeners() {
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
  window.removeEventListener("pointercancel", onPointerCancel);
  window.removeEventListener("touchmove", onPointerMove);
  window.removeEventListener("touchend", onPointerUp);
  window.removeEventListener("touchcancel", onPointerCancel);
  clearTimeout(pointerWatchdog);
}

// Gesture interrupted with no proper up event (OS takes over for a system
// gesture, multi-touch confuses the browser, app loses focus mid-touch, or
// - the watchdog case - the up/cancel event never arrives at all). Cleans up
// exactly like onPointerUp's non-merge branch, without attempting a merge.
function onPointerCancel() {
  if (!pointerState) return;
  const { idx, ghostEl } = pointerState;
  endPointerListeners();
  pointerState = null;
  if (ghostEl) ghostEl.remove();
  cellEls[idx].querySelector(".tile")?.classList.remove("dragging");
}

function onPointerMove(e) {
  if (!pointerState) return;
  const pos = localPos(e);
  const dx = pos.x - pointerState.startX, dy = pos.y - pointerState.startY;
  if (!pointerState.dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
    if (Game.swapArmed) return; // swap mode is tap-only, see handleSwapTap
    const tileData = Game.state.grid[pointerState.idx];
    if (!tileData) return;
    pointerState.dragging = true;
    cellEls[pointerState.idx].querySelector(".tile")?.classList.add("dragging");
    pointerState.ghostEl = createGhost(tileData.tier, pos.x, pos.y);
  }
  if (pointerState.dragging && pointerState.ghostEl) {
    e.preventDefault && e.preventDefault();
    pointerState.ghostEl.style.left = pos.x + "px";
    pointerState.ghostEl.style.top = pos.y + "px";
  }
}

function onPointerUp(e) {
  if (!pointerState) return;
  endPointerListeners();

  const pos = localPos(e);
  const { idx, dragging, ghostEl } = pointerState;
  pointerState = null;
  if (ghostEl) ghostEl.remove();
  cellEls[idx].querySelector(".tile")?.classList.remove("dragging");

  if (dragging) {
    const targetIdx = cellIdxAtPoint(pos.x, pos.y);
    if (targetIdx !== null && targetIdx !== idx && Game.state.unlocked[targetIdx] && Game.state.grid[targetIdx] && areAdjacent(idx, targetIdx)) {
      attemptMerge(idx, targetIdx);
    } else {
      renderCell(idx);
    }
    clearSelection();
    return;
  }
  handleTap(idx);
}

// Two-tap flow for the "Échanger deux cases" shop item: Gems are only
// charged once a second, different, unlocked cell is chosen (see
// buyGemShopItem's "swapCells" case in economy.js) - tapping the first cell
// again cancels the pick rather than charging for a no-op swap with itself.
function handleSwapTap(idx) {
  const state = Game.state;
  if (!state.unlocked[idx]) { toast("Choisis deux cases débloquées."); Sfx.error(); return; }
  if (Game.swapFirstIdx === null) {
    Game.swapFirstIdx = idx;
    selectCell(idx);
    toast("Choisis la seconde case à échanger.");
    return;
  }
  if (Game.swapFirstIdx === idx) {
    Game.swapFirstIdx = null;
    clearSelection();
    toast("Sélection annulée. Choisis une case à échanger.");
    return;
  }
  const idxA = Game.swapFirstIdx, idxB = idx;
  const result = buyGemShopItem(state, "swapCells", { idxA, idxB });
  Game.swapArmed = false;
  Game.swapFirstIdx = null;
  clearSelection();
  if (result.ok) { Sfx.purchase(); toast("Cases échangées !"); }
  else { Sfx.error(); toast(result.reason === "funds" ? "Pas assez de Gems." : "Échange impossible."); }
  renderAll();
  saveState(state);
}

function handleTap(idx) {
  if (Game.swapArmed) { handleSwapTap(idx); return; }
  const state = Game.state;
  const tileHere = state.grid[idx];

  if (tileHere) {
    // Merging is drag-only now (see the `dragging` branch in onPointerUp) -
    // tapping a filled tile no longer selects it as a merge target, it
    // just grants the tap bonus every time (the "clicker" aspect). Under
    // the old tap-to-tap-merge flow, a tap that happened to complete a
    // merge skipped the bonus - now every tap on a tile is consistently
    // rewarded.
    grantTapBonus(idx);
    return;
  }
  // Empty cell: tap selects/deselects it as the next invocation's target.
  if (Game.selectedIdx === idx) { clearSelection(); return; }
  selectCell(idx);
}

function handleLockedTap(idx) {
  const state = Game.state;
  if (Game.swapArmed) { toast("Choisis deux cases débloquées pour l'échange."); Sfx.error(); return; }
  if (Game.skipCellArmed) {
    const result = buyGemShopItem(state, "skipCell", { cellIndex: idx });
    Game.skipCellArmed = false;
    if (result.ok) { Sfx.unlock(); toast("Case débloquée avec des Gems !"); }
    else { Sfx.error(); toast(result.reason === "funds" ? "Pas assez de Gems." : "Impossible de débloquer cette case."); }
    renderAll();
    if (result.ok) {
      renderCell(idx, { justUnlocked: true }); // layer the unlock-pop animation on top of the plain renderAll() paint
      triggerResonanceIfLucky(state);
    }
    saveState(state);
    return;
  }
  tryUnlock(idx);
}

// Merges landing within this window of each other count as a "streak" -
// scales the impact effect and raises the reward chime's pitch a step each
// time (see Sfx.meteorImpact in audio.js), so fast merge chains feel
// increasingly rewarding. Resets the moment the player pauses.
const MERGE_STREAK_WINDOW_MS = 900;

function attemptMerge(fromIdx, toIdx) {
  const state = Game.state;
  const before = state.grid[fromIdx];
  if (before && before.tier >= TIERS.length) { Sfx.error(); toast("L'Univers ne peut pas fusionner davantage."); return; }
  const result = performMerge(state, fromIdx, toIdx);
  if (!result) return;
  const now = performance.now();
  Game.mergeStreak = (now - Game.lastMergeAt < MERGE_STREAK_WINDOW_MS) ? Game.mergeStreak + 1 : 0;
  Game.lastMergeAt = now;
  renderCell(fromIdx);
  // Keep showing the pre-merge tile at toIdx while the spark flicks in, and
  // hold every reward/reveal cue (tile swap, toast, haptic, god-ritual
  // popup) until the impact fires - it's ~110ms later, so this is still
  // effectively instant, just synced to the visual/audio landing.
  renderMergeStandIn(toIdx, before.tier);
  playMeteorMerge(toIdx, () => {
    renderCell(toIdx, { merged: true });
    HapticService.impact(result.newTier >= 8 ? "heavy" : "medium");
    if (result.gemBonus) toast("+1 💎 Gem bonus !");
    if (result.newTier === TIERS.length) toast("Univers créé ! 💥");
    else toast(tierName(result.newTier) + " " + tierEmoji(result.newTier) + " !");
    maybeOpenGodRitual();
  }, Game.mergeStreak, result.newTier);
  Sfx.meteorImpact(result.newTier, Game.mergeStreak);
  updateHeader();
  updateFabs();
  saveState(state);
  maybeOpenBigBangPrompt();
  maybeOpenFusionPromo();
}

// A toast alone was easy to miss - a player who reaches the Universe tile
// and doesn't realize Big Bang is how you "start a new game" can end up
// feeling stuck with nothing left to do. This surfaces it unmissably, once
// per run (reset in onBigBangConfirm), a beat after the merge animation.
function maybeOpenBigBangPrompt() {
  if (Game.bigBangPromptShown || !hasUniverseTile(Game.state)) return;
  Game.bigBangPromptShown = true;
  setTimeout(openBigBangModal, 700);
}

function maybeOpenGodRitual() {
  if (Game.pendingGodRitual) {
    Game.pendingGodRitual = false;
    openGodPickerModal();
  }
}

// Set by checkFusionPromo() (retention.js, via trackFusionEvent) the
// instant a fusion crosses the 10 or 50 lifetime-fusions milestone. 700ms
// delay to match maybeOpenBigBangPrompt above - lets the merge's own
// visual/audio impact land first instead of the promo popup racing it.
function maybeOpenFusionPromo() {
  if (!Game.pendingPromo) return;
  const kind = Game.pendingPromo;
  Game.pendingPromo = null;
  setTimeout(() => openFusionPromoModal(kind), 700);
}

function grantTapBonus(idx) {
  const now = performance.now();
  if (Game.cooldownUntil[idx] > now) return false;
  const state = Game.state;
  const tile = state.grid[idx];
  if (!tile) return false;
  const bonus = 5 * effectiveTileProd(state, tile.tier);
  grantStardust(state, bonus);
  updateQuestProgress(state, "tapBonuses", 1);
  resetErebusStreak(state);
  Game.cooldownUntil[idx] = now + TAP_COOLDOWN_MS;
  Sfx.tap();
  spawnFloatingBonus(idx, bonus);
  updateHeader();
  saveState(state);
  return true;
}

// "Résonance des Cases" run upgrade (RUN_UPGRADE_TREE, config.js) - rolled
// after every real unlock (tryUnlock, onUnlockCellAd, the skipCell Gems
// shortcut), never after the starter-pack's one-time bulk grant. Shared
// here so all 3 call sites show the same toast/animation/haptic when it
// hits, and so the bonus cell counts toward quests/achievements exactly
// like a normal unlock would.
function triggerResonanceIfLucky(state) {
  const idx = maybeTriggerResonance(state);
  if (idx === null) return;
  updateQuestProgress(state, "unlockCells", 1);
  checkAchievements(state);
  Sfx.unlock();
  toast("Résonance ! Une case bonus s'est débloquée ✨");
  renderCell(idx, { justUnlocked: true });
  updateFabs();
}

function tryUnlock(idx) {
  const state = Game.state;
  if (state.unlocked[idx]) return;
  const cost = unlockCost(state.extraUnlockedCount);
  if (state.stardust < cost) { toast("Pas assez de Stardust (" + formatNumber(cost) + "✨ requis)"); Sfx.error(); return; }
  spendStardust(state, cost);
  state.unlocked[idx] = true;
  state.extraUnlockedCount += 1;
  updateQuestProgress(state, "unlockCells", 1);
  checkAchievements(state);
  Sfx.unlock();
  toast("Case débloquée !");
  renderCell(idx, { justUnlocked: true });
  triggerResonanceIfLucky(state);
  refreshLockedCellPrices(); // every other locked cell's price just changed too
  updateHeader();
  // Loris: "Case gratuite" fab should disappear once the grid is fully
  // unlocked. updateFabs() already has that check (see fabUnlockCellAd),
  // but this - by far the most common way to unlock a cell, tapping it and
  // paying Stardust - never called it, only updateHeader(). The ad-watching
  // and Gems-shortcut unlock paths both already call updateFabs()
  // (onUnlockCellAd directly, skipCell via renderAll()), so this was the
  // one path where unlocking the very last cell left the fab visible.
  updateFabs();
  saveState(state);
}

function doInvoke() {
  const state = Game.state;
  const cost = invokeCost(state.manualSpawnCount);
  if (state.stardust < cost) { toast("Pas assez de Stardust pour invoquer."); Sfx.error(); return; }
  let target = (Game.selectedIdx !== null && state.unlocked[Game.selectedIdx] && !state.grid[Game.selectedIdx]) ? Game.selectedIdx : null;
  if (target === null) {
    const empties = emptyUnlockedIndices(state);
    if (empties.length === 0) { toast("La grille est pleine !"); Sfx.error(); return; }
    target = empties[Math.floor(Math.random() * empties.length)];
  }
  spendStardust(state, cost);
  state.manualSpawnCount += 1;
  state.grid[target] = { tier: 1 };
  renderCell(target, { spawned: true });
  Sfx.spawn();
  updateQuestProgress(state, "invokes", 1);
  clearSelection();
  updateHeader();
  saveState(state);
}

function doInvokeWithGems() {
  const state = Game.state;
  if (state.gems < GEMS_INVOKE_COST) { toast("Pas assez de Gems."); Sfx.error(); return; }
  let target = (Game.selectedIdx !== null && state.unlocked[Game.selectedIdx] && !state.grid[Game.selectedIdx]) ? Game.selectedIdx : null;
  if (target === null) {
    const empties = emptyUnlockedIndices(state);
    if (empties.length === 0) { toast("La grille est pleine !"); Sfx.error(); return; }
    target = empties[Math.floor(Math.random() * empties.length)];
  }
  state.gems -= GEMS_INVOKE_COST;
  state.grid[target] = { tier: 1 };
  renderCell(target, { spawned: true });
  Sfx.spawn();
  updateQuestProgress(state, "invokes", 1);
  clearSelection();
  updateHeader();
  saveState(state);
}

function clearSelection() {
  const prev = Game.selectedIdx;
  Game.selectedIdx = null;
  if (prev !== null) renderCell(prev);
  updateHeader();
}
function selectCell(idx) {
  const prev = Game.selectedIdx;
  Game.selectedIdx = idx;
  if (prev !== null && prev !== idx) renderCell(prev);
  renderCell(idx);
  updateHeader();
}

// ---------------- Auto spawn ----------------
function tickAutoSpawn(now) {
  const state = Game.state;
  const interval = autoSpawnIntervalMs(state);
  if (now - Game.lastAutoSpawn >= interval) {
    Game.lastAutoSpawn = now;
    const empties = emptyUnlockedIndices(state);
    if (empties.length > 0) {
      const idx = empties[Math.floor(Math.random() * empties.length)];
      state.grid[idx] = { tier: 1 };
      renderCell(idx, { spawned: true });
      updateQuestProgress(state, "autoSpawns", 1);
      saveState(state);
    }
  }
}

// Every rewarded-ad-gated bonus in the game should funnel through this
// instead of calling AdService.showRewarded directly: once ads are removed
// (purchase or VIP), the player already paid specifically not to watch ads,
// so the bonus is granted immediately with no video at all. Otherwise it
// behaves like a normal rewarded ad, and also tracks the watch count that
// triggers the one-time "remove ads" soft-prompt (see trackRewardedAdWatched).
async function watchRewardedAd(state, placementId) {
  if (adsRemoved(state)) return true;
  const ok = await AdService.showRewarded(placementId);
  if (ok && trackRewardedAdWatched(state)) openRemoveAdsPromptModal();
  return ok;
}

// ---------------- Big Bang / interstitial ----------------
async function maybeShowInterstitial() {
  const state = Game.state;
  if (adsRemoved(state)) return;
  const now = Date.now();
  if (now - Game.sessionStart < INTERSTITIAL_QUIET_START_MS) return;
  if (now - Game.lastInterstitial < INTERSTITIAL_MIN_GAP_MS) return;
  Game.lastInterstitial = now;
  await AdService.showInterstitial();
}

function onBigBangConfirm() {
  const state = Game.state;
  const runRecap = { stardustEarned: state.runStardustEarned, maxTier: state.maxTierThisRun };
  const gain = performBigBang(state);
  Game.bigBangPromptShown = false;
  Sfx.bigBang();
  HapticService.impact("success");
  closeBigBangModal();
  renderAll();
  saveState(state);
  maybeShowInterstitial();
  openBigBangSummaryModal({ ...runRecap, gain });
}

function onRestartConfirm() {
  const state = Game.state;
  restartRun(state);
  Game.bigBangPromptShown = false;
  Sfx.bigBang();
  HapticService.impact("medium");
  closeRestartModal();
  closePanel();
  toast("Nouvelle partie !");
  renderAll();
  saveState(state);
}

async function onSaveCodeAction() {
  const textarea = $("saveCodeText");
  if (Game.saveCodeMode === "export") {
    textarea.select();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(textarea.value);
        toast("Code copié !");
      } catch (e) {
        toast("Copie automatique indisponible : sélectionne le texte et copie-le à la main.");
      }
    } else {
      toast("Sélectionne le texte ci-dessus et copie-le à la main.");
    }
    return;
  }
  const imported = importSaveCode(textarea.value);
  if (!imported) { Sfx.error(); toast("Code invalide."); return; }
  Object.assign(Game.state, imported);
  Game.displayedStardust = Game.state.stardust;
  saveState(Game.state);
  closeSaveCodeModal();
  renderAll();
  toast("Sauvegarde restaurée !");
}

// ---------------- Offline modal actions ----------------
async function onOfflineCollect() {
  const state = Game.state;
  grantStardust(state, Game.pendingOfflineGain.gain);
  $("offlineModal").classList.add("hidden");
  updateHeader();
  saveState(state);
}
async function onOfflineDouble() {
  const state = Game.state;
  $("offlineCollect").disabled = true; $("offlineDouble").disabled = true;
  const ok = await watchRewardedAd(state, "offline_double");
  grantStardust(state, Game.pendingOfflineGain.gain * (ok ? 2 : 1));
  $("offlineCollect").disabled = false; $("offlineDouble").disabled = false;
  $("offlineModal").classList.add("hidden");
  toast(ok ? "Gains doublés !" : "Publicité non complétée.");
  updateHeader();
  saveState(state);
}

// ---------------- Daily login actions ----------------
function onDailyClaim() {
  const state = Game.state;
  const result = claimDailyLogin(state);
  if (!result) return;
  Sfx.chest();
  toast(`Jour ${result.cycleDay} récupéré : ${result.reward.label}`);
  openDailyModal();
  renderAll(); // an unlockCell/bigReward reward can change the grid or currencies
  saveState(state);
}

// ---------------- Wheel actions ----------------
const WHEEL_SPIN_MS = 3500; // MUST match .wheel's CSS transition duration (style.css)

// A run of "tick" sounds (Sfx.wheelTick, audio.js) at a decelerating rate
// over the spin, mimicking a real prize wheel clicking past its pegs -
// approximates the CSS transition's cubic-bezier(.17,.67,.2,1) ease-out
// (fast start, slow finish) with a geometrically growing interval between
// ticks, since precisely inverting that easing curve for tick timing isn't
// worth the complexity for a sound effect. Previously the wheel spun in
// total silence.
function scheduleWheelTicks(totalMs) {
  let elapsed = 0;
  let interval = 45;
  const growth = 1.09;
  const maxInterval = 260;
  function tick() {
    if (elapsed >= totalMs) return;
    Sfx.wheelTick();
    interval = Math.min(interval * growth, maxInterval);
    elapsed += interval;
    setTimeout(tick, interval);
  }
  tick();
}
// Bug (Loris): "je suis tombé sur le rouge mais j'ai pas eu la bonne
// récompense". Root cause - this used to pick a completely RANDOM landing
// angle (1440 + random 360deg) with zero connection to which prize
// spinWheel() actually awarded a few lines below in the caller's callback -
// two independent random rolls, so the wheel visually landing on a given
// color had nothing to do with the reward you actually got, most of the
// time. Fixed by determining the prize FIRST (onWheelSpinFree/Ad below now
// call spinWheel() before starting the animation, not after), then
// computing the exact rotation that lands the pointer (fixed at the top,
// 0deg) on THAT prize's own slice - see wheelSegmentBounds() (retention.js,
// shared with buildWheelSegments' rendering so the two can never disagree
// on where a slice actually is). A small random jitter within the slice
// (60% of its width, centered) keeps every spin looking a little different
// without ever landing close enough to a boundary to read as the wrong
// color.
//
// Also still fixes the earlier bug: "la roue ne tourne pas [...] pas le
// meme effet visuel" when spinning a second time (free spin, then
// immediately the ad-bonus spin) without closing the modal - the wheel's
// rotation persists across spins within the same modal session (only reset
// to 0deg on openWheelModal), so a naive fixed target could land behind (or
// barely past) wherever the previous spin left it. Still tracks a running
// total and always adds a forward delta on top of the current rotation.
let wheelRotation = 0;
function spinVisual(prizeIndex, cb) {
  const wheel = $("wheelEl");
  const { startDeg, endDeg } = wheelSegmentBounds(prizeIndex);
  const span = endDeg - startDeg;
  const jitter = (Math.random() - 0.5) * span * 0.6;
  const midDeg = (startDeg + endDeg) / 2 + jitter;
  const desiredMod = (360 - midDeg + 360) % 360; // wheelRotation mod 360 that puts this slice's midDeg under the fixed top pointer
  const currentMod = ((wheelRotation % 360) + 360) % 360;
  const forwardDelta = (desiredMod - currentMod + 360) % 360; // shortest forward-only rotation from here to the target orientation
  const extraSpins = (4 + Math.floor(Math.random() * 2)) * 360; // a few full turns on top, purely visual
  wheelRotation += extraSpins + forwardDelta;
  wheel.style.transform = `rotate(${wheelRotation}deg)`;
  scheduleWheelTicks(WHEEL_SPIN_MS);
  setTimeout(cb, WHEEL_SPIN_MS);
}
function onWheelSpinFree() {
  $("wheelSpinFree").disabled = true; $("wheelSpinAd").disabled = true;
  const prize = spinWheel(Game.state, false);
  spinVisual(prize ? WHEEL_PRIZES.indexOf(prize) : 0, () => {
    $("wheelResult").innerHTML = prize ? `Gagné : ${withCurrencyIcons(prize.label)}` : "Déjà utilisé aujourd'hui.";
    Sfx.wheelWin();
    refreshWheelButtons();
    updateHeader(); updateFabs();
    saveState(Game.state);
  });
}
async function onWheelSpinAd() {
  $("wheelSpinFree").disabled = true; $("wheelSpinAd").disabled = true;
  const ok = await watchRewardedAd(Game.state, "wheel_bonus");
  if (!ok) { refreshWheelButtons(); return; }
  const prize = spinWheel(Game.state, true);
  spinVisual(prize ? WHEEL_PRIZES.indexOf(prize) : 0, () => {
    $("wheelResult").innerHTML = prize ? `Gagné : ${withCurrencyIcons(prize.label)}` : "Déjà utilisé aujourd'hui.";
    Sfx.wheelWin();
    refreshWheelButtons();
    updateHeader(); updateFabs();
    saveState(Game.state);
  });
}

// ---------------- Unlock cell fab (rewarded ad) ----------------
async function onUnlockCellAd() {
  const state = Game.state;
  if (Date.now() < state.cooldowns.unlockCellAdUntil) {
    toast("Disponible dans " + formatDuration(state.cooldowns.unlockCellAdUntil - Date.now()));
    return;
  }
  if (unlockedCount(state) >= TOTAL) { toast("Toutes les cases sont déjà débloquées !"); return; }
  if (!adsRemoved(state)) toast("📺 Chargement de la publicité...");
  const ok = await watchRewardedAd(state, "unlock_cell");
  if (!ok) return;
  const result = grantFreeCellUnlock(state);
  if (result.ok) {
    renderCell(result.idx, { justUnlocked: true });
    triggerResonanceIfLucky(state);
    refreshLockedCellPrices();
    Sfx.unlock();
    toast("🔓 Case débloquée gratuitement !");
  } else {
    toast("Toutes les cases sont déjà débloquées !");
  }
  updateHeader();
  updateFabs();
  saveState(state);
}

// ---------------- Gems-for-ad (shop + home screen) ----------------
async function onWatchGemsAd() {
  const state = Game.state;
  if (Date.now() < state.cooldowns.gemsAdUntil) {
    toast("Disponible dans " + formatDuration(state.cooldowns.gemsAdUntil - Date.now()));
    return;
  }
  if (!adsRemoved(state)) toast("📺 Chargement de la publicité...");
  const ok = await watchRewardedAd(state, "gems_ad");
  if (!ok) return;
  const granted = grantGemsFromAd(state);
  Sfx.purchase();
  toast(`+${granted} 💎 !`);
  refreshCurrentPanel();
  updateHeader();
  updateFabs();
  saveState(state);
}

// ---------------- Shop / IAP / skills / quests handlers ----------------
async function onWatchProdBoostAd() {
  const state = Game.state;
  const boostActive = state.cooldowns.prodBoostActiveUntil > Date.now();
  if (boostActive) { toast("Boost déjà actif encore " + formatDuration(state.cooldowns.prodBoostActiveUntil - Date.now())); return; }
  if (Date.now() < state.cooldowns.prodBoostUntil) {
    toast("Disponible dans " + formatDuration(state.cooldowns.prodBoostUntil - Date.now()));
    return;
  }
  if (!adsRemoved(state)) toast("📺 Chargement de la publicité...");
  const ok = await watchRewardedAd(state, "prod_boost");
  if (!ok) return;
  activateProdBoost(state);
  Sfx.purchase();
  toast("🚀 Boost x2 production activé pour 10 min !");
  refreshCurrentPanel();
  updateHeader();
  updateFabs();
  saveState(state);
}
function onBuyGemItem(itemId) {
  if (itemId === "skipCell") {
    Game.skipCellArmed = true;
    closePanel();
    toast("Tape une case verrouillée à débloquer avec des Gems.");
    renderAll();
    return;
  }
  if (itemId === "swapCells") {
    if (Game.state.gems < SHOP_GEM_ITEMS.find(i => i.id === "swapCells").cost) { Sfx.error(); toast("Pas assez de Gems."); return; }
    Game.swapArmed = true;
    Game.swapFirstIdx = null;
    closePanel();
    toast("Choisis deux cases à échanger.");
    renderAll();
    return;
  }
  const result = buyGemShopItem(Game.state, itemId);
  if (!result.ok) { Sfx.error(); toast("Pas assez de Gems."); return; }
  Sfx.purchase();
  if (itemId === "cosmicBox") {
    openCosmicBoxRevealModal(result.box);
  } else if (itemId === "streakFreeze") {
    // Buying this has no visible on-screen change (unlike skipCell
    // unlocking a cell, or cosmicBox's reveal modal) - it just increments a
    // hidden counter used much later, the next time a login day is missed.
    // The generic "Achat effectue !" toast gave no sense anything had
    // really happened; naming the effect and the new charge count instead.
    toast("❄️ Gel de série ajouté ! (" + Game.state.dailyLogin.streakFreezeCharges + " en réserve)");
  } else {
    toast("Achat effectué !");
  }
  refreshCurrentPanel();
  updateHeader();
  saveState(Game.state);
  maybeOpenGodRitual();
  maybeOpenBigBangPrompt();
}
function onCosmeticAction(id, owned) {
  const state = Game.state;
  if (owned) {
    equipCosmetic(state, id);
  } else {
    const result = buyCosmeticWithGems(state, id);
    if (!result.ok) { Sfx.error(); toast("Pas assez de Gems."); return; }
    equipCosmetic(state, id);
    Sfx.purchase();
  }
  renderAll();
  refreshCurrentPanel();
  saveState(state);
}
function onSetIconStyle(style) {
  const state = Game.state;
  if (state.iconStyle === style) return;
  state.iconStyle = style;
  renderAll();
  refreshCurrentPanel();
  saveState(state);
}
async function onBuyIAP(productId) {
  const product = IAP_CATALOG.find(p => p.id === productId);
  const res = await IAPService.purchase(productId);
  if (!res.success) return;
  const state = Game.state;
  switch (productId) {
    case "remove_ads": state.iap.removeAds = true; break;
    case "starter_pack":
      state.gems += 500; state.lifetime.gemsEarned += 500;
      { const locked = []; for (let i = 0; i < TOTAL; i++) if (!state.unlocked[i]) locked.push(i);
        for (let k = 0; k < 3 && locked.length; k++) { const pick = locked.splice(Math.floor(Math.random() * locked.length), 1)[0]; state.unlocked[pick] = true; state.extraUnlockedCount += 1; } }
      state.cooldowns.prodBoostActiveUntil = Date.now() + 3600000;
      break;
    case "gems_small": case "gems_medium": case "gems_large": case "gems_mega":
      state.gems += product.amount; state.lifetime.gemsEarned += product.amount; break;
    case "vip_monthly": state.iap.vipUntil = Date.now() + 30 * 24 * 3600 * 1000; break;
    case "stardust_boost": state.iap.stardustBoost = true; break;
  }
  Sfx.purchase();
  refreshCurrentPanel();
  renderAll();
  saveState(state);
  openPurchaseConfirmModal(product);
}
async function onRestorePurchases() {
  await IAPService.restorePurchases();
  toast("Achats restaurés.");
  refreshCurrentPanel();
}
function onChooseGod(godId) {
  const state = Game.state;
  const hadCurrent = !!state.gods.currentGodId;
  const wasQueued = state.gods.nextGodId;
  chooseGod(state, godId);
  Sfx.purchase();
  if (!hadCurrent) toast(`${getGod(godId).name} t'accompagne désormais !`);
  else if (wasQueued && !state.gods.nextGodId) toast("Choix annulé.");
  else toast(`${getGod(godId).name} choisi pour le prochain Big Bang.`);
  refreshCurrentPanel();
  saveState(state);
}
function onBuyGod(godId) {
  const result = buyGodWithGems(Game.state, godId);
  if (!result.ok) { Sfx.error(); toast("Pas assez de Gems."); return; }
  refreshCurrentPanel();
  updateHeader();
  saveState(Game.state);
}
function onBuyGodPower(godId) {
  const result = buyGodPowerLevel(Game.state, godId);
  if (!result.ok) { Sfx.error(); toast(result.reason === "max" ? "Niveau maximum atteint." : "Pas assez de Gems."); return; }
  Sfx.purchase();
  toast(`${getGod(godId).name} — niveau de pouvoir ${result.newLevel} !`);
  refreshCurrentPanel();
  updateHeader();
  saveState(Game.state);
}

function onProfileSave() {
  const state = Game.state;
  const name = $("profileNameInput").value.trim();
  state.profile.name = name || "Joueur";
  state.profile.emoji = profileDraft.emoji;
  state.profile.color = profileDraft.color;
  Sfx.purchase();
  toast("Profil enregistré !");
  closeProfileModal();
  saveState(state);
}

function onBuySkill(key) {
  const result = buySkill(Game.state, key);
  if (!result.ok) { Sfx.error(); toast(result.reason === "max" ? "Niveau maximum atteint." : "Pas assez d'Énergie Cosmique."); return; }
  Sfx.purchase();
  toast(SKILL_TREE[key].name + " amélioré !");
  refreshCurrentPanel();
  updateHeader();
  saveState(Game.state);
}
function onBuyRunUpgrade(key) {
  const result = buyRunUpgrade(Game.state, key);
  if (!result.ok) { Sfx.error(); toast(result.reason === "max" ? "Niveau maximum atteint." : "Pas assez de Stardust."); return; }
  Sfx.purchase();
  toast(RUN_UPGRADE_TREE[key].name + " amélioré !");
  refreshCurrentPanel();
  updateHeader();
  saveState(Game.state);
}
function onClaimQuest(id) {
  const reward = claimQuest(Game.state, id);
  if (reward === null) return;
  Sfx.quest();
  toast(`Quête réclamée : +${reward} 💎`);
  refreshCurrentPanel();
  updateHeader();
  saveState(Game.state);
}
async function onBonusAdQuest() {
  const state = Game.state;
  if (state.quests.bonusAd.claimed) return;
  if (!state.quests.bonusAd.done) {
    const ok = await watchRewardedAd(state, "quest_ad");
    if (!ok) return;
    markBonusAdQuestDone(state);
    // Ads removed: there's no separate "watch" step for the player to see,
    // so go straight on to claiming instead of leaving a second tap behind.
    if (!adsRemoved(state)) { refreshCurrentPanel(); saveState(state); return; }
  }
  const reward = claimBonusAdQuest(state);
  if (reward) { Sfx.quest(); toast(`Quête bonus réclamée : +${reward} 💎`); refreshCurrentPanel(); updateHeader(); saveState(state); }
}

// ---------------- Wiring ----------------
// A single delegated listener covers every chrome button (menu, tabs, panel
// close, switches, fabs...) instead of wiring a click sound at each call
// site. Buttons that already play their own distinct sound synchronously on
// click (Invoquer, Big Bang confirm) either stop propagation or are excluded
// by id below, so this never doubles up with them.
const SILENT_CLICK_IDS = new Set(["bigBangConfirm", "invokeBtnStardust", "invokeBtnGems"]);
function wireClickSound() {
  document.addEventListener("click", (e) => {
    const el = e.target.closest(".btn, .drawerItem, .iconBtn, .fab, .switch, .tabBtn");
    if (!el || el.disabled || SILENT_CLICK_IDS.has(el.id)) return;
    Sfx.click();
  });
}

// Tapping the dark backdrop closes whichever modal is open, same as its own
// close/cancel button - except the first-god ritual, which is a mandatory
// one-time choice with no close button at all by design.
function wireModalBackdropClose() {
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("modalOverlay") && e.target.id !== "godRitualModal") {
      e.target.classList.add("hidden");
    }
  });
}

function wireEvents() {
  wireClickSound();
  wireModalBackdropClose();
  document.addEventListener("pointerdown", onPointerDown, { passive: false });
  document.addEventListener("touchstart", onPointerDown, { passive: false });

  // Used to be one button that opened a choice modal (Stardust vs Gems) -
  // Loris found the extra step frustrating, now each currency has its own
  // direct-action button (see .invokeSection, index.html).
  dom.invokeBtnStardust.addEventListener("click", () => { ensureAudio(); doInvoke(); });
  dom.invokeBtnGems.addEventListener("click", () => { ensureAudio(); doInvokeWithGems(); });
  dom.bigBangBtn.addEventListener("click", () => openBigBangModal());
  dom.menuBtn.addEventListener("click", () => openDrawer());
  dom.drawerClose.addEventListener("click", closeDrawer);
  $("drawerHeadEdit").addEventListener("click", (e) => { e.stopPropagation(); closeDrawer(); openProfileModal(); });
  $("profileCancel").addEventListener("click", closeProfileModal);
  $("profileSave").addEventListener("click", onProfileSave);
  dom.drawerOverlay.addEventListener("click", (e) => { if (e.target === dom.drawerOverlay) closeDrawer(); });
  document.querySelectorAll(".drawerItem[data-panel]").forEach(b => b.addEventListener("click", () => openPanel(b.dataset.panel)));
  dom.panelClose.addEventListener("click", closePanel);

  $("fabShop").addEventListener("click", () => openPanel("shop"));
  // Loris: le panneau Alchimie Stellaire (RUN_UPGRADE_TREE) doit être accessible
  // directement depuis l'écran de jeu, pas seulement enfoui dans le menu ☰ -
  // fab toujours visible, comme Boutique, plutôt que conditionnel comme
  // Cadeau/Roue.
  $("fabRunUpgrades").addEventListener("click", () => openPanel("runUpgrades"));
  dom.fabDailyLogin.addEventListener("click", openDailyModal);
  dom.fabWheel.addEventListener("click", openWheelModal);
  $("fabBoost").addEventListener("click", onWatchProdBoostAd);
  $("fabUnlockCellAd").addEventListener("click", onUnlockCellAd);
  dom.fabSwapCells.addEventListener("click", () => onBuyGemItem("swapCells"));
  $("fabCurrentGod").addEventListener("click", () => openPanel("gods"));
  $("fabRestart").addEventListener("click", openRestartModal);
  $("fabGemsAd").addEventListener("click", onWatchGemsAd);
  $("fabSkins").addEventListener("click", openSkinManagerModal);
  $("skinManagerClose").addEventListener("click", closeSkinManagerModal);
  $("skinPreviewClose").addEventListener("click", closeSkinPreviewModal);
  $("cosmicBoxClose").addEventListener("click", closeCosmicBoxModal);
  $("purchaseConfirmClose").addEventListener("click", closePurchaseConfirmModal);

  dom.energyPill.addEventListener("click", () => openPanel("skills"));
  $("gemsPill").addEventListener("click", openGemsMenuModal);
  $("stardustPill").addEventListener("click", openStardustInfoModal);
  $("stardustInfoClose").addEventListener("click", closeStardustInfoModal);
  $("gemsMenuShop").addEventListener("click", () => { closeGemsMenuModal(); openPanel("shop"); });
  $("gemsMenuGods").addEventListener("click", () => { closeGemsMenuModal(); openPanel("gods"); });
  $("gemsMenuClose").addEventListener("click", closeGemsMenuModal);

  $("tutNext").addEventListener("click", () => { tutIndex++; if (tutIndex >= TUT_STEPS.length) endTutorial(); else showTutStep(tutIndex); });
  $("tutSkip").addEventListener("click", () => endTutorial());

  $("offlineCollect").addEventListener("click", onOfflineCollect);
  $("offlineDouble").addEventListener("click", onOfflineDouble);

  $("dailyClaim").addEventListener("click", onDailyClaim);
  $("dailyClose").addEventListener("click", closeDailyModal);

  $("wheelSpinFree").addEventListener("click", onWheelSpinFree);
  $("wheelSpinAd").addEventListener("click", onWheelSpinAd);
  $("wheelClose").addEventListener("click", closeWheelModal);

  $("bigBangConfirm").addEventListener("click", onBigBangConfirm);
  $("bigBangCancel").addEventListener("click", closeBigBangModal);
  $("restartCancel").addEventListener("click", closeRestartModal);
  $("restartConfirm").addEventListener("click", onRestartConfirm);

  $("confirmActionCancel").addEventListener("click", closeConfirmModal);
  $("confirmActionConfirm").addEventListener("click", onConfirmActionConfirm);

  $("saveCodeCancel").addEventListener("click", closeSaveCodeModal);
  $("saveCodeAction").addEventListener("click", onSaveCodeAction);

  $("bbSummaryClose").addEventListener("click", closeBigBangSummaryModal);

  $("removeAdsPromptLater").addEventListener("click", closeRemoveAdsPromptModal);
  $("removeAdsPromptBuy").addEventListener("click", () => {
    closeRemoveAdsPromptModal();
    const product = IAP_CATALOG.find(p => p.id === "remove_ads");
    openConfirmModal({
      title: product.name,
      text: `${product.desc} — ${product.price}`,
      confirmLabel: "Acheter",
      onConfirm: () => onBuyIAP("remove_ads"),
    });
  });

  $("fusionPromoLater").addEventListener("click", closeFusionPromoModal);
  $("fusionPromoBuy").addEventListener("click", () => {
    const id = fusionPromoProductId;
    closeFusionPromoModal();
    const product = id && IAP_CATALOG.find(p => p.id === id);
    if (!product) return;
    openConfirmModal({
      title: product.name,
      text: `${product.desc || ""} — ${product.price}`,
      confirmLabel: product.type === "subscription" ? "S'abonner" : "Acheter",
      onConfirm: () => onBuyIAP(id),
    });
  });
}
