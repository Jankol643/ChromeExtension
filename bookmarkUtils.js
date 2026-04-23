//bookmarkUtils.js
import { excludedFolders, hideLoadingSpinner, showLoadingSpinner } from './uiHandlers.js';

export let allBookmarks = [];
export let foldersMap = new Map();
export let todoFolders = []; // List of folder names to "watch"
export let allFoldersList = []; // For the search dropdown
const DATE_REGEX = /^\d{8}$/; // Matches YYYYMMDD
const ROOT_FOLDER_IDS = ['1', '2', '3'];

// Use an object for pagination state
export const paginationState = {
    enabled: true,
    currentPage: 1,
    itemsPerPage: 50
};

export const sortState = {
    column: null,
    ascending: true
};

export function populateMoveToDatalist() {
    const datalist = document.getElementById('folderData');
    if (!datalist) return;

    // Create a set of options using the full path as the display and title as value
    datalist.innerHTML = allFoldersList.map(f =>
        `<option value="${f.title}">${f.path}</option>`
    ).join('');
}

export async function fetchAndProcessBookmarks() {
    showLoadingSpinner();
    chrome.bookmarks.getTree(async (nodes) => {
        allBookmarks = [];
        allFoldersList = [];

        // 1. Process EVERY node so they exist in allBookmarks
        processNodesWithFolders(nodes, []);

        // Populate the datalist for the "Move To..." column
        populateMoveToDatalist();

        // 2. Identify auto-movables for highlighting
        const previewData = await getAutoMovePreview();
        const autoMoveIds = new Set(previewData.map(item => item.id));

        allBookmarks.forEach(b => {
            if (autoMoveIds.has(b.id)) b.isAutoMovable = true;
        });

        import('./uiHandlers.js').then(module => {
            module.populateTodoDropdown();
        });

        // 3. Update UI
        populateFolderFilterOptions();
        displayBookmarks(allBookmarks);
        await renderTodoList(); // CRITICAL: Call this here!
        hideLoadingSpinner();
    });
}

function updateStats(autoMoveCount, todoCount) {
    document.getElementById('autoMoveCount').textContent = autoMoveCount;
    document.getElementById('todoCount').textContent = todoCount;
}

export function processNodesWithFolders(nodes, currentPath, parentNode = null) {
    nodes.forEach(node => {
        if (node.children) {
            const folderTitle = node.title || 'Folder';
            allFoldersList.push({ id: node.id, title: folderTitle, path: currentPath.join(' > ') });
            registerFolder(node);
            processNodesWithFolders(node.children, [...currentPath, folderTitle], node);
        } else if (node.url) {
            // Add EVERY bookmark to the list so the TODO filter can find them later
            addBookmark(node, currentPath);
        }
    });
}

export function moveBookmark(bookmarkId, targetFolderId) {
    chrome.bookmarks.move(bookmarkId, { parentId: targetFolderId }, (result) => {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            return;
        }
        // Refresh data to reflect changes
        fetchAndProcessBookmarks();
    });
}

export async function renderTodoList() {
    const todoContainer = document.getElementById('todoListBody');
    if (!todoContainer) return;

    // 1. Get preview data which contains the target mapping
    const previewData = await getAutoMovePreview();

    // Create a map for quick lookup: Bookmark ID -> Target Folder Name
    const autoMoveMap = new Map(previewData.map(item => [item.id, item.targetParent]));

    const todoItems = allBookmarks.filter(b => {
        const isAutoMove = autoMoveMap.has(b.id);
        const isUserWatched = todoFolders.some(f => b.folderPath.toLowerCase().includes(f.toLowerCase()));
        const isDirectlyInRoot = ROOT_FOLDER_IDS.includes(b.parentId);

        return isAutoMove || isUserWatched || isDirectlyInRoot;
    });

    todoContainer.innerHTML = todoItems.map(b => {
        const targetFolderName = autoMoveMap.get(b.id) || ""; // Get target if auto-movable
        const rowClass = autoMoveMap.has(b.id) ? 'class="auto-move-row"' : '';

        return `
            <tr ${rowClass}>
                <td>${b.title}</td>
                <td>${b.folderPath}</td>
                <td>${targetFolderName}</td> <!-- New column data -->
                <td>
                    <input type="text" list="folderData" class="todo-move-search" 
                           placeholder="Search destination..." data-id="${b.id}">
                </td>
            </tr>`;
    }).join('');

    document.getElementById('autoMoveCount').textContent = autoMoveMap.size;
    document.getElementById('todoCount').textContent = todoItems.length;
}

export function addBookmark(node, currentPath) {
    allBookmarks.push({
        id: node.id,
        title: node.title,
        url: node.url,
        folderPath: currentPath.join(' > '),
        parentTitle: currentPath[currentPath.length - 1] || '',
        parentId: node.parentId,
        dateAdded: node.dateAdded || '',
    });
}

export function registerFolder(node) {
    if (!foldersMap.has(node.id)) {
        foldersMap.set(node.id, node.title || 'Folder');
    }
}

export function populateFolderFilterOptions() {
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

    // Apply sorting if a sort column is selected
    let sortedBookmarks = filteredBookmarks;
    if (sortState.column) {
        sortedBookmarks = sortBookmarks(filteredBookmarks, sortState.column, sortState.ascending);
    }

    updateCounts(sortedBookmarks.length, bookmarks.length - filteredBookmarks.length);

    if (paginationState.enabled) {
        const startIndex = (paginationState.currentPage - 1) * paginationState.itemsPerPage;
        const endIndex = startIndex + paginationState.itemsPerPage;
        const paginatedBookmarks = sortedBookmarks.slice(startIndex, endIndex);

        paginatedBookmarks.forEach((b, index) => {
            const globalIndex = startIndex + index + 1;
            createBookmarkRow(b, tbody, globalIndex);
        });

        updatePaginationDisplay(sortedBookmarks.length);
    } else {
        sortedBookmarks.forEach((b, index) => createBookmarkRow(b, tbody, index + 1));
        updatePaginationDisplay(sortedBookmarks.length);
    }

    // Update sort indicators after displaying
    updateSortIndicators();
}

