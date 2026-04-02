//bookmarkUtils.js
import { excludedFolders } from './uiHandlers.js';

export let allBookmarks = [];
export let foldersMap = new Map();

// Use an object for pagination state
export const paginationState = {
    enabled: true,
    currentPage: 1,
    itemsPerPage: 50
};

export function fetchAndProcessBookmarks() {
    chrome.bookmarks.getTree((nodes) => {
        allBookmarks = [];
        foldersMap.clear();
        processNodes(nodes, []);
        populateFolderOptions();
        displayBookmarks(allBookmarks);
    });
}

export function processNodes(nodes, currentPath) {
    nodes.forEach(node => {
        if (node.url) {
            addBookmark(node, currentPath);
        } else if (node.children) {
            registerFolder(node);
            processNodes(node.children, [...currentPath, node.title || 'Folder']);
        }
    });
}

export function addBookmark(node, currentPath) {
    allBookmarks.push({
        id: node.id,
        title: node.title,
        url: node.url,
        folderPath: currentPath.join(' > '),
        folderId: node.parentId,
        dateAdded: node.dateAdded || '',
    });
}

export function registerFolder(node) {
    if (!foldersMap.has(node.id)) {
        foldersMap.set(node.id, node.title || 'Folder');
    }
}

export function populateFolderOptions() {
    const folderSelect = document.getElementById('folderSelect');
    folderSelect.innerHTML = '<option value="all">All Bookmarks</option>';

    const uniqueFolders = new Set(allBookmarks.map(b => b.folderPath));
    Array.from(uniqueFolders).sort().forEach(folder => {
        const option = document.createElement('option');
        option.value = folder;
        option.textContent = folder || 'Root';
        folderSelect.appendChild(option);
    });
}

// In bookmarkUtils.js, update the displayBookmarks function:
export function displayBookmarks(bookmarks) {
    const tbody = document.querySelector('#bookmarksTable tbody');
    tbody.innerHTML = '';

    const filteredBookmarks = filterExcludedFolders(bookmarks);
    updateCounts(filteredBookmarks.length, bookmarks.length - filteredBookmarks.length);

    if (paginationState.enabled) {
        const startIndex = (paginationState.currentPage - 1) * paginationState.itemsPerPage;
        const endIndex = startIndex + paginationState.itemsPerPage;
        const paginatedBookmarks = filteredBookmarks.slice(startIndex, endIndex);

        paginatedBookmarks.forEach((b, index) => {
            const globalIndex = startIndex + index + 1;
            createBookmarkRow(b, tbody, globalIndex);
        });

        updatePaginationDisplay(filteredBookmarks.length);
    } else {
        filteredBookmarks.forEach((b, index) => createBookmarkRow(b, tbody, index + 1));
        updatePaginationDisplay(filteredBookmarks.length);
    }
}

// Update pagination display without recreating elements
function updatePaginationDisplay(totalItems) {
    const totalPages = Math.ceil(totalItems / paginationState.itemsPerPage);
    const pageInfoElement = document.getElementById('pageInfo');
    const currentPageDisplayElement = document.getElementById('currentPageDisplay');

    // Update page info - only show when pagination is enabled
    if (paginationState.enabled) {
        pageInfoElement.textContent = `Page ${paginationState.currentPage} of ${totalPages}`;
        currentPageDisplayElement.textContent = `Page ${paginationState.currentPage}`;
        pageInfoElement.style.display = 'block';
        currentPageDisplayElement.style.display = 'block';
    } else {
        // Hide page info when pagination is disabled
        pageInfoElement.style.display = 'none';
        currentPageDisplayElement.style.display = 'none';
    }

    // Update button states
    const firstBtn = document.getElementById('firstPageBtn');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const lastBtn = document.getElementById('lastPageBtn');
    const showAllBtn = document.getElementById('showAllBtn');
    const enablePaginationBtn = document.getElementById('enablePaginationBtn');

    // Always show pagination container
    document.getElementById('paginationContainer').style.display = 'block';

    if (paginationState.enabled) {
        firstBtn.disabled = paginationState.currentPage === 1;
        prevBtn.disabled = paginationState.currentPage === 1;
        nextBtn.disabled = paginationState.currentPage === totalPages;
        lastBtn.disabled = paginationState.currentPage === totalPages;

        // Show navigation when pagination is enabled
        document.querySelector('.page-navigation').style.display = 'flex';
        document.getElementById('itemsPerPageSelect').style.display = 'inline-block';

        showAllBtn.disabled = false;
        enablePaginationBtn.disabled = true;
    } else {
        // Hide navigation when pagination is disabled
        document.querySelector('.page-navigation').style.display = 'none';
        document.getElementById('itemsPerPageSelect').style.display = 'none';

        showAllBtn.disabled = true;
        enablePaginationBtn.disabled = false;
    }
}

