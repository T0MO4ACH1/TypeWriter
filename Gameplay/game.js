let gameStarted = false;
const GLOBAL_TIMER = 80;
let timeLeft = GLOBAL_TIMER;
let timerInterval;
let originalText = "";
let typedText = "";
let keyPressCount = 0;
let correctKeys = 0;
let startTime = 0;
let soundEnabled = true;
let capsActive = false;
let wpmHistory = [];
let timeHistory = [];
let wpmChart = null;
let score = 0;
let activeBuff = null;
let buffTimerInterval = null;
let originalWords = [];
let lastWordTriggeredIndex = -1;

// Key mapping for virtual keyboard
const keyMap = new Map();

// Central mechanics object — easy place to apply buffs/nerfs
const gameMechanics = {
    timerBase: GLOBAL_TIMER,
    healthMax: 100,
    health: 100,
    healthLossPerWrong: 1, // not harsh — adjustable by buffs
    scorePerCorrectChar: 10,
    scoreMultiplier: 1, // buffs can change this
    buffsAllowed: 1 // only one at a time (UI enforces)
};

function initKeyboardMapping() {
    document.querySelectorAll('.key').forEach(key => {
        const keyValue = key.getAttribute('data-key');
        if (keyValue) {
            const normalizedKey = normalizeKey(keyValue);
            if (!keyMap.has(normalizedKey)) {
                keyMap.set(normalizedKey, []);
            }
            keyMap.get(normalizedKey).push(key);
        }
    });
}

function normalizeKey(key) {
    const mapping = {
        ' ': 'space',
        'Control': 'control',
        'Shift': 'shift',
        'Alt': 'alt',
        'Meta': 'meta',
        'Enter': 'enter',
        'Backspace': 'backspace',
        'Tab': 'tab',
        'CapsLock': 'capslock',
        'ContextMenu': 'contextmenu'
    };
    return mapping[key] || key.toLowerCase();
}

function highlightKey(key, isCorrect = null) {
    const normalizedKey = normalizeKey(key);
    const elements = keyMap.get(normalizedKey);

    if (elements) {
        elements.forEach(el => {
            el.classList.add('active');
            if (isCorrect === true) {
                el.classList.add('correct');
            } else if (isCorrect === false) {
                el.classList.add('incorrect');
            }

            setTimeout(() => {
                el.classList.remove('active', 'correct', 'incorrect');
            }, 100);
        });
    }
}

function playSound(type) {
    if (!soundEnabled) return;

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (type === 'correct') {
        oscillator.frequency.value = 800;
        gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
    } else if (type === 'incorrect') {
        oscillator.frequency.value = 200;
        gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    }

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
}

function startTimer() {
    clearInterval(timerInterval);
    startTime = Date.now();
    wpmHistory = [];
    timeHistory = [];
    timeLeft = gameMechanics.timerBase;
    const timerEl = document.getElementById("timer");
    timerEl.textContent = timeLeft;

    timerInterval = setInterval(() => {
        timeLeft--;
        timerEl.textContent = timeLeft;

        const elapsed = (Date.now() - startTime) / 1000 / 60;
        const currentWpm = elapsed > 0 ? Math.round((typedText.length / 5) / elapsed) : 0;
        wpmHistory.push(currentWpm);
        timeHistory.push(Math.round(elapsed * 60));

        if (timeLeft <= 0 || gameMechanics.health <= 0) {
            clearInterval(timerInterval);
            evaluatePerformance();
        }
    }, 1000);
}

async function fetchParagraph() {
    // Global Timer
    gameMechanics.timerBase = GLOBAL_TIMER;
    gameMechanics.health = gameMechanics.healthMax;
    document.getElementById("health-fill").style.width = "100%";
    document.getElementById("score-display").textContent = "0";
    score = 0;

    // simulate reading selectedRound
    const selectedFile = localStorage.getItem('selectedRound'); // Json fetch

    try {
        if (selectedFile) {
            const filePath = `../Round/${selectedFile}`;
            const res = await fetch(filePath);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const jsonData = await res.json();

            if (jsonData.paragraphs && jsonData.paragraphs.length > 0) {
                const randomIndex = Math.floor(Math.random() * jsonData.paragraphs.length);
                originalText = jsonData.paragraphs[randomIndex]
                    .replace(/\s+/g, ' ')
                    .trim()
                    .substring(0, 300);
            } else {
                throw new Error("No paragraphs found in JSON");
            }
        } else {
            throw new Error("No round selected");
        }
    } catch (error) {
        console.error("Error fetching paragraph:", error);
        originalText = "the quick brown fox jumps over the lazy dog this is a fallback text for typing practice when the json is unavailable keep practicing to improve your typing speed and accuracy with consistent effort you will see improvement";
    }

    originalWords = originalText.trim().split(/\s+/);
    lastWordTriggeredIndex = -1;

    // reset typed state
    typedText = "";
    gameStarted = true;
    keyPressCount = 0;
    correctKeys = 0;

    document.getElementById("message").classList.add("hidden");

    applyBuffFromStorage();

    startTimer();
    updateDisplay();
    updateStats();
}

