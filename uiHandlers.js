//uiHandlers.js
import { displayBookmarks, handleFolderChange, handleSort, paginationState, allBookmarks, getAutoMovePreview, autoMoveDateFolders, fetchAndProcessBookmarks } from './bookmarkUtils.js';
import { todoFolders, renderTodoList, allFoldersList, moveBookmark } from './bookmarkUtils.js';

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

export function setupTodoListeners() {
    const $dropdown = $('#todoFolderDropdown');

    // 1. Initialize Fomantic Dropdown
    $dropdown.dropdown({
        onAdd: function (value) {
            if (!todoFolders.includes(value)) {
                todoFolders.push(value);
                renderTodoList();
            }
        },
        onRemove: function (value) {
            const index = todoFolders.indexOf(value);
            if (index > -1) {
                todoFolders.splice(index, 1);
                renderTodoList();
            }
        }
    });

    document.getElementById('todoListBody').addEventListener('input', (e) => {
        if (e.target.classList.contains('todo-move-search')) {
            const input = e.target;
            const bookmarkId = input.dataset.id;
            const folderName = input.value;

            // Find the matching folder in our master list
            const targetFolder = allFoldersList.find(f => f.title === folderName);

            if (targetFolder) {
                if (confirm(`Move bookmark to: ${targetFolder.path}?`)) {
                    moveBookmark(bookmarkId, targetFolder.id);
                    input.value = ''; // Reset input after move
                }
            }
        }
    });

    document.getElementById('confirmMoveBtn').addEventListener('click', async () => {
        showLoadingSpinner();
        const count = await autoMoveDateFolders();
        hideLoadingSpinner();
        alert(`Successfully moved ${count} bookmarks and cleaned up folders.`);
        fetchAndProcessBookmarks();
    });

}

// Function to populate the dropdown options from allFoldersList
export function populateTodoDropdown() {
    const $dropdown = $('#todoFolderDropdown');
    const uniqueFolders = [...new Set(allFoldersList.map(f => f.title))].sort();

    let html = '<option value="">Search and select folders to watch...</option>';
    uniqueFolders.forEach(name => {
        html += `<option value="${name}">${name}</option>`;
    });

    $dropdown.html(html);
    $dropdown.dropdown('refresh');
}

function renderTodoTags() {
    const container = document.getElementById('todoFolderTags');
    container.innerHTML = todoFolders.map(f => `
        <div class="tag" data-folder="${f}">
            <span>${f}</span>
            <button class="remove-todo-tag">&times;</button>
        </div>
    `).join('');
}

// Global helper for tag removal
window.removeTodoFolder = (folderName) => {
    const idx = todoFolders.indexOf(folderName);
    if (idx > -1) {
        todoFolders.splice(idx, 1);
        renderTodoTags();
        renderTodoList();
    }
};

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

export function setupPaginationControls() {
    // Sync the dropdown with pagination state on initialization
    const itemsPerPageSelect = document.getElementById('itemsPerPageSelect');
    itemsPerPageSelect.value = paginationState.itemsPerPage.toString();

    // Setup Show All button
    document.getElementById('showAllBtn').addEventListener('click', () => {
        paginationState.enabled = false;
        paginationState.currentPage = 1;

        showLoadingSpinner();
        // Use setTimeout so the "Show" class actually renders before the CPU-heavy display logic runs
        setTimeout(() => {
            displayBookmarks(allBookmarks);
            hideLoadingSpinner();
        }, 10);
    });

    // Setup Enable Pagination button
    document.getElementById('enablePaginationBtn').addEventListener('click', () => {
        paginationState.enabled = true;
        paginationState.currentPage = 1;
        showLoadingSpinner();
        displayBookmarks(allBookmarks);
        hideLoadingSpinner();
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
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.remove('overlay-hidden');
}

export function hideLoadingSpinner() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.add('overlay-hidden');
}