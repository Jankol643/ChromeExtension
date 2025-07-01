//main.js
import { fetchAndProcessBookmarks } from './bookmarkUtils.js';
import { setupEventListeners } from './uiHandlers.js';

// Store all bookmarks, folders, and exclusions
let allBookmarks = [];
let foldersMap = new Map(); // folderId -> folderTitle
let excludedFolders = []; // folders to exclude
let currentSort = { column: null, ascending: true };

document.addEventListener('DOMContentLoaded', () => {
    initialize();
});

function initialize() {
    setupEventListeners();
    fetchAndProcessBookmarks();
}