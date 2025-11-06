 let gameStarted = false;
    let timeLeft = 30;
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

    const keyMap = new Map();

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
      const timerEl = document.getElementById("timer");
      timerEl.textContent = timeLeft;
      
      timerInterval = setInterval(() => {
        timeLeft--;
        timerEl.textContent = timeLeft;
        
        const elapsed = (Date.now() - startTime) / 1000 / 60;
        const currentWpm = elapsed > 0 ? Math.round((typedText.length / 5) / elapsed) : 0;
        wpmHistory.push(currentWpm);
        timeHistory.push(Math.round(elapsed * 60));
        
        if (timeLeft <= 0) {
          clearInterval(timerInterval);
          evaluatePerformance();
        }
      }, 1000);
    }

    async function fetchParagraph() {
      const difficulty = parseInt(document.getElementById('difficulty').value);
      timeLeft = difficulty;
      
      try {
        const res = await fetch("https://en.wikipedia.org/api/rest_v1/page/random/summary");
        const data = await res.json();
        originalText = data.extract.replace(/\s+/g, ' ').trim().substring(0, 300);
      } catch (error) {
        originalText = "the quick brown fox jumps over the lazy dog this is a fallback text for typing practice when the api is unavailable keep practicing to improve your typing speed and accuracy with consistent effort you will see improvement";
      }
      
      typedText = "";
      gameStarted = true;
      keyPressCount = 0;
      correctKeys = 0;
      
      document.getElementById("message").classList.add("hidden");
      startTimer();
      updateDisplay();
      updateStats();
    }

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

    function updateStats() {
      const elapsed = (Date.now() - startTime) / 1000 / 60;
      const wpm = elapsed > 0 ? Math.round((typedText.length / 5) / elapsed) : 0;
      
      let correct = 0;
      for (let i = 0; i < typedText.length && i < originalText.length; i++) {
        if (typedText[i] === originalText[i]) correct++;
      }
      const accuracy = typedText.length > 0 ? Math.round((correct / typedText.length) * 100) : 100;
      
      document.getElementById("wpm-display").textContent = wpm;
      document.getElementById("accuracy-display").textContent = accuracy + "%";
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
            legend: {
              display: false
            },
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
              grid: {
                color: '#3a3c3f',
                drawBorder: false
              },
              ticks: {
                color: '#646669',
                font: {
                  family: 'Roboto Mono',
                  size: 11
                }
              },
              title: {
                display: true,
                text: 'time (seconds)',
                color: '#646669',
                font: {
                  family: 'Roboto Mono',
                  size: 12
                }
              }
            },
            y: {
              grid: {
                color: '#3a3c3f',
                drawBorder: false
              },
              ticks: {
                color: '#646669',
                font: {
                  family: 'Roboto Mono',
                  size: 11
                }
              },
              title: {
                display: true,
                text: 'words per minute',
                color: '#646669',
                font: {
                  family: 'Roboto Mono',
                  size: 12
                }
              },
              beginAtZero: true
            }
          }
        }
      });
    }

    function evaluatePerformance() {
      clearInterval(timerInterval);
      
      let correct = 0;
      const minLength = Math.min(typedText.length, originalText.length);
      for (let i = 0; i < minLength; i++) {
        if (typedText[i] === originalText[i]) correct++;
      }
      
      const accuracy = minLength > 0 ? Math.round((correct / minLength) * 100) : 0;
      const totalTime = parseInt(document.getElementById('difficulty').value);
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
      document.getElementById("final-chars").textContent = `${typedText.length}/${originalText.length}`;
      
      createWpmChart(wpmHistory, timeHistory);
      
      document.getElementById("message").classList.remove("hidden");
    }

    function closeMessage() {
      document.getElementById("message").classList.add("hidden");
      document.getElementById("mid").innerHTML = `<div class="text-[#646669]">press <span class="text-[#e2b714]">ctrl</span> to start</div>`;
      gameStarted = false;
      updateStats();
    }

    document.addEventListener("keydown", e => {
      highlightKey(e.key);
      
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
        
        typedText += e.key;
        keyPressCount++;
        
        if (isCorrect) {
          correctKeys++;
          highlightKey(e.key, true);
          playSound('correct');
        } else {
          highlightKey(e.key, false);
          playSound('incorrect');
        }
        
        updateDisplay();
        
        if (typedText.length >= originalText.length) {
          evaluatePerformance();
        }
      }
    });

    document.getElementById('sound-toggle').addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      const btn = document.getElementById('sound-toggle');
      btn.style.opacity = soundEnabled ? '1' : '0.3';
    });

    document.getElementById('difficulty').addEventListener('change', () => {
      if (!gameStarted) {
        timeLeft = parseInt(document.getElementById('difficulty').value);
        document.getElementById('timer').textContent = timeLeft;
      }
    });

    document.addEventListener('DOMContentLoaded', () => {
      initKeyboardMapping();
    });
