// Store all bookmarks and folders
let allBookmarks = [];
let foldersMap = new Map(); // folderId -> folderTitle
let currentSort = { column: null, ascending: true };

// Initialize the extension
document.addEventListener('DOMContentLoaded', () => {
    const folderSelect = document.getElementById('folderSelect');
    const tbody = document.querySelector('#bookmarksTable tbody');

    // Fetch all bookmarks at startup
    chrome.bookmarks.getTree((nodes) => {
        allBookmarks = [];
        foldersMap.clear();

        // Recursively process nodes
        function processNodes(nodes, currentPath = []) {
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

        processNodes(nodes);

        // Populate folder select
        populateFolderOptions();

        // Show all bookmarks initially
        displayBookmarks(allBookmarks);
    });

    // Populate folder options
    function populateFolderOptions() {
        // Clear existing options except "All Bookmarks"
        folderSelect.innerHTML = '<option value="all">All Bookmarks</option>';

        // Get unique folders
        const uniqueFolders = new Set();
        allBookmarks.forEach(b => {
            uniqueFolders.add(b.folderPath);
        });

        // Add to select
        Array.from(uniqueFolders).sort().forEach(folder => {
            const option = document.createElement('option');
            option.value = folder;
            option.textContent = folder || 'Root';
            folderSelect.appendChild(option);
        });
    }

    // Display bookmarks in table
    function displayBookmarks(bookmarks) {
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

            // Store data for sorting
            tr.dataset.title = b.title.toLowerCase();
            tr.dataset.url = b.url;
            tr.dataset.folder = b.folderPath;
            tr.dataset.dateAdded = b.dateAdded;

            tbody.appendChild(tr);
        });
    }

    // Filter bookmarks based on folder selection
    folderSelect.addEventListener('change', () => {
        const selectedFolder = folderSelect.value;
        let filteredBookmarks;
        if (selectedFolder === 'all') {
            filteredBookmarks = allBookmarks;
        } else {
            filteredBookmarks = allBookmarks.filter(b => b.folderPath === selectedFolder);
        }
        displayBookmarks(filteredBookmarks);
    });

    // Sorting functionality
    document.querySelectorAll('th').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.dataset.column;
            if (currentSort.column === column) {
                // Toggle sort order
                currentSort.ascending = !currentSort.ascending;
            } else {
                currentSort.column = column;
                currentSort.ascending = true;
            }
            sortTable(column, currentSort.ascending);
        });
    });

    function sortTable(column, ascending) {
        const rows = Array.from(document.querySelectorAll('#bookmarksTable tbody tr'));
        rows.sort((a, b) => {
            let aText = a.dataset[column];
            let bText = b.dataset[column];

            // For date, compare as number
            if (column === 'dateAdded') {
                aText = aText || '0';
                bText = bText || '0';
                return (parseInt(aText) - parseInt(bText)) * (ascending ? 1 : -1);
            }

            // For URL or Title, compare as lowercase strings
            if (column === 'title' || column === 'folder') {
                return aText.localeCompare(bText) * (ascending ? 1 : -1);
            }

            // Default string comparison
            return aText.localeCompare(bText) * (ascending ? 1 : -1);
        });

        // Append sorted rows
        const tbody = document.querySelector('#bookmarksTable tbody');
        rows.forEach(row => tbody.appendChild(row));
    }
});