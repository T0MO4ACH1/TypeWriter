// ---- Buff data ----

const buffs = [
    { name: "Made in Heaven", rarity: "legendary", price: 300, description: "Accelerates the timer backwards, it can go into negative seconds", reference: "I'm going to obtain the way to Heaven!", icon: "fa-solid fa-gem" },
    { name: "Makoto", rarity: "legendary", price: 300, description: "Regenerates health per word correct", reference: "Mass destruction", icon: "fa-solid fa-heart" },
    { name: "Just Vibe", rarity: "legendary", price: 300, description: "Just Vibe (Careful, if you have eplipsy, or cannot handle brightness)", reference: "Levan Pollka", icon: "fa-solid fa-music" },

    { name: "Sam Howell", rarity: "rare", price: 250, description: "1 in 200 chance of auto-typing the paragraph", reference: "Secure, Contain, Protect", icon: "fa-solid fa-shield" },
    { name: "Jack the Ripper", rarity: "rare", price: 250, description: "Every 6 words typed, -6 health but +6 timer", reference: "Whitechapel", icon: "fa-solid fa-bolt" },
    { name: "Adam", rarity: "rare", price: 250, description: "Per 6 words typed, increase your health by +5", reference: "The Beginning", icon: "fa-solid fa-plus" },
    { name: "Plague", rarity: "rare", price: 250, description: "Lose 10 health for every 5 words typed, however increase the timer by 10s", reference: "Plague.INC", icon: "fa-solid fa-virus" },
    { name: "AC130", rarity: "rare", price: 250, description: "Destroy 10 words from any given paragraph", reference: "Enemy AC130 above!", icon: "fa-solid fa-fighter-jet" },
    { name: "Excalibur", rarity: "rare", price: 250, description: "Gives +50 health permanently", reference: "Excalibaaaaaaaaaaaaaaaaa!!!", icon: "fa-solid fa-knife" },
    { name: "El Drago", rarity: "rare", price: 250, description: "If every 10 letters are correct in a row, +5 letters autofill, missing will refresh this counter.", reference: "Ryuga!", icon: "fa-solid fa-dragon" },

    { name: "Eve", rarity: "common", price: 100, description: "Increase permanent timer by +5s", reference: "The Beginning", icon: "fa-solid fa-clock" },
    { name: "Lion", rarity: "common", price: 100, description: "Increase health by +10", reference: "King of the jungle", icon: "fa-solid fa-paw" },
    { name: "Jason Vorhees", rarity: "common", price: 100, description: "Increase damage reduction", reference: "It's Friday the 13th", icon: "fa-solid fa-mask" },
    { name: "Pinocchio", rarity: "common", price: 100, description: "Per word wrong, decrease health by increased amount, but increases time as per damage taken", reference: "NO LIES", icon: "fa-solid fa-theater-masks" },
    { name: "Percy Jackson", rarity: "common", price: 100, description: "Increase the amount of coins received by 20 at the end of the round", reference: "Half-Human, Half-God", icon: "fa-solid fa-water" },
    { name: "Just a Poor Boy", rarity: "common", price: 100, description: "Decrease the amount of coins received by 10% but Health permanently increased by 20%", reference: "I'm just a poor boy, I need no sympathy", icon: "fa-solid fa-music" },
    { name: "Pablo", rarity: "common", price: 100, description: "Increase the timer by +10 seconds when health is below 50%", reference: "Is it a plane? No, Its Pablo", icon: "fa-solid fa-plane" },
    { name: "Song Gi-hun", rarity: "common", price: 100, description: "After 3 rounds receive +100 coins", reference: "I've played these games before!!!!", icon: "fa-solid fa-gamepad" },
    { name: "Jimbo", rarity: "common", price: 100, description: "+4 health and +4s timer permanently", reference: "Multiple of chips", icon: "fa-solid fa-plus-circle" },
    { name: "Bing-Chilling", rarity: "common", price: 100, description: "Freeze the timer at the start of the round for 5s", reference: "Bing-Chilling", icon: "fa-solid fa-snowflake" },
    { name: "Freddy", rarity: "common", price: 100, description: "At the start of the round -10 health, but +15s	.", reference: "Arr-Arr-Ar-Arr", icon: "fa-solid fa-otter" },

    { name: "Lelouch", rarity: "uncommon", price: 180, description: "For the first 15s, gain +50% score multiplier, but every mistake permanently reduces accuracy gain by 5%", reference: "I, Lelouch vi Britannia, command you!", icon: "fa-solid fa-crown" },
    { name: "Enriqueee", rarity: "uncommon", price: 150, description: "Each correct word increases WPM by +2 temporarily, but every 3rd word typed removes 1s from timer", reference: "ENRIIIIQUEEEE!", icon: "fa-solid fa-person-running" },
    { name: "Dark Psychology", rarity: "uncommon", price: 170, description: "Gain +15 accuracy baseline, but every 5th mistake drains -10 health and laughs at you internally", reference: "I KNEW DARK PSYCHOLOGY AT AGE 9!", icon: "fa-solid fa-mask" },
    { name: "Dream On", rarity: "uncommon", price: 160, description: "At 30s left, timer freezes for 5s — however, during that time you cannot gain score or health", reference: "Dream until your dreams come true.", icon: "fa-solid fa-moon" },
    { name: "Thick of It", rarity: "uncommon", price: 150, description: "At half health, increase score multiplier by +30%, but timer drains 25% faster", reference: "In the thick of it, Everybody Knows.", icon: "fa-solid fa-wave-square" },
    { name: "Photosynthesis", rarity: "uncommon", price: 170, description: "Gain +1 health for every 10s of sunlight (time passed), but score gain slows by 15%", reference: "It's just Plants vs. Zombies, bro.", icon: "fa-solid fa-seedling" },
    { name: "Ultra Omega Extreme Demon", rarity: "uncommon", price: 180, description: "Double score multiplier while accuracy >95%, but missing even once cuts your timer in half", reference: "ultra omega extreme crazy universal extreme demon.", icon: "fa-solid fa-fire-flame-curved" },
    { name: "Hello Everybody", rarity: "uncommon", price: 160, description: "First 10s of the round grant +20% WPM boost, but the rest of the timer runs 10% faster", reference: "Hello everybody, my name is Welcome!", icon: "fa-solid fa-microphone" },

];

