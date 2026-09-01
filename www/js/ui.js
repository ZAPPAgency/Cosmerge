// Godspark - all rendering: grid, header, panels, modals, toasts, tutorial
"use strict";

const $ = (id) => document.getElementById(id);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const dom = {
  grid: $("grid"),
  stardustValue: $("stardustValue"),
  stardustRate: $("stardustRate"),
  gemsValue: $("gemsValue"),
  energyValue: $("energyValue"),
  energyPill: $("energyPill"),
  invokeBtnStardust: $("invokeBtnStardust"),
  invokeBtnGems: $("invokeBtnGems"),
  invokeCost: $("invokeCost"),
  fabSwapCells: $("fabSwapCells"),
  bigBangBtn: $("bigBangBtn"),
  selectionHint: $("selectionHint"),
  toastContainer: $("toastContainer"),
  fabDailyLogin: $("fabDailyLogin"),
  fabWheel: $("fabWheel"),
  bannerAd: $("bannerAd"),
  menuBtn: $("menuBtn"),
  drawerOverlay: $("drawerOverlay"),
  drawerClose: $("drawerClose"),
  panelOverlay: $("panelOverlay"),
  panelTitle: $("panelTitle"),
  panelBody: $("panelBody"),
  panelClose: $("panelClose"),
};

let cellEls = [];
function buildGridDom() {
  dom.grid.innerHTML = "";
  cellEls = [];
  for (let i = 0; i < TOTAL; i++) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.dataset.idx = i;
    dom.grid.appendChild(cell);
    cellEls.push(cell);
  }
}

// The ambiance (background color skin) cosmetic slot was removed entirely
// per Loris' request - only the emoji-set slot (Fruits/Légumes vs classic)
// remains, so every tile always uses its own TIERS from/to gradient now.
function equippedEmojiSetDef() { return EMOJI_SETS.find(e => e.id === Game.state.equippedEmojiSet) || EMOJI_SETS[0]; }
function tierStyle(tier) {
  const t = TIERS[tier - 1];
  return `background:radial-gradient(circle at 35% 30%, ${t.from}, ${t.to});`;
}
function tierEmoji(tier) { const s = equippedEmojiSetDef(); return (s.tierSkin && s.tierSkin[tier - 1]) ? s.tierSkin[tier - 1].emoji : TIERS[tier - 1].emoji; }
function tierName(tier) { const s = equippedEmojiSetDef(); return (s.tierSkin && s.tierSkin[tier - 1]) ? s.tierSkin[tier - 1].name : TIERS[tier - 1].name; }

// Small inline <img> for tier references OUTSIDE the grid itself (the
// tutorial, stat lines, the Big Bang summary...) so illustrated tiers read
// consistently everywhere they're mentioned, not just on the board itself -
// these spots were still hardcoding the plain emoji glyph even after a
// tier got custom art. Always the classic set's own icon (these are
// generic "tier N" references, not tied to whichever skin is equipped) -
// falls back to the plain emoji for any tier without art yet.
function tierInlineIconHtml(tier) {
  const t = TIERS[tier - 1];
  return t.icon
    ? `<img class="inlineTierIcon" src="assets/tiles/${t.icon}" alt="${t.name}">`
    : t.emoji;
}

// Same "custom art with an emoji fallback" pattern as tierInlineIconHtml()
// above, for the 13 GODS portraits (assets/gods/, Midjourney). `cls` picks
// the sizing rule from style.css - every god-emoji spot in the UI (Gods
// panel grid, detail modal, ritual picker, Histoire god-lore card, Cosmic
// Box reveal) has its own size, so this doesn't hardcode one. `locked`
// (default false) keeps the existing "❓, don't spoil the portrait" behavior
// for a not-yet-unlocked god instead of showing its art.
function godPortraitHtml(god, cls, locked) {
  if (locked) return "❓";
  return god.icon
    ? `<img class="${cls}" src="assets/gods/${god.icon}" alt="${god.name}">`
    : god.emoji;
}

// Same idea for the Gems/Cosmic Energy currency glyphs (Loris: the fab
// icon batch replaced 💎/⚡ on the "Pub contre Gems"/"Ascension" buttons
// themselves, but every OTHER place those currencies are shown - header
// pills, shop prices, the Gems menu title, skill costs - still used the
// plain emoji). Reuses the same artwork (gems_ad.png/ascension.png) as
// small inline glyphs rather than commissioning separate icons - at
// 14-16px next to a number they read fine as the currency symbol.
function currencyIconHtml(type) {
  if (type === "stardust") return `<img class="inlineCurrencyIcon" src="assets/ui/stardust.png" alt="Stardust">`;
  if (type === "gems") return `<img class="inlineCurrencyIcon" src="assets/ui/gems_ad.png" alt="Gems">`;
  if (type === "energy") return `<img class="inlineCurrencyIcon" src="assets/ui/ascension.png" alt="Énergie Cosmique">`;
  return "";
}

