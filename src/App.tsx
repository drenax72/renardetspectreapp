import React, { useState, useEffect, useRef } from 'react';
import { Settings, RefreshCw, Copy, Play, Pause, Music, ScrollText, AlertTriangle, Minus, Plus, Menu, Check, UserPen, ArrowRight, X, Ghost, Volume2, History } from 'lucide-react';

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

function generateGame(N: number, C: number) {
  if (N * C > 42) return { err: "Capacité max (42 cartes) atteinte." };

  for (let attempt = 0; attempt < 500; attempt++) {
    // Relaxation logic
    let maxLePetit = 2, maxGuerisseur = 1, maxRenard = 2, maxFantome = 2;
    if (attempt >= 100) {
      maxLePetit = 4; maxGuerisseur = 2; maxRenard = 4; maxFantome = 4;
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
    let inventory = DECK_DEF.flatMap(d => Array(d.c).fill(d.n));
    
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
      if (!takeType('S')) valid = false;
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

    while (pool.length < N * C) {
      if (inventory.length === 0) { valid = false; break; }
      const idx = Math.floor(Math.random() * inventory.length);
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
      
      pool.push(card);
      inventory.splice(idx, 1);
      if (cType === 'R') rInPool++;
      if (cType === 'F') fInPool++;
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
            else pool.push(req);
          }
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
        const cIdx = pool.findIndex(c => getType(c) === 'I');
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
        if (['R', 'F', 'S'].includes(t) || c !== 'Le Petit') return 0;
        return 1;
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
        if (cType === 'S' && pTypes.includes('S') && Math.random() > 0.1) return false;
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
        return true;
      });

      if (candidates.length === 0) { valid = false; break; }
      
      let chosen;
      if (cType === 'R' || cType === 'F') {
        const existingFaction = candidates.filter(c => c.cards.some(x => getType(x) === cType) || c.target === cType);
        if (existingFaction.length > 0 && Math.random() > 0.2) {
          const minCount = Math.min(...existingFaction.map(c => c.cards.filter(x => getType(x) === cType).length));
          const best = existingFaction.filter(c => c.cards.filter(x => getType(x) === cType).length === minCount);
          chosen = best[Math.floor(Math.random() * best.length)];
        } else {
          chosen = candidates[Math.floor(Math.random() * candidates.length)];
        }
      } else {
        chosen = candidates[Math.floor(Math.random() * candidates.length)];
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

    const getDisplayAllegiance = (cards: string[]) => {
      const ts = cards.map(getType);
      const hasF = ts.includes('F');
      const hasS = ts.includes('S');
      const hasRealR = cards.some(c => ['Renard', 'Renardeau', 'Chef des renards'].includes(c));
      const hasT = cards.includes('Traître');

      if (hasF && hasS) return 'Fantôme + Solo';
      if (hasRealR && hasS) return 'Renard + Solo';
      if (hasT && hasS && !hasRealR) return 'Solo';
      if (hasT && !hasRealR && !hasS) return 'Innocent';
      if (hasF) return 'Fantôme';
      if (hasRealR) return 'Renard';
      if (hasS) return 'Solo';
      return 'Innocent Pur';
    };

    return { players: players.map(p => ({ ...p, allegiance: getDisplayAllegiance(p.cards) })) };
  }
  return { err: "Impossible de générer une configuration valide. Réessayez." };
}

