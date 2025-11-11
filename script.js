// PDF Viewer for Kiosk Display
// Import PDF.js as ES module
import * as pdfjsLib from './lib/pdf.min.mjs';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = './lib/pdf.worker.min.mjs';

// Configuration
const ASSETS_FOLDER = 'assets/';
const SCALE = 2.0; // Higher scale for better quality on large screens

// State
let pdfDoc = null;
let totalPages = 0;
let currentPageIndex = 0;
let renderedPages = [];
let isAnimating = false;

// DOM elements
const scrollContainer = document.getElementById('pdfScrollContainer');
const dotsContainer = document.getElementById('dotsContainer');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

// Find the PDF file from config
async function findPDF() {
  try {
    const configResponse = await fetch(ASSETS_FOLDER + 'config.json', { cache: 'no-cache' });
    if (configResponse.ok) {
      const config = await configResponse.json();
      if (config.pdfFile) {
        // Verify the PDF exists
        const pdfResponse = await fetch(ASSETS_FOLDER + config.pdfFile, { 
          method: 'HEAD',
          cache: 'no-cache'
        });
        
        if (pdfResponse.ok) {
          return ASSETS_FOLDER + config.pdfFile;
        } else {
          throw new Error(`PDF file "${config.pdfFile}" specified in config.json was not found in assets folder.`);
        }
      } else {
        throw new Error('config.json is missing "pdfFile" property.');
      }
    } else {
      throw new Error('config.json not found in assets folder.');
    }
  } catch (e) {
    throw new Error(`Failed to load PDF: ${e.message} Please ensure assets/config.json exists with {"pdfFile": "yourfile.pdf"}`);
  }
}

// Initialize the PDF viewer
async function initPDFViewer() {
  try {
    // Show loading message
    scrollContainer.innerHTML = '<div class="loading">Loading PDF...</div>';
    
    // Find the PDF file
    const pdfPath = await findPDF();
    console.log('Loading PDF from:', pdfPath);
    
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument(pdfPath);
    pdfDoc = await loadingTask.promise;
    totalPages = pdfDoc.numPages;
    
    // Clear loading message
    scrollContainer.innerHTML = '';
    
    // Generate navigation dots
    generateDots();
    
    // Render all pages
    await renderAllPages();
    
    // Update navigation state
    updateNavigation();
    
    // Start at first page
    goToPage(0);
    
  } catch (error) {
    console.error('Error loading PDF:', error);
    scrollContainer.innerHTML = `<div class="error-message">Error loading PDF: ${error.message}<br>Please ensure exhibition.pdf exists in the assets folder.</div>`;
  }
}

// Render all PDF pages
async function renderAllPages() {
  // Create wrapper for slides
  const slidesWrapper = document.createElement('div');
  slidesWrapper.className = 'pdf-slides-wrapper';
  slidesWrapper.id = 'slidesWrapper';
  scrollContainer.appendChild(slidesWrapper);
  
  renderedPages = [];
  
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: SCALE });
    
    // Create canvas for this page
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    // Create wrapper div
    const pageDiv = document.createElement('div');
    pageDiv.className = 'pdf-page';
    pageDiv.setAttribute('data-page', pageNum);
    pageDiv.appendChild(canvas);
    
    slidesWrapper.appendChild(pageDiv);
    
    // Render the page
    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };
    
    await page.render(renderContext).promise;
    renderedPages.push(pageDiv);
  }
}

// Generate navigation dots
function generateDots() {
  dotsContainer.innerHTML = '';
  for (let i = 0; i < totalPages; i++) {
    const dot = document.createElement('div');
    dot.className = 'page-dot';
    if (i === 0) dot.classList.add('active');
    dot.addEventListener('click', () => goToPage(i));
    dotsContainer.appendChild(dot);
  }
}

// Update navigation buttons and page counter
function updateNavigation() {
  // Update button states
  prevBtn.disabled = currentPageIndex === 0;
  nextBtn.disabled = currentPageIndex === totalPages - 1;
  
  // Update dots
  const dots = dotsContainer.querySelectorAll('.page-dot');
  dots.forEach((dot, index) => {
    if (index === currentPageIndex) {
      dot.classList.add('active');
    } else {
      dot.classList.remove('active');
    }
  });
}

// Navigate to specific page
function goToPage(pageIndex) {
  if (pageIndex < 0 || pageIndex >= totalPages) return;
  
  // Don't do anything if we're already on this page
  if (pageIndex === currentPageIndex) return;
  
  // Don't allow navigation while animating
  if (isAnimating) return;
  
  isAnimating = true;
  const previousIndex = currentPageIndex;
  currentPageIndex = pageIndex;
  
  // Use transform to slide to the page
  const slidesWrapper = document.getElementById('slidesWrapper');
  if (slidesWrapper) {
    const translateX = -pageIndex * 100; // 100vw per page
    slidesWrapper.style.transform = `translateX(${translateX}vw)`;
  }
  
  // Animate dots during transition
  animateDotsTransition(previousIndex, pageIndex);
  
  updateNavigation();
  
  // Allow new navigation after animation completes
  // Unlock after the slide animation finishes (match CSS duration + small buffer)
  setTimeout(() => {
    isAnimating = false;
  }, 650); // 600ms CSS + 50ms buffer
}

