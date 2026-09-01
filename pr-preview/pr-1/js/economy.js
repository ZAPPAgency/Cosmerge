// Godspark - prestige (Big Bang), permanent skill tree, shop logic
"use strict";

// Was `t.tier === TIERS.length` - broke the moment TIERS grew past Univers
// (tier 10, UNIVERSE_TIER in config.js): merging two Univers tiles into a
// Multivers removes every tier-10 tile from the grid, which would silently
// revoke Big Bang eligibility a player had already earned. UNIVERSE_TIER is
// a fixed reference instead of "whatever the current ceiling is" - reaching
// Univers or anything higher keeps Big Bang available for the rest of the
// run, however far past it the player pushes.
function hasUniverseTile(state) {
  return state.grid.some(t => t && t.tier >= UNIVERSE_TIER);
}
// "Surcharge du Big Bang" run upgrade (RUN_UPGRADE_TREE, config.js) applies
// here rather than inside the pure bigBangGain() formula (config.js) so
// that stays a plain function of (stardust, tier) with no state coupling -
// this is also what performBigBang() below actually calls to grant the
// real gain, so the number shown in the pre-Big-Bang preview (Loris:
// openBigBangModal, ui.js) is always exactly what gets paid out.
function previewBigBangGain(state) {
  const base = bigBangGain(state.runStardustEarned, state.maxTierThisRun);
  const surgeMult = 1 + (state.runUpgrades.surge || 0) * 0.05;
  return Math.round(base * surgeMult);
}

function performBigBang(state) {
  checkThanatosChallenge(state); // must run before the grid resets - it checks the current grid's fill state
  const minEnergy = getGodEffects(state).bigBangMinEnergy || 0;
  const gain = Math.max(previewBigBangGain(state), minEnergy);
  state.cosmicEnergy += gain;
  state.lifetime.bigBangCount += 1;

  // Personal-best time-to-Big-Bang, surfaced in the Stardust info popup as a
  // target to beat next run (see ui.js openStardustInfoModal).
  const elapsedMs = Date.now() - state.runStartedAt;
  if (state.lifetime.bestBigBangMs === null || elapsedMs < state.lifetime.bestBigBangMs) {
    state.lifetime.bestBigBangMs = elapsedMs;
  }

  applyPendingGodAtBigBang(state);
  const seeded = freshGrid(state);
  state.grid = seeded.grid;
  state.unlocked = seeded.unlocked;
  state.stardust = 0;
  state.runStardustEarned = 0;
  state.maxTierThisRun = 1;
  state.manualSpawnCount = 0;
  state.extraUnlockedCount = 0;
  state.runStartedAt = Date.now();
  // Run upgrades (RUN_UPGRADE_TREE) are scoped to the grid that just ended -
  // reset alongside every other per-run field above, same lifecycle as
  // moonMergesThisRun/usedShortcutThisRun.
  for (const key in state.runUpgrades) state.runUpgrades[key] = 0;

  checkAchievements(state);
  return gain;
}

// Voluntary reset, available anytime (unlike Big Bang, which needs a
// Universe tile). No Cosmic Energy is granted and lifetime.bigBangCount is
// NOT incremented - this is giving up on a run, not completing one.
function restartRun(state) {
  if (state.gods.nextGodId) {
    state.gods.currentGodId = state.gods.nextGodId;
    state.gods.nextGodId = null;
  }
  state.moonMergesThisRun = 0;
  state.gods.erebusStreak = 0;
  state.gods.usedShortcutThisRun = false;

  const seeded = freshGrid(state);
  state.grid = seeded.grid;
  state.unlocked = seeded.unlocked;
  state.stardust = 0;
  state.runStardustEarned = 0;
  state.maxTierThisRun = 1;
  state.manualSpawnCount = 0;
  state.extraUnlockedCount = 0;
  state.runStartedAt = Date.now();
  for (const key in state.runUpgrades) state.runUpgrades[key] = 0;
}

function buySkill(state, key) {
  const branch = SKILL_TREE[key];
  const level = state.skills[key];
  if (level >= branch.maxLevel) return { ok: false, reason: "max" };
  const cost = skillCost(key, level + 1);
  if (state.cosmicEnergy < cost) return { ok: false, reason: "funds", cost };
  state.cosmicEnergy -= cost;
  state.skills[key] += 1;
  return { ok: true, cost, newLevel: state.skills[key] };
}

// Run-scoped upgrade tree (RUN_UPGRADE_TREE, config.js), Stardust-priced,
// mirrors buySkill() above but spends state.stardust instead of
// state.cosmicEnergy and resets to 0 on every Big Bang/restart (see the
// resets in performBigBang/restartRun above).
function buyRunUpgrade(state, key) {
  const branch = RUN_UPGRADE_TREE[key];
  const level = state.runUpgrades[key];
  if (level >= branch.maxLevel) return { ok: false, reason: "max" };
  const cost = runUpgradeCost(key, level + 1);
  if (state.stardust < cost) return { ok: false, reason: "funds", cost };
  state.stardust -= cost;
  state.runUpgrades[key] += 1;
  return { ok: true, cost, newLevel: state.runUpgrades[key] };
}