/* Update text display */
function updateDisplay() {
    let display = "";

    for (let i = 0; i < originalText.length; i++) {
        const char = originalText[i];

        if (i < typedText.length) {
            const isCorrect = typedText[i] === char;
            display += `<span class="typed-char ${isCorrect ? 'correct-char' : 'incorrect-char'}">${char}</span>`;
        } else {
            display += `<span class="untyped-char">${char}</span>`;
        }
    }

    document.getElementById("mid").innerHTML = display;
    updateStats();
}

function handleCorrectWord(wordIndex, playerWord) {
    // can increment score, streaks, buff hooks, etc.
    // Example: call any active buff hook
    if (activeBuff && typeof activeBuff.onCorrectWord === 'function') {
        try { activeBuff.onCorrectWord({ wordIndex, playerWord, gameMechanics }); } catch (err) { console.error(err); }
    }

    // simple feedback
    // console.log(`Word #${wordIndex} correct: "${playerWord}"`);
}

function handleWrongWord(wordIndex, playerWord, correctWord) {
    if (activeBuff && typeof activeBuff.onWrongWord === 'function') {
        try { activeBuff.onWrongWord({ wordIndex, playerWord, correctWord, gameMechanics }); } catch (err) { console.error(err); }
    }

    // Example default penalty: nothing here, existing per-character health drain still applies.
    // console.log(`Word #${wordIndex} WRONG. typed="${playerWord}", expected="${correctWord}"`);
}

/*Update WPM, accuracy, score, health UI */

function updateStats() {
    const elapsed = gameStarted ? (Date.now() - startTime) / 1000 / 60 : 0;
    const wpm = elapsed > 0 ? Math.round((typedText.length / 5) / elapsed) : 0;

    let correct = 0;
    for (let i = 0; i < typedText.length && i < originalText.length; i++) {
        if (typedText[i] === originalText[i]) correct++;
    }
    const accuracy = typedText.length > 0 ? Math.round((correct / typedText.length) * 100) : 100;

    document.getElementById("wpm-display").textContent = wpm;
    document.getElementById("accuracy-display").textContent = accuracy + "%";
    document.getElementById("score-display").textContent = score;
    document.getElementById("health-fill").style.width = Math.max(0, (gameMechanics.health / gameMechanics.healthMax) * 100) + "%";
}

function createWpmChart(wpmData, timeData) {
    const ctx = document.getElementById('wpmChart');

    if (wpmChart) {
        wpmChart.destroy();
    }

    wpmChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: timeData,
            datasets: [{
                label: 'WPM',
                data: wpmData,
                borderColor: '#e2b714',
                backgroundColor: 'rgba(226, 183, 20, 0.1)',
                tension: 0.4,
                fill: true,
                pointRadius: 3,
                pointHoverRadius: 5,
                pointBackgroundColor: '#e2b714',
                pointBorderColor: '#e2b714'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#2c2e31',
                    titleColor: '#e2b714',
                    bodyColor: '#d1d0c5',
                    borderColor: '#646669',
                    borderWidth: 1,
                    padding: 10,
                    displayColors: false,
                    callbacks: {
                        title: (context) => `${context[0].label}s`,
                        label: (context) => `${context.parsed.y} wpm`
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: '#3a3c3f', drawBorder: false },
                    ticks: { color: '#646669', font: { family: 'Roboto Mono', size: 11 } },
                    title: { display: true, text: 'time (seconds)', color: '#646669', font: { family: 'Roboto Mono', size: 12 } }
                },
                y: {
                    grid: { color: '#3a3c3f', drawBorder: false },
                    ticks: { color: '#646669', font: { family: 'Roboto Mono', size: 11 } },
                    title: { display: true, text: 'words per minute', color: '#646669', font: { family: 'Roboto Mono', size: 12 } },
                    beginAtZero: true
                }
            }
        }
    });
}

