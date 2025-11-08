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
let madeInHeavenActive = false;


const keyMap = new Map();

const gameMechanics = {
    timerBase: GLOBAL_TIMER,
    healthMax: 100,
    health: 100,
    healthLossPerWrong: 1, scorePerCorrectChar: 10,
    scoreMultiplier: 1, buffsAllowed: 1
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

        if ((timeLeft <= 0 && !madeInHeavenActive) || gameMechanics.health <= 0) {
            clearInterval(timerInterval);
            evaluatePerformance();
        }

    }, 1000);
}

async function fetchParagraph() {
    gameMechanics.timerBase = GLOBAL_TIMER;
    gameMechanics.health = gameMechanics.healthMax;
    document.getElementById("health-fill").style.width = "100%";
    document.getElementById("score-display").textContent = "0";
    score = 0;

    const selectedFile = localStorage.getItem('selectedRound');
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
    if (activeBuff && typeof activeBuff.onCorrectWord === 'function') {
        try { activeBuff.onCorrectWord({ wordIndex, playerWord, gameMechanics }); } catch (err) { console.error(err); }
    }

}

function handleWrongWord(wordIndex, playerWord, correctWord) {
    if (activeBuff && typeof activeBuff.onWrongWord === 'function') {
        try { activeBuff.onWrongWord({ wordIndex, playerWord, correctWord, gameMechanics }); } catch (err) { console.error(err); }
    }

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
    allowNegativeTimeMode = false;
    madeInHeavenActive = false;
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

    document.getElementById("final-chars").textContent = `${typedText.length}/${originalText.length}`;
    const finalCoinsEl = document.getElementById("final-coins");
    if (finalCoinsEl) finalCoinsEl.textContent = coinsEarned;

    const stored = parseInt(localStorage.getItem('playerCoins') || '0', 10);
    const newTotal = stored + coinsEarned;
    localStorage.setItem('playerCoins', String(newTotal));

    localStorage.setItem('lastSessionCoins', String(coinsEarned));
    localStorage.setItem('lastSessionScore', String(score));

    createWpmChart(wpmHistory, timeHistory);

    document.getElementById("message").classList.remove("hidden");
}


function closeMessageAndGoToShop() {
    localStorage.setItem('lastSessionScore', String(score));

    if (!localStorage.getItem('playerCoins')) {
        localStorage.setItem('playerCoins', '0');
    }

    window.location.href = '../Shop/shop.html';
}


/* Key handling (user input) */
document.addEventListener("keydown", e => {
    highlightKey(e.key);

    if (!gameStarted && e.ctrlKey) {
        fetchParagraph();
        return;
    }

    if (!gameStarted || (timeLeft <= 0 && activeBuff?.name !== "Made in Heaven")) return;


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

        const isSpace = e.key === ' ';
        const reachedEnd = typedText.length >= originalText.length;

        if (isSpace || reachedEnd) {
            const typedWords = typedText.trim().split(/\s+/);

            const wordIndex = typedWords.length - 1; if (wordIndex >= 0 && wordIndex !== lastWordTriggeredIndex) {
                const playerWord = typedWords[wordIndex] || '';
                const correctWord = originalWords[wordIndex] || '';

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
    document.getElementById("timer").textContent = GLOBAL_TIMER;
    document.getElementById("score-display").textContent = "0";
    document.getElementById("health-fill").style.width = "100%";
});



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

        applyBuffEffects(buff);

    } catch (err) {
        console.error('Failed to load equipped buff', err);
        document.getElementById('buff-window').textContent = 'None';
        activeBuff = null;
    }
}

function clearActiveBuff() {
    revertBuffEffects(activeBuff);
    activeBuff = null;
    localStorage.removeItem('equippedBuff');

    document.getElementById('buff-window').textContent = 'None';
    document.getElementById('buff-duration').textContent = '';
}

// buffs


// ---------------------------------------------- legendary -----------------------------------------



