// Store all bookmarks and folders
let allBookmarks = [];
let foldersMap = new Map(); // folderId -> folderTitle
// Handle column header click for sorting
let currentSort = { column: null, ascending: true };

// Initialize the extension
document.addEventListener('DOMContentLoaded', () => {
    const folderSelect = document.getElementById('folderSelect');
    const tbody = document.querySelector('#bookmarksTable tbody');

    // Fetch all bookmarks at startup
    chrome.bookmarks.getTree((nodes) => {
        allBookmarks = [];
        foldersMap.clear();

        processNodes(nodes, []);

        // Populate folder select options
        populateFolderOptions();

        // Show all bookmarks initially
        displayBookmarks(allBookmarks);
    });

    // Event listener for folder filtering
    folderSelect.addEventListener('change', () => {
        handleFolderChange(folderSelect.value);
    });

    // Event listeners for sorting columns
    document.querySelectorAll('th').forEach(th => {
        th.addEventListener('click', () => {
            handleSort(th.dataset.column);
        });
    });
});

// Recursive function to process bookmark tree nodes
function processNodes(nodes, currentPath) {
    nodes.forEach(node => {
        if (node.url) {
            // It's a bookmark
            allBookmarks.push({
                id: node.id,
                title: node.title,
                url: node.url,
                folderPath: currentPath.join(' > '),
                folderId: node.parentId,
                dateAdded: node.dateAdded || '',
            });
        } else if (node.children) {
            // It's a folder
            const folderTitle = node.title || 'Folder';
            foldersMap.set(node.id, folderTitle);
            processNodes(node.children, [...currentPath, folderTitle]);
        }
    });
}

// Populate folder options in the select dropdown
function populateFolderOptions() {
    const folderSelect = document.getElementById('folderSelect');
    folderSelect.innerHTML = '<option value="all">All Bookmarks</option>';

    const uniqueFolders = new Set();
    allBookmarks.forEach(b => {
        uniqueFolders.add(b.folderPath);
    });

    Array.from(uniqueFolders).sort().forEach(folder => {
        const option = document.createElement('option');
        option.value = folder;
        option.textContent = folder || 'Root';
        folderSelect.appendChild(option);
    });
}

// Display bookmarks in the table
function displayBookmarks(bookmarks) {
    const tbody = document.querySelector('#bookmarksTable tbody');
    tbody.innerHTML = '';

    bookmarks.forEach(b => {
        const tr = document.createElement('tr');

        const titleTd = document.createElement('td');
        titleTd.textContent = b.title;
        tr.appendChild(titleTd);

        const urlTd = document.createElement('td');
        const link = document.createElement('a');
        link.href = b.url;
        link.textContent = b.url;
        link.target = '_blank';
        urlTd.appendChild(link);
        tr.appendChild(urlTd);

        const folderTd = document.createElement('td');
        folderTd.textContent = b.folderPath || 'Root';
        tr.appendChild(folderTd);

        const dateTd = document.createElement('td');
        if (b.dateAdded) {
            const date = new Date(b.dateAdded);
            dateTd.textContent = date.toLocaleString();
        } else {
            dateTd.textContent = '';
        }
        tr.appendChild(dateTd);

        // Store data attributes for sorting
        tr.dataset.title = b.title.toLowerCase();
        tr.dataset.url = b.url;
        tr.dataset.folder = b.folderPath;
        tr.dataset.dateAdded = b.dateAdded;

        document.querySelector('#bookmarksTable tbody').appendChild(tr);
    });
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
        // Toggle sort order
        currentSort.ascending = !currentSort.ascending;
    } else {
        currentSort.column = column;
        currentSort.ascending = true;
    }
    sortTable(column, currentSort.ascending);
}

// Function to sort table rows
function sortTable(column, ascending) {
    const tbody = document.querySelector('#bookmarksTable tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));

    rows.sort((a, b) => {
        let aText = a.dataset[column];
        let bText = b.dataset[column];

        if (column === 'dateAdded') {
            aText = aText || '0';
            bText = bText || '0';
            return (parseInt(aText) - parseInt(bText)) * (ascending ? 1 : -1);
        }

        if (column === 'title' || column === 'folder') {
            return aText.localeCompare(bText) * (ascending ? 1 : -1);
        }

        return aText.localeCompare(bText) * (ascending ? 1 : -1);
    });

    // Append sorted rows
    rows.forEach(row => tbody.appendChild(row));
}