/* round evaluation */
function evaluatePerformance() {
    clearInterval(timerInterval);
    if (buffTimerInterval) {
        clearInterval(buffTimerInterval);
        buffTimerInterval = null;
    }

    let correct = 0;
    const minLength = Math.min(typedText.length, originalText.length);
    for (let i = 0; i < minLength; i++) {
        if (typedText[i] === originalText[i]) correct++;
    }

    const accuracy = minLength > 0 ? Math.round((correct / minLength) * 100) : 0;
    const totalTime = gameMechanics.timerBase;
    const wpm = Math.round((typedText.length / 5) / (totalTime / 60));

    let msg = "";
    if (accuracy === 100) {
        msg = "perfect!";
    } else if (accuracy >= 95) {
        msg = "excellent!";
    } else if (accuracy >= 85) {
        msg = "great!";
    } else if (accuracy >= 70) {
        msg = "good!";
    } else {
        msg = "keep practicing!";
    }

    document.getElementById("message-text").textContent = msg;
    document.getElementById("final-wpm").textContent = wpm;
    document.getElementById("final-accuracy").textContent = accuracy + "%";
    document.getElementById("final-score").textContent = score;


    const coinsEarned = Math.floor(score / 100) * 5;

    // show coins and chars
    document.getElementById("final-chars").textContent = `${typedText.length}/${originalText.length}`;
    const finalCoinsEl = document.getElementById("final-coins");
    if (finalCoinsEl) finalCoinsEl.textContent = coinsEarned;

    // persist coins to localStorage
    const stored = parseInt(localStorage.getItem('playerCoins') || '0', 10);
    const newTotal = stored + coinsEarned;
    localStorage.setItem('playerCoins', String(newTotal));

    // optional
    localStorage.setItem('lastSessionCoins', String(coinsEarned));
    localStorage.setItem('lastSessionScore', String(score));

    createWpmChart(wpmHistory, timeHistory);

    document.getElementById("message").classList.remove("hidden");
}


function closeMessageAndGoToShop() {
    // ensure we persist results to localStorage for shop to read
    localStorage.setItem('lastSessionScore', String(score));

    if (!localStorage.getItem('playerCoins')) {
        localStorage.setItem('playerCoins', '0');
    }

    // navigate to shop
    window.location.href = '../Shop/shop.html';
}


/* Key handling (user input) */
document.addEventListener("keydown", e => {
    highlightKey(e.key);

    // ctrl game start
    if (!gameStarted && e.ctrlKey) {
        fetchParagraph();
        return;
    }

    if (!gameStarted || timeLeft <= 0) return;

    if (e.key === "CapsLock") {
        capsActive = !capsActive;
        const capsKeys = keyMap.get('capslock');
        if (capsKeys) {
            capsKeys.forEach(key => {
                key.classList.toggle('caps-active', capsActive);
            });
        }
        return;
    }

    if (e.key === "Backspace") {
        e.preventDefault();
        if (typedText.length > 0) {
            typedText = typedText.slice(0, -1);
            updateDisplay();
        }
        return;
    }

    if (e.key === "Tab") {
        e.preventDefault();
        return;
    }

    if (e.key.length === 1) {
        e.preventDefault();
        const expectedChar = originalText[typedText.length];
        const isCorrect = e.key === expectedChar;

        // Append the typed character
        typedText += e.key;
        keyPressCount++;

        if (isCorrect) {
            correctKeys++;
            score += Math.round(gameMechanics.scorePerCorrectChar * gameMechanics.scoreMultiplier);
            highlightKey(e.key, true);
            playSound('correct');
            if (activeBuff && typeof activeBuff.onCorrectChar === 'function') activeBuff.onCorrectChar({ index: typedText.length - 1, typedText, originalText, gameMechanics });
        } else {
            gameMechanics.health = Math.max(0, gameMechanics.health - gameMechanics.healthLossPerWrong);
            highlightKey(e.key, false);
            playSound('incorrect');
            if (activeBuff && typeof activeBuff.onWrongChar === 'function') activeBuff.onWrongChar({ index: typedText.length - 1, typedText, originalText, gameMechanics });
        }

        // --- WORD COMPLETION DETECTION ---
        const isSpace = e.key === ' ';
        const reachedEnd = typedText.length >= originalText.length;

        if (isSpace || reachedEnd) {
            // compute typed words so far
            // we trim trailing spaces when splitting to avoid empty words
            const typedWords = typedText.trim().split(/\s+/);

            const wordIndex = typedWords.length - 1; // index of the word just completed
            if (wordIndex >= 0 && wordIndex !== lastWordTriggeredIndex) {
                const playerWord = typedWords[wordIndex] || '';
                const correctWord = originalWords[wordIndex] || '';

                // case-insensitive compare, use:
                // const isWordCorrect = playerWord.toLowerCase() === correctWord.toLowerCase();
                const isWordCorrect = playerWord === correctWord;

                if (isWordCorrect) {
                    handleCorrectWord(wordIndex, playerWord);
                } else {
                    handleWrongWord(wordIndex, playerWord, correctWord);
                }

                lastWordTriggeredIndex = wordIndex;
            }
        }

        updateDisplay();

        if (typedText.length >= originalText.length) {
            evaluatePerformance();
        }
    }

});

