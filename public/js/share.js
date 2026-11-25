document.addEventListener('DOMContentLoaded', function() {
    // 從 localStorage 獲取數據
    const selectedIdentity = localStorage.getItem('selectedIdentity') || 'custom';
    const identityDisplayName = localStorage.getItem('identityDisplayName') || '自由設計';
    const recipe = RecipeModel.calculate(JSON.parse(localStorage.getItem('selectedElements') || '[]'), selectedIdentity);
    const selectedElements = recipe.elements;
    if (!selectedElements.length) { window.location.replace('flavor.html'); return; }
    const flavorStats = recipe.stats;
    
    // 初始化分享頁面
    initSharePage(selectedElements, flavorStats, selectedIdentity, identityDisplayName);
    
    // 設置導航按鈕
    setupNavigation();
    
    // 設置複製按鈕
    setupCopyButtons();
    
    // 設置分享按鈕
    setupSocialShareButtons();
});

/**
 * 初始化分享頁面
 */
function initSharePage(elements, flavorStats, identity, identityName) {
    // 更新瓶身預覽
    updateBottlePreview(elements, flavorStats);
    
    // 生成配方內容
    generateShareRecipe(elements, flavorStats);
    
    // 生成分享標籤
    generateTags(elements, flavorStats, identity);
    
    // 生成分享文案
    generateShareMessage(elements, flavorStats, identity, identityName);
    
    // 生成促銷碼
    generatePromotionCode(identity, elements);
    
}

/**
 * 更新瓶身預覽
 */