// "#3a3550" -> "58, 53, 80" - lets style.css plug a TIERS[].from/to color
// straight into rgba(var(--x), a) / rgb(var(--x)) without baking a fixed
// alpha in JS. Used by playMeteorMerge() to make the merge impact effect
// (burst rays, ring, debris, flash) match the landed tile's own colors.
function hexRgbTriplet(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

// Reward labels in config.js (DAILY_LOGIN_REWARDS) and retention.js
// (WHEEL_PRIZES) are plain strings with the emoji baked in ("100 ✨",
// "20 💎"...) - both files load BEFORE this one, so they can't call
// currencyIconHtml() themselves. Swapping the glyphs at render time here
// instead handles every such label generically, without touching each
// config entry individually.
function lockIconHtml() { return `<img class="inlineCurrencyIcon" src="assets/ui/cadenas.png" alt="">`; }
function trophyIconHtml() { return `<img class="inlineCurrencyIcon" src="assets/ui/succes.png" alt="">`; }

function withCurrencyIcons(text) {
  return text
    .replace(/✨/g, currencyIconHtml("stardust"))
    .replace(/💎/g, currencyIconHtml("gems"))
    .replace(/⚡/g, currencyIconHtml("energy"));
}

// Builds the tile's icon element: custom artwork when the active skin
// (classic, or a tierSkin-based one like Fruits/Légumes) has an `icon` for
// this tier, otherwise the plain emoji glyph. Classic reads icon/iconScale
// straight off TIERS[tier-1]; a tierSkin-based skin reads them off its own
// tierSkin[tier-1] entry instead, so Fruits/Légumes can get their own art
// independently of (and without needing) the classic set's.
// `setOverride` (optional): render as if THIS set were equipped instead of
// the real equipped one - used by the shop's skin preview modal (see
// openSkinPreviewModal) to show a set's tiles without actually equipping it.
function tierIconNode(tier, setOverride) {
  const s = setOverride || equippedEmojiSetDef();
  const skinEntry = s.tierSkin && s.tierSkin[tier - 1];
  const src = skinEntry || TIERS[tier - 1];
  // Emoji/Illustré switch (Loris) - a set with no art for this tier yet
  // (Fruits/Légumes today) just falls through to the emoji branch below
  // regardless of iconStyle, same as before this switch existed.
  if (src.icon && Game.state.iconStyle !== "emoji") {
    const img = document.createElement("img");
    img.className = "emoji tierIcon";
    img.src = "assets/tiles/" + src.icon;
    img.alt = src.name;
    // Per-tier size correction (optional): some source art reads smaller
    // than others at the same box size - either because the image itself
    // is a non-square aspect ratio (object-fit:contain then sizes to the
    // limiting dimension) or because the visible "mass" of the subject
    // (e.g. a glow with thin rays reaching the edges) is smaller than its
    // full bounding box. Overrides the CSS .tierIcon default inline, since
    // inline beats the class rule.
    if (src.iconScale) {
      const pct = (68 * src.iconScale).toFixed(1) + "%";
      img.style.width = pct; img.style.height = pct;
    }
    return img;
  }
  const span = document.createElement("div");
  span.className = "emoji";
  // `src` here is already resolved against `setOverride` (see above) - using
  // tierEmoji(tier) instead would silently ignore setOverride and re-read
  // the REAL equipped set, which is exactly the bug that made the skin
  // preview modal (openSkinPreviewModal) show the classic set's emoji for
  // every tier of a Fruits/Légumes preview instead of that set's own.
  span.textContent = src.emoji;
  return span;
}

function renderCell(i, opts) {
  opts = opts || {};
  const state = Game.state;
  const cell = cellEls[i];
  const locked = !state.unlocked[i];
  const tileData = state.grid[i];
  cell.className = "cell";
  cell.innerHTML = "";

  if (locked) {
    cell.classList.add("locked");
    if (Game.skipCellArmed) cell.classList.add("skipArmed");
    const label = document.createElement("div");
    label.className = "lockLabel";
    if (Game.skipCellArmed) {
      label.innerHTML = `<span class="emoji">${currencyIconHtml("gems")}</span><span>Sauter</span>`;
    } else {
      const n = state.extraUnlockedCount;
      label.innerHTML = `<span class="emoji"><img src="assets/ui/cadenas.png" alt=""></span><span>${formatNumber(unlockCost(n))}${currencyIconHtml("stardust")}</span>`;
    }
    cell.appendChild(label);
    return;
  }

  if (!tileData) {
    cell.classList.add("empty");
    // One-shot "just unlocked" pop (Loris) - passed explicitly by the
    // unlock call sites (tryUnlock/onUnlockCellAd in input.js) right after
    // a locked cell becomes available, not on every re-render of an
    // already-empty cell.
    if (opts.justUnlocked) cell.classList.add("unlockPop");
    if (Game.selectedIdx === i) cell.classList.add("selectableEmpty");
    return;
  }

  cell.classList.add("filled");
  if (Game.selectedIdx === i) cell.classList.add("selected");
  // Continuous idle animation on the max tier (Loris) - a slow glow pulse
  // on the cell + a gentle breathing scale on the icon (see .cell.tierMax
  // in style.css). On the .cell rather than .tile so it never fights with
  // .tile.merging/.tile.spawnIn's own transform animations on a fresh max
  // tier (different element = no property conflict either way).
  if (tileData.tier === TIERS.length) cell.classList.add("tierMax");

  const tile = document.createElement("div");
  tile.className = "tile";
  if (opts.merged) tile.classList.add("merging");
  if (opts.spawned) tile.classList.add("spawnIn");
  tile.style.cssText += tierStyle(tileData.tier);
  const emoji = tierIconNode(tileData.tier);
  const num = document.createElement("div");
  num.className = "tierNum";
  num.textContent = tileData.tier;
  tile.appendChild(emoji); tile.appendChild(num);
  cell.appendChild(tile);
}

// Renders a static (but gently, continuously animated) 10-tile preview grid
// for `setId`, without touching state.equippedEmojiSet - see the "Aperçu"
// button in renderCosmeticGrid(). Reuses the real .cell/.tile markup and
// tierStyle() background so it looks exactly like the actual game grid.
// Emoji/Illustré switch - shared between the skin manager popup and this
// preview modal (Loris: it's a display preference, belongs in skin
// management, not the shop - and the preview specifically should let you
// see/pick between the two modes right there). `onChange` re-renders
// whichever container the toggle lives in, so the effect is visible
// immediately without closing anything.
// `set` (optional): which set's tier-1 to demonstrate the two styles with -
// defaults to whatever's actually equipped. Bug (Loris: "il y a encore la
// météorite emoji et la météorite illustrée... dans le mode gestion de
// skin et dans l'aperçu et dans la boutique"): this always showed the
// classic Météorite regardless of context, so previewing Fruits/Légumes
// (via "Aperçu", reachable from both the Boutique and the skin manager -
// same modal, same bug) still demonstrated the toggle with an unrelated
// meteorite instead of that set's own tier 1. openSkinPreviewModal now
// passes the set actually being previewed; openSkinManagerModal (no one
// specific set on screen there) still falls back to whatever's equipped.
function renderIconStyleToggle(onChange, set) {
  const state = Game.state;
  const wrap = el("div", "iconStyleToggle");
  const s = set || equippedEmojiSetDef();
  const skin = (s.tierSkin && s.tierSkin[0]) || TIERS[0];
  // Falls back to the classic meteorite's own art if this set has none yet
  // for tier 1 (e.g. Légumes before its icons exist) - still a real
  // "Illustré" example, just not from this specific set, better than a
  // broken image.
  const artSrc = skin.icon || TIERS[0].icon;
  const emojiBtn = el("button", "btn" + (state.iconStyle === "emoji" ? " primary" : " ghost"),
    `<span class="emoji">${skin.emoji}</span> Emoji`);
  const artBtn = el("button", "btn" + (state.iconStyle !== "emoji" ? " primary" : " ghost"),
    `<img class="inlineCurrencyIcon" src="assets/tiles/${artSrc}" alt=""> Illustré`);
  emojiBtn.addEventListener("click", () => { onSetIconStyle("emoji"); onChange(); });
  artBtn.addEventListener("click", () => { onSetIconStyle("illustrated"); onChange(); });
  wrap.appendChild(emojiBtn);
  wrap.appendChild(artBtn);
  return wrap;
}

function openSkinPreviewModal(setId) {
  const set = EMOJI_SETS.find(s => s.id === setId);
  if (!set) return;
  $("skinPreviewTitle").textContent = set.name;
  const toggleHost = $("skinPreviewToggle");
  toggleHost.innerHTML = "";
  toggleHost.appendChild(renderIconStyleToggle(() => openSkinPreviewModal(setId), set));
  const grid = $("skinPreviewGrid");
  grid.innerHTML = "";
  for (let t = 1; t <= TIERS.length; t++) {
    const cell = el("div", "cell filled previewCell");
    cell.style.setProperty("--stagger", ((t - 1) * 0.18).toFixed(2) + "s");
    const tile = el("div", "tile");
    tile.style.cssText += tierStyle(t);
    tile.appendChild(tierIconNode(t, set));
    tile.appendChild(el("div", "tierNum", String(t)));
    cell.appendChild(tile);
    grid.appendChild(cell);
  }
  $("skinPreviewModal").classList.remove("hidden");
}
function closeSkinPreviewModal() { $("skinPreviewModal").classList.add("hidden"); }

function refreshLockedCellPrices() {
  for (let i = 0; i < TOTAL; i++) {
    if (!Game.state.unlocked[i]) renderCell(i);
  }
}

function renderAll() {
  for (let i = 0; i < TOTAL; i++) renderCell(i);
  updateHeader();
  updateFabs();
}

let lastHeaderRender = {};
function updateHeader() {
  const state = Game.state;
  const stardustStr = formatNumber(Game.displayedStardust);
  if (stardustStr !== lastHeaderRender.stardust) { dom.stardustValue.textContent = stardustStr; lastHeaderRender.stardust = stardustStr; }

  const rateStr = "+" + formatNumber(totalProduction(state)) + "/s";
  if (rateStr !== lastHeaderRender.rate) { dom.stardustRate.textContent = rateStr; lastHeaderRender.rate = rateStr; }

  const gemsStr = formatNumber(state.gems);
  if (gemsStr !== lastHeaderRender.gems) { dom.gemsValue.textContent = gemsStr; lastHeaderRender.gems = gemsStr; }

  const energyStr = formatNumber(state.cosmicEnergy);
  if (energyStr !== lastHeaderRender.energy) { dom.energyValue.textContent = energyStr; lastHeaderRender.energy = energyStr; }

  const cost = invokeCost(state.manualSpawnCount);
  const costStr = formatNumber(cost);
  if (costStr !== lastHeaderRender.cost) { dom.invokeCost.textContent = costStr; lastHeaderRender.cost = costStr; }
  if (!lastHeaderRender.gemsCostSet) { $("invokeCostGems").textContent = GEMS_INVOKE_COST; lastHeaderRender.gemsCostSet = true; }
  if (!lastHeaderRender.swapCostSet) { $("swapCellsCost").textContent = SHOP_GEM_ITEMS.find(i => i.id === "swapCells").cost; lastHeaderRender.swapCostSet = true; }
  const disabled = state.stardust < cost;
  if (disabled !== lastHeaderRender.disabled) { dom.invokeBtnStardust.classList.toggle("disabled", disabled); lastHeaderRender.disabled = disabled; }
  const gemsDisabled = state.gems < GEMS_INVOKE_COST;
  if (gemsDisabled !== lastHeaderRender.gemsDisabled) { dom.invokeBtnGems.classList.toggle("disabled", gemsDisabled); lastHeaderRender.gemsDisabled = gemsDisabled; }
  const swapCost = SHOP_GEM_ITEMS.find(i => i.id === "swapCells").cost;
  const swapDisabled = state.gems < swapCost || Game.swapArmed;
  if (swapDisabled !== lastHeaderRender.swapDisabled) { dom.fabSwapCells.classList.toggle("disabled", swapDisabled); lastHeaderRender.swapDisabled = swapDisabled; }

  const canBB = hasUniverseTile(state);
  if (canBB !== lastHeaderRender.canBB) { dom.bigBangBtn.classList.toggle("hidden", !canBB); lastHeaderRender.canBB = canBB; }

  let hint = "";
  if (Game.skipCellArmed) hint = "Choisis une case verrouillée à débloquer avec des Gems";
  else if (Game.swapArmed) hint = Game.swapFirstIdx === null ? "Échange : choisis la première case" : "Échange : choisis la seconde case";
  else if (Game.selectedIdx !== null) {
    hint = "Case choisie pour la prochaine invocation";
  }
  if (hint !== lastHeaderRender.hint) { dom.selectionHint.textContent = hint; lastHeaderRender.hint = hint; }
}

function updateFabs() {
  const state = Game.state;
  // Used to hide once claimed, which meant there was no way at all to check
  // your streak/freeze status between claims - it stays visible and just
  // switches to a "streak" readout (still opens the same modal, read-only).
  const claimedToday = !isDailyLoginAvailable(state);
  dom.fabDailyLogin.classList.remove("hidden"); // always visible now (see comment above) - the initial HTML still starts with "hidden" for the pre-JS flash, nothing else ever cleared it
  // Bug (Loris: "tu n'as pas ajouté le visuel cadeau" - it WAS added, but
  // this line was clobbering it): .textContent on the .fabIcon wrapper
  // wipes out ANY child, including the <img class="uiIcon"> custom artwork
  // added there, replacing it with a plain emoji glyph on every single
  // updateFabs() call (i.e. constantly). No custom art exists yet for the
  // "claimed today" streak/fire state, so that one still falls back to a
  // plain emoji - but the default gift state now stays as the real image.
  const dailyIcon = dom.fabDailyLogin.querySelector(".fabIcon");
  dailyIcon.innerHTML = claimedToday ? '<img class="uiIcon" src="assets/ui/flamme.png" alt="">' : '<img class="uiIcon" src="assets/ui/cadeau.png" alt="">';
  dom.fabDailyLogin.querySelector(".fabLabel").textContent = claimedToday ? `Série ${state.dailyLogin.streak}` : "Cadeau";
  ensureDailySpin(state);
  dom.fabWheel.classList.toggle("hidden", state.dailySpin.freeUsed && state.dailySpin.bonusUsed);
  const allUnlocked = unlockedCount(state) >= TOTAL;
  $("fabUnlockCellAd").classList.toggle("hidden", allUnlocked);
  $("fabUnlockCellAd").classList.toggle("ready", !allUnlocked && Date.now() >= state.cooldowns.unlockCellAdUntil);
  const now = Date.now();
  const boostActive = state.cooldowns.prodBoostActiveUntil > now;
  const boostReady = now >= state.cooldowns.prodBoostUntil && !boostActive;
  $("fabBoost").classList.toggle("ready", boostReady);
  $("fabBoost").classList.toggle("active", boostActive);
  const boostLabel = boostActive ? formatDuration(state.cooldowns.prodBoostActiveUntil - now)
    : (boostReady ? "Boost x2" : formatDuration(state.cooldowns.prodBoostUntil - now));
  if ($("fabBoostLabel").textContent !== boostLabel) $("fabBoostLabel").textContent = boostLabel;

  const gemsAdReady = now >= state.cooldowns.gemsAdUntil;
  $("fabGemsAd").classList.toggle("ready", gemsAdReady);
  const gemsAdLabel = gemsAdReady ? `+${GEMS_AD_REWARD} Gems` : formatDuration(state.cooldowns.gemsAdUntil - now);
  if ($("fabGemsAdLabel").textContent !== gemsAdLabel) $("fabGemsAdLabel").textContent = gemsAdLabel;
  dom.bannerAd.classList.toggle("hidden", adsRemoved(state));
  updateQuestNotifDot();

  const god = state.gods.currentGodId ? getGod(state.gods.currentGodId) : null;
  $("fabCurrentGod").classList.toggle("hidden", !god);
  if (god) {
    // Bug fix, then revisited once portraits shipped (Loris: "l'icone qui
    // ressort... c'est l'emoji iOS, alors que ca devrait etre
    // l'illustration"). Was `.textContent = god.emoji`, which wiped out
    // the <img> baked into index.html on every single updateFabs() call.
    // Fixed first by leaving the shared "Dieux du Cosmos" trident showing
    // for every god (no per-god art existed yet then); now that GODS
    // entries have their own `icon` (assets/gods/, see godPortraitHtml()),
    // this shows the actually-equipped god's real portrait instead -
    // only touches the DOM when the equipped god changed, since
    // updateFabs() runs on every merge/tick.
    if (lastHeaderRender.fabGodId !== god.id) {
      $("fabGodEmoji").innerHTML = godPortraitHtml(god, "uiIcon");
      lastHeaderRender.fabGodId = god.id;
    }
    $("fabGodName").textContent = god.name;
  }
}

function hasClaimableQuest(state) {
  ensureDailyQuests(state);
  return state.quests.active.some(q => q.done && !q.claimed) || (state.quests.bonusAd.done && !state.quests.bonusAd.claimed);
}
let lastNotifDotState = null;
function updateQuestNotifDot() {
  const has = hasClaimableQuest(Game.state);
  if (has !== lastNotifDotState) {
    $("questsNotifDot").classList.toggle("hidden", !has);
    lastNotifDotState = has;
  }
}

// Duration (ms) the charge-up glow (see .chargeGlow in style.css) plays
// before the impact fires - MUST stay in sync with the `chargeGlow` CSS
// animation AND the setTimeout in Sfx.meteorImpact() (audio.js) that fires
// the impact sound, so the visual landing and the sound line up.
// Deliberately short: this fires on every single merge (often several per
// second), so the payoff has to feel instant, not like a cutscene the
// player has to sit through.
const METEOR_FALL_MS = 110;

// Renders a stand-in tile of a specific tier at `idx` WITHOUT touching
// state.grid - used to keep showing the pre-merge tile while the charge-up
// glow plays (state.grid[idx] already holds the merged/upgraded tile by
// this point, see performMerge()). The real tile is revealed on impact via
// the normal renderCell(idx, {merged:true}).
function renderMergeStandIn(idx, tier) {
  const cell = cellEls[idx];
  cell.className = "cell filled";
  cell.innerHTML = "";
  const tile = document.createElement("div");
  tile.className = "tile";
  tile.style.cssText += tierStyle(tier);
  const emoji = tierIconNode(tier);
  const num = document.createElement("div");
  num.className = "tierNum";
  num.textContent = tier;
  tile.appendChild(emoji); tile.appendChild(num);
  cell.appendChild(tile);
}

// Removes then re-adds a CSS class to force the browser to restart a
// class-driven animation even if the class was never removed in between two
// calls (classList.add on an already-present class is a no-op otherwise) -
// needed for the grid shake, which lives on one shared element that can be
// re-triggered by merges landing back to back during a streak, unlike every
// other effect here which spawns a fresh element. The forced reflow
// (offsetWidth read) is itself not free, so it's skipped for the common
// case - most merges aren't landing on top of an already-shaking grid.
function restartAnim(el, cls) {
  if (el.classList.contains(cls)) {
    el.classList.remove(cls);
    void el.offsetWidth; // force reflow, only when actually needed to restart
  }
  el.classList.add(cls);
}

// Merge impact effect - the whole point is to make landing a merge feel
// like a real event, not a UI state change:
//  - the tile itself bursts up well past the cell's bounds (elevated
//    z-index so it isn't clipped by neighboring cells) before settling
//    back into place (see .impactHero / mergePop in style.css)
//  - the ENTIRE grid shakes, not just the one cell
//  - a flash sweeps out from the impact point across the whole screen
//  - a starburst + shockwave ring(s) + a spray of rock/star debris play
//    out locally around the cell
// `onImpact` fires at the exact landing moment so the caller can reveal
// the upgraded tile right as it lands. `newTier` is now the PRIMARY driver
// of visual intensity (a tier-10 merge should feel like a real event, a
// routine tier-1 merge shouldn't) - `streak` only nudges it a little.
// Was the other way around (streak dominant) - Noah's feedback: "l'effet
// quand tu merges est trop fort, il faut qu'il devienne de plus en plus
// fort en fonction du niveau de merge que tu fais", i.e. progression
// should track tier, not how fast the player happens to be tapping. The
// streak-based reward chime pitch (Sfx.meteorImpact, audio.js) is
// untouched - Loris explicitly liked that part.
function playMeteorMerge(idx, onImpact, streak, newTier) {
  streak = streak || 0;
  // Lowered again - Loris: "l'animation des premieres cases est encore
  // trop intense ce qui fait qu'on voit pas bien la progression". Tier 1
  // now starts around .6 (was 1.0), so it visibly ramps up over the tiers
  // instead of already being most of the way to the tier-10 cap. The
  // screen flash's reach (style.css .screenFlash) also had a fixed floor
  // regardless of power - now fully proportional too, so a low-power merge
  // genuinely stays small instead of still blooming out a fixed amount.
  const power = Math.min(0.4 + Math.min(newTier || 1, 10) * 0.19 + Math.min(streak, 5) * 0.02, 2.3);
  const cell = cellEls[idx];

  // Impact colors now match the landed tile's own gradient (TIERS[].from/to)
  // instead of a fixed gold/amber palette - Loris: "les couleurs devraient
  // pas être les couleurs de la case ?". --mergeBright/--mergeDark carry the
  // "r, g, b" triplets consumed by style.css (rgba(var(--mergeBright), a)),
  // set on `cell` (parent of every impact element except screenFlash, which
  // lives on <body> and gets its own copy below) so a merge landing on a
  // DIFFERENT cell moments later - or an older effect from this same cell
  // still fading out - never has its colors swapped mid-animation.
  const tier = TIERS[Math.min(Math.max((newTier || 1) - 1, 0), TIERS.length - 1)];
  const mergeBright = hexRgbTriplet(tier.from);
  const mergeDark = hexRgbTriplet(tier.to);
  cell.style.setProperty("--mergeBright", mergeBright);
  cell.style.setProperty("--mergeDark", mergeDark);

  const glow = document.createElement("div");
  glow.className = "chargeGlow";
  cell.appendChild(glow);
  setTimeout(() => {
    // Measured BEFORE onImpact() touches the DOM below - reading layout
    // (getBoundingClientRect) right after a mutation forces a synchronous
    // reflow, which is one of the cheap wins for smoother merges (the cell
    // doesn't move as a result of onImpact(), so there's no need to
    // re-measure after it anyway).
    const rect = cell.getBoundingClientRect();

    glow.remove();
    onImpact();

    cell.classList.add("impactHero");
    setTimeout(() => cell.classList.remove("impactHero"), 520);

    restartAnim(dom.grid, "gridShake");
    dom.grid.style.setProperty("--shakePower", power.toFixed(2));
    setTimeout(() => dom.grid.classList.remove("gridShake"), 380);

    const flash = document.createElement("div");
    flash.className = "screenFlash";
    flash.style.setProperty("--fx", (rect.left + rect.width / 2) + "px");
    flash.style.setProperty("--fy", (rect.top + rect.height / 2) + "px");
    flash.style.setProperty("--fpower", power.toFixed(2));
    flash.style.setProperty("--mergeBright", mergeBright);
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 420);

    spawnBurstRays(cell, power);

    const localFlash = document.createElement("div");
    localFlash.className = "impactFlash";
    cell.appendChild(localFlash);
    setTimeout(() => localFlash.remove(), 260);

    // A 2nd, slightly delayed ring reads as a nicer double-pulse shockwave,
    // but it's extra DOM churn on every merge for a subtle detail - only
    // worth it once a streak is actually building.
    const ringDelays = streak > 0 ? [0, 90] : [0];
    ringDelays.forEach((delay) => {
      setTimeout(() => {
        const ring = document.createElement("div");
        ring.className = "impactRing";
        ring.style.setProperty("--ringPower", power.toFixed(2));
        cell.appendChild(ring);
        setTimeout(() => ring.remove(), 420);
      }, delay);
    });

    spawnImpactDebris(idx, streak, power);
  }, METEOR_FALL_MS);
}

