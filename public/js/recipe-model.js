'use strict';
(function (root) {
    const ingredients = Object.freeze({
        lemon: ['檸檬', 'freshness'], honey: ['蜂蜜', 'sweetness'], ginger: ['薑汁', 'richness'],
        lavender: ['薰衣草', 'naturalness'], mint: ['薄荷', 'aftertaste'], vanilla: ['香草', 'sweetness'],
        cinnamon: ['肉桂', 'richness'], orange: ['柳橙', 'freshness'], rose: ['玫瑰', 'naturalness'],
        chamomile: ['洋甘菊', 'aftertaste'], cranberry: ['蔓越莓', 'freshness'], goji: ['枸杞', 'naturalness'],
    });
    function calculate(input) {
        const extras = (Array.isArray(input) ? input : []).filter(e => e && typeof e.name === 'string' && Object.hasOwn(ingredients, e.name)).slice(0, 5);
        const stats = { freshness: 0, richness: 6, sweetness: 0, naturalness: 3, aftertaste: 5 };
        const elements = [{ name: 'fishessence', display: '鱸魚精', percentage: 50, isBase: true }];
        const proportions = { '鱸魚精': 50 };
        for (const extra of extras) {
            const [display, type] = ingredients[extra.name];
            elements.push({ name: extra.name, display, percentage: 10 });
            stats[type] += 2;
            proportions[display] = (proportions[display] || 0) + 10;
        }
        const filled = 50 + extras.length * 10;
        if (filled < 100) proportions['未配置'] = 100 - filled;
        return { elements, stats, proportions, filled };
    }
    const model = { calculate };
    if (typeof module !== 'undefined' && module.exports) module.exports = model;
    else root.RecipeModel = model;
})(typeof window !== 'undefined' ? window : globalThis);
