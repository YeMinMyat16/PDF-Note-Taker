// State Management
let pdfDoc = null;
let pageNum = 1;
let pageRendering = false;
let pageNumPending = null;
let scale = 1.5;
let notes = [];

const canvas = document.getElementById('pdf-canvas');
const ctx = canvas.getContext('2d');

// Initialize PDF.js
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

/**
 * Get notes from LocalStorage
 */
function loadNotes() {
    const savedNotes = localStorage.getItem('pdf-notes');
    if (savedNotes) {
        notes = JSON.parse(savedNotes);
        renderNotes();
    }
}

/**
 * Save notes to LocalStorage
 */
function saveNotes() {
    localStorage.setItem('pdf-notes', JSON.stringify(notes));
}

/**
 * Render PDF page
 */
function renderPage(num) {
    pageRendering = true;

    // Get page
    pdfDoc.getPage(num).then(page => {
        const viewport = page.getViewport({ scale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Render page context
        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };

        const renderTask = page.render(renderContext);

        // Wait for rendering to finish
        renderTask.promise.then(() => {
            pageRendering = false;
            if (pageNumPending !== null) {
                // New page rendering is pending
                renderPage(pageNumPending);
                pageNumPending = null;
            }
        });
    });

    // Update page counters
    document.getElementById('page-num').textContent = num;
}

/**
 * If another page rendering in progress, waits until the rendering is finised. 
 * Otherwise, executes rendering immediately.
 */
function queueRenderPage(num) {
    if (pageRendering) {
        pageNumPending = num;
    } else {
        renderPage(num);
    }
}

/**
 * Show previous page
 */
function onPrevPage() {
    if (pageNum <= 1) return;
    pageNum--;
    queueRenderPage(pageNum);
}

/**
 * Show next page
 */
function onNextPage() {
    if (pageNum >= pdfDoc.numPages) return;
    pageNum++;
    queueRenderPage(pageNum);
}

/**
 * Handle file upload
 */
function handleFileUpload(e) {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
        const fileReader = new FileReader();

        fileReader.onload = function () {
            const typedarray = new Uint8Array(this.result);

            pdfjsLib.getDocument(typedarray).promise.then(doc => {
                pdfDoc = doc;
                document.getElementById('page-count').textContent = pdfDoc.numPages;
                document.getElementById('no-pdf-message').style.display = 'none';
                document.getElementById('pdf-container').style.display = 'flex';

                // Initial page render
                pageNum = 1;
                renderPage(pageNum);
            });
        };

        fileReader.readAsArrayBuffer(file);
    }
}

/**
 * Note Management
 */
function addNote() {
    if (!pdfDoc) {
        alert('Please upload a PDF first');
        return;
    }

    const newNote = {
        id: Date.now(),
        page: pageNum,
        content: ''
    };

    notes.unshift(newNote); // Add to beginning
    saveNotes();
    renderNotes();

    // Auto-focus the new note
    setTimeout(() => {
        const textarea = document.querySelector(`[data-id="${newNote.id}"] textarea`);
        if (textarea) textarea.focus();
    }, 100);
}

function deleteNote(id) {
    notes = notes.filter(n => n.id !== id);
    saveNotes();
    renderNotes();
}

function updateNote(id, content) {
    const index = notes.findIndex(n => n.id === id);
    if (index !== -1) {
        notes[index].content = content;
        saveNotes();
    }
}

function goToPage(num) {
    pageNum = num;
    queueRenderPage(pageNum);
}

/**
 * Render notes in the side panel
 */
function renderNotes() {
    const list = document.getElementById('notes-list');
    list.innerHTML = '';

    notes.forEach(note => {
        const card = document.createElement('div');
        card.className = 'note-card';
        card.dataset.id = note.id;

        card.innerHTML = `
            <div class="note-header-info">
                <span class="note-page-tag" onclick="goToPage(${note.page})">Page ${note.page}</span>
                <span class="note-delete" onclick="deleteNote(${note.id})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </span>
            </div>
            <textarea class="note-input" placeholder="Type your note here...">${note.content}</textarea>
        `;

        const textarea = card.querySelector('textarea');
        textarea.addEventListener('input', (e) => {
            updateNote(note.id, e.target.value);
            // Auto resize
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        });

        // Initial auto resize
        setTimeout(() => {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        }, 0);

        list.appendChild(card);
    });
}

// Event Listeners
document.getElementById('upload-btn').addEventListener('click', () => {
    document.getElementById('pdf-upload').click();
});

document.getElementById('pdf-upload').addEventListener('change', handleFileUpload);
document.getElementById('prev-page').addEventListener('click', onPrevPage);
document.getElementById('next-page').addEventListener('click', onNextPage);
document.getElementById('add-note-btn').addEventListener('click', addNote);

// Global Exposure for inline onclick
window.goToPage = goToPage;
window.deleteNote = deleteNote;

// Initial Load
loadNotes();
