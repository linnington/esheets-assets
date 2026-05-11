// Constants & Config
const COLS = 13;
const ROWS = 9;

const ANIMAL_STATS = {
    'Rabbit': { emoji: '🐇', move: 6, speed: 3, str: 0, skill: 1, trait: 'Sprint' },
    'Fox': { emoji: '🦊', move: 5, speed: 2, str: 1, skill: 3, trait: 'Sneaky' },
    'Bear': { emoji: '🐻', move: 3, speed: 0, str: 4, skill: 0, trait: 'Maul' },
    'Tortoise': { emoji: '🐢', move: 3, speed: 0, str: 3, skill: 0, trait: 'Shell' },
    'Cat': { emoji: '🐈', move: 5, speed: 3, str: 1, skill: 2, trait: 'Nine Lives' }
};

const START_POSITIONS = {
    purple: {
        'Rabbit': { c: 2, r: 3 },
        'Fox': { c: 3, r: 4 },
        'Bear': { c: 3, r: 6 },
        'Tortoise': { c: 2, r: 7 },
        'Cat': { c: 3, r: 8 }
    },
    green: {
        'Rabbit': { c: 12, r: 3 },
        'Fox': { c: 11, r: 4 },
        'Bear': { c: 11, r: 6 },
        'Tortoise': { c: 12, r: 7 },
        'Cat': { c: 11, r: 8 }
    }
};

