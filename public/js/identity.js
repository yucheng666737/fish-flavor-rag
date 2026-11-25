document.addEventListener('DOMContentLoaded', function() {
    // 获取所有身份卡片
    const identityCards = document.querySelectorAll('.identity-card');
    
    // 为每个身份卡片添加点击事件
    identityCards.forEach(card => {
        card.addEventListener('click', function() {
            // 获取所选身份
            const selectedIdentity = this.getAttribute('data-identity');
            
            // 将选择保存到 localStorage 中
            localStorage.removeItem('selectedElements');
            localStorage.removeItem('flavorStats');
            localStorage.setItem('selectedIdentity', selectedIdentity);
            
            // 获取显示名称
            const displayName = this.querySelector('h3').textContent;
            localStorage.setItem('identityDisplayName', displayName);
            
            // 添加選中效果標記
            identityCards.forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            
            // 添加选择动画
            animateSelection(this);
            
            // 創建閃光效果
            createFlashEffect(this);
            
            // 延迟后导航到风味调整页面 - 縮短為500毫秒
            setTimeout(() => {
                fadeOutPage(() => {
                    window.location.href = 'flavor.html';
                });
            }, 500);
        });
        
        // 添加悬停效果增强，使用類名而不是直接設置樣式
        card.addEventListener('mouseenter', function() {
            this.classList.add('hover-highlight');
        });
        
        card.addEventListener('mouseleave', function() {
            this.classList.remove('hover-highlight');
        });
    });
    
    // 添加頁面載入動畫
    animatePageLoad();
    
    // 添加返回首頁按鈕功能
    const backToHomeButton = document.getElementById('backToHome');
    if (backToHomeButton) {
        backToHomeButton.addEventListener('click', function() {
            fadeOutPage(() => {
                window.location.href = 'index.html';
            });
        });
        
        // 添加按鈕懸停效果
        backToHomeButton.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-3px)';
        });
        
        backToHomeButton.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    }
});

/**
 * 頁面載入動畫
 */
function animatePageLoad() {
    // 頁面標題動畫
    const pageTitle = document.querySelector('.page-title');
    if (pageTitle) {
        pageTitle.style.opacity = '0';
        pageTitle.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            pageTitle.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
            pageTitle.style.opacity = '1';
            pageTitle.style.transform = 'translateY(0)';
        }, 200);
    }
    
    // 指引文字動畫
    const guideText = document.querySelector('.guide-text');
    if (guideText) {
        guideText.style.opacity = '0';
        guideText.style.transform = 'translateY(-10px)';
        setTimeout(() => {
            guideText.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
            guideText.style.opacity = '1';
            guideText.style.transform = 'translateY(0)';
        }, 400);
    }
    
    // 卡片逐個顯示動畫
    const cards = document.querySelectorAll('.identity-card');
    cards.forEach((card, index) => {
        setTimeout(() => {
            card.classList.add('float-up');
        }, 600 + (100 * index));
    });
}

/**
 * 添加选择动画效果
 * @param {HTMLElement} element - 被选择的卡片元素
 */
function animateSelection(element) {
    // 为其他卡片添加淡出效果
    const allCards = document.querySelectorAll('.identity-card');
    allCards.forEach(card => {
        if (card !== element) {
            card.style.opacity = '0.3';
            card.style.transform = 'scale(0.9) translateY(10px)';
            card.style.filter = 'blur(2px)';
            card.style.transition = 'all 0.3s ease'; // 從0.5秒縮短為0.3秒
        }
    });
    
    // 为选中卡片添加放大和发光效果
    element.style.transform = 'scale(1.05) translateY(-15px)';
    element.style.boxShadow = '0 20px 40px rgba(230, 126, 34, 0.4)';
    element.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'; // 從0.5秒縮短為0.3秒
    
    // 顯示卡片介紹
    const cardBack = element.querySelector('.card-back');
    if (cardBack) {
        cardBack.style.transform = 'translateY(0)';
        cardBack.style.opacity = '1';
    }
}

/**
 * 創建卡片選中的閃光效果
 * @param {HTMLElement} element - 被選中的卡片元素
 */
function createFlashEffect(element) {
    const flash = document.createElement('div');
    flash.style.position = 'absolute';
    flash.style.top = '0';
    flash.style.left = '0';
    flash.style.width = '100%';
    flash.style.height = '100%';
    flash.style.backgroundColor = 'rgba(255,255,255,0.8)';
    flash.style.borderRadius = 'var(--border-radius)';
    flash.style.zIndex = '5';
    flash.style.opacity = '0';
    flash.style.transition = 'opacity 0.2s ease'; // 從0.3秒縮短為0.2秒
    
    element.appendChild(flash);
    
    setTimeout(() => {
        flash.style.opacity = '0.8';
    }, 30); // 從50毫秒縮短為30毫秒
    
    setTimeout(() => {
        flash.style.opacity = '0';
    }, 200); // 從300毫秒縮短為200毫秒
    
    setTimeout(() => {
        element.removeChild(flash);
    }, 400); // 從600毫秒縮短為400毫秒
}

/**
 * 頁面淡出動畫
 * @param {Function} callback - 動畫完成後執行的回調函數
 */
function fadeOutPage(callback) {
    // 創建覆蓋層
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'var(--warm-bg)';
    overlay.style.zIndex = '9999';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease'; // 從0.5秒縮短為0.3秒
    
    document.body.appendChild(overlay);
    
    // 淡入覆蓋層
    setTimeout(() => {
        overlay.style.opacity = '1';
    }, 30); // 從50毫秒縮短為30毫秒
    
    // 完成後執行回調
    setTimeout(() => {
        if (typeof callback === 'function') {
            callback();
        }
    }, 350); // 從550毫秒縮短為350毫秒
}

/**
 * 获取身份特定的提示信息
 * @param {string} identity - 身份标识符
 * @returns {string} 提示信息
 */
function getIdentityTips(identity) {
    const tips = {
        pregnant: '為準媽媽量身打造的配方，注重溫和平衡的口感，避免刺激性成分。',
        office: '適合高效工作的配方，提供均衡能量釋放與舒緩壓力的效果。',
        elderly: '專為銀髮族設計，著重關節與心血管健康，溫和不刺激。',
        beauty: '專為美麗肌膚設計，添加膠原蛋白和豐富抗氧化成分，提升肌膚彈性與光澤。',
        fitness: '專為健身愛好者設計，富含優質蛋白和活性氨基酸，促進肌肉恢復與增強體能表現。',
        custom: '依照您的個人喜好自由搭配，探索自己獨特的健康方案。'
    };
    
    return tips[identity] || '請根據自己的需求調整口味與成分。';
}