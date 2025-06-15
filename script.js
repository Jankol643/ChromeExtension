// Store all bookmarks, folders, and exclusions
let allBookmarks = [];
let foldersMap = new Map(); // folderId -> folderTitle
let excludedFolders = []; // folders to exclude

// Handle column header click for sorting
let currentSort = { column: null, ascending: true };

document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    fetchAndProcessBookmarks();
    setupEventListeners();
});

// Initialize DOM elements
function initializeElements() {
    // No specific cache needed here
}

// Fetch all bookmarks and process
function fetchAndProcessBookmarks() {
    chrome.bookmarks.getTree((nodes) => {
        allBookmarks = [];
        foldersMap.clear();
        processNodes(nodes, []);
        populateFolderOptions();
        displayBookmarks(allBookmarks);
    });
}

// Set up event listeners
function setupEventListeners() {
    const folderSelect = document.getElementById('folderSelect');
    const excludeInput = document.getElementById('excludeFoldersInput');
    const tagsContainer = document.getElementById('excludedFoldersTags');
    const applyBtn = document.getElementById('applyExclusions');

    // Folder filter change
    folderSelect.addEventListener('change', () => handleFolderChange(folderSelect.value));

    // Sorting headers
    document.querySelectorAll('th.clickable-header').forEach(th => {
        th.addEventListener('click', () => handleSort(th.dataset.column));
    });

    // Add folder tags when user presses Enter or comma
    const inputField = document.getElementById('excludeFoldersInput');

    inputField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const folderName = inputField.value.trim();
            if (folderName !== '' && !excludedFolders.includes(folderName)) {
                addExcludedFolderTag(folderName);
            }
            inputField.value = '';
        }
    });

    // Handle clicking on tags to remove
    tagsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-tag')) {
            const folderName = e.target.parentElement.dataset.folder;
            removeExcludedFolderTag(folderName);
        }
    });

    // Apply button
    document.getElementById('applyExclusions').addEventListener('click', () => {
        // Update excludedFolders array from tags
        excludedFolders = Array.from(tagsContainer.children).map(tag => tag.dataset.folder);
        handleFolderChange(folderSelect.value);
    });
}

// Add a folder as a tag
function addExcludedFolderTag(folderName) {
    if (excludedFolders.includes(folderName)) return; // avoid duplicates

    // Create tag element
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

    // Add to array
    excludedFolders.push(folderName);
}

// Remove a folder from tags
function removeExcludedFolderTag(folderName) {
    // Remove from array
    excludedFolders = excludedFolders.filter(f => f !== folderName);
    // Remove from DOM
    const tagsContainer = document.getElementById('excludedFoldersTags');
    Array.from(tagsContainer.children).forEach(tag => {
        if (tag.dataset.folder === folderName) {
            tagsContainer.removeChild(tag);
        }
    });
}

// Parse comma-separated folder names from input (not used directly now, as tags handle that)
function parseExcludedFolders(inputText) {
    if (inputText.trim() === '') return [];
    return inputText.split(',').map(f => f.trim()).filter(f => f !== '');
}

// Recursive function to process bookmark nodes
function processNodes(nodes, currentPath) {
    nodes.forEach(node => {
        if (node.url) {
            addBookmark(node, currentPath);
        } else if (node.children) {
            registerFolder(node);
            processNodes(node.children, [...currentPath, node.title || 'Folder']);
        }
    });
}

// Add individual bookmark to allBookmarks
function addBookmark(node, currentPath) {
    allBookmarks.push({
        id: node.id,
        title: node.title,
        url: node.url,
        folderPath: currentPath.join(' > '),
        folderId: node.parentId,
        dateAdded: node.dateAdded || '',
    });
}

// Register folder in foldersMap
function registerFolder(node) {
    if (!foldersMap.has(node.id)) {
        foldersMap.set(node.id, node.title || 'Folder');
    }
}

// Populate folder options in select dropdown
function populateFolderOptions() {
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

// Display bookmarks in table
function displayBookmarks(bookmarks) {
    const tbody = document.querySelector('#bookmarksTable tbody');
    tbody.innerHTML = '';

    const filteredBookmarks = filterExcludedFolders(bookmarks);
    // Count excluded bookmarks
    const excludedBookmarksCount = bookmarks.length - filteredBookmarks.length;

    // Update counts
    updateBookmarksCount(filteredBookmarks.length);
    updateExcludedCount(excludedBookmarksCount);

    // Generate rows with row numbers
    filteredBookmarks.forEach((b, index) => createBookmarkRow(b, tbody, index + 1));
}

// Filter bookmarks based on excluded folders (matches anywhere in folderPath)
function filterExcludedFolders(bookmarks) {
    return bookmarks.filter(b => {
        // Exclude if any excluded folder appears anywhere in the folderPath
        return !excludedFolders.some(exFolder => b.folderPath.toLowerCase().includes(exFolder.toLowerCase()));
    });
}

// Create table row for a bookmark, including row number
function createBookmarkRow(bookmark, tbody, rowNumber) {
    const tr = document.createElement('tr');

    // Row number cell
    createCell(tr, rowNumber, 'rowNumber');

    // Title cell
    createCell(tr, bookmark.title, 'title');
    // URL cell
    createLinkCell(tr, bookmark.url);
    // Folder path cell
    createCell(tr, bookmark.folderPath || 'Root', 'folder');
    // Date added cell
    createDateCell(tr, bookmark.dateAdded);

    // Set data attributes for sorting
    tr.dataset.title = bookmark.title.toLowerCase();
    tr.dataset.url = bookmark.url;
    tr.dataset.folder = bookmark.folderPath;
    tr.dataset.dateAdded = bookmark.dateAdded;

    tbody.appendChild(tr);
}

// Helper functions
function createCell(tr, text, dataAttr) {
    const td = document.createElement('td');
    if (dataAttr === 'rowNumber') {
        td.style.textAlign = 'center';
        td.textContent = text;
        td.className = 'row-number'; // optional for styling
    } else if (dataAttr === 'folder') {
        td.className = 'folder-column'; // assign class for folder styling
        td.textContent = text;
    } else if (dataAttr === 'dateAdded') {
        td.className = 'date-column'; // assign class for date styling
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
    td.className = 'url-column'; // assign class for styling
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

// Update bookmarks count display
function updateBookmarksCount(count) {
    let countDiv = document.getElementById('bookmarksCount');
    if (!countDiv) {
        countDiv = document.createElement('div');
        countDiv.id = 'bookmarksCount';
        document.getElementById('countsContainer').appendChild(countDiv);
    }
    countDiv.textContent = `Bookmarks Count: ${count}`;
}

// Update excluded bookmarks count display
function updateExcludedCount(count) {
    let excludedDiv = document.getElementById('excludedCount');
    if (!excludedDiv) {
        excludedDiv = document.createElement('div');
        excludedDiv.id = 'excludedCount';
        document.getElementById('countsContainer').appendChild(excludedDiv);
    }
    excludedDiv.textContent = `Excluded Bookmarks: ${count}`;
}

// Handle folder filter change
function handleFolderChange(selectedFolder) {
    if (selectedFolder === 'all') {
        displayBookmarks(allBookmarks);
    } else {
        const filteredBookmarks = allBookmarks.filter(b => b.folderPath === selectedFolder);
        displayBookmarks(filteredBookmarks);
    }
}

function handleSort(column) {
    if (currentSort.column === column) {
        currentSort.ascending = !currentSort.ascending;
    } else {
        currentSort.column = column;
        currentSort.ascending = true;
    }
    // Add sort indicator styles
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