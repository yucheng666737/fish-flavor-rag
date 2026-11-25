document.addEventListener('DOMContentLoaded', function() {
    // 清理 localStorage 中的配方相關數據
    // 返回調整時保留配方，並於初始化後驗證與還原。
    
    // 从 localStorage 获取所选身份
    const selectedIdentity = localStorage.getItem('selectedIdentity') || 'custom';
    const identityDisplayName = localStorage.getItem('identityDisplayName') || '自由設計';
    
    // 更新显示的身份信息
    const identitySpan = document.getElementById('selectedIdentity');
    if (identitySpan) {
        identitySpan.textContent = identityDisplayName;
    }
    
    // 显示基于身份的个性化提示
    updatePersonalizedTips(selectedIdentity);
    
    // 初始化风味元素
    initFlavorElements();
    restoreRecipe();
    
    // 初始化拖拽功能
    initDragAndDrop();
    
    // 初始化生成报告按钮
    const generateButton = document.getElementById('generateReport');
    if (generateButton) {
        generateButton.addEventListener('click', function() {
            // 保存当前配方到 localStorage
            saveRecipe();
            
            // 创建并显示AI报告生成中提示
            const loadingOverlay = document.createElement('div');
            loadingOverlay.className = 'ai-report-overlay';
            loadingOverlay.innerHTML = `
                <div class="ai-loading">
                    <h3>整理風味報告中</h3>
                    <p>正在依配方計算風味指標...</p>
                    <div class="loading-spinner">
                        <div class="spinner"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(loadingOverlay);
            
            // 添加显示动画
            setTimeout(() => {
                loadingOverlay.classList.add('show');
            }, 10);
            
            // 2秒后导航到报告页面
            setTimeout(() => {
                window.location.href = 'report.html';
            }, 2000);
        });
    }
    
    // 初始化返回身份選擇按鈕
    const backToIdentityButton = document.getElementById('backToIdentity');
    if (backToIdentityButton) {
        backToIdentityButton.addEventListener('click', function() {
            // 確認是否放棄當前配方
            if (window.selectedElements.length > 0) {
                if (confirm('返回身份選擇頁面將會放棄目前的配方，是否確定？')) {
                    // 導航到身份選擇頁面
                    window.location.href = 'identity.html';
                }
            } else {
                // 如果沒有選擇任何成分，直接返回
                window.location.href = 'identity.html';
            }
        });
    }
    
    // 初始化清空所有按鈕
    const clearAllButton = document.getElementById('clearAllElements');
    if (clearAllButton) {
        clearAllButton.addEventListener('click', function() {
            if (window.additionalElements.length > 0) {
                if (confirm('確定要清空所有已加入的風味成分嗎？(基底風味不會被清除)')) {
                    clearAdditionalElements();
                }
            }
        });
    }
});

/**
 * 初始化风味元素
 */
function initFlavorElements() {
    // 初始化基底風味成分
    window.baseElement = {
        name: "fishessence",
        display: "鱸魚精",
        flavor: "濃郁",
        isBase: true,
        percentage: 50
    };
    
    // 初始化額外添加的成分數組
    window.additionalElements = [];
    
    // 初始化所有成分的總數組，包含基底和額外成分
    window.selectedElements = [window.baseElement];
    
    // 初始化风味状态对象
    window.flavorStats = {
        freshness: 0,    // 清新感
        richness: 6,     // 濃郁度 - 基底提供6分濃郁度
        sweetness: 0,    // 甘甜度
        naturalness: 3,  // 天然感 - 基底提供3分天然感
        aftertaste: 5    // 後韻持久度 - 基底提供5分後韻持久度
    };

    // 初始化瓶身為基底顏色
    const bottle = document.querySelector('.bottle-liquid');
    if (bottle) {
        bottle.style.height = '50%'; // 基底佔50%
        bottle.style.backgroundColor = 'rgba(216, 174, 103, 1)'; // 淡黃色
        bottle.classList.add('with-base');
    }
    
    // 更新進度條
    updateProgress();
    
    // 更新顯示的風味詳情
    updateFlavorDetails();
    
    // 檢查是否可以生成報告
    checkReportButtonStatus();
    
    console.log('初始化風味統計：', window.flavorStats);
}

/**
 * 初始化拖拽功能
 */
function initDragAndDrop() {
    const designContainer = document.getElementById('designContainer');
    const elementItems = document.querySelectorAll('.element-item');
    
    // 滾動控制變量
    let autoScrollInterval = null;
    const scrollSpeed = 8; // 滾動速度
    
    let activeTouch = null;

    function clearTouchDrag() {
        if (!activeTouch) return;
        activeTouch.preview?.remove();
        activeTouch.item.classList.remove('dragging');
        activeTouch = null;
        designContainer.classList.remove('drag-over');
        stopAutoScroll();
    }

    window.addEventListener('blur', clearTouchDrag);
    window.addEventListener('pagehide', clearTouchDrag);

    elementItems.forEach(item => {
        item.addEventListener('touchstart', e => {
            if (activeTouch || e.touches.length !== 1) return;
            e.preventDefault();
            activeTouch = { item, id: e.changedTouches[0].identifier, preview: null };
        }, { passive: false });

        item.addEventListener('touchmove', e => {
            if (activeTouch?.item !== item) return;
            const touch = Array.from(e.changedTouches).find(t => t.identifier === activeTouch.id);
            if (!touch) return;
            e.preventDefault();
            if (!activeTouch.preview) {
                const preview = item.cloneNode(true);
                preview.classList.add('drag-preview');
                preview.setAttribute('aria-hidden', 'true');
                preview.style.width = item.getBoundingClientRect().width + 'px';
                document.body.appendChild(preview);
                activeTouch.preview = preview;
                item.classList.add('dragging');
            }
            activeTouch.preview.style.left = touch.clientX + 'px';
            activeTouch.preview.style.top = touch.clientY + 'px';
            updateAutoScroll(touch);
            designContainer.classList.toggle('drag-over',
                designContainer.contains(document.elementFromPoint(touch.clientX, touch.clientY)));
        }, { passive: false });

        item.addEventListener('touchend', e => {
            if (activeTouch?.item !== item) return;
            const touch = Array.from(e.changedTouches).find(t => t.identifier === activeTouch.id);
            if (!touch) return;
            const add = activeTouch.preview && designContainer.contains(document.elementFromPoint(touch.clientX, touch.clientY));
            clearTouchDrag();
            if (add) handleElementDrop(item.dataset.element, item.dataset.flavor, item.querySelector('span').textContent);
        });
        item.addEventListener('touchcancel', clearTouchDrag);

        // 標準拖拽事件（桌面設備）
        item.addEventListener('dragstart', function(e) {
            e.dataTransfer.setData('text/plain', item.dataset.element);
            e.dataTransfer.effectAllowed = 'copy';
            this.classList.add('dragging');
            stopAutoScroll();
        });
        
        item.addEventListener('drag', function(e) {
            updateAutoScroll(e);
        });
        
        item.addEventListener('dragend', function() {
            designContainer.classList.remove('drag-over');
            this.classList.remove('dragging');
            stopAutoScroll();
        });
    });
    
    // 為設計容器添加放置事件
    if (designContainer) {
        designContainer.addEventListener('dragover', function(e) {
            e.dataTransfer.dropEffect = 'copy';
            e.preventDefault();
            this.classList.add('drag-over');
        });
        
        designContainer.addEventListener('dragleave', function(e) {
            this.classList.remove('drag-over');
        });
        
        designContainer.addEventListener('drop', drop);
    }
    
    function updateAutoScroll({ clientY }) {
        stopAutoScroll();
        const edge = window.innerHeight * 0.2;
        const direction = clientY < edge ? -1 : clientY > window.innerHeight - edge ? 1 : 0;
        if (direction) {
            autoScrollInterval = setInterval(() => window.scrollBy(0, direction * scrollSpeed), 16);
        }
    }

    // 停止自動滾動
    function stopAutoScroll() {
        if (autoScrollInterval) {
            clearInterval(autoScrollInterval);
            autoScrollInterval = null;
        }
    }
    

}

/**
 * 處理元素放置（觸摸和拖拽共用的邏輯）
 */
function handleElementDrop(elementName, flavorType, elementText) {
    // 检查是否已达到最大额外成分比例（50%）
    if (window.additionalElements.length >= 5) {
        alert('您的配方中額外風味已達到最大比例50%，無法再添加更多成分。');
        return;
    }
    
    // 添加到额外元素及总元素数组
    const newElement = {
        name: elementName,
        display: elementText,
        flavor: flavorType,
        percentage: 10
    };
    
    window.additionalElements.push(newElement);
    window.selectedElements.push(newElement);
    
    console.log('添加新成分：', {
        elementName,
        flavorType,
        elementText,
        currentElements: window.selectedElements
    });
    
    // 先更新風味統計數據
    updateFlavorStats(flavorType);
    
    // 然後在短暫延遲後更新瓶身，讓視覺效果更流暢
    setTimeout(() => {
        updateBottle();
    }, 50);
    
    // 再短暫延遲後更新進度條，製造連續動畫效果
    setTimeout(() => {
        updateProgress();
    }, 100);
    
    // 更新显示的风味详情
    updateFlavorDetails();
    
    // 更新个性化风味提示（根据新添加的风味和用户身份）
    setTimeout(() => {
        updateFlavorTipsForIdentity(elementName, elementText, flavorType);
    }, 150);
    
    // 检查是否可以生成报告
    checkReportButtonStatus();
}

/**
 * 拖拽放置事件处理
 */
function drop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    
    // 获取被拖拽的元素
    const draggedElement = document.querySelector('.dragging');
    if (!draggedElement) return;
    
    // 获取元素数据
    const elementName = draggedElement.getAttribute('data-element');
    const flavorType = draggedElement.getAttribute('data-flavor');
    const elementText = draggedElement.querySelector('span').textContent;
    
    // 使用共用的處理邏輯
    handleElementDrop(elementName, flavorType, elementText);
}

/**
 * 更新瓶身视觉效果
 */
function updateBottle() {
    const bottle = document.querySelector('.bottle-liquid');
    const label = document.querySelector('.bottle-label');
    
    if (bottle) {
        // 计算额外成分的高度百分比（每个成分10%）
        const additionalHeight = window.additionalElements.length * 10;
        // 基底50% + 额外成分高度
        const totalHeight = 50 + additionalHeight;
        const height = totalHeight + '%';
        console.log('更新瓶身高度:', height);
        bottle.style.height = height;
        
        // 根据风味特性调整颜色
        updateBottleColor();
    }
    
    if (label) {
        // 如果沒有額外風味，不顯示標籤
        if (window.additionalElements.length === 0) {
            label.style.opacity = '0';
        } else {
            // 有額外風味時，獲取並顯示標籤內容
            const labelInfo = generateLabelText();
            label.textContent = labelInfo.text;
            label.style.borderLeft = `4px solid ${labelInfo.color}`;
            label.style.opacity = '1';
            
            // 設置3秒後淡出
            clearTimeout(window.labelTimeout);
            window.labelTimeout = setTimeout(() => {
                label.style.opacity = '0';
            }, 1500);
        }
    }
}

/**
 * 更新瓶身颜色
 */
function updateBottleColor() {
    const bottle = document.querySelector('.bottle-liquid');
    if (!bottle) return;
    
    // 檢查是否只有基底風味
    if (window.additionalElements.length === 0) {
        // 如果沒有額外的成分，就恢復到基底的淡黃色
        bottle.style.backgroundColor = 'rgba(216, 174, 103, 1)';
        console.log('恢復到基底淡黃色');
        return;
    }
    
    // 元素特定顏色映射
    const elementColors = {
        'lemon': { r: 255, g: 193, b: 7 },      // 亮黃色 #ffc107
        'honey': { r: 255, g: 160, b: 0 },      // 琥珀色 #ffa000
        'ginger': { r: 121, g: 85, b: 72 },     // 棕色 #795548
        'lavender': { r: 149, g: 117, b: 205 }, // 紫色 #9575cd
        'mint': { r: 76, g: 175, b: 80 },       // 綠色 #4caf50
        'vanilla': { r: 205, g: 220, b: 57 },   // 淡黃綠色 #cddc39
        'cinnamon': { r: 161, g: 136, b: 127 }, // 棕灰色 #a1887f
        'orange': { r: 255, g: 152, b: 0 },     // 橙色 #ff9800
        'rose': { r: 236, g: 64, b: 122 },      // 粉紅色 #ec407a
        'chamomile': { r: 253, g: 216, b: 53 }, // 金黃色 #fdd835
        'cranberry': { r: 229, g: 57, b: 53 },  // 紅色 #e53935
        'goji': { r: 211, g: 47, b: 47 }        // 深紅色 #d32f2f
    };
    
    // 基底顏色（鱸魚精淡黃色）
    let baseColor = { r: 216, g: 174, b: 103 }; // rgba(216, 174, 103, 1)
    let resultColor = { ...baseColor };
    
    // 計算混合顏色
    if (window.additionalElements.length > 0) {
        // 重置為基底顏色
        resultColor = { ...baseColor };
        
        // 添加每個元素的顏色貢獻
        window.additionalElements.forEach(element => {
            const elementColor = elementColors[element.name] || baseColor;
            
            // 簡單的顏色混合方式：平均混合
            resultColor.r = (resultColor.r + elementColor.r) / 2;
            resultColor.g = (resultColor.g + elementColor.g) / 2;
            resultColor.b = (resultColor.b + elementColor.b) / 2;
        });
    }
    
    // 生成起始顏色（鱸魚精基底色）
    const startColor = 'rgba(216, 174, 103, 1)';
    
    // 生成終點顏色（混合後的顏色）
    const endColor = `rgba(${Math.round(resultColor.r)}, ${Math.round(resultColor.g)}, ${Math.round(resultColor.b)}, 0.9)`;
    
    // 設置漸變色（這裡不使用線性漸變，而是直接使用終點顏色，因為瓶身不像進度條是橫向的）
    bottle.style.backgroundColor = `rgba(${Math.round(resultColor.r)}, ${Math.round(resultColor.g)}, ${Math.round(resultColor.b)}, 0.9)`;
    
    // 設置一個自定義屬性，方便其他頁面使用相同的顏色
    bottle.setAttribute('data-bottle-color', endColor);
    
    console.log('更新瓶身顏色：', {
        additionalElements: window.additionalElements.map(e => e.name),
        startColor,
        endColor,
        finalColor: `rgba(${Math.round(resultColor.r)}, ${Math.round(resultColor.g)}, ${Math.round(resultColor.b)}, 0.9)`
    });
}

/**
 * 生成标签文本和對應顏色
 */
function generateLabelText() {
    // 不再顯示基底資訊
    if (window.additionalElements.length === 0) {
        return {
            text: '',
            color: '#b86e20'
        };
    }
    
    const identity = localStorage.getItem('selectedIdentity') || 'custom';
    const latestElement = window.additionalElements[window.additionalElements.length - 1];
    
    let labelText = '';
    let labelColor = '#b86e20'; // 默認顏色
    
    // 根据最新添加的成分显示效果变化
    switch (latestElement.flavor) {
        case '清新':
            labelText = `添加${latestElement.display}：清新+10%`;
            labelColor = '#36a2eb'; // 藍色
            break;
        case '甘甜':
            labelText = `添加${latestElement.display}：甜度+10%`;
            labelColor = '#ffcd56'; // 黃色
            break;
        case '濃郁':
            labelText = `添加${latestElement.display}：濃郁+10%`;
            labelColor = '#ff6384'; // 紅色
            break;
        case '天然':
            labelText = `添加${latestElement.display}：天然+10%`;
            labelColor = '#4bc0c0'; // 綠色
            break;
        case '持久':
            labelText = `添加${latestElement.display}：持久+10%`;
            labelColor = '#9966ff'; // 紫色
            break;
        default:
            labelText = `添加${latestElement.display}：風味+10%`;
            labelColor = '#b86e20'; // 棕色
    }
    
    // 特定成分的顏色覆蓋
    switch (latestElement.name) {
        case 'lemon':
            labelColor = '#ffc107'; // 亮黃色
            break;
        case 'honey':
            labelColor = '#ffa000'; // 琥珀色
            break;
        case 'ginger':
            labelColor = '#795548'; // 棕色
            break;
        case 'lavender':
            labelColor = '#9575cd'; // 紫色
            break;
        case 'mint':
            labelColor = '#4caf50'; // 綠色
            break;
        case 'vanilla':
            labelColor = '#cddc39'; // 淡黃綠色
            break;
        case 'cinnamon':
            labelColor = '#a1887f'; // 棕灰色
            break;
        case 'orange':
            labelColor = '#ff9800'; // 橙色
            break;
        case 'rose':
            labelColor = '#ec407a'; // 粉紅色
            break;
        case 'chamomile':
            labelColor = '#fdd835'; // 金黃色
            break;
        case 'cranberry':
            labelColor = '#e53935'; // 紅色
            break;
        case 'goji':
            labelColor = '#d32f2f'; // 深紅色
            break;
    }
    
    return {
        text: labelText,
        color: labelColor
    };
}

/**
 * 更新风味统计
 */
function updateFlavorStats(flavorType) {
    // 確保 flavorStats 對象存在
    if (!window.flavorStats) {
        window.flavorStats = {
            freshness: 0,
            richness: 6,     // 基底提供6分濃郁度
            sweetness: 0,
            naturalness: 3,  // 基底提供3分天然感
            aftertaste: 5    // 基底提供5分後韻持久度
        };
    }
    
    // 根據風味類型更新統計
    switch (flavorType) {
        case '清新':
            window.flavorStats.freshness += 2; // 從1分改為2分
            break;
        case '濃郁':
            window.flavorStats.richness += 2; // 從1分改為2分
            break;
        case '甘甜':
            window.flavorStats.sweetness += 2; // 從1分改為2分
            break;
        case '天然':
            window.flavorStats.naturalness += 2; // 從1分改為2分
            break;
        case '持久':
            window.flavorStats.aftertaste += 2; // 從1分改為2分
            break;
    }
    
    console.log('更新風味統計：', window.flavorStats);
    
    // 不再直接更新瓶身效果，讓drop函數控制更新時機
    // updateBottle();
}

/**
 * 更新进度条
 */
function updateProgress() {
    const progressBar = document.getElementById('completeness');
    if (!progressBar) return;
    
    // 计算当前完整度百分比 (基底50% + 额外成分)
    const completenessPercentage = 50 + (window.additionalElements.length * 10);
    progressBar.style.width = completenessPercentage + '%';
    progressBar.textContent = completenessPercentage + '%';
    
    // 根據風味元素更新進度條顏色
    updateProgressColor(progressBar);
    
    // 如果达到最大值，改变颜色
    if (completenessPercentage >= 100) {
        progressBar.classList.add('complete');
    } else {
        progressBar.classList.remove('complete');
    }
}

/**
 * 更新進度條顏色
 */
function updateProgressColor(progressBar) {
    if (!progressBar) return;
    
    // 如果沒有額外風味，使用基底鱸魚精顏色
    if (window.additionalElements.length === 0) {
        progressBar.style.background = 'rgba(216, 174, 103, 1)';
        return;
    }
    
    // 元素特定顏色映射
    const elementColors = {
        'lemon': { r: 255, g: 193, b: 7 },      // 亮黃色 #ffc107
        'honey': { r: 255, g: 160, b: 0 },      // 琥珀色 #ffa000
        'ginger': { r: 121, g: 85, b: 72 },     // 棕色 #795548
        'lavender': { r: 149, g: 117, b: 205 }, // 紫色 #9575cd
        'mint': { r: 76, g: 175, b: 80 },       // 綠色 #4caf50
        'vanilla': { r: 205, g: 220, b: 57 },   // 淡黃綠色 #cddc39
        'cinnamon': { r: 161, g: 136, b: 127 }, // 棕灰色 #a1887f
        'orange': { r: 255, g: 152, b: 0 },     // 橙色 #ff9800
        'rose': { r: 236, g: 64, b: 122 },      // 粉紅色 #ec407a
        'chamomile': { r: 253, g: 216, b: 53 }, // 金黃色 #fdd835
        'cranberry': { r: 229, g: 57, b: 53 },  // 紅色 #e53935
        'goji': { r: 211, g: 47, b: 47 }        // 深紅色 #d32f2f
    };
    
    // 基底顏色（鱸魚精淡黃色）
    let baseColor = { r: 216, g: 174, b: 103 }; // rgba(216, 174, 103, 1)
    let resultColor = { ...baseColor };
    
    // 計算混合顏色
    if (window.additionalElements.length > 0) {
        // 重置為基底顏色
        resultColor = { ...baseColor };
        
        // 添加每個元素的顏色貢獻
        window.additionalElements.forEach(element => {
            const elementColor = elementColors[element.name] || baseColor;
            
            // 簡單的顏色混合方式：平均混合
            resultColor.r = (resultColor.r + elementColor.r) / 2;
            resultColor.g = (resultColor.g + elementColor.g) / 2;
            resultColor.b = (resultColor.b + elementColor.b) / 2;
        });
    }
    
    // 生成起始顏色（鱸魚精基底色）
    const startColor = 'rgba(216, 174, 103, 1)';
    
    // 生成終點顏色（混合後的顏色）
    const endColor = `rgba(${Math.round(resultColor.r)}, ${Math.round(resultColor.g)}, ${Math.round(resultColor.b)}, 0.9)`;
    
    // 設置漸變色
    progressBar.style.background = `linear-gradient(to right, ${startColor}, ${endColor})`;
    
    console.log('更新進度條顏色：', {
        additionalElements: window.additionalElements.map(e => e.name),
        startColor,
        endColor
    });
}

/**
 * 獲取風味元素對應的圖標HTML
 */
function getFlavorEmoji(elementName) {
    // 基底使用emoji
    if (elementName === 'fishessence') {
        return '🐟';
    }
    
    // 其他風味使用ico文件
    const imgPath = `images/flavors/${elementName}.ico`;
    return `<img src="${imgPath}" alt="${elementName}" class="flavor-img-small">`;
}

/**
 * 更新显示的风味详情
 */
function updateFlavorDetails() {
    const flavorStatsContainer = document.getElementById('flavorStats');
    if (!flavorStatsContainer) return;
    
    let statsHTML = `
        <div class="flavor-item base-flavor">
            <span class="emoji-small">${getFlavorEmoji('fishessence')}</span>
            <span class="flavor-name">鱸魚精 (基底)</span>
            <span class="flavor-percentage">50%</span>
        </div>
    `;
    
    // 添加额外成分
    window.additionalElements.forEach((element, index) => {
        statsHTML += `
            <div class="flavor-item" data-index="${index}">
                <span class="flavor-icon">${getFlavorEmoji(element.name)}</span>
                <span class="flavor-name">${element.display}</span>
                <span class="flavor-type">${getFlavorTypeChinese(element.flavor)}</span>
                <span class="flavor-percentage">10%</span>
                <button class="delete-btn" aria-label="移除${element.display}" data-index="${index}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    });
    
    // 添加平衡度评分
    const balanceScore = calculateBalanceScore();
    statsHTML += `
        <div class="balance-score">
            <span>風味平衡度：${balanceScore}/10</span>
            <div class="score-bar">
                <div class="score" style="width: ${balanceScore * 10}%"></div>
            </div>
        </div>
    `;
    
    flavorStatsContainer.innerHTML = statsHTML;
    flavorStatsContainer.querySelectorAll('.delete-btn').forEach(button => button.addEventListener('click', deleteElement));
}

/**
 * 计算平衡度评分
 */
function calculateBalanceScore() {
    // 基于不同风味维度的分布计算平衡度
    const stats = Object.values(window.flavorStats);
    const total = stats.reduce((sum, value) => sum + value, 0);
    
    if (total === 0) return 0;
    
    // 计算标准差
    const mean = total / stats.length;
    const squareDiffs = stats.map(value => (value - mean) ** 2);
    const avgSquareDiff = squareDiffs.reduce((sum, value) => sum + value, 0) / stats.length;
    const stdDev = Math.sqrt(avgSquareDiff);
    
    // 基于标准差计算平衡度，标准差越小平衡度越高
    // 最大标准差假设为10，对应平衡度0；标准差为0对应平衡度10
    const maxStdDev = 10;
    let balanceScore = 10 - (stdDev / maxStdDev * 10);
    
    // 确保分数在0-10范围内
    balanceScore = Math.max(0, Math.min(10, balanceScore));
    
    // 格式化为一位小数
    return Math.round(balanceScore * 10) / 10;
}

/**
 * 检查是否可以生成报告
 */
function checkReportButtonStatus() {
    const generateButton = document.getElementById('generateReport');
    if (!generateButton) return;
    
    // 只要有基底就可以生成報告
    generateButton.disabled = false;
}

/**
 * 删除元素
 */
function deleteElement(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const index = parseInt(e.currentTarget.getAttribute('data-index'));
    if (isNaN(index)) return;
    
    console.log('刪除元素，索引：', index);
    
    // 獲取要刪除的元素
    const elementToRemove = window.additionalElements[index];
    if (!elementToRemove) return;
    
    // 從風味統計中減去對應值
    decreaseFlavorStats(elementToRemove.flavor);
    
    // 從數組中刪除元素
    window.additionalElements.splice(index, 1);
    
    // 更新整體成分列表
    window.selectedElements = [window.baseElement, ...window.additionalElements];
    
    // 延遲更新視覺效果，讓動畫更流暢
    setTimeout(() => {
        updateBottle();
    }, 50);
    
    setTimeout(() => {
        updateProgress();
    }, 100);
    
    // 更新顯示的風味詳情
    updateFlavorDetails();
    
    // 檢查是否可以生成報告
    checkReportButtonStatus();
}

/**
 * 從風味統計中減去對應值
 */
function decreaseFlavorStats(flavorType) {
    // 確保 flavorStats 對象存在
    if (!window.flavorStats) return;
    
    // 根據風味類型減少統計
    switch (flavorType) {
        case '清新':
            window.flavorStats.freshness -= 2;
            break;
        case '濃郁':
            window.flavorStats.richness -= 2;
            break;
        case '甘甜':
            window.flavorStats.sweetness -= 2;
            break;
        case '天然':
            window.flavorStats.naturalness -= 2;
            break;
        case '持久':
            window.flavorStats.aftertaste -= 2;
            break;
    }
    
    // 確保沒有負值
    for (const key in window.flavorStats) {
        window.flavorStats[key] = Math.max(0, window.flavorStats[key]);
    }
    
    console.log('減少風味統計：', window.flavorStats);
    
    // 不再直接更新瓶身效果，讓deleteElement函數控制更新時機
    // updateBottle();
}

/**
 * 清空所有额外添加的元素
 */
function clearAdditionalElements() {
    // 重置風味統計到基底值
    window.flavorStats = {
        freshness: 0,    // 清新感
        richness: 6,     // 濃郁度 - 基底提供6分濃郁度
        sweetness: 0,    // 甘甜度
        naturalness: 3,  // 天然感 - 基底提供3分天然感
        aftertaste: 5    // 後韻持久度 - 基底提供5分後韻持久度
    };
    
    // 清空额外元素数组
    window.additionalElements = [];
    
    // 重置所有元素数组，只保留基底
    window.selectedElements = [window.baseElement];
    
    // 延遲更新視覺效果，讓動畫更流暢
    setTimeout(() => {
        updateBottle();
    }, 50);
    
    setTimeout(() => {
        updateProgress();
    }, 100);
    
    // 更新顯示的風味詳情
    updateFlavorDetails();
    
    // 检查是否可以生成报告
    checkReportButtonStatus();
}

/**
 * 获取风味类型的中文描述
 */
function getFlavorTypeChinese(flavorType) {
    switch (flavorType) {
        case '清新':
            return '清新';
        case '濃郁':
            return '濃郁';
        case '甘甜':
            return '甘甜';
        case '天然':
            return '天然';
        case '持久':
            return '持久';
        default:
            return '未知';
    }
}

/**
 * 保存配方到 localStorage
 */
function saveRecipe() {
    // 保存选择的元素
    localStorage.setItem('selectedElements', JSON.stringify(window.selectedElements));
    
    // 保存风味统计
    localStorage.setItem('flavorStats', JSON.stringify(window.flavorStats));
    
    console.log('配方已保存：', {
        selectedElements: window.selectedElements,
        flavorStats: window.flavorStats
    });
}

/**
 * 更新个性化提示
 */
function updatePersonalizedTips(identity) {
    const container = document.getElementById('personalizedTips');
    if (!container) return;
    const heading = document.createElement('h3');
    heading.textContent = '風味文件推薦（RAG）';
    const intro = document.createElement('p');
    intro.textContent = '加入風味後，會檢索知識文件並顯示附來源的搭配建議。族群選擇不代表醫療或營養適用性。';
    container.replaceChildren(heading, intro);
}

function updateFlavorTipsForIdentity(elementName, elementText) {
    const identity = localStorage.getItem('selectedIdentity') || 'custom';
    return RagClient.recommendFlavor(elementName, elementText, identity);
}

function restoreRecipe() {
    let stored;
    try { stored = JSON.parse(localStorage.getItem('selectedElements') || '[]'); }
    catch { return; }
    if (!Array.isArray(stored)) return;
    const cards = new Map([...document.querySelectorAll('.element-item[data-element]')].map(el => [el.dataset.element, el]));
    for (const item of stored.filter(el => el && !el.isBase).slice(0, 5)) {
        const card = cards.get(item.name);
        if (!card) continue;
        const restored = { name: card.dataset.element, display: card.querySelector('span')?.textContent?.trim() || card.textContent.trim(), flavor: card.dataset.flavor, percentage: 10 };
        window.additionalElements.push(restored);
        window.selectedElements.push(restored);
        updateFlavorStats(restored.flavor);
    }
    updateBottle();
    updateProgress();
    updateFlavorDetails();
}
