// Typography Control
document.addEventListener('DOMContentLoaded', function() {
    const decreaseBtn = document.getElementById('decrease-font');
    const increaseBtn = document.getElementById('increase-font');
    
    let currentSize = 16; // Base font size in pixels
    const minSize = 12;
    const maxSize = 24;
    const step = 2;

    // Load saved font size from localStorage
    const savedSize = localStorage.getItem('fontSize');
    if (savedSize) {
        currentSize = parseInt(savedSize);
        updateFontSize(currentSize);
    }

    // Decrease font size
    decreaseBtn.addEventListener('click', function() {
        if (currentSize > minSize) {
            currentSize -= step;
            updateFontSize(currentSize);
            saveFontSize(currentSize);
        }
    });

    // Increase font size
    increaseBtn.addEventListener('click', function() {
        if (currentSize < maxSize) {
            currentSize += step;
            updateFontSize(currentSize);
            saveFontSize(currentSize);
        }
    });

    // Update font size
    function updateFontSize(size) {
        document.documentElement.style.setProperty('--base-font-size', size + 'px');
    }

    // Save font size to localStorage
    function saveFontSize(size) {
        localStorage.setItem('fontSize', size);
    }

    // Keyboard navigation for horizontal scrolling
    document.addEventListener('keydown', function(e) {
        const container = document.querySelector('.scroll-container');
        const scrollAmount = window.innerWidth * 0.8;

        if (e.key === 'ArrowRight') {
            e.preventDefault();
            container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        }
    });

    // Touch/swipe support for mobile
    let touchStartX = 0;
    let touchEndX = 0;
    const container = document.querySelector('.scroll-container');

    container.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].screenX;
    });

    container.addEventListener('touchend', function(e) {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    });

    function handleSwipe() {
        const swipeThreshold = 50;
        const diff = touchStartX - touchEndX;

        if (Math.abs(diff) > swipeThreshold) {
            const scrollAmount = window.innerWidth * 0.8;
            if (diff > 0) {
                // Swipe left
                container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            } else {
                // Swipe right
                container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
            }
        }
    }
});
