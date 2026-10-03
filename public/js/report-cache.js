'use strict';
(function (root) {
    const storageKey = 'fishRagReport.v2';
    function create(storage, identity, elements) {
        // Sorting preserves duplicates (and thus ratios) while ignoring drag order.
        const key = JSON.stringify([identity, [...elements].sort()]);
        let sections = {};
        try {
            const saved = JSON.parse(storage.getItem(storageKey) || 'null');
            if (saved?.key === key && saved.sections && typeof saved.sections === 'object') sections = saved.sections;
        } catch { /* Corrupt/unavailable storage must not break the report. */ }
        const pending = new Map();
        function save() {
            try { storage.setItem(storageKey, JSON.stringify({ key, sections })); } catch { /* Keep in-memory results when storage is full. */ }
        }
        save(); // Invalidate the previous recipe even before the first request completes.
        function valid(data) {
            return data && typeof data.answer === 'string' && typeof data.insufficient_evidence === 'boolean'
                && Array.isArray(data.sources) && Array.isArray(data.recommended_elements);
        }
        return {
            peek(section) { return Object.hasOwn(sections, section) && valid(sections[section]) ? sections[section] : null; },
            async get(section, request) {
                if (this.peek(section)) return sections[section];
                if (pending.has(section)) return pending.get(section);
                const work = (async () => {
                    const data = await request();
                    if (valid(data)) { sections[section] = data; save(); }
                    return data;
                })();
                pending.set(section, work);
                try { return await work; } finally { pending.delete(section); }
            },
        };
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = { create };
    else root.ReportCache = { create };
})(typeof window !== 'undefined' ? window : globalThis);