// 6-point sparkle burst: individual thin gradient-faded rays (long/short
// alternating) rotated around the cell center, rather than a single
// repeating-conic-gradient pinwheel - see the comment on .burstRay in
// style.css for why (that approach read as flat "light rectangles"). 6
// rather than 8 - one less element created/removed on every merge, for a
// difference that's barely noticeable at this size.
function spawnBurstRays(cell, power) {
  const RAY_COUNT = 6;
  for (let i = 0; i < RAY_COUNT; i++) {
    const ray = document.createElement("div");
    ray.className = "burstRay" + (i % 2 === 1 ? " short" : "");
    ray.style.setProperty("--ang", (i * (360 / RAY_COUNT)) + "deg");
    ray.style.setProperty("--burstPower", power.toFixed(2));
    cell.appendChild(ray);
    setTimeout(() => ray.remove(), 320);
  }
}

function spawnImpactDebris(idx, streak, power) {
  const cell = cellEls[idx];
  // Kept modest on purpose - this is the single biggest DOM-churn source of
  // the whole effect (a new element per chip, every merge), so it's the
  // main lever for keeping streaks (several merges a second) smooth.
  const count = 8 + Math.min(streak || 0, 4);
  for (let k = 0; k < count; k++) {
    const p = document.createElement("div");
    p.className = "debrisChip" + (k % 3 !== 1 ? " spark" : "");
    const angle = Math.random() * Math.PI * 2;
    const dist = (30 + Math.random() * 34) * power;
    p.style.setProperty("--dx", (Math.cos(angle) * dist) + "px");
    p.style.setProperty("--dy", (Math.sin(angle) * dist) + "px");
    p.style.setProperty("--rot", (Math.random() * 360 - 180) + "deg");
    p.style.setProperty("--chipScale", (0.7 + Math.random() * 0.8).toFixed(2));
    cell.appendChild(p);
    setTimeout(() => p.remove(), 560);
  }
}

function spawnFloatingBonus(idx, amount) {
  const cell = cellEls[idx];
  const el = document.createElement("div");
  el.className = "floatBonus";
  el.innerHTML = "+" + formatNumber(amount) + " " + currencyIconHtml("stardust");
  cell.appendChild(el);
  setTimeout(() => el.remove(), 750);
}

function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast"; el.textContent = msg;
  dom.toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

// ---------------- Drawer & generic panel ----------------
function renderDrawerHead() {
  const state = Game.state;
  $("drawerLevel").textContent = `Niveau Cosmique ${state.lifetime.bigBangCount}`;
  $("drawerHeadLogo").textContent = state.profile.emoji;
  $("drawerHeadLogo").style.background = `radial-gradient(circle at 35% 30%, #fff, ${state.profile.color})`;
  $("drawerHeadTitle").textContent = state.profile.name;
}
function openDrawer() {
  dom.drawerOverlay.classList.remove("hidden");
  renderDrawerHead();
  requestAnimationFrame(() => dom.drawerOverlay.classList.add("open"));
}

// ---------------- Profile editor modal ----------------
let profileDraft = null;
function openProfileModal() {
  profileDraft = { ...Game.state.profile };
  $("profileNameInput").value = profileDraft.name;

  const emojiPicker = $("profileEmojiPicker");
  emojiPicker.innerHTML = "";
  PROFILE_EMOJI_CHOICES.forEach(emoji => {
    const btn = el("button", "profileEmojiBtn" + (emoji === profileDraft.emoji ? " selected" : ""), emoji);
    btn.addEventListener("click", () => { profileDraft.emoji = emoji; openProfileModal.refresh(); });
    emojiPicker.appendChild(btn);
  });

  const colorPicker = $("profileColorPicker");
  colorPicker.innerHTML = "";
  PROFILE_COLOR_CHOICES.forEach(color => {
    const btn = el("button", "profileColorBtn" + (color === profileDraft.color ? " selected" : ""));
    btn.style.background = color;
    btn.addEventListener("click", () => { profileDraft.color = color; openProfileModal.refresh(); });
    colorPicker.appendChild(btn);
  });

  $("profileModal").classList.remove("hidden");
}
openProfileModal.refresh = function () {
  $$("#profileEmojiPicker .profileEmojiBtn").forEach((b, i) => b.classList.toggle("selected", PROFILE_EMOJI_CHOICES[i] === profileDraft.emoji));
  $$("#profileColorPicker .profileColorBtn").forEach((b, i) => b.classList.toggle("selected", PROFILE_COLOR_CHOICES[i] === profileDraft.color));
};
function closeProfileModal() { $("profileModal").classList.add("hidden"); }
function closeDrawer() {
  dom.drawerOverlay.classList.remove("open");
  setTimeout(() => dom.drawerOverlay.classList.add("hidden"), 300);
}

