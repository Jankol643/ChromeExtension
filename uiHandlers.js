//uiHandlers.js
import { displayBookmarks, handleFolderChange, handleSort, paginationState, allBookmarks } from './bookmarkUtils.js';

export let excludedFolders = [];

export function setupEventListeners() {
    const folderSelect = document.getElementById('folderSelect');
    const excludeInput = document.getElementById('excludeFoldersInput');
    const tagsContainer = document.getElementById('excludedFoldersTags');
    const applyBtn = document.getElementById('applyExclusions');

    folderSelect.addEventListener('change', () => handleFolderChange(folderSelect.value));

    document.querySelectorAll('th.clickable-header').forEach(th => {
        th.addEventListener('click', () => handleSort(th.dataset.column));
    });

    excludeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const folderName = excludeInput.value.trim();
            if (folderName !== '' && !excludedFolders.includes(folderName)) {
                addExcludedFolderTag(folderName);
            }
            excludeInput.value = '';
        }
    });

    tagsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-tag')) {
            const folderName = e.target.parentElement.dataset.folder;
            removeExcludedFolderTag(folderName);
        }
    });

    document.getElementById('applyExclusions').addEventListener('click', () => {
        // update excludedFolders from tags
        excludedFolders = Array.from(document.querySelectorAll('#excludedFoldersTags .tag')).map(tag => tag.dataset.folder);
        handleFolderChange(document.getElementById('folderSelect').value);
    });
}

export function addExcludedFolderTag(folderName) {
    if (excludedFolders.includes(folderName)) return;

    const tag = document.createElement('div');
    tag.className = 'tag';
    tag.dataset.folder = folderName;

    const span = document.createElement('span');
    span.textContent = folderName;
    tag.appendChild(span);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-tag';
    removeBtn.innerHTML = '&times;';
    tag.appendChild(removeBtn);

    document.getElementById('excludedFoldersTags').appendChild(tag);
    excludedFolders.push(folderName);
}

export function removeExcludedFolderTag(folderName) {
    excludedFolders = excludedFolders.filter(f => f !== folderName);
    const tagsContainer = document.getElementById('excludedFoldersTags');
    Array.from(tagsContainer.children).forEach(tag => {
        if (tag.dataset.folder === folderName) {
            tagsContainer.removeChild(tag);
        }
    });
}

// In uiHandlers.js, update the setupPaginationControls function:
export function setupPaginationControls() {
    // Sync the dropdown with pagination state on initialization
    const itemsPerPageSelect = document.getElementById('itemsPerPageSelect');
    itemsPerPageSelect.value = paginationState.itemsPerPage.toString();

    // Setup Show All button
    document.getElementById('showAllBtn').addEventListener('click', () => {
        paginationState.enabled = false;
        paginationState.currentPage = 1;
        displayBookmarks(allBookmarks);
    });

    // Setup Enable Pagination button
    document.getElementById('enablePaginationBtn').addEventListener('click', () => {
        paginationState.enabled = true;
        paginationState.currentPage = 1;
        displayBookmarks(allBookmarks);
    });

    // Setup navigation buttons
    document.getElementById('firstPageBtn').addEventListener('click', () => {
        if (paginationState.enabled) {
            paginationState.currentPage = 1;
            displayBookmarks(allBookmarks);
        }
    });

    document.getElementById('prevPageBtn').addEventListener('click', () => {
        if (paginationState.enabled && paginationState.currentPage > 1) {
            paginationState.currentPage--;
            displayBookmarks(allBookmarks);
        }
    });

    document.getElementById('nextPageBtn').addEventListener('click', () => {
        if (paginationState.enabled) {
            const filteredBookmarks = filterExcludedFolders(allBookmarks);
            const totalPages = Math.ceil(filteredBookmarks.length / paginationState.itemsPerPage);
            if (paginationState.currentPage < totalPages) {
                paginationState.currentPage++;
                displayBookmarks(allBookmarks);
            }
        }
    });

    document.getElementById('lastPageBtn').addEventListener('click', () => {
        if (paginationState.enabled) {
            const filteredBookmarks = filterExcludedFolders(allBookmarks);
            const totalPages = Math.ceil(filteredBookmarks.length / paginationState.itemsPerPage);
            paginationState.currentPage = totalPages;
            displayBookmarks(allBookmarks);
        }
    });

    // Setup items per page selector
    itemsPerPageSelect.addEventListener('change', (e) => {
        paginationState.itemsPerPage = parseInt(e.target.value);
        paginationState.currentPage = 1;
        if (paginationState.enabled) {
            displayBookmarks(allBookmarks);
        }
    });
}

// Helper function to filter bookmarks
function filterExcludedFolders(bookmarks) {
    return bookmarks.filter(b => {
        return !excludedFolders.some(exFolder => b.folderPath.toLowerCase().includes(exFolder.toLowerCase()));
    });
}

// Update the loading spinner functions
export function showLoadingSpinner() {
    document.getElementById('loadingOverlay').classList.remove('overlay-hidden');
}

export function hideLoadingSpinner() {
    document.getElementById('loadingOverlay').classList.add('overlay-hidden');
}