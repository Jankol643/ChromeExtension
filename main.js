//main.js
import { fetchAndProcessBookmarks } from './bookmarkUtils.js';
import { setupEventListeners, setupPaginationControls, showLoadingSpinner, hideLoadingSpinner } from './uiHandlers.js';

let currentSort = { column: null, ascending: true };
// Add this line to make currentSort available globally
window.currentSort = currentSort;

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    fetchAndProcessBookmarks();
    setupPaginationControls();
    hideLoadingSpinner();
});