const PANEL_RENDERERS = {
  shop: { title: "Boutique", render: renderShopPanel },
  gods: { title: "Dieux du Cosmos", render: renderGodsPanel },
  skills: { title: `Ascension ${currencyIconHtml("energy")}`, render: renderSkillsPanel },
  quests: { title: "Quêtes quotidiennes", render: renderQuestsPanel },
  achievements: { title: "Succès", render: renderAchievementsPanel },
  progression: { title: "Progression", render: renderProgressionPanel },
  story: { title: "Histoire", render: renderStoryPanel },
  settings: { title: "Réglages", render: renderSettingsPanel },
};
let currentPanel = null;
function openPanel(name) {
  closeDrawer();
  const def = PANEL_RENDERERS[name];
  if (!def) return;
  currentPanel = name;
  dom.panelTitle.innerHTML = def.title; // was textContent - "skills" title needs the inline energy icon (currencyIconHtml); every other title is a plain string so this is a no-op for them
  def.render();
  dom.panelOverlay.classList.remove("hidden");
  // Gods screen gets its own background ambiance (gradient/particles) - see
  // .panelOverlay.godsTheme in style.css - toggled here rather than baked
  // into .panel itself so every other panel keeps the plain background.
  dom.panelOverlay.classList.toggle("godsTheme", name === "gods");
}
function refreshCurrentPanel() { if (currentPanel) PANEL_RENDERERS[currentPanel].render(); }
function closePanel() { dom.panelOverlay.classList.add("hidden"); currentPanel = null; }

function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }

// Shared by the shop's Ambiances/Sets d'icônes sections and the skin
// manager popup - a compact 2-per-row grid where the swatch carries the
// visual weight and the button stays a small pill instead of a full-width
// bar dwarfing a tiny preview.
function renderCosmeticGrid(list, equippedId, onAfterAction) {
  const state = Game.state;
  const grid = el("div", "cosmeticGrid");
  list.forEach(item => {
    const owned = isSkinOwned(state, item.id);
    const equipped = equippedId === item.id;
    const tile = el("div", "cosmeticTile" + (equipped ? " equipped" : ""));
    const swatch = el("div", "skinSwatch big");
    swatch.textContent = item.tierSkin ? item.tierSkin[5].emoji : "🚫"; // representative mid-tier icon, or "no override" for "Cases classiques"
    const name = el("div", "cosmeticName", item.name);
    // Always render a status tag, even when not owned - Loris: the cards
    // in this grid don't all have the same height (Légumes' card was
    // shorter than Fruits'), because a not-owned card skipped the tag
    // element entirely instead of just showing a different one.
    const status = equipped ? el("span", "tag equipped", "Équipé")
      : (owned ? el("span", "tag owned", "Possédé") : el("span", "tag", "Non possédé"));
    const btn = el("button", "btn" + (equipped ? "" : " primary"), equipped ? "Équipé" : (owned ? "Équiper" : `${item.cost} ${currencyIconHtml("gems")}`));
    btn.disabled = equipped || (!owned && state.gems < item.cost);
    btn.addEventListener("click", () => { onCosmeticAction(item.id, owned); if (onAfterAction) onAfterAction(); });
    // "Aperçu" (Loris): a way to see a set's tiles on an actual mini grid
    // before spending Gems on it or switching away from the one equipped.
    const previewBtn = el("button", "btn ghost cosmeticPreviewBtn", "👁 Aperçu");
    previewBtn.addEventListener("click", (e) => { e.stopPropagation(); openSkinPreviewModal(item.id); });
    tile.appendChild(swatch);
    tile.appendChild(name);
    tile.appendChild(status);
    tile.appendChild(btn);
    tile.appendChild(previewBtn);
    grid.appendChild(tile);
  });
  return grid;
}

// ---------------- Shop panel ----------------
function renderShopPanel() {
  const state = Game.state;
  dom.panelBody.innerHTML = "";

  // Wording pass (Loris): "Boosts publicitaires" / "Cases & boosts (Gems)" /
  // "Boutique premium (achats intégrés)" read as internal/technical labels
  // rather than something a player would want to tap into.
  dom.panelBody.appendChild(el("h3", null, "Bonus vidéo"));
  // Side by side (2 cols) instead of stacked - Loris found the two ad cards
  // taking a full row each felt like wasted space now that shopGrid2 (see
  // "Cases & boosts" below) already proved the compact 2-column layout works.
  const adGrid = el("div", "shopGrid2");
  const boostReady = Date.now() >= state.cooldowns.prodBoostUntil;
  const boostActive = state.cooldowns.prodBoostActiveUntil > Date.now();
  const boostCard = el("div", "card compact");
  boostCard.innerHTML = `<div class="rowBetween"><h3>🚀 Boost x2 production (10 min)</h3></div>
    <p class="desc">${boostActive ? `Actif encore ${formatDuration(state.cooldowns.prodBoostActiveUntil - Date.now())}` :
      (boostReady ? "Disponible maintenant." : `Disponible dans ${formatDuration(state.cooldowns.prodBoostUntil - Date.now())}`)}</p>`;
  const boostBtn = el("button", "btn primary full", adsRemoved(state) ? "Activer" : "Regarder une pub");
  boostBtn.disabled = !boostReady || boostActive;
  boostBtn.addEventListener("click", onWatchProdBoostAd);
  boostCard.appendChild(boostBtn);
  adGrid.appendChild(boostCard);

  const gemsAdReady = Date.now() >= state.cooldowns.gemsAdUntil;
  const gemsAdCard = el("div", "card compact");
  gemsAdCard.innerHTML = `<div class="rowBetween"><h3>${currencyIconHtml("gems")} Pub contre Gems (+${GEMS_AD_REWARD})</h3></div>
    <p class="desc">${gemsAdReady ? "Disponible maintenant." : `Disponible dans ${formatDuration(state.cooldowns.gemsAdUntil - Date.now())}`}</p>`;
  const gemsAdBtn = el("button", "btn primary full", adsRemoved(state) ? "Recevoir" : "Regarder une pub");
  gemsAdBtn.disabled = !gemsAdReady;
  gemsAdBtn.addEventListener("click", onWatchGemsAd);
  gemsAdCard.appendChild(gemsAdBtn);
  adGrid.appendChild(gemsAdCard);
  dom.panelBody.appendChild(adGrid);

  dom.panelBody.appendChild(el("h3", null, "Boutique Gems"));
  const gemGrid = el("div", "shopGrid2");
  SHOP_GEM_ITEMS.forEach(item => {
    const card = el("div", "card compact");
    card.innerHTML = `<div class="rowBetween"><h3>${item.name}</h3><span class="tag">${item.cost} ${currencyIconHtml("gems")}</span></div>
      <p class="desc">${item.desc}</p>`;
    const btn = el("button", "btn primary full", "Acheter");
    btn.disabled = state.gems < item.cost;
    btn.addEventListener("click", () => onBuyGemItem(item.id));
    card.appendChild(btn);
    gemGrid.appendChild(card);
  });
  dom.panelBody.appendChild(gemGrid);

  dom.panelBody.appendChild(el("h3", null, `<img class="inlineCurrencyIcon" src="assets/ui/palette.png" alt=""> Sets d'icônes`));
  // Emoji/Illustré switch moved to the skin MANAGER popup (openSkinManagerModal)
  // per Loris - it's a display preference, not a shop purchase, it doesn't
  // belong in the boutique. See renderIconStyleToggle() below.
  dom.panelBody.appendChild(renderCosmeticGrid(EMOJI_SETS, state.equippedEmojiSet));

  dom.panelBody.appendChild(el("h3", null, "Offres Premium"));
  // Order (Loris, curated - NOT price-sorted any more): Pass (hero) ->
  // Suppression des pubs -> Multiplicateur Stardust -> everything else in
  // catalog order. A price sort had been pulling the Gems packs into the
  // #2/#3 featured slots instead, which wasn't the intent.
  const daysSinceFirst = daysBetween(state.firstPlayedDay, todayStr());
  const visibleProducts = IAP_CATALOG.filter(product => {
    if (product.startersOnly && daysSinceFirst > 2) return false;
    if (product.id === "remove_ads" && state.iap.removeAds) return false;
    if (product.id === "stardust_boost" && state.iap.stardustBoost) return false;
    if (product.skinId && state.iap.ownedSkinPacks.includes(product.skinId)) return false;
    return true;
  });
  const byId = (id) => visibleProducts.find(p => p.id === id);
  const pass = byId("vip_monthly");
  const featuredIds = ["remove_ads", "stardust_boost"];
  const featured = featuredIds.map(byId).filter(Boolean);
  const featuredSet = new Set(featured.map(p => p.id));
  const plain = visibleProducts.filter(p => p.id !== "vip_monthly" && !featuredSet.has(p.id));

  const buyBtn = (product, cls) => {
    const btn = el("button", cls, product.type === "subscription" ? "S'abonner" : "Acheter");
    btn.addEventListener("click", () => onBuyIAP(product.id));
    return btn;
  };

  // Every card in this section shares the Pass's premium chrome now (gold
  // glow border + continuous pulse, .iapCard) - Loris liked the Pass card's
  // look enough to want it applied everywhere, not just the top 3. Only the
  // Pass keeps the perks-list layout (it's the only product with a `perks`
  // array) and the "★ Meilleure offre" ribbon (badging every card with
  // that would defeat the point).
  if (pass) {
    const hero = el("div", "card iapCard iapHero");
    hero.innerHTML = `<div class="iapHeroBadge">★ Meilleure offre</div>
      <div class="rowBetween"><h3><img class="inlineCurrencyIcon" src="assets/ui/supernova.png" alt=""> ${pass.name}</h3><span class="iapPrice">${pass.price}</span></div>
      <p class="iapHeroTagline">${pass.desc}</p>`;
    const perkList = el("ul", "iapPerkList");
    (pass.perks || []).forEach(p => perkList.appendChild(el("li", null, p)));
    hero.appendChild(perkList);
    hero.appendChild(buyBtn(pass, "btn primary full"));
    dom.panelBody.appendChild(hero);
  }

  [...featured, ...plain].forEach(product => {
    const card = el("div", "card iapCard");
    card.innerHTML = `<div class="rowBetween"><h3>${product.name}</h3><span class="iapPrice">${product.price}</span></div>
      ${product.desc ? `<p class="desc">${product.desc}</p>` : ""}`;
    card.appendChild(buyBtn(product, "btn primary full"));
    dom.panelBody.appendChild(card);
  });

  const restoreBtn = el("button", "btn ghost full", "Restaurer mes achats");
  restoreBtn.addEventListener("click", onRestorePurchases);
  dom.panelBody.appendChild(restoreBtn);
}