/* Toggle sound */
document.getElementById('sound-toggle').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    const btn = document.getElementById('sound-toggle');
    btn.style.opacity = soundEnabled ? '1' : '0.3';
});


document.getElementById('next-button').addEventListener('click', () => {
    closeMessageAndGoToShop();
});

/* Initialize keyboard mapping on DOM load */
document.addEventListener('DOMContentLoaded', () => {
    initKeyboardMapping();
    // initialize UI values
    document.getElementById("timer").textContent = GLOBAL_TIMER;
    document.getElementById("score-display").textContent = "0";
    document.getElementById("health-fill").style.width = "100%";
});


// ------------------ Buffs logic --------------------------------------------------------------------------

function applyBuffFromStorage() {
    const stored = localStorage.getItem('equippedBuff');
    if (!stored) {
        document.getElementById('buff-window').textContent = 'None';
        document.getElementById('buff-duration').textContent = '';
        activeBuff = null;
        return;
    }

    try {
        const buff = JSON.parse(stored);
        activeBuff = buff;
        document.getElementById('buff-window').textContent = buff.name;
        document.getElementById('buff-duration').textContent = '';

        // apply the buff logic here
        applyBuffEffects(buff);

    } catch (err) {
        console.error('Failed to load equipped buff', err);
        document.getElementById('buff-window').textContent = 'None';
        activeBuff = null;
    }
}

function clearActiveBuff() {
    // revert effects if necessary
    revertBuffEffects(activeBuff);
    activeBuff = null;
    localStorage.removeItem('equippedBuff');

    document.getElementById('buff-window').textContent = 'None';
    document.getElementById('buff-duration').textContent = '';
}


// ---------------------------- Buffs ----------------------------------------

