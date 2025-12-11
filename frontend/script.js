// file: script.js
const API_URL = "http://127.0.0.1:5000";

// DOM Elements
const voteBtn = document.getElementById('voteBtn');
const mineBtn = document.getElementById('mineBtn');
const resultsBtn = document.getElementById('resultsBtn');
const exportAllBtn = document.getElementById('exportAllBtn');
const printBtn = document.getElementById('printBtn');
const messageDiv = document.getElementById('message');

const votePopup = document.getElementById('votePopup');
const closeVoteBtn = document.getElementById('closeVoteBtn');
const submitVoteBtn = document.getElementById('submitVoteBtn');
const popupVoterId = document.getElementById('popupVoterId');
const popupBarangay = document.getElementById('popupBarangay');
const candidateContainer = document.getElementById('candidateContainer');

const resultsContainer = document.getElementById('resultsDisplayContainer');
const resultsDiv = document.getElementById('resultsDisplay');
const blockchainDisplay = document.getElementById('blockchainDisplay');

// --- POPUP CONTROL ---
voteBtn.addEventListener('click', () => votePopup.style.display = 'flex');
closeVoteBtn.addEventListener('click', () => votePopup.style.display = 'none');

// --- TEMP MESSAGE POPUP ---
function showTempMessage(msg, duration = 5000) {
    messageDiv.textContent = msg;
    messageDiv.style.display = 'block';
    setTimeout(() => { messageDiv.style.display = 'none'; messageDiv.textContent = ''; }, duration);
}

// --- SAFE FETCH ---
async function safeFetch(url, options) {
    try {
        const res = await fetch(url, options);
        let data;
        try { data = await res.json(); } catch { throw new Error(`Server returned non-JSON (status ${res.status})`); }
        if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
        return data;
    } catch (err) { throw err; }
}

// --- LOAD CANDIDATES ---
let candidatesByRole = {};
async function loadCandidates() {
    candidateContainer.innerHTML = '';
    try {
        const data = await safeFetch(`${API_URL}/candidates`);
        console.log('Candidates loaded:', data);
        candidatesByRole = data;
        
        if (!candidatesByRole || Object.keys(candidatesByRole).length === 0) {
            throw new Error('No candidates returned from API');
        }
    } catch (e) {
        console.error('Error loading candidates, using fallback:', e);
        candidatesByRole = {
            "Mayor": ["AGDA, DAYAN (PFP)", "PICARDAL, DINDO (IND)"],
            "Vice Mayor": ["TIU SONCO, EMMANUEL (LAKAS)", "FRANCO, KUYA VIC OHOYY (NPC)"],
            "Councilor": ["DAZA, ZEN (PFP)", "ANACTA, KATRINA (PFP)", "LIMBAUAN, LYRA GEL (PFP)", "TIU, GLAIZA (PFP)", "BAGACAY, TOTOY ENAT (IND)", "UY, FRICH BAYLON (PFP)", "CAINDAY, KATHLYN JANE (PFP)", "GALO, IAN ERVIN (IND)", "ARAGO, MELCHO (IND)", "ESCOTO, BOTOY (LAKAS)", "ANG, JAY ANTHONY (PFP)", "CAPITO, ANNABELLE (PDPLBN)", "APELADO, JESSIE (IND)", "BAGRO, CELERINO JR. (IND)", "ABOBO, WILFRED (IND)", "AFABLE, CRIS (IND)", "CAMPOMANES, ONINS (IND)"]
        };
    }

    const displayOrder = ["Mayor", "Vice Mayor", "Councilor"];
    displayOrder.forEach(role => {
        if (!candidatesByRole[role]) {
            console.warn(`Missing role: ${role}`);
            return;
        }

        const roleHeader = document.createElement('h4');
        roleHeader.textContent = role;
        roleHeader.style.textAlign = 'center';
        candidateContainer.appendChild(roleHeader);

        candidatesByRole[role].forEach(candidate => {
            const label = document.createElement('label');
            label.style.display = 'flex';
            label.style.alignItems = 'center';
            label.style.marginBottom = '8px';
            
            const input = document.createElement('input');
            input.type = (role === "Councilor") ? 'checkbox' : 'radio';
            input.name = role;
            input.value = candidate;
            input.style.marginRight = '10px';
            input.style.cursor = 'pointer';
            input.style.width = '18px';
            input.style.height = '18px';
            
            const text = document.createElement('span');
            text.textContent = candidate;
            text.style.cursor = 'pointer';
            
            label.appendChild(input);
            label.appendChild(text);
            candidateContainer.appendChild(label);
        });
    });
}

