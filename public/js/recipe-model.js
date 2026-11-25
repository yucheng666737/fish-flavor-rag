'use strict';
(function (root) {
    const ingredients = Object.freeze({
        lemon: ['檸檬', 'freshness'], honey: ['蜂蜜', 'sweetness'], ginger: ['薑汁', 'richness'],
        lavender: ['薰衣草', 'naturalness'], mint: ['薄荷', 'aftertaste'], vanilla: ['香草', 'sweetness'],
        cinnamon: ['肉桂', 'richness'], orange: ['柳橙', 'freshness'], rose: ['玫瑰', 'naturalness'],
        chamomile: ['洋甘菊', 'aftertaste'], cranberry: ['蔓越莓', 'freshness'], goji: ['枸杞', 'naturalness'],
    });
    const recommendations = Object.freeze({
        pregnant: ['ginger', 'honey'], office: ['mint', 'orange'], elderly: ['ginger', 'lavender'],
        beauty: ['rose', 'honey'], fitness: ['ginger', 'lemon'], custom: [],
    });
    function calculate(input, identity) {
        const hasBase = identity !== 'custom';
        const extras = (Array.isArray(input) ? input : []).filter(e => e && typeof e.name === 'string' && Object.hasOwn(ingredients, e.name)).slice(0, hasBase ? 5 : 10);
        const stats = { freshness: 0, richness: hasBase ? 6 : 0, sweetness: 0, naturalness: hasBase ? 3 : 0, aftertaste: hasBase ? 5 : 0 };
        const elements = hasBase ? [{ name: 'fishessence', display: '鱸魚精', percentage: 50, isBase: true }] : [];
        const proportions = hasBase ? { '鱸魚精': 50 } : {};
        for (const extra of extras) {
            const [display, type] = ingredients[extra.name];
            elements.push({ name: extra.name, display, percentage: 10 });
            stats[type] += 2;
            proportions[display] = (proportions[display] || 0) + 10;
        }
        const filled = (hasBase ? 50 : 0) + extras.length * 10;
        if (filled < 100) proportions['未配置'] = 100 - filled;
        return { elements, stats, proportions, filled };
    }
    const model = { calculate, recommendations, ingredients };
    if (typeof module !== 'undefined' && module.exports) module.exports = model;
    else root.RecipeModel = model;
})(typeof window !== 'undefined' ? window : globalThis);