function updateBottlePreview(elements, flavorStats) {
    const bottle = document.querySelector('#shareBottle .bottle-liquid');
    
    if (bottle) {
        // 設置滿瓶
        bottle.style.height = elements.reduce((sum, item) => sum + item.percentage, 0) + '%';
        
        // 如果沒有選擇元素，設置為白色
        if (!elements || elements.length === 0) {
            bottle.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
            // 魚圖標也設置為白色
            const fishIcon = document.querySelector('#shareBottle .bottle-icon i');
            if (fishIcon) {
                fishIcon.style.color = '#1e6d7b'; // 使用與flavor頁面相同的顏色
            }
            return;
        }
        
        // 檢查是否只有基底風味
        if (elements.length === 1 && elements[0].isBase) {
            // 如果只有基底風味，使用淡黃色
            bottle.style.backgroundColor = 'rgba(216, 174, 103, 1)';
            
            // 更新魚圖標顏色
            const fishIcon = document.querySelector('#shareBottle .bottle-icon i');
            if (fishIcon) {
                fishIcon.style.color = '#1e6d7b'; // 使用與flavor頁面相同的顏色
            }
            
            console.log('分享頁面：使用基底淡黃色');
            return;
        }
        
        // 使用與 flavor.js 相同的元素特定顏色映射
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
        const additionalElements = elements.filter(e => !e.isBase);
        if (additionalElements.length > 0) {
            // 重置為基底顏色
            resultColor = { ...baseColor };
            
            // 添加每個元素的顏色貢獻
            additionalElements.forEach(element => {
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
        
        // 強制重繪
        requestAnimationFrame(() => {
            // 設置瓶身顏色
            bottle.style.backgroundColor = endColor;
            
            // 更新魚圖標顏色，保持與flavor頁面一致
            const fishIcon = document.querySelector('#shareBottle .bottle-icon i');
            if (fishIcon) {
                fishIcon.style.color = '#1e6d7b'; // 使用與flavor頁面相同的顏色
            }
        });
        
        console.log('更新分享頁面瓶身顏色：', {
            elements: elements.map(e => e.name),
            additionalElements: additionalElements.map(e => e.name),
            startColor,
            endColor
        });
    }
}

/**
 * 生成配方簡介
 */
function generateShareRecipe(elements, flavorStats) {
    const recipeContainer = document.getElementById('shareRecipe');
    if (!recipeContainer) return;
    
    // 如果沒有成分，顯示默認信息
    if (!elements || elements.length === 0) {
        recipeContainer.innerHTML = '<p>未選擇任何成分，請返回調整。</p>';
        return;
    }
    
    // 統計每種成分出現的次數
    const ingredientCounts = {};
    elements.forEach(el => {
        ingredientCounts[el.display] = (ingredientCounts[el.display] || 0) + 1;
    });
    
    // 生成配方列表
    let recipeHtml = '<div class="recipe-items">';
    
    // 挑選前3種主要成分
    const mainIngredients = Object.entries(ingredientCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
    
    // 生成主要成分文字
    if (mainIngredients.length === 1) {
        recipeHtml += `<p>主要成分: ${mainIngredients[0][0]}</p>`;
    } else if (mainIngredients.length === 2) {
        recipeHtml += `<p>主要成分: ${mainIngredients[0][0]}、${mainIngredients[1][0]}</p>`;
    } else if (mainIngredients.length === 3) {
        recipeHtml += `<p>主要成分: ${mainIngredients[0][0]}、${mainIngredients[1][0]} 和 ${mainIngredients[2][0]}</p>`;
    }
    
    // 生成風味描述
    const dominantFlavor = getDominantFlavor(flavorStats);
    let flavorDescription = '';
    
    switch (dominantFlavor) {
        case 'freshness':
            flavorDescription = '以清新爽朗為主';
            break;
        case 'richness':
            flavorDescription = '以濃郁層次感為主';
            break;
        case 'sweetness':
            flavorDescription = '以溫和甘甜為主';
            break;
        case 'naturalness':
            flavorDescription = '以天然純淨為主';
            break;
        case 'aftertaste':
            flavorDescription = '以持久餘韻為主';
            break;
        default:
            flavorDescription = '風味平衡';
    }
    
    recipeHtml += `<p>風味特點: ${flavorDescription}</p>`;
    
    // 計算健康指數（示例算法）
    const healthScore = calculateHealthScore(elements, flavorStats);
    recipeHtml += `<p>風味指數: <span class="health-score">${healthScore}/10</span></p>`;
    
    recipeHtml += '</div>';
    recipeContainer.innerHTML = recipeHtml;
}

/**
 * 計算健康指數
 */
function calculateHealthScore(elements, flavorStats) {
    // 示例算法，可以根據實際需求調整
    const naturalness = flavorStats.naturalness || 0;
    const sweetness = flavorStats.sweetness || 0;
    
    // 假設天然感越高，配方越健康
    // 甜度適中最健康 (5-6分最優)
    const sweetnessScore = 10 - Math.abs(5.5 - sweetness) * 1.5;
    
    // 自然感直接轉換為分數
    const naturalnessScore = naturalness;
    
    // 元素多樣性也算入健康分數
    const uniqueElements = new Set(elements.map(e => e.name)).size;
    const diversityScore = Math.min(10, uniqueElements * 2);
    
    // 綜合計算
    const finalScore = (naturalnessScore * 0.4 + sweetnessScore * 0.3 + diversityScore * 0.3).toFixed(1);
    
    return Math.min(10, Math.max(1, finalScore)); // 確保在1-10之間
}

/**
 * 生成分享標籤
 */
function generateTags(elements, flavorStats, identity) {
    const tagContainer = document.getElementById('tagContainer');
    if (!tagContainer) return;
    
    // 要生成的標籤數組
    const tags = [];
    
    // 1. 生成身份相關標籤
    switch (identity) {
        case 'pregnant':
            tags.push('#孕媽咪健康飲');
            tags.push('#孕期補給');
            break;
        case 'office':
            tags.push('#辦公室元氣');
            tags.push('#工作提神');
            break;
        case 'elderly':
            tags.push('#銀髮樂活');
            tags.push('#健康熟齡');
            break;
        case 'custom':
            tags.push('#我的專屬配方');
            break;
    }
    
    // 2. 生成風味相關標籤
    const dominantFlavor = getDominantFlavor(flavorStats);
    
    switch (dominantFlavor) {
        case 'freshness':
            tags.push('#清新怡人');
            if (hasElement(elements, 'lemon')) tags.push('#檸檬清香');
            if (hasElement(elements, 'mint')) tags.push('#薄荷涼感');
            break;
        case 'richness':
            tags.push('#濃郁風味');
            if (hasElement(elements, 'ginger')) tags.push('#薑汁暖心');
            if (hasElement(elements, 'cinnamon')) tags.push('#肉桂香氣');
            break;
        case 'sweetness':
            tags.push('#甜蜜滋味');
            if (hasElement(elements, 'honey')) tags.push('#蜂蜜甘甜');
            if (hasElement(elements, 'vanilla')) tags.push('#香草溫潤');
            break;
        case 'naturalness':
            tags.push('#天然純淨');
            if (hasElement(elements, 'lavender')) tags.push('#薰衣草舒緩');
            if (hasElement(elements, 'rose')) tags.push('#玫瑰芬芳');
            break;
        case 'aftertaste':
            tags.push('#餘韻持久');
            if (hasElement(elements, 'chamomile')) tags.push('#洋甘菊幽香');
            break;
    }
    
    // 3. 添加通用標籤
    tags.push('#健康生活體驗');
    tags.push('#養生飲品');
    
    // 4. 添加特定組合標籤
    if (hasElement(elements, 'lemon') && hasElement(elements, 'honey')) {
        tags.push('#檸檬蜂蜜經典配');
    }
    
    if (hasElement(elements, 'ginger') && hasElement(elements, 'cinnamon')) {
        tags.push('#暖心薑肉桂');
    }
    
    // 生成標籤HTML
    let tagHtml = '';
    tags.forEach(tag => {
        tagHtml += `<span class="share-tag">${tag}</span>`;
    });
    
    tagContainer.innerHTML = tagHtml;
    
    // 為標籤添加點擊事件，點擊可複製
    const tagElements = document.querySelectorAll('.share-tag');
    tagElements.forEach(tag => {
        tag.addEventListener('click', function() {
            copyTextToClipboard(this.textContent);
            showCopyFeedback(this);
        });
    });
}

/**
 * 檢查某元素是否在配方中
 */
function hasElement(elements, elementName) {
    return elements.some(el => el.name === elementName);
}

/**
 * 生成分享文案
 */
function generateShareMessage(elements, flavorStats, identity, identityName) {
    const messageContainer = document.getElementById('shareMessageContent');
    if (!messageContainer) return;
    
    // 獲取主導風味和主要成分
    const dominantFlavor = getDominantFlavor(flavorStats);
    const mainIngredients = getMainIngredients(elements, 2);
    
    // 根據身份和風味生成不同的文案
    let message = '我在「鱸魚精設計體驗」中設計了專屬配方：';
    
    // 添加身份相關描述
    switch (identity) {
        case 'pregnant':
            message += `為孕期打造的溫和滋養飲品，`;
            break;
        case 'office':
            message += `為忙碌工作設計的能量補給，`;
            break;
        case 'elderly':
            message += `為銀髮健康精心調配的飲品，`;
            break;
        default:
            message += `我的專屬健康飲品，`;
    }
    
    // 添加成分描述
    if (mainIngredients.length > 0) {
        message += `主要融合了${mainIngredients.join('和')}，`;
    }
    
    // 添加風味描述
    switch (dominantFlavor) {
        case 'freshness':
            message += `帶來清新爽朗的體驗！`;
            break;
        case 'richness':
            message += `呈現豐富層次的口感！`;
            break;
        case 'sweetness':
            message += `展現自然甘甜的風味！`;
            break;
        case 'naturalness':
            message += `散發天然純淨的氣息！`;
            break;
        case 'aftertaste':
            message += `留下持久美好的回味！`;
            break;
        default:
            message += `帶來全面平衡的健康感受！`;
    }
    
    // 添加健康指數
    const healthScore = calculateHealthScore(elements, flavorStats);
    message += `\n風味指數：${healthScore}/10`;
    
    // 添加標籤
    const tags = document.querySelectorAll('.share-tag');
    let tagText = '';
    for (let i = 0; i < Math.min(tags.length, 4); i++) {
        tagText += tags[i].textContent + ' ';
    }
    
    message += `\n${tagText}`;
    
    // 添加活動鏈接（示例）
    message += `\n\n快來創造屬於你的鱸魚精配方吧！👉 https://healthexperience.example.com`;
    
    messageContainer.textContent = message;
}

/**
 * 獲取主要成分
 */
function getMainIngredients(elements, count) {
    if (!elements || elements.length === 0) return [];
    
    const ingredientCounts = {};
    elements.forEach(el => {
        ingredientCounts[el.display] = (ingredientCounts[el.display] || 0) + 1;
    });
    
    // 排序並取前N個
    return Object.entries(ingredientCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, count)
        .map(item => item[0]);
}

/**
 * 獲取主導風味
 */
function getDominantFlavor(flavorStats) {
    // 找出數值最高的風味維度
    let maxValue = 0;
    let dominant = '';
    
    for (const [flavor, value] of Object.entries(flavorStats)) {
        if (value > maxValue) {
            maxValue = value;
            dominant = flavor;
        }
    }
    
    return dominant;
}

/**
 * 生成促銷碼
 */
function generatePromotionCode(identity, elements) {
    const promoCodeElement = document.getElementById('promoCode');
    const copyCodeButton = document.getElementById('copyCode');
    const lotteryNumberElement = document.querySelector('#lotteryNumber span');
    const joinLotteryButton = document.getElementById('joinLottery');
    
    if (promoCodeElement && copyCodeButton) {
        // 生成唯一促銷碼並保存在DOM元素的data屬性中，但不直接顯示
        const promoCode = generateUniquePromoCode(identity, elements);
        promoCodeElement.dataset.realCode = promoCode;
        promoCodeElement.textContent = "點擊分享按鈕後顯示";
        copyCodeButton.disabled = true;
    }
    
    if (lotteryNumberElement && joinLotteryButton) {
        // 生成抽獎編號，但先不顯示
        const lotteryNumber = generateLotteryNumber();
        lotteryNumberElement.dataset.realNumber = lotteryNumber;
        lotteryNumberElement.textContent = "點擊分享按鈕後顯示";
        joinLotteryButton.disabled = true;
    }
}

/**
 * 生成唯一促銷碼
 */
function generateUniquePromoCode(identity, elements) {
    // 使用身份和成分數量生成一個半個性化的促銷碼
    const date = new Date();
    const year = date.getFullYear();
    
    let identityPrefix = '';
    
    switch (identity) {
        case 'pregnant':
            identityPrefix = 'PRG';
            break;
        case 'office':
            identityPrefix = 'OFC';
            break;
        case 'elderly':
            identityPrefix = 'SNR';
            break;
        default:
            identityPrefix = 'CST';
    }
    
    // 計算成分種類數量
    const uniqueElements = new Set(elements.map(el => el.name)).size;
    
    // 生成優惠碼，格式：身份前綴 + 年份後兩位 + 成分種類數量 + 隨機兩位數
    const randomNum = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    
    return `${identityPrefix}${year.toString().substr(2)}${uniqueElements}${randomNum}`;
}

/**
 * 生成抽獎編號
 */
function generateLotteryNumber() {
    // 生成格式化的隨機抽獎編號
    const randomPart1 = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const randomPart2 = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const randomPart3 = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    return `${randomPart1}-${randomPart2}-${randomPart3}`;
}

function setupNavigation() {
    // 返回報告按鈕
    const backButton = document.getElementById('backToReport');
    if (backButton) {
        backButton.addEventListener('click', function() {
            window.location.href = 'report.html';
        });
    }
    
    // 立即購買按鈕
    const buyButton = document.getElementById('buyNow');
    if (buyButton) {
        buyButton.addEventListener('click', function() {
            window.open('https://www.anyongfresh.com/collections/%E9%87%91%E7%8D%8E%E9%B1%B8%E9%AD%9A%E7%B2%BE', '_blank');
        });
    }
    
    // 回到首頁按鈕
    const homeButton = document.getElementById('backToHome');
    if (homeButton) {
        homeButton.addEventListener('click', function() {
            window.location.href = 'index.html';
        });
    }
    
    // 參加抽獎按鈕
    const lotteryButton = document.getElementById('joinLottery');
    if (lotteryButton) {
        lotteryButton.addEventListener('click', function() {
            alert('感謝參與抽獎！您的抽獎編號已記錄，請關注我們的官方網站了解抽獎結果。');
            this.textContent = '已參加';
            this.disabled = true;
        });
    }
}

/**
 * 設置複製按鈕
 */
function setupCopyButtons() {
    // 複製文案按鈕
    const copyMessageButton = document.getElementById('copyMessage');
    const messageContent = document.getElementById('shareMessageContent');
    
    if (copyMessageButton && messageContent) {
        copyMessageButton.addEventListener('click', function() {
            copyTextToClipboard(messageContent.textContent);
            this.textContent = '已複製';
            setTimeout(() => {
                this.textContent = '複製文案';
            }, 2000);
        });
    }
    
    // 複製促銷碼按鈕
    const copyCodeButton = document.getElementById('copyCode');
    const promoCode = document.getElementById('promoCode');
    
    if (copyCodeButton && promoCode) {
        copyCodeButton.addEventListener('click', function() {
            copyTextToClipboard(promoCode.textContent);
            this.textContent = '已複製';
            setTimeout(() => {
                this.textContent = '複製';
            }, 2000);
        });
    }
}

/**
 * 設置社群分享按鈕
 */
function setupSocialShareButtons() {
    // 定義固定的網站URL（用於所有分享功能）
    // 不使用 window.location.href，因為本地文件路徑會導致LINE分享錯誤
    const FIXED_WEBSITE_URL = "https://healthexperience.example.com";
    
    // 準備分享內容
    const shareTitle = '我的專屬鱸魚精配方';
    // 不使用當前頁面的URL，改用固定URL
    const shareUrl = FIXED_WEBSITE_URL;
    
    // 獲取分享文案
    const shareMessageElement = document.getElementById('shareMessageContent');
    let shareMessage = shareMessageElement ? shareMessageElement.textContent : '我在「健康生活體驗」中設計了專屬配方，快來體驗吧！';
    
    // 縮短分享文案，避免過長
    if (shareMessage.length > 150) {
        shareMessage = shareMessage.substring(0, 147) + '...';
    }
    
    // Facebook分享
    const fbButton = document.getElementById('shareFacebook');
    if (fbButton) {
        fbButton.addEventListener('click', function() {
            const fbShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareMessage)}`;
            openShareWindow(fbShareUrl, 'facebook-share');
            updatePromotionAfterShare();
        });
    }
    
    // Instagram分享
    const igButton = document.getElementById('shareInstagram');
    if (igButton) {
        igButton.addEventListener('click', function() {
            // 複製分享文案到剪貼板
            copyTextToClipboard(shareMessage);
            
            // 顯示指導訊息
            alert('分享文案已複製！請打開 Instagram，創建新貼文並粘貼。為獲得完整體驗，建議同時截圖您的配方設計。');
            updatePromotionAfterShare();
        });
    }
    
    // LINE分享
    const lineButton = document.getElementById('shareLine');
    if (lineButton) {
        lineButton.addEventListener('click', function() {
            // 使用固定格式的LINE分享URL
            let lineShareUrl;
            
            // 確保使用正確編碼的固定URL，避免使用任何本地文件路徑
            const encodedShareUrl = encodeURIComponent(shareUrl);
            const encodedShareText = encodeURIComponent(shareMessage);
            
            if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
                // 移動設備格式
                lineShareUrl = `https://line.me/R/share?text=${encodedShareText}`;
            } else {
                // 桌面版格式
                lineShareUrl = `https://social-plugins.line.me/lineit/share?url=${encodedShareUrl}&text=${encodedShareText}`;
            }
            
            console.log('LINE分享URL:', lineShareUrl);
            
            // 使用彈出視窗方法
            openShareWindow(lineShareUrl, 'line-share');
            
            // 更新促銷碼狀態
            updatePromotionAfterShare();
        });
    }
}

/**
 * 開啟分享視窗
 */
function openShareWindow(url, windowName) {
    // 計算視窗位置（置中）
    const width = 550;
    const height = 450;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    
    // 開啟彈出視窗
    window.open(
        url,
        windowName,
        `toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=yes, resizable=yes, copyhistory=no, width=${width}, height=${height}, top=${top}, left=${left}`
    );
}

/**
 * 分享後更新促銷區域
 */
function updatePromotionAfterShare() {
    // 更新促銷碼顯示
    const promoCode = document.getElementById('promoCode');
    if (promoCode) {
        // 顯示真實的促銷碼
        if (promoCode.dataset.realCode) {
            promoCode.textContent = promoCode.dataset.realCode;
        } else {
            // 如果沒有保存的促銷碼，則生成一個新的
            promoCode.textContent = 'SHARE' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        }
        
        // 設置data屬性觸發CSS動畫效果
        promoCode.dataset.realCodeShown = 'true';
        
        // 啟用複製按鈕
        const copyCodeButton = document.getElementById('copyCode');
        if (copyCodeButton) {
            copyCodeButton.disabled = false;
        }
    }
    
    // 更新抽獎信息
    const lotteryNumberSpan = document.querySelector('#lotteryNumber span');
    if (lotteryNumberSpan) {
        // 顯示真實的抽獎號碼
        if (lotteryNumberSpan.dataset.realNumber) {
            lotteryNumberSpan.textContent = lotteryNumberSpan.dataset.realNumber;
        } else {
            // 如果沒有保存的抽獎號碼，則生成一個新的
            lotteryNumberSpan.textContent = generateLotteryNumber();
        }
        
        // 設置data屬性觸發CSS動畫效果
        lotteryNumberSpan.dataset.realNumberShown = 'true';
        
        // 啟用抽獎按鈕
        const joinLotteryButton = document.getElementById('joinLottery');
        if (joinLotteryButton) {
            joinLotteryButton.disabled = false;
        }
    }
}

/**
 * 複製文字到剪貼板
 */
function copyTextToClipboard(text) {
    // 創建臨時文本區域
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
        // 嘗試複製文本
        document.execCommand('copy');
    } catch (err) {
        console.error('複製失敗:', err);
    }
    
    // 刪除臨時文本區域
    document.body.removeChild(textArea);
}

/**
 * 顯示複製反饋效果
 */
function showCopyFeedback(element) {
    const originalColor = element.style.background;
    
    // 變更顏色作為視覺反饋
    element.style.background = 'linear-gradient(to right, var(--secondary-color), var(--primary-color))';
    
    // 2秒後恢復原狀
    setTimeout(() => {
        element.style.background = originalColor;
    }, 1000);
}

// 基底顏色（鱸魚精淡黃色）
let baseColor = { r: 216, g: 174, b: 103 }; // rgba(216, 174, 103, 1)
let resultColor = { ...baseColor }; 
