import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Settings, RefreshCw, Copy, Play, Pause, Music, ScrollText, AlertTriangle, Minus, Plus, Menu, Check, UserPen, ArrowRight, X, Ghost, Volume2, VolumeX, History, Heart, Skull, Trophy, Filter, RotateCcw, Clock, Eye, Users, ListMusic, Disc, SkipBack, SkipForward, Sliders, Swords } from 'lucide-react';
import { DEFAULT_SCANNED_AUDIO, ScannedPlaylistsData } from './audioPlaylistsData';
import { playSFX, playRenard, playFantome, playGrabuge } from './audioManager';

// --- DATA & LOGIC ---
const DECK_DEF = [
  { n: 'Renardeau', t: 'R', c: 1 }, { n: 'Renard', t: 'R', c: 5 }, { n: 'Chef des renards', t: 'R', c: 1 }, { n: 'Traître', t: 'R', c: 1 },
  { n: 'Fantôme', t: 'F', c: 3 }, { n: 'Chef des fantômes', t: 'F', c: 1 },
  { n: 'Chasseur de prime', t: 'S', c: 1 }, { n: 'Tueur à gage', t: 'S', c: 1 },
  { n: 'Juge', t: 'I', c: 1 }, { n: 'Vagabond', t: 'I', c: 1 }, { n: 'Gentil homme', t: 'I', c: 1 }, { n: 'Guérisseur', t: 'I', c: 5 },
  { n: 'Enfant de la nature', t: 'I', c: 1 }, { n: 'Berserker', t: 'I', c: 1 }, { n: 'Super voyant', t: 'I', c: 1 },
  { n: 'Le Petit', t: 'I', c: 7 }, { n: 'Omniscient', t: 'I', c: 1 }, { n: 'Alchimiste', t: 'I', c: 1 }, { n: 'Parent', t: 'I', c: 1 },
  { n: 'Magicien', t: 'I', c: 1 }, { n: 'Protecteur', t: 'I', c: 1 }, { n: 'Sorcier de glace', t: 'I', c: 1 },
  { n: 'Maraudeur', t: 'I', c: 1 }, { n: 'Mineur', t: 'I', c: 1 }, { n: 'Elfe', t: 'I', c: 1 }, { n: 'Nain', t: 'I', c: 1 }
];

const getType = (name: string) => DECK_DEF.find(d => d.n === name)?.t || 'I';

const NIGHT_ACTIVE_INNOCENTS = [
  'Parent', 'Enfant de la nature', 'Omniscient', 'Alchimiste', 
  'Sorcier de glace', 'Protecteur', 'Magicien', 'Mineur', 'Super voyant'
];

const getDisplayAllegiance = (cards: string[], originalCards?: string[]) => {
  const realCards = cards.filter(c => c !== '+1 Vie');
  const cardsToEval = realCards.length > 0 ? realCards : cards;
  const ts = cardsToEval.map(getType);
  const hasF = ts.includes('F');
  const hasS = ts.includes('S');
  const hasRealR = cardsToEval.some(c => ['Renard', 'Renardeau', 'Chef des renards'].includes(c) || (getType(c) === 'R' && c !== 'Traître'));
  const hasT = cardsToEval.includes('Traître');

  if (hasF && hasS) return 'Fantôme + Solo';
  if (hasRealR && hasS) return 'Renard + Solo';
  if (hasT && hasS && !hasRealR) return 'Solo';
  if (hasT && !hasRealR && !hasS) return 'Innocent';
  if (hasF) return 'Fantôme';
  if (hasRealR) return 'Renard';
  if (hasS) return 'Solo';
  if (originalCards && originalCards.some(c => ['R', 'F', 'S'].includes(getType(c)))) {
    return 'Innocent';
  }
  return 'Innocent Pur';
};

function generateGame(N: number, C: number, customCounts?: Record<string, number>) {
  const deckDefToUse = customCounts
    ? DECK_DEF.map(d => ({ ...d, c: Math.max(0, customCounts[d.n] ?? d.c) }))
    : DECK_DEF;
  const totalAvailable = deckDefToUse.reduce((sum, d) => sum + d.c, 0);

  if (N * C > totalAvailable) {
    return { err: `Pas assez de cartes disponibles (${totalAvailable}) pour ${N} joueurs × ${C} cartes (${N * C} requises). Réintégrez des rôles dans le deck.` };
  }
  if (N * C > 42) return { err: "Capacité max (42 cartes) atteinte." };

  for (let attempt = 0; attempt < 500; attempt++) {
    // Relaxation logic
    let maxLePetit = 1, maxGuerisseur = 1, maxRenard = 2, maxFantome = 2;
    if (attempt >= 80) {
      maxRenard = 4; maxFantome = 4; maxGuerisseur = 2;
    }
    if (attempt >= 200) {
      maxLePetit = 2;
    }
    if (attempt >= 350) {
      maxLePetit = 4;
    }

    // 1. Define Targets
    let targets: string[] = [];
    if (N <= 6) {
      if (N === 4) targets = ['R', 'F', 'S', 'I'];
      else if (N === 5) targets = ['R', 'R', 'F', 'S', 'I'];
      else targets = ['R', 'R', 'F', 'F', 'S', 'I'];
    } else {
      // 7+: Min 3R, 3F. Rest random but balanced later
      targets = Array(N).fill('?');
      targets[0] = targets[1] = targets[2] = 'R';
      targets[3] = targets[4] = targets[5] = 'F';
    }

    // 2. Build Deck Pool
    let pool: string[] = [];
    let inventory = deckDefToUse.flatMap(d => Array(d.c).fill(d.n));
    
    // Helper to take card
    const take = (name: string) => {
      const idx = inventory.indexOf(name);
      if (idx > -1) { inventory.splice(idx, 1); pool.push(name); return true; }
      return false;
    };
    const takeType = (t: string) => {
      const opts = inventory.filter(c => getType(c) === t);
      if (!opts.length) return false;
      return take(opts[Math.floor(Math.random() * opts.length)]);
    };

    // Mandatory cards for targets
    let players = targets.map((t, i) => ({ id: i + 1, cards: [] as string[], target: t }));
    let valid = true;

    // Force Chasseur/Tueur logic if S is present or random chance
    let hasChasseur = false, hasTueur = false;
    // For strict S targets, ensure we pick S cards
    players.filter(p => p.target === 'S').forEach(() => {
      if (N < 7 && inventory.includes('Chasseur de prime') && Math.random() > 0.05) {
        take('Chasseur de prime');
      } else {
        if (!takeType('S')) valid = false;
      }
    });
    
    if (!valid) continue;

    // Check dependencies
    hasChasseur = pool.includes('Chasseur de prime');
    hasTueur = pool.includes('Tueur à gage');
    
    if (hasChasseur) {
      if (!pool.includes('Chef des renards') && !take('Chef des renards')) valid = false;
      if (!pool.includes('Chef des fantômes') && !take('Chef des fantômes')) valid = false;
    }
    if (hasTueur) {
      if (!pool.includes('Chasseur de prime') && !take('Chasseur de prime')) valid = false;
      if (!take('Protecteur')) valid = false;
      // Chasseur triggers Chefs
      if (!pool.includes('Chef des renards') && !take('Chef des renards')) valid = false;
      if (!pool.includes('Chef des fantômes') && !take('Chef des fantômes')) valid = false;
    }

    // Elf/Dwarf Duo Logic
    const hasElfe = pool.includes('Elfe');
    const hasNain = pool.includes('Nain');
    if (hasElfe && !hasNain) {
       if (!take('Nain')) valid = false;
    }
    if (hasNain && !hasElfe) {
       if (!take('Elfe')) valid = false;
    }

    if (!valid) continue;

    // Fill rest of pool
    let rInPool = pool.filter(c => getType(c) === 'R').length;
    let fInPool = pool.filter(c => getType(c) === 'F').length;
    
    const maxAllowedR = N >= 7 ? Math.floor((N - 1) / 2) : targets.filter(t => t === 'R').length;
    const maxAllowedF = N >= 7 ? Math.floor((N - 1) / 2) : targets.filter(t => t === 'F').length;
    
    const maxRInPool = maxAllowedR * (attempt >= 200 ? 3 : 2);
    const maxFInPool = maxAllowedF * (attempt >= 200 ? 3 : 2);
    const maxPetitInPool = attempt >= 200 ? 7 : (attempt >= 100 ? N : Math.min(N, Math.max(1, N - 1)));
    let petitInPool = pool.filter(c => c === 'Le Petit').length;

    while (pool.length < N * C) {
      if (inventory.length === 0) { valid = false; break; }
      const activeInPool = pool.filter(c => NIGHT_ACTIVE_INNOCENTS.includes(c)).length;
      const activeInInv = inventory.filter(c => NIGHT_ACTIVE_INNOCENTS.includes(c));
      let idx: number;
      if (activeInInv.length > 0 && activeInPool < Math.ceil(N / 2) && Math.random() < 0.45) {
        const pickedActive = activeInInv[Math.floor(Math.random() * activeInInv.length)];
        idx = inventory.indexOf(pickedActive);
      } else {
        idx = Math.floor(Math.random() * inventory.length);
      }
      const card = inventory[idx];
      const cType = getType(card);
      
      if (cType === 'R' && rInPool >= maxRInPool && inventory.length > (N * C - pool.length)) {
        inventory.splice(idx, 1);
        continue;
      }
      if (cType === 'F' && fInPool >= maxFInPool && inventory.length > (N * C - pool.length)) {
        inventory.splice(idx, 1);
        continue;
      }
      if (card === 'Le Petit' && petitInPool >= maxPetitInPool && inventory.length > (N * C - pool.length)) {
        inventory.splice(idx, 1);
        continue;
      }
      const sInPool = pool.filter(c => getType(c) === 'S').length;
      const maxAllowedS = N >= 7 ? 2 : 1;
      if (cType === 'S' && sInPool >= maxAllowedS && inventory.length > (N * C - pool.length)) {
        inventory.splice(idx, 1);
        continue;
      }
      
      pool.push(card);
      inventory.splice(idx, 1);
      if (cType === 'R') rInPool++;
      if (cType === 'F') fInPool++;
      if (card === 'Le Petit') petitInPool++;
    }
    
    // FIX: Enforce Tueur dependencies
    if (pool.includes('Tueur à gage')) {
      ['Chasseur de prime', 'Protecteur'].forEach(req => {
        if (!pool.includes(req)) {
          const invIdx = inventory.indexOf(req);
          if (invIdx > -1) {
            inventory.splice(invIdx, 1);
            const swapIdx = pool.findIndex(c => getType(c) === 'I' && !['Protecteur', 'Sorcière', 'Voyante'].includes(c));
            if (swapIdx > -1) pool[swapIdx] = req;
            else valid = false;
          } else valid = false;
        }
      });
    }

    // FIX: Enforce Chasseur dependencies
    if (pool.includes('Chasseur de prime')) {
      ['Chef des renards', 'Chef des fantômes'].forEach(req => {
        if (!pool.includes(req)) {
          const invIdx = inventory.indexOf(req);
          if (invIdx > -1) {
            inventory.splice(invIdx, 1);
            let swapIdx = pool.findIndex(c => getType(c) === 'I' && !['Protecteur', 'Sorcière', 'Voyante', 'Tueur à gage', 'Chasseur de prime'].includes(c));
            if (swapIdx > -1) pool[swapIdx] = req;
            else valid = false;
          } else valid = false;
        }
      });
    }

    if (!valid) continue;

    // 3. Distribute
    // Pre-assign 1 card to match targets
    players.forEach(p => {
      if (['R', 'F', 'S'].includes(p.target)) {
        const cIdx = pool.findIndex(c => getType(c) === p.target);
        if (cIdx > -1) { p.cards.push(pool[cIdx]); pool.splice(cIdx, 1); }
        else valid = false;
      } else if (p.target === 'I') {
        const activeIdx = pool.findIndex(c => NIGHT_ACTIVE_INNOCENTS.includes(c));
        const cIdx = activeIdx > -1 ? activeIdx : pool.findIndex(c => getType(c) === 'I');
        if (cIdx > -1) { p.cards.push(pool[cIdx]); pool.splice(cIdx, 1); }
        else valid = false;
      }
    });

    if (!valid) continue;

    // Distribute remaining
    pool.sort(() => Math.random() - 0.5);
    pool.sort((a, b) => {
      const score = (c: string) => {
        const t = getType(c);
        if (['R', 'F', 'S'].includes(t)) return 0;
        if (NIGHT_ACTIVE_INNOCENTS.includes(c)) return 1;
        return 2;
      };
      return score(a) - score(b);
    });
    for (const card of pool) {
      const cType = getType(card);
      // Find valid players
      const candidates = players.filter(p => {
        if (p.cards.length >= C) return false;
        // Rules
        const pTypes = p.cards.map(getType);
        if (cType === 'S' && pTypes.includes('S') && Math.random() > 0.02) return false;
        if (cType === 'R' && pTypes.includes('F')) return false;
        if (cType === 'F' && pTypes.includes('R')) return false;
        if (cType === 'R' && p.cards.filter(c => getType(c) === 'R').length >= maxRenard) return false;
        if (cType === 'F' && p.cards.filter(c => getType(c) === 'F').length >= maxFantome) return false;
        if (card === 'Guérisseur' && p.cards.filter(c => c === 'Guérisseur').length >= maxGuerisseur) return false;
        if (card === 'Le Petit' && p.cards.filter(c => c === 'Le Petit').length >= maxLePetit) return false;
        if (card !== 'Le Petit' && p.cards.filter(c => c === card).length >= 2) return false;
        if ((card === 'Elfe' && p.cards.includes('Nain')) || (card === 'Nain' && p.cards.includes('Elfe'))) return false;
        
        // Target constraints
        if (N < 7) {
          if (p.target === 'I' && cType !== 'I') return false;
          if (p.target !== 'I' && cType !== p.target && cType !== 'I') return false;
        }

        // Avoid leaving a player with 0 innocent cards (all colored) when on their last slot
        const wouldHaveOnlyColored = ['R', 'F', 'S'].includes(cType) && 
          !p.cards.some(c => getType(c) === 'I') && 
          p.cards.length >= C - 1;
        if (wouldHaveOnlyColored && attempt < 120 && Math.random() > 0.05) return false;

        return true;
      });

      if (candidates.length === 0) { valid = false; break; }
      
      const wouldHaveOnlyColored = (p: typeof players[0]) => 
        ['R', 'F', 'S'].includes(cType) && 
        !p.cards.some(c => getType(c) === 'I') && 
        p.cards.length >= C - 1;
      const safeCandidates = candidates.filter(p => !wouldHaveOnlyColored(p));
      const poolCandidates = safeCandidates.length > 0 ? safeCandidates : candidates;

      let chosen;
      if (cType === 'R' || cType === 'F') {
        const existingFaction = poolCandidates.filter(c => c.cards.some(x => getType(x) === cType) || c.target === cType);
        if (existingFaction.length > 0 && Math.random() > 0.2) {
          const minCount = Math.min(...existingFaction.map(c => c.cards.filter(x => getType(x) === cType).length));
          const best = existingFaction.filter(c => c.cards.filter(x => getType(x) === cType).length === minCount);
          chosen = best[Math.floor(Math.random() * best.length)];
        } else {
          chosen = poolCandidates[Math.floor(Math.random() * poolCandidates.length)];
        }
      } else if (cType === 'S') {
        const withoutS = poolCandidates.filter(c => !c.cards.some(x => getType(x) === 'S'));
        if (withoutS.length > 0) {
          chosen = withoutS[Math.floor(Math.random() * withoutS.length)];
        } else {
          chosen = poolCandidates[Math.floor(Math.random() * poolCandidates.length)];
        }
      } else if (NIGHT_ACTIVE_INNOCENTS.includes(card)) {
        // Prioritize pure innocents who have NO active night card yet
        const innocentsWithoutActive = candidates.filter(c => 
          !c.cards.some(x => ['R', 'F', 'S'].includes(getType(x))) &&
          !c.cards.some(x => NIGHT_ACTIVE_INNOCENTS.includes(x))
        );
        if (innocentsWithoutActive.length > 0) {
          chosen = innocentsWithoutActive[Math.floor(Math.random() * innocentsWithoutActive.length)];
        } else {
          chosen = candidates[Math.floor(Math.random() * candidates.length)];
        }
      } else if (card === 'Le Petit') {
        const minPetit = Math.min(...candidates.map(c => c.cards.filter(x => x === 'Le Petit').length));
        const bestPetit = candidates.filter(c => c.cards.filter(x => x === 'Le Petit').length === minPetit);
        chosen = bestPetit[Math.floor(Math.random() * bestPetit.length)];
      } else {
        // For passive innocents, avoid assigning to a pure innocent who has no active card and only 1 slot left
        const innocentAtRisk = (p: typeof players[0]) => 
          !p.cards.some(x => ['R', 'F', 'S'].includes(getType(x))) &&
          !p.cards.some(x => NIGHT_ACTIVE_INNOCENTS.includes(x)) &&
          p.cards.length >= C - 1;
        const saferCandidates = candidates.filter(p => !innocentAtRisk(p));
        if (saferCandidates.length > 0 && Math.random() > 0.05) {
          chosen = saferCandidates[Math.floor(Math.random() * saferCandidates.length)];
        } else {
          chosen = candidates[Math.floor(Math.random() * candidates.length)];
        }
      }
      chosen.cards.push(card);
    }

    if (!valid) continue;

    // 4. Final Validation
    const getAllegiance = (cards: string[]) => {
      const ts = cards.map(getType);
      if (ts.includes('R')) return 'Renard';
      if (ts.includes('F')) return 'Fantôme';
      if (ts.includes('S')) return 'Solo';
      return 'Innocent Pur';
    };

    const rCount = players.filter(p => getAllegiance(p.cards) === 'Renard').length;
    const fCount = players.filter(p => getAllegiance(p.cards) === 'Fantôme').length;

    if (N <= 6) {
      // Strict checks already handled by distribution logic + targets
    } else {
      // 7+: Min 3, Max < N/2
      if (rCount < 3 || fCount < 3) continue;
      if (rCount >= N / 2 || fCount >= N / 2) continue;
    }

    return { 
      players: players.map(p => ({ 
        ...p, 
        cardIds: p.cards.map((c, i) => `card-${p.id}-${i}-${Math.random().toString(36).slice(2, 7)}`),
        allegiance: getDisplayAllegiance(p.cards) 
      })) 
    };
  }
  return { err: "Impossible de générer une configuration équilibrée avec ces restrictions de cartes. Veuillez réintégrer certains rôles ou assouplir les exclusions." };
}

// --- UI COMPONENTS ---
const evaluateVictory = () => {
  const badges = Array.from(document.querySelectorAll('.role-badge'));
  const getBadge = (n: string) => badges.find(b => b.textContent?.trim() === n);
  const isDead = (n: string) => getBadge(n)?.classList.contains('role-mort');
  const players = Array.from(document.querySelectorAll('.player-card'));
  const getPName = (el: Element) => el.querySelector('.player-name')?.textContent || '';
  
  let titles: string[] = [], msgs: string[] = [], winners: string[] = [];

  const tueur = getBadge('Tueur à gage');
  if (isDead('Chasseur de prime') && isDead('Protecteur') && tueur && !tueur.classList.contains('role-mort')) {
    titles.push("TUEUR À GAGES");
    msgs.push("Le contrat est rempli !");
    winners.push(getPName(tueur.closest('.player-card')!));
  }

  const chasseur = getBadge('Chasseur de prime');
  if (isDead('Chef des renards') && isDead('Chef des fantômes') && chasseur && !chasseur.classList.contains('role-mort')) {
    titles.push("CHASSEUR DE PRIME");
    msgs.push("Les têtes des Chefs sont tombées !");
    winners.push(getPName(chasseur.closest('.player-card')!));
  }

  const getAll = (p: Element) => {
    const liveBadges = Array.from(p.querySelectorAll('.role-badge:not(.role-mort)'))
      .map((b: any) => b.textContent?.trim() || '')
      .filter(c => c !== '+1 Vie');
    const allBadges = Array.from(p.querySelectorAll('.role-badge'))
      .map((b: any) => b.textContent?.trim() || '')
      .filter(c => c !== '+1 Vie');
    if (liveBadges.length > 0) {
      return getDisplayAllegiance(liveBadges, allBadges);
    }
    const text = p.querySelector('.allegiance-text')?.textContent || '';
    if (text.includes(': ')) return text.split(': ')[1].trim();
    return p.getAttribute('data-initial-allegiance') || '';
  };

  const alive = players.filter(p => !p.classList.contains('joueur-mort'));
  const isFox = (p: Element) => {
    const liveBadges = Array.from(p.querySelectorAll('.role-badge:not(.role-mort)'))
      .map((b: any) => b.textContent?.trim() || '')
      .filter(c => c !== '+1 Vie');

    const allPlayerCards = Array.from(p.querySelectorAll('.role-badge'))
      .map((b: any) => b.textContent?.trim() || '')
      .filter(c => c !== '+1 Vie');
    const hadTraitor = allPlayerCards.includes('Traître');
    const hasLiveTraitor = liveBadges.includes('Traître');
    const hasLiveRealFox = liveBadges.some(c => ['Renard', 'Renardeau', 'Chef des renards'].includes(c) || (getType(c) === 'R' && c !== 'Traître'));

    // Si le joueur possède le Traître :
    // Il n'est Renard et ne gagne avec les Renards QUE si le Traître ET un renard sont tous les deux encore en vie.
    // S'il n'a que le Traître, il ne gagne pas avec les Renards (il compte comme Innocent).
    if (hadTraitor) {
      return hasLiveTraitor && hasLiveRealFox;
    }

    // Joueur standard sans Traître : il est Renard s'il a au moins un vrai renard encore en vie
    // (y compris si le joueur a aussi une carte Solo, tel que Renard + Solo)
    return hasLiveRealFox;
  };
  const aliveFoxes = alive.filter(isFox);
  if (alive.length > 0 && aliveFoxes.length > alive.length / 2) {
    titles.push("RENARDS");
    msgs.push("Les Renards ont la supériorité numérique !");
    aliveFoxes.forEach(p => winners.push(getPName(p)));
  }

  const ghostKills = Array.from(document.querySelectorAll('.tue-par-fantome')).map(e => e.textContent?.trim() || '');
  if (ghostKills.some(c => getType(c) === 'R') && ghostKills.some(c => getType(c) === 'F') && ghostKills.some(c => getType(c) === 'I')) {
    titles.push("LES FANTÔMES");
    msgs.push("Le Rituel a été accompli : un Renard, un Fantôme et un Innocent ont été sacrifiés !");
    const isGhostPlayer = (p: Element) => {
      const allPlayerBadges = Array.from(p.querySelectorAll('.role-badge'))
        .map((b: any) => b.textContent?.trim() || '')
        .filter(c => c !== '+1 Vie');
      const hasGhostBadge = allPlayerBadges.some(c => getType(c) === 'F');
      const initialAllegiance = p.getAttribute('data-initial-allegiance') || '';
      return hasGhostBadge || initialAllegiance.includes('Fantôme');
    };
    players.filter(isGhostPlayer).forEach(p => winners.push(getPName(p)));
  }

  const aliveInnocents = alive.filter(p => ['Innocent', 'Innocent Pur'].includes(getAll(p)));
  if (alive.length > 0 && aliveInnocents.length >= alive.length / 2) {
    titles.push("LES INNOCENTS");
    msgs.push("Les Innocents et Innocents Purs ont repris le contrôle de la forêt !");
    aliveInnocents.forEach(p => winners.push(getPName(p)));
  }

  if (alive.length === 0 && players.length > 0) {
    titles.push("NÉANT (ÉGALITÉ)");
    msgs.push("Il n'y a plus aucun survivant. Le village est décimé !");
  }

  return { titles, msgs, winners };
};

const checkVictoryConditions = (onGameEnd?: () => void) => {
  const { titles, msgs, winners } = evaluateVictory();

  if (document.getElementById('rs-pending-win-overlay')) {
    document.getElementById('rs-pending-win-overlay')?.remove();
  }
  if (document.getElementById('rs-final-win-overlay')) {
    document.getElementById('rs-final-win-overlay')?.remove();
  }

  if (titles.length) {
    window.dispatchEvent(new CustomEvent('rs_victory_available', { detail: { available: true, titles } }));
    const pop = document.createElement('div');
    pop.id = 'rs-pending-win-overlay';
    pop.className = 'fixed inset-0 z-[9999] bg-black/90 flex flex-col items-center justify-center text-center p-4 animate-in fade-in duration-300';
    pop.innerHTML = `
      <div class="bg-neutral-900 border border-neutral-700 p-8 rounded-xl max-w-lg shadow-2xl relative font-sans">
        <h2 class="text-3xl font-black text-orange-500 mb-6 uppercase tracking-wider font-serif">Victoire Détectée</h2>
        <p class="text-xl text-gray-200 mb-8 leading-relaxed">L'équipe <strong class="text-white">${titles.join(' et ')}</strong> remplit ses conditions de victoire.<br><br>Y a-t-il eu d'autres joueurs éliminés en même temps ?</p>
        <div class="flex flex-col sm:flex-row gap-4">
          <button id="btn-win-yes" class="flex-1 bg-neutral-800 text-white font-bold py-4 px-4 rounded-xl border border-neutral-600 hover:bg-neutral-700 transition uppercase tracking-wider shadow-md text-sm sm:text-base">Oui (Continuer)</button>
          <button id="btn-win-no" class="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-4 rounded-xl transition uppercase tracking-wider shadow-lg shadow-red-900/50 text-sm sm:text-base">Non (Terminer)</button>
        </div>
      </div>
    `;
    document.body.appendChild(pop);

    document.getElementById('btn-win-yes')?.addEventListener('click', () => {
      pop.remove();
    });

    document.getElementById('btn-win-no')?.addEventListener('click', () => {
      pop.remove();
      window.dispatchEvent(new CustomEvent('rs_game_won'));
      
      const overlay = document.createElement('div');
      overlay.id = 'rs-final-win-overlay';
      overlay.className = 'fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center text-center p-4 animate-in fade-in duration-500';
      overlay.innerHTML = `
        <h1 class="text-4xl md:text-6xl font-black text-yellow-500 mb-8 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)] uppercase tracking-tighter">VICTOIRE : ${titles.join(' ET ')}</h1>
        <p class="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl leading-relaxed">${msgs.join('<br>')}</p>
        <p class="text-2xl md:text-3xl font-bold text-white mb-12">Félicitations aux joueurs : <span class="text-red-500">${[...new Set(winners)].join(', ')}</span></p>
        <div class="flex flex-col sm:flex-row gap-6">
          <button id="btn-retour-menu" class="bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-12 rounded-xl text-xl transition-all shadow-lg shadow-red-900/50 uppercase tracking-widest">Retour au menu</button>
          <button id="btn-debrief" class="bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-4 px-12 rounded-xl text-xl transition-all shadow-lg border border-neutral-600 uppercase tracking-widest">Journal des Pertes</button>
        </div>
      `;
      document.body.appendChild(overlay);
      
      const btn = document.getElementById('btn-retour-menu');
      if (btn) {
        btn.addEventListener('click', () => {
          if (onGameEnd) onGameEnd();
          overlay.remove();
        });
      }

      document.getElementById('btn-debrief')?.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('rs_show_debrief'));
      });
    });
  } else {
    window.dispatchEvent(new CustomEvent('rs_victory_available', { detail: { available: false, titles: [] } }));
  }
};