// --- SUBMIT VOTE ---
submitVoteBtn.addEventListener('click', async () => {
    const voterId = popupVoterId.value.trim();
    const barangay = popupBarangay.value.trim();
    const selectedMayor = candidateContainer.querySelector('input[name="Mayor"]:checked')?.value;
    const selectedViceMayor = candidateContainer.querySelector('input[name="Vice Mayor"]:checked')?.value;
    const selectedCouncilors = Array.from(candidateContainer.querySelectorAll('input[name="Councilor"]:checked')).map(cb => cb.value);

    if (!voterId || !barangay || !selectedMayor || !selectedViceMayor) {
        alert("Enter Voter ID, Barangay, select Mayor and Vice Mayor.");
        return;
    }

    const voteData = {
        voter_id: voterId,
        barangay: barangay,
        candidates: {
            "Mayor": selectedMayor,
            "Vice Mayor": selectedViceMayor,
            "Councilor": selectedCouncilors
        }
    };

    try {
        const data = await safeFetch(`${API_URL}/vote`, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify(voteData)
        });

        showTempMessage(data.message, 3000); // <--- Show message temporarily
        votePopup.style.display = 'none';
        popupVoterId.value = '';
        popupBarangay.value = '';
        candidateContainer.querySelectorAll('input').forEach(i => i.checked = false);
        await displayChain();
    } catch (err) {
        showTempMessage(err.message, 3000); // <--- Show error message temporarily
    }
});

// --- MINE PENDING ---
mineBtn.addEventListener('click', async () => {
    try {
        const data = await safeFetch(`${API_URL}/mine`, { method: 'POST' });
        showTempMessage(data.message, 3000);
        await displayChain();
    } catch (err) {
        showTempMessage(err.message, 3000);
    }
});

// --- DISPLAY BLOCKCHAIN (MASKED) ---
async function displayChain() {
    blockchainDisplay.innerHTML = '';
    try {
        const [chainData, pendingData] = await Promise.all([
            safeFetch(`${API_URL}/chain_masked`),
            safeFetch(`${API_URL}/pending`)
        ]);
        const chain = chainData.chain || [];
        const pending = pendingData.pending || {};

        const minedByBarangay = {};
        chain.forEach(block => {
            const brgy = block.barangay || 'Unknown';
            minedByBarangay[brgy] = minedByBarangay[brgy] || [];
            minedByBarangay[brgy] = minedByBarangay[brgy].concat(block.votes || []);
        });

        const allBarangays = new Set([...Object.keys(minedByBarangay), ...Object.keys(pending)]);
        if (allBarangays.size === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'No barangays with votes yet.';
            blockchainDisplay.appendChild(empty);
            return;
        }

        allBarangays.forEach(brgy => {
            const brgyDiv = document.createElement('div');
            brgyDiv.className = 'barangay-block';
            const minedVotes = minedByBarangay[brgy] || [];
            const pendingVotes = pending[brgy] || [];

            brgyDiv.innerHTML = `<strong>${brgy}</strong><br>Min: ${minedVotes.length} | Pending: ${pendingVotes.length}`;

            brgyDiv.addEventListener('click', () => {
                openGroupedPopup(brgy, minedVotes, false, pendingVotes);
            });

            blockchainDisplay.appendChild(brgyDiv);
        });
    } catch (err) {
        showTempMessage(err.message || 'Error loading chain', 3000);
    }
}