function applyBuffEffects(buff) {
    if (!buff) return;

    switch (buff.name) {

        // -------------------------------------------- 🟣 Legendary ------------------------------------------------
        case "Made in Heaven":
            // Reverse time — timer decreases faster but can go negative
            applyLegendaryTheme("Made in Heaven");
            gameMechanics.timerBase = GLOBAL_TIMER;
            const timerEl = document.getElementById("timer");
            clearInterval(timerInterval);
            timerInterval = setInterval(() => {
                timeLeft--;
                timerEl.textContent = timeLeft;
            }, 900); // slightly faster tick
            break;

        case "Makoto":
            // Heal per correct word
            applyLegendaryTheme("Makoto");
            activeBuff.onCorrectWord = ({ gameMechanics }) => {
                gameMechanics.health = Math.min(gameMechanics.healthMax, gameMechanics.health + 2);
            };
            break;

        case "Just Vibe":
            // Chill music (placeholder)
            document.body.style.backgroundColor = "#26283b";
            break;

        // ---------------------------------------- 🔴 Rare --------------------------------------------

        case "Adam":
            activeBuff.onCorrectWord = ({ gameMechanics }) => {
                gameMechanics.health = Math.min(gameMechanics.healthMax, gameMechanics.health + 5);
            };
            break;

        case "Excalibur":
            gameMechanics.healthMax += 50;
            gameMechanics.health = gameMechanics.healthMax;
            break;

        case "Plague":
            activeBuff.onCorrectWord = ({ gameMechanics }) => {
                gameMechanics.timerBase += 10;
                gameMechanics.health = Math.max(0, gameMechanics.health - 10);
            };
            break;

        case "Sam Howell":
            const chance = Math.floor(Math.random() * 200) + 1;
            console.log("Sam Howell roll:", chance);

            if (chance === 1) {
                // Instant auto-type success
                typedText = originalText;
                correctKeys = originalText.length;
                score = Math.round(originalText.length * gameMechanics.scorePerCorrectChar * gameMechanics.scoreMultiplier);

                // Set full health and perfect stats
                gameMechanics.health = gameMechanics.healthMax;

                updateDisplay();
                updateStats();
                evaluatePerformance();
                alert("🛡️ Sam Howell activated: Paragraph auto-typed!");
            } else {
                console.log("Sam Howell did not activate this round.");
            }
            break;

        case "Jack the Ripper":
            // Track correct word count per round
            let ripperWordCount = 0;

            activeBuff.onCorrectWord = ({ gameMechanics }) => {
                ripperWordCount++;

                if (ripperWordCount % 6 === 0) {
                    // Apply the trade-off effect
                    gameMechanics.health = Math.max(0, gameMechanics.health - 6);

                    // Increase remaining timer safely
                    timeLeft += 6;
                    gameMechanics.timerBase += 6;

                    // Update UI feedback
                    document.getElementById("health-fill").style.width =
                        `${(gameMechanics.health / gameMechanics.healthMax) * 100}%`;

                    document.getElementById("timer").textContent = timeLeft;

                    // flavor feedback
                    console.log("💉 Jack the Ripper activated: -6 health, +6s timer");
                }
            };
            break;

        case "AC130":
            {
                const words = originalText.trim().split(/\s+/);
                if (words.length <= 10) break; // Avoid breaking short texts

                // Pick 10 unique random indexes
                const indexes = new Set();
                while (indexes.size < 10) {
                    const idx = Math.floor(Math.random() * words.length);
                    indexes.add(idx);
                }

                // Remove those words
                const filtered = words.filter((_, i) => !indexes.has(i));

                // Rebuild the modified paragraph
                originalText = filtered.join(" ");

                // Update global word tracking
                originalWords = originalText.trim().split(/\s+/);

                // show "destroyed" result
                const paragraphEl = document.getElementById("paragraph");
                if (paragraphEl) {
                    paragraphEl.textContent = originalText;
                }

                console.log("💣 AC130 activated: 10 words destroyed from paragraph");
            }
            break;

        case "El Drago": {
            // Streak counter for consecutive correct letters
            let elDragoStreak = 0;
            // Safety guard to avoid re-triggering autofill repeatedly when we autofill letters
            let elDragoAutofillInProgress = false;

            // on every correct character
            activeBuff.onCorrectChar = ({ index, typedText, originalText, gameMechanics }) => {
                if (elDragoAutofillInProgress) return; // ignore chars generated by autofill

                elDragoStreak++;

                // when streak reaches 10, autofill up to next 5 letters
                if (elDragoStreak >= 10) {
                    // compute start position (next char after current typed)
                    const nextPos = index + 1;
                    if (nextPos >= originalText.length) {
                        // nothing to autofill
                        elDragoStreak = 0;
                        return;
                    }

                    // how many letters to autofill (cap by remaining length)
                    const lettersToFill = Math.min(5, originalText.length - nextPos);

                    // prepare the string to append
                    const fill = originalText.slice(nextPos, nextPos + lettersToFill);

                    // Mark that autofill is in progress so the buff won't count these inserted chars
                    elDragoAutofillInProgress = true;

                    // Append each char (simulate typed chars so UI/score updates)
                    for (let i = 0; i < fill.length; i++) {
                        const ch = fill[i];
                        // append to typedText
                        typedText += ch;

                        // credit score for each autofill char using same scoring rules
                        score += Math.round(gameMechanics.scorePerCorrectChar * gameMechanics.scoreMultiplier);

                        // visual feedback for each char (light highlight)
                        highlightKey(ch, true);
                        // optional sound for autofill — small beep
                        try { playSound('correct'); } catch (e) { }
                    }

                    // update displays after autofill
                    updateDisplay();
                    updateStats();

                    // reset streak after reward (you could also set to 0 or maintain leftover)
                    elDragoStreak = 0;

                    // small timeout to allow any input handlers to ignore autofill chars
                    setTimeout(() => {
                        elDragoAutofillInProgress = false;
                    }, 50);

                    console.log("🐉 El Drago: autofilled", fill.length, "letters");
                }
            };

            // on any wrong character, reset the streak
            activeBuff.onWrongChar = ({ index, typedText, originalText, gameMechanics }) => {
                elDragoStreak = 0;
            };

            // store these in the buff object too so revert can clear them if needed
            if (!activeBuff._meta) activeBuff._meta = {};
            activeBuff._meta.elDrago = { reset: () => { elDragoStreak = 0; elDragoAutofillInProgress = false; } };
        }
            break;


        // -------------------------- 🔵 Common ------------------------------------

        case "Eve":
            gameMechanics.timerBase += 5;
            break;

        case "Lion":
            gameMechanics.healthMax += 10;
            gameMechanics.health = gameMechanics.healthMax;
            break;

        case "Bing-Chilling":
            clearInterval(timerInterval);
            document.getElementById("timer").textContent = timeLeft;
            setTimeout(() => startTimer(), 5000);
            break;

        case "Freddy":
            gameMechanics.health -= 10;
            gameMechanics.timerBase += 15;
            break;

        case "Jason Vorhees":

            gameMechanics.healthLossPerWrong = 0.5;

            console.log("🔪 Jason Vorhees active: incoming damage reduced by 50%");
            break;

        case "Pinocchio":
            // When a word is typed incorrectly: take extra health damage but gain same amount in timer.
            activeBuff.onWrongWord = ({ gameMechanics }) => {
                const extraDamage = 5; // you can tweak this for balance


                gameMechanics.health = Math.max(0, gameMechanics.health - extraDamage);

                // Increase timer by same amount
                timeLeft += extraDamage;
                gameMechanics.timerBase += extraDamage;

                // Update UI feedback
                document.getElementById("health-fill").style.width =
                    `${(gameMechanics.health / gameMechanics.healthMax) * 100}%`;
                document.getElementById("timer").textContent = timeLeft;

                // feedback
                console.log(`🤥 Pinocchio: Took ${extraDamage} damage, gained ${extraDamage}s time`);
            };
            break;

        case "Percy Jackson":
            // At the end of the round, grant +20 bonus coins
            activeBuff.onRoundEnd = ({ coinsEarned }) => {
                const bonus = 20;
                const total = coinsEarned + bonus;

                console.log(`🌊 Percy Jackson: +${bonus} bonus coins (total ${total})`);
                return total; // must return new total so caller can use it
            };
            break;

        case "Just a Poor Boy":
            // --- Passive Stat Modifier: +20% Max Health ---
            const originalHealthMax = gameMechanics.healthMax;
            const increasedHealth = Math.floor(originalHealthMax * 1.2);
            gameMechanics.healthMax = increasedHealth;
            gameMechanics.health = increasedHealth;

            // Update health bar visually
            document.getElementById("health-fill").style.width = "100%";

            console.log("🎵 Just a Poor Boy active: +20% max health, -10% coins");

            // --- End-of-Round Modifier: -10% Coins ---
            activeBuff.onRoundEnd = ({ coinsEarned }) => {
                const reduced = Math.floor(coinsEarned * 0.9); // reduce by 10%
                console.log(`🎵 Just a Poor Boy: -10% coins (final ${reduced})`);
                return reduced;
            };

            // Store old health for revert
            if (!activeBuff._meta) activeBuff._meta = {};
            activeBuff._meta.poorBoy = { originalHealthMax };
            break;

        case "Pablo":
            // Trigger only once per round
            let pabloTriggered = false;

            // Helper function to monitor health drops
            const checkPabloTrigger = () => {
                if (!pabloTriggered && gameMechanics.health <= gameMechanics.healthMax / 2) {
                    pabloTriggered = true;

                    // Add +10 seconds to timer
                    timeLeft += 10;
                    gameMechanics.timerBase += 10;

                    // Visual + log feedback
                    document.getElementById("timer").textContent = timeLeft;
                    console.log("✈️ Pablo activated: +10 seconds added!");

                    // Optional small animation or flash effect
                    const timerEl = document.getElementById("timer");
                    timerEl.classList.add("pablo-boost");
                    setTimeout(() => timerEl.classList.remove("pablo-boost"), 600);
                }
            };

            // Monkey-patch health updates by wrapping health setter logic
            // Since damage happens in wrong-letter events, we hook into that
            const originalHealthLoss = gameMechanics.healthLossPerWrong;

            // Intercept health deduction checks every wrong char
            activeBuff.onWrongChar = ({ gameMechanics }) => {
                // Just check threshold, not changing damage logic
                checkPabloTrigger();
            };

            // Also check on wrong words (bigger damage buffs may affect this)
            activeBuff.onWrongWord = ({ gameMechanics }) => {
                checkPabloTrigger();
            };

            // Store original values for revert
            if (!activeBuff._meta) activeBuff._meta = {};
            activeBuff._meta.pablo = { pabloTriggered };
            break;

        case "Song Gi-hun":
            // Buff active every round; progress tracked in localStorage
            const progressKey = "songGiHunProgress";

            // Initialize if not present
            if (!localStorage.getItem(progressKey)) {
                localStorage.setItem(progressKey, "0");
            }

            activeBuff.onRoundEnd = ({ coinsEarned }) => {
                // Increment progress
                let count = parseInt(localStorage.getItem(progressKey)) || 0;
                count++;

                console.log(`🎮 Song Gi-hun progress: ${count}/3 rounds`);

                if (count >= 3) {
                    count = 0; // reset
                    // Add +100 coins reward
                    const storedCoins = parseInt(localStorage.getItem("coins")) || 0;
                    localStorage.setItem("coins", storedCoins + 100);
                    console.log("🪙 Song Gi-hun: +100 bonus coins awarded!");
                    alert("🎮 Song Gi-hun Bonus: +100 coins after 3 rounds!");
                }

                // Save updated progress
                localStorage.setItem(progressKey, count.toString());

                // Return unchanged round coins
                return coinsEarned;
            };
            break;

        case "Jimbo":
            // --- Passive permanent stat increase ---
            gameMechanics.healthMax += 4;
            gameMechanics.health += 4;
            gameMechanics.timerBase += 4;
            timeLeft += 4;

            document.getElementById("health-fill").style.width =
                `${(gameMechanics.health / gameMechanics.healthMax) * 100}%`;
            document.getElementById("timer").textContent = timeLeft;

            console.log("🍟 Jimbo active: +4 max health, +4s timer (permanent)");
            break;


        // --------------------------------------- Uncommon ---------------------------------------


        default:
            console.log("Buff loaded:", buff.name);
            break;
    }
}





