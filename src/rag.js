'use strict';
const { retrieve } = require('./store');
const { AppError } = require('./errors');
const { hasSecret } = require('./corpus');
const INGREDIENTS = Object.freeze({ fishessence: '鱸魚精', lemon: '檸檬', honey: '蜂蜜', ginger: '薑汁', lavender: '薰衣草', mint: '薄荷', vanilla: '香草', cinnamon: '肉桂', orange: '柳橙', rose: '玫瑰', chamomile: '洋甘菊', cranberry: '蔓越莓', goji: '枸杞' });
const IDENTITIES = new Set(['pregnant', 'office', 'elderly', 'beauty', 'fitness', 'custom']);
function validateQuery(query) {
  if (typeof query !== 'string' || !query.trim() || query.trim().length > 500) throw new AppError('INVALID_QUERY', '問題需為 1 至 500 字的文字。', 400);
  if (hasSecret(query)) throw new AppError('SECRET_IN_QUERY', '問題包含疑似秘密，未傳送至 AI 服務。請移除後再試。', 400);
  return query.trim();
}
function recommendationQuery(body) {
  if (!body || !IDENTITIES.has(body.identity)) throw new AppError('INVALID_IDENTITY', '請選擇有效的使用者族群。', 400);
  const elements = body.elements === undefined ? [body.elementName] : body.elements;
  if (!Array.isArray(elements) || elements.length < 1 || elements.length > (body.identity === 'custom' ? 10 : 6) || elements.some(e => typeof e !== 'string' || !Object.hasOwn(INGREDIENTS, e))) {
    throw new AppError('INVALID_ELEMENTS', '成分數量超出配方限制，或包含未知風味。', 400);
  }
  if (body.section !== undefined && !['flavor', 'nutrition', 'usage'].includes(body.section)) throw new AppError('INVALID_SECTION', '請選擇有效的報告區塊。', 400);
  const names = [...new Set(elements)].map(e => INGREDIENTS[e]).join('、');
  if (body.section === 'nutrition') return `配方已選食材：${names}。根據營養參考文件，每個已選食材各寫一個短段落「食材：營養特色；來源參考數值」。數值必須保留原料形式及每100克或每100毫升單位；參考商品須寫品牌名稱。花草可只寫食用特色。不要列未選食材，不換算本瓶含量、不推論療效。使用面向消費者的自然文字，不寫本專案、本網站、缺少容量、無商品標示、無法計算等開發說明；結尾只保留一句「原料與參考商品數據，非本配方實測值」。recommended_elements 留空。`;
  if (body.section === 'usage') return `配方已選食材：${names}。根據飲用建議文件，分段提供飲用情境、溫熱方式、保存方法與已選食材注意事項。寫出可操作的建議，不寫本專案、本網站、未提供容量等開發說明。僅使用文件支持的方式，不套用其他品牌的固定劑量、每日次數、加熱秒數或保存天數。不要帶入未選食材，不推論療效。recommended_elements 留空。`;
  return `根據風味文件，${[...new Set(elements)].map(e => INGREDIENTS[e]).join('、')}的風味特色與搭配建議是什麼？僅描述風味，不推論健康功效。使用者選擇的族群代號：${body.identity}。`;
}
// Called only after recommendationQuery validates the request. Paths are server-owned, never supplied by clients.
function recommendationSources(body) {
  const elements = body.elements === undefined ? [body.elementName] : body.elements;
  if (!body.section && body.elementName && body.elementName !== 'fishessence') return [`${body.elementName}.md`];
  if (body.section === 'usage') return ['usage-general.md', ...(elements.includes('honey') ? ['usage-honey.md'] : [])];
  if (body.section !== 'nutrition') return undefined;
  return ['nutrition-limits.md', ...[...new Set(elements)].map(e => `nutrition-${e === 'fishessence' ? 'fish' : e}.md`)];
}
function validateAnswer(answer, contexts) {
  const fail = () => { throw new AppError('UNGROUNDED_ANSWER', '模型回答缺少有效來源或格式不符，未顯示該回答。', 502); };
  if (!answer || typeof answer.answer !== 'string' || !answer.answer.trim() || answer.answer.length > 6000
    || typeof answer.insufficient_evidence !== 'boolean' || !Array.isArray(answer.citation_ids)
    || !Array.isArray(answer.recommended_elements) || answer.recommended_elements.length > 8) fail();
  const ids = new Set(contexts.map(c => c.id));
  const validIds = values => Array.isArray(values) && values.length <= contexts.length && values.every(v => typeof v === 'string' && ids.has(v));
  if (!validIds(answer.citation_ids)) fail();
  if (answer.insufficient_evidence) {
    if (answer.citation_ids.length || answer.recommended_elements.length) fail();
  } else if (!answer.citation_ids.length) fail();
  for (const rec of answer.recommended_elements) {
    if (!rec || typeof rec.element !== 'string' || !rec.element || rec.element.length > 80
      || typeof rec.reason !== 'string' || !rec.reason || rec.reason.length > 2000
      || !validIds(rec.citation_ids) || !rec.citation_ids.length) fail();
  }
  const citedInText = [...answer.answer.matchAll(/\[([A-Za-z0-9_-]+)\]/g)].map(m => m[1]);
  if (citedInText.some(id => !answer.citation_ids.includes(id))) fail();
  return answer;
}
async function answerQuestion(config, provider, question, options) {
  const query = validateQuery(question);
  const contexts = await retrieve(config, provider, query, options);
  if (!contexts.length) return {
    answer: '目前知識庫找不到足夠相關的資料，無法根據文件回答這個問題。',
    benefit_description: '目前資料不足。', insufficient_evidence: true,
    recommended_elements: [], citation_ids: [], sources: [], retrieved_count: 0,
  };
  let generated;
  if (options?.extractiveNutrition) {
    // Keep reviewed food forms, units and numbers verbatim; the model must not add health claims.
    const references = contexts.map(c => ({ id: c.id, summary: c.text.match(/^呈現摘要：(.+)$/m)?.[1] })).filter(c => c.summary);
    generated = references.length ? {
      answer: `${references.map(c => c.summary).join('\n\n')}\n\n原料與參考商品數據，非本配方實測值。`,
      insufficient_evidence: false, citation_ids: references.map(c => c.id), recommended_elements: [],
    } : {
      answer: '目前找不到可引用的食材營養參考，請稍後再試。',
      insufficient_evidence: true, citation_ids: [], recommended_elements: [],
    };
  } else generated = await provider.generate(query, contexts);
  // The design page's next-step list comes from the retrieved ingredient document,
  // so its presence and structure do not depend on the model's optional array.
  if (options?.flavorElement && !generated.insufficient_evidence) {
    const doc = contexts.find(c => c.source === `${options.flavorElement}.md`);
    const pairing = doc?.text.match(/## 搭配方向\s*\n([^#]+)/)?.[1] || '';
    const suggestions = pairing.trim().split(/[；。]/).map(s => s.trim()).filter(Boolean).map(reason => {
      const element = Object.values(INGREDIENTS).find(name => reason.startsWith(name));
      return element ? { element, reason: reason.slice(element.length).trim(), citation_ids: [doc.id] } : null;
    }).filter(Boolean);
    if (suggestions.length) generated.recommended_elements = suggestions;
  }
  const output = validateAnswer(generated, contexts);
  const used = new Set([...output.citation_ids, ...output.recommended_elements.flatMap(r => r.citation_ids)]);
  return {
    ...output, benefit_description: output.answer,
    sources: contexts.filter(c => used.has(c.id)).map(c => ({ id: c.id, title: c.title, file: c.source, chunk: c.chunk, excerpt: c.text, score: Number(c.score.toFixed(4)) })),
    retrieved_count: contexts.length,
    models: { embedding: config.embeddingModel, generation: options?.extractiveNutrition ? null : config.chatModel },
    answer_mode: options?.extractiveNutrition ? 'retrieved_reference' : 'selected_evidence',
  };
}
module.exports = { answerQuestion, validateQuery, validateAnswer, recommendationQuery, recommendationSources };
