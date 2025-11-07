// PDF Viewer for Kiosk Display
// Import PDF.js as ES module
import * as pdfjsLib from './lib/pdf.min.mjs';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = './lib/pdf.worker.min.mjs';

// Configuration
const PDF_PATH = 'assets/exhibition.pdf';
const SCALE = 2.0; // Higher scale for better quality on large screens

// State
let pdfDoc = null;
let totalPages = 0;
let currentPageIndex = 0;
let renderedPages = [];

// DOM elements
const scrollContainer = document.getElementById('pdfScrollContainer');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const currentPageSpan = document.getElementById('currentPage');
const totalPagesSpan = document.getElementById('totalPages');

// Initialize the PDF viewer
async function initPDFViewer() {
  try {
    // Show loading message
    scrollContainer.innerHTML = '<div class="loading">Loading PDF...</div>';
    
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument(PDF_PATH);
    pdfDoc = await loadingTask.promise;
    totalPages = pdfDoc.numPages;
    
    // Update total pages display
    totalPagesSpan.textContent = totalPages;
    
    // Clear loading message
    scrollContainer.innerHTML = '';
    
    // Render all pages
    await renderAllPages();
    
    // Update navigation state
    updateNavigation();
    
    // Setup scroll listener to track current page
    setupScrollListener();
    
  } catch (error) {
    console.error('Error loading PDF:', error);
    scrollContainer.innerHTML = `<div class="error-message">Error loading PDF: ${error.message}<br>Please ensure exhibition.pdf exists in the assets folder.</div>`;
  }
}

// Render all PDF pages
async function renderAllPages() {
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
    
    scrollContainer.appendChild(pageDiv);
    
    // Render the page
    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };
    
    await page.render(renderContext).promise;
    renderedPages.push(pageDiv);
  }
}

// Setup scroll listener to track which page is currently visible
function setupScrollListener() {
  let scrollTimeout;
  
  scrollContainer.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      updateCurrentPageFromScroll();
    }, 100);
  });
}

// Update current page based on scroll position
function updateCurrentPageFromScroll() {
  const containerRect = scrollContainer.getBoundingClientRect();
  const containerCenter = containerRect.left + containerRect.width / 2;
  
  let closestPage = 0;
  let minDistance = Infinity;
  
  renderedPages.forEach((pageDiv, index) => {
    const pageRect = pageDiv.getBoundingClientRect();
    const pageCenter = pageRect.left + pageRect.width / 2;
    const distance = Math.abs(containerCenter - pageCenter);
    
    if (distance < minDistance) {
      minDistance = distance;
      closestPage = index;
    }
  });
  
  if (closestPage !== currentPageIndex) {
    currentPageIndex = closestPage;
    updateNavigation();
  }
}

// Update navigation buttons and page counter
function updateNavigation() {
  currentPageSpan.textContent = currentPageIndex + 1;
  
  // Update button states
  prevBtn.disabled = currentPageIndex === 0;
  nextBtn.disabled = currentPageIndex === totalPages - 1;
}

// Navigate to specific page
function goToPage(pageIndex) {
  if (pageIndex < 0 || pageIndex >= totalPages) return;
  
  currentPageIndex = pageIndex;
  const pageDiv = renderedPages[pageIndex];
  
  if (pageDiv) {
    // Scroll to center the page
    const containerRect = scrollContainer.getBoundingClientRect();
    const pageRect = pageDiv.getBoundingClientRect();
    const scrollLeft = scrollContainer.scrollLeft;
    
    const targetScroll = scrollLeft + pageRect.left - containerRect.left - 
                        (containerRect.width - pageRect.width) / 2;
    
    scrollContainer.scrollTo({
      left: targetScroll,
      behavior: 'smooth'
    });
  }
  
  updateNavigation();
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

// Mouse wheel horizontal scrolling
scrollContainer.addEventListener('wheel', (e) => {
  if (Math.abs(e.deltaY) > 0) {
    e.preventDefault();
    scrollContainer.scrollLeft += e.deltaY * 1.2;
  }
}, { passive: false });

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPDFViewer);
} else {
  initPDFViewer();
}