// -------------------- LEGENDARY THEME SYSTEM -------------------- //

const legendaryThemes = {
    "Made in Heaven": {
        background: "radial-gradient(circle, #000 0%, #111 100%)",
        filter: "grayscale(100%) contrast(1.3)",
        music: "assets/audio/made_in_heaven.mp3", // change to your path
        animation: "wordStorm", // type of background animation
    },
    "Makoto": {
        background: "linear-gradient(180deg, #001736 0%, #00183e 60%, #00bbfa 100%)",
        filter: "saturate(1.2) brightness(1.1)",
        music: "assets/audio/mass_destruction.mp3",
        animation: "frogParticles",   // ✅ change this
        accent: "#79d7fd"
    },

};

let currentTheme = null;
let themeAudio = null;
let themeAnimationEl = null;

// Apply legendary visual + audio theme
function applyLegendaryTheme(buffName) {
    const theme = legendaryThemes[buffName];
    if (!theme) return;

    currentTheme = buffName;

    // Apply background + filters
    document.body.style.background = theme.background;
    document.body.style.filter = theme.filter;
    document.body.style.transition = "all 0.8s ease";

    if (buffName === "Makoto") {
        // Update CSS variables (UI color accents)
        document.documentElement.style.setProperty("--accent-color", "#00bbfa");  // bright aqua
        document.documentElement.style.setProperty("--text-color", "#79d7fd");    // light cyan
        document.documentElement.style.setProperty("--bg-color", "#001736");       // dark navy
        document.documentElement.style.setProperty("--secondary-bg", "#00183e");   // gradient dark tone

        // Optionally adjust the text color for better readability
        document.querySelectorAll("*").forEach(el => {
            el.style.color = "#79d7fd";
        });
    }

    if (buffName === "Made in Heaven") {
        // For contrast-heavy B/W mode
        document.documentElement.style.setProperty("--accent-color", "#fff");
        document.documentElement.style.setProperty("--text-color", "#fff");
        document.documentElement.style.setProperty("--bg-color", "#000");
    }

    // Start background animation
    startLegendaryAnimation(theme.animation);

    // Play music
    if (theme.music) {
        themeAudio = new Audio(theme.music);
        themeAudio.volume = 0.5;
        themeAudio.loop = true;
        themeAudio.play().catch(e => console.warn("Music autoplay blocked"));
    }

    console.log(`✨ Legendary theme applied: ${buffName}`);
}

