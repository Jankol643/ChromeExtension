// bookmarkUtils.js
import { excludedFolders } from './uiHandlers.js';

export let allBookmarks = [];
export let foldersMap = new Map();

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

export function displayBookmarks(bookmarks) {
    const tbody = document.querySelector('#bookmarksTable tbody');
    tbody.innerHTML = '';

    const filteredBookmarks = filterExcludedFolders(bookmarks);
    updateCounts(filteredBookmarks.length, bookmarks.length - filteredBookmarks.length);
    filteredBookmarks.forEach((b, index) => createBookmarkRow(b, tbody, index + 1));
}

export function filterExcludedFolders(bookmarks) {
    return bookmarks.filter(b => {
        return !excludedFolders.some(exFolder => b.folderPath.toLowerCase().includes(exFolder.toLowerCase()));
    });
}

export function handleFolderChange(selectedFolder) {
    if (selectedFolder === 'all') {
        displayBookmarks(allBookmarks);
    } else {
        const filtered = allBookmarks.filter(b => b.folderPath === selectedFolder);
        displayBookmarks(filtered);
    }
}

export function handleSort(column, ascending) {
    if (currentSort.column === column) {
        currentSort.ascending = !currentSort.ascending;
    } else {
        currentSort.column = column;
        currentSort.ascending = true;
    }
    updateSortIndicators();
    sortTable(column, currentSort.ascending);
}

function updateSortIndicators() {
    document.querySelectorAll('th.clickable-header').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.column === currentSort.column) {
            th.classList.add(currentSort.ascending ? 'sort-asc' : 'sort-desc');
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
    const countDiv = document.getElementById('bookmarksCount') || document.createElement('div');
    countDiv.id = 'bookmarksCount';
    countDiv.textContent = `Bookmarks Count: ${filteredCount}`;
    document.getElementById('countsContainer').appendChild(countDiv);

    const excludedDiv = document.getElementById('excludedCount') || document.createElement('div');
    excludedDiv.id = 'excludedCount';
    excludedDiv.textContent = `Excluded Bookmarks: ${excludedCount}`;
    document.getElementById('countsContainer').appendChild(excludedDiv);
}