const DIRS_8 = [[0,1],[1,0],[0,-1],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
const STATUS_SEVERITY = { 'normal': 0, 'dazed': 1, 'stunned': 2, 'ko': 3, 'out': 4 };

// Sound Engine
class SoundEngine {
    constructor() { this.ctx = null; this.muted = false; }
    init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    playTone(freq, type, duration, vol=0.1) {
        if (this.muted) return;
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }
    playNoise(duration, vol=0.2) {
        if (this.muted) return;
        this.init();
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        noise.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start();
    }
    diceTick() { this.playTone(800, 'sine', 0.05, 0.05); }
    success() { this.playTone(600, 'sine', 0.1, 0.1); setTimeout(() => this.playTone(800, 'sine', 0.2, 0.1), 100); }
    fail() { this.playTone(300, 'sawtooth', 0.3, 0.1); }
    tackle() { this.playNoise(0.2, 0.3); this.playTone(150, 'square', 0.2, 0.2); }
    fanfare() { [440, 554, 659, 880].forEach((f, i) => setTimeout(() => this.playTone(f, 'sine', 0.3, 0.15), i * 150)); }
    injury() {
        if (this.muted) return;
        this.playTone(160, 'sawtooth', 0.18, 0.16);
        setTimeout(() => this.playTone(110, 'square', 0.22, 0.12), 90);
        setTimeout(() => this.playNoise(0.15, 0.18), 40);
    }
    turnStart() {
        this.playTone(1046.50, 'sine', 0.3, 0.05); // C6
        setTimeout(() => this.playTone(1318.51, 'sine', 0.6, 0.05), 100); // E6
    }
    startWhistle() {
        if (this.muted) return;
        this.init();
        const t = this.ctx.currentTime;
        const duration = 0.5;
        
        // 1. Main Tone
        const toneOsc = this.ctx.createOscillator();
        toneOsc.type = 'sine';
        
        // Vibrato: LFO modifying the frequency
        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(45, t); // faster vibrato
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.setValueAtTime(200, t); // deeper freq modulation
        
        lfo.connect(lfoGain);
        lfoGain.connect(toneOsc.frequency);
        
        toneOsc.frequency.setValueAtTime(2300, t);
        toneOsc.frequency.linearRampToValueAtTime(2600, t + 0.05);
        toneOsc.frequency.linearRampToValueAtTime(2450, t + duration);
        
        // 2. Breath Noise
        const bufferSize = this.ctx.sampleRate * duration;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        
        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        
        const bpf = this.ctx.createBiquadFilter();
        bpf.type = 'bandpass';
        bpf.frequency.value = 2500;
        bpf.Q.value = 3;
        noiseSource.connect(bpf);
        
        // 3. Gain Envelope
        const masterGain = this.ctx.createGain();
        masterGain.gain.setValueAtTime(0, t);
        masterGain.gain.linearRampToValueAtTime(0.2, t + 0.02); // sharper attack
        masterGain.gain.setValueAtTime(0.2, t + 0.3); // hold
        masterGain.gain.exponentialRampToValueAtTime(0.01, t + duration); // clean fade
        
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.value = 0.9; // increased noise presence
        bpf.connect(noiseGain);
        noiseGain.connect(masterGain);
        toneOsc.connect(masterGain);
        
        masterGain.connect(this.ctx.destination);
        
        toneOsc.start(t);
        lfo.start(t);
        noiseSource.start(t);
        
        toneOsc.stop(t + duration);
        lfo.stop(t + duration);
        noiseSource.stop(t + duration);
    }
}
const sfx = new SoundEngine();

// State
let state = {
    turn: 'purple',
    activations: 3,
    activationPhase: 'idle',
    hasMovedThisActivation: false,
    pendingAction: null,
    selectedId: null,
    activeMode: null,
    isChangingTurn: false,
    animals: {},
    acorn: { c: 7, r: 5, carrierId: null },
    gameOver: false
};

// DOM Elements
const els = {
    grid: document.getElementById('grid-container'),
    log: document.getElementById('match-log'),
    btnMove: document.getElementById('btn-move'),
    btnTackle: document.getElementById('btn-tackle'),
    btnPass: document.getElementById('btn-pass'),
    btnSpecial: document.getElementById('btn-special'),
    btnFinishAct: document.getElementById('btn-finish-activation'),
    btnEndTurn: document.getElementById('btn-end-turn'),
    btnRestart: document.getElementById('btn-restart'),
    btnOverlay: document.getElementById('restart-btn-overlay'),
    startOverlay: document.getElementById('start-overlay'),
    startText: document.getElementById('start-text'),
    startDesc: document.getElementById('start-desc'),
    btnStartMatch: document.getElementById('btn-start-match'),
    btnMute: document.getElementById('btn-mute'),
    actionsCount: document.getElementById('actions-count'),
    currentPlayer: document.getElementById('current-player'),
    guidance: document.getElementById('guidance-panel'),
    selEmoji: document.getElementById('selected-emoji'),
    selName: document.getElementById('selected-name'),
    selTrait: document.getElementById('selected-trait'),
    statMove: document.getElementById('stat-move'),
    statSpeed: document.getElementById('stat-speed'),
    statStr: document.getElementById('stat-str'),
    statSkill: document.getElementById('stat-skill'),
    die1: document.getElementById('die1'),
    die2: document.getElementById('die2'),
    diceRes: document.getElementById('dice-result'),
    diceDisplay: document.getElementById('dice-display'),
    victoryOverlay: document.getElementById('victory-overlay'),
    victoryText: document.getElementById('victory-text'),
    benchPurple: document.getElementById('bench-purple-slots'),
    benchGreen: document.getElementById('bench-green-slots'),
    suspensePanel: document.getElementById('suspense-panel'),
    suspenseTitle: document.getElementById('suspense-title'),
    suspenseDesc: document.getElementById('suspense-desc'),
    suspenseDie1: document.getElementById('suspense-die1'),
    suspenseDie2: document.getElementById('suspense-die2'),
    btnRollDice: document.getElementById('btn-roll-dice'),
};

function setDieFace(el, value) {
    el.textContent = '';
    el.className = 'dice';
    if (value >= 1 && value <= 6) {
        el.classList.add(`die-${value}`);
    } else {
        el.classList.add('die-waiting');
    }
}

// Initialization
function initGame() {
    state = {
        turn: Math.random() > 0.5 ? 'purple' : 'green',
        activations: 3,
        activationPhase: 'idle',
        hasMovedThisActivation: false,
        pendingAction: null,
        selectedId: null,
        activeMode: null,
        isChangingTurn: false,
        animals: {},
        acorn: { c: 7, r: 5, carrierId: null },
        gameOver: false,
        matchStarted: false
    };

    ['purple', 'green'].forEach(team => {
        Object.keys(START_POSITIONS[team]).forEach(type => {
            const id = `${team}_${type}`;
            state.animals[id] = {
                id, team, type,
                c: START_POSITIONS[team][type].c,
                r: START_POSITIONS[team][type].r,
                status: 'normal',
                hasActed: false,
                sprintUsed: false,
                sprintActive: false,
                distMovedThisPlay: 0,
                stunnedMissedTurn: false
            };
        });
    });

    els.log.innerHTML = '';
    els.victoryOverlay.classList.add('hidden');
    els.benchPurple.innerHTML = '';
    els.benchGreen.innerHTML = '';
    setDieFace(els.die1, null);
    setDieFace(els.die2, null);
    els.diceRes.textContent = '-';
    
    createGrid();
    renderBoard();
    updateUI();
    
    logMsg(`The football is kicked high into the air... Furball kickoff: ${state.turn.charAt(0).toUpperCase() + state.turn.slice(1)} wins the start!`, 'system');
    setGuidance("Waiting for match to start...");
    els.startText.textContent = "Furball Toss!";
    els.startDesc.textContent = `${state.turn.charAt(0).toUpperCase() + state.turn.slice(1)} starts.`;
    els.startOverlay.classList.remove('hidden');
    updateUI();
}

function createGrid() {
    els.grid.innerHTML = '';
    for (let r = 1; r <= ROWS; r++) {
        for (let c = 1; c <= COLS; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.c = c;
            cell.dataset.r = r;
            cell.addEventListener('click', () => handleCellClick(c, r));
            els.grid.appendChild(cell);
        }
    }
}

// Helpers
function getCell(c, r) { return els.grid.querySelector(`.cell[data-c="${c}"][data-r="${r}"]`); }
function getAnimalAt(c, r) { return Object.values(state.animals).find(a => a.c === c && a.r === r && ['normal', 'dazed', 'stunned'].includes(a.status)); }
function getAnimal(id) { return state.animals[id]; }
function getAcornCarrier() { return state.acorn.carrierId ? getAnimal(state.acorn.carrierId) : null; }
function dist(c1, r1, c2, r2) { return Math.max(Math.abs(c1 - c2), Math.abs(r1 - r2)); } // Chebyshev distance
function displayCoord(c, r) { return `(${c}, ${ROWS - r + 1})`; }

function logRoll(label, roll, modifier = 0, target = null) {
    const total = roll.total + modifier;
    let msg = `${label}: rolled ${roll.d1} + ${roll.d2}`;
    if (modifier !== 0) msg += ` ${modifier >= 0 ? '+' : '-'} ${Math.abs(modifier)}`;
    msg += ` = ${total}`;
    if (target !== null) msg += ` (target ${target}+)`;
    logMsg(msg, 'system');
}

function logMsg(msg, type = '') {
    const p = document.createElement('div');
    p.className = `log-entry ${type}`;
    p.textContent = msg;
    els.log.appendChild(p);
    els.log.scrollTop = els.log.scrollHeight;
}

function setGuidance(msg) { els.guidance.textContent = msg; }
function tName(animal) { return `${animal.team.charAt(0).toUpperCase() + animal.team.slice(1)} ${animal.type}`; }
function actionPrefix(animal) {
    if (animal.distMovedThisPlay > 0) return `Still in the same play, ${tName(animal)}`;
    return tName(animal);
}

// Rendering
function renderBoard() {
    document.querySelectorAll('.cell').forEach(cell => {
        cell.innerHTML = '';
        cell.classList.remove(
            'highlight-move',
            'highlight-tackle',
            'highlight-pass',
            'occupied-purple',
            'occupied-green'
        );
    });
    els.benchPurple.innerHTML = '';
    els.benchGreen.innerHTML = '';

    if (!state.acorn.carrierId) {
        const cCell = getCell(state.acorn.c, state.acorn.r);
        if (cCell) {
            const ac = document.createElement('div');
            ac.className = 'acorn';
            ac.textContent = '🏈';
            cCell.appendChild(ac);
        }
    }

    Object.values(state.animals).forEach(a => {
        const stats = ANIMAL_STATS[a.type];
        const el = document.createElement('div');
        el.className = `animal team-${a.team}`;
        el.id = `animal-${a.id}`;
        
        const inner = document.createElement('span');
        inner.className = 'emoji-inner';
        inner.textContent = stats.emoji;
        el.appendChild(inner);
        
        if (state.selectedId === a.id) el.classList.add('selected');
        if (state.acorn.carrierId === a.id) el.classList.add('carrying-acorn');

        if (a.status === 'dazed') {
            const b = document.createElement('div'); b.className='status-badge'; b.textContent='DAZED'; el.appendChild(b);
        } else if (a.status === 'stunned') {
            const b = document.createElement('div'); b.className='status-badge'; b.textContent='STUNNED'; el.appendChild(b);
        } else if (a.team === state.turn && a.hasActed) {
            el.style.opacity = '0.55';
        }

        if (a.status === 'ko' || a.status === 'out') {
            const bench = a.team === 'purple' ? els.benchPurple : els.benchGreen;
            if(a.status === 'out') el.style.filter = 'grayscale(100%)';
            bench.appendChild(el);
        } else {
            const cell = getCell(a.c, a.r);
            if (cell) {
                cell.classList.add(`occupied-${a.team}`);
                cell.appendChild(el);
            }
        }
    });

    highlightActiveMode();
}

function updateUI() {
    els.currentPlayer.textContent = `${state.turn.charAt(0).toUpperCase() + state.turn.slice(1)} Turn`;
    els.currentPlayer.className = `turn-${state.turn}`;
    els.actionsCount.textContent = state.activations;

    const sel = getAnimal(state.selectedId);
    if (sel) {
        const stats = ANIMAL_STATS[sel.type];
        els.selEmoji.textContent = stats.emoji;
        els.selName.textContent = tName(sel);
        els.selTrait.textContent = `Trait: ${stats.trait}`;
        els.statMove.textContent = sel.sprintActive ? stats.move + 2 : stats.move;
        els.statSpeed.textContent = (stats.speed >= 0 ? '+' : '') + stats.speed;
        els.statStr.textContent = (stats.str >= 0 ? '+' : '') + stats.str;
        els.statSkill.textContent = (stats.skill >= 0 ? '+' : '') + stats.skill;

        const isRolling = state.activationPhase === 'rolling';
        const isMyTurn = state.turn === sel.team;
        const canAct = isMyTurn && !sel.hasActed && sel.status === 'normal' && state.activations > 0 && !isRolling;
        const canMove = canAct && !state.hasMovedThisActivation;

        els.btnMove.disabled = !canMove;
        els.btnTackle.disabled = !canAct;
        
        let passEnabled = false;
        if (canAct && state.acorn.carrierId === sel.id) {
            const receivers = getValidPassReceivers(sel);
            if (receivers.length > 0) passEnabled = true;
        }
        els.btnPass.disabled = !passEnabled;
        
        els.btnSpecial.classList.add('hidden');
        if (sel.type === 'Rabbit' && canMove && !sel.sprintUsed && !sel.sprintActive) {
            els.btnSpecial.classList.remove('hidden');
            els.btnSpecial.textContent = 'Sprint';
            els.btnSpecial.disabled = false;
        }

        if (state.activationPhase === 'awaitingAction') {
            els.btnFinishAct.classList.remove('hidden');
            els.btnFinishAct.disabled = false;
        } else if (state.activationPhase === 'idle' && isMyTurn && !sel.hasActed) {
            els.btnFinishAct.classList.add('hidden');
        } else {
            els.btnFinishAct.classList.add('hidden');
        }

    } else {
        els.selEmoji.textContent = '❓';
        els.selName.textContent = 'Select an Animal';
        els.selTrait.textContent = 'Trait: -';
        els.statMove.textContent = '-';
        els.statSpeed.textContent = '-';
        els.statStr.textContent = '-';
        els.statSkill.textContent = '-';
        
        els.btnMove.disabled = true;
        els.btnTackle.disabled = true;
        els.btnPass.disabled = true;
        els.btnSpecial.classList.add('hidden');
        els.btnFinishAct.classList.add('hidden');
    }

    if (!state.matchStarted) {
        els.btnMove.disabled = true;
        els.btnTackle.disabled = true;
        els.btnPass.disabled = true;
        els.btnSpecial.classList.add('hidden');
        els.btnFinishAct.classList.add('hidden');
        els.btnEndTurn.disabled = true;
        return;
    }

    els.btnMove.classList.toggle('active-mode', state.activeMode === 'move');
    els.btnTackle.classList.toggle('active-mode', state.activeMode === 'tackle');
    els.btnPass.classList.toggle('active-mode', state.activeMode === 'pass');

    els.btnEndTurn.disabled = state.activationPhase === 'rolling' || state.isChangingTurn;
}

// Interaction
function handleCellClick(c, r) {
    if (state.gameOver || state.activationPhase === 'rolling' || !state.matchStarted) return;
    sfx.init();

    const clickedAnimal = getAnimalAt(c, r);

    if (state.activeMode === 'move' && state.selectedId) {
        if (!clickedAnimal && isCellHighlighted(c, r, 'highlight-move')) {
            executeMove(getAnimal(state.selectedId), c, r);
            return;
        }
    }
    
    if (state.activeMode === 'tackle' && state.selectedId) {
        if (clickedAnimal && isCellHighlighted(c, r, 'highlight-tackle')) {
            executeTackle(getAnimal(state.selectedId), clickedAnimal);
            return;
        }
    }

    if (state.activeMode === 'pass' && state.selectedId) {
        if (clickedAnimal && isCellHighlighted(c, r, 'highlight-pass')) {
            executePass(getAnimal(state.selectedId), clickedAnimal);
            return;
        }
    }

    // Selection
    if (clickedAnimal) {
        if (clickedAnimal.team !== state.turn) {
            setGuidance(`It is ${state.turn.charAt(0).toUpperCase() + state.turn.slice(1)}'s turn. Select a ${state.turn.charAt(0).toUpperCase() + state.turn.slice(1)} animal.`);
            return; 
        }
        
        if (state.activationPhase === 'awaitingAction' && state.selectedId !== clickedAnimal.id) {
            setGuidance(`Must finish ${getAnimal(state.selectedId).type}'s play first!`);
            return;
        }

        state.selectedId = clickedAnimal.id;
        
        // Auto move mode
        if (state.activationPhase === 'idle' && !clickedAnimal.hasActed && state.activations > 0 && !state.hasMovedThisActivation) {
            state.activeMode = 'move';
            setGuidance(`Choose where ${clickedAnimal.type} should move.`);
        } else {
            state.activeMode = null;
        }

    } else {
        if (state.activationPhase === 'awaitingAction') {
            setGuidance(`Must finish ${getAnimal(state.selectedId).type}'s play first!`);
            return;
        }
        state.selectedId = null;
        state.activeMode = null;
        if (state.activationPhase !== 'rolling') setGuidance(`${state.turn.charAt(0).toUpperCase() + state.turn.slice(1)} turn starts. Select a ${state.turn.charAt(0).toUpperCase() + state.turn.slice(1)} animal.`);
    }
    
    renderBoard();
    updateUI();
}

els.btnMove.addEventListener('click', () => { sfx.init(); state.activeMode = state.activeMode === 'move' ? null : 'move'; renderBoard(); updateUI(); });
els.btnTackle.addEventListener('click', () => { sfx.init(); state.activeMode = state.activeMode === 'tackle' ? null : 'tackle'; renderBoard(); updateUI(); });
els.btnPass.addEventListener('click', () => {
    sfx.init();
    const sel = getAnimal(state.selectedId);
    if (!sel || state.acorn.carrierId !== sel.id) return;
    const receivers = getValidPassReceivers(sel);
    if (receivers.length > 0) {
        state.activeMode = state.activeMode === 'pass' ? null : 'pass';
    } else {
        setGuidance("No valid teammate is available to receive a pass.");
    }
    renderBoard();
    updateUI();
});
els.btnSpecial.addEventListener('click', () => {
    sfx.init();
    const a = getAnimal(state.selectedId);
    if (a && a.type === 'Rabbit' && !a.sprintUsed) {
        a.sprintUsed = true;
        a.sprintActive = true;
        logMsg(`${tName(a)} activates Sprint! (+2 Move)`, a.team);
        updateUI();
        if(state.activeMode === 'move') renderBoard();
    }
});
els.btnFinishAct.addEventListener('click', () => {
    sfx.init();
    const a = getAnimal(state.selectedId);
    if (a) finishActivation(a, true);
});

els.btnEndTurn.addEventListener('click', () => endTurn(true));
els.btnRestart.addEventListener('click', initGame);
els.btnOverlay.addEventListener('click', initGame);
els.btnStartMatch.addEventListener('click', () => {
    sfx.startWhistle();
    state.matchStarted = true;
    els.startOverlay.classList.add('hidden');
    setGuidance(`${state.turn.charAt(0).toUpperCase() + state.turn.slice(1)} turn starts. Select a ${state.turn.charAt(0).toUpperCase() + state.turn.slice(1)} animal.`);
    logMsg(`--- ${state.turn.toUpperCase()} TURN STARTS: 3 plays available ---`, 'system');
    updateUI();
});
els.btnMute.addEventListener('click', () => {
    sfx.muted = !sfx.muted;
    els.btnMute.textContent = sfx.muted ? '🔇' : '🔊';
});


// Game Logic
function isCellHighlighted(c, r, type) {
    const cell = getCell(c, r);
    return cell && cell.classList.contains(type);
}

function getReachableCells(animal) {
    const maxMove = ANIMAL_STATS[animal.type].move + (animal.sprintActive ? 2 : 0);
    const queue = [{c: animal.c, r: animal.r, dist: 0}];
    const visited = new Set([`${animal.c},${animal.r}`]);
    const reachable = [];

    while (queue.length > 0) {
        const curr = queue.shift();
        if (curr.dist > 0) reachable.push({c: curr.c, r: curr.r});

        if (curr.dist < maxMove) {
            for (let [dc, dr] of DIRS_8) {
                const nc = curr.c + dc;
                const nr = curr.r + dr;
                if (nc >= 1 && nc <= COLS && nr >= 1 && nr <= ROWS) {
                    const key = `${nc},${nr}`;
                    if (!visited.has(key) && !getAnimalAt(nc, nr)) {
                        visited.add(key);
                        queue.push({c: nc, r: nr, dist: curr.dist + 1});
                    }
                }
            }
        }
    }
    return reachable;
}

function highlightActiveMode() {
    if (!state.selectedId) return;
    const a = getAnimal(state.selectedId);
    
    if (state.activeMode === 'move') {
        const reachable = getReachableCells(a);
        reachable.forEach(pos => {
            const cell = getCell(pos.c, pos.r);
            if(cell) cell.classList.add('highlight-move');
        });
    } 
    else if (state.activeMode === 'tackle') {
        for (let [dc, dr] of DIRS_8) {
            const target = getAnimalAt(a.c + dc, a.r + dr);
            if (target && target.team !== a.team) {
                const cell = getCell(target.c, target.r);
                if(cell) cell.classList.add('highlight-tackle');
            }
        }
    }
    else if (state.activeMode === 'pass') {
        const receivers = getValidPassReceivers(a);
        receivers.forEach(target => {
            const cell = getCell(target.c, target.r);
            if(cell) cell.classList.add('highlight-pass');
        });
    }
}

function getValidPassReceivers(carrier) {
    const receivers = [];
    Object.values(state.animals).forEach(target => {
        if (target.id !== carrier.id && target.team === carrier.team && target.status === 'normal') {
            if (dist(carrier.c, carrier.r, target.c, target.r) <= 8) {
                receivers.push(target);
            }
        }
    });
    return receivers;
}

function hasAdjacentEnemy(animal) {
    for (let [dc, dr] of DIRS_8) {
        const target = getAnimalAt(animal.c + dc, animal.r + dr);
        if (target && target.team !== animal.team) return true;
    }
    return false;
}

function countAdjacentEnemies(animal) {
    let count = 0;
    for (let [dc, dr] of DIRS_8) {
        const target = getAnimalAt(animal.c + dc, animal.r + dr);
        if (target && target.team !== animal.team) count++;
    }
    return count;
}

function checkAutoFinish(animal) {
    const canTackle = hasAdjacentEnemy(animal);
    let canPass = false;
    if (state.acorn.carrierId === animal.id) {
        const receivers = getValidPassReceivers(animal);
        canPass = receivers.length > 0;
    }
    
    if (!canTackle && !canPass) {
        if (state.acorn.carrierId === animal.id) {
            logMsg(`${animal.type} has no teammate in pass range.`, 'system');
        }
        logMsg(`${animal.type} has no available main actions. Play auto-finishes.`, 'system');
        finishActivation(animal);
    } else {
        state.selectedId = animal.id;
        state.activationPhase = 'awaitingAction';
        state.activeMode = null;
        
        if (state.acorn.carrierId === animal.id) {
            if (canPass && canTackle) {
                setGuidance(`${tName(animal)} has the ball. Choose Tackle, Pass, or Finish Play.`);
                logMsg(`${animal.type} has a teammate in range and may pass, or may tackle.`, 'system');
            } else if (canPass) {
                setGuidance(`${tName(animal)} has the ball. Choose Pass or Finish Play.`);
                logMsg(`${animal.type} has a teammate in range and may pass.`, 'system');
            } else if (canTackle) {
                setGuidance(`${tName(animal)} has the ball. Choose Tackle or Finish Play.`);
                logMsg(`${animal.type} has no teammate in pass range, but may tackle.`, 'system');
            }
        } else {
            setGuidance(`${animal.type} may now tackle, pass, or finish the play. After a tackle or pass, the play ends.`);
        }
        renderBoard();
        updateUI();
    }
}

// Status Application
function applyStatus(animal, newStatus) {
    const curSev = STATUS_SEVERITY[animal.status];
    const newSev = STATUS_SEVERITY[newStatus];

    if (newSev > curSev) {
        sfx.injury();
        animal.status = newStatus;
        if (newStatus === 'dazed') {
            logMsg(`${tName(animal)} is DAZED: misses its next play opportunity, then recovers.`, 'error');
        } else if (newStatus === 'stunned') {
            animal.stunnedMissedTurn = false;
            logMsg(`${tName(animal)} is STUNNED: misses its next team turn and recovers at the start of its following turn.`, 'error');
        } else if (newStatus === 'ko') {
            if (state.acorn.carrierId === animal.id) scatterAcorn(animal.c, animal.r, 1);
            logMsg(`${tName(animal)} is KNOCKED OUT: sent to bench, must roll 8+ to return.`, 'error');
        } else if (newStatus === 'out') {
            if (state.acorn.carrierId === animal.id) scatterAcorn(animal.c, animal.r, 1);
            logMsg(`${tName(animal)} suffers a SPECTACULAR OUCH: out for the rest of the match!`, 'error');
        }
    } else if (newSev === curSev && newStatus === 'stunned') {
        animal.stunnedMissedTurn = false;
        logMsg(`${tName(animal)} takes another Stunned result! Duration refreshed.`, 'error');
    } else {
        logMsg(`${tName(animal)} is already ${animal.status.toUpperCase()}, so the weaker ${newStatus.toUpperCase()} result has no extra effect.`, 'system');
    }
}

// Suspense System
function startSuspense(title, desc, callback) {
    state.activationPhase = 'rolling';
    state.pendingAction = callback;
    
    els.suspenseTitle.textContent = title;
    els.suspenseDesc.textContent = desc;
    setDieFace(els.suspenseDie1, null);
    setDieFace(els.suspenseDie2, null);
    
    els.diceDisplay.classList.add('hidden');
    els.suspensePanel.classList.remove('hidden');
    setGuidance("Press Roll dice to resolve action.");
    updateUI();
}

function clearSuspenseState() {
    state.activationPhase = 'idle';
    state.pendingAction = null;
    els.suspensePanel.classList.add('hidden');
    els.diceDisplay.classList.remove('hidden');
    els.btnRollDice.disabled = false;
}

els.btnRollDice.addEventListener('click', () => {
    els.btnRollDice.disabled = true;
    let cycles = 15;
    const interval = setInterval(() => {
        sfx.diceTick();
        setDieFace(els.suspenseDie1, Math.floor(Math.random() * 6) + 1);
        setDieFace(els.suspenseDie2, Math.floor(Math.random() * 6) + 1);
        cycles--;
        if (cycles <= 0) {
            clearInterval(interval);
            const d1 = Math.floor(Math.random() * 6) + 1;
            const d2 = Math.floor(Math.random() * 6) + 1;
            setDieFace(els.suspenseDie1, d1);
            setDieFace(els.suspenseDie2, d2);
            setDieFace(els.die1, d1);
            setDieFace(els.die2, d2);
            
            setTimeout(() => {
                els.btnRollDice.disabled = false;
                els.suspensePanel.classList.add('hidden');
                els.diceDisplay.classList.remove('hidden');
                
                const callback = state.pendingAction;
                if (callback) {
                    try {
                        callback({ d1, d2, total: d1 + d2, isDouble1: d1===1 && d2===1, isDouble6: d1===6 && d2===6 });
                    } catch (e) {
                        console.error('Suspense error:', e);
                        clearSuspenseState();
                    }
                }
            }, 1200);
        }
    }, 50);
});

// Actions
function executeMove(animal, destC, destR) {
    state.activeMode = null;
    const distanceMoved = dist(animal.c, animal.r, destC, destR);
    animal.distMovedThisPlay += distanceMoved;
    
    const adjacentEnemies = countAdjacentEnemies(animal);
    
    if (adjacentEnemies >= 2) {
        const speed = ANIMAL_STATS[animal.type].speed;
        let modifier = speed;
        let sneakyTxt = '';
        if (animal.type === 'Fox') { modifier += 1; sneakyTxt = " Fox's Sneaky trait adds +1."; }
        const target = 8;
        
        logMsg(`${tName(animal)} is surrounded by ${adjacentEnemies} opponents and must dodge to escape.`, 'system');

        startSuspense('Dodge Attempt', 
            `Roll 2 dice + ${speed} (Speed).\nTarget: ${target} or more.${sneakyTxt}`,
            (roll) => {
                logRoll('Dodge roll', roll, modifier, target);
                const total = roll.total + modifier;
                els.diceRes.textContent = `Dodge: ${roll.total} + ${modifier} = ${total}`;
                if (total >= target) {
                    sfx.success();
                    logMsg(`Success! ${animal.type} smoothly dodges away to ${displayCoord(destC, destR)}.`, animal.team);
                    completeMove(animal, destC, destR);
                } else {
                    sfx.fail();
                    logMsg(`Failure! ${animal.type} tripped while dodging! (Total ${total}).`, 'error');
                    applyStatus(animal, 'dazed');
                    if (state.acorn.carrierId === animal.id) scatterAcorn(animal.c, animal.r, 1);
                    finishActivation(animal);
                }
            }
        );
    } else {
        logMsg(`Play starts: ${tName(animal)} moves to ${displayCoord(destC, destR)}.`, animal.team);
        completeMove(animal, destC, destR);
    }
}

function completeMove(animal, destC, destR) {
    animal.c = destC;
    animal.r = destR;
    state.hasMovedThisActivation = true;
    state.activationPhase = 'awaitingAction';
    state.activeMode = null;
    
    renderBoard();
    updateUI();

    if (!state.acorn.carrierId && state.acorn.c === animal.c && state.acorn.r === animal.r) {
        attemptPickup(animal);
    } else {
        checkAutoFinish(animal);
    }
}

function attemptPickup(animal, isSurprise = false, afterResolve = null) {
    const skill = ANIMAL_STATS[animal.type].skill;
    const prefix = actionPrefix(animal);
    logMsg(`${prefix} tries to scoop up the football.`, animal.team);
    
    startSuspense('Ball Pickup', 
        `Roll 2 dice + ${skill} (Skill).\nTarget: 8 or more.\nIf this fails, the ball will scatter.`,
        (roll) => {
            logRoll('Pickup roll', roll, skill, 8);
            let total = roll.total + skill;
            els.diceRes.textContent = `Pickup: ${roll.total} + ${skill} = ${total}`;

            if (total >= 8) {
                sfx.success();
                state.acorn.carrierId = animal.id;
                logMsg(`Success! ${animal.type} gracefully scoops up the football!`, animal.team);
                if (!isSurprise) {
                    state.activationPhase = 'awaitingAction';
                    checkAutoFinish(animal);
                } else {
                    renderBoard();
                    updateUI();
                }
            } else {
                sfx.fail();
                if (roll.isDouble1) {
                    logMsg(`Double 1! ${tName(animal)} bends down with all the grace of a wardrobe. The ball squirts away and the play ends.`, 'error');
                    scatterAcorn(animal.c, animal.r, 2);
                } else {
                    logMsg(`Failure! ${tName(animal)} fumbles the football. The play ends.`, 'error');
                    scatterAcorn(animal.c, animal.r, 1);
                }
                
                if (!isSurprise) {
                    finishActivation(animal);
                } else {
                    renderBoard();
                    updateUI();
                }
            }
            if (typeof afterResolve === 'function') afterResolve();
        }
    );
}

function scatterAcorn(fromC, fromR, maxDist) {
    let validSpots = [];
    let occupiedSpots = [];
    
    for (let c = fromC - maxDist; c <= fromC + maxDist; c++) {
        for (let r = fromR - maxDist; r <= fromR + maxDist; r++) {
            if (c >= 1 && c <= COLS && r >= 1 && r <= ROWS && (c !== fromC || r !== fromR)) {
                if (!getAnimalAt(c, r)) validSpots.push({c, r});
                else occupiedSpots.push({c, r});
            }
        }
    }
    
    let dest = null;
    if (validSpots.length > 0) dest = validSpots[Math.floor(Math.random() * validSpots.length)];
    else if (occupiedSpots.length > 0) dest = occupiedSpots[Math.floor(Math.random() * occupiedSpots.length)];
    
    state.acorn.carrierId = null;
    if (dest) {
        state.acorn.c = dest.c;
        state.acorn.r = dest.r;
        logMsg(`The football bounces loose to ${displayCoord(dest.c, dest.r)}.`, 'system');
        const hitAnimal = getAnimalAt(dest.c, dest.r);
        if (hitAnimal) {
            logMsg(`It bounces straight to ${tName(hitAnimal)}! They must try to grab it.`, hitAnimal.team);
            setTimeout(() => attemptPickup(hitAnimal, true), 800);
        }
    } else {
        state.acorn.c = fromC;
        state.acorn.r = fromR;
        logMsg(`The football is completely blocked in and stays at ${displayCoord(fromC, fromR)}.`, 'system');
    }
    renderBoard();
}

function executeTackle(attacker, defender) {
    state.activeMode = null;
    const attStr = ANIMAL_STATS[attacker.type].str;
    const defStr = ANIMAL_STATS[defender.type].str;
    const target = defStr > attStr ? 10 : 8;
    
    const modifier = attStr;
    let desc = target === 10 ? `This is a difficult tackle because ${defender.type} is stronger.` : `Success pushes ${defender.type} back.`;

    if (defStr > attStr) {
        desc += `\nWarning: If ${attacker.type} fails with a natural roll of 4 or less, they will be Dazed!`;
    }

    const prefix = actionPrefix(attacker);
    logMsg(`${prefix} tries to shove ${tName(defender)} out of the way. Needs ${target}+.`, attacker.team);

    startSuspense('Tackle!', 
        `Roll 2 dice + ${modifier} (Strength).\nTarget: ${target} or more.\n${desc}`,
        (roll) => {
            logRoll('Tackle roll', roll, modifier, target);
            const total = roll.total + modifier;
            els.diceRes.textContent = `Tackle: ${roll.total} + ${modifier} = ${total}`;

            if (total >= target) {
                sfx.tackle();
                logMsg(`Success! ${attacker.type} crashes into ${defender.type}! (Total ${total})`, attacker.team);
                
                const dc = Math.sign(defender.c - attacker.c);
                const dr = Math.sign(defender.r - attacker.r);
                const pc = defender.c + dc;
                const pr = defender.r + dr;

                const originalC = defender.c;
                const originalR = defender.r;
                const defenderHadAcorn = (state.acorn.carrierId === defender.id);
                const ballAlreadyLoose = !state.acorn.carrierId && !defenderHadAcorn;
                
                if (defenderHadAcorn) {
                    state.acorn.carrierId = null;
                }

                if (pc >= 1 && pc <= COLS && pr >= 1 && pr <= ROWS && !getAnimalAt(pc, pr)) {
                    defender.c = pc;
                    defender.r = pr;
                    logMsg(`${defender.type} is shoved back to ${displayCoord(pc, pr)}.`, defender.team);
                } else {
                    logMsg(`${defender.type} is slammed against an obstacle and stays in place.`, 'system');
                }

                if (defenderHadAcorn) {
                    logMsg(`The football pops loose from the collision!`, 'system');
                    scatterAcorn(originalC, originalR, 1);
                }

                let defenderLandedOnBall = false;
                if (ballAlreadyLoose && state.acorn.c === defender.c && state.acorn.r === defender.r) {
                    defenderLandedOnBall = true;
                }

                const handleOuchOrFinish = () => {
                    const margin = total - target;
                    if (margin >= 3 || roll.isDouble6) {
                        const reason = roll.isDouble6 ? "Double 6" : "Margin of 3 or more";
                        logMsg(`Big hit! ${reason} triggers an Ouch Table roll.`, 'error');
                        rollOuch(defender, attacker);
                    } else {
                        finishActivation(attacker);
                    }
                };

                if (defenderLandedOnBall) {
                    logMsg(`${defender.type} lands on the football! Surprise pickup attempt.`, defender.team);
                    attemptPickup(defender, true, handleOuchOrFinish);
                    return;
                } else {
                    handleOuchOrFinish();
                    return; 
                }
            } else {
                sfx.fail();
                if (roll.isDouble1) {
                    logMsg(`Double 1! ${tName(attacker)} launches itself at ${defender.type} and immediately regrets it.`, 'error');
                    applyStatus(attacker, 'dazed');
                    if (state.acorn.carrierId === attacker.id) scatterAcorn(attacker.c, attacker.r, 1);
                } else if (defStr > attStr && roll.total <= 4) {
                    logMsg(`Bad idea! ${tName(attacker)} hits ${defender.type} at full speed. ${defender.type} barely notices. ${attacker.type} is Dazed.`, 'error');
                    applyStatus(attacker, 'dazed');
                    if (state.acorn.carrierId === attacker.id) scatterAcorn(attacker.c, attacker.r, 1);
                } else {
                    logMsg(`Failure! ${attacker.type} bounces off ${defender.type}. No movement caused.`, 'error');
                }
            }
            finishActivation(attacker);
        }
    );
}

function rollOuch(defender, attacker) {
    let modifier = 0;
    const modDesc = [];
    if (attacker && attacker.type === 'Bear') { modifier += 1; modDesc.push("Bear's Maul adds +1"); }
    if (defender.type === 'Tortoise') { modifier -= 2; modDesc.push("Tortoise's Shell subtracts 2"); }
    const modText = modDesc.length > 0 ? `\nModifiers: ${modDesc.join(', ')}.` : '';

    startSuspense('Ouch Table', 
        `Rolling for ${defender.type}'s injury.\nRoll 2 dice ${modifier >= 0 ? '+' : ''}${modifier}.\nHigher is worse!${modText}`,
        (roll) => {
            logRoll('Ouch roll', roll, modifier);
            const ouchRoll = roll.total + modifier;
            els.diceRes.textContent = `Ouch: ${ouchRoll}`;

            if (ouchRoll <= 5) applyStatus(defender, 'dazed');
            else if (ouchRoll <= 8) applyStatus(defender, 'stunned');
            else if (ouchRoll <= 11) applyStatus(defender, 'ko');
            else {
                if (defender.type === 'Cat') {
                    logMsg(`Nine Lives! ${tName(defender)} should be Out, but cats do not go out that easily. ${tName(defender)} is Knocked Out instead.`, defender.team);
                    applyStatus(defender, 'ko');
                } else {
                    applyStatus(defender, 'out');
                }
            }
            
            finishActivation(attacker);
        }
    );
}

function executePass(passer, receiver) {
    state.activeMode = null;
    const d = dist(passer.c, passer.r, receiver.c, receiver.r);
    let throwTarget, catchTarget, passType, scatterDist;

    if (d === 1) { passType = 'Hand-off'; throwTarget = 0; catchTarget = 7; scatterDist = 1; }
    else if (d <= 4) { passType = 'Short pass'; throwTarget = 8; catchTarget = 8; scatterDist = 1; }
    else if (d <= 6) { passType = 'Medium pass'; throwTarget = 9; catchTarget = 9; scatterDist = 2; }
    else { passType = 'Long pass'; throwTarget = 10; catchTarget = 10; scatterDist = 3; }

    const prefix = actionPrefix(passer);
    logMsg(`${prefix} is throwing to ${tName(receiver)}.`, passer.team);
    logMsg(`Distance: ${d} squares, so this is a ${passType}.`, 'system');

    if (throwTarget > 0) {
        const throwSkill = ANIMAL_STATS[passer.type].skill;
        startSuspense('Pass: Throw', 
            `Distance: ${d} (${passType}).\nRoll 2 dice + ${throwSkill} (Skill).\nTarget: ${throwTarget} or more.`,
            (roll) => {
                logRoll('Throw roll', roll, throwSkill, throwTarget);
                const throwTotal = roll.total + throwSkill;
                els.diceRes.textContent = `Throw: ${throwTotal}`;
                if (throwTotal < throwTarget) {
                    sfx.fail();
                    if (roll.isDouble1) {
                        logMsg(`Double 1! ${tName(passer)} launches an absolute potato of a pass. The football sails wildly.`, 'error');
                    } else {
                        logMsg(`Failure! Terrible throw by ${passer.type}.`, 'error');
                    }
                    scatterAcorn(receiver.c, receiver.r, scatterDist);
                    finishActivation(passer);
                } else {
                    sfx.success();
                    logMsg(`Success! Perfect spiral! Now ${receiver.type} must catch it.`, passer.team);
                    resolveCatch(passer, receiver, catchTarget, scatterDist);
                }
            }
        );
    } else {
        resolveCatch(passer, receiver, catchTarget, scatterDist);
    }
}

function resolveCatch(passer, receiver, catchTarget, scatterDist) {
    const catchSkill = ANIMAL_STATS[receiver.type].skill;
    startSuspense('Pass: Catch', 
        `${receiver.type} reaches for the pass!\nRoll 2 dice + ${catchSkill} (Skill).\nTarget: ${catchTarget} or more.`,
        (roll) => {
            logRoll('Catch roll', roll, catchSkill, catchTarget);
            let catchTotal = roll.total + catchSkill;
            els.diceRes.textContent = `Catch: ${catchTotal}`;

            if (catchTotal >= catchTarget) {
                sfx.success();
                logMsg(`Success! What a catch by ${receiver.type}!`, receiver.team);
                state.acorn.carrierId = receiver.id;
            } else {
                sfx.fail();
                if (roll.isDouble1) {
                    logMsg(`Double 1! ${tName(receiver)} gets the ball tangled in its paws and faceplants.`, 'error');
                    applyStatus(receiver, 'dazed');
                } else {
                    logMsg(`Failure! Through the hands! ${receiver.type} drops the pass.`, 'error');
                }
                scatterAcorn(receiver.c, receiver.r, scatterDist);
            }
            finishActivation(passer);
        }
    );
}

function finishActivation(animal, manual = false) {
    if (manual) logMsg(`Play complete.`, 'system');
    animal.hasActed = true;
    state.activations--;
    state.activationPhase = 'idle';
    state.hasMovedThisActivation = false;
    animal.distMovedThisPlay = 0;
    state.activeMode = null;
    state.selectedId = null;
    state.pendingAction = null;
    
    // Clear dice display
    setDieFace(els.die1, null);
    setDieFace(els.die2, null);
    els.diceRes.textContent = 'Awaiting next play';

    const winner = checkWin();
    if (winner) {
        state.gameOver = true;
        sfx.fanfare();
        els.victoryText.textContent = `${winner.charAt(0).toUpperCase() + winner.slice(1)} scores!`;
        els.victoryText.className = `turn-${winner}`;
        els.victoryOverlay.classList.remove('hidden');
        logMsg(`*** ${winner.toUpperCase()} SCORES! ***`, winner);
        return true;
    }

    if (state.activations <= 0) {
        endTurn();
    } else {
        setGuidance(`Play complete. Select another ${state.turn.charAt(0).toUpperCase() + state.turn.slice(1)} animal.`);
        renderBoard();
        updateUI();
    }
}

function checkWin() {
    const carrier = getAcornCarrier();
    if (carrier) {
        if (carrier.team === 'purple' && carrier.c === COLS) return 'purple';
        if (carrier.team === 'green' && carrier.c === 1) return 'green';
    }
    return null;
}

function endTurn(isManual = false) {
    if (state.isChangingTurn) return;
    state.isChangingTurn = true;

    if (isManual) {
        logMsg(`--- ${state.turn.charAt(0).toUpperCase() + state.turn.slice(1)} ENDS THE TURN EARLY ---`, 'system');
    } else if (state.activations <= 0) {
        logMsg(`--- ${state.turn.charAt(0).toUpperCase() + state.turn.slice(1)} HAS USED ALL 3 PLAYS ---`, 'system');
    }

    Object.values(state.animals).forEach(a => {
        if (a.team === state.turn) {
            a.sprintActive = false;
            if (a.status === 'dazed') {
                a.status = 'normal';
                logMsg(`${tName(a)} shakes off the Daze.`, 'system');
            } else if (a.status === 'stunned') {
                logMsg(`${tName(a)} remains Stunned.`, 'system');
            }
        }
        a.distMovedThisPlay = 0;
    });

    state.turn = state.turn === 'purple' ? 'green' : 'purple';
    state.activations = 3;
    state.selectedId = null;
    state.activeMode = null;
    state.activationPhase = 'idle';
    state.hasMovedThisActivation = false;
    
    setDieFace(els.die1, null);
    setDieFace(els.die2, null);
    els.diceRes.textContent = '-';

    sfx.turnStart();
    logMsg(`--- ${state.turn.toUpperCase()} TURN STARTS: 3 plays available ---`, 'system');
    setGuidance(`${state.turn.charAt(0).toUpperCase() + state.turn.slice(1)} turn starts. Select a ${state.turn.charAt(0).toUpperCase() + state.turn.slice(1)} animal.`);

    const koAnimals = [];
    Object.values(state.animals).forEach(a => {
        if (a.team === state.turn) {
            a.hasActed = false;
            if (a.status === 'dazed') {
                a.hasActed = true;
                logMsg(`${tName(a)} is Dazed and misses this turn’s play opportunity.`, 'system');
            } else if (a.status === 'stunned') {
                if (!a.stunnedMissedTurn) {
                    a.hasActed = true;
                    a.stunnedMissedTurn = true;
                    logMsg(`${tName(a)} is Stunned and misses this entire turn.`, 'system');
                } else {
                    a.status = 'normal';
                    a.stunnedMissedTurn = false;
                    logMsg(`${tName(a)} finally shakes off the Stun.`, 'system');
                }
            } else if (a.status === 'ko') {
                koAnimals.push(a);
            }
        }
    });

    renderBoard();
    updateUI();

    if (koAnimals.length > 0) {
        state.isChangingTurn = true;
        logMsg(`${state.turn.charAt(0).toUpperCase() + state.turn.slice(1)} has ${koAnimals.length} KO recovery roll${koAnimals.length > 1 ? 's' : ''}.`, 'system');
        resolveKOs(koAnimals, 0);
    } else {
        state.isChangingTurn = false;
    }
}

function resolveKOs(koAnimals, index) {
    if (index >= koAnimals.length) {
        clearSuspenseState();
        state.activationPhase = 'idle';
        state.pendingAction = null;
        state.selectedId = null;
        state.activeMode = null;
        state.isChangingTurn = false;
        setGuidance(`${state.turn.charAt(0).toUpperCase() + state.turn.slice(1)} turn starts. Select a ${state.turn.charAt(0).toUpperCase() + state.turn.slice(1)} animal.`);
        renderBoard();
        updateUI();
        return;
    }
    const a = koAnimals[index];
    
    logMsg(`${tName(a)} is Knocked Out and rolls to return.`, a.team);
    
    state.activationPhase = 'rolling';
    state.selectedId = null;
    state.activeMode = null;
    renderBoard();
    updateUI();

    startSuspense('KO Recovery', `${tName(a)} tries to return to the pitch.\nRoll 2 dice. Target: 8 or more.`, (roll) => {
        logRoll('KO return roll', roll, 0, 8);
        els.diceRes.textContent = `KO Return: ${roll.total}`;
        if (roll.total >= 8) {
            sfx.success();
            const cols = a.team === 'purple' ? [1,2,3] : [13,12,11];
            let placed = false;
            for (let c of cols) {
                for (let r = 1; r <= ROWS; r++) {
                    if (!getAnimalAt(c, r)) {
                        a.c = c;
                        a.r = r;
                        a.status = 'normal';
                        a.hasActed = true;
                        logMsg(`Success! ${tName(a)} stumbles back onto the pitch!`, 'system');
                        placed = true;
                        break;
                    }
                }
                if (placed) break;
            }
            if(!placed) logMsg(`Success, but ${tName(a)} couldn't find space to return!`, 'system');
        } else {
            sfx.fail();
            logMsg(`Failure. ${tName(a)} is still seeing stars. Fails KO roll.`, 'system');
        }
        resolveKOs(koAnimals, index + 1);
    });
}

// Start
initGame();
