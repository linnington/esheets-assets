(function() {
    // --- Configuration & Constants ---
    const GRID_COLS = 15;
    const GRID_ROWS = 10;
    const ENTRANCE_X = 0;
    const ENTRANCE_Y = 4;
    const TOILET_CAPACITY = 60;
    const MAX_DAYS = 15;
    const STARTING_CASH = 1400;
    
    // --- Audio System ---
    let audioCtx = null;
    let soundEnabled = true;
    
    try {
        let storedSound = localStorage.getItem('zooMogulSoundEnabled');
        if (storedSound === null) storedSound = localStorage.getItem('pocketZooSoundEnabled');
        if (storedSound === 'false') soundEnabled = false;
    } catch(e) {}
    
    function initAudio() {
        if (!audioCtx) {
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (AudioContext) {
                    audioCtx = new AudioContext();
                }
            } catch(e) {
                console.warn("Web Audio API not supported", e);
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }
    
    function playSound(type) {
        if (!soundEnabled || !audioCtx) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        
        try {
            const t = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            if (type === 'success') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, t);
                osc.frequency.setValueAtTime(554.37, t + 0.1);
                gain.gain.setValueAtTime(0, t);
                gain.gain.linearRampToValueAtTime(0.1, t + 0.05);
                gain.gain.linearRampToValueAtTime(0, t + 0.3);
                osc.start(t);
                osc.stop(t + 0.3);
            } else if (type === 'warning') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(300, t);
                osc.frequency.setValueAtTime(250, t + 0.1);
                gain.gain.setValueAtTime(0, t);
                gain.gain.linearRampToValueAtTime(0.1, t + 0.05);
                gain.gain.linearRampToValueAtTime(0, t + 0.3);
                osc.start(t);
                osc.stop(t + 0.3);
            } else if (type === 'error') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, t);
                osc.frequency.linearRampToValueAtTime(100, t + 0.3);
                gain.gain.setValueAtTime(0, t);
                gain.gain.linearRampToValueAtTime(0.1, t + 0.05);
                gain.gain.linearRampToValueAtTime(0, t + 0.3);
                osc.start(t);
                osc.stop(t + 0.3);
            } else if (type === 'click') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, t);
                gain.gain.setValueAtTime(0, t);
                gain.gain.linearRampToValueAtTime(0.05, t + 0.01);
                gain.gain.linearRampToValueAtTime(0, t + 0.05);
                osc.start(t);
                osc.stop(t + 0.05);
            }
        } catch(e) {
            console.warn("Audio playback failed", e);
        }
    }
    
    const TOTAL_ENDINGS = 7;
    let discoveredEndings = [];
    try {
        let savedEndings = localStorage.getItem('zooMogulDiscoveredEndings');
        if (!savedEndings) savedEndings = localStorage.getItem('pocketZooDiscoveredEndings');
        if (savedEndings) discoveredEndings = JSON.parse(savedEndings);
    } catch(e) {}
    
    function saveEndings() {
        try {
            localStorage.setItem('zooMogulDiscoveredEndings', JSON.stringify(discoveredEndings));
        } catch(e) {}
    }
    
    const ITEMS = {
        // Facilities
        'path': { id: 'path', type: 'facility', name: 'Path', emoji: '▣', sizeW: 1, sizeH: 1, cost: 10, dailyCost: 0, desc: 'Provides visitor access.' },
        'food': { id: 'food', type: 'facility', name: 'Food Stall', emoji: '🍔', sizeW: 1, sizeH: 1, cost: 180, dailyCost: 20, desc: 'Increases food income. Slight litter.' },
        'toilet': { id: 'toilet', type: 'facility', name: 'Toilet', emoji: '🚻', sizeW: 1, sizeH: 1, cost: 150, dailyCost: 10, desc: 'Improves visitor happiness.' },
        'bin': { id: 'bin', type: 'facility', name: 'Bin', emoji: '🗑️', sizeW: 1, sizeH: 1, cost: 40, dailyCost: 2, desc: 'Improves cleanliness.' },
        'keeper': { id: 'keeper', type: 'facility', name: 'Keeper Hut', emoji: '🛖', sizeW: 2, sizeH: 1, cost: 250, dailyCost: 35, desc: 'Improves animal happiness.' },
        
        // Special
        'bulldoze': { id: 'bulldoze', type: 'tool', name: 'Bulldoze', emoji: '🔨', sizeW: 1, sizeH: 1, cost: 0, dailyCost: 0, desc: 'Remove item (50% refund).' },
        
        // Scenery
        'tree': { id: 'tree', type: 'scenery', name: 'Tree', emoji: '🌳', sizeW: 1, sizeH: 1, cost: 50, dailyCost: 2, desc: 'Adds shade and improves visitor happiness slightly.' },
        'flowers': { id: 'flowers', type: 'scenery', name: 'Flower Bed', emoji: '🌷', sizeW: 1, sizeH: 1, cost: 35, dailyCost: 1, desc: 'Makes the zoo prettier and slightly improves reputation.' },
        'pond': { id: 'pond', type: 'scenery', name: 'Pond', emoji: '🟦', sizeW: 2, sizeH: 2, cost: 120, dailyCost: 5, desc: 'A peaceful water feature that improves visitor and animal happiness.' },
        'picnic': { id: 'picnic', type: 'scenery', name: 'Picnic Area', emoji: '🧺', sizeW: 2, sizeH: 1, cost: 160, dailyCost: 8, desc: 'Improves visitor happiness, but creates a little extra litter.' },
        
        // Animals
        'rabbit': { id: 'rabbit', type: 'animal', name: 'Rabbits', emoji: '🐰', sizeW: 2, sizeH: 2, cost: 120, dailyCost: 10, appeal: 15, desc: 'Cheap starter animal.' },
        'parrot': { id: 'parrot', type: 'animal', name: 'Parrots', emoji: '🦜', sizeW: 2, sizeH: 2, cost: 220, dailyCost: 25, appeal: 25, desc: 'Colourful medium appeal.' },
        'penguin': { id: 'penguin', type: 'animal', name: 'Penguins', emoji: '🐧', sizeW: 3, sizeH: 2, cost: 260, dailyCost: 35, appeal: 30, desc: 'Reliable crowd-pleaser.' },
        'monkey': { id: 'monkey', type: 'animal', name: 'Monkeys', emoji: '🐒', sizeW: 3, sizeH: 2, cost: 300, dailyCost: 45, appeal: 40, desc: 'Popular but increases litter.' },
        'otter': { id: 'otter', type: 'animal', name: 'Otters', emoji: '🦦', sizeW: 3, sizeH: 2, cost: 360, dailyCost: 50, appeal: 45, desc: 'Strong family appeal.' },
        'lion': { id: 'lion', type: 'animal', name: 'Lions', emoji: '🦁', sizeW: 3, sizeH: 3, cost: 550, dailyCost: 80, appeal: 65, desc: 'High appeal, needs keepers.' },
        'panda': { id: 'panda', type: 'animal', name: 'Pandas', emoji: '🐼', sizeW: 3, sizeH: 3, cost: 800, dailyCost: 120, appeal: 90, desc: 'Huge appeal, expensive diva.' },
        'elephant': { id: 'elephant', type: 'animal', name: 'Elephants', emoji: '🐘', sizeW: 4, sizeH: 3, cost: 950, dailyCost: 140, appeal: 100, desc: 'Late-game crowd-puller.' }
    };
    
    // --- State ---
    let state = {
        zooName: "",
        cash: STARTING_CASH,
        day: 1,
        reputation: 50,
        visitorHappy: 60,
        animalHappy: 70,
        cleanliness: 70,
        ticketPrice: 5,
        lastProfit: 0,
        
        grid: [], 
        placedItems: [], 
        nextItemId: 1,
        
        selectedItemKey: null,
        report: {},
        nextEvent: null,
        milestones: {
            profit: false,
            vis100: false,
            rep70: false,
            happy90: false,
            conn3: false,
            all70: false
        },
        newRecordsThisRun: [],
        sponsorGoal: null,
        sponsorMostVisitors: 0
    };

    let bestRecords = {
        finalCash: 0,
        finalReputation: 0,
        finalRating: "None",
        mostVisitors: 0,
        highestProfit: 0
    };
    
    function loadRecords() {
        try {
            let data = localStorage.getItem('zooMogulBestRecords');
            if (!data) data = localStorage.getItem('pocketZooBestRecords');
            if (data) {
                const parsed = JSON.parse(data);
                bestRecords = { ...bestRecords, ...parsed };
            }
        } catch(e) {
            console.error("Local storage error:", e);
        }
    }

    function saveRecords() {
        try {
            localStorage.setItem('zooMogulBestRecords', JSON.stringify(bestRecords));
        } catch(e) {
            console.error("Local storage error:", e);
        }
    }

    const CHALLENGE_TEXTS = {
        profit: "First profitable day",
        vis100: "Reach 100 visitors in a day",
        rep70: "Reach reputation 70",
        happy90: "Reach animal happiness 90",
        conn3: "Make 3 animal habitats visitor-accessible",
        all70: "Reach 70+ in all main stats"
    };

    function updateChallengesUI() {
        const list = document.getElementById('pz-challenges-list');
        if (!list) return;
        let html = '';
        for (let key in CHALLENGE_TEXTS) {
            const achieved = state.milestones[key];
            const icon = achieved ? '✓' : '☐';
            const cssClass = achieved ? 'pz-challenge-done' : 'pz-challenge-pending';
            const ariaText = achieved ? 'Completed:' : 'Incomplete:';
            html += `<div class="pz-challenge-item ${cssClass}">
                <span class="pz-visually-hidden">${ariaText}</span>
                <span class="pz-challenge-icon" aria-hidden="true">${icon}</span>
                <span class="pz-challenge-text">${CHALLENGE_TEXTS[key]}</span>
            </div>`;
        }
        list.innerHTML = html;
    }

    function updateEventUI() {
        const titleEl = document.getElementById('pz-next-event-title');
        const detailsEl = document.getElementById('pz-next-event-details');
        if (!titleEl || !detailsEl) return;
        
        if (state.day > MAX_DAYS || !state.nextEvent) {
            titleEl.textContent = "Challenge Complete";
            detailsEl.innerHTML = "No more events.";
            return;
        }

        const evt = state.nextEvent;
        titleEl.textContent = "Tomorrow's Event";
        detailsEl.innerHTML = `
            <div class="pz-event-name">${evt.name}</div>
            <div class="pz-event-warning">
                <span class="pz-event-warning-label">Warning:</span> ${evt.warningText}
            </div>
            <div class="pz-event-prepare">
                <span class="pz-event-prepare-label">Prepare:</span> ${evt.prepareText}
            </div>
        `;
    }

    const SPONSOR_GOALS = [
        { id: 1, title: "Clean Zoo Sponsor", desc: "Finish with cleanliness 80 or higher.", success: "The sponsor loved your sparkling-clean zoo.", fail: "The sponsor was disappointed by the litter.", check: (s) => s.cleanliness >= 80, progress: (s) => s.cleanliness >= 80 ? `Target reached! (80+)` : `Current cleanliness: ${s.cleanliness}<br>Target: 80+` },
        { id: 2, title: "Happy Animals Sponsor", desc: "Finish with animal happiness 85 or higher.", success: "The sponsor praised your excellent animal care.", fail: "The sponsor noted your animals seemed stressed.", check: (s) => s.animalHappy >= 85, progress: (s) => s.animalHappy >= 85 ? `Target reached! (85+)` : `Current animal happiness: ${s.animalHappy}<br>Target: 85+` },
        { id: 3, title: "Crowd-Puller Sponsor", desc: "Reach 100 visitors on at least one day.", success: "The sponsor was impressed by your crowd numbers.", fail: "The sponsor wanted to see more visitors.", check: (s) => s.sponsorMostVisitors >= 100, progress: (s) => s.sponsorMostVisitors >= 100 ? `Target reached! (100+ visitors)` : `Best so far: ${s.sponsorMostVisitors} visitors<br>Target: 100 visitors` },
        { id: 4, title: "Reputation Sponsor", desc: "Finish with reputation 75 or higher.", success: "The sponsor was delighted by your zoo's reputation.", fail: "The sponsor hoped for a higher reputation.", check: (s) => s.reputation >= 75, progress: (s) => s.reputation >= 75 ? `Target reached! (75+)` : `Current reputation: ${s.reputation}<br>Target: 75+` },
        { id: 5, title: "Balanced Zoo Sponsor", desc: "Finish with all main stats at least 70.", success: "The sponsor admired your balanced management.", fail: "The sponsor felt some areas were neglected.", check: (s) => s.reputation >= 70 && s.visitorHappy >= 70 && s.animalHappy >= 70 && s.cleanliness >= 70, progress: (s) => (s.reputation >= 70 && s.visitorHappy >= 70 && s.animalHappy >= 70 && s.cleanliness >= 70) ? `Target reached! (All 70+)` : `Target: all main stats 70+` },
        { id: 6, title: "Profit Sponsor", desc: "Finish with at least £3500 cash.", success: "The sponsor approved of your profitable zoo.", fail: "The sponsor wanted a higher final balance.", check: (s) => s.cash >= 3500, progress: (s) => s.cash >= 3500 ? `Target reached! (£3500+)` : `Current cash: £${s.cash}<br>Target: £3500+` },
        { id: 7, title: "Animal Variety Sponsor", desc: "Finish with at least 4 visitor-accessible animal habitats.", success: "The sponsor loved the variety of animals.", fail: "The sponsor wanted more visitor-accessible animal habitats.", check: (s) => getConnectedEnclosures() >= 4, progress: (s) => getConnectedEnclosures() >= 4 ? `Target reached! (4+)` : `Accessible habitats: ${getConnectedEnclosures()}<br>Target: 4+` }
    ];

    function getConnectedEnclosures() {
        let count = 0;
        state.placedItems.forEach(item => {
            if (item.connected && ITEMS[item.itemKey].type === 'animal') count++;
        });
        return count;
    }

    function updateSponsorUI() {
        const detailsEl = document.getElementById('pz-sponsor-details');
        if (!detailsEl || !state.sponsorGoal) return;
        
        detailsEl.innerHTML = `
            <div class="pz-sponsor-title">${state.sponsorGoal.title}</div>
            <div class="pz-sponsor-desc">${state.sponsorGoal.desc}</div>
            <div class="pz-sponsor-progress">${state.sponsorGoal.progress(state)}</div>
        `;
    }

    function updateRecordsUI() {
        const list = document.getElementById('pz-best-records-list');
        if (!list) return;
        list.innerHTML = `
            <div><span>Best Final Cash:</span> <strong>${formatMoney(bestRecords.finalCash)}</strong></div>
            <div><span>Best Final Rep:</span> <strong>${bestRecords.finalReputation}</strong></div>
            <div><span>Best Rating:</span> <strong>${bestRecords.finalRating}</strong></div>
            <div><span>Most Visitors (Day):</span> <strong>${bestRecords.mostVisitors}</strong></div>
            <div><span>Highest Profit (Day):</span> <strong>${formatMoney(bestRecords.highestProfit)}</strong></div>
        `;
        
        const endingsProgress = document.getElementById('pz-side-endings-progress');
        if (endingsProgress) {
            endingsProgress.textContent = `Endings discovered: ${discoveredEndings.length} / ${TOTAL_ENDINGS}`;
        }
    }

    const EVENTS = [
        { 
            name: "School trip", 
            desc: "A huge school trip arrived for the day.", 
            warningText: "Expect more visitors and more litter.",
            prepareText: "Build bins before opening.",
            effect: (rep, s) => { 
                rep.visMod = 1.4; 
                if (s.bins >= 3) {
                    rep.cleanChange -= 5;
                    rep.outcomeText = "Your bins handled the school trip well, so the litter penalty was reduced.";
                } else {
                    rep.cleanChange -= 15;
                    rep.outcomeText = "You didn't have enough bins, so the school trip created a massive litter problem.";
                }
            } 
        },
        { 
            name: "Food hygiene inspection", 
            desc: "The local council inspector checked the food stalls.", 
            warningText: "Low cleanliness may cause a fine and reputation loss.",
            prepareText: "Keep cleanliness high and avoid too much litter.",
            effect: (rep, s) => { 
                if (s.cleanliness < 50) { 
                    rep.costChange += 100; 
                    rep.repChange -= 10;
                    rep.outcomeText = "Cleanliness was below 50, so you were fined £100 and lost reputation."; 
                } else if (s.cleanliness >= 70) {
                    rep.repChange += 5;
                    rep.outcomeText = "Your zoo was spotless! You passed the inspection and gained reputation.";
                } else {
                    rep.outcomeText = "Your cleanliness was acceptable. You passed the inspection.";
                }
            } 
        },
        { 
            name: "Heatwave", 
            desc: "Scorching weather hit the zoo today.", 
            warningText: "Food sales may rise, but animals need care.",
            prepareText: "Build keeper huts.",
            effect: (rep, s) => { 
                rep.foodMod = 1.3; 
                if (!s.goodKeeper) { 
                    rep.animalHappyChange -= 15; 
                    rep.outcomeText = "You had no keeper huts to provide shade, so the heatwave reduced animal happiness.";
                } else {
                    rep.outcomeText = "Your keeper huts protected the animals from the heat, and food stalls saw a boom in sales!";
                }
            } 
        },
        { 
            name: "Influencer visit", 
            desc: "A famous vlogger reviewed the zoo.", 
            warningText: "Visitor happiness matters.",
            prepareText: "Keep ticket prices fair and toilets available.",
            effect: (rep, s) => { 
                if (s.visitorHappy > 70) {
                    rep.repChange += 15; 
                    rep.outcomeText = "Visitor happiness was high, so the influencer gave you a glowing review and a reputation boost.";
                } else { 
                    rep.repChange -= 15; 
                    rep.outcomeText = "Visitor happiness was too low. The influencer's negative review damaged your reputation.";
                }
            } 
        },
        { 
            name: "Zoo inspection", 
            desc: "The national zoo board dropped by for an audit.", 
            warningText: "Cleanliness and animal happiness will be checked.",
            prepareText: "Build bins and keeper huts.",
            effect: (rep, s) => { 
                if (s.animalHappy < 50 || s.cleanliness < 50) { 
                    rep.repChange -= 15; 
                    rep.outcomeText = "Poor animal happiness or cleanliness caused a severe reputation drop.";
                } else if (s.animalHappy >= 70 && s.cleanliness >= 70) {
                    rep.repChange += 10;
                    rep.outcomeText = "Animal happiness and cleanliness were high, so the inspection improved your reputation.";
                } else {
                    rep.outcomeText = "The zoo passed the inspection with average marks.";
                }
            } 
        },
        { 
            name: "Breeding Season", 
            desc: "It's the time of year when animals may breed.", 
            warningText: "High animal happiness may result in a baby animal.",
            prepareText: "Keep animal happiness high and have active enclosures.",
            effect: (rep, s) => { 
                if (s.animalHappy >= 80 && s.hasEnclosures) { 
                    rep.repChange += 15; 
                    rep.visMod = 1.3;
                    rep.outcomeText = "Fantastic animal care resulted in a healthy baby! Visitors flocked to see it, boosting reputation."; 
                } else if (!s.hasEnclosures) {
                    rep.outcomeText = "You have no animals, so breeding season passed quietly.";
                } else {
                    rep.outcomeText = "Animal happiness was not high enough for any successful breeding.";
                }
            } 
        },
        { 
            name: "Rainy day", 
            desc: "Heavy rain kept some people at home.", 
            warningText: "Fewer visitors are likely.",
            prepareText: "Watch daily costs and avoid over-expanding.",
            effect: (rep, s) => { 
                rep.visMod = 0.7; 
                rep.outcomeText = "The rain significantly reduced ticket sales today.";
            } 
        },
        { 
            name: "Family discount day", 
            desc: "Local promotions brought in families.", 
            warningText: "More visitors are likely, but each visitor pays a discounted ticket price.",
            prepareText: "Make sure your zoo can handle bigger crowds.",
            effect: (rep, s) => { 
                rep.visMod = 1.3; 
                rep.ticketPriceMod = 0.7; 
                rep.outcomeText = "The promotion was a success! Many visitors arrived, though ticket income per person was lower.";
            } 
        }
    ];

    const DOM = {
        grid: document.getElementById('pz-grid'),
        buildFacilities: document.getElementById('pz-build-facilities'),
        buildAnimals: document.getElementById('pz-build-animals'),
        managerNotes: document.getElementById('pz-manager-notes'),
        btnRun: document.getElementById('pz-btn-run'),
        toastContainer: document.getElementById('pz-toast-container')
    };

    function init() {
        for (let x = 0; x < GRID_COLS; x++) {
            state.grid[x] = [];
            for (let y = 0; y < GRID_ROWS; y++) {
                state.grid[x][y] = null;
            }
        }
        
        state.grid[ENTRANCE_X][ENTRANCE_Y] = 'entrance';
        
        if (!state.nextEvent) {
            state.nextEvent = EVENTS[Math.floor(Math.random() * EVENTS.length)];
        }
        
        if (!state.sponsorGoal) {
            state.sponsorGoal = SPONSOR_GOALS[Math.floor(Math.random() * SPONSOR_GOALS.length)];
        }

        loadRecords();
        updateRecordsUI();
        updateChallengesUI();

        setupUI();
        renderGrid();
        updateStats();
    }

    function renderGrid() {
        DOM.grid.innerHTML = '';
        
        // Sanity check: Entrance is always at x=0, y=4
        if (state.grid[ENTRANCE_X][ENTRANCE_Y] !== 'entrance') {
            state.grid[ENTRANCE_X][ENTRANCE_Y] = 'entrance';
        }
        
        for (let y = 0; y < GRID_ROWS; y++) {
            for (let x = 0; x < GRID_COLS; x++) {
                const tile = document.createElement('div');
                tile.className = 'pz-tile';
                tile.dataset.x = x;
                tile.dataset.y = y;
                
                // Explicitly set grid position to prevent auto-flow shifting
                tile.style.gridColumn = `${x + 1}`;
                tile.style.gridRow = `${y + 1}`;
                
                if (x === ENTRANCE_X && y === ENTRANCE_Y) {
                    tile.classList.add('pz-entrance');
                    tile.textContent = 'ENTER';
                } else {
                    const cellVal = state.grid[x][y];
                    if (cellVal) {
                        const item = state.placedItems.find(i => i.id === cellVal);
                        if (item && item.itemKey === 'path') {
                            tile.classList.add('pz-path-tile');
                        }
                    }
                }
                
                tile.addEventListener('pointerenter', handleTileHover);
                tile.addEventListener('pointerleave', clearTileHover);
                tile.addEventListener('click', () => handleTileClick(x, y));
                
                DOM.grid.appendChild(tile);
            }
        }
        
        state.placedItems.forEach(item => {
            const def = ITEMS[item.itemKey];
            
            // Paths are rendered as base tile color, not overlay blocks
            if (def.type === 'facility' && item.itemKey === 'path') return;
            
            const div = document.createElement('div');
            div.className = `pz-placed-item pz-placed-${def.type}`;
            
            if (!item.connected && def.type !== 'tool') {
                div.classList.add('pz-unconnected');
                div.title = "No path to entrance!";
                
                const badge = document.createElement('div');
                badge.className = 'pz-unconnected-badge';
                badge.textContent = '⚠️';
                badge.title = "No path to entrance!";
                div.appendChild(badge);
            }
            
            div.style.gridColumn = `${item.x + 1} / span ${def.sizeW}`;
            div.style.gridRow = `${item.y + 1} / span ${def.sizeH}`;
            
            if (item.itemKey === 'pond') div.classList.add('pz-scenery-pond');
            
            if (def.type === 'animal') {
                const content = document.createElement('div');
                content.className = 'pz-animal-content';
                content.innerHTML = `<span>${def.emoji}</span><div class="pz-item-label">${def.name}</div>`;
                div.appendChild(content);
            } else {
                const content = document.createElement('div');
                content.className = 'pz-facility-content';
                content.textContent = def.emoji;
                div.appendChild(content);
            }
            
            DOM.grid.appendChild(div);
        });
    }

    function updateConnectivity() {
        state.placedItems.forEach(item => item.connected = false);
        
        let connectedPaths = Array(GRID_COLS).fill().map(() => Array(GRID_ROWS).fill(false));
        connectedPaths[ENTRANCE_X][ENTRANCE_Y] = true;
        
        let queue = [[ENTRANCE_X, ENTRANCE_Y]];
        
        while (queue.length > 0) {
            let [qx, qy] = queue.shift();
            
            const neighbors = [
                [qx+1, qy], [qx-1, qy], [qx, qy+1], [qx, qy-1]
            ];
            
            for (let [nx, ny] of neighbors) {
                if (nx >= 0 && nx < GRID_COLS && ny >= 0 && ny < GRID_ROWS) {
                    if (!connectedPaths[nx][ny]) {
                        const itemId = state.grid[nx][ny];
                        if (itemId && itemId !== 'entrance') {
                            const item = state.placedItems.find(i => i.id === itemId);
                            if (item && item.itemKey === 'path') {
                                connectedPaths[nx][ny] = true;
                                queue.push([nx, ny]);
                                item.connected = true;
                            }
                        }
                    }
                }
            }
        }
        
        state.placedItems.forEach(item => {
            if (item.itemKey === 'path') return; 
            
            const def = ITEMS[item.itemKey];
            let isConnected = false;
            
            for (let x = item.x; x < item.x + def.sizeW; x++) {
                for (let y = item.y; y < item.y + def.sizeH; y++) {
                    const neighbors = [
                        [x+1, y], [x-1, y], [x, y+1], [x, y-1]
                    ];
                    for (let [nx, ny] of neighbors) {
                        if (nx >= 0 && nx < GRID_COLS && ny >= 0 && ny < GRID_ROWS) {
                            if (connectedPaths[nx][ny]) {
                                isConnected = true;
                                break;
                            }
                        }
                    }
                    if (isConnected) break;
                }
                if (isConnected) break;
            }
            item.connected = isConnected;
        });
    }

    function handleTileClick(x, y) {
        if (!state.selectedItemKey) return;
        
        if (state.selectedItemKey === 'bulldoze') {
            const cellVal = state.grid[x][y];
            if (cellVal && cellVal !== 'entrance') {
                bulldozeItem(cellVal);
            }
            return;
        }
        
        const def = ITEMS[state.selectedItemKey];
        
        if (x + def.sizeW > GRID_COLS || y + def.sizeH > GRID_ROWS) {
            showToast("Not enough space here!");
            return;
        }
        
        if (state.cash < def.cost) {
            showToast("Not enough cash!");
            return;
        }
        
        for (let ix = x; ix < x + def.sizeW; ix++) {
            for (let iy = y; iy < y + def.sizeH; iy++) {
                if (state.grid[ix][iy] !== null) {
                    showToast("Space is already occupied!");
                    return;
                }
            }
        }
        
        state.cash -= def.cost;
        const newItem = {
            id: state.nextItemId++,
            itemKey: state.selectedItemKey,
            x: x,
            y: y,
            connected: false
        };
        
        state.placedItems.push(newItem);
        
        for (let ix = x; ix < x + def.sizeW; ix++) {
            for (let iy = y; iy < y + def.sizeH; iy++) {
                state.grid[ix][iy] = newItem.id;
            }
        }
        
        updateConnectivity();
        updateStats();
        renderGrid();
    }

    function handleTileHover(e) {
        if (e.pointerType === 'touch') return;
        if (!state.selectedItemKey) return;
        clearTileHover();
        
        const x = parseInt(e.target.dataset.x);
        const y = parseInt(e.target.dataset.y);
        
        if (state.selectedItemKey === 'bulldoze') {
            const cellVal = state.grid[x][y];
            if (cellVal && cellVal !== 'entrance') {
                const item = state.placedItems.find(i => i.id === cellVal);
                if (item) highlightArea(item.x, item.y, ITEMS[item.itemKey].sizeW, ITEMS[item.itemKey].sizeH, 'pz-hover-invalid');
            }
            return;
        }
        
        const def = ITEMS[state.selectedItemKey];
        
        let valid = true;
        if (x + def.sizeW > GRID_COLS || y + def.sizeH > GRID_ROWS) valid = false;
        
        if (valid) {
            for (let ix = x; ix < x + def.sizeW; ix++) {
                for (let iy = y; iy < y + def.sizeH; iy++) {
                    if (state.grid[ix][iy] !== null) {
                        valid = false;
                        break;
                    }
                }
                if (!valid) break;
            }
        }
        
        const cssClass = valid ? 'pz-hover-valid' : 'pz-hover-invalid';
        
        const maxW = Math.min(x + def.sizeW, GRID_COLS);
        const maxH = Math.min(y + def.sizeH, GRID_ROWS);
        for (let ix = x; ix < maxW; ix++) {
            for (let iy = y; iy < maxH; iy++) {
                const tile = document.querySelector(`.pz-tile[data-x="${ix}"][data-y="${iy}"]`);
                if (tile) tile.classList.add(cssClass);
            }
        }
    }
    
    function clearTileHover(e) {
        if (e && e.pointerType === 'touch') return;
        document.querySelectorAll('.pz-tile').forEach(t => {
            t.classList.remove('pz-hover-valid', 'pz-hover-invalid');
        });
    }
    
    function highlightArea(x, y, w, h, cssClass) {
        for (let ix = x; ix < x + w; ix++) {
            for (let iy = y; iy < y + h; iy++) {
                const tile = document.querySelector(`.pz-tile[data-x="${ix}"][data-y="${iy}"]`);
                if (tile) tile.classList.add(cssClass);
            }
        }
    }

    function bulldozeItem(id) {
        const itemIdx = state.placedItems.findIndex(i => i.id === id);
        if (itemIdx === -1) return;
        
        const item = state.placedItems[itemIdx];
        const def = ITEMS[item.itemKey];
        
        state.cash += Math.floor(def.cost * 0.5);
        
        for (let ix = item.x; ix < item.x + def.sizeW; ix++) {
            for (let iy = item.y; iy < item.y + def.sizeH; iy++) {
                state.grid[ix][iy] = null;
            }
        }
        
        state.placedItems.splice(itemIdx, 1);
        updateConnectivity();
        updateStats();
        renderGrid();
        clearTileHover();
    }

    function clamp(val, min, max) {
        return Math.min(Math.max(val, min), max);
    }

    function runDay() {
        updateConnectivity();
        
        let totalAppeal = 0;
        let unconnectedAppeal = 0;
        let foodStalls = 0;
        let bins = 0;
        let toilets = 0;
        let keeperHuts = 0;
        let dailyCosts = 0;
        let numEnclosures = 0;
        let treeCount = 0;
        let flowerCount = 0;
        let pondCount = 0;
        let picnicCount = 0;
        
        let s = {
            hasLion: false, hasParrot: false, hasPanda: false, hasMonkey: false, hasKeeper: false,
            hasElephant: false, hasOtter: false, hasEnclosures: false, bins: 0, hasRabbit: false,
            goodKeeper: false, cleanliness: state.cleanliness, animalHappy: state.animalHappy,
            visitorHappy: state.visitorHappy, connectedEnclosures: 0
        };
        
        state.placedItems.forEach(item => {
            const def = ITEMS[item.itemKey];
            dailyCosts += def.dailyCost;
            
            if (def.type === 'animal') {
                numEnclosures++;
                s.hasEnclosures = true;
                if (item.connected) {
                    totalAppeal += def.appeal;
                    s.connectedEnclosures++;
                } else {
                    unconnectedAppeal += def.appeal;
                }
                
                if (item.itemKey === 'lion') s.hasLion = true;
                if (item.itemKey === 'parrot') s.hasParrot = true;
                if (item.itemKey === 'panda') s.hasPanda = true;
                if (item.itemKey === 'monkey') s.hasMonkey = true;
                if (item.itemKey === 'elephant') s.hasElephant = true;
                if (item.itemKey === 'otter') s.hasOtter = true;
                if (item.itemKey === 'rabbit') s.hasRabbit = true;
            }
            else if (def.type === 'facility' && item.connected) {
                if (item.itemKey === 'food') foodStalls++;
                if (item.itemKey === 'bin') { bins++; s.bins++; }
                if (item.itemKey === 'toilet') toilets++;
                if (item.itemKey === 'keeper') {
                    keeperHuts++;
                    s.hasKeeper = true;
                }
            }
            else if (def.type === 'scenery' && item.connected) {
                if (item.itemKey === 'tree') treeCount++;
                if (item.itemKey === 'flowers') flowerCount++;
                if (item.itemKey === 'pond') pondCount++;
                if (item.itemKey === 'picnic') picnicCount++;
            }
        });
        
        s.goodKeeper = (keeperHuts * 3 >= numEnclosures);
        
        const evt = state.nextEvent;
        let rep = {
            visMod: 1.0, foodMod: 1.0, binMod: 1.0, appealMod: 1.0, ticketPriceMod: 1.0,
            repChange: 0, cleanChange: 0, animalHappyChange: 0, costChange: 0, outcomeText: ''
        };
        
        evt.effect(rep, s);
        
        let baseVis = 30;
        let appealBonus = (totalAppeal * rep.appealMod) * 0.5;
        let unconnectedPenalty = unconnectedAppeal * 0.2;
        let repBonus = (state.reputation - 50) * 0.5;
        
        let ticketTolerance = 5;
        if (totalAppeal > 50) ticketTolerance = 7;
        if (totalAppeal > 150) ticketTolerance = 10;
        
        let priceDiff = state.ticketPrice - ticketTolerance;
        let pricePenalty = 0;
        if (priceDiff > 0) pricePenalty = priceDiff * 10;
        
        let visitors = Math.max(0, Math.floor((baseVis + appealBonus + repBonus - pricePenalty - unconnectedPenalty) * rep.visMod));
        
        if (state.cleanliness < 40) visitors = Math.floor(visitors * 0.8);
        if (state.visitorHappy < 40) visitors = Math.floor(visitors * 0.8);
        
        let actualTicketPrice = state.ticketPrice * rep.ticketPriceMod;
        let ticketIncome = Math.floor(visitors * actualTicketPrice);
        
        let foodIncome = 0;
        if (foodStalls > 0) {
            let served = Math.min(visitors, foodStalls * 20);
            foodIncome = Math.floor(served * 8 * rep.foodMod);
        }

        if (totalAppeal === 0) {
            visitors = 0;
            ticketIncome = 0;
            foodIncome = 0;
            rep.cleanChange = 0;
            rep.animalHappyChange = 0;
            rep.repChange = 0;
            rep.costChange = 0;
            rep.outcomeText = "Without any active animal enclosures, the event barely mattered. Visitors had nothing to see.";
        }
        
        let actualCosts = dailyCosts + rep.costChange;
        let profit = ticketIncome + foodIncome - actualCosts;
        
        state.cash += profit;
        state.lastProfit = profit;
        
        let litterGen = Math.floor(visitors / 10) + (foodStalls * 5) + (s.hasMonkey ? 10 : 0);
        let picnicLitter = Math.min(picnicCount * 4, 8);
        litterGen += picnicLitter;
        let binPower = Math.floor(bins * 15 * rep.binMod);
        let netLitter = litterGen - binPower;
        let dClean = -Math.floor(netLitter / 2) + rep.cleanChange;
        
        let dAnimal = -5;
        if (keeperHuts > 0) dAnimal += 5;
        if (s.goodKeeper) dAnimal += 10;
        if (unconnectedAppeal > 0) dAnimal -= 10;
        dAnimal += rep.animalHappyChange;
        
        let pondBonusAnim = Math.min(pondCount * 3, 6);
        dAnimal += pondBonusAnim;
        
        if (!s.hasEnclosures) {
            dAnimal = 0;
        }
        
        let dVis = 0;
        if (totalAppeal === 0) dVis -= 15;
        if (visitors > toilets * TOILET_CAPACITY) dVis -= 10;
        if (state.cleanliness < 50) dVis -= 15;
        if (priceDiff > 0) dVis -= 5 * priceDiff;
        if (totalAppeal > 100) dVis += 10;
        if (state.animalHappy < 40) dVis -= 10;
        if (s.hasOtter) dVis += 5;
        
        let treeBonusVis = Math.min(treeCount * 1, 5);
        let pondBonusVis = Math.min(pondCount * 3, 6);
        let picnicBonusVis = Math.min(picnicCount * 4, 8);
        dVis += treeBonusVis + pondBonusVis + picnicBonusVis;
        
        let parrotRepBonus = 0;
        if (s.hasParrot) { dVis += 2; parrotRepBonus = 2; }
        
        let oldClean = state.cleanliness;
        let oldAnimal = state.animalHappy;
        let oldVis = state.visitorHappy;
        let oldRep = state.reputation;
        
        state.cleanliness = clamp(state.cleanliness + dClean, 0, 100);
        state.animalHappy = clamp(state.animalHappy + dAnimal, 0, 100);
        state.visitorHappy = clamp(state.visitorHappy + dVis, 0, 100);
        
        let dRep = parrotRepBonus;
        let flowerBonusRep = Math.min(flowerCount * 1, 3);
        dRep += flowerBonusRep;
        
        if (totalAppeal === 0) {
            dRep -= 5;
            if (state.ticketPrice > 0) dRep -= 5;
        }
        if (state.visitorHappy > 75 && state.animalHappy > 75) dRep += 5;
        if (state.cleanliness < 40 || state.visitorHappy < 40) dRep -= 5;
        if (profit < 0) dRep -= 2;
        dRep += rep.repChange;
        
        state.reputation = clamp(state.reputation + dRep, 0, 100);
        
        if (visitors === 0 && totalAppeal > 0) {
            rep.outcomeText = "The event happened, but with no visitors today, it had little visible impact.";
        }

        // Build narrative
        let animalMsg = "";
        let issueMsg = "";

        if (totalAppeal === 0) {
            if (visitors > 0) {
                animalMsg = "Unfortunately, there were no active animal enclosures, so most visitors left confused.";
                issueMsg = " People do not generally pay to visit a path network.";
            } else {
                animalMsg = "The zoo was technically open, but there were no animals to see.";
                issueMsg = " Unsurprisingly, nobody showed up.";
            }
        } else if (visitors === 0) {
            animalMsg = "Nobody came through the gates today.";
            if (priceDiff > 0) {
                issueMsg = " The high ticket price clearly put people off.";
            } else {
                issueMsg = " Even the ticket booth looked embarrassed.";
            }
        } else {
            let hasConnectedLion = false, hasConnectedPanda = false, hasConnectedElephant = false;
            let hasConnectedParrot = false, hasConnectedRabbit = false;
            
            state.placedItems.forEach(item => {
                if (item.connected && ITEMS[item.itemKey].type === 'animal') {
                    if (item.itemKey === 'lion') hasConnectedLion = true;
                    if (item.itemKey === 'panda') hasConnectedPanda = true;
                    if (item.itemKey === 'elephant') hasConnectedElephant = true;
                    if (item.itemKey === 'parrot') hasConnectedParrot = true;
                    if (item.itemKey === 'rabbit') hasConnectedRabbit = true;
                }
            });

            if (hasConnectedLion || hasConnectedPanda || hasConnectedElephant) {
                animalMsg = "Your large animals drew in the crowds today.";
            } else if (hasConnectedParrot || hasConnectedRabbit) {
                animalMsg = "The smaller animals entertained the families.";
            } else {
                animalMsg = "Visitors enjoyed the wildlife.";
            }
            
            if (unconnectedAppeal > 0) {
                issueMsg = " However, some enclosures were completely inaccessible!";
            } else if (visitors > toilets * TOILET_CAPACITY) {
                if (toilets === 0) {
                    issueMsg = " Visitors complained that there were no toilets connected to paths.";
                } else {
                    issueMsg = " Visitors complained that the toilets connected to paths were overwhelmed.";
                }
            } else if (state.cleanliness < 40) {
                issueMsg = " Sadly, the litter is getting out of hand.";
            } else if (priceDiff > 0) {
                issueMsg = " Some people grumbled about the expensive ticket prices.";
            } else if (profit < 0) {
                issueMsg = " Despite this, the zoo ran at a financial loss.";
            } else {
                if (profit >= 0 && state.visitorHappy >= 50 && dRep >= 0) {
                    issueMsg = " Overall, a successful day.";
                } else {
                    issueMsg = " The zoo survived another day.";
                }
            }
        }

        const zooNameText = state.zooName.trim() || "Zoo Mogul";
        let narrative = `Day ${state.day} brought ${visitors} visitors to ${zooNameText}. ${animalMsg}${issueMsg}`;

        let newMilestones = [];
        if (!state.milestones.profit && profit > 0) { state.milestones.profit = true; newMilestones.push("First profitable day!"); }
        if (!state.milestones.vis100 && visitors >= 100) { state.milestones.vis100 = true; newMilestones.push("Reached 100 visitors in a day!"); }
        if (!state.milestones.rep70 && state.reputation >= 70) { state.milestones.rep70 = true; newMilestones.push("Reputation reached 70!"); }
        if (!state.milestones.happy90 && state.animalHappy >= 90) { state.milestones.happy90 = true; newMilestones.push("Animal happiness reached 90!"); }
        if (!state.milestones.conn3 && s.connectedEnclosures >= 3) { state.milestones.conn3 = true; newMilestones.push("Three accessible animal habitats!"); }
        if (!state.milestones.all70 && state.reputation >= 70 && state.visitorHappy >= 70 && state.animalHappy >= 70 && state.cleanliness >= 70) {
            state.milestones.all70 = true; newMilestones.push("All major stats above 70!");
        }

        let advice = "";
        if (unconnectedAppeal > 0) advice = "Biggest Problem: You have animal habitats wasting appeal. Make them visitor-accessible with paths!";
        else if (totalAppeal === 0) advice = "Biggest Problem: Your zoo has no visitor-accessible animals. Build habitats and paths!";
        else if (profit < 0) advice = "Manager Advice: We lost money today! Try a different ticket price or check your daily costs.";
        else if (visitors === 0) advice = "Manager Advice: Zero visitors means zero income. Build paths from the entrance to your attractions.";
        else if (state.animalHappy <= 50) advice = "Manager Advice: Animal happiness is low. Build keeper huts or make habitats accessible.";
        else if (visitors > toilets * TOILET_CAPACITY) advice = "Manager Advice: Build more toilets connected to paths, or reduce overcrowding.";
        else advice = "Manager Advice: The zoo is running smoothly. Keep expanding carefully!";

        state.report = {
            visitors, ticketIncome, foodIncome, costs: actualCosts, profit,
            dVis: state.visitorHappy - oldVis,
            dAnimal: state.animalHappy - oldAnimal,
            dClean: state.cleanliness - oldClean,
            dRep: state.reputation - oldRep,
            eventTitle: evt.name,
            eventDesc: evt.desc,
            outcomeText: rep.outcomeText,
            advice: advice,
            narrative: narrative,
            milestones: newMilestones
        };
        
        state.nextEvent = EVENTS[Math.floor(Math.random() * EVENTS.length)];
        
        if (visitors > bestRecords.mostVisitors) {
            bestRecords.mostVisitors = visitors;
            if (!state.newRecordsThisRun.includes("Most visitors in a single day")) state.newRecordsThisRun.push("Most visitors in a single day");
            saveRecords();
            updateRecordsUI();
        }
        if (visitors > state.sponsorMostVisitors) {
            state.sponsorMostVisitors = visitors;
        }
        if (profit > bestRecords.highestProfit) {
            bestRecords.highestProfit = profit;
            if (!state.newRecordsThisRun.includes("Highest single-day profit")) state.newRecordsThisRun.push("Highest single-day profit");
            saveRecords();
            updateRecordsUI();
        }

        updateChallengesUI();
        
        showDailyReport();
    }

    function formatMoney(val) {
        return (val < 0 ? '-£' : '£') + Math.abs(val);
    }
    
    function formatChange(val) {
        return (val > 0 ? '+' : '') + val;
    }

    function updateManagerNotes() {
        let connectedAnimals = 0;
        let unconnectedAnimals = 0;
        let unconnectedFacilities = 0;
        let connectedScenery = 0;
        let totalAppeal = 0;
        let dailyCosts = 0;
        let hasKeeper = false;
        
        state.placedItems.forEach(item => {
            const def = ITEMS[item.itemKey];
            dailyCosts += def.dailyCost;
            
            if (def.type === 'animal') {
                if (item.connected) {
                    connectedAnimals++;
                    totalAppeal += def.appeal;
                } else {
                    unconnectedAnimals++;
                }
            } else if (def.type === 'facility') {
                if (!item.connected && item.itemKey !== 'path') {
                    unconnectedFacilities++;
                }
                if (item.itemKey === 'keeper' && item.connected) {
                    hasKeeper = true;
                }
            } else if (def.type === 'scenery') {
                if (item.connected) {
                    connectedScenery++;
                }
            }
        });

        let ticketTolerance = 5;
        if (totalAppeal > 50) ticketTolerance = 7;
        if (totalAppeal > 150) ticketTolerance = 10;
        
        let priceJudgment = "Reasonable";
        if (state.ticketPrice > ticketTolerance) priceJudgment = "<span class='pz-manager-warn'>Ambitious</span>";
        else if (state.ticketPrice < ticketTolerance) priceJudgment = "<span class='pz-manager-good'>Great Value</span>";

        let html = `
            <p><strong>Daily Costs:</strong> £${dailyCosts}</p>
            <p><strong>Connected Appeal:</strong> ${totalAppeal}</p>
            <p><strong>Ticket Value:</strong> ${priceJudgment}</p>
            <hr class="pz-manager-divider">
            <ul>
        `;

        if (connectedAnimals === 0) {
            html += `<li><span class="pz-manager-warn">Your zoo has no visitor-accessible animals yet.</span></li>`;
        }
        
        if (unconnectedAnimals > 0) {
            html += `<li><span class="pz-manager-warn">${unconnectedAnimals} animal habitat${unconnectedAnimals > 1 ? 's are' : ' is'} not accessible from the entrance.</span></li>`;
        }
        
        if (unconnectedFacilities > 0) {
            html += `<li><span class="pz-manager-warn">${unconnectedFacilities} facilit${unconnectedFacilities > 1 ? 'ies are' : 'y is'} not accessible from the entrance.</span></li>`;
        }
        
        if ((unconnectedAnimals > 0 || unconnectedFacilities > 0) && connectedAnimals === 0) {
            html += `<li><span class="pz-manager-warn">Build paths from the entrance to your habitats.</span></li>`;
        }
        
        if (connectedAnimals > 0 && !hasKeeper) {
            html += `<li><span class="pz-manager-warn">You have animals but no keeper hut.</span></li>`;
        }
        
        if (dailyCosts > 100 && totalAppeal < 50) {
            html += `<li>The zoo is getting expensive to run.</li>`;
        }
        
        if (totalAppeal > 0 && unconnectedAnimals === 0 && unconnectedFacilities === 0) {
            html += `<li><span class="pz-manager-good">Zoo is ready to open!</span></li>`;
        }
        
        if (connectedScenery > 0) {
            html += `<li><span class="pz-manager-good">Scenery is improving the zoo atmosphere.</span></li>`;
        }

        html += `</ul>`;
        DOM.managerNotes.innerHTML = html;
    }

    function updateStats() {
        document.getElementById('pz-stat-day').textContent = `Day ${state.day}/${MAX_DAYS}`;
        document.getElementById('pz-stat-cash').textContent = `Cash ${formatMoney(state.cash)}`;
        document.getElementById('pz-stat-ticket').textContent = `Ticket £${state.ticketPrice}`;
        document.getElementById('pz-stat-reputation').textContent = `Rep ${state.reputation}`;
        document.getElementById('pz-stat-v-happy').textContent = `Visitor 😊 ${state.visitorHappy}`;
        document.getElementById('pz-stat-a-happy').textContent = `Animal 😊 ${state.animalHappy}`;
        document.getElementById('pz-stat-clean').textContent = `Clean ${state.cleanliness}`;
        document.getElementById('pz-stat-profit').textContent = `Profit ${state.lastProfit === 0 ? '-' : formatMoney(state.lastProfit)}`;
        
        document.querySelectorAll('.pz-build-item').forEach(btn => {
            const itemKey = btn.dataset.key;
            if (itemKey === 'bulldoze') return;
            const def = ITEMS[itemKey];
            if (state.cash < def.cost) {
                btn.disabled = true;
            } else {
                btn.disabled = false;
            }
        });

        updateManagerNotes();
        updateEventUI();
        updateSponsorUI();
    }

    function generateDailyHeadline(r, zooNameText) {
        if (r.visitors === 0) {
            return Math.random() > 0.5 ? "Nobody Visits Zoo, Entrance Gate Takes It Personally" : "Local Zoo Opens Doors to Complete Silence";
        }
        
        if (r.eventTitle === "School trip") return Math.random() > 0.5 ? "School Trip Brings Chaos, Sandwiches and Litter" : `Students Descend on ${zooNameText} Like Excited Penguins`;
        if (r.eventTitle === "Food hygiene inspection") return Math.random() > 0.5 ? "Inspector Visits Food Stalls With Clipboard of Doom" : `Cleanliness Under Spotlight at ${zooNameText}`;
        if (r.eventTitle === "Heatwave") return Math.random() > 0.5 ? "Heatwave Sends Snack Sales and Animal Complaints Rising" : `${zooNameText} Sweats Through Scorching Day`;
        if (r.eventTitle === "Influencer visit") return Math.random() > 0.5 ? "Influencer Review Sends Zoo Reputation Wobbling" : `${zooNameText} Faces the Camera`;
        if (r.eventTitle === "Zoo inspection") return Math.random() > 0.5 ? "Zoo Board Arrives, Clipboard Energy Intensifies" : `Inspection Day Tests ${zooNameText} Nerves`;
        if (r.eventTitle === "Breeding Season") return Math.random() > 0.5 ? "Breeding Season Brings Hope, Nerves and Extra Hay" : "Animal Happiness Becomes Talk of the Zoo";
        if (r.eventTitle === "Rainy day") return Math.random() > 0.5 ? "Rain Keeps Visitors Home and Ducks Suspiciously Cheerful" : `Wet Weather Dampens ${zooNameText} Footfall`;
        if (r.eventTitle === "Family discount day") return Math.random() > 0.5 ? "Families Flood In for Discount Day" : "Discount Day Brings Crowds and Sticky Fingers";
        
        if (r.milestones && r.milestones.length > 0) return Math.random() > 0.5 ? `${zooNameText} Celebrates New Management Milestone` : "Zoo Team Claims Tiny Victory, Possibly Eats Cake";
        
        if (r.profit > 300) return Math.random() > 0.5 ? `${zooNameText} Enjoys Roaring Day at the Gates` : `Crowds Bring Cash Boost to ${zooNameText}`;
        if (r.profit < 0) return Math.random() > 0.5 ? "Zoo Accountants Seen Weeping Near Gift Shop" : "Popular Animals Fail to Save Daily Balance Sheet";
        
        if (state.cleanliness < 40 || r.dClean < -10) return Math.random() > 0.5 ? "Litter Crisis Leaves Keepers Reaching for Brooms" : "School Trip Blamed for Great Crisp Packet Incident";
        if (r.dVis < -5) return Math.random() > 0.5 ? "Visitors Grumble as Zoo Management Takes Notes" : `Toilet Queue Rumours Spread Across ${zooNameText}`;
        if (r.dAnimal < -5) return Math.random() > 0.5 ? "Animals Demand Better Working Conditions" : "Keeper Huts Suddenly Look Like a Good Idea";
        
        return Math.random() > 0.5 ? `${zooNameText} Survives Another Day` : "Managers Call Day Mostly Under Control";
    }

    function showDailyReport() {
        updateStats();
        const r = state.report;
        
        const zooNameText = state.zooName.trim() || "Zoo Mogul";
        document.getElementById('pz-report-headline').textContent = generateDailyHeadline(r, zooNameText);
        document.getElementById('pz-report-narrative').textContent = r.narrative;

        const grid = document.getElementById('pz-report-stats');
        grid.innerHTML = `
            <div><span>Visitors</span> <span>${r.visitors}</span></div>
            <div><span>Ticket Income</span> <span class="pz-pos">${formatMoney(r.ticketIncome)}</span></div>
            <div><span>Food Income</span> <span class="pz-pos">${formatMoney(r.foodIncome)}</span></div>
            <div><span>Running Costs</span> <span class="pz-neg">${formatMoney(r.costs)}</span></div>
            <div><span>Profit / Loss</span> <span class="${r.profit >= 0 ? 'pz-pos' : 'pz-neg'}">${formatMoney(r.profit)}</span></div>
            <div><span>Reputation Change</span> <span class="${r.dRep >= 0 ? 'pz-pos' : 'pz-neg'}">${formatChange(r.dRep)}</span></div>
            <div><span>Visitor Happy Change</span> <span class="${r.dVis >= 0 ? 'pz-pos' : 'pz-neg'}">${formatChange(r.dVis)}</span></div>
            <div><span>Animal Happy Change</span> <span class="${r.dAnimal >= 0 ? 'pz-pos' : 'pz-neg'}">${formatChange(r.dAnimal)}</span></div>
            <div><span>Cleanliness Change</span> <span class="${r.dClean >= 0 ? 'pz-pos' : 'pz-neg'}">${formatChange(r.dClean)}</span></div>
        `;
        
        document.getElementById('pz-report-event').innerHTML = `<strong>Event: ${r.eventTitle}</strong><br>${r.eventDesc}<br><br><span class="pz-event-outcome-label">Outcome:</span> ${r.outcomeText || 'Nothing specific happened.'}`;
        
        let adviceParts = r.advice.split(': ');
        let adviceHtml = `<strong>${adviceParts[0]}</strong><br>${adviceParts[1] || adviceParts[0]}`;
        if (r.milestones && r.milestones.length > 0) {
            adviceHtml += `<div class="pz-milestone-box"><strong>🏆 Milestones Achieved:</strong><ul>${r.milestones.map(m => `<li>${m}</li>`).join('')}</ul></div>`;
        }
        document.getElementById('pz-report-advice').innerHTML = adviceHtml;
        
        if (r.profit < 0 || r.visitors === 0 || r.dVis < -5 || r.dAnimal < -5) {
            playSound('warning');
        } else if ((r.profit > 0 && r.dVis >= 0 && r.dAnimal >= 0) || (r.milestones && r.milestones.length > 0)) {
            playSound('success');
        } else {
            playSound('click');
        }
        
        document.getElementById('pz-daily-report').classList.remove('hidden');
        document.getElementById('pz-modal-overlay').classList.remove('hidden');
    }

    function showFinalReport() {
        updateStats();
        
        let zooNameText = state.zooName.trim();
        if (!zooNameText) zooNameText = "Zoo Mogul";
        
        document.getElementById('pz-final-zoo-name').textContent = zooNameText;
        document.getElementById('pz-final-report-title').textContent = `${MAX_DAYS}-Day Challenge Complete!`;
        
        let totalProfit = state.cash - STARTING_CASH;
        let rating = "The Monkeys Now Own The Business";
        
        if (state.cash < 0) {
            rating = "Financially Troubled Duck Collection";
        } else if (state.reputation > 80 && state.visitorHappy > 80 && state.animalHappy > 80 && state.cash > 5000) {
            rating = "World-Class Wildlife Empire";
        } else if (state.cash > 4000) {
            rating = "Profitable Pocket Paradise";
        } else if (state.reputation > 60 && state.cash > STARTING_CASH) {
            rating = "Respectable Regional Zoo";
        } else if (state.reputation > 50) {
            rating = "Chaotic But Popular";
        } else {
            rating = "Questionable Petting Farm";
        }
        
        if (state.cash < 0 && state.reputation < 30) {
            rating = "The Monkeys Now Own The Business";
        }
        
        let isNewEnding = false;
        if (!discoveredEndings.includes(rating)) {
            discoveredEndings.push(rating);
            saveEndings();
            isNewEnding = true;
        }
        
        const ratingEl = document.getElementById('pz-final-rating');
        ratingEl.textContent = rating;
        if (isNewEnding) {
            const badge = document.createElement('span');
            badge.className = 'pz-new-ending-badge';
            badge.textContent = '(New!)';
            ratingEl.appendChild(badge);
        }
        
        document.getElementById('pz-final-endings').textContent = `Endings discovered: ${discoveredEndings.length} / ${TOTAL_ENDINGS}`;
        
        let statsList = [
            { name: "Cleanliness", val: state.cleanliness },
            { name: "Animal Happiness", val: state.animalHappy },
            { name: "Visitor Happiness", val: state.visitorHappy },
            { name: "Reputation", val: state.reputation }
        ];
        statsList.sort((a, b) => b.val - a.val);
        
        let strongestArea = statsList[0].name;
        let weakestArea = statsList[3].name;
        
        let replayTip = "";
        if (weakestArea === "Cleanliness") replayTip = "Add bins earlier before building high-litter attractions like Food Stalls or Monkeys.";
        else if (weakestArea === "Animal Happiness") replayTip = "Build keeper huts sooner to protect animal happiness during heatwaves and as you expand.";
        else if (weakestArea === "Visitor Happiness") replayTip = "Try lowering ticket prices or adding more toilets if visitor happiness drops.";
        else if (weakestArea === "Reputation") replayTip = "Keep both cleanliness and animal happiness high to survive zoo inspections.";
        
        if (state.cash < 0) {
            weakestArea = "Finances (Bankrupt)";
            replayTip = "Watch your daily costs! Don't build too fast without checking your ticket income.";
        }

        const grid = document.getElementById('pz-final-stats');
        grid.innerHTML = `
            <div><span>Final Cash</span> <span>${formatMoney(state.cash)}</span></div>
            <div><span>Total Profit</span> <span>${formatMoney(totalProfit)}</span></div>
            <div><span>Final Reputation</span> <span>${state.reputation}</span></div>
            <div><span>Visitor Happiness</span> <span>${state.visitorHappy}</span></div>
            <div><span>Animal Happiness</span> <span>${state.animalHappy}</span></div>
            <div><span>Cleanliness</span> <span>${state.cleanliness}</span></div>
        `;
        
        const diag = document.getElementById('pz-final-diagnostics');
        diag.innerHTML = `
            <div class="pz-final-diagnostic-row">
                <span class="pz-final-diagnostic-label">Strongest Area:</span>
                <span class="pz-final-diagnostic-value">${strongestArea}</span>
            </div>
            <div class="pz-final-diagnostic-row">
                <span class="pz-final-diagnostic-label">Weakest Area:</span>
                <span class="pz-final-weakness-value">${weakestArea}</span>
            </div>
            <div class="pz-final-tip-container">
                <div class="pz-final-tip-label">Replay Tip:</div>
                <div class="pz-final-tip-text">${replayTip}</div>
            </div>
        `;
        
        const sponsorBox = document.getElementById('pz-final-sponsor');
        if (state.sponsorGoal) {
            const isSuccess = state.sponsorGoal.check(state);
            const cssClass = isSuccess ? 'pz-sponsor-success' : 'pz-sponsor-fail';
            const titleText = isSuccess ? 'Sponsor Goal Complete!' : 'Sponsor Goal Missed';
            const resultText = isSuccess ? state.sponsorGoal.success : state.sponsorGoal.fail;
            
            sponsorBox.innerHTML = `
                <div class="pz-sponsor-result-title">${titleText}</div>
                <div>${resultText}</div>
            `;
            sponsorBox.className = `pz-final-sponsor ${cssClass}`;
        } else {
            sponsorBox.className = 'pz-final-sponsor hidden';
        }
        
        let newRecords = [];
        if (state.cash > bestRecords.finalCash) {
            bestRecords.finalCash = state.cash;
            newRecords.push("Highest final cash");
        }
        if (state.reputation > bestRecords.finalReputation) {
            bestRecords.finalReputation = state.reputation;
            newRecords.push("Highest final reputation");
        }
        
        const RATING_TIERS = {
            "The Monkeys Now Own The Business": 1,
            "Financially Troubled Duck Collection": 2,
            "Questionable Petting Farm": 3,
            "Chaotic But Popular": 4,
            "Respectable Regional Zoo": 5,
            "Profitable Pocket Paradise": 6,
            "World-Class Wildlife Empire": 7
        };
        const currentTier = RATING_TIERS[rating] || 0;
        const bestTier = RATING_TIERS[bestRecords.finalRating] || 0;
        if (currentTier > bestTier) {
            bestRecords.finalRating = rating;
            newRecords.push("Best final rating");
        }
        
        if (newRecords.length > 0) {
            saveRecords();
            updateRecordsUI();
        }

        const allNew = [...new Set([...newRecords, ...state.newRecordsThisRun])];
        const recordsMsg = document.getElementById('pz-final-records-msg');
        if (allNew.length > 0) {
            recordsMsg.innerHTML = `🏆 New Records Achieved:<br><ul>${allNew.map(r => `<li>${r}</li>`).join('')}</ul>`;
            recordsMsg.classList.remove('hidden');
        } else {
            recordsMsg.classList.add('hidden');
        }
        
        if (state.cash < 0 || rating === "The Monkeys Now Own The Business" || rating === "Financially Troubled Duck Collection") {
            playSound('warning');
        } else if (isNewEnding || allNew.length > 0 || (state.sponsorGoal && state.sponsorGoal.check(state))) {
            playSound('success');
        } else {
            playSound('click');
        }
        
        document.getElementById('pz-final-report').classList.remove('hidden');
        document.getElementById('pz-modal-overlay').classList.remove('hidden');
    }

    function showToast(msg) {
        const t = document.createElement('div');
        t.className = 'pz-toast';
        t.textContent = msg;
        DOM.toastContainer.appendChild(t);
        
        setTimeout(() => {
            t.classList.add('pz-toast-fade-out');
            setTimeout(() => {
                t.remove();
            }, 300);
        }, 2500);
    }

    function setupUI() {
        const btnSoundToggle = document.getElementById('pz-btn-sound-toggle');
        if (btnSoundToggle) {
            function updateSoundBtn() {
                if (soundEnabled) {
                    btnSoundToggle.textContent = 'Sound: On';
                    btnSoundToggle.classList.add('pz-sound-on');
                } else {
                    btnSoundToggle.textContent = 'Sound: Off';
                    btnSoundToggle.classList.remove('pz-sound-on');
                }
            }
            updateSoundBtn();
            
            btnSoundToggle.addEventListener('click', () => {
                soundEnabled = !soundEnabled;
                try {
                    localStorage.setItem('zooMogulSoundEnabled', soundEnabled.toString());
                } catch(e) {}
                updateSoundBtn();
                
                if (soundEnabled) {
                    initAudio();
                    playSound('click');
                    showToast("Sound on");
                } else {
                    showToast("Sound off");
                }
            });
        }
        
        Object.keys(ITEMS).forEach(key => {
            const def = ITEMS[key];
            const btn = document.createElement('button');
            btn.className = 'pz-build-item';
            if (key === 'bulldoze') btn.classList.add('pz-bulldoze');
            btn.dataset.key = key;
            
            let html = `<div class="pz-item-header"><span class="pz-item-name">${def.emoji} ${def.name}</span>`;
            if (def.cost > 0) html += `<span class="pz-item-cost">£${def.cost}</span>`;
            html += `</div>`;
            
            let detailsHtml = `<div class="pz-item-details">
                ${def.desc}<br>
                Size: ${def.sizeW}×${def.sizeH} | ${def.dailyCost > 0 ? 'Daily cost: £' + def.dailyCost : 'No daily cost'}
                ${def.appeal ? '| Appeal: ' + def.appeal : ''}
            </div>`;
            
            btn.innerHTML = html + detailsHtml;
            
            btn.addEventListener('click', () => {
                document.querySelectorAll('.pz-build-item').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                state.selectedItemKey = key;
            });
            
            if (def.type === 'animal') {
                DOM.buildAnimals.appendChild(btn);
            } else if (def.type === 'scenery') {
                document.getElementById('pz-build-scenery').appendChild(btn);
            } else {
                DOM.buildFacilities.appendChild(btn);
            }
        });
        
        document.querySelectorAll('.pz-btn-ticket').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.pz-btn-ticket').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.ticketPrice = parseInt(btn.dataset.price);
                updateStats();
            });
        });
        
        const zooNameInput = document.getElementById('pz-zoo-name-input');
        if (zooNameInput) {
            zooNameInput.addEventListener('input', (e) => {
                state.zooName = e.target.value;
            });
        }
        
        const btnCopy = document.getElementById('pz-btn-copy-summary');
        if (btnCopy) {
            btnCopy.addEventListener('click', () => {
                if (soundEnabled) initAudio();
                
                let zooNameText = state.zooName.trim() || "Zoo Mogul";
                let spGoal = state.sponsorGoal ? (state.sponsorGoal.check(state) ? "Complete" : "Failed") : "None";
                let ratingText = document.getElementById('pz-final-rating').textContent.replace('(New!)', '').trim();
                
                let summary = `🦁 I just ran ${zooNameText} for ${MAX_DAYS} days in Zoo Mogul!\n\n` +
                              `Final rating: ${ratingText}\n` +
                              `Final cash: £${state.cash}\n` +
                              `Reputation: ${state.reputation}\n` +
                              `Sponsor goal: ${spGoal}\n` +
                              `Endings discovered: ${discoveredEndings.length} / ${TOTAL_ENDINGS}\n\n` +
                              `Can you build a better zoo?\n` +
                              `Play Zoo Mogul on ESHEETS:\n` +
                              `https://www.esheets.io/zoo-mogul/`;
                
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(summary).then(() => {
                        playSound('click');
                        showToast("Brag copied to clipboard!");
                    }).catch(() => {
                        playSound('error');
                        showToast("Could not copy share text.");
                    });
                } else {
                    playSound('error');
                    showToast("Could not copy share text.");
                }
            });
        }
        
        DOM.btnRun.addEventListener('click', () => {
            if (soundEnabled) initAudio();
            
            if (state.day > MAX_DAYS) return;
            
            if (!state.zooName.trim()) {
                playSound('error');
                showToast("Name your zoo before opening day!");
                const zInput = document.getElementById('pz-zoo-name-input');
                if (zInput) {
                    zInput.focus();
                    zInput.classList.add('pz-input-error');
                    setTimeout(() => zInput.classList.remove('pz-input-error'), 1500);
                }
                return;
            }
            
            runDay();
        });
        
        document.getElementById('pz-btn-next-day').addEventListener('click', () => {
            document.getElementById('pz-modal-overlay').classList.add('hidden');
            document.getElementById('pz-daily-report').classList.add('hidden');
            
            state.day++;
            if (state.day > MAX_DAYS) {
                showFinalReport();
            } else {
                updateStats();
            }
        });
        
        document.getElementById('pz-btn-restart').addEventListener('click', () => {
            document.getElementById('pz-modal-overlay').classList.add('hidden');
            document.getElementById('pz-final-report').classList.add('hidden');
            
            state.zooName = "";
            const zInput = document.getElementById('pz-zoo-name-input');
            if (zInput) zInput.value = "";
            
            state.cash = STARTING_CASH;
            state.day = 1;
            state.reputation = 50;
            state.visitorHappy = 60;
            state.animalHappy = 70;
            state.cleanliness = 70;
            state.ticketPrice = 5;
            state.lastProfit = 0;
            state.placedItems = [];
            state.nextItemId = 1;
            
            state.nextEvent = EVENTS[Math.floor(Math.random() * EVENTS.length)];
            state.milestones = { profit: false, vis100: false, rep70: false, happy90: false, conn3: false, all70: false };
            
            document.querySelectorAll('.pz-btn-ticket').forEach(b => b.classList.remove('active'));
            document.querySelector('.pz-btn-ticket[data-price="5"]').classList.add('active');
            
            for (let x = 0; x < GRID_COLS; x++) {
                for (let y = 0; y < GRID_ROWS; y++) {
                    state.grid[x][y] = null;
                }
            }
            state.grid[ENTRANCE_X][ENTRANCE_Y] = 'entrance';
            
            state.newRecordsThisRun = [];
            state.sponsorMostVisitors = 0;
            state.sponsorGoal = SPONSOR_GOALS[Math.floor(Math.random() * SPONSOR_GOALS.length)];
            
            updateChallengesUI();
            
            updateStats();
            renderGrid();
        });

        const btnReset = document.getElementById('pz-btn-reset-records');
        const confirmBox = document.getElementById('pz-reset-records-confirm');
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                confirmBox.classList.remove('hidden');
                btnReset.style.display = 'none';
            });
        }
        const btnConfirmYes = document.getElementById('pz-btn-confirm-yes');
        if (btnConfirmYes) {
            btnConfirmYes.addEventListener('click', () => {
                bestRecords = {
                    finalCash: 0,
                    finalReputation: 0,
                    finalRating: "None",
                    mostVisitors: 0,
                    highestProfit: 0
                };
                saveRecords();
                updateRecordsUI();
                confirmBox.classList.add('hidden');
                btnReset.style.display = 'inline-block';
                showToast("Records reset.");
            });
        }
        const btnConfirmNo = document.getElementById('pz-btn-confirm-no');
        if (btnConfirmNo) {
            btnConfirmNo.addEventListener('click', () => {
                confirmBox.classList.add('hidden');
                btnReset.style.display = 'inline-block';
            });
        }
    }

    window.addEventListener('DOMContentLoaded', init);
})();
