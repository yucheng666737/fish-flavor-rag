document.addEventListener('DOMContentLoaded', function() {
    // 添加页面载入动画
    const welcomeContent = document.querySelector('.welcome-content');
    welcomeContent.style.opacity = '0';
    welcomeContent.style.transform = 'translateY(20px)';
    
    setTimeout(() => {
        welcomeContent.style.transition = 'all 1s ease-out';
        welcomeContent.style.opacity = '1';
        welcomeContent.style.transform = 'translateY(0)';
    }, 100);
    
    // 添加特色区块的渐入效果
    const featureItems = document.querySelectorAll('.feature-item');
    featureItems.forEach((item, index) => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            item.style.transition = 'all 0.8s ease-out';
            item.style.opacity = '1';
            item.style.transform = 'translateY(0)';
        }, 300 + (index * 200));
    });
    
    // 添加滚动指示器的点击事件
    const scrollIndicator = document.querySelector('.scroll-indicator');
    if (scrollIndicator) {
        scrollIndicator.addEventListener('click', () => {
            const featuresSection = document.querySelector('.feature-grid');
            featuresSection.scrollIntoView({ behavior: 'smooth' });
        });
    }
    
    // 添加背景圆圈的动态效果
    const circles = document.querySelectorAll('.circle');
    circles.forEach(circle => {
        circle.addEventListener('mousemove', (e) => {
            const { clientX, clientY } = e;
            const { left, top, width, height } = circle.getBoundingClientRect();
            const x = (clientX - left - width / 2) / 25;
            const y = (clientY - top - height / 2) / 25;
            
            circle.style.transform = `translate(${x}px, ${y}px)`;
        });
        
        circle.addEventListener('mouseleave', () => {
            circle.style.transform = 'translate(0, 0)';
            circle.style.transition = 'transform 0.5s ease-out';
        });
    });
    
    // 添加开始按钮的悬停效果
    const startButton = document.querySelector('.btn-start');
    if (startButton) {
        startButton.addEventListener('mouseover', () => {
            startButton.style.transform = 'translateY(-5px) scale(1.05)';
        });
        
        startButton.addEventListener('mouseout', () => {
            startButton.style.transform = 'translateY(0) scale(1)';
        });
    }
}); 