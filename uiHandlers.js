//uiHandlers.js
import { handleFolderChange, handleSort } from './bookmarkUtils.js';

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