let coins = 0;
const coinsEl = document.getElementById('coins');

const savedCoins = localStorage.getItem('playerCoins');
if (savedCoins !== null) {
    coins = parseInt(savedCoins, 10) || 0;
} else {
    // for new players
    localStorage.setItem('playerCoins', '0');
}
if (coinsEl) coinsEl.textContent = coins;


// ---- rarity config & colors ----
const rarityConfig = {

    legendary: { weight: 0.690, class: 'rar-legendary', colorVar: '--purple' }, 
    rare: { weight: 0.05, class: 'rar-rare', colorVar: '--red' }, 
    uncommon: { weight: 0.25, class: 'rar-uncommon', colorVar: '--green' }, 
    common: { weight: 0.010, class: 'rar-common', colorVar: '--blue' } 
};


const buffsByRarity = buffs.reduce((acc, b) => {
    acc[b.rarity] = acc[b.rarity] || [];
    acc[b.rarity].push(b);
    return acc;
}, {});

function getAvailableRarityWeights() {
    const available = {};
    let total = 0;
    for (const r in rarityConfig) {
        if ((buffsByRarity[r] || []).length > 0) {
            available[r] = rarityConfig[r].weight;
            total += rarityConfig[r].weight;
        }
    }
    // normalize to sum to 1
    for (const r in available) available[r] = available[r] / total;
    return available;
}

function sampleRarity() {
    const weights = getAvailableRarityWeights();
    const rnd = Math.random();
    let acc = 0;
    for (const r of Object.keys(weights)) {
        acc += weights[r];
        if (rnd <= acc) return r;
    }
    // fallback
    return Object.keys(weights)[0];
}

