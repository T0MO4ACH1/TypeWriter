const options = document.querySelectorAll('.option');
const loading = document.getElementById('loading');

options.forEach(option => {
  option.addEventListener('click', () => {
    options.forEach(o => o.classList.remove('selected'));
    option.classList.add('selected');

    const file = option.getAttribute('data-file');
    localStorage.setItem('selectedRound', file);

    // loading overlay
    loading.classList.add('active');

    setTimeout(() => {
      window.location.href = '../Gameplay/game.html';
    }, 2000); // delay
  });
});
