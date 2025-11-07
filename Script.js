const playBtn = document.getElementById('playBtn');
const quitBtn = document.getElementById('quitBtn');

quitBtn.addEventListener('click', () => {
    // Attempt to close window if allowed, otherwise give feedback
    if (window.confirm('Quit application?')) {
        try { window.close(); } catch (e) { /* ignore */ }

        alert('If this were a packaged app, it would close now.');
    }
});

// keyboard accessibility: 1 = Play, 2 = Contributors, 3 = Quit
window.addEventListener('keydown', (e) => {
    if (e.key === '1') playBtn.click();
    if (e.key === '2') contributorsBtn.click();
    if (e.key === '3') quitBtn.click();
    if (e.key === 'Escape') {
        
        
        document.activeElement?.blur?.();
    }
});