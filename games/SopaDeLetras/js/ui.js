const la_ws_ui = {
    showScreen: (screenId) => {
        document.querySelectorAll('.la-ws-screen').forEach(s => s.classList.add('la-ws-hidden'));
        document.getElementById(screenId).classList.remove('la-ws-hidden');
    },

    renderLevelList: (levels, onSelect) => {
        const container = document.getElementById('la_ws_levels_grid');
        container.innerHTML = '';
        const paidLevels = la_ws_rewards.getPaidLevels();

        levels.forEach(lvl => {
            const btn = document.createElement('div');
            btn.className = `la-ws-level-card ${paidLevels.includes(lvl.id) ? 'completed' : ''}`;
            btn.innerHTML = `<div>${lvl.title}</div><small>${lvl.rewardCoins} 💰</small>`;
            btn.onclick = () => onSelect(lvl);
            container.appendChild(btn);
        });
    },

    updateWordList: (words, found) => {
        const list = document.getElementById('la_ws_word_list');
        list.innerHTML = words.map(w => 
            `<li class="${found.includes(w) ? 'la-ws-word--found' : ''}">${w}</li>`
        ).join('');
    }
};