const CardBadge: React.FC<{ 
  card: string, 
  cardIndex?: number,
  playerName?: string,
  isDeadProp?: boolean,
  isGhostProp?: boolean,
  isPlaying?: boolean, 
  nightCount?: number, 
  onGameEnd?: () => void, 
  hasPlayedNight1?: boolean, 
  isFinished?: boolean,
  customOnClick?: (card: string, isDead: boolean) => void,
  isSelected?: boolean,
  natureChildMode?: string | null,
  onRequestRevive?: (candidate: { playerName: string, cardName: string, cardIndex?: number, badgeEl: HTMLElement, pcEl: HTMLElement }) => void,
  hasActiveExtraLife?: boolean,
  onBlockedExtraLife?: (playerName: string) => void,
  onAddExtraLife?: (playerName: string) => void,
  onConsumeExtraLife?: (playerName: string, cardIndex?: number) => void,
  isGentlemanChoosing?: boolean,
  onGentlemanEliminated?: (giverPlayerName: string) => void,
  onElfDwarfEliminated?: (role: 'Elfe' | 'Nain', playerName: string) => void,
  onBerserkerEliminated?: (playerName: string, cardIndex?: number) => void,
  isForcedTarget?: boolean,
  isForcedDisabled?: boolean,
  isBerserkerTarget?: boolean,
  isBerserkerChoosing?: boolean
}> = ({ card, cardIndex, playerName, isDeadProp = false, isGhostProp = false, isPlaying, nightCount, onGameEnd, hasPlayedNight1, isFinished, customOnClick, isSelected, natureChildMode, onRequestRevive, hasActiveExtraLife = false, onBlockedExtraLife, onAddExtraLife, onConsumeExtraLife, isGentlemanChoosing = false, onGentlemanEliminated, onElfDwarfEliminated, onBerserkerEliminated, isForcedTarget = false, isForcedDisabled = false, isBerserkerTarget = false, isBerserkerChoosing = false }) => {
  const [showActions, setShowActions] = useState(false);
  const [showReviveActions, setShowReviveActions] = useState(false);
  const [isLocalDead, setIsLocalDead] = useState(false);
  const [isLocalGhostDead, setIsLocalGhostDead] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const isKillingRef = useRef(false);
  const isDismissingRef = useRef(false);

  useEffect(() => {
    setIsDismissing(false);
    isDismissingRef.current = false;
  }, [card, cardIndex]);

  const isLifeCard = card === '+1 Vie';
  const effectiveDead = isDeadProp || isLocalDead;
  const effectiveGhost = isGhostProp || isLocalGhostDead;

  useEffect(() => {
    if (!isDeadProp) {
      setIsLocalDead(false);
      setIsLocalGhostDead(false);
      isKillingRef.current = false;
    }
  }, [isDeadProp]);

  useEffect(() => {
    const badge = badgeRef.current;
    if (badge) {
      if (effectiveDead) {
        badge.classList.add('role-mort');
        if (effectiveGhost) badge.classList.add('tue-par-fantome');
      } else {
        badge.classList.remove('role-mort', 'tue-par-fantome');
      }
    }
  }, [effectiveDead, effectiveGhost]);

  useEffect(() => {
    const handleRevived = (e: any) => {
      const { cardName, playerName: pName, cardIndex: cIdx } = e.detail || {};
      const matchesIndex = cIdx !== undefined ? cIdx === cardIndex : true;
      if (cardName === card && (!pName || pName === playerName) && matchesIndex) {
        setIsLocalDead(false);
        setIsLocalGhostDead(false);
        setShowReviveActions(false);
        isKillingRef.current = false;
      }
    };
    window.addEventListener('rs_card_revived', handleRevived);
    return () => window.removeEventListener('rs_card_revived', handleRevived);
  }, [card, playerName, cardIndex]);

  const type = getType(card);
  const colors: any = { 
    R: 'bg-orange-900/40 text-orange-200 border-orange-700/50', 
    F: 'bg-cyan-900/40 text-cyan-200 border-cyan-700/50', 
    S: 'bg-purple-900/40 text-purple-200 border-purple-700/50', 
    I: 'bg-gray-800 text-gray-300 border-gray-600',
    LIFE: 'bg-red-900/40 text-red-200 border-red-700/50 shadow-[0_0_10px_rgba(239,68,68,0.25)]'
  };
  
  const kill = (e: any, ghost = false) => {
    e.stopPropagation();
    if (isKillingRef.current) return;
    if (hasActiveExtraLife && !isLifeCard) {
      setShowActions(false);
      if (onBlockedExtraLife) onBlockedExtraLife(playerName || 'Ce joueur');
      return;
    }
    isKillingRef.current = true;
    setShowReviveActions(false);
    setIsLocalDead(true);
    if (ghost) setIsLocalGhostDead(true);
    const badge = badgeRef.current || (e.target as HTMLElement).closest('.role-badge-container')?.querySelector('.role-badge');
    if (badge) {
      const alreadyDead = badge.classList.contains('role-mort');
      badge.classList.add('role-mort');
      if (nightCount) badge.setAttribute('data-death-turn', nightCount.toString());
      if (ghost) badge.classList.add('tue-par-fantome');
      setShowActions(false);

      const pc = badge.closest('.player-card');
      if (pc) {
        const live = Array.from(pc.querySelectorAll('.role-badge:not(.role-mort)'))
          .map((b: any) => b.textContent?.trim() || '')
          .filter(c => c && c !== '+1 Vie');
        const allBadges = Array.from(pc.querySelectorAll('.role-badge'))
          .map((b: any) => b.textContent?.trim() || '')
          .filter(c => c && c !== '+1 Vie');
        
        const txt = live.length === 0 
          ? (allBadges.some(c => ['R', 'F', 'S'].includes(getType(c))) ? 'Innocent' : 'Innocent Pur')
          : getDisplayAllegiance(live, allBadges);
        
        pc.setAttribute('data-initial-allegiance', txt);
        pc.setAttribute('data-initial-pure', txt === 'Innocent Pur' ? 'true' : 'false');
        pc.querySelectorAll('.allegiance-text').forEach(s => s.textContent = `Allégeance : ${txt}`);

        if (!alreadyDead) {
          const remainingPlayers = Array.from(document.querySelectorAll('.player-card')).filter(p => p.querySelectorAll('.role-badge').length > p.querySelectorAll('.role-badge.role-mort').length);
          const teamCounts = {
            R: remainingPlayers.filter(p => (p.getAttribute('data-initial-allegiance') || '').includes('Renard') && !(p.getAttribute('data-initial-allegiance') || '').includes('Solo')).length,
            F: remainingPlayers.filter(p => (p.getAttribute('data-initial-allegiance') || '').includes('Fantôme') && !(p.getAttribute('data-initial-allegiance') || '').includes('Solo')).length,
            I: remainingPlayers.filter(p => (p.getAttribute('data-initial-allegiance') || '').includes('Innocent')).length,
            S: remainingPlayers.filter(p => (p.getAttribute('data-initial-allegiance') || '').includes('Solo')).length,
          };

          const clickedPlayerId = pc ? parseInt(pc.getAttribute('data-player-id') || '-1', 10) : undefined;
          const clickedPlayerName = pc.getAttribute('data-player-name') || playerName || 'Joueur Inconnu';
          const deadRole = badge.textContent || 'Inconnu';
          
          window.dispatchEvent(new CustomEvent('rs_player_killed', {
            detail: {
              playerId: clickedPlayerId !== -1 ? clickedPlayerId : undefined,
              playerName: clickedPlayerName,
              originalRole: deadRole,
              cardIndex: cardIndex,
              teamCounts,
              isGhostKill: ghost,
              turn: nightCount
            }
          }));

          // When a Guérisseur is eliminated, grant exactly 1 +1 Vie card to the player!
          if (card === 'Guérisseur' || deadRole.trim() === 'Guérisseur') {
            if (onAddExtraLife) {
              onAddExtraLife(clickedPlayerName);
            }
          }

          // When a Gentil homme is eliminated, trigger the gift of life flow!
          if (card === 'Gentil homme' || deadRole.trim() === 'Gentil homme') {
            if (onGentlemanEliminated) {
              onGentlemanEliminated(clickedPlayerName);
            } else {
              window.dispatchEvent(new CustomEvent('rs_gentleman_killed', { detail: { playerName: clickedPlayerName } }));
            }
          }

          // When an Elfe or Nain is eliminated, trigger the Elfe & Nain duo life rule!
          if (card === 'Elfe' || deadRole.trim() === 'Elfe') {
            if (onElfDwarfEliminated) {
              onElfDwarfEliminated('Elfe', clickedPlayerName);
            } else {
              window.dispatchEvent(new CustomEvent('rs_elf_dwarf_killed', { detail: { role: 'Elfe', playerName: clickedPlayerName } }));
            }
          } else if (card === 'Nain' || deadRole.trim() === 'Nain') {
            if (onElfDwarfEliminated) {
              onElfDwarfEliminated('Nain', clickedPlayerName);
            } else {
              window.dispatchEvent(new CustomEvent('rs_elf_dwarf_killed', { detail: { role: 'Nain', playerName: clickedPlayerName } }));
            }
          }

          // When a Berserker is eliminated, trigger the Berserker revenge flow!
          if (card === 'Berserker' || deadRole.trim() === 'Berserker') {
            if (onBerserkerEliminated) {
              onBerserkerEliminated(clickedPlayerName, cardIndex);
            } else {
              window.dispatchEvent(new CustomEvent('rs_berserker_killed', { detail: { playerName: clickedPlayerName, cardIndex } }));
            }
          }
        }
      }

      setTimeout(() => {
        const pc = badge.closest('.player-card');
        if (pc && pc.querySelectorAll('.role-badge').length === pc.querySelectorAll('.role-badge.role-mort').length) {
          if (!pc.classList.contains('joueur-mort')) {
            pc.classList.add('joueur-mort');
            pc.querySelectorAll('.allegiance-text').forEach(el => {
              el.textContent = "Déchu de Grabuge";
              (el as HTMLElement).style.cssText = "font-style: italic; opacity: 0.8;";
            });
            const pName = pc.getAttribute('data-player-name') || playerName || 'Joueur Inconnu';
            window.dispatchEvent(new CustomEvent('rs_player_fully_eliminated', { detail: { playerName: pName } }));
          }
        }

        checkVictoryConditions(onGameEnd);
      }, 650);
    }
  };

  const removeExtraLife = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDismissingRef.current) return;
    isDismissingRef.current = true;
    setShowActions(false);
    setIsDismissing(true);
    setTimeout(() => {
      if (onConsumeExtraLife) {
        onConsumeExtraLife(playerName || '', cardIndex);
      }
      setIsDismissing(false);
      isDismissingRef.current = false;
    }, 300);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isForcedDisabled) return;
    const isDeadNow = effectiveDead || badgeRef.current?.classList.contains('role-mort');
    if (customOnClick) {
      customOnClick(card, isDeadNow);
      return;
    }
    if (natureChildMode || isGentlemanChoosing || isBerserkerChoosing) return;
    
    if (isDeadNow) {
      setShowActions(false);
      setShowReviveActions(prev => !prev);
      return;
    }

    if (isForcedTarget) {
      setShowReviveActions(false);
      setShowActions(true);
      return;
    }
    
    if (!isPlaying || !hasPlayedNight1 || isFinished) return;

    if (hasActiveExtraLife && !isLifeCard) {
      setShowReviveActions(false);
      setShowActions(false);
      if (onBlockedExtraLife) {
        onBlockedExtraLife(playerName || 'Ce joueur');
      }
      return;
    }

    setShowReviveActions(false);
    setShowActions(true);
  };

  return (
    <div 
      className="relative group inline-block role-badge-container cursor-pointer select-none"
      onClick={handleClick}
    >
      <span 
        ref={badgeRef}
        className={`role-badge px-2 py-1 rounded border text-sm font-medium transition-all duration-300 ${isDismissing ? 'opacity-0 scale-50 -translate-y-2 pointer-events-none' : ''} ${effectiveDead ? 'role-mort' : ''} ${effectiveGhost ? 'tue-par-fantome' : ''} ${isSelected ? 'ring-2 ring-emerald-400 font-bold scale-105 shadow-[0_0_10px_rgba(52,211,153,0.5)]' : ''} ${isForcedTarget ? 'ring-4 ring-amber-400 font-bold scale-110 shadow-[0_0_20px_rgba(251,191,36,0.9)] animate-pulse' : ''} ${isBerserkerTarget ? 'ring-4 ring-rose-500 font-bold scale-110 shadow-[0_0_20px_rgba(244,63,94,0.9)] animate-pulse' : ''} ${isLifeCard ? colors.LIFE : (colors[type] || colors.I)}`}
      >
        {card}
      </span>
      {showActions && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute -top-8 left-1/2 -translate-x-1/2 flex gap-1 bg-black/90 p-1 rounded-lg border border-gray-700 z-50 shadow-xl animate-in fade-in zoom-in duration-200"
        >
          {isLifeCard ? (
            <>
              <button 
                type="button" 
                onClick={removeExtraLife} 
                className="p-1 hover:bg-green-900/50 rounded-full text-green-400 transition-colors cursor-pointer" 
                title="Retirer la vie en plus (✅)"
              >
                <Check size={14} />
              </button>
              <button 
                type="button" 
                onClick={(e) => { e.stopPropagation(); setShowActions(false); }} 
                className="p-1 hover:bg-red-900/50 rounded-full text-red-400 transition-colors cursor-pointer" 
                title="Annuler (❌)"
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <>
              <button onClick={(e) => kill(e, true)} className="p-1 hover:bg-blue-900/50 rounded-full text-white text-xs leading-none flex items-center justify-center w-5 h-5" title="Éliminer par Rituel Fantôme (👻)">👻</button>
              <button onClick={(e) => kill(e)} className="p-1 hover:bg-green-900/50 rounded-full text-green-400" title="Éliminer (✅)"><Check size={14} /></button>
              <button onClick={(e) => { e.stopPropagation(); setShowActions(false); }} className="p-1 hover:bg-red-900/50 rounded-full text-red-400" title="Annuler"><X size={14} /></button>
            </>
          )}
        </div>
      )}
      {showReviveActions && (
        <div 
          onClick={(e) => e.stopPropagation()} 
          className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-neutral-900 border-2 border-emerald-500/90 p-1 rounded-xl z-50 shadow-2xl whitespace-nowrap animate-in fade-in zoom-in duration-150"
        >
          <button 
            type="button" 
            onClick={(e) => { 
              e.stopPropagation(); 
              setShowReviveActions(false); 
            }} 
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-700/80 text-red-300 hover:text-white transition-colors cursor-pointer" 
            title="Annuler (garder la carte éliminée)"
          >
            <X size={16} />
          </button>
          <button 
            type="button" 
            onClick={(e) => {
              e.stopPropagation();
              setShowReviveActions(false);
              const badge = badgeRef.current;
              const pc = badge?.closest('.player-card') as HTMLElement;
              if (onRequestRevive && badge && pc) {
                onRequestRevive({
                  playerName: pc.getAttribute('data-player-name') || playerName || 'Joueur Inconnu',
                  cardName: card,
                  cardIndex: cardIndex,
                  badgeEl: badge,
                  pcEl: pc
                });
              }
            }} 
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-300 hover:text-white transition-colors cursor-pointer" 
            title="Ramener cette carte en jeu"
          >
            <Check size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

const NumberControl = ({ label, value, min, max, onChange }: any) => (
  <div className="flex flex-col gap-2">
    <label className="text-sm font-bold text-gray-400 uppercase tracking-wider font-serif">{label}</label>
    <div className="flex items-center bg-gray-900 border border-gray-700 rounded-xl p-1 shadow-inner">
      <button onClick={() => onChange(Math.max(min, value - 1))} className="w-10 h-10 flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors border border-transparent hover:border-gray-600"><Minus size={18} /></button>
      <span className="flex-1 text-center text-xl font-bold text-gray-200 font-serif">{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} className="w-10 h-10 flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors border border-transparent hover:border-gray-600"><Plus size={18} /></button>
    </div>
  </div>
);

const TIME_EXTENDING_ROLES = ['Guérisseur', 'Omniscient', 'Super voyant', 'Mineur', 'Parent', 'Enfant de la nature'];

const typeColors: Record<string, string> = {
  R: 'bg-orange-950/80 text-orange-300 border-orange-700/80',
  F: 'bg-cyan-950/80 text-cyan-300 border-cyan-700/80',
  S: 'bg-purple-950/80 text-purple-300 border-purple-700/80',
  I: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80',
  LIFE: 'bg-red-950/80 text-red-300 border-red-700/80'
};

const typeLabels: Record<string, string> = {
  R: 'Renard',
  F: 'Fantôme',
  S: 'Solo',
  I: 'Innocent',
  LIFE: '+1 Vie'
};

const applyDependencyRules = (
  currentCounts: Record<string, number>,
  targetCard?: string,
  targetCount?: number
): Record<string, number> => {
  const next = { ...currentCounts };
  if (targetCard !== undefined && targetCount !== undefined) {
    next[targetCard] = targetCount;

    // Upward propagation: if enabling a card, ensure prerequisites are met
    if (targetCard === 'Chasseur de prime' && targetCount > 0) {
      if ((next['Chef des renards'] ?? 0) === 0) next['Chef des renards'] = 1;
      if ((next['Chef des fantômes'] ?? 0) === 0) next['Chef des fantômes'] = 1;
    }
    if (targetCard === 'Tueur à gage' && targetCount > 0) {
      if ((next['Protecteur'] ?? 0) === 0) next['Protecteur'] = 1;
      if ((next['Chasseur de prime'] ?? 0) === 0) next['Chasseur de prime'] = 1;
      if ((next['Chef des renards'] ?? 0) === 0) next['Chef des renards'] = 1;
      if ((next['Chef des fantômes'] ?? 0) === 0) next['Chef des fantômes'] = 1;
    }
    if ((targetCard === 'Elfe' || targetCard === 'Nain') && targetCount > 0) {
      next['Elfe'] = 1;
      next['Nain'] = 1;
    }
    if ((targetCard === 'Elfe' || targetCard === 'Nain') && targetCount === 0) {
      next['Elfe'] = 0;
      next['Nain'] = 0;
    }
  }

  // Downward propagation:
  // If either Chef is 0, Chasseur de prime cannot be in play
  const chefRenards = next['Chef des renards'] ?? 0;
  const chefFantomes = next['Chef des fantômes'] ?? 0;
  if (chefRenards === 0 || chefFantomes === 0) {
    next['Chasseur de prime'] = 0;
  }

  // If Protecteur or Chasseur de prime is 0, Tueur à gage cannot be in play
  const protecteur = next['Protecteur'] ?? 0;
  const chasseur = next['Chasseur de prime'] ?? 0;
  if (protecteur === 0 || chasseur === 0) {
    next['Tueur à gage'] = 0;
  }

  // If Elfe or Nain is 0, both must be 0
  const elfe = next['Elfe'] ?? 0;
  const nain = next['Nain'] ?? 0;
  if (elfe === 0 || nain === 0) {
    next['Elfe'] = 0;
    next['Nain'] = 0;
  }

  return next;
};

const getCardDependencyNote = (cardName: string, counts: Record<string, number>): string | null => {
  const chefRenards = counts['Chef des renards'] ?? 0;
  const chefFantomes = counts['Chef des fantômes'] ?? 0;
  const protecteur = counts['Protecteur'] ?? 0;
  const chasseur = counts['Chasseur de prime'] ?? 0;
  const elfe = counts['Elfe'] ?? 0;
  const nain = counts['Nain'] ?? 0;

  if (cardName === 'Chasseur de prime') {
    if (chefRenards === 0 || chefFantomes === 0) {
      return "🔒 Désactivé : requiert le Chef des renards & Chef des fantômes";
    }
    return "🔗 Lié aux 2 Chefs (Renards & Fantômes)";
  }
  if (cardName === 'Tueur à gage') {
    if (protecteur === 0 || chasseur === 0) {
      return "🔒 Désactivé : requiert le Protecteur & Chasseur de prime";
    }
    return "🔗 Lié au Protecteur & Chasseur de prime";
  }
  if (cardName === 'Chef des renards' || cardName === 'Chef des fantômes') {
    return "ℹ️ Si retiré, le Chasseur de prime & Tueur à gage sont exclus";
  }
  if (cardName === 'Protecteur') {
    return "ℹ️ Si retiré, le Tueur à gage est exclu";
  }
  if (cardName === 'Elfe') {
    if (nain === 0) return "🔒 Doit être en duo avec le Nain (présents ou exclus ensemble)";
    return "🔗 Duo inséparable avec le Nain";
  }
  if (cardName === 'Nain') {
    if (elfe === 0) return "🔒 Doit être en duo avec l'Elfe (présents ou exclus ensemble)";
    return "🔗 Duo inséparable avec l'Elfe";
  }
  return null;
};

const CardCounterItem: React.FC<{
  cardName: string;
  defaultMax: number;
  count: number;
  type: string;
  depNote: string | null;
  onChange: (newCount: number) => void;
}> = ({ cardName, defaultMax, count, type, depNote, onChange }) => {
  const isExcluded = count === 0;
  const isReduced = count < defaultMax && count > 0;
  const displayName = cardName;

  return (
    <div className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
      isExcluded 
        ? 'bg-neutral-950/80 border-red-950/70 opacity-60' 
        : isReduced 
          ? 'bg-neutral-900 border-amber-700/60 shadow-md' 
          : 'bg-neutral-900/90 border-neutral-800 hover:border-neutral-700'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-serif font-bold text-sm ${isExcluded ? 'line-through text-gray-500' : 'text-gray-100'}`}>
              {displayName}
            </span>
            <span className={`text-[10px] font-sans uppercase font-bold px-1.5 py-0.5 rounded border ${typeColors[type] || typeColors.I}`}>
              {typeLabels[type] || 'Innocent'}
            </span>
          </div>
          {depNote && (
            <span className={`text-[11px] font-sans block leading-tight ${depNote.startsWith('🔒') ? 'text-red-400 font-semibold' : 'text-amber-400/90 italic'}`}>
              {depNote}
            </span>
          )}
        </div>
        {isExcluded && (
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800 font-sans shrink-0">
            Exclu
          </span>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-neutral-800/80">
        <span className="text-xs font-sans text-gray-400">
          Exemplaires : <strong className={isExcluded ? 'text-red-400' : isReduced ? 'text-amber-400' : 'text-gray-200'}>{count}</strong> / {defaultMax}
        </span>
        <div className="flex items-center gap-1 bg-neutral-950 rounded-lg p-0.5 border border-neutral-800">
          <button
            type="button"
            disabled={count <= 0}
            onClick={() => onChange(count - 1)}
            className="w-7 h-7 flex items-center justify-center rounded bg-neutral-800 hover:bg-neutral-700 text-gray-200 disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Diminuer"
          >
            <Minus size={14} />
          </button>
          <span className={`w-6 text-center font-mono font-bold text-sm ${isExcluded ? 'text-red-400' : isReduced ? 'text-amber-400' : 'text-gray-200'}`}>
            {count}
          </span>
          <button
            type="button"
            disabled={count >= defaultMax}
            onClick={() => onChange(count + 1)}
            className="w-7 h-7 flex items-center justify-center rounded bg-neutral-800 hover:bg-neutral-700 text-gray-200 disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Augmenter"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};



// --- MAIN APP ---
export default function App() {
  const [tab, setTab] = useState('ordre');
  const [N, setN] = useState(4);
  const [C, setC] = useState(3);
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    try {
      localStorage.removeItem('rs_custom_logo');
    } catch (_) {}
  }, []);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showNight, setShowNight] = useState(false);
  const ORDRE_NUIT = ['Parent', 'Enfant de la nature', 'Omniscient', 'Renard', 'Fantôme', 'Alchimiste', 'Sorcier de glace', 'Protecteur', 'Magicien', 'Mineur', 'Super voyant'];
  const [potions, setPotions] = useState({ heal: 2, death: 2 });
  const [nightPotionsUsed, setNightPotionsUsed] = useState({ heal: false, death: false });
  const [checkedRoles, setCheckedRoles] = useState<string[]>([]);
  const [nightCount, setNightCount] = useState(1);

  useEffect(() => {
    setNightPotionsUsed({ heal: false, death: false });
  }, [nightCount]);

  // --- EFFETS SONORES (SFX) ---
  const [sfxSettings, setSfxSettings] = useState<{
    enabled: boolean;
    playerEliminated: boolean; // Rire narquois de Grabuge
    foxEliminated: boolean;    // Cri / son d'élimination Renard
    ghostEliminated: boolean;  // Écho spectral / son d'élimination Fantôme
  }>(() => {
    try {
      const saved = localStorage.getItem('rs_sfx_settings');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      enabled: true,
      playerEliminated: true,
      foxEliminated: true,
      ghostEliminated: true,
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem('rs_sfx_settings', JSON.stringify(sfxSettings));
    } catch (_) {}
  }, [sfxSettings]);

  const lastSfxTriggerRef = useRef<{ [key: string]: number }>({});

  const triggerSfx = useCallback((type: 'renards' | 'fantomes' | 'grabuge' | 'renard' | 'fantome') => {
    if (!sfxSettings.enabled) return;
    const now = Date.now();
    const normalizedKey = (type === 'renards' || type === 'renard') ? 'renard' : (type === 'fantomes' || type === 'fantome') ? 'fantome' : 'grabuge';
    if (now - (lastSfxTriggerRef.current[normalizedKey] || 0) < 500) {
      return; // Éviter les déclenchements multiples en rafale
    }
    lastSfxTriggerRef.current[normalizedKey] = now;

    if (normalizedKey === 'renard' && sfxSettings.foxEliminated) {
      playRenard();
    } else if (normalizedKey === 'fantome' && sfxSettings.ghostEliminated) {
      playFantome();
    } else if (normalizedKey === 'grabuge' && sfxSettings.playerEliminated) {
      playGrabuge();
    }
  }, [sfxSettings]);

  const triggerSfxRef = useRef(triggerSfx);
  useEffect(() => {
    triggerSfxRef.current = triggerSfx;
  }, [triggerSfx]);
  const [hasPlayedNight1, setHasPlayedNight1] = useState(false);
  const [isConfirmingStop, setIsConfirmingStop] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isNamingGame, setIsNamingGame] = useState(false);
  const [gameName, setGameName] = useState('');
  const [gameId, setGameId] = useState<string | null>(null);
  const [savedGames, setSavedGames] = useState<any[]>(() => {
    try {
      const primary = JSON.parse(localStorage.getItem('rs_saved_games') || '[]');
      if (Array.isArray(primary) && primary.length > 0) return primary;
      const backup = JSON.parse(localStorage.getItem('rs_saved_games_backup') || '[]');
      if (Array.isArray(backup) && backup.length > 0) return backup;
    } catch (_) {}
    return [];
  });
  const [elapsedTime, setElapsedTime] = useState(0);
  const [gameHistory, setGameHistory] = useState<any[]>([]);
  const [showDebrief, setShowDebrief] = useState(false);
  const [showGhostRitualModal, setShowGhostRitualModal] = useState(false);
  const [reviveCandidate, setReviveCandidate] = useState<{
    playerName: string;
    cardName: string;
    cardIndex?: number;
    badgeEl: HTMLElement;
    pcEl: HTMLElement;
  } | null>(null);
  const [extraLifeBlockedPlayer, setExtraLifeBlockedPlayer] = useState<string | null>(null);
  const [gentlemanGiver, setGentlemanGiver] = useState<string | null>(null);
  const [gentlemanStep, setGentlemanStep] = useState<'intro' | 'choosing' | null>(null);
  const [candidateGentlemanTarget, setCandidateGentlemanTarget] = useState<any | null>(null);
  const [elfDwarfEvent, setElfDwarfEvent] = useState<{
    eliminatedRole: 'Elfe' | 'Nain';
    eliminatedPlayerName: string;
    partnerRole: 'Elfe' | 'Nain';
    partnerPlayerName: string;
  } | null>(null);
  const [elfDwarfUsed, setElfDwarfUsed] = useState(false);
  const elfDwarfUsedRef = useRef(false);
  elfDwarfUsedRef.current = elfDwarfUsed;
  const [berserkerEvent, setBerserkerEvent] = useState<{
    playerName: string;
    playerId?: number;
    cardIndex: number;
  } | null>(null);
  const [berserkerStep, setBerserkerStep] = useState<'popup' | 'choosing' | null>(null);
  const [candidateBerserkerTarget, setCandidateBerserkerTarget] = useState<{
    player: any;
    cardIndex: number;
    cardName: string;
  } | null>(null);
  const [berserkerNoEffectPlayer, setBerserkerNoEffectPlayer] = useState<string | null>(null);
  const [berserkerWrongCardToast, setBerserkerWrongCardToast] = useState<string | null>(null);
  const [showSuperVoyantModal, setShowSuperVoyantModal] = useState(false);
  const [superVoyantTarget, setSuperVoyantTarget] = useState<{
    playerName: string;
    allegiance: 'Renard' | 'Fantôme';
    notFound?: boolean;
  } | null>(null);
  // Parent & 2 Enfants
  const [showParentModal, setShowParentModal] = useState(false);
  const [tempParentChildren, setTempParentChildren] = useState<number[]>([]);
  const [parentChildren, setParentChildren] = useState<number[]>([]); // [id1, id2]
  const [pendingParentTargetLoss, setPendingParentTargetLoss] = useState<{
    triggerChildName: string;
    partnerChildName: string;
    partnerPlayerId: number;
    triggerRole: string;
    targetCardIndex: number;
    targetCardName: string;
  } | null>(null);
  const [forcedParentCardLossChild, setForcedParentCardLossChild] = useState<{
    playerId: number;
    playerName: string;
    targetCardIndex: number;
    targetCardName: string;
  } | null>(null);
  const [parentBondBroken, setParentBondBroken] = useState(false);

  const parentChildrenRef = useRef<number[]>([]);
  useEffect(() => { parentChildrenRef.current = parentChildren; }, [parentChildren]);

  const parentBondBrokenRef = useRef(false);
  useEffect(() => { parentBondBrokenRef.current = parentBondBroken; }, [parentBondBroken]);

  const pendingParentTargetLossRef = useRef<any>(null);
  useEffect(() => { pendingParentTargetLossRef.current = pendingParentTargetLoss; }, [pendingParentTargetLoss]);

  const queuedBerserkerEventsRef = useRef<{ playerName: string; playerId?: number; cardIndex: number }[]>([]);

  useEffect(() => {
    // Si Parent ou autre étape prioritaire a terminé et qu'aucune étape Berserker n'est active, afficher le Berserker en attente
    if (!pendingParentTargetLoss && !forcedParentCardLossChild && !elfDwarfEvent && !gentlemanStep && !berserkerStep && queuedBerserkerEventsRef.current.length > 0) {
      const nextEvent = queuedBerserkerEventsRef.current.shift();
      if (nextEvent) {
        setBerserkerEvent(nextEvent);
        setBerserkerStep('popup');
      }
    }
  }, [pendingParentTargetLoss, forcedParentCardLossChild, elfDwarfEvent, gentlemanStep, berserkerStep]);

  useEffect(() => {
    if (berserkerWrongCardToast) {
      const t = setTimeout(() => {
        setBerserkerWrongCardToast(null);
      }, 3500);
      return () => clearTimeout(t);
    }
  }, [berserkerWrongCardToast]);

  const forcedParentCardLossChildRef = useRef<{
    playerId: number;
    playerName: string;
    targetCardIndex: number;
    targetCardName: string;
  } | null>(null);
  useEffect(() => { forcedParentCardLossChildRef.current = forcedParentCardLossChild; }, [forcedParentCardLossChild]);

  const resRef = useRef<any>(null);
  useEffect(() => { resRef.current = res; }, [res]);

  const gameHistoryRef = useRef<any[]>([]);
  useEffect(() => { gameHistoryRef.current = gameHistory; }, [gameHistory]);
  const [hasPendingVictory, setHasPendingVictory] = useState(false);
  const [pendingVictoryTitles, setPendingVictoryTitles] = useState<string[]>([]);
  const [exclusionModalStep, setExclusionModalStep] = useState<'none' | 'warning' | 'list'>('none');
  const [exclusionModalErr, setExclusionModalErr] = useState('');
  const [customDeckCounts, setCustomDeckCounts] = useState<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    DECK_DEF.forEach(d => { counts[d.n] = d.c; });
    return counts;
  });

  const totalActiveCards = useMemo(() => {
    return Object.values(customDeckCounts).reduce((a: number, b: number) => a + b, 0);
  }, [customDeckCounts]);

  const excludedCardsCount = useMemo(() => {
    return DECK_DEF.reduce((acc, d) => {
      const cur = customDeckCounts[d.n] ?? d.c;
      return acc + (d.c - cur);
    }, 0);
  }, [customDeckCounts]);

  const resetDeckCounts = () => {
    const counts: Record<string, number> = {};
    DECK_DEF.forEach(d => { counts[d.n] = d.c; });
    setCustomDeckCounts(counts);
    setExclusionModalErr('');
  };

  const handleCardCountChange = (cardName: string, newCount: number) => {
    setExclusionModalErr('');
    setCustomDeckCounts(prev => {
      const cardDef = DECK_DEF.find(d => d.n === cardName);
      const maxCount = cardDef?.c || 1;
      const clamped = Math.max(0, Math.min(maxCount, newCount));
      return applyDependencyRules(prev, cardName, clamped);
    });
  };

  // Compteur et historique des sacrifices du Rituel des Fantômes
  const ghostKills = useMemo(() => {
    return (gameHistory || []).filter((h: any) => h.isGhostKill);
  }, [gameHistory]);

  const ghostInnocentsCount = useMemo(() => {
    return ghostKills.filter((h: any) => getType(h.originalRole) === 'I').length;
  }, [ghostKills]);

  const ghostRenardsCount = useMemo(() => {
    return ghostKills.filter((h: any) => getType(h.originalRole) === 'R').length;
  }, [ghostKills]);

  const ghostFantomesCount = useMemo(() => {
    return ghostKills.filter((h: any) => getType(h.originalRole) === 'F').length;
  }, [ghostKills]);

  // Enfant de la nature
  const [natureChildPlayerId, setNatureChildPlayerId] = useState<number | null>(null);
  const [natureChildMaster, setNatureChildMaster] = useState<number | null>(null);
  const [hasStolenMasterCard, setHasStolenMasterCard] = useState(false);
  const [natureChildMode, setNatureChildMode] = useState<'choose_master' | 'steal_card' | null>(null);
  const [natureChildPopup, setNatureChildPopup] = useState<'choose_intro' | 'steal_intro' | 'master_dead' | 'steal_success' | null>(null);
  const [candidateMaster, setCandidateMaster] = useState<any | null>(null);
  const [selectedChildCard, setSelectedChildCard] = useState<string | null>(null);
  const [selectedMasterCard, setSelectedMasterCard] = useState<string | null>(null);
  const [pendingChildCard, setPendingChildCard] = useState<string | null>(null);
  const [pendingMasterCard, setPendingMasterCard] = useState<string | null>(null);
  
  // Audio
  const [play, setPlay] = useState(false);
  const [track, setTrack] = useState('Aucune');
  const [volume, setVolume] = useState(0.5);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentPlaylistId, setCurrentPlaylistId] = useState<string>('ancienne-musique');
  const [playingPlaylistId, setPlayingPlaylistId] = useState<string | null>('ancienne-musique');

  // Morceaux détectés dynamiquement depuis le système de fichiers ou pré-chargés
  const [scannedFiles, setScannedFiles] = useState<ScannedPlaylistsData>(DEFAULT_SCANNED_AUDIO);
  const [isRefreshingAudio, setIsRefreshingAudio] = useState(false);

  const refreshAudioScan = useCallback(async () => {
    setIsRefreshingAudio(true);
    try {
      const res = await fetch(`/api/audio-files?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && (data['playlist-1'] || data['playlist-2'])) {
          setScannedFiles(prev => ({ ...prev, ...data }));
          setIsRefreshingAudio(false);
          return;
        }
      }
    } catch (_) {}

    try {
      const staticRes = await fetch(`/audio/playlists.json?t=${Date.now()}`, { cache: 'no-store' });
      if (staticRes.ok) {
        const staticData = await staticRes.json();
        if (staticData && (staticData['playlist-1'] || staticData['playlist-2'])) {
          setScannedFiles(prev => ({ ...prev, ...staticData }));
        }
      }
    } catch (_) {}
    setIsRefreshingAudio(false);
  }, []);

  useEffect(() => {
    refreshAudioScan();
  }, [refreshAudioScan]);

  useEffect(() => {
    if (tab === 'audio') {
      refreshAudioScan();
      const interval = setInterval(refreshAudioScan, 3000);
      return () => clearInterval(interval);
    }
  }, [tab, refreshAudioScan]);

  // Génération dynamique des pistes de 1 à 10 pour le mode Plug and Play avec tri numérique strict
  const generatePlaylistTracks = (folderId: string, trackCount = 10) => {
    const list: { num: number; name: string; url: string }[] = [];
    for (let i = 1; i <= trackCount; i++) {
      list.push({
        num: i,
        name: `Piste ${i}`,
        url: `/audio/${folderId}/${i}.mp3`,
      });
    }
    // Tri numérique strict pour garantir que 1 se joue avant 2, 2 avant 3, etc.
    list.sort((a, b) => a.num - b.num);
    return list;
  };

  const playlist1Tracks = useMemo(() => {
    if (scannedFiles['playlist-1'] && scannedFiles['playlist-1'].length > 0) {
      return scannedFiles['playlist-1'];
    }
    return generatePlaylistTracks('playlist-1', 10);
  }, [scannedFiles]);

  const playlist2Tracks = useMemo(() => {
    if (scannedFiles['playlist-2'] && scannedFiles['playlist-2'].length > 0) {
      return scannedFiles['playlist-2'];
    }
    return generatePlaylistTracks('playlist-2', 10);
  }, [scannedFiles]);

  const PLAYLISTS = useMemo(() => [
    {
      id: 'playlist-1',
      name: 'Playlist 1',
      tracks: playlist1Tracks.map(t => t.name),
      trackUrls: Object.fromEntries(playlist1Tracks.map(t => [t.name, t.url])) as Record<string, string>,
    },
    {
      id: 'playlist-2',
      name: 'Playlist 2',
      tracks: playlist2Tracks.map(t => t.name),
      trackUrls: Object.fromEntries(playlist2Tracks.map(t => [t.name, t.url])) as Record<string, string>,
    },
    {
      id: 'ancienne-musique',
      name: 'Ancienne musique',
      tracks: ['Ambiance Forêt', 'Tension Village', 'Traque'],
      trackUrls: {
        'Ambiance Forêt': '/ambiance-foret.mp4',
        'Tension Village': '/Tension-village-1.mp4',
        'Traque': '/Traque.MP3',
      } as Record<string, string>,
    },
  ], [playlist1Tracks, playlist2Tracks]);

  // Détermination automatique et dynamique de la source audio active
  const currentAudioSrc = useMemo(() => {
    if (!track || track === 'Aucune') return undefined;

    const activePl = PLAYLISTS.find(p => p.id === playingPlaylistId)
      || PLAYLISTS.find(p => p.tracks.includes(track));

    if (activePl && activePl.trackUrls && activePl.trackUrls[track]) {
      return encodeURI(activePl.trackUrls[track]);
    }

    // Fallback dynamique direct
    if (playingPlaylistId === 'playlist-1' || playingPlaylistId === 'playlist-2') {
      const match = track.match(/\d+/);
      if (match) {
        return encodeURI(`/audio/${playingPlaylistId}/${parseInt(match[0], 10)}.mp3`);
      }
      if (activePl) {
        const idx = activePl.tracks.indexOf(track);
        if (idx !== -1) {
          const trackList = playingPlaylistId === 'playlist-1' ? playlist1Tracks : playlist2Tracks;
          if (trackList[idx]?.url) return encodeURI(trackList[idx].url);
        }
      }
    }

    if (track === 'Ambiance Forêt') return '/ambiance-foret.mp4';
    if (track === 'Tension Village') return '/Tension-village-1.mp4';
    if (track === 'Traque') return '/Traque.MP3';

    return undefined;
  }, [track, playingPlaylistId, PLAYLISTS, playlist1Tracks, playlist2Tracks]);

  const handleTrackEnded = () => {
    const activePl = PLAYLISTS.find(p => p.id === playingPlaylistId) 
      || PLAYLISTS.find(p => p.tracks.includes(track));

    if (activePl && activePl.tracks.length > 0) {
      const currentIndex = activePl.tracks.indexOf(track);
      if (currentIndex !== -1 && currentIndex + 1 < activePl.tracks.length) {
        // Enchaîne automatiquement sur le morceau suivant dans l'ordre strict
        const nextTrack = activePl.tracks[currentIndex + 1];
        setTrack(nextTrack);
        setPlay(true);
        return;
      }
    }
    // Fin de playlist : arrêt
    setPlay(false);
  };

  const handlePlayPlaylist = (playlistId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const pl = PLAYLISTS.find(p => p.id === playlistId);
    if (!pl || pl.tracks.length === 0) return;

    setCurrentPlaylistId(playlistId);

    if (playingPlaylistId === playlistId && pl.tracks.includes(track)) {
      setPlay(!play);
      return;
    }

    setPlayingPlaylistId(playlistId);
    setTrack(pl.tracks[0]);
    setPlay(true);
  };

  const handleSelectTrack = (playlistId: string, trackName: string) => {
    if (playingPlaylistId === playlistId && track === trackName) {
      setPlay(!play);
    } else {
      setPlayingPlaylistId(playlistId);
      setTrack(trackName);
      setPlay(true);
    }
  };

  const handleNextTrack = () => {
    const activePl = PLAYLISTS.find(p => p.id === playingPlaylistId)
      || PLAYLISTS.find(p => p.tracks.includes(track));
    if (!activePl || activePl.tracks.length === 0) return;
    const currentIndex = activePl.tracks.indexOf(track);
    if (currentIndex !== -1 && currentIndex + 1 < activePl.tracks.length) {
      setTrack(activePl.tracks[currentIndex + 1]);
      setPlay(true);
    }
  };

  const handlePrevTrack = () => {
    const activePl = PLAYLISTS.find(p => p.id === playingPlaylistId)
      || PLAYLISTS.find(p => p.tracks.includes(track));
    if (!activePl || activePl.tracks.length === 0) return;
    const currentIndex = activePl.tracks.indexOf(track);
    if (currentIndex > 0) {
      setTrack(activePl.tracks[currentIndex - 1]);
      setPlay(true);
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      if (play && track !== 'Aucune' && currentAudioSrc) {
        audioRef.current.play().catch(e => console.log("Audio play error:", e));
      } else {
        audioRef.current.pause();
      }
    }
  }, [play, track, currentAudioSrc]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setProgress(newTime);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const formatChrono = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const gameStateRef = useRef<any>(null);
  useEffect(() => {
    gameStateRef.current = { 
      isPlaying, gameId, res, gameName, N, C, nightCount, hasPlayedNight1, potions, 
      elapsedTime, gameHistory, isFinished, natureChildMaster, hasStolenMasterCard, natureChildPlayerId,
      elfDwarfUsed, superVoyantTarget, parentChildren, parentBondBroken,
      berserkerEvent, berserkerStep
    };
  }, [isPlaying, gameId, res, gameName, N, C, nightCount, hasPlayedNight1, potions, elapsedTime, gameHistory, isFinished, natureChildMaster, hasStolenMasterCard, natureChildPlayerId, elfDwarfUsed, superVoyantTarget, parentChildren, parentBondBroken, berserkerEvent, berserkerStep]);

  const saveCurrentGameRef = useRef(() => {});
  saveCurrentGameRef.current = () => {
    const state = gameStateRef.current;
    if (!state || !state.isPlaying || !state.gameId || !state.res) return;
    
    const domState = state.res.map((p: any, i: number) => {
      const pc = document.querySelectorAll('.player-card')[i];
      if (!pc) return null;
      
      const isDead = pc.classList.contains('joueur-mort');
      const rawAllegiance = pc.querySelector('.allegiance-text')?.textContent?.replace('Allégeance : ', '').trim() || p.allegiance;
      const allegianceText = (!rawAllegiance || rawAllegiance === 'Déchu de Grabuge') ? p.allegiance : rawAllegiance;
      
      const cardsState = Array.from(pc.querySelectorAll('.role-badge')).map(badge => ({
        isDead: badge.classList.contains('role-mort'),
        isGhostKill: badge.classList.contains('tue-par-fantome'),
        deathTurn: badge.getAttribute('data-death-turn')
      }));
      
      return { isDead, allegiance: allegianceText, cardsState };
    });

    try {
      let games: any[] = [];
      try {
        const parsed = JSON.parse(localStorage.getItem('rs_saved_games') || '[]');
        if (Array.isArray(parsed)) games = parsed;
      } catch (_) {}
      if (games.length === 0) {
        try {
          const backup = JSON.parse(localStorage.getItem('rs_saved_games_backup') || '[]');
          if (Array.isArray(backup)) games = backup;
        } catch (_) {}
      }

      const existingIdx = games.findIndex((g: any) => g.id === state.gameId);
      
      const gameData = {
        id: state.gameId,
        name: state.gameName,
        date: new Date().toISOString(),
        state: { 
          res: state.res, 
          N: state.N, 
          C: state.C, 
          nightCount: state.nightCount, 
          hasPlayedNight1: state.hasPlayedNight1, 
          potions: state.potions, 
          domState,
          elapsedTime: state.elapsedTime,
          gameHistory: state.gameHistory || [],
          isFinished: state.isFinished || false,
          natureChildMaster: state.natureChildMaster,
          hasStolenMasterCard: state.hasStolenMasterCard,
          natureChildPlayerId: state.natureChildPlayerId,
          elfDwarfUsed: state.elfDwarfUsed || false,
          superVoyantTarget: state.superVoyantTarget || null,
          parentChildren: state.parentChildren || [],
          parentBondBroken: state.parentBondBroken || false,
          berserkerEvent: state.berserkerEvent || null,
          berserkerStep: state.berserkerStep || null
        }
      };

      if (existingIdx > -1) {
        games[existingIdx] = gameData;
      } else {
        games.unshift(gameData);
      }
      
      // Toujours conserver strictement et fidèlement les 2 dernières parties
      const trimmedGames = games.slice(0, 2);
      
      const serialized = JSON.stringify(trimmedGames);
      localStorage.setItem('rs_saved_games', serialized);
      localStorage.setItem('rs_saved_games_backup', serialized);
      setSavedGames(trimmedGames);
    } catch (e) {
      console.error("Failed to save game to localStorage", e);
    }
  };

  const handleGameEndRef = useRef<() => void>(() => {});
  handleGameEndRef.current = () => {
    saveCurrentGameRef.current();
    setRes(null);
    setIsPlaying(false);
    setIsFinished(false);
    setIsConfirmingStop(false);
    setGameId(null);
    setElapsedTime(0);
    setGameHistory([]);
    setPotions({ heal: 2, death: 2 });
    setNightCount(1);
    setHasPlayedNight1(false);
    setCheckedRoles([]);
    setNatureChildPlayerId(null);
    setNatureChildMaster(null);
    setHasStolenMasterCard(false);
    setNatureChildMode(null);
    setNatureChildPopup(null);
    setCandidateMaster(null);
    setSelectedChildCard(null);
    setSelectedMasterCard(null);
    setPendingChildCard(null);
    setPendingMasterCard(null);
    setShowGhostRitualModal(false);
    setReviveCandidate(null);
    setExtraLifeBlockedPlayer(null);
    setGentlemanGiver(null);
    setGentlemanStep(null);
    setCandidateGentlemanTarget(null);
    setElfDwarfEvent(null);
    setElfDwarfUsed(false);
    elfDwarfUsedRef.current = false;
    setHasPendingVictory(false);
    setPendingVictoryTitles([]);
    setSuperVoyantTarget(null);
    setShowSuperVoyantModal(false);
    setShowParentModal(false);
    setParentChildren([]);
    setPendingParentTargetLoss(null);
    setForcedParentCardLossChild(null);
    setBerserkerEvent(null);
    setBerserkerStep(null);
    setCandidateBerserkerTarget(null);
    setBerserkerNoEffectPlayer(null);
    setBerserkerWrongCardToast(null);
    setParentBondBroken(false);
  };

  const elapsedTimeRef = useRef(0);
  useEffect(() => { elapsedTimeRef.current = elapsedTime; }, [elapsedTime]);

  useEffect(() => {
    const handleVictoryAvailable = (e: any) => {
      setHasPendingVictory(!!e.detail?.available);
      setPendingVictoryTitles(e.detail?.titles || []);
    };
    window.addEventListener('rs_victory_available', handleVictoryAvailable);
    return () => window.removeEventListener('rs_victory_available', handleVictoryAvailable);
  }, []);

  // Sync victory state whenever the board is active or eliminations change
  useEffect(() => {
    if (!showNight && isPlaying && hasPlayedNight1 && !isFinished) {
      const { titles } = evaluateVictory();
      setHasPendingVictory(titles.length > 0);
      setPendingVictoryTitles(titles);
    } else {
      setHasPendingVictory(false);
      setPendingVictoryTitles([]);
    }
  }, [gameHistory, showNight, isPlaying, hasPlayedNight1, isFinished]);

  // Check victory conditions upon waking up / returning to board
  useEffect(() => {
    if (!showNight && !natureChildMode && !isFinished && res) {
      const timer = setTimeout(() => {
        checkVictoryConditions(handleGameEndRef.current);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [showNight, isPlaying, hasPlayedNight1, natureChildMode, isFinished, hasStolenMasterCard, res]);

  const lastExtraLifeAddedRef = useRef<{ playerName: string, time: number }>({ playerName: '', time: 0 });

  const handleAddExtraLife = (playerName: string) => {
    const now = Date.now();
    if (lastExtraLifeAddedRef.current.playerName === playerName && (now - lastExtraLifeAddedRef.current.time) < 1200) {
      return;
    }
    lastExtraLifeAddedRef.current = { playerName, time: now };

    setRes((prev: any) => {
      if (!prev) return prev;
      return prev.map((p: any) => {
        if (p.name === playerName) {
          const newLifeId = `life_${p.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          const currentIds = p.cardIds && p.cardIds.length === p.cards.length
            ? [...p.cardIds]
            : p.cards.map((c: string, i: number) => `card_${p.id}_${i}_${c}`);
          return {
            ...p,
            cards: [...p.cards, '+1 Vie'],
            cardIds: [...currentIds, newLifeId]
          };
        }
        return p;
      });
    });
    setTimeout(() => {
      saveCurrentGameRef.current();
    }, 200);
  };

  const handleConsumeExtraLife = (playerName: string, cardIndex?: number) => {
    setRes((prev: any) => {
      if (!prev) return prev;
      return prev.map((player: any) => {
        if (player.name === playerName) {
          const newCards = [...player.cards];
          const newCardIds = player.cardIds && player.cardIds.length === player.cards.length
            ? [...player.cardIds]
            : player.cards.map((c: string, i: number) => `card_${player.id}_${i}_${c}`);

          if (cardIndex !== undefined && newCards[cardIndex] === '+1 Vie') {
            newCards.splice(cardIndex, 1);
            if (newCardIds.length > cardIndex) newCardIds.splice(cardIndex, 1);
          } else {
            const idx = newCards.indexOf('+1 Vie');
            if (idx > -1) {
              newCards.splice(idx, 1);
              if (newCardIds.length > idx) newCardIds.splice(idx, 1);
            }
          }
          return {
            ...player,
            cards: newCards,
            cardIds: newCardIds
          };
        }
        return player;
      });
    });

    setTimeout(() => {
      const pcs = Array.from(document.querySelectorAll('.player-card'));
      const pc = pcs.find(el => el.getAttribute('data-player-name') === playerName);
      if (pc) {
        const liveBadges = pc.querySelectorAll('.role-badge:not(.role-mort)');
        if (liveBadges.length === 0) {
          pc.classList.add('joueur-mort');
          pc.querySelectorAll('.allegiance-text').forEach(el => {
            el.textContent = "Déchu de Grabuge";
            (el as HTMLElement).style.cssText = "font-style: italic; opacity: 0.8;";
          });
        } else {
          pc.classList.remove('joueur-mort');
        }
      }
      checkVictoryConditions(handleGameEndRef.current);
      saveCurrentGameRef.current();
    }, 350);
  };

  const handleGentlemanEliminated = (giverName: string) => {
    setGentlemanGiver(giverName);
    setGentlemanStep('intro');
  };

  const handleElfDwarfEliminated = (role: 'Elfe' | 'Nain', eliminatedPlayerName: string) => {
    if (!res || elfDwarfUsedRef.current) return;
    const partnerRole = role === 'Elfe' ? 'Nain' : 'Elfe';
    const partnerPlayer = res.find((p: any) => p.cards.includes(partnerRole));
    if (!partnerPlayer) return;

    // Le lien Elfe & Nain ne fonctionne qu'une seule fois : le premier qui meurt donne une vie, mais pas le second
    const wasAnyDuoDeadBefore = (gameHistory || []).some(
      (h: any) => h.originalRole === 'Elfe' || h.originalRole === 'Nain'
    );
    if (wasAnyDuoDeadBefore) return;

    const isPartnerDead = (gameHistory || []).some(
      (h: any) => h.playerName === partnerPlayer.name && h.originalRole === partnerRole
    );
    if (isPartnerDead) return;

    elfDwarfUsedRef.current = true;
    setElfDwarfUsed(true);
    setElfDwarfEvent({
      eliminatedRole: role,
      eliminatedPlayerName,
      partnerRole,
      partnerPlayerName: partnerPlayer.name
    });
  };

  const checkCardIsAlive = (player: any, cardIdx: number, history: any[]) => {
    if (!player || !player.cards || player.cards.length <= cardIdx) return false;
    const c = player.cards[cardIdx];
    if (c === '+1 Vie') return true;
    const killRecord = (history || []).find((h: any) => 
      (h.playerName === player.name || h.playerName?.trim() === player.name?.trim()) && 
      h.cardIndex !== undefined && Number(h.cardIndex) === cardIdx
    ) || (() => {
        const legacyKills = (history || []).filter((h: any) => 
          (h.playerName === player.name || h.playerName?.trim() === player.name?.trim()) && 
          (h.originalRole === c || h.originalRole?.trim() === c?.trim()) && 
          h.cardIndex === undefined
        );
        const sameTypeBefore = player.cards.slice(0, cardIdx).filter((rc: string) => 
          rc === c && !(history || []).some((h: any) => (h.playerName === player.name || h.playerName?.trim() === player.name?.trim()) && h.cardIndex !== undefined && Number(h.cardIndex) === cardIdx)
        ).length;
        return legacyKills.length > sameTypeBefore ? legacyKills[sameTypeBefore] : null;
      })();
    return !killRecord;
  };

  const hasAnyAliveCardAtRank = (cardIdx: number) => {
    if (!res) return false;
    return res.some((p: any) => {
      if (p.name === berserkerEvent?.playerName || (berserkerEvent?.playerId !== undefined && p.id === berserkerEvent?.playerId)) {
        return false;
      }
      const isPlayerDead = p.cards.length > 0 && p.cards.every((c: string, ci: number) => !checkCardIsAlive(p, ci, gameHistory));
      if (isPlayerDead) return false;
      return p.cards[cardIdx] !== '+1 Vie' && checkCardIsAlive(p, cardIdx, gameHistory);
    });
  };

  const berserkerTriggerTimeRef = useRef(0);
  const handleBerserkerEliminated = (playerName: string, cardIndex?: number) => {
    if (!res) return;
    const now = Date.now();
    if (now - berserkerTriggerTimeRef.current < 400) return;
    berserkerTriggerTimeRef.current = now;
    const p = res.find((pl: any) => pl.name === playerName || pl.name?.trim() === playerName?.trim());
    let actualIndex = cardIndex;
    if (actualIndex === undefined && p) {
      actualIndex = p.cards.indexOf('Berserker');
    }
    if (actualIndex === undefined || actualIndex < 0) {
      actualIndex = 0;
    }
    const eventData = {
      playerName,
      playerId: p?.id,
      cardIndex: actualIndex
    };

    if (pendingParentTargetLossRef.current || forcedParentCardLossChildRef.current || elfDwarfEvent || gentlemanStep || berserkerStep) {
      queuedBerserkerEventsRef.current.push(eventData);
    } else {
      setBerserkerEvent(eventData);
      setBerserkerStep('popup');
    }
  };

  const handleConfirmBerserkerElimination = () => {
    if (!candidateBerserkerTarget || !res) return;
    const { player, cardIndex: targetIdx, cardName } = candidateBerserkerTarget;

    if (cardName === '+1 Vie') {
      setCandidateBerserkerTarget(null);
      return;
    }
    const pcs = Array.from(document.querySelectorAll('.player-card'));
    const pc = pcs.find(el => el.getAttribute('data-player-name') === player.name);
    const badges = pc ? Array.from(pc.querySelectorAll('.role-badge')) : [];
    const targetBadge = badges[targetIdx] as HTMLElement;
    if (targetBadge) {
      targetBadge.classList.add('role-mort');
    }

    window.dispatchEvent(new CustomEvent('rs_player_killed', {
      detail: {
        playerId: player.id,
        playerName: player.name,
        originalRole: cardName,
        cardIndex: targetIdx,
        isGhostKill: false,
        turn: nightCount
      }
    }));

    if (cardName === 'Guérisseur') {
      handleAddExtraLife(player.name);
    } else if (cardName === 'Gentil homme') {
      handleGentlemanEliminated(player.name);
    } else if (cardName === 'Elfe') {
      handleElfDwarfEliminated('Elfe', player.name);
    } else if (cardName === 'Nain') {
      handleElfDwarfEliminated('Nain', player.name);
    } else if (cardName === 'Berserker') {
      setTimeout(() => {
        handleBerserkerEliminated(player.name, targetIdx);
      }, 500);
    }

    setCandidateBerserkerTarget(null);
    setBerserkerStep(null);
    setBerserkerEvent(null);
    checkVictoryConditions(handleGameEndRef.current);
    setTimeout(() => {
      saveCurrentGameRef.current();
    }, 350);
  };

  useEffect(() => {
    const handlePlayerKilled = (e: any) => {
      const data = e.detail;
      const deadPlayer = data.playerName;
      const currentTimerValue = elapsedTimeRef.current;
      const newEvent = { ...data, playerName: deadPlayer, time: currentTimerValue };
      const nextLog = [...(gameHistoryRef.current || []), newEvent];
      setGameHistory(nextLog);

      // Déclenchement automatique des effets sonores (Renard / Fantôme)
      const cleanRole = (data.originalRole || '').trim();
      const roleType = getType(cleanRole);
      if (roleType === 'R' || cleanRole.toLowerCase().includes('renard') || cleanRole === 'Traître') {
        triggerSfxRef.current('renards');
      } else if (roleType === 'F' || cleanRole.toLowerCase().includes('fantôme') || cleanRole.toLowerCase().includes('fantome')) {
        triggerSfxRef.current('fantomes');
      }

      // Vérifier si ce joueur vient de perdre son ultime carte et est entièrement éliminé (bruit de Grabuge)
      const playerObj = resRef.current?.find((pl: any) => pl.name === deadPlayer || pl.name?.trim() === deadPlayer);
      if (playerObj) {
        const liveCardsBefore = playerObj.cards.filter((c: string, ci: number) => c !== '+1 Vie' && checkCardIsAlive(playerObj, ci, gameHistoryRef.current || []));
        const liveCardsAfter = playerObj.cards.filter((c: string, ci: number) => c !== '+1 Vie' && checkCardIsAlive(playerObj, ci, nextLog));
        if (liveCardsBefore.length > 0 && liveCardsAfter.length === 0) {
          setTimeout(() => {
            triggerSfxRef.current('grabuge');
          }, 350);
        }
      }

      // Re-calculer immédiatement les allégeances de chaque joueur dans l'état React `res`
      setRes((prev: any) => {
        if (!prev) return prev;
        return prev.map((p: any) => {
          const liveCards = p.cards.filter((c: string, ci: number) => {
            if (c === '+1 Vie') return false;
            return checkCardIsAlive(p, ci, nextLog);
          });
          const recalculatedAllegiance = liveCards.length > 0
            ? getDisplayAllegiance(liveCards, p.cards)
            : (p.cards.some((c: string) => ['R', 'F', 'S'].includes(getType(c))) ? 'Innocent' : 'Innocent Pur');
          return {
            ...p,
            allegiance: recalculatedAllegiance
          };
        });
      });

      // Synchroniser immédiatement les attributs DOM et réévaluer les conditions de victoire
      setTimeout(() => {
        const pcs = Array.from(document.querySelectorAll('.player-card'));
        pcs.forEach(pc => {
          const pName = pc.getAttribute('data-player-name') || pc.querySelector('.player-name')?.textContent?.trim();
          const pObj = resRef.current?.find((pl: any) => pl.name === pName || pl.name?.trim() === pName);
          if (pObj) {
            const liveCards = pObj.cards.filter((c: string, ci: number) => c !== '+1 Vie' && checkCardIsAlive(pObj, ci, nextLog));
            const alleg = liveCards.length > 0
              ? getDisplayAllegiance(liveCards, pObj.cards)
              : (pObj.cards.some((c: string) => ['R', 'F', 'S'].includes(getType(c))) ? 'Innocent' : 'Innocent Pur');
            pc.setAttribute('data-initial-allegiance', alleg);
            pc.setAttribute('data-initial-pure', alleg === 'Innocent Pur' ? 'true' : 'false');
            if (liveCards.length === 0) {
              pc.classList.add('joueur-mort');
              pc.querySelectorAll('.allegiance-text').forEach(el => {
                el.textContent = "Déchu de Grabuge";
                (el as HTMLElement).style.cssText = "font-style: italic; opacity: 0.8;";
              });
            } else {
              pc.classList.remove('joueur-mort');
              pc.querySelectorAll('.allegiance-text').forEach(el => {
                el.textContent = `Allégeance : ${alleg}`;
                (el as HTMLElement).style.cssText = "";
              });
            }
          }
        });

        checkVictoryConditions(handleGameEndRef.current);
        saveCurrentGameRef.current();
      }, 50);

      // 1. Si cette élimination était l'élimination forcée de l'enfant lié au Parent :
      if (
        forcedParentCardLossChildRef.current && 
        (deadPlayer === forcedParentCardLossChildRef.current.playerName || (data.playerId !== undefined && data.playerId === forcedParentCardLossChildRef.current.playerId))
      ) {
        setForcedParentCardLossChild(null);
        forcedParentCardLossChildRef.current = null;
        setParentBondBroken(true);
        parentBondBrokenRef.current = true;
      } else if (
        // 2. Gestion du pouvoir du Parent : lien entre les 2 enfants (actif une seule fois)
        !parentBondBrokenRef.current &&
        parentChildrenRef.current.length === 2 &&
        resRef.current
      ) {
        const p1 = resRef.current.find((p: any) => p.id === parentChildrenRef.current[0]);
        const p2 = resRef.current.find((p: any) => p.id === parentChildrenRef.current[1]);
        const isChild1 = p1 && (deadPlayer === p1.name || (data.playerId !== undefined && data.playerId === p1.id));
        const isChild2 = p2 && (deadPlayer === p2.name || (data.playerId !== undefined && data.playerId === p2.id));

        if (isChild1 || isChild2) {
          const partner = isChild1 ? p2 : p1;
          if (partner) {
            // Trouver la première carte encore en jeu du partenaire (hors +1 Vie d'abord)
            let firstAliveIdx = -1;
            let firstAliveRole = '';
            for (let ci = 0; ci < partner.cards.length; ci++) {
              const cName = partner.cards[ci];
              if (cName === '+1 Vie') continue;
              const isKilled = [...(gameHistoryRef.current || []), newEvent].some(
                (h: any) => h.playerName === partner.name && h.cardIndex === ci
              );
              if (!isKilled) {
                firstAliveIdx = ci;
                firstAliveRole = cName;
                break;
              }
            }

            // Si aucune carte de rôle standard n'est trouvée, chercher n'importe quelle carte encore en jeu (ex: +1 Vie)
            if (firstAliveIdx === -1) {
              for (let ci = 0; ci < partner.cards.length; ci++) {
                const isKilled = [...(gameHistoryRef.current || []), newEvent].some(
                  (h: any) => h.playerName === partner.name && h.cardIndex === ci
                );
                if (!isKilled) {
                  firstAliveIdx = ci;
                  firstAliveRole = partner.cards[ci];
                  break;
                }
              }
            }

            if (firstAliveIdx !== -1) {
              // Le lien du Parent ne fonctionne qu'une seule fois dans la partie
              setParentBondBroken(true);
              parentBondBrokenRef.current = true;
              const parentLossData = {
                triggerChildName: deadPlayer,
                partnerChildName: partner.name,
                partnerPlayerId: partner.id,
                triggerRole: data.originalRole,
                targetCardIndex: firstAliveIdx,
                targetCardName: firstAliveRole
              };
              setPendingParentTargetLoss(parentLossData);
              pendingParentTargetLossRef.current = parentLossData;
            } else {
              // Le partenaire n'a plus aucune carte en jeu : le pouvoir s'arrête
              setParentBondBroken(true);
              parentBondBrokenRef.current = true;
            }
          }
        }
      }

      // 3. Gestion du pouvoir du Berserker (exécuté ou mis en file d'attente si le Parent est actif)
      if (data.originalRole === 'Berserker' || data.originalRole?.trim() === 'Berserker') {
        handleBerserkerEliminated(deadPlayer, data.cardIndex);
      }
    };
    const handleShowDebrief = () => setShowDebrief(true);
    const handleGameWon = () => setIsFinished(true);

    const handleGentlemanKilled = (e: any) => {
      const { playerName } = e.detail || {};
      if (playerName) handleGentlemanEliminated(playerName);
    };

    const handleElfDwarfKilled = (e: any) => {
      const { role, playerName } = e.detail || {};
      if (role && playerName) handleElfDwarfEliminated(role, playerName);
    };

    const handleBerserkerKilled = (e: any) => {
      const { playerName, cardIndex } = e.detail || {};
      if (playerName) handleBerserkerEliminated(playerName, cardIndex);
    };

    const handlePlayerFullyEliminated = () => {
      triggerSfxRef.current('grabuge');
    };

    window.addEventListener('rs_player_killed', handlePlayerKilled);
    window.addEventListener('rs_show_debrief', handleShowDebrief);
    window.addEventListener('rs_game_won', handleGameWon);
    window.addEventListener('rs_gentleman_killed', handleGentlemanKilled);
    window.addEventListener('rs_elf_dwarf_killed', handleElfDwarfKilled);
    window.addEventListener('rs_berserker_killed', handleBerserkerKilled);
    window.addEventListener('rs_player_fully_eliminated', handlePlayerFullyEliminated);
    return () => {
      window.removeEventListener('rs_player_killed', handlePlayerKilled);
      window.removeEventListener('rs_show_debrief', handleShowDebrief);
      window.removeEventListener('rs_game_won', handleGameWon);
      window.removeEventListener('rs_gentleman_killed', handleGentlemanKilled);
      window.removeEventListener('rs_elf_dwarf_killed', handleElfDwarfKilled);
      window.removeEventListener('rs_berserker_killed', handleBerserkerKilled);
      window.removeEventListener('rs_player_fully_eliminated', handlePlayerFullyEliminated);
    };
  }, [res]);

  useEffect(() => {
    const handleSaveOnExit = () => {
      saveCurrentGameRef.current();
    };
    window.addEventListener('beforeunload', handleSaveOnExit);
    window.addEventListener('pagehide', handleSaveOnExit);
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveCurrentGameRef.current();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleSaveOnExit);
      window.removeEventListener('pagehide', handleSaveOnExit);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    let interval: any;
    if (isPlaying && !isFinished) {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isPlaying, isFinished, gameId]);

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      // Sauvegarde périodique toutes les 3 secondes pour ne perdre aucun état
      interval = setInterval(() => {
        saveCurrentGameRef.current();
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, gameId]);

  useEffect(() => {
    const activeGameId = localStorage.getItem('rs_active_game_id');
    if (activeGameId) {
      try {
        let games: any[] = [];
        try {
          games = JSON.parse(localStorage.getItem('rs_saved_games') || '[]');
        } catch (_) {}
        if (!Array.isArray(games) || games.length === 0) {
          try {
            games = JSON.parse(localStorage.getItem('rs_saved_games_backup') || '[]');
          } catch (_) {}
        }
        const game = Array.isArray(games) ? games.find((g: any) => g.id === activeGameId) : null;
        if (game) {
          loadGame(game);
        }
      } catch (e) {
        console.error("Failed to auto-load active game", e);
      }
    }
  }, []);

  useEffect(() => {
    if (isPlaying && gameId) {
      localStorage.setItem('rs_active_game_id', gameId);
    } else {
      localStorage.removeItem('rs_active_game_id');
    }
  }, [isPlaying, gameId]);

  useEffect(() => {
    if (tab === 'history') {
      try {
        let games = JSON.parse(localStorage.getItem('rs_saved_games') || '[]');
        if (!Array.isArray(games) || games.length === 0) {
          games = JSON.parse(localStorage.getItem('rs_saved_games_backup') || '[]');
        }
        setSavedGames(Array.isArray(games) ? games.slice(0, 2) : []);
      } catch (e) {
        setSavedGames([]);
      }
    }
  }, [tab]);

  const loadGame = (game: any) => {
    setGameId(game.id);
    setGameName(game.name);
    setN(game.state.N);
    setC(game.state.C);
    setNightCount(game.state.nightCount);
    setHasPlayedNight1(game.state.hasPlayedNight1);
    setPotions(game.state.potions);
    const loadedRes = game.state.res ? game.state.res.map((p: any) => {
      const cardIds = p.cardIds && p.cardIds.length === p.cards.length
        ? p.cardIds
        : p.cards.map((c: string, ci: number) => c === '+1 Vie' ? `life_${p.id}_${ci}_${Math.random().toString(36).slice(2, 7)}` : `card_${p.id}_${ci}_${c}`);
      return { ...p, cardIds };
    }) : null;
    setRes(loadedRes);
    setElapsedTime(game.state.elapsedTime || 0);
    setGameHistory(game.state.gameHistory || []);
    setIsFinished(game.state.isFinished || false);
    setNatureChildPlayerId(game.state.natureChildPlayerId || game.state.res?.find((p: any) => p.cards.includes('Enfant de la nature'))?.id || null);
    setNatureChildMaster(game.state.natureChildMaster || null);
    setHasStolenMasterCard(game.state.hasStolenMasterCard || false);
    setNatureChildMode(null);
    setNatureChildPopup(null);
    setCandidateMaster(null);
    setSelectedChildCard(null);
    setSelectedMasterCard(null);
    setPendingChildCard(null);
    setPendingMasterCard(null);
    setShowGhostRitualModal(false);
    setReviveCandidate(null);
    setElfDwarfUsed(game.state.elfDwarfUsed || false);
    elfDwarfUsedRef.current = game.state.elfDwarfUsed || false;
    setSuperVoyantTarget(game.state.superVoyantTarget || null);
    setShowSuperVoyantModal(false);
    setParentChildren(game.state.parentChildren || []);
    parentChildrenRef.current = game.state.parentChildren || [];
    setParentBondBroken(game.state.parentBondBroken || false);
    parentBondBrokenRef.current = game.state.parentBondBroken || false;
    setShowParentModal(false);
    setPendingParentTargetLoss(null);
    setForcedParentCardLossChild(null);
    setBerserkerEvent(game.state?.berserkerEvent || null);
    setBerserkerStep(game.state?.berserkerStep || null);
    setCandidateBerserkerTarget(null);
    setBerserkerNoEffectPlayer(null);
    setBerserkerWrongCardToast(null);
    setHasPendingVictory(false);
    setPendingVictoryTitles([]);
    setIsPlaying(true);
    setTab('ordre');
    setIsSidebarOpen(false);
    
    setTimeout(() => {
      if (!game.state.domState) return;
      const pcs = document.querySelectorAll('.player-card');
      game.state.domState.forEach((pState: any, i: number) => {
        const pc = pcs[i];
        if (!pc || !pState) return;
        
        if (pState.isDead) pc.classList.add('joueur-mort');
        pc.querySelectorAll('.allegiance-text').forEach(el => {
          el.textContent = `Allégeance : ${pState.allegiance}`;
          if (pState.isDead) {
            el.textContent = "Déchu de Grabuge";
            (el as HTMLElement).style.cssText = "font-style: italic; opacity: 0.8;";
          }
        });
        
        const badges = pc.querySelectorAll('.role-badge');
        if (pState.cardsState) {
          pState.cardsState.forEach((cState: any, j: number) => {
            const badge = badges[j];
            if (!badge || !cState) return;
            if (cState.isDead) badge.classList.add('role-mort');
            if (cState.isGhostKill) badge.classList.add('tue-par-fantome');
            if (cState.deathTurn) badge.setAttribute('data-death-turn', cState.deathTurn);
          });
        }
      });
    }, 500);
  };

  const gen = (customCounts?: Record<string, number> | React.MouseEvent) => {
    const countsToUse = (customCounts && !('nativeEvent' in customCounts)) ? customCounts : customDeckCounts;
    const r = generateGame(N, C, countsToUse);
    if (r.err) { 
      setErr(r.err); 
      setExclusionModalErr(r.err);
      setRes(null); 
      return false;
    }
    else { 
      setRes(r.players.map((p: any) => ({ ...p, name: `Joueur ${p.id}` }))); 
      setErr(''); 
      setExclusionModalErr('');
      setIsEditing(false); 
      setIsPlaying(false); 
      setIsConfirmingStop(false); 
      setGameId(null); 
      setElapsedTime(0); 
      setGameName(''); 
      setGameHistory([]); 
      setIsFinished(false); 
      setPotions({ heal: 2, death: 2 });
      setNightPotionsUsed({ heal: false, death: false });
      setNightCount(1);
      setHasPlayedNight1(false);
      setCheckedRoles([]);
      const childP = r.players.find((p: any) => p.cards.includes('Enfant de la nature'));
      setNatureChildPlayerId(childP ? childP.id : null);
      setNatureChildMaster(null);
      setHasStolenMasterCard(false);
      setNatureChildMode(null);
      setNatureChildPopup(null);
      setCandidateMaster(null);
      setSelectedChildCard(null);
      setSelectedMasterCard(null);
      setPendingChildCard(null);
      setPendingMasterCard(null);
      setShowGhostRitualModal(false);
      setReviveCandidate(null);
      setExtraLifeBlockedPlayer(null);
      setGentlemanGiver(null);
      setGentlemanStep(null);
      setCandidateGentlemanTarget(null);
      setElfDwarfEvent(null);
      setElfDwarfUsed(false);
      elfDwarfUsedRef.current = false;
      setSuperVoyantTarget(null);
      setShowSuperVoyantModal(false);
      setParentChildren([]);
      setTempParentChildren([]);
      setShowParentModal(false);
      setPendingParentTargetLoss(null);
      setForcedParentCardLossChild(null);
      setParentBondBroken(false);
      parentChildrenRef.current = [];
      parentBondBrokenRef.current = false;
      forcedParentCardLossChildRef.current = null;
      setHasPendingVictory(false);
      setPendingVictoryTitles([]);
      setExclusionModalStep('none');
      return true;
    }
  };

  const copy = () => {
    if (!res) return;
    const txt = res.map((p: any) => `${p.name} (${p.allegiance}): ${p.cards.join(', ')}`).join('\n');
    navigator.clipboard.writeText(txt);
    alert('Copié !');
  };

  const maxC = N <= 5 ? 8 : N === 6 ? 7 : N === 7 ? 6 : N === 8 ? 5 : N <= 10 ? 4 : 3;

  const handleContinueStealIntro = () => {
    const child = (natureChildPlayerId && res?.find((p: any) => p.id === natureChildPlayerId)) 
      || res?.find((p: any) => p.cards.includes('Enfant de la nature'));
    const master = res?.find((p: any) => p.id === natureChildMaster);
    if (!master) {
      setNatureChildPopup('master_dead');
      return;
    }
    const pcs = Array.from(document.querySelectorAll('.player-card'));
    const childIdx = child && res ? res.findIndex((p: any) => p.id === child.id) : -1;
    const childCardEl = childIdx >= 0 ? pcs[childIdx] : null;
    const isChildDead = childCardEl 
      ? (childCardEl.classList.contains('joueur-mort') || childCardEl.querySelectorAll('.role-badge:not(.role-mort)').length === 0)
      : false;

    if (isChildDead) {
      setNatureChildMode(null);
      setNatureChildPopup(null);
      return;
    }

    const masterIdx = res.findIndex((p: any) => p.id === natureChildMaster);
    const masterCardEl = pcs[masterIdx];
    const isMasterDead = masterCardEl 
      ? masterCardEl.classList.contains('joueur-mort') || masterCardEl.querySelectorAll('.role-badge:not(.role-mort)').length === 0
      : false;

    if (isMasterDead) {
      setNatureChildPopup('master_dead');
    } else {
      setNatureChildPopup(null);
    }
  };

  const performCardSwap = (childCard: string, masterCard: string) => {
    if (!res) return;
    const child = (natureChildPlayerId && res.find((p: any) => p.id === natureChildPlayerId)) 
      || res.find((p: any) => p.cards.includes('Enfant de la nature'));
    const master = res.find((p: any) => p.id === natureChildMaster);
    if (!child || !master) return;

    const childNewCards = [...child.cards];
    const cIdx = childNewCards.indexOf(childCard);
    if (cIdx > -1) childNewCards[cIdx] = masterCard;

    const masterNewCards = [...master.cards];
    const mIdx = masterNewCards.indexOf(masterCard);
    if (mIdx > -1) masterNewCards[mIdx] = childCard;

    const updatedChildAllegiance = getDisplayAllegiance(childNewCards);
    const updatedMasterAllegiance = getDisplayAllegiance(masterNewCards);

    // Inspect DOM before state update to see if childCard had role-mort
    const pcsBefore = Array.from(document.querySelectorAll('.player-card'));
    const childIdx = res.findIndex((p: any) => p.id === child.id);
    const masterIdx = res.findIndex((p: any) => p.id === master.id);
    const childPcBefore = pcsBefore[childIdx];
    const childBadgesBefore = childPcBefore ? Array.from(childPcBefore.querySelectorAll('.role-badge')) : [];
    const wasChildCardDead = childBadgesBefore[cIdx]?.classList.contains('role-mort') || false;

    const childCardIds = child.cardIds && child.cardIds.length === child.cards.length
      ? [...child.cardIds]
      : child.cards.map((c: string, i: number) => `card_${child.id}_${i}_${c}`);
    const masterCardIds = master.cardIds && master.cardIds.length === master.cards.length
      ? [...master.cardIds]
      : master.cards.map((c: string, i: number) => `card_${master.id}_${i}_${c}`);
    if (cIdx > -1 && mIdx > -1 && childCardIds[cIdx] && masterCardIds[mIdx]) {
      const tempId = childCardIds[cIdx];
      childCardIds[cIdx] = masterCardIds[mIdx];
      masterCardIds[mIdx] = tempId;
    }

    const updatedRes = res.map((p: any) => {
      if (p.id === child.id) {
        return { ...p, cards: childNewCards, cardIds: childCardIds, allegiance: updatedChildAllegiance };
      }
      if (p.id === master.id) {
        return { ...p, cards: masterNewCards, cardIds: masterCardIds, allegiance: updatedMasterAllegiance };
      }
      return p;
    });

    setRes(updatedRes);

    setTimeout(() => {
      const pcs = Array.from(document.querySelectorAll('.player-card'));
      const cPc = pcs[childIdx];
      const mPc = pcs[masterIdx];

      if (cPc) {
        // Stolen card from master is alive
        const cBadges = Array.from(cPc.querySelectorAll('.role-badge'));
        if (cBadges[cIdx]) {
          cBadges[cIdx].classList.remove('role-mort', 'tue-par-fantome');
          cBadges[cIdx].removeAttribute('data-death-turn');
        }
        // Child now has at least one alive card
        cPc.classList.remove('joueur-mort');
        cPc.setAttribute('data-initial-allegiance', updatedChildAllegiance);
        cPc.setAttribute('data-initial-pure', updatedChildAllegiance === 'Innocent Pur' ? 'true' : 'false');
        cPc.querySelectorAll('.allegiance-text').forEach(el => {
          el.textContent = `Allégeance : ${updatedChildAllegiance}`;
          (el as HTMLElement).style.cssText = '';
        });
      }

      if (mPc) {
        const mBadges = Array.from(mPc.querySelectorAll('.role-badge'));
        if (mBadges[mIdx]) {
          if (wasChildCardDead) {
            mBadges[mIdx].classList.add('role-mort');
          } else {
            mBadges[mIdx].classList.remove('role-mort', 'tue-par-fantome');
            mBadges[mIdx].removeAttribute('data-death-turn');
          }
        }
        const mLiveCount = mPc.querySelectorAll('.role-badge:not(.role-mort)').length;
        if (mLiveCount === 0) {
          mPc.classList.add('joueur-mort');
          mPc.querySelectorAll('.allegiance-text').forEach(el => {
            el.textContent = "Déchu de Grabuge";
            (el as HTMLElement).style.cssText = "font-style: italic; opacity: 0.8;";
          });
        } else {
          mPc.classList.remove('joueur-mort');
          mPc.setAttribute('data-initial-allegiance', updatedMasterAllegiance);
          mPc.setAttribute('data-initial-pure', updatedMasterAllegiance === 'Innocent Pur' ? 'true' : 'false');
          mPc.querySelectorAll('.allegiance-text').forEach(el => {
            el.textContent = `Allégeance : ${updatedMasterAllegiance}`;
            (el as HTMLElement).style.cssText = '';
          });
        }
      }
    }, 100);
  };

  const handleConfirmRevive = () => {
    if (!reviveCandidate) return;
    const { playerName, cardName, cardIndex, badgeEl, pcEl } = reviveCandidate;

    // 1. Restore the badge in DOM
    if (badgeEl) {
      badgeEl.classList.remove('role-mort');
      badgeEl.classList.remove('tue-par-fantome');
      badgeEl.removeAttribute('data-death-turn');
    }

    // 2. Restore player card alive state and recalculate allegiance accurately
    const livePc = (document.querySelector(`.player-card[data-player-name="${playerName}"]`) as HTMLElement) || pcEl;
    if (livePc) {
      livePc.classList.remove('joueur-mort');
    }

    const targetPlayer = (res || []).find((p: any) => p.name === playerName || p.name?.trim() === playerName?.trim());
    const targetCards: string[] = targetPlayer ? targetPlayer.cards : [];
    
    // Find index of elimination in current gameHistory
    let removeIndex = -1;
    for (let i = (gameHistory || []).length - 1; i >= 0; i--) {
      const h = (gameHistory || [])[i];
      const pMatch = h.playerName === playerName || h.playerName?.trim() === playerName?.trim();
      if (pMatch) {
        if (cardIndex !== undefined && h.cardIndex !== undefined && Number(h.cardIndex) === Number(cardIndex)) {
          removeIndex = i;
          break;
        } else if (h.originalRole === cardName || h.originalRole?.trim() === cardName?.trim()) {
          removeIndex = i;
          break;
        }
      }
    }

    const remainingKills = (gameHistory || []).filter((_: any, idx: number) => idx !== removeIndex);

    // Collect all living cards for this player (including the revived card)
    const liveTargetCards = targetCards.filter((c: string, ci: number) => {
      if (c === '+1 Vie') return false;
      if (cardIndex !== undefined && ci === cardIndex) return true;
      if (cardIndex === undefined && c === cardName && ci === targetCards.indexOf(cardName)) return true;
      const hasKill = remainingKills.some((h: any) => 
        (h.playerName === playerName || h.playerName?.trim() === playerName?.trim()) && 
        (h.cardIndex !== undefined ? Number(h.cardIndex) === ci : (h.originalRole === c || h.originalRole?.trim() === c?.trim()))
      );
      return !hasKill;
    });

    if (!liveTargetCards.includes(cardName) && cardName !== '+1 Vie') {
      liveTargetCards.push(cardName);
    }

    // Determine exact allegiance based on the card(s) that are alive
    const recalculatedAllegiance = liveTargetCards.length > 0
      ? getDisplayAllegiance(liveTargetCards, targetCards)
      : (() => {
          const t = getType(cardName);
          if (t === 'R') return cardName === 'Traître' ? 'Innocent' : 'Renard';
          if (t === 'F') return 'Fantôme';
          if (t === 'S') return 'Solo';
          const hadColored = targetCards.some(c => ['R', 'F', 'S'].includes(getType(c)));
          return hadColored ? 'Innocent' : 'Innocent Pur';
        })();

    if (livePc) {
      livePc.setAttribute('data-initial-allegiance', recalculatedAllegiance);
      livePc.setAttribute('data-initial-pure', recalculatedAllegiance === 'Innocent Pur' ? 'true' : 'false');
      livePc.querySelectorAll('.allegiance-text').forEach(s => {
        s.textContent = `Allégeance : ${recalculatedAllegiance}`;
        (s as HTMLElement).style.cssText = "";
      });
    }

    // Update React state so player object in res carries the accurate revived allegiance
    setRes((prev: any) => {
      if (!prev) return prev;
      return prev.map((p: any) => {
        const isTarget = p.name === playerName || p.name?.trim() === playerName?.trim();
        if (isTarget) {
          const newCards = [...p.cards];
          const newCardIds = p.cardIds && p.cardIds.length === p.cards.length
            ? [...p.cardIds]
            : p.cards.map((c: string, i: number) => `card_${p.id}_${i}_${c}`);
          if (cardName === 'Guérisseur' && newCards.includes('+1 Vie')) {
            const idx = newCards.lastIndexOf('+1 Vie');
            if (idx > -1) {
              newCards.splice(idx, 1);
              if (newCardIds.length > idx) newCardIds.splice(idx, 1);
            }
          }
          return {
            ...p,
            cards: newCards,
            cardIds: newCardIds,
            allegiance: recalculatedAllegiance
          };
        }
        if (cardName === 'Elfe' || cardName === 'Nain') {
          const partnerRole = cardName === 'Elfe' ? 'Nain' : 'Elfe';
          if (p.cards.includes(partnerRole) && p.cards.includes('+1 Vie')) {
            const newCards = [...p.cards];
            const newCardIds = p.cardIds && p.cardIds.length === p.cards.length
              ? [...p.cardIds]
              : p.cards.map((c: string, i: number) => `card_${p.id}_${i}_${c}`);
            const idx = newCards.lastIndexOf('+1 Vie');
            if (idx > -1) {
              newCards.splice(idx, 1);
              if (newCardIds.length > idx) newCardIds.splice(idx, 1);
            }
            return { ...p, cards: newCards, cardIds: newCardIds };
          }
        }
        return p;
      });
    });

    if (cardName === 'Elfe' || cardName === 'Nain') {
      setElfDwarfUsed(false);
      elfDwarfUsedRef.current = false;
    }

    // 3. Remove this elimination from gameHistory (all loss logs)
    setGameHistory(prev => {
      let removed = false;
      return prev.filter((h, idx) => {
        if (removeIndex !== -1 && idx === removeIndex) return false;
        if (removeIndex === -1 && !removed) {
          const pMatch = h.playerName === playerName || h.playerName?.trim() === playerName?.trim();
          if (pMatch) {
            if (cardIndex !== undefined && h.cardIndex !== undefined && Number(h.cardIndex) === Number(cardIndex)) {
              removed = true;
              return false;
            } else if (h.originalRole === cardName || h.originalRole?.trim() === cardName?.trim()) {
              removed = true;
              return false;
            }
          }
        }
        return true;
      });
    });

    // 4. Close any open victory popups and reset finish state if victory was premature
    document.getElementById('rs-pending-win-overlay')?.remove();
    document.getElementById('rs-final-win-overlay')?.remove();
    setIsFinished(false);

    // 5. Notify components that this card was revived
    window.dispatchEvent(new CustomEvent('rs_card_revived', { detail: { cardName, playerName, cardIndex } }));

    // 6. Close revive confirmation modal
    setReviveCandidate(null);

    // 7. Review victory conditions and refresh all player allegiances with the card now alive
    setTimeout(() => {
      const pcs = Array.from(document.querySelectorAll('.player-card'));
      pcs.forEach(pc => {
        const pName = pc.getAttribute('data-player-name') || pc.querySelector('.player-name')?.textContent?.trim();
        const pObj = resRef.current?.find((pl: any) => pl.name === pName || pl.name?.trim() === pName);
        if (pObj) {
          const liveCards = pObj.cards.filter((c: string, ci: number) => c !== '+1 Vie' && checkCardIsAlive(pObj, ci, gameHistoryRef.current));
          const alleg = liveCards.length > 0
            ? getDisplayAllegiance(liveCards, pObj.cards)
            : (pObj.cards.some((c: string) => ['R', 'F', 'S'].includes(getType(c))) ? 'Innocent' : 'Innocent Pur');
          pc.setAttribute('data-initial-allegiance', alleg);
          pc.setAttribute('data-initial-pure', alleg === 'Innocent Pur' ? 'true' : 'false');
          if (liveCards.length === 0) {
            pc.classList.add('joueur-mort');
            pc.querySelectorAll('.allegiance-text').forEach(el => {
              el.textContent = "Déchu de Grabuge";
              (el as HTMLElement).style.cssText = "font-style: italic; opacity: 0.8;";
            });
          } else {
            pc.classList.remove('joueur-mort');
            pc.querySelectorAll('.allegiance-text').forEach(el => {
              el.textContent = `Allégeance : ${alleg}`;
              (el as HTMLElement).style.cssText = "";
            });
          }
        }
      });
      checkVictoryConditions(handleGameEndRef.current);
      saveCurrentGameRef.current();
    }, 150);
  };

  const handleSuperVoyantSelect = (type: 'Renard' | 'Fantôme') => {
    if (!res) return;

    const isAlive = (p: any) => {
      if (!p.cards || p.cards.length === 0) return false;
      return p.cards.some((c: string, ci: number) => {
        if (c === '+1 Vie') return true;
        const hasIndexKill = (gameHistory || []).some((h: any) => h.playerName === p.name && h.cardIndex === ci);
        if (hasIndexKill) return false;
        const legacyKills = (gameHistory || []).filter((h: any) => h.playerName === p.name && h.originalRole === c && h.cardIndex === undefined);
        const legacyBefore = p.cards.slice(0, ci).filter((rc: string) => rc === c && !(gameHistory || []).some((h: any) => h.playerName === p.name && h.cardIndex === ci)).length;
        return legacyKills.length <= legacyBefore;
      });
    };

    const alivePlayers = res.filter(isAlive);

    let eligible: any[] = [];
    if (type === 'Renard') {
      // Joueur possédant un renard ou le traître
      eligible = alivePlayers.filter((p: any) =>
        p.cards.some((c: string) => ['Renard', 'Renardeau', 'Chef des renards', 'Traître'].includes(c) || getType(c) === 'R')
      );
    } else {
      // Joueur possédant un fantôme
      eligible = alivePlayers.filter((p: any) =>
        p.cards.some((c: string) => ['Fantôme', 'Chef des fantômes'].includes(c) || getType(c) === 'F')
      );
    }

    // Si d'autres joueurs sont disponibles, ne pas désigner le joueur possédant le Super Voyant
    const withoutSuperVoyant = eligible.filter((p: any) => !p.cards.includes('Super voyant'));
    const candidatePool = withoutSuperVoyant.length > 0 ? withoutSuperVoyant : eligible;

    if (candidatePool.length > 0) {
      const picked = candidatePool[Math.floor(Math.random() * candidatePool.length)];
      setSuperVoyantTarget({
        playerName: picked.name,
        allegiance: type
      });
    } else {
      setSuperVoyantTarget({
        playerName: 'Aucun joueur trouvé',
        allegiance: type,
        notFound: true
      });
    }
  };

  const renderedGameBoard = useMemo(() => {
    if (!res) return null;
    const childPlayer = (natureChildPlayerId && res.find((p: any) => p.id === natureChildPlayerId)) 
      || res.find((p: any) => p.cards.includes('Enfant de la nature'));
    const masterPlayer = res.find((p: any) => p.id === natureChildMaster);

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {res.map((p: any, i: number) => {
          const isChild = p.id === childPlayer?.id;
          const isMaster = p.id === masterPlayer?.id;
          const isChoosingMaster = natureChildMode === 'choose_master';
          const isStealing = natureChildMode === 'steal_card';
          const isGentlemanChoosing = gentlemanStep === 'choosing';
          const isGentlemanGiver = isGentlemanChoosing && p.name === gentlemanGiver;
          const isForcedChild = forcedParentCardLossChild && p.id === forcedParentCardLossChild.playerId;
          const isOtherPlayerWhileForced = forcedParentCardLossChild && !isForcedChild;

          const playerHasExtraLife = p.cards.includes('+1 Vie');

          const isPlayerDead = p.cards.length > 0 && p.cards.every((c: string, ci: number) => {
            if (c === '+1 Vie') return false;
            return !checkCardIsAlive(p, ci, gameHistory);
          });

          const liveCards = p.cards.filter((c: string, ci: number) => {
            if (c === '+1 Vie') return false;
            return checkCardIsAlive(p, ci, gameHistory);
          });

          const currentDisplayAllegiance = liveCards.length > 0
            ? getDisplayAllegiance(liveCards, p.cards)
            : (p.cards.some((c: string) => ['R', 'F', 'S'].includes(getType(c))) ? 'Innocent' : 'Innocent Pur');

          const isBerserkerChoosing = berserkerStep === 'choosing' && !!berserkerEvent;
          const isBerserkerOwner = isBerserkerChoosing && (p.name === berserkerEvent.playerName || (berserkerEvent.playerId !== undefined && p.id === berserkerEvent.playerId));

          let cardStyle = "border-neutral-800";
          let disabledStyle = "";
          if (isOtherPlayerWhileForced) {
            disabledStyle = "opacity-20 filter grayscale contrast-75 pointer-events-none select-none brightness-50 bg-neutral-950/95 border-neutral-800/80 transition-all duration-300";
            cardStyle = "border-neutral-800/60";
          } else if (isForcedChild) {
            cardStyle = "border-amber-400 ring-4 ring-amber-500/80 shadow-[0_0_35px_rgba(245,158,11,0.55)] bg-gradient-to-b from-amber-950/40 via-neutral-900 to-amber-950/30 scale-[1.02] z-20 transition-all duration-300";
          } else if (isChoosingMaster) {
            if (isChild) {
              disabledStyle = "opacity-50 cursor-not-allowed";
              cardStyle = "border-neutral-800";
            } else {
              cardStyle = "border-amber-700/80 hover:border-amber-400 hover:scale-[1.01] cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.2)]";
            }
          } else if (isStealing) {
            if (!isChild && !isMaster) {
              disabledStyle = "opacity-25 filter grayscale pointer-events-none select-none";
            } else if (isChild) {
              cardStyle = "border-emerald-600/90 ring-2 ring-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.25)]";
            } else if (isMaster) {
              cardStyle = "border-purple-600/90 ring-2 ring-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.25)]";
            }
          } else if (isGentlemanChoosing) {
            if (isGentlemanGiver) {
              disabledStyle = "opacity-40 filter grayscale-[50%] select-none pointer-events-none";
              cardStyle = "border-neutral-800";
            } else if (isPlayerDead) {
              disabledStyle = "opacity-30 filter grayscale select-none pointer-events-none";
              cardStyle = "border-neutral-800";
            } else {
              cardStyle = "border-emerald-600/90 ring-2 ring-emerald-500/40 hover:border-emerald-400 hover:scale-[1.01] cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.25)]";
            }
          } else if (isBerserkerChoosing) {
            if (isBerserkerOwner) {
              disabledStyle = "opacity-40 filter grayscale select-none pointer-events-none";
              cardStyle = "border-neutral-800";
            } else if (isPlayerDead) {
              disabledStyle = "opacity-30 filter grayscale select-none pointer-events-none";
              cardStyle = "border-neutral-800";
            } else {
              cardStyle = "border-rose-700/80 hover:border-rose-400 hover:scale-[1.01] cursor-pointer shadow-[0_0_15px_rgba(244,63,94,0.25)]";
            }
          }

          return (
            <div 
              key={p.id} 
              data-player-id={p.id}
              data-initial-allegiance={currentDisplayAllegiance} 
              data-player-name={p.name} 
              data-initial-pure={currentDisplayAllegiance === 'Innocent Pur' ? 'true' : 'false'} 
              onClick={() => {
                if (isChoosingMaster && !isChild) {
                  setCandidateMaster(p);
                } else if (isGentlemanChoosing && !isGentlemanGiver && !isPlayerDead) {
                  setCandidateGentlemanTarget(p);
                } else if (isBerserkerChoosing && !isBerserkerOwner && !isPlayerDead) {
                  const targetIdx = berserkerEvent.cardIndex;
                  const isSameRankAlive = targetIdx < p.cards.length && p.cards[targetIdx] !== '+1 Vie' && checkCardIsAlive(p, targetIdx, gameHistory);
                  const chosenIdx = isSameRankAlive 
                    ? targetIdx 
                    : p.cards.findIndex((c: string, idx: number) => c !== '+1 Vie' && checkCardIsAlive(p, idx, gameHistory));
                  if (chosenIdx !== -1) {
                    setCandidateBerserkerTarget({
                      player: p,
                      cardIndex: chosenIdx,
                      cardName: p.cards[chosenIdx]
                    });
                  }
                }
              }}
              className={`player-card bg-neutral-900 border-2 rounded-sm p-6 shadow-xl relative group h-auto min-h-fit flex flex-col items-center text-center gap-4 transition-all duration-700 ${isPlayerDead ? 'joueur-mort' : ''} ${cardStyle} ${disabledStyle}`}
            >
              {isForcedChild && (
                <div className="w-full bg-amber-950/95 border-2 border-amber-500 text-amber-200 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg animate-pulse font-serif">
                  <AlertTriangle size={16} className="text-amber-400 shrink-0 animate-bounce" />
                  <span>Enfant lié désigné • Éliminez une carte pour continuer</span>
                </div>
              )}
              {isGentlemanChoosing && isGentlemanGiver && (
                <div className="text-xs font-bold text-amber-400 bg-amber-950/80 border border-amber-800 px-3 py-1 rounded-full uppercase tracking-wider">
                  🚫 Ancien Gentil Homme (ne peut pas se donner la vie)
                </div>
              )}
              {isGentlemanChoosing && !isGentlemanGiver && !isPlayerDead && (
                <div className="text-xs font-bold text-emerald-400 bg-emerald-950/90 border border-emerald-700 px-3 py-1 rounded-full uppercase tracking-wider animate-pulse flex items-center justify-center gap-1.5">
                  <Heart size={14} className="fill-red-500 text-red-500 animate-pulse" /> Cliquer pour donner la vie (+1 Vie)
                </div>
              )}
              {isBerserkerChoosing && isBerserkerOwner && (
                <div className="text-xs font-bold text-rose-400 bg-rose-950/80 border border-rose-800 px-3 py-1 rounded-full uppercase tracking-wider">
                  ⚔️ Joueur du Berserker (ne peut pas être ciblé)
                </div>
              )}
              {isBerserkerChoosing && !isBerserkerOwner && !isPlayerDead && (
                <div className="text-xs font-bold text-rose-300 bg-rose-950/90 border border-rose-700 px-3 py-1 rounded-full uppercase tracking-wider animate-pulse flex items-center justify-center gap-1.5">
                  <Swords size={14} className="text-rose-400" /> Cliquer pour choisir ce joueur
                </div>
              )}
              {isChoosingMaster && !isChild && (
                <div className="text-xs font-bold text-amber-400 bg-amber-950/80 border border-amber-800 px-3 py-1 rounded-full uppercase tracking-wider animate-pulse">
                  Cliquer pour choisir comme maître
                </div>
              )}
              {isChoosingMaster && isChild && (
                <div className="text-xs font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-3 py-1 rounded-full uppercase tracking-wider">
                  🧒 Enfant de la nature
                </div>
              )}
              {isStealing && isChild && (
                <div className="text-xs font-bold text-emerald-300 bg-emerald-950/90 border border-emerald-700 px-3 py-1 rounded-full uppercase tracking-wider">
                  🧒 Enfant de la nature {!selectedChildCard ? '• Cliquez sur une carte à échanger' : `• Carte prête (${selectedChildCard})`}
                </div>
              )}
              {isStealing && isMaster && (
                <div className="text-xs font-bold text-purple-300 bg-purple-950/90 border border-purple-700 px-3 py-1 rounded-full uppercase tracking-wider">
                  👑 Maître {!selectedChildCard ? '• En attente de l\'enfant' : '• Cliquez sur la carte à voler'}
                </div>
              )}

              <div className="flex flex-col items-center gap-2 mb-4 border-b border-neutral-800 pb-2 w-full">
                {isEditing && !isPlaying ? (
                  <input
                    type="text"
                    value={p.name}
                    onChange={(e) => {
                      const newRes = [...res];
                      newRes[i].name = e.target.value;
                      setRes(newRes);
                    }}
                    className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-gray-200 font-bold w-full text-center focus:border-neutral-600 outline-none font-serif"
                  />
                ) : (
                  <span className="player-name font-bold text-xl text-gray-200 font-serif tracking-wide">{p.name}</span>
                )}
                <div className={`player-card-meta flex items-center gap-2 w-full px-2 ${isPlayerDead ? 'justify-between' : 'justify-center'}`}>
                  {isPlayerDead ? (
                    <>
                      <span className="allegiance-text text-xs font-bold text-gray-300 bg-neutral-800/90 px-2.5 py-1 rounded border border-neutral-700 italic font-sans select-none">
                        Déchu de Grabuge
                      </span>
                      <span className="text-xs text-gray-400 font-sans select-none font-medium">
                        {p.cards.length} cartes
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-gray-500 font-sans">{p.cards.length} cartes</span>
                      <span className="allegiance-text text-xs font-bold text-gray-300 bg-neutral-800 px-2 py-1 rounded border border-neutral-700 hidden sm:inline-block font-sans">Allégeance : {currentDisplayAllegiance}</span>
                    </>
                  )}
                </div>
              </div>
              {!isPlayerDead && (
                <div className="sm:hidden mb-4">
                  <span className="allegiance-text text-xs font-bold text-gray-300 bg-neutral-800 px-2 py-1 rounded border border-neutral-700 font-sans">Allégeance : {currentDisplayAllegiance}</span>
                </div>
              )}
              <div className="flex flex-wrap gap-2 justify-center">
                {p.cards.map((c: string, ci: number) => {
                  let customOnClick = undefined;
                  let isSelected = false;

                  if (isStealing) {
                    if (isChild) {
                      if (selectedChildCard === c) {
                        isSelected = true;
                      }
                      customOnClick = (cardName: string) => {
                        setPendingChildCard(cardName);
                      };
                    } else if (isMaster) {
                      if (selectedMasterCard === c) {
                        isSelected = true;
                      }
                      customOnClick = (cardName: string, isDead: boolean) => {
                        if (!isDead) setPendingMasterCard(cardName);
                      };
                    }
                  }

                  const killRecord = (gameHistory || []).find((h: any) => 
                    (h.playerName === p.name || h.playerName?.trim() === p.name?.trim()) && 
                    h.cardIndex !== undefined && Number(h.cardIndex) === ci
                  ) || (() => {
                      const legacyKills = (gameHistory || []).filter((h: any) => 
                        (h.playerName === p.name || h.playerName?.trim() === p.name?.trim()) && 
                        (h.originalRole === c || h.originalRole?.trim() === c?.trim()) && 
                        h.cardIndex === undefined
                      );
                      const sameTypeBefore = p.cards.slice(0, ci).filter((rc: string) => 
                        rc === c && !(gameHistory || []).some((h: any) => (h.playerName === p.name || h.playerName?.trim() === p.name?.trim()) && h.cardIndex !== undefined && Number(h.cardIndex) === ci)
                      ).length;
                      return legacyKills.length > sameTypeBefore ? legacyKills[sameTypeBefore] : null;
                    })();
                  const isCardDead = !!killRecord;
                  const isGhostKill = !!killRecord?.isGhostKill;
                  const isForcedTarget = false;
                  const isForcedDisabled = Boolean(forcedParentCardLossChild && !isForcedChild);

                  let isBerserkerTarget = false;
                  if (isBerserkerChoosing && !isBerserkerOwner && !isPlayerDead) {
                    if (!isCardDead && c !== '+1 Vie') {
                      isBerserkerTarget = true;
                      customOnClick = () => {
                        setCandidateBerserkerTarget({
                          player: p,
                          cardIndex: ci,
                          cardName: c
                        });
                      };
                    }
                  }

                  const cardKey = (p.cardIds && p.cardIds[ci]) ? p.cardIds[ci] : `${p.id}-${ci}-${c}`;

                  return (
                    <CardBadge 
                      key={cardKey} 
                      card={c} 
                      cardIndex={ci}
                      playerName={p.name}
                      isDeadProp={isCardDead}
                      isGhostProp={isGhostKill}
                      isPlaying={isPlaying} 
                      nightCount={nightCount} 
                      hasPlayedNight1={hasPlayedNight1} 
                      isFinished={isFinished} 
                      customOnClick={customOnClick}
                      isSelected={isSelected}
                      natureChildMode={natureChildMode}
                      onRequestRevive={(candidate) => setReviveCandidate(candidate)}
                      onGameEnd={() => handleGameEndRef.current()} 
                      hasActiveExtraLife={playerHasExtraLife}
                      onBlockedExtraLife={(pName) => setExtraLifeBlockedPlayer(pName)}
                      onAddExtraLife={(pName) => handleAddExtraLife(pName)}
                      onConsumeExtraLife={(pName, idx) => handleConsumeExtraLife(pName, idx)}
                      isGentlemanChoosing={isGentlemanChoosing}
                      onGentlemanEliminated={(giver) => handleGentlemanEliminated(giver)}
                      onElfDwarfEliminated={(role, pName) => handleElfDwarfEliminated(role, pName)}
                      isForcedTarget={isForcedTarget}
                      isForcedDisabled={isForcedDisabled}
                      isBerserkerTarget={isBerserkerTarget}
                      isBerserkerChoosing={isBerserkerChoosing}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }, [res, isEditing, isPlaying, nightCount, hasPlayedNight1, isFinished, natureChildMode, natureChildMaster, selectedChildCard, selectedMasterCard, gameHistory, gentlemanStep, gentlemanGiver, forcedParentCardLossChild, berserkerStep, berserkerEvent]);

  return (
    <div className="h-screen h-[100dvh] min-h-screen bg-neutral-950 text-gray-200 font-serif flex overflow-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Lato:wght@400;700&display=swap');
        .font-serif { font-family: 'Cinzel', serif; }
        .font-sans { font-family: 'Lato', sans-serif; }
        .role-mort { text-decoration: line-through; opacity: 0.5; }
        .joueur-mort { animation: deathRedToGrayscale 6s ease-in-out forwards; }
        
        /* Custom Scrollbar */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #262626; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #404040; }
        * { scrollbar-width: thin; scrollbar-color: #262626 transparent; }
      `}</style>
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-[60] w-72 max-w-[85vw] bg-neutral-900 border-r border-neutral-800 flex flex-col p-4 gap-2 transition-transform duration-300 md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} shadow-2xl`}>
        <div className="flex items-center gap-3 px-2 py-4 border-b border-neutral-800 mb-2">
          {/* Logo Renard & Spectre */}
          <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 flex items-center justify-center border border-neutral-700/60 bg-neutral-950/60 shadow-md">
            <img 
              src="/Untitled%20design.png" 
              alt="Logo Renard & Spectre" 
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex items-center flex-1 min-w-0">
            <span className="font-bold text-gray-100 tracking-wide whitespace-nowrap font-serif text-[17px]">
              Renard & Spectre
            </span>
          </div>
        </div>
        <button onClick={() => { if (isPlaying) saveCurrentGameRef.current(); setTab('ordre'); setIsSidebarOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${tab === 'ordre' ? 'bg-neutral-800 text-white border-neutral-700 shadow-inner' : 'text-gray-400 border-transparent hover:bg-neutral-800 hover:text-white'}`}>
          <ScrollText size={20} />
          <span>{showNight ? `Ordre (Nuit ${nightCount})` : 'Ordre'}</span>
        </button>
        <button onClick={() => { if (isPlaying) saveCurrentGameRef.current(); setTab('audio'); setIsSidebarOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${tab === 'audio' ? 'bg-neutral-800 text-white border-neutral-700 shadow-inner' : 'text-gray-400 border-transparent hover:bg-neutral-800 hover:text-white'}`}><Music size={20} /> Musique</button>
        <button onClick={() => { if (isPlaying) saveCurrentGameRef.current(); setTab('sfx'); setIsSidebarOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${tab === 'sfx' ? 'bg-neutral-800 text-white border-neutral-700 shadow-inner' : 'text-gray-400 border-transparent hover:bg-neutral-800 hover:text-white'}`}><Volume2 size={20} /> Effets sonores</button>
        <button onClick={() => { if (isPlaying) saveCurrentGameRef.current(); setTab('history'); setIsSidebarOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${tab === 'history' ? 'bg-neutral-800 text-white border-neutral-700 shadow-inner' : 'text-gray-400 border-transparent hover:bg-neutral-800 hover:text-white'}`}><History size={20} /> Anciennes parties</button>
        
        <div className="mt-auto pt-4 border-t border-neutral-800 flex flex-col items-center justify-center">
          <span className="text-xs text-gray-500 uppercase tracking-widest mb-1 font-sans">Temps de jeu</span>
          <span className="text-2xl font-mono text-gray-300 font-bold tracking-wider">{formatChrono(elapsedTime)}</span>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full h-[100dvh] max-h-screen max-h-[100dvh] overflow-hidden relative">
        <header className="h-16 md:h-20 border-b border-neutral-800 flex items-center px-4 md:px-8 bg-neutral-900/80 backdrop-blur-md gap-4 z-10 shadow-lg shrink-0">
          <button 
            className="md:hidden p-2 text-gray-200 hover:bg-neutral-800 rounded-lg border border-transparent hover:border-neutral-700"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-2 md:hidden">
            {/* Logo Mobile */}
            <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 flex items-center justify-center border border-neutral-700/60 bg-neutral-950/60 shadow-sm">
              <img 
                src="/Untitled%20design.png" 
                alt="Logo Renard & Spectre" 
                className="w-full h-full object-contain"
              />
            </div>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-100 truncate tracking-widest drop-shadow-md">
            {tab === 'audio' 
              ? 'Musique' 
              : tab === 'sfx'
                ? 'Effets sonores'
                : tab === 'history' 
                  ? 'Anciennes parties' 
                  : (!res ? 'Configuration' : (isPlaying ? 'Plateau de jeu' : 'Génération'))}
          </h1>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 md:p-8 pb-32 sm:pb-24 z-0 [webkit-overflow-scrolling:touch]">
          <div className={`max-w-4xl mx-auto space-y-6 ${tab === 'ordre' ? 'block' : 'hidden'}`}>
            {!res ? (
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 md:p-8 shadow-xl space-y-6 relative overflow-hidden group h-auto min-h-fit">
                  <h2 className="text-xl font-bold flex items-center gap-2 text-gray-200"><Settings className="text-orange-600" /> Configuration de la partie</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <NumberControl label="Âmes (Joueurs)" value={N} min={4} max={14} onChange={(v: number) => { setN(v); if (C > maxC) setC(maxC); }} />
                    <NumberControl label={`Destins (Cartes Max ${maxC})`} value={C} min={3} max={maxC} onChange={setC} />
                  </div>
                  {err && <div className="text-red-300 bg-red-950/40 border border-red-900/50 p-4 rounded-lg flex items-center gap-2"><AlertTriangle size={20} /> {err}</div>}
                  <div className="space-y-3">
                    <button onClick={() => gen()} className="w-full bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all uppercase tracking-widest cursor-pointer">
                      Invoquer la Partie
                    </button>
                    <button 
                      type="button"
                      onClick={() => setExclusionModalStep('warning')}
                      className="w-full bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-gray-300 hover:text-white font-bold py-3.5 px-4 rounded-xl shadow transition-all uppercase tracking-wider text-sm flex items-center justify-center gap-2 cursor-pointer group"
                    >
                      <Filter size={16} className="text-orange-500 group-hover:scale-110 transition-transform" />
                      <span>Exclure des cartes</span>
                      {excludedCardsCount > 0 && (
                        <span className="ml-1 text-xs font-sans font-bold bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded-full">
                          {excludedCardsCount} {excludedCardsCount > 1 ? 'cartes retirées' : 'carte retirée'}
                        </span>
                      )}
                    </button>
                    {excludedCardsCount > 0 && (
                      <div className="flex items-center justify-between text-xs text-gray-400 px-1 font-sans">
                        <span>Deck ajusté : <strong className="text-gray-200">{totalActiveCards}</strong> / 42 cartes</span>
                        <button 
                          type="button" 
                          onClick={resetDeckCounts} 
                          className="text-orange-400 hover:text-orange-300 underline underline-offset-2 flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw size={12} /> Rétablir le deck complet
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {!isPlaying ? (
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <h2 className="text-2xl font-bold text-gray-100 drop-shadow-lg">{gameName || "Le Cercle"}</h2>
                      <div className="grid grid-cols-2 gap-[10px] w-full">
                        <button onClick={() => { setRes(null); setElapsedTime(0); setGameHistory([]); setPotions({ heal: 2, death: 2 }); setNightPotionsUsed({ heal: false, death: false }); setNightCount(1); setHasPlayedNight1(false); setCheckedRoles([]); setGentlemanGiver(null); setGentlemanStep(null); setCandidateGentlemanTarget(null); setExtraLifeBlockedPlayer(null); setElfDwarfEvent(null); setParentChildren([]); setParentBondBroken(false); setShowParentModal(false); setPendingParentTargetLoss(null); setForcedParentCardLossChild(null); }} className="flex items-center justify-center gap-2 bg-neutral-900 px-4 py-3 rounded-xl border border-neutral-800 hover:bg-neutral-800 text-gray-300 hover:text-white transition-colors shadow-md"><Settings size={18} /> Config</button>
                        <button onClick={gen} className="flex items-center justify-center gap-2 bg-neutral-800 px-4 py-3 rounded-xl border border-neutral-700 text-white hover:bg-neutral-700 transition-colors shadow-lg"><RefreshCw size={18} /> Relancer</button>
                        <button onClick={() => setIsEditing(!isEditing)} className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all border ${isEditing ? 'bg-green-900/30 text-green-200 border-green-800' : 'bg-neutral-900 text-gray-300 border-neutral-800 hover:bg-neutral-800'}`}>
                          {isEditing ? <Check size={18} /> : <UserPen size={18} />}
                          {isEditing ? 'Sauver' : 'Renommer'}
                        </button>
                        <button onClick={() => setIsNamingGame(true)} className="flex items-center justify-center gap-2 bg-blue-900/40 text-blue-100 border border-blue-800/50 px-4 py-3 rounded-xl hover:bg-blue-900/60 transition-colors shadow-lg"><ArrowRight size={18} /> Continuer</button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 flex flex-col items-center gap-2">
                      {gentlemanStep === 'choosing' ? (
                        <>
                          <h2 className="text-2xl md:text-3xl font-black text-emerald-400 tracking-widest uppercase drop-shadow-lg font-serif">
                            DON DE VIE DU GENTIL HOMME (OBLIGATOIRE)
                          </h2>
                          <p className="text-gray-300 text-sm max-w-lg font-sans">
                            Cliquez sur le joueur choisi par <strong className="text-white">{gentlemanGiver}</strong> pour lui transmettre obligatoirement une vie (<strong className="text-red-400 font-bold">+1 Vie</strong>).
                          </p>
                        </>
                      ) : natureChildMode === 'choose_master' ? (
                        <>
                          <h2 className="text-2xl md:text-3xl font-black text-amber-500 tracking-widest uppercase drop-shadow-lg font-serif">
                            L'ENFANT DE LA NATURE CHOISIT SON MAÎTRE
                          </h2>
                          <p className="text-gray-300 text-sm max-w-lg font-sans">
                            Cliquez sur le joueur que l'Enfant de la nature désigne comme son maître.
                          </p>
                        </>
                      ) : natureChildMode === 'steal_card' ? (
                        <>
                          <h2 className="text-2xl md:text-3xl font-black text-purple-400 tracking-widest uppercase drop-shadow-lg font-serif">
                            L'ENFANT VOLE LA CARTE DE SON MAÎTRE
                          </h2>
                          <p className="text-gray-300 text-sm max-w-lg font-sans">
                            {!selectedChildCard 
                              ? "Cliquez sur une carte encore en jeu de l'Enfant de la nature à échanger." 
                              : "Cliquez sur la carte encore en jeu du Maître à voler."}
                          </p>
                        </>
                      ) : forcedParentCardLossChild ? (
                        <div className="w-full bg-gradient-to-r from-amber-950/95 via-neutral-900 to-amber-950/95 border-2 border-amber-600 rounded-2xl p-4 sm:p-5 text-center shadow-2xl space-y-3 animate-in fade-in max-w-xl mx-auto">
                          <div className="flex items-center justify-center gap-2 text-amber-400 font-bold font-serif text-lg sm:text-xl">
                            <AlertTriangle size={24} className="animate-bounce text-amber-400 shrink-0" />
                            <span>LIEN DU PARENT : ÉLIMINATION OBLIGATOIRE</span>
                          </div>
                          <p className="text-gray-200 text-sm sm:text-base font-sans">
                            L'enfant lié <strong className="text-white font-bold">{forcedParentCardLossChild.playerName}</strong> doit obligatoirement perdre sa première carte encore en jeu.
                          </p>
                          <p className="text-gray-400 text-xs italic font-sans">
                            Le bloc Ordre est bloqué tant que sa carte n'a pas été éliminée.
                          </p>
                          <div className="pt-1 flex flex-wrap items-center justify-center gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setParentBondBroken(true);
                                parentBondBrokenRef.current = true;
                                setForcedParentCardLossChild(null);
                                forcedParentCardLossChildRef.current = null;
                              }}
                              className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-amber-300 hover:text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
                            >
                              Les 2 enfants sont morts d'un coup (Annuler le pouvoir)
                            </button>
                          </div>
                        </div>
                      ) : !hasPlayedNight1 ? (
                        <>
                          <h2 className="text-3xl font-black text-orange-500 tracking-widest uppercase drop-shadow-lg animate-pulse font-serif">DISTRIBUTION DES RÔLES</h2>
                          <p className="text-gray-400 text-sm max-w-md font-sans italic">Une fois la distribution des cartes effectuée, les joueurs prennent connaissance de leur rôle et s'endorment.</p>
                          <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
                            <button onClick={() => { 
                              setHasPlayedNight1(true);
                              setShowNight(true); 
                              setCheckedRoles([]); 
                            }} className="flex items-center gap-2 bg-neutral-900 px-6 py-3 rounded-xl border border-neutral-700 text-base hover:bg-neutral-800 transition-all text-gray-200 hover:text-white shadow-lg font-bold tracking-wider">🌙 S'endormir</button>
                            <button
                              type="button"
                              onClick={() => setShowGhostRitualModal(true)}
                              className="flex items-center gap-2.5 bg-neutral-900 hover:bg-neutral-800 border border-cyan-800/70 hover:border-cyan-500 px-4 py-3 rounded-xl transition-all text-cyan-200 hover:text-white shadow-lg group cursor-pointer"
                              title="Rituel des Fantômes : cliquer pour voir le détail des cartes éliminées"
                            >
                              <div className="flex items-center gap-1.5 font-bold font-serif text-cyan-300">
                                <span className="text-lg leading-none group-hover:scale-110 transition-transform">👻</span>
                                <span className="hidden sm:inline">Rituel :</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs font-mono">
                                <span 
                                  className={`px-2 py-0.5 rounded border transition-colors ${
                                    ghostInnocentsCount >= 1 
                                      ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-300 font-bold' 
                                      : 'bg-neutral-800/90 border-neutral-700 text-gray-400'
                                  }`}
                                  title={`Innocent éliminé par les fantômes : ${ghostInnocentsCount}/1`}
                                >
                                  Innocent {ghostInnocentsCount}/1
                                </span>
                                <span 
                                  className={`px-2 py-0.5 rounded border transition-colors ${
                                    ghostRenardsCount >= 1 
                                      ? 'bg-orange-950/80 border-orange-500/80 text-orange-300 font-bold' 
                                      : 'bg-neutral-800/90 border-neutral-700 text-gray-400'
                                  }`}
                                  title={`Renard éliminé par les fantômes : ${ghostRenardsCount}/1`}
                                >
                                  Renard {ghostRenardsCount}/1
                                </span>
                                <span 
                                  className={`px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
                                    ghostFantomesCount >= 1 
                                      ? 'bg-cyan-950/80 border-cyan-500/80 text-cyan-300 font-bold' 
                                      : 'bg-neutral-800/90 border-neutral-700 text-gray-400'
                                  }`}
                                  title={`Fantôme éliminé par les fantômes (👻) : ${ghostFantomesCount}/1`}
                                >
                                  <span>👻</span> Fantôme {ghostFantomesCount}/1
                                </span>
                              </div>
                            </button>
                            {hasPendingVictory && !isFinished && (
                              <button
                                type="button"
                                onClick={() => checkVictoryConditions(handleGameEndRef.current)}
                                className="flex items-center gap-2 bg-gradient-to-r from-amber-600/90 to-orange-600/90 hover:from-amber-500 hover:to-orange-500 border border-amber-400/80 px-4 py-3 rounded-xl transition-all text-white shadow-[0_0_15px_rgba(245,158,11,0.35)] font-bold tracking-wider animate-pulse group cursor-pointer font-serif text-sm sm:text-base"
                                title="Les conditions de victoire sont remplies : cliquer pour afficher la fin de partie ou continuer"
                              >
                                <Trophy size={18} className="text-yellow-200 group-hover:scale-110 transition-transform" />
                                <span>Aucune autre élimination</span>
                              </button>
                            )}
                            {berserkerStep === 'choosing' && berserkerEvent && (
                              <button
                                type="button"
                                onClick={() => {
                                  setBerserkerStep(null);
                                  setBerserkerEvent(null);
                                  setCandidateBerserkerTarget(null);
                                  setBerserkerNoEffectPlayer(null);
                                  checkVictoryConditions(handleGameEndRef.current);
                                  setTimeout(() => saveCurrentGameRef.current(), 300);
                                }}
                                className="flex items-center gap-2 bg-gradient-to-r from-rose-950/95 to-red-950/95 hover:from-rose-900 hover:to-red-900 border-2 border-rose-500/90 px-4 py-3 rounded-xl transition-all text-rose-100 hover:text-white shadow-[0_0_15px_rgba(244,63,94,0.35)] font-bold tracking-wider animate-pulse group cursor-pointer font-serif text-sm sm:text-base"
                                title="Si plus aucun joueur n'a de carte au même rang ou si le berserker ne peut éliminer personne : le pouvoir est annulé et le jeu continue"
                              >
                                <Swords size={18} className="text-rose-400 group-hover:scale-110 transition-transform shrink-0" />
                                <span>Pouvoir Berserker annulé (Aucune carte similaire à éliminer)</span>
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <h2 className="text-3xl font-black text-orange-500 tracking-widest uppercase drop-shadow-lg animate-pulse font-serif">NUIT {nightCount} - LA FORÊT S'ÉVEILLE</h2>
                          <p className="text-gray-400 text-sm max-w-md font-sans">Narrateur, veuillez marquer les rôles éliminés : utilisez l'icône Fantôme (👻) exclusivement pour les éliminations dues au pouvoir des Fantômes (Rituel), et l'icône Coche Verte (✅) pour toutes les autres éliminations (Vote, pouvoirs de nuit, etc.). Une fois terminé, lancez la nuit suivante ci-dessous.</p>
                          <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
                            <button onClick={() => { 
                              setNightCount(n => n + 1);
                              setShowNight(true); 
                              setCheckedRoles([]); 
                            }} className="flex items-center gap-2 bg-neutral-900 px-6 py-3 rounded-xl border border-neutral-700 text-base hover:bg-neutral-800 transition-all text-gray-200 hover:text-white shadow-lg font-bold tracking-wider">🌙 S'endormir</button>
                            <button
                              type="button"
                              onClick={() => setShowGhostRitualModal(true)}
                              className="flex items-center gap-2.5 bg-neutral-900 hover:bg-neutral-800 border border-cyan-800/70 hover:border-cyan-500 px-4 py-3 rounded-xl transition-all text-cyan-200 hover:text-white shadow-lg group cursor-pointer"
                              title="Rituel des Fantômes : cliquer pour voir le détail des cartes éliminées"
                            >
                              <div className="flex items-center gap-1.5 font-bold font-serif text-cyan-300">
                                <span className="text-lg leading-none group-hover:scale-110 transition-transform">👻</span>
                                <span className="hidden sm:inline">Rituel :</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs font-mono">
                                <span 
                                  className={`px-2 py-0.5 rounded border transition-colors ${
                                    ghostInnocentsCount >= 1 
                                      ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-300 font-bold' 
                                      : 'bg-neutral-800/90 border-neutral-700 text-gray-400'
                                  }`}
                                  title={`Innocent éliminé par les fantômes : ${ghostInnocentsCount}/1`}
                                >
                                  Innocent {ghostInnocentsCount}/1
                                </span>
                                <span 
                                  className={`px-2 py-0.5 rounded border transition-colors ${
                                    ghostRenardsCount >= 1 
                                      ? 'bg-orange-950/80 border-orange-500/80 text-orange-300 font-bold' 
                                      : 'bg-neutral-800/90 border-neutral-700 text-gray-400'
                                  }`}
                                  title={`Renard éliminé par les fantômes : ${ghostRenardsCount}/1`}
                                >
                                  Renard {ghostRenardsCount}/1
                                </span>
                                <span 
                                  className={`px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${
                                    ghostFantomesCount >= 1 
                                      ? 'bg-cyan-950/80 border-cyan-500/80 text-cyan-300 font-bold' 
                                      : 'bg-neutral-800/90 border-neutral-700 text-gray-400'
                                  }`}
                                  title={`Fantôme éliminé par les fantômes (👻) : ${ghostFantomesCount}/1`}
                                >
                                  <span>👻</span> Fantôme {ghostFantomesCount}/1
                                </span>
                              </div>
                            </button>
                            {hasPendingVictory && !isFinished && (
                              <button
                                type="button"
                                onClick={() => checkVictoryConditions(handleGameEndRef.current)}
                                className="flex items-center gap-2 bg-gradient-to-r from-amber-600/90 to-orange-600/90 hover:from-amber-500 hover:to-orange-500 border border-amber-400/80 px-4 py-3 rounded-xl transition-all text-white shadow-[0_0_15px_rgba(245,158,11,0.35)] font-bold tracking-wider animate-pulse group cursor-pointer font-serif text-sm sm:text-base"
                                title="Les conditions de victoire sont remplies : cliquer pour afficher la fin de partie ou continuer"
                              >
                                <Trophy size={18} className="text-yellow-200 group-hover:scale-110 transition-transform" />
                                <span>Aucune autre élimination</span>
                              </button>
                            )}
                            {berserkerStep === 'choosing' && berserkerEvent && (
                              <button
                                type="button"
                                onClick={() => {
                                  setBerserkerStep(null);
                                  setBerserkerEvent(null);
                                  setCandidateBerserkerTarget(null);
                                  setBerserkerNoEffectPlayer(null);
                                  checkVictoryConditions(handleGameEndRef.current);
                                  setTimeout(() => saveCurrentGameRef.current(), 300);
                                }}
                                className="flex items-center gap-2 bg-gradient-to-r from-rose-950/95 to-red-950/95 hover:from-rose-900 hover:to-red-900 border-2 border-rose-500/90 px-4 py-3 rounded-xl transition-all text-rose-100 hover:text-white shadow-[0_0_15px_rgba(244,63,94,0.35)] font-bold tracking-wider animate-pulse group cursor-pointer font-serif text-sm sm:text-base"
                                title="Si plus aucun joueur n'a de carte au même rang ou si le berserker ne peut éliminer personne : le pouvoir est annulé et le jeu continue"
                              >
                                <Swords size={18} className="text-rose-400 group-hover:scale-110 transition-transform shrink-0" />
                                <span>Pouvoir Berserker annulé (Aucune carte similaire à éliminer)</span>
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {berserkerStep === 'choosing' && berserkerEvent && (
                    <div className="w-full bg-gradient-to-r from-rose-950/95 via-neutral-900 to-rose-950/95 border-2 border-rose-600 rounded-2xl p-4 sm:p-5 text-center shadow-2xl space-y-2 animate-in fade-in max-w-xl mx-auto my-2">
                      <div className="flex items-center justify-center gap-2 text-rose-400 font-bold font-serif text-base sm:text-lg">
                        <Swords size={20} className="text-rose-400 shrink-0 animate-pulse" />
                        <span>POUVOIR DU BERSERKER (VENGEANCE)</span>
                      </div>
                      <p className="text-gray-200 text-xs sm:text-sm font-sans leading-relaxed">
                        Le joueur <strong className="text-rose-300 font-bold">{berserkerEvent.playerName}</strong> a perdu son Berserker. Il choisit qui perd sa carte du même rang (ex : carte n°3 en partant du haut).
                      </p>
                      <p className="text-gray-400 text-[11px] sm:text-xs font-sans">
                        Cliquez sur la carte ou sur le joueur choisi pour l'éliminer. Si plus personne ne possède de carte à éliminer à ce rang, le pouvoir est annulé.
                      </p>
                    </div>
                  )}
                  {renderedGameBoard}
                  {isPlaying && (
                    <div className="mt-8 mb-16 sm:mb-8 flex flex-col gap-4 pb-12 sm:pb-0">
                      <button onClick={() => setShowDebrief(true)} className="w-full bg-neutral-900 border border-neutral-700 text-gray-300 py-4 rounded-xl hover:bg-neutral-800 hover:text-white transition-colors font-bold uppercase tracking-wider shadow-lg font-serif">Journal des pertes</button>
                      {!isConfirmingStop ? (
                        <button onClick={() => setIsConfirmingStop(true)} className="w-full bg-red-950/30 border border-red-900/50 text-red-200 py-4 rounded-xl hover:bg-red-950/50 transition-colors font-bold uppercase tracking-wider shadow-lg font-serif">Arrêter la partie</button>
                      ) : (
                        <div className="flex gap-4">
                          <button onClick={() => { saveCurrentGameRef.current(); setRes(null); setIsPlaying(false); setIsFinished(false); setIsConfirmingStop(false); setGameId(null); setElapsedTime(0); setGameHistory([]); setPotions({ heal: 2, death: 2 }); setNightCount(1); setHasPlayedNight1(false); setCheckedRoles([]); setShowGhostRitualModal(false); setReviveCandidate(null); setHasPendingVictory(false); setPendingVictoryTitles([]); }} className="flex-1 bg-red-900/80 text-white py-4 rounded-xl hover:bg-red-800 transition-colors font-bold uppercase tracking-wider border border-red-700 shadow-lg font-serif">Confirmer</button>
                          <button onClick={() => setIsConfirmingStop(false)} className="flex-1 bg-neutral-800 text-gray-300 py-4 rounded-xl border border-neutral-700 hover:bg-neutral-700 transition-colors font-bold uppercase tracking-wider shadow-lg font-serif">Annuler</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          <div className={`max-w-2xl mx-auto bg-neutral-900 border border-neutral-800 rounded-xl p-6 sm:p-8 text-center space-y-6 shadow-2xl relative ${tab === 'audio' ? 'block' : 'hidden'}`}>
            <div className="space-y-1">
              <div className="text-orange-500 text-xs sm:text-sm uppercase tracking-[0.2em] font-bold">Lecture en cours</div>
              <div className="text-3xl sm:text-4xl font-black text-gray-100 font-serif drop-shadow-md truncate">{track}</div>
              {(() => {
                const activePl = PLAYLISTS.find(p => p.id === playingPlaylistId) || PLAYLISTS.find(p => p.tracks.includes(track));
                if (!activePl || track === 'Aucune') return null;
                const trackIdx = activePl.tracks.indexOf(track);
                return (
                  <div className="text-xs text-neutral-400 font-sans flex items-center justify-center gap-1.5 pt-1">
                    <ListMusic size={13} className="text-orange-500" />
                    <span>Playlist : <strong className="text-gray-200 font-serif">{activePl.name}</strong></span>
                    {trackIdx !== -1 && (
                      <span className="text-neutral-500 font-mono">
                        ({trackIdx + 1}/{activePl.tracks.length})
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-center gap-4 sm:gap-6">
              <button 
                type="button"
                onClick={handlePrevTrack} 
                disabled={track === 'Aucune'}
                className="w-12 h-12 rounded-full bg-neutral-950 border border-neutral-800 flex items-center justify-center text-gray-400 hover:text-white hover:border-neutral-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-md cursor-pointer"
                title="Morceau précédent"
              >
                <SkipBack size={20} />
              </button>

              <button 
                type="button"
                onClick={() => { if (track !== 'Aucune') setPlay(!play); }} 
                className="w-20 h-20 rounded-full bg-neutral-800 border-2 border-neutral-700 flex items-center justify-center text-white shadow-xl hover:scale-105 transition-transform hover:border-orange-500 cursor-pointer"
                title={play ? "Pause" : "Lecture"}
              >
                {play ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
              </button>

              <button 
                type="button"
                onClick={handleNextTrack} 
                disabled={track === 'Aucune'}
                className="w-12 h-12 rounded-full bg-neutral-950 border border-neutral-800 flex items-center justify-center text-gray-400 hover:text-white hover:border-neutral-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-md cursor-pointer"
                title="Morceau suivant"
              >
                <SkipForward size={20} />
              </button>
            </div>

            {track !== 'Aucune' && (
              <div className="flex flex-col gap-2 w-full max-w-md mx-auto">
                <div className="flex justify-between text-xs text-gray-400 font-sans">
                  <span>{formatTime(progress)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max={duration || 100} 
                  value={progress} 
                  onChange={handleSeek} 
                  className="w-full h-2 bg-neutral-800 rounded-lg appearance-none accent-orange-700 cursor-pointer" 
                />
              </div>
            )}
            
            <div className="flex items-center justify-center gap-4 max-w-xs mx-auto bg-neutral-950/50 p-3 rounded-xl border border-neutral-800">
              <Volume2 size={20} className="text-gray-400" />
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.01" 
                value={volume} 
                onChange={(e) => setVolume(parseFloat(e.target.value))} 
                className="w-full h-2 bg-neutral-800 rounded-lg appearance-none accent-orange-700 cursor-pointer" 
              />
            </div>

            {/* Section Playlists */}
            <div className="pt-4 border-t border-neutral-800 text-left mt-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-orange-500 font-bold">
                  <ListMusic size={16} />
                  <span>Playlists</span>
                </div>
                <button
                  type="button"
                  onClick={refreshAudioScan}
                  disabled={isRefreshingAudio}
                  className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-orange-400 transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-neutral-800 disabled:opacity-50"
                  title="Scanner les fichiers audio ajoutés"
                >
                  <RefreshCw size={12} className={isRefreshingAudio ? 'animate-spin text-orange-400' : ''} />
                  <span>{isRefreshingAudio ? 'Recherche en cours...' : 'Actualiser les fichiers'}</span>
                </button>
              </div>

              {/* Cartes et boutons de lancement pour chacune des 3 playlists */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                {PLAYLISTS.map((pl) => {
                  const isSelected = currentPlaylistId === pl.id;
                  const isPlayingThis = playingPlaylistId === pl.id && play && pl.tracks.includes(track);
                  const isPausedThis = playingPlaylistId === pl.id && !play && pl.tracks.includes(track);
                  const hasTracks = pl.tracks.length > 0;

                  return (
                    <div
                      key={pl.id}
                      onClick={() => setCurrentPlaylistId(pl.id)}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-neutral-850 border-orange-600 text-white shadow-lg ring-1 ring-orange-500/40'
                          : 'bg-neutral-950/80 border-neutral-800 text-gray-400 hover:bg-neutral-900 hover:text-gray-200 hover:border-neutral-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="font-serif font-bold text-sm tracking-wide truncate text-left text-gray-100">
                            {pl.name}
                          </span>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono shrink-0 ${
                            isSelected 
                              ? 'bg-orange-950/80 text-orange-300 border border-orange-800/60' 
                              : 'bg-neutral-900 text-neutral-500'
                          }`}>
                            {pl.tracks.length} {pl.tracks.length > 1 ? 'titres' : 'titre'}
                          </span>
                        </div>
                        {isPlayingThis && (
                          <div className="text-[11px] text-orange-400 truncate text-left font-serif flex items-center gap-1.5 mt-1">
                            <span className="inline-block w-2 h-2 rounded-full bg-orange-500 animate-pulse shrink-0" />
                            <span className="truncate">{track}</span>
                          </div>
                        )}
                      </div>

                      {/* Bouton pour pouvoir lancer la playlist */}
                      <div className="mt-3 pt-2.5 border-t border-neutral-800/70">
                        {hasTracks ? (
                          <button
                            type="button"
                            onClick={(e) => handlePlayPlaylist(pl.id, e)}
                            className={`w-full py-2 px-3 rounded-lg text-xs font-bold font-serif flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer ${
                              isPlayingThis
                                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/50'
                                : isPausedThis
                                ? 'bg-orange-700/80 hover:bg-orange-600 text-white'
                                : 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-950/40 hover:scale-[1.02]'
                            }`}
                            title={isPlayingThis ? 'Mettre en pause' : `Lancer ${pl.name}`}
                          >
                            {isPlayingThis ? (
                              <>
                                <Pause size={13} />
                                <span>Pause</span>
                              </>
                            ) : isPausedThis ? (
                              <>
                                <Play size={13} fill="currentColor" />
                                <span>Reprendre</span>
                              </>
                            ) : (
                              <>
                                <Play size={13} fill="currentColor" />
                                <span>Lancer la playlist</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="w-full py-2 px-3 rounded-lg text-xs font-serif flex items-center justify-center gap-1.5 bg-neutral-900/60 text-neutral-600 border border-neutral-800/60 cursor-not-allowed"
                          >
                            <Play size={12} className="opacity-40" />
                            <span>Playlist vide</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Vue détaillée de la playlist sélectionnée */}
              {(() => {
                const activePlaylist = PLAYLISTS.find(p => p.id === currentPlaylistId) || PLAYLISTS[2];
                const isPlayingThisActive = playingPlaylistId === activePlaylist.id && play && activePlaylist.tracks.includes(track);

                return (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-800/80">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-orange-600/10 border border-orange-600/30 flex items-center justify-center text-orange-400">
                          <Disc size={18} className={isPlayingThisActive ? "animate-[spin_4s_linear_infinite]" : ""} />
                        </div>
                        <div className="text-left">
                          <h3 className="font-serif font-bold text-gray-100 tracking-wide text-base leading-tight">
                            {activePlaylist.name}
                          </h3>
                          <span className="text-xs text-neutral-400 font-sans">
                            {activePlaylist.tracks.length} morceau{activePlaylist.tracks.length > 1 ? 'x' : ''}
                          </span>
                        </div>
                      </div>

                      {/* Bouton pour lancer la playlist sélectionnée */}
                      {activePlaylist.tracks.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handlePlayPlaylist(activePlaylist.id)}
                          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold font-serif flex items-center gap-2 transition-all shadow-md cursor-pointer ${
                            isPlayingThisActive
                              ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/40'
                              : 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-900/40 hover:scale-105'
                          }`}
                        >
                          {isPlayingThisActive ? (
                            <>
                              <Pause size={15} />
                              <span>Mettre en pause</span>
                            </>
                          ) : (
                            <>
                              <Play size={15} fill="currentColor" />
                              <span>Lancer la playlist</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {activePlaylist.tracks.length === 0 ? (
                      <div className="bg-neutral-950/70 border border-dashed border-neutral-800 rounded-xl p-8 text-center space-y-2">
                        <ListMusic size={32} className="mx-auto text-neutral-600 mb-1" />
                        <p className="font-serif text-sm text-gray-300 font-bold uppercase tracking-wider">
                          Playlist vide
                        </p>
                        <p className="text-xs text-neutral-500 font-sans">
                          Cette playlist ne contient aucun morceau pour l'instant.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {activePlaylist.tracks.map((t, idx) => {
                          const isCurrentTrack = playingPlaylistId === activePlaylist.id && track === t;
                          return (
                            <div
                              key={t}
                              onClick={() => handleSelectTrack(activePlaylist.id, t)}
                              className={`p-4 rounded-xl cursor-pointer border transition-all flex items-center justify-between ${
                                isCurrentTrack
                                  ? 'bg-neutral-800 border-orange-700 text-white shadow-md'
                                  : 'bg-neutral-950 border-neutral-800 text-gray-300 hover:bg-neutral-900 hover:text-white hover:border-neutral-700'
                              }`}
                            >
                              <div className="flex items-center gap-3 truncate">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                  isCurrentTrack && play
                                    ? 'bg-orange-600/20 text-orange-400 border border-orange-600/50'
                                    : 'bg-neutral-900 text-neutral-400'
                                }`}>
                                  {isCurrentTrack && play ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                                </div>
                                <div className="text-left truncate">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-neutral-500 font-mono">#{idx + 1}</span>
                                    <span className="font-serif tracking-wide text-base truncate text-gray-100">{t}</span>
                                  </div>
                                </div>
                              </div>

                              {isCurrentTrack && (
                                <span className="text-[11px] font-sans font-medium px-2 py-0.5 rounded-full bg-orange-950/80 text-orange-400 border border-orange-800/60 shrink-0 ml-2">
                                  {play ? 'En lecture' : 'En pause'}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* PANEL EFFETS SONORES */}
          <div className={`max-w-4xl mx-auto h-full p-4 md:p-8 space-y-6 ${tab === 'sfx' ? 'block' : 'hidden'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-neutral-800 gap-4">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-orange-500 tracking-widest uppercase font-serif flex items-center gap-3">
                  <Volume2 className="text-orange-500" /> Effets sonores
                </h2>
                <p className="text-sm text-gray-400 font-sans mt-1">
                  Activez ou désactivez les effets sonores contextuels de la partie.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const shouldEnable = !sfxSettings.enabled;
                    setSfxSettings({
                      enabled: shouldEnable,
                      playerEliminated: shouldEnable,
                      foxEliminated: shouldEnable,
                      ghostEliminated: shouldEnable,
                    });
                  }}
                  className={`px-4 py-2.5 rounded-xl font-bold font-serif text-xs uppercase tracking-wider transition-all border flex items-center gap-2 cursor-pointer shadow-md ${
                    sfxSettings.enabled
                      ? 'bg-neutral-900 border-orange-700/60 text-orange-400 hover:bg-neutral-800 hover:text-orange-300'
                      : 'bg-neutral-900 border-neutral-700 text-gray-400 hover:bg-neutral-800 hover:text-gray-200'
                  }`}
                  title={sfxSettings.enabled ? 'Désactiver tous les effets sonores' : 'Activer tous les effets sonores'}
                >
                  {sfxSettings.enabled ? (
                    <>
                      <VolumeX size={16} /> Désactiver tout
                    </>
                  ) : (
                    <>
                      <Volume2 size={16} /> Activer tout
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Sound Cards List */}
            <div className="space-y-4">
              {/* 1. Élimination d'un joueur (Grabuge rigole) */}
              <div className={`bg-neutral-900 border rounded-xl p-5 sm:p-6 transition-all shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                sfxSettings.enabled && sfxSettings.playerEliminated ? 'border-neutral-800' : 'border-neutral-800/60 opacity-60'
              }`}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-950/50 border border-purple-800/60 text-purple-400 flex items-center justify-center shrink-0 shadow-inner">
                    <Skull size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-gray-100 font-serif text-lg">Élimination d'un joueur</h4>
                      <span className="text-[11px] font-sans font-bold px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800/60">
                        Rire de Grabuge
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-400 font-sans mt-1">
                      Déclenché chaque fois qu'un joueur perd sa dernière carte et est éliminé de la partie.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-800/80">
                  <button
                    type="button"
                    onClick={() => playGrabuge({ force: true })}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-gray-300 hover:text-white cursor-pointer text-xs font-serif uppercase tracking-wider font-bold transition-all shadow-sm"
                    title="Écouter le son de Grabuge"
                  >
                    <Play size={14} />
                    <span>Écouter</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSfxSettings(prev => ({ ...prev, playerEliminated: !prev.playerEliminated }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      sfxSettings.playerEliminated ? 'bg-orange-600' : 'bg-neutral-800'
                    }`}
                    title={sfxSettings.playerEliminated ? 'Désactiver' : 'Activer'}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        sfxSettings.playerEliminated ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* 2. Élimination d'un Renard */}
              <div className={`bg-neutral-900 border rounded-xl p-5 sm:p-6 transition-all shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                sfxSettings.enabled && sfxSettings.foxEliminated ? 'border-neutral-800' : 'border-neutral-800/60 opacity-60'
              }`}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-orange-950/50 border border-orange-800/60 text-orange-400 flex items-center justify-center shrink-0 shadow-inner">
                    <span className="text-xl">🦊</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-gray-100 font-serif text-lg">Élimination d'un Renard</h4>
                      <span className="text-[11px] font-sans font-bold px-2 py-0.5 rounded-full bg-orange-950/80 text-orange-300 border border-orange-800/60">
                        Renards
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-400 font-sans mt-1">
                      Déclenché chaque fois qu'une carte de l'Allégeance Renard est éliminée.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-800/80">
                  <button
                    type="button"
                    onClick={() => playRenard({ force: true })}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-gray-300 hover:text-white cursor-pointer text-xs font-serif uppercase tracking-wider font-bold transition-all shadow-sm"
                    title="Écouter le son du Renard"
                  >
                    <Play size={14} />
                    <span>Écouter</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSfxSettings(prev => ({ ...prev, foxEliminated: !prev.foxEliminated }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      sfxSettings.foxEliminated ? 'bg-orange-600' : 'bg-neutral-800'
                    }`}
                    title={sfxSettings.foxEliminated ? 'Désactiver' : 'Activer'}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        sfxSettings.foxEliminated ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* 3. Élimination d'un Fantôme */}
              <div className={`bg-neutral-900 border rounded-xl p-5 sm:p-6 transition-all shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                sfxSettings.enabled && sfxSettings.ghostEliminated ? 'border-neutral-800' : 'border-neutral-800/60 opacity-60'
              }`}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-cyan-950/50 border border-cyan-800/60 text-cyan-400 flex items-center justify-center shrink-0 shadow-inner">
                    <span className="text-2xl leading-none">👻</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-gray-100 font-serif text-lg">Élimination d'un Fantôme</h4>
                      <span className="text-[11px] font-sans font-bold px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
                        Fantômes
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-400 font-sans mt-1">
                      Déclenché chaque fois qu'une carte de l'Allégeance Fantôme est éliminée.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-800/80">
                  <button
                    type="button"
                    onClick={() => playFantome({ force: true })}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-gray-300 hover:text-white cursor-pointer text-xs font-serif uppercase tracking-wider font-bold transition-all shadow-sm"
                    title="Écouter le son du Fantôme"
                  >
                    <Play size={14} />
                    <span>Écouter</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSfxSettings(prev => ({ ...prev, ghostEliminated: !prev.ghostEliminated }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      sfxSettings.ghostEliminated ? 'bg-orange-600' : 'bg-neutral-800'
                    }`}
                    title={sfxSettings.ghostEliminated ? 'Désactiver' : 'Activer'}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        sfxSettings.ghostEliminated ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className={`max-w-4xl mx-auto h-full p-4 md:p-8 ${tab === 'history' ? 'block' : 'hidden'}`}>
            <h2 className="text-3xl font-black text-orange-500 mb-8 tracking-widest uppercase font-serif border-b border-neutral-800 pb-4">Anciennes parties</h2>
              {savedGames.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center space-y-4">
                  <History size={64} className="text-neutral-700" />
                  <h3 className="text-2xl font-bold text-gray-400 font-serif tracking-widest uppercase">Aucune ancienne partie trouvée</h3>
                  <p className="text-gray-500">Les parties terminées apparaîtront ici.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {savedGames.map((game: any) => (
                    <div key={game.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 flex flex-col md:flex-row justify-between items-center gap-4 shadow-lg">
                      <div>
                        <h3 className="text-xl font-bold text-gray-200 font-serif">{game.name}</h3>
                        <p className="text-sm text-gray-500 font-sans">{new Date(game.date).toLocaleString('fr-FR')} • {game.state.N} Joueurs</p>
                      </div>
                      <button 
                        onClick={() => loadGame(game)}
                        className="w-full md:w-auto bg-orange-700 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold uppercase tracking-wider shadow-lg transition-colors"
                      >
                        Reprendre
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
        </div>

        {showNight && (
          <div className={`absolute inset-0 z-30 bg-neutral-950 text-gray-300 flex flex-col p-4 md:p-6 overflow-y-auto font-serif animate-in fade-in duration-500 ${tab === 'ordre' ? 'flex' : 'hidden'}`}>
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-6 gap-2">
              <button 
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-gray-300 hover:text-white transition-all shadow-md font-sans text-sm md:hidden"
                title="Ouvrir le menu"
              >
                <Menu size={20} />
                <span className="font-medium">Menu</span>
              </button>

              <h1 className="text-xl sm:text-2xl md:text-4xl font-black text-center flex-1 text-orange-600 tracking-widest drop-shadow-lg font-serif">
                Le Tableau du Narrateur - NUIT {nightCount}
              </h1>

              <button 
                type="button"
                onClick={() => setTab('audio')}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-gray-300 hover:text-white transition-all shadow-md font-sans text-sm"
                title="Accéder à la musique"
              >
                <Music size={18} className="text-orange-500" />
                <span className="hidden sm:inline font-medium">Musique</span>
              </button>
            </div>
            <div className="flex-1 max-w-2xl mx-auto w-full space-y-4">
            {(() => {
              const activeRoles = ORDRE_NUIT.filter(role => {
                const allBadges = Array.from(document.querySelectorAll('.role-badge'));
                const inGameCards = res ? res.flatMap((p: any) => p.cards) : allBadges.map(b => b.textContent || '');
                const aliveBadges = allBadges.filter(b => !b.classList.contains('role-mort')).map(b => b.textContent || '');
                const aliveNames = allBadges.length > 0 ? aliveBadges : inGameCards;

                if (role === 'Enfant de la nature') {
                  const childPlayer = (natureChildPlayerId && res?.find((p: any) => p.id === natureChildPlayerId)) 
                    || res?.find((p: any) => p.cards.includes('Enfant de la nature'));

                  const pcs = Array.from(document.querySelectorAll('.player-card'));
                  const childIdx = childPlayer && res ? res.findIndex((p: any) => p.id === childPlayer.id) : -1;
                  const childCardEl = childIdx >= 0 ? pcs[childIdx] : null;

                  const isChildPlayerDeadDom = childCardEl 
                    ? (childCardEl.classList.contains('joueur-mort') || childCardEl.querySelectorAll('.role-badge:not(.role-mort)').length === 0)
                    : false;

                  const childLivingCardsCountState = childPlayer ? childPlayer.cards.filter((c: string, ci: number) => {
                    const hasIndexKill = (gameHistory || []).some((h: any) => h.playerName === childPlayer.name && h.cardIndex === ci);
                    if (hasIndexKill) return false;
                    const legacyKills = (gameHistory || []).filter((h: any) => h.playerName === childPlayer.name && h.originalRole === c && h.cardIndex === undefined);
                    const legacyBefore = childPlayer.cards.slice(0, ci).filter((rc: string) => rc === c && !(gameHistory || []).some((h: any) => h.playerName === childPlayer.name && h.cardIndex === ci)).length;
                    return legacyKills.length <= legacyBefore;
                  }).length : 0;

                  const isChildPlayerDead = isChildPlayerDeadDom || (childPlayer ? childLivingCardsCountState === 0 : false);

                  // Si le joueur qui possède l'Enfant de la nature meurt durant le même tour (ou est éliminé),
                  // il n'a plus de carte en vie pour échanger : il ne doit plus être appelé !
                  if (isChildPlayerDead) return false;

                  if (nightCount === 1) {
                    return aliveNames.includes('Enfant de la nature');
                  }

                  if (hasStolenMasterCard) return false;

                  const deadBadge = allBadges.find(b => b.textContent === 'Enfant de la nature' && b.classList.contains('role-mort'));
                  if (!deadBadge) return false;

                  const isDeathLastTurn = parseInt(deadBadge.getAttribute('data-death-turn') || '0', 10) === nightCount - 1;
                  return isDeathLastTurn;
                }
                if (role === 'Omniscient') return nightCount % 2 !== 0 && aliveNames.includes('Omniscient');
                if (['Parent', 'Mineur', 'Super voyant'].includes(role)) return nightCount === 1 && aliveNames.includes(role);
                if (role === 'Renard') return aliveNames.some(n => ['Renard', 'Renardeau', 'Chef des renards', 'Traître'].includes(n));
                if (role === 'Fantôme') return aliveNames.some(n => ['Fantôme', 'Chef des fantômes'].includes(n));
                if (role === 'Alchimiste') return aliveNames.includes('Alchimiste') && (potions.heal > 0 || potions.death > 0);
                return aliveNames.includes(role);
              });
              
              const allChecked = activeRoles.every(r => checkedRoles.includes(r));

              return (
                <>
                  {activeRoles.map(role => {
                    const isChecked = checkedRoles.includes(role);
                    return (
                      <div key={role} 
                        onClick={() => {
                          if (role === 'Enfant de la nature') {
                            if (nightCount === 1 && !natureChildMaster) return;
                            if (nightCount > 1 && !hasStolenMasterCard) return;
                          }
                          if (role === 'Super voyant') {
                            if (nightCount === 1 && !superVoyantTarget) {
                              setShowSuperVoyantModal(true);
                              return;
                            }
                          }
                          if (role === 'Parent') {
                            if (nightCount === 1 && parentChildren.length < 2) {
                              setTempParentChildren(parentChildren.length === 2 ? parentChildren : []);
                              setShowParentModal(true);
                              return;
                            }
                          }
                          setCheckedRoles(prev => prev.includes(role) ? prev : [...prev, role]);
                        }} 
                        className={`flex items-center gap-4 text-xl md:text-2xl cursor-pointer transition-all p-4 border rounded-xl shadow-lg group select-none relative overflow-hidden ${isChecked ? 'bg-neutral-900 border-neutral-800 text-gray-600' : 'bg-neutral-800 border-neutral-700 hover:text-white hover:border-neutral-600 hover:bg-neutral-700'}`}
                      >
                        <div className={`w-8 h-8 border-2 rounded-lg flex items-center justify-center transition-colors shadow-md z-10 ${isChecked ? 'bg-neutral-800 border-neutral-800' : 'bg-neutral-700 border-neutral-600 group-hover:border-white'}`}>
                          {isChecked && <Check size={20} className="text-neutral-600" />}
                        </div>
                        <span className={`z-10 font-serif tracking-wide ${isChecked ? 'line-through decoration-neutral-600 decoration-2' : 'text-gray-200'}`}>Appeler {role === 'Renard' ? 'les Renards' : role === 'Fantôme' ? 'les Fantômes' : /^[AEIOUYH]/i.test(role) ? `l'${role}` : `le ${role}`}</span>

                        {role === 'Parent' && nightCount === 1 && (
                          <div className="ml-auto flex items-center gap-3 z-10" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              disabled={isChecked}
                              onClick={(e) => {
                                e.stopPropagation();
                                setTempParentChildren(parentChildren.length === 2 ? parentChildren : []);
                                setShowParentModal(true);
                              }}
                              className={`px-4 py-2 rounded-xl border text-sm font-sans font-bold shadow-md transition-all flex items-center gap-1.5 ${
                                isChecked 
                                  ? 'bg-neutral-800 text-neutral-500 border-neutral-700 cursor-not-allowed'
                                  : parentChildren.length === 2
                                  ? 'bg-amber-900/90 hover:bg-amber-800 border-amber-500/80 text-amber-100 hover:text-white hover:scale-105 active:scale-95'
                                  : 'bg-amber-950/80 hover:bg-amber-900 border-amber-700/80 text-amber-200 hover:text-white hover:scale-105 active:scale-95'
                              }`}
                              title={parentChildren.length === 2 ? "Modifier les 2 enfants désignés" : "Choisir les 2 enfants désignés par le Parent"}
                            >
                              <span>{parentChildren.length === 2 ? "Choisi (2)" : "Choisir"}</span>
                            </button>
                          </div>
                        )}

                        {role === 'Enfant de la nature' && (
                          <div className="ml-auto flex items-center gap-3 z-10" onClick={(e) => e.stopPropagation()}>
                            {nightCount === 1 ? (
                              <button
                                type="button"
                                disabled={isChecked}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setNatureChildMode('choose_master');
                                  setNatureChildPopup('choose_intro');
                                  setShowNight(false);
                                }}
                                className={`px-4 py-2 rounded-xl border text-sm font-sans font-bold shadow-md transition-all flex items-center gap-1.5 ${
                                  isChecked 
                                    ? 'bg-neutral-800 text-neutral-500 border-neutral-700 cursor-not-allowed'
                                    : 'bg-amber-950/80 hover:bg-amber-900 border-amber-700/80 text-amber-200 hover:text-white hover:scale-105 active:scale-95'
                                }`}
                                title="Choisir le maître de l'Enfant de la nature"
                              >
                                <span>Choisir</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={isChecked}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const child = (natureChildPlayerId && res?.find((p: any) => p.id === natureChildPlayerId)) 
                                    || res?.find((p: any) => p.cards.includes('Enfant de la nature'));
                                  const pcs = Array.from(document.querySelectorAll('.player-card'));
                                  const childIdx = child && res ? res.findIndex((p: any) => p.id === child.id) : -1;
                                  const childCardEl = childIdx >= 0 ? pcs[childIdx] : null;
                                  const isChildDead = childCardEl 
                                    ? (childCardEl.classList.contains('joueur-mort') || childCardEl.querySelectorAll('.role-badge:not(.role-mort)').length === 0)
                                    : false;
                                  if (isChildDead) return;

                                  setNatureChildMode('steal_card');
                                  setNatureChildPopup('steal_intro');
                                  setShowNight(false);
                                }}
                                className={`px-4 py-2 rounded-xl border text-sm font-sans font-bold shadow-md transition-all flex items-center gap-1.5 ${
                                  isChecked 
                                    ? 'bg-neutral-800 text-neutral-500 border-neutral-700 cursor-not-allowed'
                                    : 'bg-purple-950/80 hover:bg-purple-900 border-purple-700/80 text-purple-200 hover:text-white hover:scale-105 active:scale-95'
                                }`}
                                title="Voler une carte au maître"
                              >
                                <span>Voler</span>
                              </button>
                            )}
                          </div>
                        )}
                        
                        {role === 'Alchimiste' && (
                          <div className="ml-auto flex items-center gap-3 z-10" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1.5 bg-neutral-950/80 px-2.5 py-1.5 rounded-xl border border-neutral-800 shadow-inner">
                              {[0, 1].map(i => {
                                const isAvailable = i < potions.heal;
                                const isBlockedTonight = nightPotionsUsed.heal && isAvailable;
                                const canClick = isAvailable && !nightPotionsUsed.heal && !isChecked;
                                return (
                                  <button 
                                    key={`h-${i}`} 
                                    type="button"
                                    disabled={!canClick}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!canClick) return;
                                      setPotions(p => ({ ...p, heal: Math.max(0, p.heal - 1) }));
                                      setNightPotionsUsed(prev => ({ ...prev, heal: true }));
                                    }} 
                                    className={`p-1 rounded-lg transition-all flex items-center justify-center ${
                                      !isAvailable 
                                        ? 'text-neutral-700 opacity-25 cursor-not-allowed' 
                                        : isBlockedTonight
                                        ? 'text-rose-900/60 opacity-40 cursor-not-allowed'
                                        : 'text-rose-500 hover:text-rose-400 hover:scale-115 filter drop-shadow-[0_0_8px_rgba(244,63,94,0.8)] cursor-pointer'
                                    }`}
                                    title={
                                      !isAvailable 
                                        ? 'Potion de Vie (déjà consommée)' 
                                        : isBlockedTonight 
                                        ? 'Potion de Vie (limité à 1 par nuit)' 
                                        : 'Utiliser Potion de Vie (1 max par nuit)'
                                    }
                                  >
                                    <Heart size={22} className={isAvailable && !isBlockedTonight ? 'fill-rose-500' : isBlockedTonight ? 'fill-rose-950/40' : ''} />
                                  </button>
                                );
                              })}
                            </div>
                            <div className="flex items-center gap-1.5 bg-neutral-950/80 px-2.5 py-1.5 rounded-xl border border-neutral-800 shadow-inner">
                              {[0, 1].map(i => {
                                const isAvailable = i < potions.death;
                                const isBlockedTonight = nightPotionsUsed.death && isAvailable;
                                const canClick = isAvailable && !nightPotionsUsed.death && !isChecked;
                                return (
                                  <button 
                                    key={`d-${i}`} 
                                    type="button"
                                    disabled={!canClick}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!canClick) return;
                                      setPotions(p => ({ ...p, death: Math.max(0, p.death - 1) }));
                                      setNightPotionsUsed(prev => ({ ...prev, death: true }));
                                    }} 
                                    className={`p-1 rounded-lg transition-all flex items-center justify-center ${
                                      !isAvailable 
                                        ? 'text-neutral-700 opacity-25 cursor-not-allowed' 
                                        : isBlockedTonight
                                        ? 'text-purple-950/60 opacity-40 cursor-not-allowed'
                                        : 'text-purple-300 hover:text-purple-200 hover:scale-115 filter drop-shadow-[0_0_8px_rgba(192,132,252,0.8)] cursor-pointer'
                                    }`}
                                    title={
                                      !isAvailable 
                                        ? 'Potion de Mort (déjà consommée)' 
                                        : isBlockedTonight 
                                        ? 'Potion de Mort (limité à 1 par nuit)' 
                                        : 'Utiliser Potion de Mort (1 max par nuit)'
                                    }
                                  >
                                    <Skull size={22} className={isAvailable && !isBlockedTonight ? 'fill-purple-950/50' : ''} />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {role === 'Super voyant' && nightCount === 1 && (
                          <div className="ml-auto flex items-center gap-3 z-10" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              disabled={isChecked}
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowSuperVoyantModal(true);
                              }}
                              className={`px-4 py-2 rounded-xl border text-sm font-sans font-bold shadow-md transition-all flex items-center gap-1.5 ${
                                isChecked 
                                  ? 'bg-neutral-800 text-neutral-500 border-neutral-700 cursor-not-allowed'
                                  : superVoyantTarget
                                  ? 'bg-indigo-900/90 hover:bg-indigo-800 border-indigo-500/80 text-indigo-100 hover:text-white hover:scale-105 active:scale-95'
                                  : 'bg-indigo-950/80 hover:bg-indigo-900 border-indigo-700/80 text-indigo-200 hover:text-white hover:scale-105 active:scale-95'
                              }`}
                              title={superVoyantTarget ? "Revoir le choix du Super voyant" : "Faire le choix du Super voyant"}
                            >
                              <span>{superVoyantTarget ? "Choisi" : "Choisir"}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="mt-8 flex justify-center">
                    {allChecked && (
                      <button 
                        onClick={() => { 
                          setShowNight(false); 
                          setNightPotionsUsed({ heal: false, death: false }); 
                          setTimeout(() => {
                            checkVictoryConditions(handleGameEndRef.current);
                          }, 150);
                        }} 
                        className="bg-neutral-900 border border-neutral-800 text-white px-8 py-3 rounded-xl font-bold hover:bg-neutral-800 hover:text-white transition-all shadow-lg uppercase tracking-widest animate-in fade-in zoom-in font-serif"
                      >
                        Afficher le Plateau
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
            </div>
          </div>
        )}
      </main>

      {/* Popups & Confirmation Modals for Enfant de la nature */}

      {/* 1. Intro Popup: Choisir son maître */}
      {natureChildPopup === 'choose_intro' && (
        <div className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-neutral-900 border-2 border-amber-600/80 rounded-2xl p-6 md:p-8 max-w-lg w-full shadow-2xl text-center space-y-6">
            <h3 className="text-2xl md:text-3xl font-black text-amber-500 font-serif tracking-wide">
              L'Enfant de la Nature
            </h3>
            <p className="text-gray-200 text-lg leading-relaxed">
              L'enfant de la nature choisit le joueur qu'il désigne comme son maître.
            </p>
            <button
              type="button"
              onClick={() => setNatureChildPopup(null)}
              className="w-full py-4 px-6 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold uppercase tracking-wider transition-all shadow-lg shadow-amber-900/40 font-serif text-lg"
            >
              Désigner le Maître
            </button>
          </div>
        </div>
      )}

      {/* 2. Confirmation Modal: Choisir son maître */}
      {candidateMaster && (
        <div className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-neutral-900 border-2 border-amber-600/80 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl text-center space-y-6">
            <h3 className="text-2xl font-bold text-amber-500 font-serif">Confirmation du Maître</h3>
            <p className="text-gray-200 text-lg">
              Désigner <span className="font-bold text-white underline decoration-amber-500">{candidateMaster.name}</span> comme maître de l'Enfant de la nature ?
            </p>
            <div className="flex justify-center gap-6 pt-2">
              <button
                type="button"
                onClick={() => setCandidateMaster(null)}
                className="w-16 h-16 rounded-2xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-red-400 hover:text-red-300 flex items-center justify-center shadow-lg transition-all hover:scale-105"
                title="Invalider (choisir un autre joueur)"
              >
                <X size={32} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setNatureChildMaster(candidateMaster.id);
                  setCandidateMaster(null);
                  setNatureChildMode(null);
                  setCheckedRoles(prev => prev.includes('Enfant de la nature') ? prev : [...prev, 'Enfant de la nature']);
                  setShowNight(true);
                }}
                className="w-16 h-16 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-900/40 transition-all hover:scale-105"
                title="Valider ce maître"
              >
                <Check size={32} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Intro Popup: Voler la carte */}
      {natureChildPopup === 'steal_intro' && (
        <div className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-neutral-900 border-2 border-purple-600/80 rounded-2xl p-6 md:p-8 max-w-lg w-full shadow-2xl text-center space-y-6">
            <h3 className="text-2xl md:text-3xl font-black text-purple-400 font-serif tracking-wide">
              Vol de Compétence
            </h3>
            <p className="text-gray-200 text-lg leading-relaxed">
              L'enfant de la nature peut échanger une de ses cartes encore en jeu contre une carte encore en jeu de son maître. Si son maître est totalement éliminé, alors l'enfant de la nature ne vole aucune carte.
            </p>
            <button
              type="button"
              onClick={handleContinueStealIntro}
              className="w-full py-4 px-6 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold uppercase tracking-wider transition-all shadow-lg shadow-purple-900/40 font-serif text-lg"
            >
              Continuer
            </button>
          </div>
        </div>
      )}

      {/* 4. Popup: Maître totalement éliminé */}
      {natureChildPopup === 'master_dead' && (
        <div className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-neutral-900 border-2 border-neutral-700 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-red-950/80 border border-red-700 flex items-center justify-center mx-auto text-red-400">
              <Skull size={32} />
            </div>
            <h3 className="text-2xl font-bold text-gray-200 font-serif">Maître Éliminé</h3>
            <p className="text-gray-300 text-base leading-relaxed">
              Le maître de l'enfant de la nature est totalement éliminé. L'enfant de la nature ne vole aucune carte et retourne se coucher.
            </p>
            <button
              type="button"
              onClick={() => {
                setNatureChildMode(null);
                setNatureChildPopup(null);
                setHasStolenMasterCard(true);
                setCheckedRoles(prev => prev.includes('Enfant de la nature') ? prev : [...prev, 'Enfant de la nature']);
                setShowNight(true);
              }}
              className="w-full py-3.5 px-6 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold uppercase tracking-wider transition-all shadow-lg border border-neutral-700 font-serif"
            >
              Retour au Tableau
            </button>
          </div>
        </div>
      )}

      {/* 5. Confirmation Modal: Carte de l'enfant à échanger */}
      {pendingChildCard && (
        <div className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-neutral-900 border-2 border-emerald-600/80 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl text-center space-y-6">
            <h3 className="text-2xl font-bold text-emerald-400 font-serif">Carte à Échanger</h3>
            <p className="text-gray-200 text-lg">
              Échanger la carte <span className="font-bold text-white underline decoration-emerald-500">{pendingChildCard}</span> de l'Enfant de la nature ?
            </p>
            <div className="flex justify-center gap-6 pt-2">
              <button
                type="button"
                onClick={() => setPendingChildCard(null)}
                className="w-16 h-16 rounded-2xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-red-400 hover:text-red-300 flex items-center justify-center shadow-lg transition-all hover:scale-105"
                title="Invalider (choisir une autre carte)"
              >
                <X size={32} />
              </button>
              <button
                type="button"
                onClick={() => {
                  const childCardToUse = pendingChildCard;
                  setPendingChildCard(null);
                  if (selectedMasterCard) {
                    performCardSwap(childCardToUse!, selectedMasterCard);
                    setSelectedChildCard(null);
                    setSelectedMasterCard(null);
                    setNatureChildPopup('steal_success');
                  } else {
                    setSelectedChildCard(childCardToUse);
                  }
                }}
                className="w-16 h-16 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-900/40 transition-all hover:scale-105"
                title="Confirmer cette carte"
              >
                <Check size={32} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Confirmation Modal: Carte du maître à voler */}
      {pendingMasterCard && (
        <div className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-neutral-900 border-2 border-purple-600/80 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl text-center space-y-6">
            <h3 className="text-2xl font-bold text-purple-400 font-serif">Carte à Voler</h3>
            <p className="text-gray-200 text-lg">
              Voler la carte <span className="font-bold text-white underline decoration-purple-500">{pendingMasterCard}</span> du Maître ?
            </p>
            <div className="flex justify-center gap-6 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPendingMasterCard(null);
                }}
                className="w-16 h-16 rounded-2xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-red-400 hover:text-red-300 flex items-center justify-center shadow-lg transition-all hover:scale-105"
                title="Invalider (choisir une autre carte)"
              >
                <X size={32} />
              </button>
              <button
                type="button"
                onClick={() => {
                  const masterCardToUse = pendingMasterCard;
                  setPendingMasterCard(null);
                  if (selectedChildCard) {
                    performCardSwap(selectedChildCard, masterCardToUse!);
                    setSelectedChildCard(null);
                    setSelectedMasterCard(null);
                    setNatureChildPopup('steal_success');
                  } else {
                    setSelectedMasterCard(masterCardToUse);
                  }
                }}
                className="w-16 h-16 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center shadow-lg shadow-purple-900/40 transition-all hover:scale-105"
                title="Confirmer le vol"
              >
                <Check size={32} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Popup: Succès du vol */}
      {natureChildPopup === 'steal_success' && (
        <div className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-neutral-900 border-2 border-amber-600/80 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-amber-950/80 border border-amber-700 flex items-center justify-center mx-auto text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
              <Check size={32} />
            </div>
            <h3 className="text-2xl font-bold text-amber-500 font-serif">Compétence Apprise</h3>
            <p className="text-gray-200 text-lg leading-relaxed">
              L'enfant de la nature a grandi et il a appris la compétence de son maître.
            </p>
            <button
              type="button"
              onClick={() => {
                setNatureChildMode(null);
                setNatureChildPopup(null);
                setSelectedChildCard(null);
                setSelectedMasterCard(null);
                setHasStolenMasterCard(true);
                setCheckedRoles(prev => prev.includes('Enfant de la nature') ? prev : [...prev, 'Enfant de la nature']);
                setShowNight(true);
              }}
              className="w-full py-4 px-6 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold uppercase tracking-wider transition-all shadow-lg shadow-amber-900/40 font-serif text-lg"
            >
              Retour au Tableau
            </button>
          </div>
        </div>
      )}

      {/* Audio element always mounted to keep playing across tabs */}
      <audio 
        ref={audioRef} 
        src={currentAudioSrc} 
        autoPlay={play}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleTrackEnded}
      />

      {/* Naming Game Modal */}
      {isNamingGame && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-2xl max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-black text-orange-500 mb-6 tracking-widest uppercase font-serif text-center">Nommer la partie</h2>
            <input 
              type="text" 
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder="Entrez le nom de la partie..."
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-orange-700 transition-colors font-sans mb-8"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && gameName.trim()) {
                  const newId = Date.now().toString();
                  setGameId(newId);
                  setIsNamingGame(false);
                  setIsFinished(false);
                  setIsPlaying(true);
                  setNightCount(1);
                  setHasPlayedNight1(false);
                  setElapsedTime(0);
                  setGameHistory([]);
                  setParentChildren([]);
                  setTempParentChildren([]);
                  setShowParentModal(false);
                  setPendingParentTargetLoss(null);
                  setForcedParentCardLossChild(null);
                  setParentBondBroken(false);
                  parentChildrenRef.current = [];
                  parentBondBrokenRef.current = false;
                  forcedParentCardLossChildRef.current = null;
                  setTimeout(() => saveCurrentGameRef.current(), 500);
                }
              }}
            />
            <div className="flex gap-4">
              <button 
                onClick={() => setIsNamingGame(false)} 
                className="flex-1 py-3 rounded-xl font-bold uppercase tracking-wider text-gray-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                Annuler
              </button>
              <button 
                disabled={!gameName.trim()}
                onClick={() => {
                  const newId = Date.now().toString();
                  setGameId(newId);
                  setIsNamingGame(false);
                  setIsFinished(false);
                  setIsPlaying(true);
                  setNightCount(1);
                  setHasPlayedNight1(false);
                  setElapsedTime(0);
                  setGameHistory([]);
                  setParentChildren([]);
                  setTempParentChildren([]);
                  setShowParentModal(false);
                  setPendingParentTargetLoss(null);
                  setForcedParentCardLossChild(null);
                  setParentBondBroken(false);
                  parentChildrenRef.current = [];
                  parentBondBrokenRef.current = false;
                  forcedParentCardLossChildRef.current = null;
                  setTimeout(() => saveCurrentGameRef.current(), 500);
                }} 
                className="flex-1 bg-orange-700 hover:bg-orange-600 text-white py-3 rounded-xl font-bold uppercase tracking-wider shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Commencer l'aventure
              </button>
            </div>
          </div>
        </div>
      )}

      {showDebrief && (
        <div 
          onClick={() => setShowDebrief(false)}
          className="fixed inset-0 z-[10000] bg-black/95 flex flex-col items-center justify-center p-4 md:p-12 animate-in fade-in duration-300 font-serif"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="max-w-2xl w-full mx-auto relative bg-neutral-900 border border-neutral-700 p-8 rounded-xl shadow-2xl text-gray-200"
          >
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowDebrief(false);
              }} 
              className="absolute top-4 right-4 z-30 text-gray-400 hover:text-white transition-colors bg-neutral-800 hover:bg-neutral-700 rounded-full p-2 cursor-pointer shadow-md border border-neutral-700 flex items-center justify-center"
              title="Fermer le journal des pertes"
            >
              <X size={20} />
            </button>
            <h2 className="text-3xl font-black mb-6 border-b border-neutral-700 pb-4 uppercase tracking-wider text-orange-500 drop-shadow-md">Journal des Pertes</h2>
            
            <div className="space-y-3 overflow-y-auto max-h-[60vh] text-lg pr-4">
              {gameHistory.length === 0 ? (
                <div className="text-gray-400 italic font-sans text-center py-4">Aucune perte enregistrée durant cette opération.</div>
              ) : (
                [...gameHistory].sort((a, b) => a.time - b.time).map((h, i) => {
                  const cleanRole = h.originalRole?.trim() || '';
                  let roleType = getType(cleanRole);
                  if (roleType === 'I') {
                    const lower = cleanRole.toLowerCase();
                    if (lower.includes('renard')) roleType = 'R';
                    else if (lower.includes('fantôme') || lower.includes('fantome')) roleType = 'F';
                    else if (lower.includes('chasseur') || lower.includes('tueur') || lower.includes('solo')) roleType = 'S';
                  }
                  const roleColor = roleType === 'R' ? 'text-orange-400 border-orange-400/30 bg-orange-900/20' :
                                    roleType === 'F' ? 'text-cyan-400 border-cyan-400/30 bg-cyan-900/20' :
                                    roleType === 'S' ? 'text-purple-400 border-purple-400/30 bg-purple-900/20' :
                                    'text-gray-300 border-gray-600/50 bg-gray-800/30';
                  
                  return (
                    <div key={i} className="py-3 flex sm:flex-row flex-col sm:items-center justify-between gap-3 border-b border-neutral-800/50 last:border-0 font-sans">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-red-500/80 font-bold hidden sm:inline">—</span>
                        <span className="text-white font-bold uppercase tracking-wider text-lg">{h.playerName}</span>
                        <span className={`text-xs font-bold uppercase tracking-widest px-2 py-1 rounded border ${roleColor}`}>{h.originalRole}</span>
                      </div>
                      <span className="text-gray-400 font-mono shrink-0 bg-black/50 px-3 py-1.5 rounded-md text-sm whitespace-nowrap self-start sm:self-auto block w-full sm:w-auto text-center">[{h.turn ? `Nuit ${h.turn} • ` : ''}{formatChrono(h.time || 0)}]</span>
                    </div>
                  );
                })
              )}
            </div>
            <div className="mt-8 text-center sm:text-right">
              <button 
                onClick={() => setShowDebrief(false)} 
                className="bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-3 px-8 rounded-xl border border-neutral-600 uppercase tracking-widest transition-all shadow-lg"
              >Fermer le rapport</button>
            </div>
          </div>
        </div>
      )}

      {showGhostRitualModal && (
        <div className="fixed inset-0 z-[10000] bg-black/95 flex flex-col items-center justify-center p-4 md:p-8 animate-in fade-in duration-300 font-sans">
          <div className="max-w-2xl w-full mx-auto relative bg-neutral-900 border border-cyan-800/80 p-6 md:p-8 rounded-2xl shadow-2xl text-gray-200">
            <button 
              type="button"
              onClick={() => setShowGhostRitualModal(false)} 
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors bg-neutral-800 rounded-full p-2"
              title="Fermer"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-cyan-950/90 border border-cyan-700 flex items-center justify-center text-cyan-400 shrink-0">
                <span className="text-3xl leading-none">👻</span>
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-black font-serif uppercase tracking-wider text-cyan-300 drop-shadow-md">
                  Rituel des Fantômes
                </h2>
                <p className="text-xs md:text-sm text-gray-400 font-sans mt-0.5">
                  Pour remporter la victoire, les Fantômes doivent éliminer avec leur pouvoir (icône 👻) : 1 Innocent, 1 Renard et 1 Fantôme.
                </p>
              </div>
            </div>

            {/* Grille des 3 objectifs */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-4 my-6">
              {/* Innocent */}
              <div className={`p-3 sm:p-4 rounded-xl border flex flex-col items-center text-center transition-all ${ghostInnocentsCount >= 1 ? 'bg-emerald-950/40 border-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-neutral-800/40 border-neutral-700/60'}`}>
                <div className="text-xs uppercase tracking-widest font-bold text-gray-400 mb-1">Innocent</div>
                <div className={`text-2xl sm:text-3xl font-black font-mono ${ghostInnocentsCount >= 1 ? 'text-emerald-400' : 'text-gray-400'}`}>
                  {ghostInnocentsCount} / 1
                </div>
                <div className="mt-2 text-xs font-semibold">
                  {ghostInnocentsCount >= 1 ? (
                    <span className="text-emerald-400 flex items-center justify-center gap-1 font-sans">✓ Sacrifié</span>
                  ) : (
                    <span className="text-gray-500 font-sans">En attente</span>
                  )}
                </div>
              </div>

              {/* Renard */}
              <div className={`p-3 sm:p-4 rounded-xl border flex flex-col items-center text-center transition-all ${ghostRenardsCount >= 1 ? 'bg-orange-950/40 border-orange-500/80 shadow-[0_0_15px_rgba(249,115,22,0.2)]' : 'bg-neutral-800/40 border-neutral-700/60'}`}>
                <div className="text-xs uppercase tracking-widest font-bold text-gray-400 mb-1">Renard</div>
                <div className={`text-2xl sm:text-3xl font-black font-mono ${ghostRenardsCount >= 1 ? 'text-orange-400' : 'text-gray-400'}`}>
                  {ghostRenardsCount} / 1
                </div>
                <div className="mt-2 text-xs font-semibold">
                  {ghostRenardsCount >= 1 ? (
                    <span className="text-orange-400 flex items-center justify-center gap-1 font-sans">✓ Sacrifié</span>
                  ) : (
                    <span className="text-gray-500 font-sans">En attente</span>
                  )}
                </div>
              </div>

              {/* Fantôme */}
              <div className={`p-3 sm:p-4 rounded-xl border flex flex-col items-center text-center transition-all ${ghostFantomesCount >= 1 ? 'bg-cyan-950/40 border-cyan-500/80 shadow-[0_0_15px_rgba(6,182,212,0.2)]' : 'bg-neutral-800/40 border-neutral-700/60'}`}>
                <div className="text-xs uppercase tracking-widest font-bold text-gray-400 mb-1 flex items-center justify-center gap-1.5">
                  <span className="text-sm">👻</span> Fantôme
                </div>
                <div className={`text-2xl sm:text-3xl font-black font-mono ${ghostFantomesCount >= 1 ? 'text-cyan-400' : 'text-gray-400'}`}>
                  {ghostFantomesCount} / 1
                </div>
                <div className="mt-2 text-xs font-semibold">
                  {ghostFantomesCount >= 1 ? (
                    <span className="text-cyan-400 flex items-center justify-center gap-1 font-sans">✓ Sacrifié</span>
                  ) : (
                    <span className="text-gray-500 font-sans">En attente</span>
                  )}
                </div>
              </div>
            </div>

            {/* Liste détaillée des cartes éliminées par les fantômes */}
            <div className="mt-4">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 border-b border-neutral-800 pb-2 flex items-center justify-between">
                <span>Détail des sacrifices ({ghostKills.length})</span>
                <span className="text-gray-500 text-[11px] font-mono">Ordre chronologique</span>
              </div>

              <div className="space-y-2.5 overflow-y-auto max-h-[38vh] pr-1">
                {ghostKills.length === 0 ? (
                  <div className="text-gray-400 italic text-center py-8 bg-neutral-950/40 rounded-xl border border-neutral-800/80">
                    Aucune carte n'a encore été éliminée par les Fantômes (icône 👻).
                  </div>
                ) : (
                  [...ghostKills].sort((a, b) => (a.time || 0) - (b.time || 0)).map((h: any, idx: number) => {
                    const roleType = getType(h.originalRole);
                    const badgeClass = roleType === 'R' 
                      ? 'bg-orange-900/40 text-orange-200 border-orange-700/50' 
                      : roleType === 'F' 
                      ? 'bg-cyan-900/40 text-cyan-200 border-cyan-700/50' 
                      : roleType === 'S'
                      ? 'bg-purple-900/40 text-purple-200 border-purple-700/50'
                      : 'bg-gray-800 text-gray-300 border-gray-600';
                    
                    const typeLabel = roleType === 'R' ? 'Renard' : roleType === 'F' ? 'Fantôme' : roleType === 'S' ? 'Solo' : 'Innocent';

                    return (
                      <div key={idx} className="bg-neutral-950/70 border border-neutral-800 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-neutral-700 transition-colors">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-cyan-400 font-bold text-lg">👻</span>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-white font-bold text-base">{h.playerName}</span>
                              <span className={`text-xs px-2.5 py-0.5 rounded border font-medium ${badgeClass}`}>
                                {h.originalRole}
                              </span>
                              <span className="text-[11px] text-gray-400 bg-neutral-800/80 px-2 py-0.5 rounded border border-neutral-700 font-mono">
                                Catégorie : {typeLabel}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-300 font-mono bg-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-800 shrink-0 self-start sm:self-auto">
                          {h.turn ? `Nuit ${h.turn}` : 'Avant Nuit 1'} {h.time !== undefined ? `• ${formatChrono(h.time)}` : ''}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGhostRitualModal(false)}
                className="bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-2.5 px-6 rounded-xl border border-neutral-600 uppercase tracking-wider text-sm transition-all shadow-md"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Vie supplémentaire active (+1 Vie) */}
      {extraLifeBlockedPlayer && (
        <div 
          onClick={() => setExtraLifeBlockedPlayer(null)}
          className="fixed inset-0 z-[10000] bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200 font-sans"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-neutral-900 border-2 border-red-600/80 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl text-center space-y-6 animate-in zoom-in-95 duration-200"
          >
            <div className="w-16 h-16 rounded-full bg-red-950/80 border border-red-500/80 flex items-center justify-center mx-auto text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
              <Heart size={32} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-2xl md:text-3xl font-black text-red-400 font-serif tracking-wide mb-2">
                Vie Supplémentaire Active
              </h3>
              <p className="text-gray-200 text-lg leading-relaxed">
                <strong className="text-white font-bold">{extraLifeBlockedPlayer}</strong> a une vie en plus (<strong className="text-red-400 font-bold">+1 Vie</strong>) qui doit être retirée avant de pouvoir procéder à la perte d'une carte.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setExtraLifeBlockedPlayer(null)}
              className="w-full py-3.5 px-6 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold uppercase tracking-wider text-sm transition-all shadow-lg shadow-red-900/40 font-serif cursor-pointer hover:scale-[1.02]"
            >
              Compris
            </button>
          </div>
        </div>
      )}

      {/* Modal 1: Don de vie du Gentil homme (Intro) */}
      {gentlemanStep === 'intro' && gentlemanGiver && (
        <div 
          onClick={() => {}}
          className="fixed inset-0 z-[10000] bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200 font-sans"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-neutral-900 border-2 border-emerald-600/80 rounded-2xl p-6 md:p-8 max-w-lg w-full shadow-2xl text-center space-y-6 animate-in zoom-in-95 duration-200"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-950/80 border border-emerald-500/80 flex items-center justify-center mx-auto text-red-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              <Heart size={32} className="animate-pulse fill-red-500 text-red-500" />
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl md:text-3xl font-black text-emerald-400 font-serif tracking-wide">
                Dernier Don du Gentil Homme
              </h3>
              <p className="text-gray-200 text-base md:text-lg leading-relaxed">
                Le joueur qui possédait cette carte (<strong className="text-white font-bold">{gentlemanGiver}</strong>) a été éliminé.
              </p>
              <div className="p-3.5 bg-neutral-950/80 rounded-xl border border-emerald-800/60 text-emerald-200 text-sm md:text-base leading-relaxed">
                Le don de vie est <strong>obligatoire</strong> : il doit transmettre une vie supplémentaire (<strong className="text-red-400 font-bold">+1 Vie</strong>) à un joueur encore en jeu.
              </div>
              <p className="text-amber-400 text-xs md:text-sm font-semibold flex items-center justify-center gap-1.5">
                <span>⚠️ Attention : il ne peut pas se la donner à lui-même.</span>
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setGentlemanStep('choosing');
                }}
                className="w-full py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider text-xs md:text-sm transition-all shadow-lg shadow-emerald-900/40 font-serif cursor-pointer hover:scale-[1.02]"
              >
                Choisir le joueur bénéficiaire (Obligatoire)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Confirmation du don de vie par le Gentil homme */}
      {candidateGentlemanTarget && gentlemanGiver && (
        <div 
          onClick={() => setCandidateGentlemanTarget(null)}
          className="fixed inset-0 z-[10000] bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200 font-sans"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-neutral-900 border-2 border-emerald-600/80 rounded-2xl p-6 md:p-8 max-w-lg w-full shadow-2xl text-center space-y-6 animate-in zoom-in-95 duration-200"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-950/80 border border-emerald-500/80 flex items-center justify-center mx-auto text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
              <Heart size={32} className="animate-pulse fill-red-500 text-red-500" />
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl md:text-3xl font-black text-emerald-400 font-serif tracking-wide">
                Confirmer le Don de Vie
              </h3>
              <p className="text-gray-200 text-base md:text-lg leading-relaxed">
                Voulez-vous donner une vie supplémentaire (<strong className="text-red-400 font-bold">+1 Vie</strong>) à <strong className="text-white font-bold">{candidateGentlemanTarget.name}</strong> de la part de <strong className="text-emerald-300 font-bold">{gentlemanGiver}</strong> ?
              </p>
              <p className="text-xs text-gray-400">
                Une carte +1 Vie sera ajoutée dans la main de {candidateGentlemanTarget.name}.
              </p>
            </div>
            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={() => setCandidateGentlemanTarget(null)}
                className="flex-1 py-3.5 px-6 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-gray-300 hover:text-white font-bold uppercase tracking-wider text-xs md:text-sm transition-all font-serif cursor-pointer"
              >
                Choisir un autre joueur
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetName = candidateGentlemanTarget.name;
                  handleAddExtraLife(targetName);
                  setCandidateGentlemanTarget(null);
                  setGentlemanStep(null);
                  setGentlemanGiver(null);
                }}
                className="flex-1 py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider text-sm transition-all shadow-lg shadow-emerald-900/40 font-serif cursor-pointer hover:scale-[1.02]"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Lien de l'Elfe et du Nain */}
      {elfDwarfEvent && (
        <div 
          onClick={() => {}}
          className="fixed inset-0 z-[10000] bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200 font-sans"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-neutral-900 border-2 border-amber-600/80 rounded-2xl p-6 md:p-8 max-w-lg w-full shadow-2xl text-center space-y-6 animate-in zoom-in-95 duration-200"
          >
            <div className="w-16 h-16 rounded-full bg-amber-950/80 border border-amber-500/80 flex items-center justify-center mx-auto text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
              <Heart size={32} className="animate-pulse fill-red-500 text-red-500" />
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl md:text-3xl font-black text-amber-400 font-serif tracking-wide">
                Lien de l'Elfe et du Nain
              </h3>
              <p className="text-gray-200 text-base md:text-lg leading-relaxed">
                Le joueur qui a l'<strong>{elfDwarfEvent.eliminatedRole}</strong> (<strong className="text-white font-bold">{elfDwarfEvent.eliminatedPlayerName}</strong>) vient d'être éliminé.
              </p>
              <div className="p-3.5 bg-neutral-950/80 rounded-xl border border-amber-800/60 text-amber-200 text-sm md:text-base leading-relaxed text-left space-y-1.5">
                <p className="font-semibold text-amber-300">📜 Règle du Duo :</p>
                <p className="text-gray-300">
                  Quand l'un est éliminé, l'autre (<strong className="text-white font-bold">{elfDwarfEvent.partnerPlayerName}</strong>, qui possède le <strong>{elfDwarfEvent.partnerRole}</strong>) reçoit une vie supplémentaire (<strong className="text-red-400 font-bold">+1 Vie</strong>).
                </p>
                <p className="text-amber-400/90 text-xs md:text-sm italic">
                  Attention : si les deux ont été éliminés en même temps (par exemple dû au Parent ou pendant la nuit), il ne faut pas de vie supplémentaire.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => setElfDwarfEvent(null)}
                className="flex-1 py-3.5 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-gray-300 hover:text-white font-bold uppercase tracking-wider text-xs md:text-sm transition-all font-serif cursor-pointer"
              >
                Éliminés en même temps (aucune vie)
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetName = elfDwarfEvent.partnerPlayerName;
                  handleAddExtraLife(targetName);
                  setElfDwarfEvent(null);
                }}
                className="flex-1 py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider text-xs md:text-sm transition-all shadow-lg shadow-emerald-900/40 font-serif cursor-pointer hover:scale-[1.02]"
              >
                Continuer (donner la vie)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up de confirmation de réanimation d'une carte éliminée */}
      {reviveCandidate && (
        <div className="fixed inset-0 z-[10000] bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300 font-sans">
          <div className="bg-neutral-900 border-2 border-emerald-600/80 rounded-2xl p-6 md:p-8 max-w-lg w-full shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-950/80 border border-emerald-500/80 flex items-center justify-center mx-auto text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              <Heart size={32} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-2xl md:text-3xl font-black text-emerald-400 font-serif tracking-wide mb-2">
                Réanimation de Carte
              </h3>
              <p className="text-gray-200 text-lg leading-relaxed">
                Le narrateur tente de ramener <strong className="text-emerald-300 underline underline-offset-4 decoration-emerald-500 font-bold">{reviveCandidate.cardName}</strong> de <strong className="text-white font-bold">{reviveCandidate.playerName}</strong> en jeu.
              </p>
              <p className="text-xs text-gray-400 mt-2 font-sans">
                Confirmer ramènera cette carte à la vie, la retirera de tous les journaux de perte et réévaluera les conditions de victoire.
              </p>
            </div>

            <div className="flex gap-4 pt-2">
              <button
                type="button"
                onClick={() => setReviveCandidate(null)}
                className="flex-1 py-3.5 px-6 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-gray-300 hover:text-white font-bold uppercase tracking-wider text-sm transition-all font-serif"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmRevive}
                className="flex-1 py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider text-sm transition-all shadow-lg shadow-emerald-900/40 font-serif"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up 1: Déclenchement du Pouvoir du Berserker à son élimination */}
      {berserkerStep === 'popup' && berserkerEvent && (
        <div 
          onClick={() => {}}
          className="fixed inset-0 z-[10000] bg-black/90 flex flex-col items-center justify-start sm:justify-center p-3 sm:p-4 md:p-6 backdrop-blur-sm animate-in fade-in duration-200 font-sans overflow-y-auto"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-neutral-900 border-2 border-rose-600/80 rounded-2xl p-4 sm:p-6 md:p-8 max-w-lg w-full shadow-2xl text-center space-y-4 sm:space-y-5 animate-in zoom-in-95 duration-200 my-auto shrink-0 max-h-[92dvh] overflow-y-auto"
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-rose-950/80 border border-rose-500/80 flex items-center justify-center mx-auto text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.3)] shrink-0">
              <Swords className="w-6 h-6 sm:w-7 sm:h-7 animate-pulse" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-rose-500 font-serif tracking-wide">
                Pouvoir du Berserker
              </h3>
              <p className="text-[11px] sm:text-xs uppercase tracking-widest text-rose-400 font-semibold font-sans">
                Vengeance du Guerrier
              </p>
            </div>

            <div className="bg-neutral-950/90 border border-rose-600/60 rounded-xl p-3.5 sm:p-5 text-left space-y-2.5 sm:space-y-3 shadow-inner">
              <p className="text-gray-200 text-xs sm:text-sm md:text-base leading-relaxed">
                Le joueur <strong className="text-rose-300 font-bold">{berserkerEvent.playerName}</strong> a perdu sa carte <strong className="text-rose-400 font-bold">Berserker</strong>.
              </p>

              <div className="p-3 bg-rose-950/50 rounded-lg border border-rose-800/60 text-rose-200 text-xs sm:text-sm space-y-2 leading-relaxed">
                <p>
                  👉 Le joueur qui avait la carte Berserker choisit qui perd sa carte du même rang.
                </p>
                <p className="text-rose-200/95 bg-rose-950/70 p-2 sm:p-2.5 rounded border border-rose-700/50">
                  <strong className="text-white font-serif">Exemple :</strong> Berserker en numéro 3 en partant du haut, il choisit un joueur qui perd sa carte numéro 3 en partant du haut.
                </p>
                <p className="text-rose-300/95 font-medium text-[11px] sm:text-xs leading-normal">
                  ⚠️ <strong className="text-white font-bold">Condition :</strong> La seule condition est que le joueur qui a le Berserker doit choisir un joueur qui a une carte encore en vie à ce rang, sinon le pouvoir du Berserker ne fait pas effet. De plus, si jamais plus aucun joueur n'a de carte au même rang que celui du Berserker, alors le pouvoir ne fait plus effet non plus.
                </p>
              </div>

              <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-2.5 sm:p-3 text-xs sm:text-sm text-gray-300 space-y-1">
                <span className="font-bold text-amber-400 font-serif block text-xs sm:text-sm">📜 Message au Narrateur :</span>
                <p className="leading-relaxed text-[11px] sm:text-xs">
                  Le Berserker choisit un joueur qui perd sa carte, puis vous éliminez la carte du joueur choisi sur l'application. C'est dans ce sens-là qu'il faut procéder.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 pt-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setBerserkerStep(null);
                  setBerserkerEvent(null);
                  setCandidateBerserkerTarget(null);
                  checkVictoryConditions(handleGameEndRef.current);
                  setTimeout(() => saveCurrentGameRef.current(), 300);
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-gray-300 hover:text-white font-bold uppercase tracking-wider text-xs sm:text-sm transition-all font-serif cursor-pointer"
              >
                Pouvoir annulé (aucune cible vivante)
              </button>
              <button
                type="button"
                onClick={() => {
                  setBerserkerStep('choosing');
                  setShowNight(false);
                  setTab('ordre');
                }}
                className="flex-1 py-3 px-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold uppercase tracking-wider text-xs sm:text-sm transition-all shadow-lg shadow-rose-900/40 font-serif cursor-pointer hover:scale-[1.02]"
              >
                Continuer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up 2: Confirmation de l'élimination de la carte cible par le Berserker */}
      {candidateBerserkerTarget && berserkerEvent && (
        <div 
          onClick={() => setCandidateBerserkerTarget(null)}
          className="fixed inset-0 z-[10000] bg-black/90 flex flex-col items-center justify-start sm:justify-center p-3 sm:p-4 md:p-6 backdrop-blur-sm animate-in fade-in duration-200 font-sans overflow-y-auto"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-neutral-900 border-2 border-rose-600/80 rounded-2xl p-4 sm:p-6 md:p-8 max-w-lg w-full shadow-2xl text-center space-y-4 sm:space-y-6 animate-in zoom-in-95 duration-200 my-auto shrink-0 max-h-[92dvh] overflow-y-auto"
          >
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-rose-950/80 border border-rose-500/80 flex items-center justify-center mx-auto text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.3)] shrink-0">
              <Skull className="w-6 h-6 sm:w-8 sm:h-8 animate-pulse text-rose-500" />
            </div>
            <div className="space-y-2 sm:space-y-3">
              <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-rose-500 font-serif tracking-wide">
                Confirmer l'élimination
              </h3>
              <p className="text-gray-200 text-sm sm:text-base md:text-lg leading-relaxed">
                Voulez-vous éliminer la carte <strong className="text-white font-bold underline decoration-rose-500">{candidateBerserkerTarget.cardName}</strong> de <strong className="text-rose-300 font-bold">{candidateBerserkerTarget.player.name}</strong> suite au pouvoir du Berserker de <strong className="text-white font-bold">{berserkerEvent.playerName}</strong> ?
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2 shrink-0">
              <button
                type="button"
                onClick={() => setCandidateBerserkerTarget(null)}
                className="flex-1 py-3 sm:py-3.5 px-4 sm:px-6 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-gray-300 hover:text-white font-bold uppercase tracking-wider text-xs md:text-sm transition-all font-serif cursor-pointer"
              >
                Choisir un autre joueur
              </button>
              <button
                type="button"
                onClick={handleConfirmBerserkerElimination}
                className="flex-1 py-3 sm:py-3.5 px-4 sm:px-6 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold uppercase tracking-wider text-xs md:text-sm transition-all shadow-lg shadow-rose-900/40 font-serif cursor-pointer hover:scale-[1.02]"
              >
                Confirmer l'élimination
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up 3: Le joueur cible n'a pas de carte vivante -> Pouvoir sans effet */}
      {berserkerNoEffectPlayer && berserkerEvent && (
        <div 
          onClick={() => setBerserkerNoEffectPlayer(null)}
          className="fixed inset-0 z-[10000] bg-black/90 flex flex-col items-center justify-start sm:justify-center p-3 sm:p-4 md:p-6 backdrop-blur-sm animate-in fade-in duration-200 font-sans overflow-y-auto"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-neutral-900 border-2 border-amber-600/80 rounded-2xl p-4 sm:p-6 md:p-8 max-w-lg w-full shadow-2xl text-center space-y-4 sm:space-y-6 animate-in zoom-in-95 duration-200 my-auto shrink-0 max-h-[92dvh] overflow-y-auto"
          >
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-amber-950/80 border border-amber-500/80 flex items-center justify-center mx-auto text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)] shrink-0">
              <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 animate-bounce text-amber-400" />
            </div>
            <div className="space-y-2 sm:space-y-3">
              <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-amber-400 font-serif tracking-wide">
                Pouvoir sans effet
              </h3>
              <p className="text-gray-200 text-sm sm:text-base md:text-lg leading-relaxed">
                Le joueur <strong className="text-white font-bold">{berserkerNoEffectPlayer}</strong> n'a pas de carte vivante valide pour ce pouvoir.
              </p>
              <p className="text-xs sm:text-sm text-gray-400">
                La règle stipule que le Berserker doit choisir un joueur ayant une carte encore en vie, sinon son pouvoir ne fait pas effet.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-2 shrink-0">
              <button
                type="button"
                onClick={() => setBerserkerNoEffectPlayer(null)}
                className="flex-1 py-3 sm:py-3.5 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-gray-300 hover:text-white font-bold uppercase tracking-wider text-xs md:text-sm transition-all font-serif cursor-pointer"
              >
                Choisir un autre joueur
              </button>
              <button
                type="button"
                onClick={() => {
                  setBerserkerNoEffectPlayer(null);
                  setBerserkerStep(null);
                  setBerserkerEvent(null);
                  setCandidateBerserkerTarget(null);
                  checkVictoryConditions(handleGameEndRef.current);
                  setTimeout(() => saveCurrentGameRef.current(), 300);
                }}
                className="flex-1 py-3 sm:py-3.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold uppercase tracking-wider text-xs md:text-sm transition-all shadow-lg shadow-amber-900/40 font-serif cursor-pointer hover:scale-[1.02]"
              >
                Valider l'annulation (le pouvoir est sans effet)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast d'avertissement si mauvaise carte cliquée pendant le choix du Berserker */}
      {berserkerWrongCardToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[10001] bg-rose-950/95 border-2 border-rose-500 text-rose-200 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200 font-sans text-xs sm:text-sm font-semibold max-w-md text-center">
          <span className="text-base">⚔️</span>
          <span>{berserkerWrongCardToast}</span>
          <button 
            type="button"
            onClick={() => setBerserkerWrongCardToast(null)}
            className="ml-auto text-rose-400 hover:text-white cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Modal: Appel du Super Voyant (Tour 1) */}
      {showSuperVoyantModal && (
        <div 
          onClick={() => {}}
          className="fixed inset-0 z-[10000] bg-black/90 flex flex-col items-center justify-start p-3 sm:p-4 md:p-6 backdrop-blur-md animate-in fade-in duration-200 font-sans overflow-y-auto"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-neutral-900 border-2 border-indigo-600/80 rounded-2xl p-4 sm:p-6 md:p-8 max-w-lg w-full shadow-2xl text-center space-y-4 sm:space-y-5 animate-in zoom-in-95 duration-200 my-auto shrink-0"
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-indigo-950/80 border border-indigo-500/80 flex items-center justify-center mx-auto text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.3)] shrink-0">
              <Eye className="w-6 h-6 sm:w-7 sm:h-7 animate-pulse" />
            </div>

            {!superVoyantTarget ? (
              // Étape 1 : Choix de l'allégeance
              <div className="space-y-4 sm:space-y-5">
                <div className="space-y-2">
                  <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-indigo-400 font-serif tracking-wide break-words">
                    Appel du Super Voyant
                  </h3>
                  <p className="text-gray-200 text-base sm:text-lg md:text-xl font-medium leading-relaxed break-words">
                    Le Super Voyant peut choisir de connaître l'identité d'un <span className="text-orange-400 font-bold">Renard</span> ou d'un <span className="text-cyan-400 font-bold">Fantôme</span>.
                  </p>
                  <p className="text-xs sm:text-sm text-gray-400 break-words">
                    Demandez discrètement au Super Voyant quelle allégeance il souhaite découvrir.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-1 sm:pt-2">
                  <button
                    type="button"
                    onClick={() => handleSuperVoyantSelect('Renard')}
                    className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-orange-950/90 to-amber-950/90 hover:from-orange-900 hover:to-amber-900 border-2 border-orange-600/80 hover:border-orange-500 text-orange-200 hover:text-white transition-all shadow-xl hover:scale-105 active:scale-95 group flex flex-col items-center gap-1.5 sm:gap-2 cursor-pointer"
                  >
                    <span className="text-2xl sm:text-3xl">🦊</span>
                    <span className="text-lg sm:text-xl font-bold font-serif tracking-wider uppercase text-orange-300 group-hover:text-white">Renard</span>
                    <span className="text-[11px] sm:text-xs text-orange-400/80 font-sans text-center">Connaître un Renard (ou le Traître)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSuperVoyantSelect('Fantôme')}
                    className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-cyan-950/90 to-indigo-950/90 hover:from-cyan-900 hover:to-indigo-900 border-2 border-cyan-600/80 hover:border-cyan-500 text-cyan-200 hover:text-white transition-all shadow-xl hover:scale-105 active:scale-95 group flex flex-col items-center gap-1.5 sm:gap-2 cursor-pointer"
                  >
                    <span className="text-2xl sm:text-3xl">👻</span>
                    <span className="text-lg sm:text-xl font-bold font-serif tracking-wider uppercase text-cyan-300 group-hover:text-white">Fantôme</span>
                    <span className="text-[11px] sm:text-xs text-cyan-400/80 font-sans text-center">Connaître un Fantôme</span>
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSuperVoyantModal(false)}
                    className="text-gray-400 hover:text-gray-200 text-xs sm:text-sm font-serif underline underline-offset-4 cursor-pointer transition-colors"
                  >
                    Fermer sans choisir pour l'instant
                  </button>
                </div>
              </div>
            ) : superVoyantTarget.notFound ? (
              // Étape alternative : Aucun joueur trouvé avec cette allégeance
              <div className="space-y-4 sm:space-y-5">
                <h3 className="text-xl sm:text-2xl font-bold text-amber-400 font-serif break-words">
                  Aucun {superVoyantTarget.allegiance} en jeu
                </h3>
                <p className="text-gray-300 text-sm sm:text-base break-words">
                  Aucun joueur vivant ne possède l'allégeance <strong>{superVoyantTarget.allegiance}</strong> dans cette partie.
                </p>
                <div className="flex gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setSuperVoyantTarget(null)}
                    className="flex-1 py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-gray-200 font-bold uppercase tracking-wider text-xs sm:text-sm transition-all cursor-pointer"
                  >
                    Choisir l'autre allégeance
                  </button>
                </div>
              </div>
            ) : (
              // Étape 2 : Résultat révélé avec le GROS panneau d'avertissement adaptatif pour le narrateur
              <div className="space-y-3 sm:space-y-4 md:space-y-5 text-left">
                <div className="space-y-1 text-center">
                  <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-indigo-400 font-serif tracking-wide break-words">
                    Identité Révélée
                  </h3>
                  <div className="text-[11px] sm:text-xs font-semibold uppercase tracking-widest text-gray-400 break-words">
                    Allégeance sondée : {superVoyantTarget.allegiance === 'Renard' ? '🦊 Renard' : '👻 Fantôme'}
                  </div>
                </div>

                {/* Nom du joueur */}
                <div className="bg-neutral-950/90 border-2 border-indigo-500/60 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-center shadow-inner space-y-0.5 sm:space-y-1">
                  <div className="text-[10px] sm:text-xs uppercase tracking-wider text-gray-400 font-serif">
                    Nom du joueur désigné
                  </div>
                  <div className="text-2xl sm:text-3xl md:text-4xl font-black text-amber-300 font-serif tracking-wide drop-shadow-[0_0_12px_rgba(252,211,77,0.4)] break-words [overflow-wrap:anywhere]">
                    {superVoyantTarget.playerName}
                  </div>
                </div>

                {/* GROS PANNEAU D'AVERTISSEMENT ADAPTATIF POUR LE NARRATEUR */}
                <div className="bg-gradient-to-br from-amber-950/95 via-red-950/90 to-neutral-950 border-2 border-amber-500 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5 shadow-2xl text-left space-y-2.5 sm:space-y-3">
                  <div className="flex items-center gap-2 sm:gap-2.5 text-amber-400 font-serif font-black text-sm sm:text-base md:text-lg uppercase tracking-wide leading-snug">
                    <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 shrink-0 animate-bounce" />
                    <span className="break-words flex-1 min-w-0 [overflow-wrap:anywhere]">Avertissement Crucial pour le Narrateur</span>
                  </div>
                  <div className="space-y-2 sm:space-y-2.5 text-xs sm:text-sm md:text-base text-gray-100 font-sans">
                    <div className="bg-red-950/90 border border-red-500/70 rounded-lg sm:rounded-xl p-2.5 sm:p-3 text-red-100 font-bold leading-normal sm:leading-relaxed flex items-start gap-2 sm:gap-2.5 min-w-0">
                      <span className="text-base sm:text-lg shrink-0 mt-0.5">🔇</span>
                      <div className="flex-1 min-w-0 break-words [overflow-wrap:anywhere]">
                        Le narrateur ne doit <span className="underline decoration-red-400 uppercase tracking-wide text-white font-extrabold">en aucun cas</span> révéler oralement le nom du joueur concerné !
                      </div>
                    </div>
                    <div className="bg-amber-950/90 border border-amber-500/70 rounded-lg sm:rounded-xl p-2.5 sm:p-3 text-amber-100 font-bold leading-normal sm:leading-relaxed flex items-start gap-2 sm:gap-2.5 min-w-0">
                      <span className="text-base sm:text-lg shrink-0 mt-0.5">👉</span>
                      <div className="flex-1 min-w-0 break-words [overflow-wrap:anywhere]">
                        Le narrateur doit montrer au Super Voyant le joueur concerné <span className="underline decoration-amber-400 uppercase tracking-wide text-white font-extrabold">en le pointant du doigt</span>.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSuperVoyantModal(false);
                      setCheckedRoles(prev => prev.includes('Super voyant') ? prev : [...prev, 'Super voyant']);
                    }}
                    className="w-full py-3 sm:py-3.5 md:py-4 px-4 sm:px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold uppercase tracking-wider text-xs sm:text-sm md:text-base transition-all shadow-lg shadow-emerald-900/40 font-serif cursor-pointer hover:scale-[1.01] active:scale-98"
                  >
                    Compris, Valider l'appel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Appel du Parent (Tour 1) - Désignation des 2 Enfants */}
      {showParentModal && (
        <div 
          onClick={() => {}}
          className="fixed inset-0 z-[10000] bg-black/90 flex flex-col items-center justify-start p-3 sm:p-4 md:p-6 backdrop-blur-md animate-in fade-in duration-200 font-sans overflow-y-auto"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-neutral-900 border-2 border-amber-600/80 rounded-2xl p-4 sm:p-6 md:p-8 max-w-xl w-full shadow-2xl text-center space-y-4 sm:space-y-5 animate-in zoom-in-95 duration-200 my-auto shrink-0"
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-amber-950/80 border border-amber-500/80 flex items-center justify-center mx-auto text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)] shrink-0">
              <Users className="w-6 h-6 sm:w-7 sm:h-7 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-amber-500 font-serif tracking-wide break-words">
                Appel du Parent
              </h3>
              <div className="bg-amber-950/70 border border-amber-600/70 rounded-xl p-3 sm:p-4 text-left space-y-1.5 shadow-inner">
                <p className="text-amber-200 text-sm sm:text-base font-bold font-serif">
                  2 joueurs doivent être désignés comme enfants par le parent.
                </p>
                <p className="text-gray-300 text-xs sm:text-sm font-sans leading-relaxed">
                  Demandez discrètement au Parent de pointer du doigt 2 joueurs. Si l'un de ces enfants perd une carte plus tard dans la partie, l'autre enfant devra obligatoirement perdre sa première carte encore en jeu.
                </p>
              </div>
            </div>

            {/* Grille de sélection des 2 joueurs */}
            <div className="space-y-2 text-left">
              <div className="flex items-center justify-between text-xs font-serif font-bold text-gray-400 px-1">
                <span>Désigner les 2 enfants :</span>
                <div className="flex items-center gap-2">
                  {tempParentChildren.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTempParentChildren([])}
                      className="text-[11px] text-amber-400 hover:text-amber-300 underline underline-offset-2 cursor-pointer font-sans"
                    >
                      Désélectionner tout
                    </button>
                  )}
                  <span className={`px-2 py-0.5 rounded font-mono ${tempParentChildren.length === 2 ? 'bg-amber-900/80 text-amber-300 border border-amber-600' : 'bg-neutral-800 text-gray-400'}`}>
                    {tempParentChildren.length} / 2 sélectionnés
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 max-h-[36vh] overflow-y-auto p-1 pr-2">
                {res && res.map((p: any) => {
                  const isSelected = tempParentChildren.includes(p.id);
                  const selectionIndex = tempParentChildren.indexOf(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setTempParentChildren(prev => {
                          if (prev.includes(p.id)) {
                            return prev.filter(id => id !== p.id);
                          }
                          if (prev.length < 2) {
                            return [...prev, p.id];
                          }
                          return [prev[0], p.id];
                        });
                      }}
                      className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-amber-950/90 border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.3)] ring-2 ring-amber-500/50'
                          : 'bg-neutral-800/80 hover:bg-neutral-800 border-neutral-700 hover:border-neutral-600 text-gray-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className={`font-serif font-bold text-sm sm:text-base truncate ${isSelected ? 'text-amber-200' : 'text-gray-200'}`}>
                          {p.name}
                        </div>
                        <div className="text-[11px] text-gray-400 font-sans">
                          {p.cards.length} {p.cards.length > 1 ? 'cartes' : 'carte'}
                        </div>
                      </div>
                      {isSelected && (
                        <div className="flex items-center gap-1 shrink-0 bg-amber-500 text-neutral-950 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider">
                          <Check size={12} strokeWidth={3} />
                          <span>Enfant {selectionIndex + 1}</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowParentModal(false)}
                className="flex-1 py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-gray-300 font-bold uppercase tracking-wider text-xs sm:text-sm transition-all cursor-pointer"
              >
                Fermer sans valider
              </button>
              <button
                type="button"
                disabled={tempParentChildren.length !== 2}
                onClick={() => {
                  if (tempParentChildren.length !== 2) return;
                  setParentChildren(tempParentChildren);
                  parentChildrenRef.current = tempParentChildren;
                  setShowParentModal(false);
                  setCheckedRoles(prev => prev.includes('Parent') ? prev : [...prev, 'Parent']);
                }}
                className={`flex-1 py-3 px-4 rounded-xl font-bold uppercase tracking-wider text-xs sm:text-sm transition-all font-serif shadow-lg ${
                  tempParentChildren.length === 2
                    ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/40 hover:scale-[1.02] active:scale-95 cursor-pointer'
                    : 'bg-neutral-800 text-neutral-500 border border-neutral-700 cursor-not-allowed'
                }`}
              >
                Valider les 2 enfants
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup: Perte de carte d'un enfant liée au Pouvoir du Parent */}
      {pendingParentTargetLoss && (
        <div 
          onClick={() => {}}
          className="fixed inset-0 z-[10000] bg-black/90 flex flex-col items-center justify-start p-3 sm:p-4 md:p-6 backdrop-blur-md animate-in fade-in duration-200 font-sans overflow-y-auto"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-neutral-900 border-2 border-amber-500/90 rounded-2xl p-4 sm:p-6 md:p-8 max-w-lg w-full shadow-2xl text-center space-y-4 sm:space-y-5 animate-in zoom-in-95 duration-200 my-auto shrink-0"
          >
            <div className="w-14 h-14 rounded-full bg-amber-950/90 border-2 border-amber-500 flex items-center justify-center mx-auto text-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.4)] shrink-0">
              <AlertTriangle className="w-7 h-7 text-amber-400 animate-bounce" />
            </div>

            <div className="space-y-1 text-center">
              <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-amber-400 font-serif tracking-wide">
                Lien du Parent
              </h3>
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-500/90">
                Perte de carte liée
              </p>
            </div>

            <div className="bg-neutral-950/90 border border-amber-600/60 rounded-xl p-4 sm:p-5 text-left space-y-3 shadow-inner">
              <div className="text-gray-200 text-sm sm:text-base leading-relaxed">
                L'enfant <strong className="text-white font-bold underline decoration-amber-500">{pendingParentTargetLoss.triggerChildName}</strong> vient de perdre une carte (<strong className="text-amber-300">{pendingParentTargetLoss.triggerRole}</strong>).
              </div>
              <div className="bg-amber-950/80 border border-amber-600/80 rounded-lg p-3 text-amber-200 text-sm sm:text-base font-semibold leading-relaxed">
                👉 L'autre enfant (<strong className="text-white font-black underline decoration-amber-400">{pendingParentTargetLoss.partnerChildName}</strong>) doit également perdre sa première carte encore en jeu !
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  const target = {
                    playerId: pendingParentTargetLoss.partnerPlayerId,
                    playerName: pendingParentTargetLoss.partnerChildName,
                    targetCardIndex: pendingParentTargetLoss.targetCardIndex,
                    targetCardName: pendingParentTargetLoss.targetCardName
                  };
                  setForcedParentCardLossChild(target);
                  forcedParentCardLossChildRef.current = target;
                  setPendingParentTargetLoss(null);
                  setTab('ordre');
                  setShowNight(false);

                  // Emmène sur le joueur qui doit perdre sa carte
                  setTimeout(() => {
                    const el = document.querySelector(`[data-player-id="${target.playerId}"]`)
                      || Array.from(document.querySelectorAll('.player-card')).find(card => 
                          card.querySelector('.player-name')?.textContent?.trim() === target.playerName
                        );
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                  }, 150);
                }}
                className="w-full py-4 px-6 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold uppercase tracking-wider text-sm sm:text-base transition-all shadow-lg shadow-amber-900/50 hover:scale-[1.02] active:scale-95 cursor-pointer font-serif flex items-center justify-center gap-2"
              >
                <span>Aller sur l'autre enfant ({pendingParentTargetLoss.partnerChildName})</span>
                <ArrowRight size={20} />
              </button>

              <button
                type="button"
                onClick={() => {
                  setParentBondBroken(true);
                  parentBondBrokenRef.current = true;
                  setPendingParentTargetLoss(null);
                  setForcedParentCardLossChild(null);
                  forcedParentCardLossChildRef.current = null;
                }}
                className="w-full py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-amber-200/90 hover:text-white font-bold text-xs sm:text-sm uppercase tracking-wider transition-all cursor-pointer"
              >
                Les 2 enfants sont morts simultanément (Pouvoir annulé)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. Modal Avertissement Équilibre / Combos */}
      {exclusionModalStep === 'warning' && (
        <div className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-neutral-900 border-2 border-amber-600/70 rounded-2xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6 relative animate-in zoom-in-95 duration-200 text-left">
            <div className="flex items-center gap-3 border-b border-neutral-800 pb-4">
              <div className="w-12 h-12 rounded-xl bg-amber-950/90 border border-amber-600 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                <AlertTriangle size={26} />
              </div>
              <div>
                <h3 className="text-xl font-bold font-serif text-gray-100">
                  Avertissement sur l'équilibre du jeu
                </h3>
                <span className="text-xs text-amber-400 font-sans uppercase tracking-wider font-semibold">
                  Impact sur les combinaisons
                </span>
              </div>
            </div>

            <div className="space-y-4 text-gray-300 text-sm leading-relaxed font-sans">
              <p>
                Plus vous retirez de rôles de la génération, plus la génération et l'équilibrage des combinaisons que les joueurs recevront risquent d'être impactés négativement.
              </p>
              <div className="bg-neutral-950 border border-amber-900/40 rounded-xl p-3.5 space-y-1.5 text-xs text-amber-200/90">
                <div className="font-bold flex items-center gap-1.5 text-amber-300">
                  <span>⚠️ Risques encourus :</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-gray-400 pl-1">
                  <li>La génération peut <strong className="text-gray-200">ne trouver aucune combinaison valable</strong> respectant les allégeances imposées.</li>
                  <li>Certains joueurs risquent d'avoir des <strong className="text-gray-200">combinaisons très faibles</strong> comparé à d'autres.</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setExclusionModalStep('none')}
                className="px-5 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-gray-300 hover:text-white font-serif font-bold text-sm transition-colors border border-neutral-700 cursor-pointer"
              >
                Quitter
              </button>
              <button
                type="button"
                onClick={() => setExclusionModalStep('list')}
                className="px-6 py-3 rounded-xl bg-amber-700 hover:bg-amber-600 text-white font-serif font-bold text-sm transition-all shadow-lg shadow-amber-950/60 cursor-pointer flex items-center gap-2"
              >
                <span>Continuer</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal Gestion des Exclusions de Cartes */}
      {exclusionModalStep === 'list' && (
        <div className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-md flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200 font-serif">
          <div className="max-w-4xl w-full max-h-[92vh] bg-neutral-900 border-2 border-neutral-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 md:p-6 border-b border-neutral-800 bg-neutral-950/70 flex items-start justify-between gap-4 shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-orange-950/80 border border-orange-700 flex items-center justify-center text-orange-400">
                    <Filter size={18} />
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-gray-100 uppercase tracking-wide">
                    Exclure des cartes du Deck
                  </h2>
                </div>
                <p className="text-xs md:text-sm text-gray-400 font-sans">
                  Ajustez les exemplaires autorisés dans le tirage. Les rôles réduits à 0 sont totalement exclus.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs font-sans">
                  <span className="text-gray-300">
                    Cartes actives : <strong className="text-white font-mono">{totalActiveCards}</strong> / 42
                  </span>
                  <span className="text-neutral-600">•</span>
                  <span className="text-gray-300">
                    Requises pour {N} âmes : <strong className="text-white font-mono">{N * C}</strong> ({N} × {C})
                  </span>
                  {excludedCardsCount > 0 && (
                    <>
                      <span className="text-neutral-600">•</span>
                      <span className="text-amber-400 font-bold">
                        {excludedCardsCount} {excludedCardsCount > 1 ? 'cartes exclues' : 'carte exclue'}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExclusionModalStep('none')}
                className="w-9 h-9 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-gray-400 hover:text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                title="Fermer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
              {/* Alerte si le nombre de cartes est inférieur au minimum requis */}
              {totalActiveCards < N * C && (
                <div className="p-3.5 rounded-xl bg-red-950/70 border border-red-700 text-red-200 text-xs md:text-sm flex items-center gap-2 font-sans shadow-lg">
                  <AlertTriangle size={18} className="shrink-0 text-red-400" />
                  <span>
                    <strong>Attention :</strong> Le deck ne contient que {totalActiveCards} cartes disponibles, alors que {N * C} cartes sont requises pour {N} joueurs avec {C} cartes. L'invocation échouera tant que vous ne réintégrez pas des cartes.
                  </span>
                </div>
              )}

              {/* Erreur de génération le cas échéant */}
              {exclusionModalErr && (
                <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-700 text-red-200 text-xs md:text-sm flex items-center gap-2 font-sans shadow-lg animate-in fade-in duration-150">
                  <AlertTriangle size={18} className="shrink-0 text-red-400" />
                  <span>{exclusionModalErr}</span>
                </div>
              )}

              {/* SECTION 1: Rôles allongeant la durée de partie (en haut de la liste) */}
              <div className="space-y-3">
                <div className="bg-amber-950/40 border border-amber-800/80 rounded-xl p-4 shadow-lg flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-900/60 text-amber-300 border border-amber-700/60 mt-0.5 shrink-0">
                    <Clock size={20} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-amber-200 font-serif text-base flex items-center gap-2">
                      Rôles allongeant la durée de partie
                    </h4>
                    <p className="text-gray-300 text-xs md:text-sm font-sans leading-relaxed">
                      Ce sont ces rôles qui font durer une partie : si vous souhaitez réduire le temps de jeu, c'est en priorité ceux-là qu'il convient de retirer ou de limiter en nombre.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {TIME_EXTENDING_ROLES.map(roleName => {
                    const def = DECK_DEF.find(d => d.n === roleName);
                    if (!def) return null;
                    const count = customDeckCounts[roleName] ?? def.c;
                    const depNote = getCardDependencyNote(roleName, customDeckCounts);
                    return (
                      <CardCounterItem
                        key={roleName}
                        cardName={roleName}
                        defaultMax={def.c}
                        count={count}
                        type={def.t}
                        depNote={depNote}
                        onChange={(newVal) => handleCardCountChange(roleName, newVal)}
                      />
                    );
                  })}
                </div>
              </div>

              {/* SECTION 2: Autres Rôles par Factions */}
              <div className="space-y-6 pt-2 border-t border-neutral-800">
                <h3 className="text-lg font-bold text-gray-200 uppercase tracking-wider font-serif">
                  Autres Rôles du Deck
                </h3>

                {/* 2.1 Renards & Traître */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-600 shadow-[0_0_8px_rgba(234,88,12,0.6)]"></div>
                    <h4 className="text-sm font-bold font-serif text-orange-300 uppercase tracking-wide">
                      Renards & Traître
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {['Renard', 'Renardeau', 'Chef des renards', 'Traître'].map(roleName => {
                      const def = DECK_DEF.find(d => d.n === roleName);
                      if (!def) return null;
                      const count = customDeckCounts[roleName] ?? def.c;
                      const depNote = getCardDependencyNote(roleName, customDeckCounts);
                      return (
                        <CardCounterItem
                          key={roleName}
                          cardName={roleName}
                          defaultMax={def.c}
                          count={count}
                          type={def.t}
                          depNote={depNote}
                          onChange={(newVal) => handleCardCountChange(roleName, newVal)}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* 2.2 Fantômes */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-cyan-600 shadow-[0_0_8px_rgba(6,182,212,0.6)]"></div>
                    <h4 className="text-sm font-bold font-serif text-cyan-300 uppercase tracking-wide">
                      Fantômes
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {['Fantôme', 'Chef des fantômes'].map(roleName => {
                      const def = DECK_DEF.find(d => d.n === roleName);
                      if (!def) return null;
                      const count = customDeckCounts[roleName] ?? def.c;
                      const depNote = getCardDependencyNote(roleName, customDeckCounts);
                      return (
                        <CardCounterItem
                          key={roleName}
                          cardName={roleName}
                          defaultMax={def.c}
                          count={count}
                          type={def.t}
                          depNote={depNote}
                          onChange={(newVal) => handleCardCountChange(roleName, newVal)}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* 2.3 Solitaires */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-purple-600 shadow-[0_0_8px_rgba(168,85,247,0.6)]"></div>
                    <h4 className="text-sm font-bold font-serif text-purple-300 uppercase tracking-wide">
                      Solitaires (Solos)
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {['Chasseur de prime', 'Tueur à gage'].map(roleName => {
                      const def = DECK_DEF.find(d => d.n === roleName);
                      if (!def) return null;
                      const count = customDeckCounts[roleName] ?? def.c;
                      const depNote = getCardDependencyNote(roleName, customDeckCounts);
                      return (
                        <CardCounterItem
                          key={roleName}
                          cardName={roleName}
                          defaultMax={def.c}
                          count={count}
                          type={def.t}
                          depNote={depNote}
                          onChange={(newVal) => handleCardCountChange(roleName, newVal)}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* 2.4 Autres Innocents */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
                    <h4 className="text-sm font-bold font-serif text-emerald-300 uppercase tracking-wide">
                      Autres Innocents
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      'Le Petit', 'Protecteur', 'Elfe', 'Nain', 
                      'Juge', 'Vagabond', 'Gentil homme', 'Berserker', 
                      'Alchimiste', 'Magicien', 'Sorcier de glace', 'Maraudeur'
                    ].map(roleName => {
                      const def = DECK_DEF.find(d => d.n === roleName);
                      if (!def) return null;
                      const count = customDeckCounts[roleName] ?? def.c;
                      const depNote = getCardDependencyNote(roleName, customDeckCounts);
                      return (
                        <CardCounterItem
                          key={roleName}
                          cardName={roleName}
                          defaultMax={def.c}
                          count={count}
                          type={def.t}
                          depNote={depNote}
                          onChange={(newVal) => handleCardCountChange(roleName, newVal)}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 md:p-5 border-t border-neutral-800 bg-neutral-950/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                <button
                  type="button"
                  onClick={resetDeckCounts}
                  className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-gray-300 hover:text-white text-xs font-sans font-semibold border border-neutral-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw size={14} />
                  <span>Rétablir le deck complet</span>
                </button>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setExclusionModalStep('none')}
                  className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-gray-300 hover:text-white font-serif font-bold text-sm transition-colors border border-neutral-700 cursor-pointer"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  onClick={() => gen(customDeckCounts)}
                  className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-orange-700 hover:bg-orange-600 text-white font-serif font-bold text-sm transition-all shadow-lg shadow-orange-950/60 cursor-pointer uppercase tracking-wider"
                >
                  Invoquer avec ces restrictions
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