// --- UI COMPONENTS ---
const CardBadge = ({ card, isPlaying, nightCount }: { card: string, isPlaying?: boolean, nightCount?: number }) => {
  const [showActions, setShowActions] = useState(false);
  const type = getType(card);
  const colors: any = { 
    R: 'bg-orange-900/40 text-orange-200 border-orange-700/50', 
    F: 'bg-cyan-900/40 text-cyan-200 border-cyan-700/50', 
    S: 'bg-purple-900/40 text-purple-200 border-purple-700/50', 
    I: 'bg-gray-800 text-gray-300 border-gray-600' 
  };
  
  const kill = (e: any, ghost = false) => {
    e.stopPropagation();
    const badge = (e.target as HTMLElement).closest('.role-badge-container')?.querySelector('.role-badge');
    if (badge) {
      badge.classList.add('role-mort');
      if (nightCount) badge.setAttribute('data-death-turn', nightCount.toString());
      if (ghost) badge.classList.add('tue-par-fantome');
      setShowActions(false);

      const pc = badge.closest('.player-card');
      if (pc) {
        const live = Array.from(pc.querySelectorAll('.role-badge:not(.role-mort)')).map(b => b.textContent || '');
        const ts = live.map(getType);
        const hF = ts.includes('F'), hS = ts.includes('S');
        const hRR = live.some(c => ['Renard', 'Renardeau', 'Chef des renards'].includes(c));
        const hT = live.includes('Traître');
        
        let txt = 'Innocent';
        if (pc.getAttribute('data-initial-pure') === 'true') txt = 'Innocent Pur';
        else if (hF && hS) txt = 'Fantôme + Solo';
        else if (hRR && hS) txt = 'Renard + Solo';
        else if (hT && hS && !hRR) txt = 'Solo';
        else if (hT && !hRR && !hS) txt = 'Innocent';
        else if (hF) txt = 'Fantôme';
        else if (hRR) txt = 'Renard';
        else if (hS) txt = 'Solo';
        
        pc.querySelectorAll('.allegiance-text').forEach(s => s.textContent = `Allégeance : ${txt}`);
      }

      setTimeout(() => {
        const pc = badge.closest('.player-card');
        if (pc && pc.querySelectorAll('.role-badge').length === pc.querySelectorAll('.role-badge.role-mort').length) {
          pc.classList.add('joueur-mort');
          pc.querySelectorAll('.allegiance-text').forEach(el => {
            el.textContent = "Déchu de Grabuge";
            (el as HTMLElement).style.cssText = "font-style: italic; opacity: 0.8;";
          });
        }
        
        const badges = Array.from(document.querySelectorAll('.role-badge'));
        const getBadge = (n: string) => badges.find(b => b.textContent === n);
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

        const alive = players.filter(p => !p.classList.contains('joueur-mort'));
        const isFox = (p: Element) => p.textContent?.includes('Allégeance : Renard') || Array.from(p.querySelectorAll('span')).some(s => ['Renard', 'Renardeau', 'Chef des renards'].includes(s.textContent || ''));
        const aliveFoxes = alive.filter(isFox);
        if (alive.length > 0 && aliveFoxes.length > alive.length / 2) {
          titles.push("RENARDS");
          msgs.push("Les Renards ont la supériorité numérique !");
          players.filter(isFox).forEach(p => winners.push(getPName(p)));
        }

        const ghostKills = Array.from(document.querySelectorAll('.tue-par-fantome')).map(e => e.textContent || '');
        if (ghostKills.some(c => getType(c) === 'R') && ghostKills.some(c => getType(c) === 'F') && ghostKills.some(c => getType(c) === 'I')) {
          titles.push("LES FANTÔMES");
          msgs.push("Le Rituel a été accompli : un Renard, un Fantôme et un Innocent ont été sacrifiés !");
          players.filter(p => Array.from(p.querySelectorAll('span')).some(s => getType(s.textContent||'') === 'F')).forEach(p => winners.push(getPName(p)));
        }

        const getAll = (p: Element) => p.querySelector('.allegiance-text')?.textContent?.split(': ')[1] || '';
        const aliveInnocents = alive.filter(p => ['Innocent', 'Innocent Pur'].includes(getAll(p)));
        if (alive.length > 0 && aliveInnocents.length >= alive.length / 2) {
          titles.push("LES INNOCENTS");
          msgs.push("Les Innocents et Innocents Purs ont repris le contrôle de la forêt !");
          aliveInnocents.forEach(p => winners.push(getPName(p)));
        }

        if (titles.length) {
          const overlay = document.createElement('div');
          overlay.className = 'fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center text-center p-4 animate-in fade-in duration-500';
          overlay.innerHTML = `
            <h1 class="text-4xl md:text-6xl font-black text-yellow-500 mb-8 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)] uppercase tracking-tighter">VICTOIRE : ${titles.join(' ET ')}</h1>
            <p class="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl leading-relaxed">${msgs.join('<br>')}</p>
            <p class="text-2xl md:text-3xl font-bold text-white mb-12">Félicitations aux joueurs : <span class="text-red-500">${[...new Set(winners)].join(', ')}</span></p>
            <button onclick="window.location.reload()" class="bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-12 rounded-xl text-xl transition-all transform hover:scale-105 shadow-lg shadow-red-900/50 uppercase tracking-widest">Retour au menu</button>
          `;
          document.body.appendChild(overlay);
        }
      }, 650);
    }
  };

  return (
    <div className="relative group inline-block role-badge-container">
      <span onClick={() => isPlaying && setShowActions(true)} className={`role-badge px-2 py-1 rounded border text-sm font-medium cursor-pointer select-none ${colors[type] || colors.I}`}>{card}</span>
      {showActions && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex gap-1 bg-black/90 p-1 rounded-lg border border-gray-700 z-10 shadow-xl animate-in fade-in zoom-in duration-200">
          <button onClick={(e) => kill(e, true)} className="p-1 hover:bg-blue-900/50 rounded-full text-white"><Ghost size={14} /></button>
          <button onClick={(e) => kill(e)} className="p-1 hover:bg-green-900/50 rounded-full text-green-400"><Check size={14} /></button>
          <button onClick={(e) => { e.stopPropagation(); setShowActions(false); }} className="p-1 hover:bg-red-900/50 rounded-full text-red-400"><X size={14} /></button>
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



// --- MAIN APP ---
export default function App() {
  const [tab, setTab] = useState('ordre');
  const [N, setN] = useState(4);
  const [C, setC] = useState(3);
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showNight, setShowNight] = useState(false);
  const ORDRE_NUIT = ['Parent', 'Enfant de la nature', 'Omniscient', 'Renard', 'Fantôme', 'Alchimiste', 'Sorcier de glace', 'Protecteur', 'Magicien', 'Mineur', 'Super voyant'];
  const [potions, setPotions] = useState({ heal: 2, death: 2 });
  const [checkedRoles, setCheckedRoles] = useState<string[]>([]);
  const [nightCount, setNightCount] = useState(1);
  const [hasPlayedNight1, setHasPlayedNight1] = useState(false);
  const [isConfirmingStop, setIsConfirmingStop] = useState(false);
  const [isNamingGame, setIsNamingGame] = useState(false);
  const [gameName, setGameName] = useState('');
  const [gameId, setGameId] = useState<string | null>(null);
  const [savedGames, setSavedGames] = useState<any[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Audio
  const [play, setPlay] = useState(false);
  const [track, setTrack] = useState('Aucune');
  const [volume, setVolume] = useState(0.5);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      if (play && track !== 'Aucune') {
        audioRef.current.play().catch(e => console.log("Audio play error:", e));
      } else {
        audioRef.current.pause();
      }
    }
  }, [play, track]);

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
    gameStateRef.current = { isPlaying, gameId, res, gameName, N, C, nightCount, hasPlayedNight1, potions, elapsedTime };
  }, [isPlaying, gameId, res, gameName, N, C, nightCount, hasPlayedNight1, potions, elapsedTime]);

  const saveCurrentGameRef = useRef(() => {});
  saveCurrentGameRef.current = () => {
    const state = gameStateRef.current;
    if (!state || !state.isPlaying || !state.gameId || !state.res) return;
    
    const domState = state.res.map((p: any, i: number) => {
      const pc = document.querySelectorAll('.player-card')[i];
      if (!pc) return null;
      
      const isDead = pc.classList.contains('joueur-mort');
      const allegianceText = pc.querySelector('.allegiance-text')?.textContent?.replace('Allégeance : ', '') || p.allegiance;
      
      const cardsState = Array.from(pc.querySelectorAll('.role-badge')).map(badge => ({
        isDead: badge.classList.contains('role-mort'),
        isGhostKill: badge.classList.contains('tue-par-fantome'),
        deathTurn: badge.getAttribute('data-death-turn')
      }));
      
      return { isDead, allegiance: allegianceText, cardsState };
    });

    try {
      const games = JSON.parse(localStorage.getItem('rs_saved_games') || '[]');
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
          elapsedTime: state.elapsedTime
        }
      };

      if (existingIdx > -1) {
        games[existingIdx] = gameData;
      } else {
        games.unshift(gameData);
        if (games.length > 2) games.pop();
      }
      
      localStorage.setItem('rs_saved_games', JSON.stringify(games));
      setSavedGames(games);
    } catch (e) {
      console.error("Failed to save game to localStorage", e);
    }
  };

  useEffect(() => {
    const handleBeforeUnload = () => {
      saveCurrentGameRef.current();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        saveCurrentGameRef.current();
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    const activeGameId = localStorage.getItem('rs_active_game_id');
    if (activeGameId) {
      try {
        const games = JSON.parse(localStorage.getItem('rs_saved_games') || '[]');
        const game = games.find((g: any) => g.id === activeGameId);
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
        const games = JSON.parse(localStorage.getItem('rs_saved_games') || '[]');
        setSavedGames(games);
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
    setRes(game.state.res);
    setElapsedTime(game.state.elapsedTime || 0);
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
    }, 200);
  };

  const gen = () => {
    const r = generateGame(N, C);
    if (r.err) { setErr(r.err); setRes(null); }
    else { setRes(r.players.map((p: any) => ({ ...p, name: `Joueur ${p.id}` }))); setErr(''); setIsEditing(false); setIsPlaying(false); setIsConfirmingStop(false); setGameId(null); setElapsedTime(0); setGameName(''); }
  };

  const copy = () => {
    if (!res) return;
    const txt = res.map((p: any) => `${p.name} (${p.allegiance}): ${p.cards.join(', ')}`).join('\n');
    navigator.clipboard.writeText(txt);
    alert('Copié !');
  };

  const maxC = N <= 5 ? 8 : N === 6 ? 7 : N === 7 ? 6 : N === 8 ? 5 : N <= 10 ? 4 : 3;

  return (
    <div className="min-h-screen bg-neutral-950 text-gray-200 font-serif flex overflow-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Lato:wght@400;700&display=swap');
        .font-serif { font-family: 'Cinzel', serif; }
        .font-sans { font-family: 'Lato', sans-serif; }
        .role-mort { text-decoration: line-through; opacity: 0.5; }
        .joueur-mort { opacity: 0.6; filter: grayscale(1); }
        
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
          className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-neutral-900 border-r border-neutral-800 flex flex-col p-4 gap-2 transition-transform duration-300 md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} shadow-2xl`}>
        <div className="flex items-center gap-3 px-2 py-4 border-b border-neutral-800 mb-2">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-orange-900 to-red-900 flex items-center justify-center font-bold border border-orange-700 shadow-[0_0_10px_rgba(234,88,12,0.3)] text-white">RS</div>
          <span className="font-bold text-gray-100 tracking-wider">Renard & Spectre</span>
        </div>
        <button onClick={() => { if (isPlaying) saveCurrentGameRef.current(); setTab('ordre'); setIsSidebarOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${tab === 'ordre' ? 'bg-neutral-800 text-white border-neutral-700 shadow-inner' : 'text-gray-400 border-transparent hover:bg-neutral-800 hover:text-white'}`}><ScrollText size={20} /> Ordre</button>
        <button onClick={() => { if (isPlaying) saveCurrentGameRef.current(); setTab('audio'); setIsSidebarOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${tab === 'audio' ? 'bg-neutral-800 text-white border-neutral-700 shadow-inner' : 'text-gray-400 border-transparent hover:bg-neutral-800 hover:text-white'}`}><Music size={20} /> Musique</button>
        <button onClick={() => { if (isPlaying) saveCurrentGameRef.current(); setTab('history'); setIsSidebarOpen(false); }} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${tab === 'history' ? 'bg-neutral-800 text-white border-neutral-700 shadow-inner' : 'text-gray-400 border-transparent hover:bg-neutral-800 hover:text-white'}`}><History size={20} /> Anciennes parties</button>
        
        <div className="mt-auto pt-4 border-t border-neutral-800 flex flex-col items-center justify-center">
          <span className="text-xs text-gray-500 uppercase tracking-widest mb-1 font-sans">Temps de jeu</span>
          <span className="text-2xl font-mono text-gray-300 font-bold tracking-wider">{formatChrono(elapsedTime)}</span>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="h-16 md:h-20 border-b border-neutral-800 flex items-center px-4 md:px-8 bg-neutral-900/80 backdrop-blur-md gap-4 z-10 shadow-lg">
          <button 
            className="md:hidden p-2 text-gray-200 hover:bg-neutral-800 rounded-lg border border-transparent hover:border-neutral-700"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <Menu size={24} />
          </button>
          <h1 className="text-xl md:text-2xl font-bold text-gray-100 truncate tracking-widest drop-shadow-md">
            {tab === 'ordre' ? 'Configuration' : tab === 'audio' ? 'Ambiance' : 'Anciennes parties'}
          </h1>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 z-0">
          {tab === 'ordre' ? (
            <div className="max-w-4xl mx-auto space-y-6">
              {!res ? (
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 md:p-8 shadow-xl space-y-6 relative overflow-hidden group h-auto min-h-fit">
                  <h2 className="text-xl font-bold flex items-center gap-2 text-gray-200"><Settings className="text-orange-600" /> Configuration du Rituel</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <NumberControl label="Âmes (Joueurs)" value={N} min={4} max={14} onChange={(v: number) => { setN(v); if (C > maxC) setC(maxC); }} />
                    <NumberControl label={`Destins (Cartes Max ${maxC})`} value={C} min={3} max={maxC} onChange={setC} />
                  </div>
                  {err && <div className="text-red-300 bg-red-950/40 border border-red-900/50 p-4 rounded-lg flex items-center gap-2"><AlertTriangle size={20} /> {err}</div>}
                  <button onClick={gen} className="w-full bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all uppercase tracking-widest">Invoquer la Partie</button>
                </div>
              ) : (
                <div className="space-y-6">
                  {!isPlaying ? (
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <h2 className="text-2xl font-bold text-gray-100 drop-shadow-lg">{gameName || "Le Cercle"}</h2>
                      <div className="grid grid-cols-2 gap-[10px] w-full">
                        <button onClick={() => setRes(null)} className="flex items-center justify-center gap-2 bg-neutral-900 px-4 py-3 rounded-xl border border-neutral-800 hover:bg-neutral-800 text-gray-300 hover:text-white transition-colors shadow-md"><Settings size={18} /> Config</button>
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
                      {!hasPlayedNight1 ? (
                        <>
                          <h2 className="text-3xl font-black text-orange-500 tracking-widest uppercase drop-shadow-lg animate-pulse font-serif">DISTRIBUTION DES RÔLES</h2>
                          <p className="text-gray-400 text-sm max-w-md font-sans italic">Une fois la distribution des cartes effectuée, les joueurs prennent connaissance de leur rôle et s'endorment.</p>
                          <button onClick={() => { 
                            setHasPlayedNight1(true);
                            setShowNight(true); 
                            setCheckedRoles([]); 
                          }} className="flex items-center gap-2 bg-neutral-900 px-6 py-3 rounded-xl border border-neutral-700 text-base hover:bg-neutral-800 transition-all text-gray-200 hover:text-white shadow-lg font-bold tracking-wider mt-4">🌙 S'endormir</button>
                        </>
                      ) : (
                        <>
                          <h2 className="text-3xl font-black text-orange-500 tracking-widest uppercase drop-shadow-lg animate-pulse font-serif">NUIT {nightCount} - LA FORÊT S'ÉVEILLE</h2>
                          <p className="text-gray-400 text-sm max-w-md font-sans">Narrateur, veuillez marquer les rôles éliminés : utilisez l'icône Fantôme (👻) exclusivement pour les éliminations dues au pouvoir des Fantômes (Rituel), et l'icône Coche Verte (✅) pour toutes les autres éliminations (Vote, pouvoirs de nuit, etc.). Une fois terminé, cliquez sur 'S'endormir' pour lancer la nuit suivante.</p>
                          <div className="flex gap-2 mt-4">
                            <button onClick={() => { 
                              setNightCount(n => n + 1);
                              setShowNight(true); 
                              setCheckedRoles([]); 
                            }} className="flex items-center gap-2 bg-neutral-900 px-6 py-3 rounded-xl border border-neutral-700 text-base hover:bg-neutral-800 transition-all text-gray-200 hover:text-white shadow-lg font-bold tracking-wider">🌙 S'endormir</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {res.map((p: any, i: number) => (
                      <div key={p.id} data-initial-pure={p.allegiance === 'Innocent Pur' ? 'true' : 'false'} className="player-card bg-neutral-900 border-2 border-neutral-800 rounded-sm p-6 shadow-xl relative group overflow-hidden h-auto min-h-fit flex flex-col items-center text-center gap-4">
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
                          <div className="flex items-center gap-2 justify-center">
                            <span className="text-xs text-gray-500 font-sans">{p.cards.length} cartes</span>
                            <span className="allegiance-text text-xs font-bold text-gray-300 bg-neutral-800 px-2 py-1 rounded border border-neutral-700 hidden sm:inline-block font-sans">Allégeance : {p.allegiance}</span>
                          </div>
                        </div>
                        <div className="sm:hidden mb-4">
                            <span className="allegiance-text text-xs font-bold text-gray-300 bg-neutral-800 px-2 py-1 rounded border border-neutral-700 font-sans">Allégeance : {p.allegiance}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center">
                          {p.cards.map((c: string, i: number) => (
                            <CardBadge key={i} card={c} isPlaying={isPlaying} nightCount={nightCount} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {isPlaying && (
                    <div className="mt-8">
                      {!isConfirmingStop ? (
                        <button onClick={() => setIsConfirmingStop(true)} className="w-full bg-red-950/30 border border-red-900/50 text-red-200 py-4 rounded-xl hover:bg-red-950/50 transition-colors font-bold uppercase tracking-wider shadow-lg font-serif">Arrêter la partie</button>
                      ) : (
                        <div className="flex gap-4">
                          <button onClick={() => { saveCurrentGameRef.current(); setRes(null); setIsPlaying(false); setIsConfirmingStop(false); setGameId(null); }} className="flex-1 bg-red-900/80 text-white py-4 rounded-xl hover:bg-red-800 transition-colors font-bold uppercase tracking-wider border border-red-700 shadow-lg font-serif">Confirmer</button>
                          <button onClick={() => setIsConfirmingStop(false)} className="flex-1 bg-neutral-800 text-gray-300 py-4 rounded-xl border border-neutral-700 hover:bg-neutral-700 transition-colors font-bold uppercase tracking-wider shadow-lg font-serif">Annuler</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : tab === 'audio' ? (
            <div className="max-w-2xl mx-auto bg-neutral-900 border border-neutral-800 rounded-xl p-8 text-center space-y-6 shadow-2xl relative">
              <div className="text-orange-600 text-sm uppercase tracking-[0.2em] font-bold">Lecture en cours</div>
              <div className="text-4xl font-black text-gray-100 font-serif drop-shadow-md">{track}</div>

              <div className="flex items-center justify-center gap-6">
                <button onClick={() => { if(track!=='Aucune') setPlay(!play); }} className="w-20 h-20 rounded-full bg-neutral-800 border-2 border-neutral-700 flex items-center justify-center text-white shadow-xl hover:scale-105 transition-transform hover:border-white">
                  {play ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
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

              <div className="space-y-3 text-left mt-8">
                {['Ambiance Forêt', 'Tension Village', 'Traque', 'Spectres'].map(t => (
                  <div key={t} onClick={() => { setTrack(t); setPlay(true); }} className={`p-4 rounded-lg cursor-pointer border transition-all font-serif tracking-wide ${track === t ? 'bg-neutral-800 border-orange-700 text-white shadow-md' : 'bg-neutral-950 border-neutral-800 text-gray-400 hover:bg-neutral-900 hover:text-gray-200'}`}>{t}</div>
                ))}
              </div>
            </div>
          ) : tab === 'history' ? (
            <div className="max-w-4xl mx-auto h-full p-4 md:p-8">
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
          ) : null}
        </div>

        {showNight && (
          <div className="absolute inset-0 z-40 bg-neutral-950 text-gray-300 flex flex-col p-6 overflow-y-auto font-serif animate-in fade-in duration-500">
            <h1 className="text-3xl md:text-5xl font-black text-center mb-8 text-orange-600 tracking-widest border-b border-neutral-800 pb-4 drop-shadow-lg font-serif">Le Tableau du Narrateur - NUIT {nightCount}</h1>
            <div className="flex-1 max-w-2xl mx-auto w-full space-y-4">
            {(() => {
              const activeRoles = ORDRE_NUIT.filter(role => {
                const allBadges = Array.from(document.querySelectorAll('.role-badge'));
                const aliveNames = allBadges.filter(b => !b.classList.contains('role-mort')).map(b => b.textContent || '');
                const deadNames = allBadges.filter(b => b.classList.contains('role-mort')).map(b => b.textContent || '');

                if (role === 'Enfant de la nature') {
                  if (nightCount === 1 && aliveNames.includes('Enfant de la nature')) return true;
                  const deadBadge = allBadges.find(b => b.textContent === 'Enfant de la nature' && b.classList.contains('role-mort'));
                  return deadBadge ? parseInt(deadBadge.getAttribute('data-death-turn') || '0', 10) === nightCount - 1 : false;
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
                        onClick={() => setCheckedRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role])} 
                        className={`flex items-center gap-4 text-xl md:text-2xl cursor-pointer transition-all p-4 border rounded-xl shadow-lg group select-none relative overflow-hidden ${isChecked ? 'bg-neutral-900 border-neutral-800 text-gray-600' : 'bg-neutral-800 border-neutral-700 hover:text-white hover:border-neutral-600 hover:bg-neutral-700'}`}
                      >
                        <div className={`w-8 h-8 border-2 rounded-lg flex items-center justify-center transition-colors shadow-md z-10 ${isChecked ? 'bg-neutral-800 border-neutral-800' : 'bg-neutral-700 border-neutral-600 group-hover:border-white'}`}>
                          {isChecked && <Check size={20} className="text-neutral-600" />}
                        </div>
                        <span className={`z-10 font-serif tracking-wide ${isChecked ? 'line-through decoration-neutral-600 decoration-2' : 'text-gray-200'}`}>Appeler {role === 'Renard' ? 'les Renards' : role === 'Fantôme' ? 'les Fantômes' : /^[AEIOUYH]/i.test(role) ? `l'${role}` : `le ${role}`}</span>
                        
                        {role === 'Alchimiste' && (
                          <div className="ml-auto flex gap-4 z-10">
                            <div className="flex gap-1">
                              {[0, 1].map(i => (
                                <button key={`h-${i}`} 
                                  disabled={i >= potions.heal || isChecked}
                                  onClick={(e) => { e.stopPropagation(); setPotions(p => ({ ...p, heal: p.heal - 1 })); }} 
                                  className={`text-2xl transition-all ${i < potions.heal ? 'opacity-100 hover:scale-110 filter drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'invisible'}`}
                                  title="Potion de Vie">🧪</button>
                              ))}
                            </div>
                            <div className="flex gap-1">
                              {[0, 1].map(i => (
                                <button key={`d-${i}`} 
                                  disabled={i >= potions.death || isChecked}
                                  onClick={(e) => { e.stopPropagation(); setPotions(p => ({ ...p, death: p.death - 1 })); }} 
                                  className={`text-2xl transition-all ${i < potions.death ? 'opacity-100 hover:scale-110 filter hue-rotate-[240deg] saturate-200 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'invisible'}`}
                                  title="Potion de Mort">🧪</button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="mt-8 flex justify-center">
                    {allChecked && (
                      <button onClick={() => setShowNight(false)} className="bg-neutral-900 border border-neutral-800 text-white px-8 py-3 rounded-xl font-bold hover:bg-neutral-800 hover:text-white transition-all shadow-lg uppercase tracking-widest animate-in fade-in zoom-in font-serif">Afficher le Plateau</button>
                    )}
                  </div>
                </>
              );
            })()}
            </div>
          </div>
        )}
      </main>

      {/* Audio element always mounted to keep playing across tabs */}
      <audio 
        ref={audioRef} 
        src={
          track === 'Ambiance Forêt' ? '/ambiance-foret.mp4' : 
          track === 'Tension Village' ? '/tension-village.MP3' : 
          undefined
        } 
        loop 
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setPlay(false)}
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
                  setIsPlaying(true);
                  setNightCount(1);
                  setHasPlayedNight1(false);
                  setElapsedTime(0);
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
                  setIsPlaying(true);
                  setNightCount(1);
                  setHasPlayedNight1(false);
                  setElapsedTime(0);
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
    </div>
  );
}