export function filterExcludedFolders(bookmarks) {
    return bookmarks.filter(b => {
        return !excludedFolders.some(exFolder => b.folderPath.toLowerCase().includes(exFolder.toLowerCase()));
    });
}

// Reset to page 1 when filtering
export function handleFolderChange(selectedFolder) {
    paginationState.currentPage = 1;
    if (selectedFolder === 'all') {
        displayBookmarks(allBookmarks);
    } else {
        const filtered = allBookmarks.filter(b => b.folderPath === selectedFolder);
        displayBookmarks(filtered);
    }
}

export function handleSort(column, ascending) {
    if (window.currentSort.column === column) {
        window.currentSort.ascending = !window.currentSort.ascending;
    } else {
        window.currentSort.column = column;
        window.currentSort.ascending = true;
    }
    updateSortIndicators();
    sortTable(column, window.currentSort.ascending);
}

function updateSortIndicators() {
    document.querySelectorAll('th.clickable-header').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.column === window.currentSort.column) {
            th.classList.add(window.currentSort.ascending ? 'sort-asc' : 'sort-desc');
        }
    });
}

function sortTable(column, ascending) {
    const tbody = document.querySelector('#bookmarksTable tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));

    rows.sort((a, b) => {
        let aText = a.dataset[column] || '';
        let bText = b.dataset[column] || '';

        if (column === 'dateAdded') {
            aText = aText || '0';
            bText = bText || '0';
            return (parseInt(aText) - parseInt(bText)) * (ascending ? 1 : -1);
        }
        return aText.localeCompare(bText) * (ascending ? 1 : -1);
    });

    rows.forEach(row => tbody.appendChild(row));
}

function createBookmarkRow(bookmark, tbody, rowNumber) {
    const tr = document.createElement('tr');

    createCell(tr, rowNumber, 'rowNumber');
    createCell(tr, bookmark.title, 'title');
    createLinkCell(tr, bookmark.url);
    createCell(tr, bookmark.folderPath || 'Root', 'folder');
    createDateCell(tr, bookmark.dateAdded);

    tr.dataset.title = bookmark.title.toLowerCase();
    tr.dataset.url = bookmark.url;
    tr.dataset.folder = bookmark.folderPath;
    tr.dataset.dateAdded = bookmark.dateAdded;

    tbody.appendChild(tr);
}

function createCell(tr, text, dataAttr) {
    const td = document.createElement('td');
    if (dataAttr === 'rowNumber') {
        td.style.textAlign = 'center';
        td.textContent = text;
        td.className = 'row-number';
    } else if (dataAttr === 'folder') {
        td.className = 'folder-column';
        td.textContent = text;
    } else if (dataAttr === 'dateAdded') {
        td.className = 'date-column';
        if (text) {
            const date = new Date(text);
            td.textContent = date.toLocaleString();
        } else {
            td.textContent = '';
        }
    } else {
        td.textContent = text;
    }
    tr.appendChild(td);
}

function createLinkCell(tr, url) {
    const td = document.createElement('td');
    td.className = 'url-column';
    const link = document.createElement('a');
    link.href = url;
    link.textContent = url;
    link.target = '_blank';
    td.appendChild(link);
    tr.appendChild(td);
}

function createDateCell(tr, dateAdded) {
    const td = document.createElement('td');
    if (dateAdded) {
        const date = new Date(dateAdded);
        td.textContent = date.toLocaleString();
    } else {
        td.textContent = '';
    }
    tr.appendChild(td);
}

function updateCounts(filteredCount, excludedCount) {
    const countDiv = document.getElementById('bookmarksCount');
    countDiv.textContent = `Bookmarks Count: ${filteredCount}`;

    const excludedDiv = document.getElementById('excludedCount');
    if (excludedCount > 0) {
        excludedDiv.textContent = `Excluded: ${excludedCount}`;
        excludedDiv.style.display = 'block';
    } else {
        excludedDiv.style.display = 'none';
    }
}