// --- POPUP FOR MINED/PENDING VOTES ---
function openGroupedPopup(barangay, minedVotes, isPending=false, pendingVotes=[]) {
    const overlay = document.createElement('div'); overlay.className = 'popup-overlay';
    const popup = document.createElement('div'); popup.className = 'popup-box';
    popup.innerHTML = `<h2>${barangay}</h2>`;

    const minedHeader = document.createElement('h3'); minedHeader.textContent = `Mined Votes (${minedVotes.length})`; minedHeader.style.textAlign = 'center';
    popup.appendChild(minedHeader);
    if (minedVotes.length === 0) {
        const mEmpty = document.createElement('div'); mEmpty.textContent = 'No mined votes.';
        popup.appendChild(mEmpty);
    } else {
        minedVotes.forEach(v => {
            const item = document.createElement('div'); item.className = 'popup-vote-item';
            const mayor = v.candidates?.Mayor || '—';
            const vice = v.candidates?.['Vice Mayor'] || '—';
            const councilors = (v.candidates?.Councilor || []).join(', ') || 'None';
            item.innerHTML = `<strong>Voter ID:</strong> ${v.voter_id} <br>
                              <strong>Mayor:</strong> ${mayor} <br>
                              <strong>Vice Mayor:</strong> ${vice} <br>
                              <strong>Councilors:</strong> ${councilors} <br><br>`;
            popup.appendChild(item);
        });
    }

    const pendingHeader = document.createElement('h3'); pendingHeader.textContent = `Pending Votes (${pendingVotes.length})`; pendingHeader.style.textAlign = 'center';
    popup.appendChild(pendingHeader);
    if (pendingVotes.length === 0) {
        const pEmpty = document.createElement('div'); pEmpty.textContent = 'No pending votes.';
        popup.appendChild(pEmpty);
    } else {
        pendingVotes.forEach(v => {
            const item = document.createElement('div'); item.className = 'popup-vote-item';
            const mayor = v.candidates?.Mayor || '—';
            const vice = v.candidates?.['Vice Mayor'] || '—';
            const councilors = (v.candidates?.Councilor || []).join(', ') || 'None';
            item.innerHTML = `<strong>Voter ID:</strong> ${v.voter_id} <br>
                              <strong>Mayor:</strong> ${mayor} <br>
                              <strong>Vice Mayor:</strong> ${vice} <br>
                              <strong>Councilors:</strong> ${councilors} <br><br>`;
            popup.appendChild(item);
        });
    }

    const btnContainer = document.createElement('div');
    btnContainer.style.display = 'flex';
    btnContainer.style.justifyContent = 'center';
    btnContainer.style.gap = '10px';
    btnContainer.style.marginTop = '10px';

    const pdfBtn = document.createElement('button'); pdfBtn.textContent = 'Download PDF';
    pdfBtn.addEventListener('click', () => {
        const { jsPDF } = window.jspdf || {};
        if (!jsPDF) return alert('jsPDF not loaded.');
        const doc = new jsPDF();
        doc.setFontSize(12);
        let y = 10;
        doc.text(`Barangay: ${barangay}`, 10, y); y += 8;
        doc.text('Mined Votes:', 10, y); y += 6;
        minedVotes.forEach(v => {
            const line = `Voter: ${v.voter_id} | M: ${v.candidates?.Mayor || ''} | VM: ${v.candidates?.['Vice Mayor'] || ''} | C: ${(v.candidates?.Councilor || []).join(', ')}`;
            doc.text(line, 10, y); y += 6;
            if (y > 270) { doc.addPage(); y = 10; }
        });
        y += 6; doc.text('Pending Votes:', 10, y); y += 6;
        pendingVotes.forEach(v => {
            const line = `Voter: ${v.voter_id} | M: ${v.candidates?.Mayor || ''} | VM: ${v.candidates?.['Vice Mayor'] || ''} | C: ${(v.candidates?.Councilor || []).join(', ')}`;
            doc.text(line, 10, y); y += 6;
            if (y > 270) { doc.addPage(); y = 10; }
        });
        doc.save(`${barangay}_votes.pdf`);
    });
    btnContainer.appendChild(pdfBtn);

    const closeBtn = document.createElement('button'); closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => document.body.removeChild(overlay));
    btnContainer.appendChild(closeBtn);

    popup.appendChild(btnContainer);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
}