function pickRandomBuff() {
    let tries = 0;
    while (tries < 6) {
        tries++;
        const rarity = sampleRarity();
        const pool = buffsByRarity[rarity] || [];
        if (pool.length === 0) continue;
        const idx = Math.floor(Math.random() * pool.length);
        return pool[idx];
    }
    // absolute fallback (for buffs)
    return buffs[Math.floor(Math.random() * buffs.length)];
}

function generateOffers(n = 3) {
    const offers = [];
    const used = new Set();
    let attempts = 0;
    while (offers.length < n && attempts < 30) {
        attempts++;
        const candidate = pickRandomBuff();
        const key = candidate.name + '|' + candidate.rarity;
        if (used.has(key)) continue;
        used.add(key);
        offers.push(candidate);
    }
    return offers;
}

// render cards
const cardsContainer = document.getElementById('cardsContainer');

function renderOffers(offers) {
    coinsEl.textContent = coins;
    cardsContainer.innerHTML = '';
    offers.forEach((b, i) => {
        const card = document.createElement('div');
        card.className = 'buff-card fade-in';
        if (b.rarity === 'legendary') card.classList.add('legendary-glow');

        const top = document.createElement('div');
        top.className = 'buff-top';

        const left = document.createElement('div');
        left.className = 'buff-left';

        const iconWrap = document.createElement('div');
        iconWrap.className = 'buff-icon';
        iconWrap.innerHTML = `<i class="${b.icon}"></i>`;

        const nameWrap = document.createElement('div');
        nameWrap.innerHTML = `<div class="buff-name">${b.name}</div><div style="font-size:0.86rem;color:var(--muted)">${b.reference || ''}</div>`;

        left.appendChild(iconWrap);
        left.appendChild(nameWrap);

        const raritySpan = document.createElement('div');
        raritySpan.className = 'rarity-pill ' + (rarityConfig[b.rarity]?.class || '');
        raritySpan.textContent = b.rarity.toUpperCase();

        top.appendChild(left);
        top.appendChild(raritySpan);

        const desc = document.createElement('div');
        desc.className = 'buff-desc';
        desc.textContent = b.description;

        const foot = document.createElement('div');
        foot.className = 'buff-foot';

        const price = document.createElement('div');
        price.className = 'price-pill';
        price.innerHTML = `<i class="fas fa-coins"></i> ${b.price}`;

        const buyBtn = document.createElement('button');
        buyBtn.className = 'buy-btn';
        buyBtn.textContent = 'Buy';
        buyBtn.title = 'Buy this buff';

        // Own check
        const ownedKey = 'owned::' + b.name;
        if (localStorage.getItem(ownedKey) === '1') {
            buyBtn.disabled = true;
            buyBtn.textContent = 'Owned';
            price.style.opacity = '0.6';
        }

        buyBtn.addEventListener('click', () => {
            if (localStorage.getItem(ownedKey) === '1') return;
            if (coins < b.price) {
                // feedback
                buyBtn.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-6px)' }, { transform: 'translateY(0)' }], { duration: 240 });
                return;
            }
            coins -= b.price;
            localStorage.setItem(ownedKey, '1');
            coinsEl.textContent = coins;
            buyBtn.disabled = true;
            buyBtn.textContent = 'Owned';
            // Equip this buff immediately
            localStorage.setItem('equippedBuff', JSON.stringify(b));

        });

        foot.appendChild(price);
        foot.appendChild(buyBtn);

        card.appendChild(top);
        card.appendChild(desc);
        card.appendChild(foot);

        cardsContainer.appendChild(card);
    });
}

// initial load
function initShop() {
    const offers = generateOffers(3);
    renderOffers(offers);
}

document.getElementById('refreshBtn').addEventListener('click', () => {
    const btn = document.getElementById('refreshBtn');
    btn.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(8deg)' }, { transform: 'rotate(0deg)' }], { duration: 280 });
    const newOffers = generateOffers(3);
    renderOffers(newOffers);
});



// initialize
initShop();