// ---------------- Skills panel ----------------
function renderSkillsPanel() {
  const state = Game.state;
  dom.panelBody.innerHTML = "";
  dom.panelBody.appendChild(el("p", "desc", `Dépense ton Énergie Cosmique (${currencyIconHtml("energy")} ${formatNumber(state.cosmicEnergy)}) gagnée à chaque Big Bang dans des bonus permanents.`));
  Object.keys(SKILL_TREE).forEach(key => {
    const branch = SKILL_TREE[key];
    const level = state.skills[key];
    const maxed = level >= branch.maxLevel;
    const cost = maxed ? null : skillCost(key, level + 1);
    const card = el("div", "card skillRow");
    card.innerHTML = `<div class="rowBetween"><h3>${branch.name}</h3><span class="skillLevel">Niv. ${level}/${branch.maxLevel}</span></div>
      <p class="desc">${branch.desc}</p>
      <div class="progressBar"><div class="fill" style="width:${(level / branch.maxLevel * 100).toFixed(1)}%"></div></div>`;
    const btn = el("button", "btn primary full", maxed ? "Niveau maximum" : `Améliorer — ${cost} ${currencyIconHtml("energy")}`);
    btn.disabled = maxed || state.cosmicEnergy < cost;
    if (!maxed) btn.addEventListener("click", () => onBuySkill(key));
    card.appendChild(btn);
    dom.panelBody.appendChild(card);
  });
}

// ---------------- Quests panel ----------------
function renderQuestsPanel() {
  const state = Game.state;
  ensureDailyQuests(state);
  dom.panelBody.innerHTML = "";
  state.quests.active.forEach(q => {
    const template = QUEST_POOL.find(t => t.id === q.id);
    const card = el("div", "card");
    card.innerHTML = `<div class="rowBetween"><h3>${template.desc}</h3><span class="tag">${template.reward} ${currencyIconHtml("gems")}</span></div>
      <div class="progressBar"><div class="fill" style="width:${Math.min(100, q.progress / template.target * 100).toFixed(1)}%"></div></div>
      <p class="desc">${Math.min(q.progress, template.target)} / ${template.target}</p>`;
    const btn = el("button", "btn primary full", q.claimed ? "Réclamée" : (q.done ? "Réclamer" : "En cours"));
    btn.disabled = q.claimed || !q.done;
    btn.addEventListener("click", () => onClaimQuest(q.id));
    card.appendChild(btn);
    dom.panelBody.appendChild(card);
  });

  const bonusCard = el("div", "card");
  bonusCard.innerHTML = `<div class="rowBetween"><h3>${BONUS_AD_QUEST.desc} (bonus)</h3><span class="tag">${BONUS_AD_QUEST.reward} ${currencyIconHtml("gems")}</span></div>
    <p class="desc">Quête bonus optionnelle, disponible chaque jour.</p>`;
  const bonusBtn = el("button", "btn primary full",
    state.quests.bonusAd.claimed ? "Réclamée" : (state.quests.bonusAd.done || adsRemoved(state) ? "Réclamer" : "Regarder une pub"));
  bonusBtn.disabled = state.quests.bonusAd.claimed;
  bonusBtn.addEventListener("click", onBonusAdQuest);
  bonusCard.appendChild(bonusBtn);
  dom.panelBody.appendChild(bonusCard);
}

// ---------------- Achievements panel ----------------
function renderAchievementsPanel() {
  const state = Game.state;
  dom.panelBody.innerHTML = "";
  ACHIEVEMENTS.forEach(a => {
    const unlocked = state.achievements.unlockedIds.includes(a.id);
    const value = achievementValue(state, a.cat);
    const card = el("div", "card achCard" + (unlocked ? "" : " locked"));
    card.innerHTML = `<div class="rowBetween">
        <div><span class="achBadge">${unlocked ? trophyIconHtml() : lockIconHtml()}</span> <strong>${a.name}</strong></div>
        <span class="tag">${a.reward} ${currencyIconHtml("gems")}</span>
      </div>
      <div class="progressBar"><div class="fill" style="width:${Math.min(100, value / a.target * 100).toFixed(1)}%"></div></div>
      <p class="desc">${Math.min(value, a.target)} / ${a.target}</p>`;
    dom.panelBody.appendChild(card);
  });
}

// ---------------- Settings panel ----------------
// ---------------- Story panel ----------------
function renderStoryPanel() {
  const state = Game.state;
  dom.panelBody.innerHTML = "";

  const intro = el("div", "card storyCard");
  intro.innerHTML = `
    <div class="storyMark">☄️</div>
    <h3>La Rupture</h3>
    <p class="desc">Autrefois, le Cosmos ne connaissait pas le chaos. Treize Dieux le
    façonnaient dans un ordre parfait. Puis, un jour, cet ordre s'est brisé.
    <strong>Personne ne sait pourquoi.</strong> Il n'en reste qu'une poussière
    infinie d'astéroïdes muets, dispersée dans le vide.</p>
    <p class="desc">Les Dieux, eux, n'ont pas disparu. Ils dorment - chacun caché
    dans un fragment parmi des milliards d'autres, attendant qu'on les retrouve.</p>`;
  dom.panelBody.appendChild(intro);

  dom.panelBody.appendChild(el("h3", null, "L'Étincelle, c'est toi"));
  const spark = el("div", "card storyCard");
  spark.innerHTML = `<p class="desc">Chaque fusion recompose un peu de l'ordre perdu.
    Météorite, Lune, Planète, Étoile... jusqu'à l'Univers. Mais un Univers
    reconstitué ne tient jamais longtemps : il finit par se replier sur
    lui-même. C'est le Big Bang - la fin d'un cycle, et le début du suivant,
    toujours un peu plus loin.</p>`;
  dom.panelBody.appendChild(spark);

  dom.panelBody.appendChild(el("h3", null, "Deux camps, un seul Cosmos"));
  const camps = el("div", "card storyCard");
  camps.innerHTML = `<p class="desc">Les Dieux que tu réveilles se souviennent tous
  de la Rupture, mais pas de la même façon. Les <strong style="color:#93c5fd;">bienveillants</strong> 🕊️
  veulent restaurer l'ordre ancien. Les <strong style="color:#fca5a5;">déchus</strong> 🔥
  ont pris goût au chaos et refusent d'y renoncer. Aucun des deux n'a tort -
  seulement un souvenir différent du même instant.</p>`;
  dom.panelBody.appendChild(camps);

  // Progressive lore: unlocked by real milestones, so there's always a next
  // piece of "why did the Rupture happen" to chase - see LORE_FRAGMENTS.
  const unlockedFrags = LORE_FRAGMENTS.filter(f => f.unlock(state));
  dom.panelBody.appendChild(el("h3", null, `Fragments de mémoire (${unlockedFrags.length}/${LORE_FRAGMENTS.length})`));
  LORE_FRAGMENTS.forEach(frag => {
    const unlocked = frag.unlock(state);
    const card = el("div", "card storyCard" + (unlocked ? "" : " locked"));
    card.innerHTML = unlocked
      ? `<h3>✨ ${frag.title}</h3><p class="desc">${frag.text}</p>`
      : `<h3>${lockIconHtml()} ???</h3><p class="desc">Fragment verrouillé - continue ta progression pour le découvrir.</p>`;
    dom.panelBody.appendChild(card);
  });

  if (state.gods.currentGodId) {
    const god = getGod(state.gods.currentGodId);
    dom.panelBody.appendChild(el("h3", null, "Ton Dieu du moment"));
    const godCard = el("div", "card storyCard");
    godCard.innerHTML = `<h3>${godPortraitHtml(god, "godInlineIcon")} ${god.name}, ${god.title}</h3>
      <p class="desc">${god.lore}</p>`;
    dom.panelBody.appendChild(godCard);
  }
}

// ---------------- Gods panel ----------------
// Compact grid of tiles (was one tall card per god) - tap a tile to open
// openGodDetailModal below, which now carries everything the old card's
// footer used to (unlock/choose/upgrade actions), so nothing was lost, just
// moved behind a tap for a panel that fits far more on screen at once.
function renderGodsPanel() {
  const state = Game.state;
  dom.panelBody.innerHTML = "";

  if (state.gods.currentGodId) {
    const pendingId = state.gods.nextGodId || state.gods.currentGodId;
    const pending = getGod(pendingId);
    const note = el("p", "desc",
      state.gods.nextGodId
        ? `${pending.name} prendra le relais au prochain Big Bang.`
        : `${pending.name} t'accompagne pour cette partie.`);
    dom.panelBody.appendChild(note);
  } else {
    dom.panelBody.appendChild(el("p", "desc", "Fusionne 4 Lunes en une partie pour éveiller ton premier Dieu."));
  }

  const grid = el("div", "godsGrid");
  GODS.forEach(god => {
    const unlocked = isGodUnlocked(state, god.id);
    const equipped = state.gods.currentGodId === god.id;
    const queued = state.gods.nextGodId === god.id;
    const rarity = RARITY[god.rarity];
    const tile = el("button", "godTile" + (equipped ? " equipped" : "") + (unlocked ? "" : " locked"));
    tile.style.setProperty("--rarity-color", rarity.color);
    tile.innerHTML = `
      ${equipped ? '<span class="godTileBadge">✓</span>' : (queued ? '<span class="godTileBadge queued">⏳</span>' : "")}
      <div class="godTileEmoji">${godPortraitHtml(god, "godTilePortrait", !unlocked)}</div>
      <div class="godTileName">${unlocked ? god.name : "???"}</div>
      <div class="godTileTitle">${unlocked ? god.title : rarity.label}</div>`;
    tile.addEventListener("click", () => openGodDetailModal(god.id));
    grid.appendChild(tile);
  });
  dom.panelBody.appendChild(grid);
}