// --- RESULTS ---
resultsBtn.addEventListener('click', async () => {
    if (resultsContainer.style.display === 'block') {
        resultsContainer.style.display = 'none';
        resultsDiv.innerHTML = '';
        return;
    }

    resultsContainer.style.display = 'block';
    resultsDiv.innerHTML = '';
    try {
        const data = await safeFetch(`${API_URL}/results`);
        const results = data.results || {};

        const displayOrder = ["Mayor", "Vice Mayor", "Councilor"];
        displayOrder.forEach(role => {
            if (!candidatesByRole[role]) return;

            const roleHeader = document.createElement('h3');
            roleHeader.textContent = role;
            roleHeader.style.textAlign = 'center';
            resultsDiv.appendChild(roleHeader);

            const cardsContainer = document.createElement('div');
            cardsContainer.style.display = 'grid';
            cardsContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(250px, 1fr))';
            cardsContainer.style.gap = '15px';
            cardsContainer.style.marginBottom = '30px';

            const sortedCandidates = candidatesByRole[role]
                .map(c => ({ name: c, votes: results[c] || 0 }))
                .sort((a, b) => b.votes - a.votes);

            sortedCandidates.forEach(c => {
                const card = document.createElement('div');
                card.className = 'vote-card';
                card.style.minHeight = '120px';
                card.style.display = 'flex';
                card.style.flexDirection = 'column';
                card.style.justifyContent = 'center';
                card.style.alignItems = 'center';
                card.style.padding = '15px';
                card.style.border = '1px solid #ccc';
                card.style.borderRadius = '8px';
                card.style.backgroundColor = '#f9f9f9';
                card.style.textAlign = 'center';
                card.innerHTML = `<strong style="word-wrap: break-word; margin-bottom: 10px;">${c.name}</strong><br><span style="font-size: 18px; color: #0066cc; font-weight: bold;">${c.votes} votes</span>`;
                cardsContainer.appendChild(card);
            });

            resultsDiv.appendChild(cardsContainer);
        });
    } catch (err) {
        resultsDiv.textContent = 'Error fetching results.';
    }
});

printBtn.addEventListener('click', async () => {
    try {
        // Fetch mined blockchain and results
        const [chainData, resultsData] = await Promise.all([
            safeFetch(`${API_URL}/chain_masked`),
            safeFetch(`${API_URL}/results`)
        ]);

        // Open a new window for printing
        const printWindow = window.open('', '_blank');
        printWindow.document.write('<html><head><title>Print Votes</title>');
        printWindow.document.write('<style>');
        printWindow.document.write(`
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1, h2, h3 { text-align: center; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            th { background-color: #f0f0f0; font-weight: bold; }
            .vote-item { border: 1px solid #ddd; padding: 10px; margin: 10px 0; background-color: #f9f9f9; }
            .vote-detail { margin: 5px 0; font-size: 14px; }
        `);
        printWindow.document.write('</style></head><body>');

        printWindow.document.write('<h1>Blockchain Voting Data</h1>');

        // Display mined blockchain with individual vote details
        printWindow.document.write('<h2>All Votes (Masked)</h2>');
        chainData.chain.forEach(block => {
            printWindow.document.write(`<h3>Barangay: ${block.barangay}</h3>`);
            block.votes.forEach((v, idx) => {
                const councilors = (v.candidates.Councilor || []).join(', ') || '—';
                printWindow.document.write(`
                    <div class="vote-item">
                        <div class="vote-detail"><strong>Voter ID:</strong> #####</div>
                        <div class="vote-detail"><strong>Mayor:</strong> ${v.candidates.Mayor}</div>
                        <div class="vote-detail"><strong>Vice Mayor:</strong> ${v.candidates['Vice Mayor']}</div>
                        <div class="vote-detail"><strong>Councilors:</strong> ${councilors}</div>
                    </div>
                `);
            });
        });

        // Display overall results sorted descending
        printWindow.document.write('<h2>Overall Results</h2>');
        const results = resultsData.results || {};
        ['Mayor', 'Vice Mayor', 'Councilor'].forEach(role => {
            if (!candidatesByRole[role]) return;
            printWindow.document.write(`<h3>${role}</h3>`);
            printWindow.document.write('<table><thead><tr><th>Candidate</th><th>Votes</th></tr></thead><tbody>');
            
            // Sort candidates descending by vote count
            const sortedCandidates = candidatesByRole[role]
                .map(c => ({ name: c, votes: results[c] || 0 }))
                .sort((a, b) => b.votes - a.votes);

            sortedCandidates.forEach(c => {
                printWindow.document.write(`<tr><td>${c.name}</td><td>${c.votes}</td></tr>`);
            });
            printWindow.document.write('</tbody></table>');
        });

        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.print();

    } catch (err) {
        showTempMessage('Error preparing print: ' + err.message, 3000);
    }
});

// --- INIT ---
(async function init() {
    await loadCandidates();
    await displayChain();
})();