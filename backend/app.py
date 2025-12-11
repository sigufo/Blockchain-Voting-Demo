# file: app.py
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
import hashlib, json, os
from time import time
from typing import Dict, List, Any

DATA_FILE = 'chain_data.json'
HOST = '0.0.0.0'
PORT = 5000

ALLOWED_CANDIDATES = {
    "Mayor": ["AGDA, DAYAN (PFP)", "PICARDAL, DINDO (IND)"],
    "Vice Mayor": ["TIU SONCO, EMMANUEL (LAKAS)", "FRANCO, KUYA VIC OHOYY (NPC)"],
    "Councilor": ["DAZA, ZEN (PFP)", "ANACTA, KATRINA (PFP)", "LIMBAUAN, LYRA GEL (PFP)", "TIU, GLAIZA (PFP)", "BAGACAY, TOTOY ENAT (IND)", "UY, FRICH BAYLON (PFP)", "CAINDAY, KATHLYN JANE (PFP)", "GALO, IAN ERVIN (IND)", "ARAGO, MELCHO (IND)", "ESCOTO, BOTOY (LAKAS)", "ANG, JAY ANTHONY (PFP)", "CAPITO, ANNABELLE (PDPLBN)", "APELADO, JESSIE (IND)", "BAGRO, CELERINO JR. (IND)", "ABOBO, WILFRED (IND)", "AFABLE, CRIS (IND)", "CAMPOMANES, ONINS (IND)"]
}

class Blockchain:
    def __init__(self, data_file: str = DATA_FILE):
        self.data_file = data_file
        self.chain: List[Dict[str, Any]] = []
        self.current_votes_by_barangay: Dict[str, List[Dict[str, Any]]] = {}
        self.voters_by_barangay: Dict[str, set] = {}
        self.mined_barangays: set = set()

        if os.path.exists(self.data_file):
            try:
                self._load_from_disk()
            except Exception:
                self._save_to_disk()  # start empty if file corrupted
        else:
            self._save_to_disk()  # create empty file if not exists

    @staticmethod
    def hash(block: Dict[str, Any]) -> str:
        block_copy = {k: block[k] for k in sorted(block) if k != 'hash'}
        return hashlib.sha256(json.dumps(block_copy, sort_keys=True).encode()).hexdigest()

    def create_block(self, previous_hash: str, barangay: str):
        pending = self.current_votes_by_barangay.get(barangay, []).copy()
        block = {
            'index': len(self.chain) + 1,
            'timestamp': time(),
            'barangay': barangay,
            'votes': pending,
            'previous_hash': previous_hash
        }
        block['hash'] = self.hash(block)
        self.chain.append(block)
        self.current_votes_by_barangay[barangay] = []
        self.mined_barangays.add(barangay)
        self._save_to_disk()
        return block

    def add_vote(self, voter_id: str, candidates: Dict[str, Any], barangay: str):
        voter_id = str(voter_id).strip()
        barangay = str(barangay).strip()
        if not voter_id or not barangay or not isinstance(candidates, dict):
            return False, "Invalid payload"

        if barangay in self.mined_barangays:
            return False, f"Voting closed for {barangay}"

        for brgy, voters in self.voters_by_barangay.items():
            if voter_id in voters and brgy != barangay:
                return False, f"Voter {voter_id} already voted in {brgy} — cannot vote in {barangay}"

        if voter_id in self.voters_by_barangay.get(barangay, set()):
            return False, f"Voter {voter_id} already voted in {barangay}"

        for role in ('Mayor', 'Vice Mayor', 'Councilor'):
            if role not in candidates:
                return False, f"Missing role: {role}"

        if candidates['Mayor'] not in ALLOWED_CANDIDATES['Mayor']:
            return False, f"Invalid Mayor candidate: {candidates['Mayor']}"
        if candidates['Vice Mayor'] not in ALLOWED_CANDIDATES['Vice Mayor']:
            return False, f"Invalid Vice Mayor candidate: {candidates['Vice Mayor']}"

        councilors = candidates.get('Councilor')
        if not isinstance(councilors, list):
            return False, "Councilor must be a list"
        for c in councilors:
            if c not in ALLOWED_CANDIDATES['Councilor']:
                return False, f"Invalid Councilor: {c}"

        vote_entry = {'voter_id': voter_id, 'candidates': {
            'Mayor': candidates['Mayor'],
            'Vice Mayor': candidates['Vice Mayor'],
            'Councilor': councilors
        }}
        self.current_votes_by_barangay.setdefault(barangay, []).append(vote_entry)
        self.voters_by_barangay.setdefault(barangay, set()).add(voter_id)
        self._save_to_disk()
        return True, "Vote recorded successfully"

    def tally_all(self):
        tally: Dict[str, int] = {}
        def add(candidate):
            if candidate:
                tally[candidate] = tally.get(candidate, 0) + 1
        for block in self.chain:
            for vote in block.get('votes', []):
                c = vote.get('candidates', {})
                add(c.get('Mayor'))
                add(c.get('Vice Mayor'))
                for cc in c.get('Councilor', []):
                    add(cc)

        for votes in self.current_votes_by_barangay.values():
            for vote in votes:
                c = vote.get('candidates', {})
                add(c.get('Mayor'))
                add(c.get('Vice Mayor'))
                for cc in c.get('Councilor', []):
                    add(cc)
        return tally

    def tally_by_barangay(self):
        by = {}
        def add(brgy, name):
            if not name: return
            by.setdefault(brgy, {})
            by[brgy][name] = by[brgy].get(name, 0) + 1

        for block in self.chain:
            brgy = block.get('barangay')
            for vote in block.get('votes', []):
                c = vote.get('candidates', {})
                add(brgy, c.get('Mayor'))
                add(brgy, c.get('Vice Mayor'))
                for cc in c.get('Councilor', []):
                    add(brgy, cc)

        for brgy, votes in self.current_votes_by_barangay.items():
            for vote in votes:
                c = vote.get('candidates', {})
                add(brgy, c.get('Mayor'))
                add(brgy, c.get('Vice Mayor'))
                for cc in c.get('Councilor', []):
                    add(brgy, cc)

        return by

    def _save_to_disk(self):
        dump = {
            'chain': self.chain,
            'current_votes_by_barangay': self.current_votes_by_barangay,
            'voters_by_barangay': {k: list(v) for k, v in self.voters_by_barangay.items()},
            'mined_barangays': list(self.mined_barangays),
            'allowed_candidates': ALLOWED_CANDIDATES
        }
        with open(self.data_file, 'w') as f:
            json.dump(dump, f, indent=2)

    def _load_from_disk(self):
        with open(self.data_file, 'r') as f:
            data = json.load(f)

        self.chain = data.get('chain', [])
        self.current_votes_by_barangay = data.get('current_votes_by_barangay', {})
        self.voters_by_barangay = {k: set(v) for k, v in data.get('voters_by_barangay', {}).items()}
        self.mined_barangays = set(data.get('mined_barangays', []))

        global ALLOWED_CANDIDATES
        file_candidates = data.get('allowed_candidates')
        if file_candidates and isinstance(file_candidates, dict) and file_candidates != {}:
            ALLOWED_CANDIDATES = file_candidates