// ---------------- Progression panel ----------------
function renderProgressionPanel() {
  const state = Game.state;
  dom.panelBody.innerHTML = "";

  const summary = el("div", "card progressCard");
  summary.innerHTML = `<h3>Ton voyage</h3>
    <p class="rowBetween"><span>Niveau Cosmique (Big Bang)</span><strong>${state.lifetime.bigBangCount}</strong></p>
    <p class="rowBetween"><span>Palier le plus élevé atteint</span><strong>${TIERS[state.lifetime.maxTierEver - 1].name} ${tierInlineIconHtml(state.lifetime.maxTierEver)}</strong></p>
    <p class="rowBetween"><span>Stardust généré à vie</span><strong>${formatNumber(state.lifetime.stardustEarned)}</strong></p>
    <p class="rowBetween"><span>Dieux éveillés</span><strong>${state.gods.unlockedIds.length} / ${GODS.length}</strong></p>`;
  dom.panelBody.appendChild(summary);

  dom.panelBody.appendChild(el("h3", null, "Ton parcours"));

  // Ordered by actual prerequisite structure, not by data declaration order.
  // Astréos (fusion count), Erebus (fusion streak), Hélios (reach tier 7) and
  // Nyx (20 cells in one run) don't require a Big Bang at all - reaching
  // tier 7 in particular happens *on the way* to tier 10, so it belongs
  // before "Atteindre l'Univers", not after "Premier Big Bang". Within that
  // group, ordered by rarity/typical difficulty (matches config.js's own
  // commun -> rare -> épique ladder): Astréos (commun, 180 lifetime fusions -
  // accumulates passively) before the two rares Hélios (tier 7, usually hit
  // on the way to a first Universe) and Nyx (20 cells unlocked in one run, a
  // deliberate Stardust sink) before Erebus (épique, a deliberate hidden
  // challenge most players won't stumble into by accident).
  const godById = (id) => GODS.find(g => g.id === id);
  // Was `g.emoji` (plain glyph) for every god step here except Thanatos/
  // Chronos, which got a generic stand-in icon (mort.png/sablier.png)
  // before their own portraits existed - Loris: "tu dois changer les
  // icones de dieux partout ou c'est necessaire... dans l'onglet
  // progression c'est pas le cas". Now that every god in GODS has its own
  // `icon` (assets/gods/), godPortraitHtml() gives each step its actual
  // portrait, Thanatos/Chronos included - no more generic stand-ins.
  // .inlineTierIcon already has a dedicated size rule for .roadIconGlyph
  // context (see style.css) from the "Atteindre l'Univers" step below, so
  // these custom-icon steps reuse that same class rather than needing a
  // new one.
  const godStep = (id) => { const g = godById(id); return { emoji: godPortraitHtml(g, "inlineTierIcon"), done: isGodUnlocked(state, id), text: g.name, sub: g.unlock.label }; };
  const roadIcon = (src) => `<img class="inlineTierIcon" src="assets/ui/${src}" alt="">`;
  const steps = [];
  steps.push({ emoji: roadIcon("dieux.png"), done: !!state.gods.currentGodId, text: "Éveiller ton premier Dieu" });
  steps.push(godStep("astreos"));
  steps.push(godStep("helios"));
  steps.push(godStep("nyx"));
  steps.push(godStep("erebus"));
  steps.push({ emoji: tierInlineIconHtml(TIERS.length), done: state.lifetime.maxTierEver >= TIERS.length, text: "Atteindre l'Univers" });
  steps.push({ emoji: roadIcon("bigbang.png"), done: state.lifetime.bigBangCount >= 1, text: "Premier Big Bang" });
  steps.push(godStep("thanatos"));
  steps.push(godStep("chronos"));
  steps.push({ emoji: roadIcon("succes.png"), done: state.achievements.unlockedIds.length >= ACHIEVEMENTS.length,
    text: "Tous les succès", sub: `${state.achievements.unlockedIds.length}/${ACHIEVEMENTS.length}` });

  const nextIdx = steps.findIndex(s => !s.done);
  const roadmap = el("div", "roadmap");
  steps.forEach((s, i) => {
    const state2 = s.done ? "done" : (i === nextIdx ? "next" : "locked");
    const node = el("div", "roadNode " + state2);
    node.innerHTML = `<div class="roadIcon"><span class="roadIconGlyph">${s.done ? "✓" : s.emoji}</span></div>
      <div class="roadText"><div class="roadLabel">${s.text}</div>${s.sub ? `<div class="roadSub">${s.sub}</div>` : ""}</div>`;
    roadmap.appendChild(node);
  });
  dom.panelBody.appendChild(roadmap);
}

// ---------------- God ritual & selection actions ----------------
// The moon-merge ritual now grants Séléna AND Zéphar at once (see
// onFusionForGods, gods.js) specifically so this is a real side-by-side
// choice - un dieu bienveillant, un dieu déchu - matching the modal's own
// "choisis celui qui t'accompagnera" text, which used to show a single
// card with nothing to actually choose between (Loris). .bienveillant/
// .dechu (below) tint each card toward the same blue/red used for the two
// camps in the Histoire panel (renderStoryPanel), so the choice reads
// visually, not just via the tiny 🕊️/🔥 elsewhere.
function openGodPickerModal() {
  const state = Game.state;
  const list = $("godRitualList");
  list.innerHTML = "";
  const available = GODS.filter(g => isGodUnlocked(state, g.id));
  available.forEach(god => {
    const card = el("button", "godRitualCard " + god.alignment);
    card.innerHTML = `<div class="godEmoji">${godPortraitHtml(god, "godRitualPortrait")}</div>
      <div class="godName">${god.name}</div>
      <div class="godTitle">${god.title}</div>
      <p class="godDesc">${god.desc}</p>`;
    card.addEventListener("click", () => {
      chooseGod(state, god.id);
      Sfx.purchase();
      toast(`${god.name} t'accompagne désormais !`);
      $("godRitualModal").classList.add("hidden");
      saveState(state);
      renderAll();
    });
    list.appendChild(card);
  });
  $("godRitualModal").classList.remove("hidden");
}

function openGodDetailModal(godId) {
  const state = Game.state;
  const god = getGod(godId);
  const rarity = RARITY[god.rarity];
  const unlocked = isGodUnlocked(state, god.id);
  const equipped = state.gods.currentGodId === god.id;
  const queued = state.gods.nextGodId === god.id;
  const level = state.gods.powerLevel[god.id] || 0;
  const card = $("godDetailCard");
  card.innerHTML = `
    <div class="godTop">
      <div class="godEmoji godDetailEmoji">${godPortraitHtml(god, "godDetailPortrait", !unlocked)}</div>
      <div class="godNames">
        <div class="godName" style="font-size:18px;">${unlocked ? god.name : "???"}</div>
        <div class="godTitle">${unlocked ? god.title : "Non éveillé"}</div>
      </div>
      <div class="godTagsCol">
        <span class="alignTag">${god.alignment === "bienveillant" ? "🕊️ Bienveillant" : "🔥 Déchu"}</span>
        <span class="rarityTag" style="background:${rarity.color}22;color:${rarity.color};">${rarity.label}</span>
        ${equipped ? '<span class="equippedTag">En jeu</span>' : (queued ? '<span class="equippedTag queued">Prochaine partie</span>' : "")}
      </div>
    </div>
    ${unlocked ? `<p class="godDesc" style="font-style:italic;">${god.lore}</p>
      <p class="godDesc"><strong>Pouvoir actuel (niveau ${level}/${GOD_POWER_MAX_LEVEL}) :</strong> ${describeGodEffect(god, level)}</p>`
      : `<p class="godDesc">Débloque ce Dieu pour découvrir son pouvoir et son histoire.</p>`}
  `;

  if (!unlocked) {
    const info = el("div", "godUnlockInfo");
    if (god.unlock.type === "milestone") info.innerHTML = lockIconHtml() + " " + god.unlock.label;
    else if (god.unlock.type === "challenge") {
      const progress = god.unlock.challengeId === "erebus" ? state.gods.erebusStreak : 0;
      info.textContent = `⚔️ ${god.unlock.label}` + (god.unlock.challengeId === "erebus" ? ` (${Math.min(progress, god.unlock.target)}/${god.unlock.target})` : "");
    } else if (god.unlock.type === "shop") {
      info.innerHTML = `${lockIconHtml()} Boutique : ${god.unlock.cost} ${currencyIconHtml("gems")} ${god.unlock.altLabel ? "(" + god.unlock.altLabel + ")" : ""}`;
    } else if (god.unlock.type === "box") {
      info.innerHTML = `${lockIconHtml()} Uniquement via la Boîte Cosmique (Boutique) - pas d'autre moyen de l'éveiller`;
    } else {
      info.innerHTML = `${lockIconHtml()} Éveille ton premier Dieu via le rituel des lunes.`;
    }
    card.appendChild(info);
    if (god.unlock.type === "shop") {
      const btn = el("button", "btn primary full", `Débloquer — ${god.unlock.cost} ${currencyIconHtml("gems")}`);
      btn.style.marginTop = "8px";
      btn.disabled = state.gems < god.unlock.cost;
      btn.addEventListener("click", () => { onBuyGod(god.id); openGodDetailModal(god.id); });
      card.appendChild(btn);
    }
  } else if (queued) {
    const btn = el("button", "btn ghost full", "✕ Annuler ce choix");
    btn.style.marginTop = "8px";
    btn.addEventListener("click", () => { onChooseGod(state.gods.currentGodId); openGodDetailModal(god.id); });
    card.appendChild(btn);
  } else if (!equipped) {
    const btn = el("button", "btn full", "Choisir pour le prochain Big Bang");
    btn.style.marginTop = "8px";
    btn.addEventListener("click", () => { onChooseGod(god.id); openGodDetailModal(god.id); });
    card.appendChild(btn);
  }

  if (unlocked) {
    const maxed = level >= GOD_POWER_MAX_LEVEL;
    const cost = maxed ? null : godPowerCost(level + 1);
    const power = el("div", "godPower");
    power.innerHTML = `<div class="rowBetween"><span class="godPowerLabel">Niveau de pouvoir</span><span class="skillLevel">${level}/${GOD_POWER_MAX_LEVEL}</span></div>
      <div class="progressBar"><div class="fill" style="width:${(level / GOD_POWER_MAX_LEVEL * 100).toFixed(1)}%"></div></div>`;
    const btn = el("button", "btn primary full", maxed ? "Niveau maximum" : `Améliorer — ${cost} ${currencyIconHtml("gems")}`);
    btn.style.marginTop = "6px";
    btn.disabled = maxed || state.gems < cost;
    if (!maxed) btn.addEventListener("click", () => { onBuyGodPower(god.id); openGodDetailModal(god.id); });
    power.appendChild(btn);
    card.appendChild(power);
  }

  const closeBtn = el("button", "btn ghost full", "Fermer");
  closeBtn.style.marginTop = "10px";
  closeBtn.addEventListener("click", () => $("godDetailModal").classList.add("hidden"));
  card.appendChild(closeBtn);
  $("godDetailModal").classList.remove("hidden");
}

function renderSettingsPanel() {
  const state = Game.state;
  dom.panelBody.innerHTML = "";

  [["sound", "Son"], ["music", "Musique"], ["notifications", "Notifications"]].forEach(([key, label]) => {
    const row = el("div", "settingsRow");
    row.innerHTML = `<span>${label}</span>`;
    const sw = el("div", "switch" + (state.settings[key] ? " on" : ""), '<div class="knob"></div>');
    sw.addEventListener("click", () => {
      state.settings[key] = !state.settings[key];
      Game.settings = state.settings;
      if (key === "music") MusicService.setEnabled(state.settings.music);
      saveState(state);
      renderSettingsPanel();
    });
    row.appendChild(sw);
    dom.panelBody.appendChild(row);
  });

  const restoreBtn = el("button", "btn full", "Restaurer mes achats");
  restoreBtn.addEventListener("click", onRestorePurchases);
  dom.panelBody.appendChild(restoreBtn);

  const backupCard = el("div", "card");
  backupCard.innerHTML = `<h3>Sauvegarde manuelle</h3>
    <p class="desc">Utile si la sauvegarde automatique ne tient pas sur cet appareil : copie un code de ta progression avant de fermer, colle-le pour la restaurer.</p>`;
  const exportBtn = el("button", "btn full", "📤 Exporter ma sauvegarde");
  exportBtn.style.marginBottom = "8px";
  exportBtn.addEventListener("click", () => openSaveCodeModal("export"));
  const importBtn = el("button", "btn ghost full", "📥 Importer une sauvegarde");
  importBtn.addEventListener("click", () => openSaveCodeModal("import"));
  backupCard.appendChild(exportBtn);
  backupCard.appendChild(importBtn);
  dom.panelBody.appendChild(backupCard);

  const restartCard = el("div", "card");
  restartCard.innerHTML = `<h3>Recommencer</h3>
    <p class="desc">Repars de zéro sur cette partie sans attendre l'Univers. L'Énergie Cosmique, les Gems, l'Ascension, les Dieux et les succès restent acquis.</p>`;
  const restartBtn = el("button", "btn danger full", "🔄 Recommencer la partie");
  restartBtn.addEventListener("click", openRestartModal);
  restartCard.appendChild(restartBtn);
  dom.panelBody.appendChild(restartCard);

  const status = el("p", "desc", state.iap.removeAds || isVipActive(state) ?
    "✅ Publicités désactivées sur cet appareil." : "Les publicités sont actives (retirables dans la Boutique).");
  dom.panelBody.appendChild(status);

  const priv = el("a", "btn ghost full", "Politique de confidentialité");
  priv.href = "privacy.html"; priv.target = "_blank"; priv.style.textDecoration = "none"; priv.style.justifyContent = "center";
  dom.panelBody.appendChild(priv);

  const support = el("a", "btn ghost full", "Contacter le support");
  support.href = "mailto:support@cosmerge.example"; support.style.textDecoration = "none"; support.style.justifyContent = "center";
  dom.panelBody.appendChild(support);

  dom.panelBody.appendChild(el("p", "desc", "Godspark — v1.0.0 (prototype)"));
}