// Revert all theme effects
function revertLegendaryTheme() {
    // Stop music
    if (themeAudio) {
        themeAudio.pause();
        themeAudio = null;
    }

    // Remove animation
    if (themeAnimationEl) {
        themeAnimationEl.remove();
        themeAnimationEl = null;
    }

    // Reset styles
    document.body.style.background = "";
    document.body.style.filter = "";
    document.body.style.transition = "";

    currentTheme = null;

    console.log("🕊️ Legendary theme reverted");
}

// Handle background effects
function startLegendaryAnimation(type) {
    themeAnimationEl = document.createElement("div");
    themeAnimationEl.id = "legendary-bg";
    themeAnimationEl.style.position = "fixed";
    themeAnimationEl.style.top = 0;
    themeAnimationEl.style.left = 0;
    themeAnimationEl.style.width = "100vw";
    themeAnimationEl.style.height = "100vh";
    themeAnimationEl.style.pointerEvents = "none";
    themeAnimationEl.style.zIndex = -1;
    themeAnimationEl.style.overflow = "hidden";
    document.body.appendChild(themeAnimationEl);

    if (type === "wordStorm") {
        createWordStorm(themeAnimationEl);
    } else if (type === "frogParticles") {
        createFrogParticles(themeAnimationEl);
    }
}

