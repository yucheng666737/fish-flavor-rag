'use strict';
document.addEventListener('DOMContentLoaded', async () => {
    const status = document.getElementById('ragStatus');
    try {
        const data = await (await fetch('/api/health')).json();
        status.textContent = data.status === 'ready'
            ? `${data.files} 份文件、${data.chunks} 個片段已建立索引。設定已就緒，送出問題可驗證實際 API。`
            : `尚待設定：${data.message} 金鑰：${data.api_key_configured ? '已設定' : '未設定'}。`;
    } catch { status.textContent = '無法連線至服務，請使用 npm start 提供的網址。'; }
    const form = document.getElementById('ragForm');
    const result = document.getElementById('ragResult');
    const submit = document.getElementById('askButton');
    const query = document.getElementById('ragQuery');
    document.querySelectorAll('[data-question]').forEach(button => button.addEventListener('click', () => {
        query.value = button.dataset.question;
        query.focus();
    }));
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!query.value.trim()) return;
        submit.disabled = true;
        result.textContent = '正在用 AI 生成回答…';
        try { RagClient.render(result, await RagClient.ask({ query: query.value }, { endpoint: '/api/rag' })); }
        catch (error) { RagClient.showError(result, error); }
        finally { submit.disabled = false; }
    });
});