// ---------------- Tutorial ----------------
// Text is HTML (see showTutStep's innerHTML below), not plain text -
// tierInlineIconHtml() needs that to show the real artwork inline instead
// of the old plain emoji glyphs, which looked inconsistent once the grid
// itself moved to custom art.
const TUT_STEPS = [
  { title: "Invoquer", text: () => `Appuie sur « Invoquer » pour faire apparaître un Météorite ${tierInlineIconHtml(1)} sur une case vide de la grille.`, target: () => dom.invokeBtnStardust },
  { title: "Fusionner", text: () => `Glisse un astéroïde sur une case adjacente identique pour les fusionner en une Lune ${tierInlineIconHtml(2)}.`, target: () => cellEls[8] },
  { title: "Progresser", text: () => `Continue à fusionner pour atteindre Planète ${tierInlineIconHtml(4)}, Étoile ${tierInlineIconHtml(6)}, Trou noir ${tierInlineIconHtml(8)}... jusqu'à l'Univers ${tierInlineIconHtml(10)}, puis déclenche un Big Bang pour recommencer plus fort !`, target: () => dom.grid },
];
let tutIndex = 0;
let currentHighlight = null;
function showTutStep(i) {
  if (currentHighlight) currentHighlight.classList.remove("tutorial-highlight");
  const step = TUT_STEPS[i];
  $("tutStep").textContent = `Étape ${i + 1} / ${TUT_STEPS.length}`;
  $("tutTitle").textContent = step.title;
  $("tutText").innerHTML = step.text();
  $("tutNext").textContent = (i === TUT_STEPS.length - 1) ? "C'est parti !" : "Suivant";
  currentHighlight = step.target();
  if (currentHighlight) currentHighlight.classList.add("tutorial-highlight");
}
function endTutorial() {
  if (currentHighlight) currentHighlight.classList.remove("tutorial-highlight");
  $("tutOverlay").classList.add("hidden");
  Game.state.tutorialSeen = true;
  saveState(Game.state);
}

// ---------------- Offline modal ----------------
function openOfflineModal(gainInfo, spawnedCount) {
  Game.pendingOfflineGain = gainInfo;
  const capNote = gainInfo.wasCapped ? ` (plafonné à ${offlineCapHours(Game.state)}h)` : "";
  const spawnNote = spawnedCount > 0 ? `\n${spawnedCount} case(s) remplie(s) automatiquement` : "";
  $("offlineText").textContent = `Temps écoulé : ${formatDuration(gainInfo.cappedMs)}${capNote}\n+${formatNumber(gainInfo.gain)} Stardust${spawnNote}`;
  $("offlineDouble").textContent = adsRemoved(Game.state) ? "Doubler" : "Doubler (pub)";
  $("offlineModal").classList.remove("hidden");
}

// ---------------- Daily login modal ----------------
function openDailyModal() {
  const state = Game.state;
  const freezeNote = state.dailyLogin.streakFreezeCharges > 0
    ? ` — ❄️ ${state.dailyLogin.streakFreezeCharges} gel(s) de série en réserve` : "";
  $("dailyStreakLine").innerHTML = `<img class="inlineCurrencyIcon" src="assets/ui/flamme.png" alt=""> Série actuelle : ${state.dailyLogin.streak} jour(s)${freezeNote}`;
  const grid = $("dailyGrid");
  grid.innerHTML = "";
  DAILY_REWARDS.forEach(r => {
    const claimedAlready = r.day < state.dailyLogin.cycleDay || (r.day === state.dailyLogin.cycleDay && !isDailyLoginAvailable(state));
    const isToday = r.day === state.dailyLogin.cycleDay;
    const cellDiv = el("div", "dayCell" + (claimedAlready ? " claimed" : "") + (isToday ? " today" : ""));
    cellDiv.innerHTML = `<div class="dNum">Jour ${r.day}</div><div>${withCurrencyIcons(r.label)}</div>`;
    grid.appendChild(cellDiv);
  });
  $("dailyClaim").disabled = !isDailyLoginAvailable(state);
  $("dailyModal").classList.remove("hidden");
}
function closeDailyModal() { $("dailyModal").classList.add("hidden"); }

// ---------------- Wheel modal ----------------
function openWheelModal() {
  ensureDailySpin(Game.state);
  $("wheelResult").textContent = "";
  $("wheelEl").style.transform = "rotate(0deg)";
  wheelRotation = 0; // keep input.js's running spin total in sync with this visual reset
  refreshWheelButtons();
  $("wheelModal").classList.remove("hidden");
}
function refreshWheelButtons() {
  const s = Game.state.dailySpin;
  $("wheelSpinFree").disabled = s.freeUsed;
  $("wheelSpinAd").disabled = s.bonusUsed;
  $("wheelSpinAd").textContent = adsRemoved(Game.state) ? "Spin bonus" : "Spin bonus (pub)";
}
function closeWheelModal() { $("wheelModal").classList.add("hidden"); }

// ---------------- Big Bang modal ----------------
function openBigBangModal() {
  const gain = previewBigBangGain(Game.state);
  $("bigBangText").innerHTML = `Tu vas gagner ${gain} ${currencyIconHtml("energy")} Énergie Cosmique.`;
  $("bigBangModal").classList.remove("hidden");
}
function closeBigBangModal() { $("bigBangModal").classList.add("hidden"); }

// ---------------- Big Bang summary (shown right after confirming) ----------------
// A toast alone flashed and vanished, with nothing recapping what the run was
// actually worth or pointing at what's next - this replaces it with a real
// screen: run recap + the single nearest god milestone as a concrete "why
// keep playing" hook (see gods.js nextGodMilestoneHint).
function openBigBangSummaryModal({ stardustEarned, maxTier, gain }) {
  const state = Game.state;
  $("bbSummaryStardust").textContent = formatNumber(stardustEarned);
  $("bbSummaryTier").innerHTML = `${TIERS[maxTier - 1].name} ${tierInlineIconHtml(maxTier)}`;
  $("bbSummaryEnergy").innerHTML = `+${formatNumber(gain)} ${currencyIconHtml("energy")}`;
  $("bbSummaryHint").textContent = nextGodMilestoneHint(state)
    || "Tous les Dieux à objectif direct sont éveillés - tente ta chance à la Boîte Cosmique (Boutique) pour les derniers !";
  $("bigBangSummaryModal").classList.remove("hidden");
}
function closeBigBangSummaryModal() { $("bigBangSummaryModal").classList.add("hidden"); }

function openRestartModal() { $("restartModal").classList.remove("hidden"); }
function closeRestartModal() { $("restartModal").classList.add("hidden"); }

// ---------------- Stardust info popup (tapping the Stardust pill) ----------------
function openStardustInfoModal() {
  const state = Game.state;
  ensureDailyStats(state);
  const runElapsedMs = Date.now() - state.runStartedAt;
  $("stardustInfoRunTime").textContent = formatDuration(runElapsedMs);
  $("stardustInfoToday").textContent = "+" + formatNumber(state.lifetime.stardustEarned - state.dailyStats.stardustAtDayStart);
  $("stardustInfoBest").textContent = state.lifetime.bestBigBangMs === null
    ? "Pas encore de record - termine ton premier Big Bang !"
    : formatDuration(state.lifetime.bestBigBangMs);
  $("stardustInfoModal").classList.remove("hidden");
}
function closeStardustInfoModal() { $("stardustInfoModal").classList.add("hidden"); }

// ---------------- Purchase confirmation (every IAP) ----------------
// A toast alone was easy to miss, especially for VIP where the actual
// effect (double production, no ads, all skins) isn't dramatic-looking on
// its own - state.js's isVipActive()/productionMultiplier()/isSkinOwned()
// already read state.iap.vipUntil live the instant it's set in onBuyIAP,
// this modal just makes that unmistakable instead of easy to doubt.
function openPurchaseConfirmModal(product) {
  // No icon prefix here any more (was "✅ ...") - the big animated
  // valide.png checkmark right above the title (.purchaseCheckAnim,
  // index.html) already carries that, repeating a small one inline next
  // to the text would just compete with it.
  $("purchaseConfirmTitle").textContent = product.name;
  $("purchaseConfirmText").textContent = product.id === "vip_monthly"
    ? "Le Pass Supernova est actif dès maintenant : +100% de production, plus aucune pub, tous les skins débloqués, et tes 50 Gems quotidiennes dès demain."
    : `Achat confirmé (simulation) - ${product.desc || "profite-en !"}`;
  $("purchaseConfirmModal").classList.remove("hidden");
}
function closePurchaseConfirmModal() { $("purchaseConfirmModal").classList.add("hidden"); }

// ---------------- Cosmic Box reveal ----------------
// Buying a Cosmic Box used to just show a toast - easy to miss, and gave the
// Gems spent no sense of occasion. This spins briefly then reveals the god
// (or, for a duplicate, the Gems it converted into) with its own beat.
function openCosmicBoxRevealModal(box) {
  const anim = $("cosmicBoxAnim");
  $("cosmicBoxTitle").textContent = "Ouverture...";
  $("cosmicBoxText").textContent = "";
  anim.className = "cosmicBoxAnim spinning";
  anim.textContent = "📦";
  anim.style.removeProperty("--rarity-color");
  $("cosmicBoxClose").classList.add("hidden");
  $("cosmicBoxModal").classList.remove("hidden");
  setTimeout(() => {
    const rarity = RARITY[box.god.rarity];
    anim.className = "cosmicBoxAnim revealed";
    anim.style.setProperty("--rarity-color", rarity.color);
    anim.innerHTML = godPortraitHtml(box.god, "cosmicBoxPortrait");
    if (box.duplicate) {
      $("cosmicBoxTitle").textContent = `${box.god.name} (déjà possédé)`;
      $("cosmicBoxText").innerHTML = `Doublon converti en +${box.gems} ${currencyIconHtml("gems")}`;
    } else {
      $("cosmicBoxTitle").textContent = `✨ Nouveau Dieu : ${box.god.name} !`;
      $("cosmicBoxText").textContent = `${rarity.label} - ${box.god.title}`;
    }
    Sfx.chest();
    $("cosmicBoxClose").classList.remove("hidden");
  }, 900);
}
function closeCosmicBoxModal() { $("cosmicBoxModal").classList.add("hidden"); }

