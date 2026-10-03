'use strict';
window.RagClient = (() => {
    function node(tag, text, className) {
        const el = document.createElement(tag);
        if (text !== undefined) el.textContent = text;
        if (className) el.className = className;
        return el;
    }
    async function ask(payload, { signal, endpoint = '/api/rag-recommend' } = {}) {
        const response = await fetch(endpoint, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload), signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || '無法取得回答，請稍後重試。');
        return data;
    }
    function render(container, data, { title = 'AI風味建議', showRecommendations = true } = {}) {
        const sources = data.sources || [];
        const sourceIds = new Set(sources.map(source => source.id));
        function readableText(value) {
            let text = String(value || '');
            text = text.replace(/&(?:#x0*20|#0*32|nbsp);/gi, ' ');
            // Models may emit either ASCII or full-width brackets. Internal IDs remain API metadata only.
            text = text.replace(/[\[【]([^\]】]+)[\]】]/g, (match, content) => {
                const ids = content.split(/[,，、;；\s]+/).filter(Boolean);
                return ids.length && ids.every(id => sourceIds.has(id) || /^[a-f0-9]{24}$/i.test(id)) ? '' : match;
            });
            for (const id of sourceIds) text = text.replaceAll(id, '');
            return text.replace(/[ \t]+([，。、；：！？])/g, '$1').replace(/\n{3,}/g, '\n\n').trim();
        }
        container.replaceChildren();
        container.append(node('h3', data.insufficient_evidence ? '文件資料不足' : title));
        container.append(node('p', readableText(data.answer), 'rag-answer'));
        if (showRecommendations && data.recommended_elements?.length) {
            container.append(node('h4', '下一步推薦風味'));
            const list = node('ul');
            for (const item of data.recommended_elements) {
                list.append(node('li', readableText(`${item.element}：${item.reason}`)));
            }
            container.append(list);
        }
        container.append(node('small', '依知識文件整理的設計與食材參考，不是本配方的營養檢測或醫療建議。'));
    }
    function showError(container, error) {
        container.replaceChildren(node('h3', '目前無法取得文件回答'), node('p', error.message));
        const link = node('a', '查看 RAG 設定狀態與問答');
        link.href = 'rag.html';
        container.append(link);
    }
    let flavorRequest;
    async function recommendFlavor(elementName, elementText, identity) {
        const container = document.getElementById('personalizedTips');
        if (!container) return;
        flavorRequest?.abort();
        const request = new AbortController();
        flavorRequest = request;
        container.replaceChildren(node('h3', `正在用 AI 生成「${elementText}」的風味建議…`));
        try {
            const data = await ask({ identity, elementName }, { signal: request.signal });
            if (flavorRequest === request) render(container, data);
        } catch (error) {
            if (error.name !== 'AbortError' && flavorRequest === request) showError(container, error);
        }
    }
    return { ask, render, showError, recommendFlavor, node };
})();