function applyBuffEffects(buff) {
    if (!buff) return;

    switch (buff.name) {

        case "Made in Heaven": {
            applyLegendaryTheme("Made in Heaven");
            gameMechanics.timerBase = GLOBAL_TIMER;

            const timerEl = document.getElementById("timer");
            clearInterval(timerInterval); allowNegativeTimeMode = true;
            madeInHeavenActive = true;
            let last = performance.now();
            let speed = 100;
            let accel = 1.025;
            let running = true;

            function tick(now) {
                if (!running) return;
                const delta = now - last;
                last = now;

                timeLeft -= speed * (delta / 1000);
                speed *= accel;

                timerEl.textContent = timeLeft.toFixed(1);
                if (timeLeft < 0) {
                    timerEl.style.color = "#ff6b6b";
                    timerEl.style.textShadow = "0 0 12px #ff0000";
                } else {
                    timerEl.style.color = "";
                    timerEl.style.textShadow = "";
                }

                if (timeLeft <= -500) {
                    timeLeft = 0;
                    speed = 100;
                    accel += 0.002;

                    document.body.style.filter = "invert(1) brightness(2)";
                    setTimeout(() => (document.body.style.filter = ""), 150);

                    console.log("🌌 Universal reset triggered (Made in Heaven)");
                }

                if (typedText.length >= originalText.length) {
                    running = false;
                    allowNegativeTimeMode = false;
                    madeInHeavenActive = false;
                    evaluatePerformance();
                    return;
                }

                requestAnimationFrame(tick);
            }

            requestAnimationFrame(tick);
            break;
        }

        case "Makoto":
            applyLegendaryTheme("Makoto");
            activeBuff.onCorrectWord = ({ gameMechanics }) => {
                gameMechanics.health = Math.min(gameMechanics.healthMax, gameMechanics.health + 5);
                const fill = document.getElementById("health-fill");
                fill.style.background = "linear-gradient(90deg, #00bbfa, #79d7fd)";
                fill.style.boxShadow = "0 0 10px #00bbfa, 0 0 20px #79d7fd";
            };

            document.addEventListener("buffEnd", () => {
                const fill = document.getElementById("health-fill");
                fill.style.background = "";
                fill.style.boxShadow = "";
            });
            break;

        case "Just Vibe": {
            clearInterval(timerInterval);
            allowNegativeTimeMode = true;
            madeInHeavenActive = false;
            gameMechanics.health = gameMechanics.healthMax;

            const timerEl = document.getElementById("timer");
            timerEl.textContent = "∞";
            const healthFill = document.getElementById("health-fill");
            healthFill.style.width = "100%";

            // === RAINBOW BACKGROUND (now on top of Tailwind body) ===
            const rainbowLayer = document.createElement("div");
            rainbowLayer.id = "vibe-rainbow";
            document.body.appendChild(rainbowLayer);

            // === Create visual cat layer ===
            const vibeLayer = document.createElement("div");
            vibeLayer.id = "vibe-layer";
            vibeLayer.innerHTML = `
        <div class="vibe-side vibe-left">
            <img src="assets/gifs/CatVibe.gif" alt="Vibe Left" />
        </div>
        <div class="vibe-side vibe-right">
            <img src="assets/gifs/CatVibe.gif" alt="Vibe Right" />
        </div>`;
            document.body.appendChild(vibeLayer);

            // === Audio setup ===
            const vibeAudio = new Audio("assets/audio/Levan Polka.mp3");
            vibeAudio.loop = true;
            vibeAudio.volume = 0.4;
            const startMusic = () => {
                vibeAudio.play().catch(() => { });
                document.removeEventListener("keydown", startMusic);
            };
            document.addEventListener("keydown", startMusic);

            // Keep health full forever
            const vibeHealth = setInterval(() => {
                gameMechanics.health = gameMechanics.healthMax;
                healthFill.style.width = "100%";
            }, 500);

            // End only when paragraph done
            const vibeCheck = setInterval(() => {
                if (typedText.length >= originalText.length) {
                    clearInterval(vibeHealth);
                    clearInterval(vibeCheck);
                    vibeAudio.pause();
                    if (vibeLayer) vibeLayer.remove();
                    if (rainbowLayer) rainbowLayer.remove();
                    evaluatePerformance();
                }
            }, 300);
            break;
        }



        // ------------------------------------------ rare ---------------------------------------------------


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
                typedText = originalText;
                correctKeys = originalText.length;
                score = Math.round(originalText.length * gameMechanics.scorePerCorrectChar * gameMechanics.scoreMultiplier);

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
            let ripperWordCount = 0;

            activeBuff.onCorrectWord = ({ gameMechanics }) => {
                ripperWordCount++;

                if (ripperWordCount % 6 === 0) {
                    gameMechanics.health = Math.max(0, gameMechanics.health - 6);

                    timeLeft += 6;
                    gameMechanics.timerBase += 6;

                    document.getElementById("health-fill").style.width =
                        `${(gameMechanics.health / gameMechanics.healthMax) * 100}%`;

                    document.getElementById("timer").textContent = timeLeft;

                    console.log("💉 Jack the Ripper activated: -6 health, +6s timer");
                }
            };
            break;

        case "AC130":
            {
                const words = originalText.trim().split(/\s+/);
                if (words.length <= 10) break;
                const indexes = new Set();
                while (indexes.size < 10) {
                    const idx = Math.floor(Math.random() * words.length);
                    indexes.add(idx);
                }

                const filtered = words.filter((_, i) => !indexes.has(i));

                originalText = filtered.join(" ");

                originalWords = originalText.trim().split(/\s+/);

                const paragraphEl = document.getElementById("paragraph");
                if (paragraphEl) {
                    paragraphEl.textContent = originalText;
                }

                console.log("💣 AC130 activated: 10 words destroyed from paragraph");
            }
            break;

        case "El Drago": {
            let elDragoStreak = 0;
            let elDragoAutofillInProgress = false;

            activeBuff.onCorrectChar = ({ index, typedText, originalText, gameMechanics }) => {
                if (elDragoAutofillInProgress) return;
                elDragoStreak++;

                if (elDragoStreak >= 10) {
                    const nextPos = index + 1;
                    if (nextPos >= originalText.length) {
                        elDragoStreak = 0;
                        return;
                    }

                    const lettersToFill = Math.min(5, originalText.length - nextPos);

                    const fill = originalText.slice(nextPos, nextPos + lettersToFill);

                    elDragoAutofillInProgress = true;

                    for (let i = 0; i < fill.length; i++) {
                        const ch = fill[i];
                        typedText += ch;

                        score += Math.round(gameMechanics.scorePerCorrectChar * gameMechanics.scoreMultiplier);

                        highlightKey(ch, true);
                        try { playSound('correct'); } catch (e) { }
                    }

                    updateDisplay();
                    updateStats();

                    elDragoStreak = 0;

                    setTimeout(() => {
                        elDragoAutofillInProgress = false;
                    }, 50);

                    console.log("🐉 El Drago: autofilled", fill.length, "letters");
                }
            };

            activeBuff.onWrongChar = ({ index, typedText, originalText, gameMechanics }) => {
                elDragoStreak = 0;
            };

            if (!activeBuff._meta) activeBuff._meta = {};
            activeBuff._meta.elDrago = { reset: () => { elDragoStreak = 0; elDragoAutofillInProgress = false; } };
        }
            break;

        // -------------------------------------- Common -----------------------------------------------------

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
            activeBuff.onWrongWord = ({ gameMechanics }) => {
                const extraDamage = 5;

                gameMechanics.health = Math.max(0, gameMechanics.health - extraDamage);

                timeLeft += extraDamage;
                gameMechanics.timerBase += extraDamage;

                document.getElementById("health-fill").style.width =
                    `${(gameMechanics.health / gameMechanics.healthMax) * 100}%`;
                document.getElementById("timer").textContent = timeLeft;

                console.log(`🤥 Pinocchio: Took ${extraDamage} damage, gained ${extraDamage}s time`);
            };
            break;

        case "Percy Jackson":
            activeBuff.onRoundEnd = ({ coinsEarned }) => {
                const bonus = 20;
                const total = coinsEarned + bonus;

                console.log(`🌊 Percy Jackson: +${bonus} bonus coins (total ${total})`);
                return total;
            };
            break;

        case "Just a Poor Boy":
            const originalHealthMax = gameMechanics.healthMax;
            const increasedHealth = Math.floor(originalHealthMax * 1.2);
            gameMechanics.healthMax = increasedHealth;
            gameMechanics.health = increasedHealth;

            document.getElementById("health-fill").style.width = "100%";

            console.log("🎵 Just a Poor Boy active: +20% max health, -10% coins");

            activeBuff.onRoundEnd = ({ coinsEarned }) => {
                const reduced = Math.floor(coinsEarned * 0.9); console.log(`🎵 Just a Poor Boy: -10% coins (final ${reduced})`);
                return reduced;
            };

            if (!activeBuff._meta) activeBuff._meta = {};
            activeBuff._meta.poorBoy = { originalHealthMax };
            break;

        case "Pablo":
            let pabloTriggered = false;

            const checkPabloTrigger = () => {
                if (!pabloTriggered && gameMechanics.health <= gameMechanics.healthMax / 2) {
                    pabloTriggered = true;

                    timeLeft += 10;
                    gameMechanics.timerBase += 10;

                    document.getElementById("timer").textContent = timeLeft;
                    console.log("✈️ Pablo activated: +10 seconds added!");

                    const timerEl = document.getElementById("timer");
                    timerEl.classList.add("pablo-boost");
                    setTimeout(() => timerEl.classList.remove("pablo-boost"), 600);
                }
            };

            const originalHealthLoss = gameMechanics.healthLossPerWrong;

            activeBuff.onWrongChar = ({ gameMechanics }) => {
                checkPabloTrigger();
            };

            activeBuff.onWrongWord = ({ gameMechanics }) => {
                checkPabloTrigger();
            };

            if (!activeBuff._meta) activeBuff._meta = {};
            activeBuff._meta.pablo = { pabloTriggered };
            break;

        case "Song Gi-hun":
            const progressKey = "songGiHunProgress";

            if (!localStorage.getItem(progressKey)) {
                localStorage.setItem(progressKey, "0");
            }

            activeBuff.onRoundEnd = ({ coinsEarned }) => {
                let count = parseInt(localStorage.getItem(progressKey)) || 0;
                count++;

                console.log(`🎮 Song Gi-hun progress: ${count}/3 rounds`);

                if (count >= 3) {
                    count = 0; const storedCoins = parseInt(localStorage.getItem("coins")) || 0;
                    localStorage.setItem("coins", storedCoins + 100);
                    console.log("🪙 Song Gi-hun: +100 bonus coins awarded!");
                    alert("🎮 Song Gi-hun Bonus: +100 coins after 3 rounds!");
                }

                localStorage.setItem(progressKey, count.toString());

                return coinsEarned;
            };
            break;

        case "Jimbo":
            gameMechanics.healthMax += 4;
            gameMechanics.health += 4;
            gameMechanics.timerBase += 4;
            timeLeft += 4;

            document.getElementById("health-fill").style.width =
                `${(gameMechanics.health / gameMechanics.healthMax) * 100}%`;
            document.getElementById("timer").textContent = timeLeft;

            console.log("🍟 Jimbo active: +4 max health, +4s timer (permanent)");
            break;

        // === UNCOMMON BUFFS ===

        case "Lelouch":
            applyLegendaryTheme("Lelouch");
            let lelouchActive = true;
            const lelouchStart = Date.now();
            let lelouchPenalty = 0;

            const lelouchInterval = setInterval(() => {
                const elapsed = (Date.now() - lelouchStart) / 1000;
                if (elapsed > 15 || !lelouchActive) {
                    lelouchActive = false;
                    clearInterval(lelouchInterval);
                    gameMechanics.scoreMultiplier -= 0.5;
                }
            }, 1000);

            gameMechanics.scoreMultiplier += 0.5;

            activeBuff.onMistake = ({ gameMechanics }) => {
                lelouchPenalty += 5;
                gameMechanics.accuracy = Math.max(0, gameMechanics.accuracy - lelouchPenalty);
            };
            break;

        case "Enriqueee":
            applyLegendaryTheme("Enriqueee");
            let enriqueCount = 0;
            activeBuff.onCorrectWord = ({ gameMechanics }) => {
                gameMechanics.wpm += 2;
                enriqueCount++;
                if (enriqueCount % 3 === 0) {
                    timeLeft = Math.max(0, timeLeft - 1);
                }
            };
            break;

        case "Dark Psychology":
            applyLegendaryTheme("Dark Psychology");
            gameMechanics.accuracy += 15;
            let darkCount = 0;
            activeBuff.onMistake = ({ gameMechanics }) => {
                darkCount++;
                if (darkCount % 5 === 0) {
                    gameMechanics.health = Math.max(0, gameMechanics.health - 10);
                    console.log("💀 Dark Psychology laughs at you...");
                }
            };
            break;

        case "Dream On":
            applyLegendaryTheme("Dream On");
            let dreamFrozen = false;
            const dreamCheck = setInterval(() => {
                if (!dreamFrozen && timeLeft <= 30 && timeLeft > 25) {
                    dreamFrozen = true;
                    const originalMultiplier = gameMechanics.scoreMultiplier;
                    const originalRegen = gameMechanics.healthRegenRate || 0;
                    const storedTimer = timeLeft;

                    clearInterval(timerInterval);
                    setTimeout(() => {
                        gameMechanics.scoreMultiplier = originalMultiplier;
                        gameMechanics.healthRegenRate = originalRegen;
                        timerInterval = setInterval(startTimerTick, 1000);
                    }, 5000);
                }
            }, 1000);
            break;

        case "Thick of It":
            applyLegendaryTheme("Thick of It");
            const thickInterval = setInterval(() => {
                if (gameMechanics.health <= gameMechanics.healthMax / 2) {
                    gameMechanics.scoreMultiplier += 0.3;
                    timeLeft -= 0.25;
                }
            }, 1000);
            break;

        case "Photosynthesis":
            applyLegendaryTheme("Photosynthesis");
            const photoInterval = setInterval(() => {
                gameMechanics.health = Math.min(gameMechanics.healthMax, gameMechanics.health + 1);
            }, 10000);
            gameMechanics.scoreMultiplier *= 0.85;
            break;

        case "Ultra Omega Extreme Demon":
            applyLegendaryTheme("Ultra Omega Extreme Demon");
            const checkDemon = setInterval(() => {
                if (gameMechanics.accuracy > 95) {
                    gameMechanics.scoreMultiplier = 2;
                } else {
                    gameMechanics.scoreMultiplier = 1;
                }
            }, 500);

            activeBuff.onMistake = () => {
                timeLeft = Math.floor(timeLeft / 2);
                clearInterval(checkDemon);
            };
            break;

        case "Hello Everybody":
            applyLegendaryTheme("Hello Everybody");
            const helloStart = Date.now();
            let helloBoostActive = true;

            gameMechanics.wpm *= 1.2;

            const helloInterval = setInterval(() => {
                const elapsed = (Date.now() - helloStart) / 1000;
                if (elapsed > 10 && helloBoostActive) {
                    helloBoostActive = false;
                    gameMechanics.wpm /= 1.2;
                    clearInterval(helloInterval);
                    timerInterval && clearInterval(timerInterval);
                    timerInterval = setInterval(() => {
                        timeLeft -= 1.1; // drain 10% faster
                        document.getElementById("timer").textContent = Math.max(0, timeLeft);
                    }, 1000);
                }
            }, 1000);
            break;

        default:
            console.log("Buff loaded:", buff.name);
            break;
    }
}



