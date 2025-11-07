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

// Find the first PDF file in the assets folder
async function findPDF() {
  // First, try to load from config file (recommended approach)
  try {
    const configResponse = await fetch(ASSETS_FOLDER + 'config.json', { cache: 'no-cache' });
    if (configResponse.ok) {
      const config = await configResponse.json();
      if (config.pdfFile) {
        // Verify the PDF exists
        const pdfResponse = await fetch(ASSETS_FOLDER + config.pdfFile, { 
          method: 'HEAD',
          cache: 'no-cache'
        }).catch(() => null);
        
        if (pdfResponse && pdfResponse.ok) {
          return ASSETS_FOLDER + config.pdfFile;
        }
      }
    }
  } catch (e) {
    // Config file not found or invalid, fall back to auto-detection
  }
  
  // Fallback: Try common PDF filenames
  const commonNames = [
    'exhibition.pdf',
    'presentation.pdf', 
    'LickTheWalls.pdf',
    'slides.pdf',
    'deck.pdf',
    'kiosk.pdf'
  ];
  
  for (const name of commonNames) {
    try {
      const response = await fetch(ASSETS_FOLDER + name, { 
        method: 'HEAD',
        cache: 'no-cache'
      }).catch(() => null);
      
      if (response && response.ok) {
        return ASSETS_FOLDER + name;
      }
    } catch (e) {
      // Silently continue to next filename
    }
  }
  
  // If no PDF found, show helpful error
  throw new Error('No PDF found in assets folder. Either add a config.json with {"pdfFile": "yourfile.pdf"} or use a common filename like exhibition.pdf');
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
  setTimeout(() => {
    isAnimating = false;
  }, 400); // Match the 0.4s CSS transition
}

// Animate the fill transition between dots
function animateDotsTransition(fromIndex, toIndex) {
  const dots = dotsContainer.querySelectorAll('.page-dot');
  const isGoingForward = toIndex > fromIndex;
  
  dots.forEach((dot, index) => {
    // Remove all animation classes first
    dot.classList.remove('fill-from-right', 'empty-to-right', 'empty-to-left');
    
    if (index === fromIndex) {
      // Old dot: empty it in the direction we're moving
      if (isGoingForward) {
        dot.classList.add('empty-to-right'); // Going forward, empty to right
      } else {
        dot.classList.add('empty-to-left'); // Going backward, empty to left
      }
      // Remove active after a brief delay to trigger the animation
      setTimeout(() => dot.classList.remove('active'), 10);
      
    } else if (index === toIndex) {
      // New dot: fill it from the opposite direction
      if (isGoingForward) {
        // Going forward, fill from left (default)
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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPDFViewer);
} else {
  initPDFViewer();
}