// ---------------- Skin manager (home screen, tap outside to close) ----------------
function openSkinManagerModal() {
  const state = Game.state;
  const list = $("skinManagerList");
  list.innerHTML = "";
  // No palette icon here (unlike the shop's identical section) - the modal's
  // own title just above already carries it (#skinManagerModal h3, index.html),
  // right next to this one - Loris: "il y a deux fois cette illustration".
  list.appendChild(el("h3", null, "Set d'icônes"));
  // Emoji/Illustré switch lives here (Loris), not in the shop.
  list.appendChild(renderIconStyleToggle(openSkinManagerModal));
  list.appendChild(renderCosmeticGrid(EMOJI_SETS, state.equippedEmojiSet, openSkinManagerModal));
  $("skinManagerModal").classList.remove("hidden");
}
function closeSkinManagerModal() { $("skinManagerModal").classList.add("hidden"); }

// ---------------- Gems quick menu (tapping the Gems pill) ----------------
function openGemsMenuModal() { $("gemsMenuModal").classList.remove("hidden"); }
function closeGemsMenuModal() { $("gemsMenuModal").classList.add("hidden"); }

// ---------------- Remove-ads soft prompt (shown once, after the 5th rewarded ad) ----------------
function openRemoveAdsPromptModal() {
  const product = IAP_CATALOG.find(p => p.id === "remove_ads");
  $("removeAdsPromptBuy").textContent = `${product.name} — ${product.price}`;
  $("removeAdsPromptModal").classList.remove("hidden");
}
function closeRemoveAdsPromptModal() { $("removeAdsPromptModal").classList.add("hidden"); }

// Fusion-milestone soft-prompts (25 -> starter pack, 80 -> Pass Supernova),
// see checkFusionPromo()/Game.pendingPromo in retention.js and
// maybeOpenFusionPromo() in input.js. One shared modal, content picked by
// `kind`. `icon` (optional): custom artwork replacing the title's plain
// emoji, same "falls back to emoji until art exists" pattern as
// tierIconNode()/roadIcon() elsewhere - starterPack reuses cadeau.png (a
// starter pack IS a bundle of starting gifts, no new art needed); vipPass
// uses the dedicated supernova.png burst, also used for the shop's own
// Pass Supernova hero card (renderShopPanel) - one asset, two spots.
const FUSION_PROMOS = {
  starterPack: {
    title: "Bien joué !",
    icon: "cadeau.png",
    text: "Tu commences à prendre le rythme. Le Pack de démarrage te donne 500 Gems, 3 cases débloquées et un boost d'1h - un vrai coup de pouce pour la suite.",
    productId: "starter_pack",
  },
  vipPass: {
    title: "Tu es accroché !",
    icon: "supernova.png",
    text: "50 fusions déjà - le Pass Supernova retire les pubs pour toujours, double ta production de Stardust et t'offre 50 Gems chaque jour. Pensé pour les joueurs comme toi.",
    productId: "vip_monthly",
  },
};
let fusionPromoProductId = null;
function openFusionPromoModal(kind) {
  const promo = FUSION_PROMOS[kind];
  const product = promo && IAP_CATALOG.find(p => p.id === promo.productId);
  if (!product) return; // defensive - e.g. the offer expired/was already bought between the trigger and this firing
  fusionPromoProductId = product.id;
  $("fusionPromoTitle").innerHTML = promo.icon
    ? `<img class="inlineCurrencyIcon" src="assets/ui/${promo.icon}" alt=""> ${promo.title}`
    : promo.title;
  $("fusionPromoText").textContent = promo.text;
  $("fusionPromoBuy").textContent = product.type === "subscription" ? `S'abonner — ${product.price}` : `${product.name} — ${product.price}`;
  $("fusionPromoModal").classList.remove("hidden");
}
function closeFusionPromoModal() { $("fusionPromoModal").classList.add("hidden"); fusionPromoProductId = null; }

// ---------------- Manual save backup modal ----------------
function openSaveCodeModal(mode) {
  Game.saveCodeMode = mode;
  const textarea = $("saveCodeText");
  if (mode === "export") {
    $("saveCodeTitle").textContent = "📤 Exporter ma sauvegarde";
    $("saveCodeHelp").textContent = "Sélectionne tout le texte ci-dessous et copie-le (garde-le dans tes Notes, par exemple). Colle-le dans « Importer une sauvegarde » pour la restaurer plus tard.";
    textarea.value = exportSaveCode(Game.state);
    textarea.readOnly = true;
    $("saveCodeAction").textContent = "Copier";
  } else {
    $("saveCodeTitle").textContent = "📥 Importer une sauvegarde";
    $("saveCodeHelp").textContent = "Colle ici un code exporté précédemment. Cela remplacera ta progression actuelle sur cet appareil.";
    textarea.value = "";
    textarea.readOnly = false;
    $("saveCodeAction").textContent = "Restaurer";
  }
  $("saveCodeModal").classList.remove("hidden");
  if (mode === "export") { textarea.focus(); textarea.select(); }
}
function closeSaveCodeModal() { $("saveCodeModal").classList.add("hidden"); }

function buildStars() {
  const bg = $("starsBg");
  for (let i = 0; i < 50; i++) {
    const s = document.createElement("div");
    s.className = "star";
    const size = Math.random() * 2 + 1;
    s.style.width = size + "px"; s.style.height = size + "px";
    s.style.left = (Math.random() * 100) + "%";
    s.style.top = (Math.random() * 100) + "%";
    s.style.animationDelay = (Math.random() * 3) + "s";
    bg.appendChild(s);
  }
  scheduleShootingStars();
  buildWheelSegments();
}

// Loris: the wheel had zero information on it - 7 flat conic-gradient
// slices with no labels at all, just color. Fixed in two steps: first, the
// conic-gradient's boundary angles are computed from WHEEL_PRIZES' real
// weights (30/20/20/10/10/5/5) instead of hand-picked CSS values that didn't
// actually match the real odds. Second, prize info went ON the wheel itself
// as text labels directly on the slices - through two rounds of trying to
// keep those labels from spilling past their own (sometimes very narrow)
// slice, still not clean enough (Loris: "on les voit toujours pas très
// bien", "le 500 il est entre 2-3 cases", "le 1500 sort toujours de sa
// couleur"). Round 3 drops on-wheel labels entirely - the wheel now only
// carries color + dividers + hub, and every prize (full label, no
// space-driven truncation any more, plus a color swatch matching its slice)
// lists in #wheelLegend next to it instead, built here in the same pass.
// Static content - built once at boot, not on every modal open.
function buildWheelSegments() {
  const wheelEl = $("wheelEl");
  const legendEl = $("wheelLegend");
  wheelEl.innerHTML = "";
  legendEl.innerHTML = "";
  const total = WHEEL_PRIZES.reduce((s, p) => s + p.weight, 0);
  const colors = ["#3730a3", "#7c3aed", "#2563eb", "#0891b2", "#be185d", "#f59e0b", "#dc2626"];
  let acc = 0;
  const stops = [];
  const boundaries = [];
  WHEEL_PRIZES.forEach((p, i) => {
    const startDeg = (acc / total) * 360;
    acc += p.weight;
    const endDeg = (acc / total) * 360;
    boundaries.push(startDeg);
    const color = colors[i % colors.length];
    stops.push(`${color} ${startDeg}deg ${endDeg}deg`);

    const item = el("div", "wheelLegendItem");
    const swatch = el("span", "wheelLegendSwatch");
    swatch.style.background = color;
    item.appendChild(swatch);
    item.appendChild(el("span", null, withCurrencyIcons(p.label)));
    legendEl.appendChild(item);
  });
  wheelEl.style.background =
    `radial-gradient(circle at 34% 24%, rgba(255,255,255,.20), transparent 45%), ` +
    `conic-gradient(from 0deg, ${stops.join(", ")})`;

  boundaries.forEach((deg) => {
    const line = el("div", "wheelDivider");
    line.style.transform = `translateX(-50%) rotate(${deg}deg)`;
    wheelEl.appendChild(line);
  });
  wheelEl.appendChild(el("div", "wheelHub"));
}

// Occasional shooting star crossing the background, behind the grid
// (Loris: "un fond un peu plus vivant, sans être perturbant") - one at a
// time, at a random interval, so it reads as a rare little "did you catch
// that?" moment rather than a repeating pattern that draws the eye.
function spawnShootingStar() {
  const bg = $("starsBg");
  const star = document.createElement("div");
  star.className = "shootingStar";
  // Bug fixes (Loris): (1) the travel distance was a fixed 130-220px,
  // which - combined with the diagonal dy eating into the horizontal
  // reach - didn't actually cross a real (esp. narrower mobile) viewport,
  // so the star visibly stopped mid-screen instead of exiting it.
  // Distance is now computed from the ACTUAL viewport size, with enough
  // overshoot (>100%) to guarantee it exits fully before fading. (2) the
  // trail (::before) was always horizontal, just flipped left/right -
  // it never actually pointed backward along the real diagonal path,
  // which read as "off"/disconnected from the star. It's now rotated to
  // the exact opposite angle of travel (atan2 of the real dx/dy) and
  // shortened, so it reads as a proper trailing streak.
  const vw = window.innerWidth, vh = window.innerHeight;
  const fromLeft = Math.random() < 0.5;
  const startX = fromLeft ? -vw * 0.08 : vw * 1.08;
  const startY = vh * (0.05 + Math.random() * 0.3);
  const dx = (fromLeft ? 1 : -1) * vw * (1.16 + Math.random() * 0.14); // always fully crosses + exits
  const dy = vh * (0.35 + Math.random() * 0.35);
  const dist = Math.hypot(dx, dy);
  const speed = 900 + Math.random() * 500; // px/s - keeps a consistent "shooting star" pace regardless of distance
  const dur = Math.min(Math.max(dist / speed, 0.7), 1.8).toFixed(2) + "s";
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  star.style.left = startX + "px";
  star.style.top = startY + "px";
  star.style.setProperty("--dx", dx + "px");
  star.style.setProperty("--dy", dy + "px");
  star.style.setProperty("--dur", dur);
  star.style.setProperty("--trail-angle", (angle + 180) + "deg"); // points backward along the real path
  bg.appendChild(star);
  setTimeout(() => star.remove(), (parseFloat(dur) * 1000) + 100);
}
function scheduleShootingStars() {
  // Delay-then-spawn (not spawn-then-delay) so the first one doesn't fire
  // immediately on page load, while everything else is still settling in -
  // it should feel like a rare thing you happen to catch, not a boot cue.
  const next = 6000 + Math.random() * 12000; // 6-18s
  setTimeout(() => { spawnShootingStar(); scheduleShootingStars(); }, next);
}