export function sortBookmarks(bookmarks, column, ascending) {
    return bookmarks.sort((a, b) => {
        // Use the cleaned values directly from bookmark properties
        let aValue, bValue;

        switch (column) {
            case 'title':
                aValue = cleanSortString(a.title || '');
                bValue = cleanSortString(b.title || '');
                break;
            case 'url':
                aValue = cleanSortString(a.url || '');
                bValue = cleanSortString(b.url || '');
                break;
            case 'folder':
                aValue = cleanSortString(a.folderPath || '');
                bValue = cleanSortString(b.folderPath || '');
                break;
            case 'dateAdded':
                aValue = a.dateAdded || 0;
                bValue = b.dateAdded || 0;
                break;
            case 'rowNumber':
                return 0; // Don't sort by row number
            default:
                aValue = '';
                bValue = '';
        }

        // Handle numeric sorting for dates
        if (column === 'dateAdded') {
            return (parseInt(aValue) - parseInt(bValue)) * (ascending ? 1 : -1);
        }

        // For other columns, use string comparison
        return compareStrings(aValue, bValue, ascending);
    });
}

// Function to remove emojis and specified characters
function cleanSortString(str) {
    // Remove emojis (common Unicode ranges for emojis)
    str = str.replace(/[\u{1F600}-\u{1F64F}]/gu, ''); // Emoticons
    str = str.replace(/[\u{1F300}-\u{1F5FF}]/gu, ''); // Symbols & pictographs
    str = str.replace(/[\u{1F680}-\u{1F6FF}]/gu, ''); // Transport & map symbols
    str = str.replace(/[\u{1F900}-\u{1F9FF}]/gu, ''); // Supplemental symbols

    // Remove specified characters: #, ", ', (, )
    str = str.replace(/[#"'()]/g, '');

    // Trim whitespace
    return str.trim();
}

// String comparison function
function compareStrings(a, b, ascending) {
    const aClean = a.toLowerCase();
    const bClean = b.toLowerCase();

    if (aClean === bClean) return 0;

    // Normal string comparison
    const comparison = aClean.localeCompare(bClean);

    // Apply ascending/descending order
    return ascending ? comparison : -comparison;
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
    showLoadingSpinner();
    paginationState.currentPage = 1;
    if (selectedFolder === 'all') {
        displayBookmarks(allBookmarks);
    } else {
        const filtered = allBookmarks.filter(b => b.folderPath === selectedFolder);
        displayBookmarks(filtered);
    }
    hideLoadingSpinner();
}

export function handleSort(column) {
    showLoadingSpinner();
    if (sortState.column === column) {
        sortState.ascending = !sortState.ascending;
    } else {
        sortState.column = column;
        sortState.ascending = true;
    }
    // Refresh display with new sorting
    const folderSelect = document.getElementById('folderSelect');
    handleFolderChange(folderSelect.value);
    hideLoadingSpinner();
}

function updateSortIndicators() {
    document.querySelectorAll('th.clickable-header').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.column === sortState.column) {
            th.classList.add(sortState.ascending ? 'sort-asc' : 'sort-desc');
        }
    });
}

function createBookmarkRow(bookmark, tbody, rowNumber) {
    const row = document.createElement('tr');
    if (bookmark.isAutoMovable) {
        row.classList.add('auto-move-row'); // Apply orange background
    }

    // Use bookmark.id for the first cell instead of rowNumber
    createCell(row, bookmark.id, 'rowNumber');
    createCell(row, bookmark.title, 'title');
    createLinkCell(row, bookmark.url);
    createCell(row, bookmark.folderPath || 'Root', 'folder');
    createDateCell(row, bookmark.dateAdded);

    tbody.appendChild(row);
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

export async function autoMoveDateFolders() {
    const previewData = await getAutoMovePreview();
    let movedCount = 0;
    const foldersToCleanup = new Set();

    for (const item of previewData) {
        try {
            // previewData now contains the folderId of the date folder
            const dateFolderArray = await chrome.bookmarks.get(item.folderId);
            const destinationId = dateFolderArray[0].parentId;

            await chrome.bookmarks.move(item.id, { parentId: destinationId });
            foldersToCleanup.add(item.folderId);
            movedCount++;
        } catch (e) { console.error("Move failed:", e); }
    }

    // Cleanup: Delete folders if they are now truly empty
    for (const folderId of foldersToCleanup) {
        const children = await chrome.bookmarks.getChildren(folderId);
        if (children.length === 0) {
            await chrome.bookmarks.remove(folderId);
        }
    }

    return movedCount;
}

export async function getAutoMovePreview() {
    const previewList = [];
    const nodes = await chrome.bookmarks.getTree();

    async function scan(node, parentNode = null, grandparent = null) {
        if (node.children) {
            const isDateFolder = DATE_REGEX.test(node.title);

            // If this is a date folder, mark its children
            if (isDateFolder && parentNode) {
                node.children.forEach(child => {
                    if (child.url) {
                        previewList.push({
                            id: child.id,
                            folderId: node.id, // ID of the date folder itself
                            targetParent: parentNode.title || "Root"
                        });
                    }
                });
            }

            // Continue scanning
            for (const child of node.children) {
                await scan(child, node, parentNode);
            }
        }
    }

    for (const root of nodes) { await scan(root); }
    return previewList;
}