// Themes for legandary buffs


const legendaryThemes = {
    "Made in Heaven": {
        background: "radial-gradient(circle, #000 0%, #111 100%)",
        filter: "grayscale(100%) contrast(1.3)",
        music: "assets/audio/Crucified.mp3", animation: "wordStorm",
    },
    "Makoto": {
        background: "linear-gradient(180deg, #001736 0%, #00183e 60%, #00bbfa 100%)",
        filter: "saturate(1.2) brightness(1.1)",
        music: "assets/audio/Mass Destruction.mp3",
        animation: "frogParticles",
        accent: "#79d7fd"
    },

};

let currentTheme = null;
let themeAudio = null;
let themeAnimationEl = null;

function applyLegendaryTheme(buffName) {
    const theme = legendaryThemes[buffName];
    if (!theme) return;

    currentTheme = buffName;

    document.body.style.background = theme.background;
    document.body.style.filter = theme.filter;
    document.body.style.transition = "all 0.8s ease";

    if (buffName === "Makoto") {
        document.documentElement.style.setProperty("--accent-color", "#00bbfa"); document.documentElement.style.setProperty("--text-color", "#79d7fd"); document.documentElement.style.setProperty("--bg-color", "#001736"); document.documentElement.style.setProperty("--secondary-bg", "#00183e");
        document.querySelectorAll("*").forEach(el => {
            el.style.color = "#79d7fd";
        });
    }

    if (buffName === "Made in Heaven") {
        document.documentElement.style.setProperty("--accent-color", "#fff");
        document.documentElement.style.setProperty("--text-color", "#fff");
        document.documentElement.style.setProperty("--bg-color", "#000");
    }

    startLegendaryAnimation(theme.animation);

    if (theme.music) {
        themeAudio = new Audio(theme.music);
        themeAudio.volume = 0.5;
        themeAudio.loop = true;
        themeAudio.play().catch(e => console.warn("Music autoplay blocked"));
    }

    console.log(`✨ Legendary theme applied: ${buffName}`);
}