// Animate the fill transition between dots
function animateDotsTransition(fromIndex, toIndex) {
  const dots = dotsContainer.querySelectorAll('.page-dot');
  const isGoingForward = toIndex > fromIndex;
  
  dots.forEach((dot, index) => {
    // Clear only the class that controls origin; keep active state changes below
    dot.classList.remove('fill-from-right');

    if (index === fromIndex) {
      // Old dot: set transform origin depending on direction so removal animates correctly
      if (isGoingForward) {
        // Going forward: shrink toward the right edge
        dot.classList.add('fill-from-right');
      } else {
        // Going backward: ensure origin is left (default)
        dot.classList.remove('fill-from-right');
      }
      // Remove active after a brief delay to trigger the animation
      setTimeout(() => dot.classList.remove('active'), 10);

    } else if (index === toIndex) {
      // New dot: set origin then activate to animate fill direction
      if (isGoingForward) {
        // Going forward, fill from left (default)
        dot.classList.remove('fill-from-right');
      } else {
        // Going backward, fill from right
        dot.classList.add('fill-from-right');
      }
      dot.classList.add('active');

    } else {
      // All other dots: not active
      dot.classList.remove('active');
    }
  });
}

// Event listeners for navigation buttons
prevBtn.addEventListener('click', () => {
  goToPage(currentPageIndex - 1);
});

nextBtn.addEventListener('click', () => {
  goToPage(currentPageIndex + 1);
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    goToPage(currentPageIndex - 1);
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    goToPage(currentPageIndex + 1);
  } else if (e.key === 'Home') {
    e.preventDefault();
    goToPage(0);
  } else if (e.key === 'End') {
    e.preventDefault();
    goToPage(totalPages - 1);
  }
});

// Mouse wheel navigation
let wheelTimeout;
document.addEventListener('wheel', (e) => {
  // Debounce wheel events to prevent too rapid switching
  clearTimeout(wheelTimeout);
  wheelTimeout = setTimeout(() => {
    if (e.deltaY > 0) {
      // Scroll down = next page
      goToPage(currentPageIndex + 1);
    } else if (e.deltaY < 0) {
      // Scroll up = previous page
      goToPage(currentPageIndex - 1);
    }
  }, 50);
}, { passive: true });

// Touch / swipe navigation for touch screens
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let isTouching = false;
const MIN_SWIPE_DISTANCE_PX = 50; // minimum horizontal movement to count as swipe
const MAX_VERTICAL_DRIFT_PX = 100; // too-much-vertical-movement cancels swipe

const getSlidesWrapper = () => document.getElementById('slidesWrapper');

// We'll listen on the scrollContainer so it works even before pages are rendered
scrollContainer.addEventListener('touchstart', (ev) => {
  if (!ev.touches || ev.touches.length !== 1) return;
  const t = ev.touches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
  touchStartTime = Date.now();
  isTouching = true;
  const wrapper = getSlidesWrapper();
  if (wrapper) wrapper.style.transition = 'none'; // disable transition for drag feel
}, { passive: true });

scrollContainer.addEventListener('touchmove', (ev) => {
  if (!isTouching) return;
  if (!ev.touches || ev.touches.length !== 1) return;
  const t = ev.touches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;

  // If vertical movement dominates, don't treat as horizontal swipe (allow browser to handle)
  if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
    // Let the browser handle vertical gestures
    return;
  }

  // Prevent native scrolling while dragging horizontally
  ev.preventDefault();

  const wrapper = getSlidesWrapper();
  if (!wrapper) return;

  // Convert pixel delta to vw percentage for the existing transform usage
  const vwDelta = (dx / window.innerWidth) * 100;
  const baseTranslate = -currentPageIndex * 100;
  wrapper.style.transform = `translateX(${baseTranslate + vwDelta}vw)`;
}, { passive: false });

scrollContainer.addEventListener('touchend', (ev) => {
  if (!isTouching) return;
  isTouching = false;
  const touchEndTime = Date.now();
  const elapsed = touchEndTime - touchStartTime;

  // Some devices may report changedTouches on touchend
  const changed = ev.changedTouches && ev.changedTouches[0] ? ev.changedTouches[0] : null;
  const endX = changed ? changed.clientX : touchStartX;
  const endY = changed ? changed.clientY : touchStartY;

  const dx = endX - touchStartX;
  const dy = endY - touchStartY;

  const wrapper = getSlidesWrapper();
  if (wrapper) wrapper.style.transition = ''; // restore transition

  // Quick guard: if vertical drift is large, cancel
  if (Math.abs(dy) > MAX_VERTICAL_DRIFT_PX && Math.abs(dy) > Math.abs(dx)) {
    // Snap back
    if (wrapper) wrapper.style.transform = `translateX(${-currentPageIndex * 100}vw)`;
    return;
  }

  // Determine if it's a swipe
  if (Math.abs(dx) >= MIN_SWIPE_DISTANCE_PX && Math.abs(dx) > Math.abs(dy)) {
    if (dx < 0) {
      // swiped left => next page
      goToPage(currentPageIndex + 1);
    } else {
      // swiped right => previous page
      goToPage(currentPageIndex - 1);
    }
  } else {
    // Not enough movement -> snap back to current page
    if (wrapper) wrapper.style.transform = `translateX(${-currentPageIndex * 100}vw)`;
  }
}, { passive: true });

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPDFViewer);
} else {
  initPDFViewer();
}