// Animation 1: “Word storm” (Made in Heaven)
function createWordStorm(container) {
    const words = ["time", "speed", "fate", "heaven", "end", "reset"];
    for (let i = 0; i < 40; i++) {
        const el = document.createElement("div");
        el.textContent = words[Math.floor(Math.random() * words.length)];
        el.style.position = "absolute";
        el.style.left = `${Math.random() * 100}vw`;
        el.style.top = `${Math.random() * 100}vh`;
        el.style.color = "#fff";
        el.style.fontSize = `${12 + Math.random() * 16}px`;
        el.style.opacity = 0.6;
        el.style.animation = `wordFly ${1 + Math.random() * 1}s linear infinite`;
        container.appendChild(el);
    }

    // Keyframes for fast word movement
    const style = document.createElement("style");
    style.textContent = `
        @keyframes wordFly {
            from { transform: translateY(100vh) scale(0.5); opacity: 0.8; }
            to { transform: translateY(-100vh) scale(2); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

// Animation 2: Frog Particles (Makoto)
function createFrogParticles(container) {
    const frogColors = ["#79d7fd", "#00bbfa", "#008ccf"]; // Makoto theme palette
    for (let i = 0; i < 25; i++) {
        const frog = document.createElement("div");

        // Use emoji + CSS filters to recolor it
        frog.textContent = "🐸";
        frog.style.position = "absolute";
        frog.style.left = `${Math.random() * 100}vw`;
        frog.style.top = `${Math.random() * 100}vh`;
        frog.style.fontSize = `${16 + Math.random() * 20}px`;
        frog.style.opacity = 0.85;
        frog.style.filter = `
            hue-rotate(180deg)
            brightness(1.8)
            drop-shadow(0 0 8px ${frogColors[Math.floor(Math.random() * frogColors.length)]})
        `;
        frog.style.transition = "filter 0.6s ease";

        // Smooth floating motion
        frog.style.animation = `frogFloatBlue ${3 + Math.random() * 4}s ease-in-out infinite alternate`;

        container.appendChild(frog);
    }

    // Keyframes for floating motion
    const style = document.createElement("style");
    style.textContent = `
        @keyframes frogFloatBlue {
            0% { transform: translateY(0) rotate(0deg); opacity: 0.8; }
            50% { transform: translateY(-20vh) rotate(180deg); opacity: 0.9; }
            100% { transform: translateY(-40vh) rotate(360deg); opacity: 0.5; }
        }
    `;
    document.head.appendChild(style);
}