// "Résonance" run upgrade: each level adds a flat chance that unlocking a
// cell (by tap, ad, or Gems shortcut) resonates and frees one extra random
// locked cell for free. Called from the 3 real unlock paths in input.js
// (tryUnlock, onUnlockCellAd, the skipCell gem-shop purchase) - NOT from the
// starter-pack bulk 3-cell grant, which is a store-bought convenience, not
// gameplay progress. Returns the bonus cell's index, or null if it didn't
// trigger / there was nothing left to unlock.
function maybeTriggerResonance(state) {
  const level = state.runUpgrades.resonance || 0;
  if (level <= 0) return null;
  if (Math.random() >= level * 0.03) return null;
  const locked = [];
  for (let i = 0; i < TOTAL; i++) if (!state.unlocked[i]) locked.push(i);
  if (locked.length === 0) return null;
  const idx = locked[Math.floor(Math.random() * locked.length)];
  state.unlocked[idx] = true;
  state.extraUnlockedCount += 1;
  return idx;
}

function buyGemShopItem(state, itemId, opts) {
  const item = SHOP_GEM_ITEMS.find(i => i.id === itemId);
  if (!item) return { ok: false, reason: "unknown" };
  if (state.gems < item.cost) return { ok: false, reason: "funds", cost: item.cost };

  if (itemId === "skipCell") {
    const idx = opts && opts.cellIndex;
    if (idx === undefined || state.unlocked[idx]) return { ok: false, reason: "target" };
    state.gems -= item.cost;
    state.unlocked[idx] = true;
    state.extraUnlockedCount += 1;
    state.gods.usedShortcutThisRun = true;
    return { ok: true };
  }
  if (itemId === "swapCells") {
    const idxA = opts && opts.idxA, idxB = opts && opts.idxB;
    if (idxA === undefined || idxB === undefined || idxA === idxB) return { ok: false, reason: "target" };
    if (!state.unlocked[idxA] || !state.unlocked[idxB]) return { ok: false, reason: "target" };
    state.gems -= item.cost;
    const tmp = state.grid[idxA];
    state.grid[idxA] = state.grid[idxB];
    state.grid[idxB] = tmp;
    state.gods.usedShortcutThisRun = true;
    return { ok: true, idxA, idxB };
  }
  if (itemId === "streakFreeze") {
    state.gems -= item.cost;
    state.dailyLogin.streakFreezeCharges += 1;
    return { ok: true };
  }
  if (itemId === "cosmicBox") {
    state.gems -= item.cost;
    const result = rollCosmicBox(state);
    return { ok: true, box: result };
  }
  return { ok: false, reason: "unhandled" };
}

// Single pair merge used by tap/drag input.
function performMerge(state, fromIdx, toIdx) {
  const a = state.grid[fromIdx], b = state.grid[toIdx];
  if (!a || !b || a.tier !== b.tier || a.tier >= TIERS.length) return null;
  const newTier = a.tier + 1;
  state.grid[fromIdx] = null;
  state.grid[toIdx] = { tier: newTier };
  state.lifetime.fusions += 1;
  state.maxTierThisRun = Math.max(state.maxTierThisRun, newTier);
  state.lifetime.maxTierEver = Math.max(state.lifetime.maxTierEver, newTier);

  let gemBonus = 0;
  const luckChance = state.skills.luck * 0.01 + (getGodEffects(state).gemChanceBonus || 0);
  if (Math.random() < luckChance) {
    gemBonus = grantGems(state, 1);
  }

  trackFusionEvent(state, newTier);
  return { newTier, gemBonus };
}

// Was shared between two cosmetic slots (ambiance/background + emoji-set),
// now just emoji-set - the ambiance color skins were removed entirely per
// Loris' request, EMOJI_SETS (Fruits/Légumes) stays.
function findCosmeticItem(id) {
  return EMOJI_SETS.find(e => e.id === id) || null;
}
function buyCosmeticWithGems(state, id) {
  const item = findCosmeticItem(id);
  if (!item || item.cost === 0) return { ok: false, reason: "unknown" };
  if (isSkinOwned(state, id)) return { ok: false, reason: "owned" };
  if (state.gems < item.cost) return { ok: false, reason: "funds" };
  state.gems -= item.cost;
  state.ownedSkins.push(id);
  return { ok: true };
}
function unlockCosmeticFree(state, id) {
  if (!state.ownedSkins.includes(id)) state.ownedSkins.push(id);
}
function equipCosmetic(state, id) {
  if (!findCosmeticItem(id) || !isSkinOwned(state, id)) return false;
  state.equippedEmojiSet = id;
  return true;
}

function activateProdBoost(state) {
  const now = Date.now();
  state.cooldowns.prodBoostActiveUntil = now + PROD_BOOST_DURATION_MS;
  state.cooldowns.prodBoostUntil = now + PROD_BOOST_COOLDOWN_MS;
}

// Ad-based Gems source, meant to be grindable toward a specific shop item
// rather than a big one-off (see GEMS_AD_COOLDOWN_MS/GEMS_AD_REWARD).
function grantGemsFromAd(state) {
  const granted = grantGems(state, GEMS_AD_REWARD);
  state.cooldowns.gemsAdUntil = Date.now() + GEMS_AD_COOLDOWN_MS;
  return granted;
}

// Ad-based relief valve for unlockCost's 1.5x-per-cell growth, which is what
// makes the last few cells of a run cost tens of thousands of Stardust.
function grantFreeCellUnlock(state) {
  const locked = [];
  for (let i = 0; i < TOTAL; i++) if (!state.unlocked[i]) locked.push(i);
  if (locked.length === 0) return { ok: false, reason: "full" };
  const idx = locked[Math.floor(Math.random() * locked.length)];
  state.unlocked[idx] = true;
  state.extraUnlockedCount += 1;
  state.cooldowns.unlockCellAdUntil = Date.now() + UNLOCK_CELL_AD_COOLDOWN_MS;
  return { ok: true, idx };
}