# --- FLASK APP ---
app = Flask(__name__)
CORS(app)
blockchain = Blockchain()

@app.route('/candidates', methods=['GET'])
def get_candidates():
    return jsonify(ALLOWED_CANDIDATES)

@app.route('/vote', methods=['POST'])
def vote():
    data = request.get_json(force=True)
    voter_id = data.get('voter_id')
    barangay = data.get('barangay')
    candidates = data.get('candidates')
    ok, msg = blockchain.add_vote(voter_id, candidates, barangay)
    return jsonify({'message': msg}), (201 if ok else 400)

@app.route('/mine', methods=['POST'])
def mine():
    data = request.get_json(silent=True) or {}
    barangay = data.get('barangay')
    created = []

    prev_hash = blockchain.chain[-1]['hash'] if blockchain.chain else '0'  # use '0' if empty

    if barangay:
        if barangay in blockchain.mined_barangays:
            return jsonify({'message': f'Barangay {barangay} already mined.'}), 400
        if not blockchain.current_votes_by_barangay.get(barangay):
            return jsonify({'message': f'No pending votes for {barangay}'}), 400
        blk = blockchain.create_block(prev_hash, barangay)
        created.append(blk)
        return jsonify({'message': f'Block mined for barangay {barangay}', 'block': blk})

    for brgy in list(blockchain.current_votes_by_barangay.keys()):
        if blockchain.current_votes_by_barangay.get(brgy):
            blk = blockchain.create_block(prev_hash, brgy)
            created.append(blk)
            prev_hash = blk['hash']

    if not created:
        return jsonify({'message': 'No pending votes to mine'}), 400

    return jsonify({'message': f'Mined {len(created)} block(s)', 'blocks': created})

@app.route('/chain_masked')
def chain_masked():
    masked = []
    for block in blockchain.chain:
        votes_masked = []
        for v in block.get('votes', []):
            votes_masked.append({
                'voter_id': '*****',
                'candidates': v.get('candidates', {})
            })
        b = {k: block[k] for k in block if k != 'votes'}
        b['votes'] = votes_masked
        masked.append(b)
    return jsonify({'chain': masked, 'length': len(masked)})

@app.route('/pending')
def pending():
    return jsonify({'pending': blockchain.current_votes_by_barangay})

@app.route('/results')
def results():
    return jsonify({'results': blockchain.tally_all()})

@app.route('/results_by_barangay')
def results_by_barangay():
    return jsonify({'results_by_barangay': blockchain.tally_by_barangay()})

@app.route('/export_all')
def export_all():
    export_path = 'export_chain.json'
    dump = {
        'chain': blockchain.chain,
        'pending': blockchain.current_votes_by_barangay,
        'voters_by_barangay': {k: list(v) for k, v in blockchain.voters_by_barangay.items()},
        'mined_barangays': list(blockchain.mined_barangays),
        'allowed_candidates': ALLOWED_CANDIDATES
    }
    with open(export_path, 'w') as f:
        json.dump(dump, f, indent=2)
    return send_file(export_path, as_attachment=True)

@app.route('/visualizer_data', methods=['GET'])
def visualizer_data():
    mined_grouped = {}
    for block in blockchain.chain:
        brgy = block.get('barangay')
        mined_grouped.setdefault(brgy, [])
        mined_grouped[brgy].append(block)

    return jsonify({
        "mined": mined_grouped,
        "pending": blockchain.current_votes_by_barangay
    })

if __name__ == '__main__':
    app.run(host=HOST, port=PORT, debug=True)