function revertLegendaryTheme() {
    if (themeAudio) {
        themeAudio.pause();
        themeAudio = null;
    }

    if (themeAnimationEl) {
        themeAnimationEl.remove();
        themeAnimationEl = null;
    }

    document.body.style.background = "";
    document.body.style.filter = "";
    document.body.style.transition = "";

    currentTheme = null;

    console.log("🕊️ Legendary theme reverted");
}

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

    const style = document.createElement("style");
    style.textContent = `
        @keyframes wordFly {
            from { transform: translateY(100vh) scale(0.5); opacity: 0.8; }
            to { transform: translateY(-100vh) scale(2); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

function createFrogParticles(container) {
    const stripeLayer = document.createElement("div");
    stripeLayer.classList.add("makoto-bg");
    container.appendChild(stripeLayer);

    const frogColors = ["#79d7fd", "#00bbfa", "#008ccf"];
    const frogs = [];
    const frogCount = 60;
    for (let i = 0; i < frogCount; i++) {
        const frog = document.createElement("div");
        frog.textContent = "";
        frog.style.position = "absolute";
        frog.style.left = `${Math.random() * 100}vw`;
        frog.style.top = `${Math.random() * 100}vh`;
        frog.style.fontSize = `${18 + Math.random() * 14}px`;
        frog.style.opacity = 0.85;
        frog.style.transition = "transform 1s ease, filter 0.6s ease, opacity 0.6s ease";
        frog.style.filter = `drop-shadow(0 0 10px ${frogColors[Math.floor(Math.random() * frogColors.length)]
            })`;
        container.appendChild(frog);
        frogs.push(frog);
    }

    setInterval(() => {
        frogs.forEach(frog => {
            const moveX = (Math.random() - 0.5) * 40;
            const moveY = (Math.random() - 0.5) * 40;
            const rotate = (Math.random() - 0.5) * 30;

            frog.style.transform = `translate(${moveX}px, ${moveY}px) rotate(${rotate}deg) scale(${1 + Math.random() * 0.4
                })`;
            frog.style.opacity = 0.7 + Math.random() * 0.3;
            frog.style.filter = `drop-shadow(0 0 ${8 + Math.random() * 12}px ${frogColors[Math.floor(Math.random() * frogColors.length)]
                })`;
        });
    }, 600);
}



