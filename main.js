//main.js
import { fetchAndProcessBookmarks } from './bookmarkUtils.js';
import { setupEventListeners, setupPaginationControls, showLoadingSpinner, hideLoadingSpinner, setupTodoListeners } from './uiHandlers.js';

import { sortState } from './bookmarkUtils.js';
window.sortState = sortState;

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    setupTodoListeners();
    fetchAndProcessBookmarks();
    setupPaginationControls();
});