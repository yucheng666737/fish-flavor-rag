'use strict';
document.addEventListener('DOMContentLoaded', () => {
    let stored;
    try { stored = JSON.parse(localStorage.getItem('selectedElements') || '[]'); } catch { stored = []; }
    const identities = { pregnant: '孕婦', office: '上班族', elderly: '銀髮族', beauty: '美妝族群', fitness: '健身族', custom: '自由設計' };
    const chosen = localStorage.getItem('selectedIdentity');
    const identity = Object.hasOwn(identities, chosen) ? chosen : 'custom';
    const recipe = RecipeModel.calculate(stored, identity);
    if (!recipe.elements.length) { window.location.replace('flavor.html'); return; }
    document.getElementById('reportIdentity').textContent = identities[identity];
    document.getElementById('backToFlavor').addEventListener('click', () => { window.location.href = 'flavor.html'; });
    document.getElementById('finishExperience').addEventListener('click', () => { window.location.href = 'share.html'; });
    const liquid = document.querySelector('#reportBottle .bottle-liquid');
    if (liquid) {
        liquid.style.height = `${recipe.filled * .9}%`;
        liquid.style.backgroundColor = '#d8ae67';
    }
    const label = document.querySelector('#reportBottle .bottle-label');
    if (label) { label.textContent = `${recipe.filled}% 已配置`; label.style.opacity = '1'; }
    const details = document.getElementById('nutritionDetails');
    details.replaceChildren(RagClient.node('h3', '設計比例'));
    const list = RagClient.node('ul');
    for (const [name, percent] of Object.entries(recipe.proportions)) list.append(RagClient.node('li', `${name}：${percent}%`));
    details.append(list, RagClient.node('p', '比例來自網站中的選擇；不是實際商品含量、食用克數或營養標示。'));
    if (typeof Chart !== 'undefined') {
        new Chart(document.getElementById('radarChart'), {
            type: 'radar',
            data: { labels: ['清新感', '濃郁度', '甘甜度', '天然感', '後韻持久度'], datasets: [{ label: '風味設計指標', data: Object.values(recipe.stats), borderColor: '#cb8439', backgroundColor: '#e6ad5233', pointBackgroundColor: '#8b693e' }] },
            options: { responsive: true, scales: { r: { min: 0, max: Math.max(10, ...Object.values(recipe.stats)), ticks: { stepSize: 2 } } } },
        });
        new Chart(document.getElementById('nutritionChart'), {
            type: 'doughnut',
            data: { labels: Object.keys(recipe.proportions), datasets: [{ data: Object.values(recipe.proportions), backgroundColor: ['#d8ae67', '#88ad86', '#ddc577', '#bfa0b7', '#d69a7c', '#84a9ba', '#ece5dc'] }] },
            options: { responsive: true, plugins: { tooltip: { callbacks: { label: ctx => `${ctx.label}：${ctx.raw}%` } } } },
        });
    } else {
        details.append(RagClient.node('p', '圖表資源載入失敗；上方文字比例仍可查看。'));
    }
    const elements = recipe.elements.map(e => e.name);
    const report = ReportCache.create(localStorage, identity, elements);
    // Queue only missing sections; successful sections survive navigation and refresh.
    async function loadSections() {
        const sections = [
            ['tasteDescription', 'flavor', 'AI風味建議'],
            ['nutritionReference', 'nutrition', '您的食材營養參考'],
            ['usageSuggestions', 'usage', '飲用與保存提醒'],
        ];
        for (const [id, section, title] of sections) {
            const container = document.getElementById(id);
            const cached = report.peek(section);
            if (cached) {
                RagClient.render(container, cached, { title, showRecommendations: false });
                continue;
            }
            container.textContent = section === 'nutrition' ? '正在評估營養元素…' : '正在用 AI 生成建議…';
            try {
                const data = await report.get(section, () => RagClient.ask({ identity, elements, section }));
                RagClient.render(container, data, { title, showRecommendations: false });
            } catch (error) { RagClient.showError(container, error); }
        }
    }
    loadSections();
});
