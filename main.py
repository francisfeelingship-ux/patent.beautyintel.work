import os
os.environ["HF_HOME"] = r"C:\Users\ERAZER\.cache\huggingface"
os.environ["HF_HUB_OFFLINE"] = "1"
try:
    import torch
    torch.set_num_threads(1)
except Exception:
    pass

import sqlite3
import json
import urllib.request
import time
from collections import Counter
from datetime import datetime
import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import threading
import sys
from pathlib import Path

_local_embedding_lock = threading.Lock()

app = FastAPI(title="Patent Analytical Dashboard API")

BASE_DIR = Path(__file__).resolve().parent
sys.path.append(str(BASE_DIR.parent))
sys.path.append(r"C:\Users\ERAZER\Desktop\Patent Library\Librarians\Patent Librarian")
from patent_librarian.retrieval.keyword_fts import search_family_keywords
DB_PATH = Path(r"C:\Users\ERAZER\Desktop\Patent Library\Librarians\Patent Librarian\data\db\patent_library_embedding_copy.sqlite")
CACHE_EMBEDDINGS_PATH = BASE_DIR / "family_embeddings_cache.npy"
CACHE_IDS_PATH = BASE_DIR / "family_ids.json"
STATIC_DIR = BASE_DIR / "static"

import re

def clean_company_name(key: str, db_name: str) -> str:
    return db_name

def load_companies_from_db(db_path) -> dict:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='companies';")
    if not cursor.fetchone():
        conn.close()
        return {
            "loreal": {"name": "L'Oreal", "keys": ["loreal"]},
            "beiersdorf": {"name": "Beiersdorf AG", "keys": ["beiersdorf"]},
            "shiseido": {"name": "Shiseido Company, Limited", "keys": ["shiseido"]},
            "procter_gamble": {"name": "The Procter & Gamble Company", "keys": ["procter_gamble"]}
        }
        
    cursor.execute("SELECT company_id, company_key, company_name, company_type, notes FROM companies;")
    rows = cursor.fetchall()
    
    # Define all 25 key companies
    KEY_COMPANIES = {
        'loreal', 'beiersdorf', 'shiseido', 'procter_gamble', 'estee_lauder', 
        'revlon', 'kenvue', 'colgate_palmolive', 'amorepacific', 'unilever', 
        'givaudan', 'kao_corp', 'symrise', 'evonik', 'henkel', 'firmenich', 
        'dsm', 'dow', 'seppic', 'basf', 'coty', 'cosmax', 'croda', 'intercos', 'ashland'
    }

    # Custom pretty names for key companies
    KEY_COMPANY_NAMES = {
        'loreal': "L'Oreal",
        'beiersdorf': "Beiersdorf AG",
        'shiseido': "Shiseido Company, Limited",
        'procter_gamble': "The Procter & Gamble Company",
        'estee_lauder': "The Estee Lauder Companies Inc.",
        'revlon': "Revlon",
        'kenvue': "Kenvue",
        'colgate_palmolive': "Colgate-Palmolive Company",
        'amorepacific': "Amorepacific",
        'unilever': "Unilever",
        'givaudan': "Givaudan",
        'kao_corp': "Kao Corp",
        'symrise': "Symrise",
        'evonik': "Evonik",
        'henkel': "Henkel",
        'firmenich': "Firmenich",
        'dsm': "DSM",
        'dow': "Dow",
        'seppic': "Seppic",
        'basf': "BASF",
        'coty': "Coty",
        'cosmax': "Cosmax",
        'croda': "Croda",
        'intercos': "Intercos",
        'ashland': "Ashland"
    }

    import re

    def normalize_company_key(k: str) -> str:
        if not k:
            return ""
        k = k.lower().strip()
        if k in ("kao", "kaocorp", "kao_corp"):
            return "kao_corp"
        if k in ("esteelauder", "elcmanagement", "estee_lauder", "estee_lauder_inc", "estee_lauder_group_kk", "estee_lauder_international", "elc_management"):
            return "estee_lauder"
        return k

    child_to_parent = {}
    child_to_parent["nestle_skin_health"] = "loreal"
    child_to_parent["beauty_devices_inc"] = "loreal"
    child_to_parent["beauty_devices"] = "loreal"
    
    for row in rows:
        cid, ckey, cname, ctype, cnotes = row
        cnotes = cnotes or ""
        ckey_lower = ckey.lower().strip()
        
        is_child = False
        parent_key = None
        
        parent_match = re.search(r'(?:affiliate_of|relationship_audit_of|relationship_candidate_of|divested_non_beauty_business_of)=([a-zA-Z0-9_\'\’\`]+)', cnotes)
        if parent_match:
            parent_key = parent_match.group(1).lower().strip()
            is_child = True
        elif ctype in ('affiliate', 'relationship_candidate', 'relationship_audit'):
            is_child = True
            for possible_parent in ['loreal', 'beiersdorf', 'shiseido', 'procter_gamble', 'estee_lauder', 'unilever', 'colgate_palmolive', 'amorepacific', 'kenvue', 'revlon', 'givaudan', 'kao_corp']:
                if possible_parent in cnotes.lower() or possible_parent.replace("_", "") in cnotes.lower():
                    parent_key = possible_parent
                    break
        
        if is_child and parent_key:
            parent_norm = normalize_company_key(parent_key)
            child_to_parent[ckey_lower] = parent_norm

    # Initialize final_map for all 25 parent companies
    final_map = {}
    for key in KEY_COMPANIES:
        final_map[key] = {
            "name": KEY_COMPANY_NAMES.get(key, key.replace("_", " ").title()),
            "keys": {key}
        }

    # Load all distinct keys from companies table and active_pool_membership table
    cursor.execute("SELECT DISTINCT company_key FROM companies;")
    db_keys = [r[0] for r in cursor.fetchall()]
    
    cursor.execute("SELECT DISTINCT company_key FROM active_pool_membership;")
    pool_keys = [r[0] for r in cursor.fetchall()]
    
    all_keys = set(db_keys + pool_keys)
    conn.close()

    for k in all_keys:
        k_lower = k.lower().strip()
        resolved = child_to_parent.get(k_lower) or k_lower
        resolved = normalize_company_key(resolved)
        
        if resolved in final_map:
            final_map[resolved]["keys"].add(k)
            
    # Convert sets to lists
    for key in final_map:
        final_map[key]["keys"] = list(final_map[key]["keys"])
        
    return final_map

def get_company_filter(company_key: str, param_list: list, table_alias: str = "pm") -> str:
    if not company_key:
        return "1=1"
        
    company_key = company_key.lower().strip()
    
    if company_key in CORE_COMPANIES and CORE_COMPANIES[company_key]["keys"]:
        keys = CORE_COMPANIES[company_key]["keys"]
        placeholders = ",".join("?" * len(keys))
        param_list.extend(keys)
        return f"({table_alias}.company_key IN ({placeholders}))"
        
    return "1=0"

# Global companies map
CORE_COMPANIES = {}
YAML_COMPANY_ALIASES = {}
ALIAS_TO_COMPANY_KEY = {}

# Dynamic domains list discovered at startup
TOP_DOMAINS = []

# In-memory caches for fast vector search loading
family_ids = []
normalized_embeddings = None
family_total_sizes = {}
slow_family_equivalents = {}
country_density_cache = {}
family_to_patents_cache = {}
country_matching_patents_cache = {}
startup_completed = False

# Embedding metadata configurations
EMBEDDING_MODEL = 'text-embedding-3-large'
EMBEDDING_DIMENSIONS = 3072
EMBEDDING_DOC_TYPE = 'family'

startup_status = {
    "status": "loading",
    "progress": 0,
    "detail": "Initializing...",
    "error": None
}

def get_openai_embedding(text: str, model_name: str = "text-embedding-3-large", dimensions: int = None) -> list:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable is not set")
    
    url = "https://api.openai.com/v1/embeddings"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    data = {
        "input": text,
        "model": model_name
    }
    if dimensions is not None:
        data["dimensions"] = dimensions
    
    req = urllib.request.Request(
        url, 
        data=json.dumps(data).encode("utf-8"), 
        headers=headers, 
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            return res_data["data"][0]["embedding"]
    except Exception as e:
        print(f"Error calling OpenAI API: {e}")
        raise ValueError(f"OpenAI embedding failed: {e}")

def get_query_embedding(query: str, cursor: sqlite3.Cursor, conn: sqlite3.Connection) -> list:
    global EMBEDDING_MODEL, EMBEDDING_DIMENSIONS
    import hashlib
    qh = hashlib.sha256(query.encode("utf-8")).hexdigest()
    cursor.execute(
        "SELECT embedding_json FROM retrieval_query_embedding_cache WHERE query_hash = ? AND embedding_model = ?",
        (qh, EMBEDDING_MODEL)
    )
    row = cursor.fetchone()
    if row:
        emb = json.loads(row[0])
        if len(emb) == EMBEDDING_DIMENSIONS:
            return emb
        else:
            print(f"Cached embedding dimension ({len(emb)}) does not match expected ({EMBEDDING_DIMENSIONS}). Re-computing...")
    
    # Check if local model or OpenAI
    local_prefixes = ("sentence-transformers/", "intfloat/", "BAAI/", "all-")
    if EMBEDDING_MODEL.startswith(local_prefixes):
        try:
            # Load and compute local embedding
            sys.path.append(r"C:\Users\ERAZER\Desktop\Patent Library\Librarians\Patent Librarian")
            from patent_librarian.retrieval.embeddings import embed_texts
            with _local_embedding_lock:
                emb = embed_texts([query], EMBEDDING_MODEL, task="query")[0]
        except Exception as e:
            print(f"Local embedding failed: {e}.")
            raise e
    else:
        # Fetch from OpenAI
        emb = get_openai_embedding(query, EMBEDDING_MODEL, dimensions=EMBEDDING_DIMENSIONS)
    
    # Save to cache
    cursor.execute(
        """
        INSERT OR REPLACE INTO retrieval_query_embedding_cache (
            query_hash, query_text, embedding_model, embedding_json, embedding_dim, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        (qh, query, EMBEDDING_MODEL, json.dumps(emb), len(emb), datetime.utcnow().isoformat() + "Z")
    )
    conn.commit()
    return emb

def sync_database_map():
    """Ensure database_map_compact.md is synchronized and up-to-date on UI/server startup."""
    import shutil
    master_map = Path(r"C:\Users\ERAZER\Desktop\Patent Library\Librarians\Patent Librarian\database_map_compact.md")
    local_map = BASE_DIR / "database_map_compact.md"
    
    try:
        if master_map.exists():
            shutil.copy2(master_map, local_map)
            print(f"Startup: Successfully synchronized database_map_compact.md from master source ({master_map}).")
        elif local_map.exists():
            print("Startup: Master database map not found, using existing local database_map_compact.md.")
        else:
            print("Startup: Warning: database_map_compact.md not found.")
    except Exception as e:
        print(f"Startup: Error synchronizing database map: {e}")

def heavy_startup():
    global family_ids, normalized_embeddings, family_total_sizes, slow_family_equivalents, country_density_cache, startup_completed, startup_status, CORE_COMPANIES, TOP_DOMAINS
    
    print("Startup: Initializing Patent Analyzer in background...")
    try:
        # Sync database map file to ensure it's up-to-date on startup
        sync_database_map()

        # 1. Ensure static dir exists
        os.makedirs(STATIC_DIR, exist_ok=True)
        
        # 2. Check if DB exists
        if not os.path.exists(DB_PATH):
            err_msg = f"Database not found at {DB_PATH}"
            print(f"Error: {err_msg}")
            startup_status["status"] = "error"
            startup_status["error"] = err_msg
            return
            
        # Initialize companies list dynamically
        try:
            CORE_COMPANIES.clear()
            CORE_COMPANIES.update(load_companies_from_db(DB_PATH))
            print(f"Startup: Dynamically loaded {len(CORE_COMPANIES)} companies from database.")
        except Exception as e:
            print(f"Error loading companies from database: {e}")
            
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Dynamically discover the top 9 most common domains (application category domains)
        try:
            cursor.execute("""
                SELECT candidate_domain_tag, COUNT(*) as cnt
                FROM resolved_domain_tags
                WHERE tag_axis = 'application_domain'
                GROUP BY candidate_domain_tag
                ORDER BY cnt DESC
                LIMIT 9;
            """)
            TOP_DOMAINS = [r[0] for r in cursor.fetchall()]
            print(f"Startup: Dynamically resolved top 9 application domains: {TOP_DOMAINS}")
        except Exception as e:
            # Fallback if table doesn't exist or is empty
            print(f"Startup: Fallback loading domains: {e}")
            TOP_DOMAINS = [
                'skin_care', 'hair_care', 'therapeutic_application', 
                'makeup_color_cosmetics', 'oral_care', 'cleansing_formula', 
                'food_beverage', 'sunscreen_photoprotection', 'hair_color'
            ]
        
        # Load slow family equivalents from JSONL files
        startup_status["progress"] = 5
        startup_status["detail"] = "Loading slow scraper equivalents..."
        print("Startup: Loading slow scraper equivalents...")
        t_slow = time.time()
        try:
            patent_library_dir = DB_PATH.parents[4]
            jsonl_files = []
            for root, dirs, files in os.walk(str(patent_library_dir)):
                for f in files:
                    if f.endswith("slow_post_run_family_members.jsonl"):
                        jsonl_files.append(os.path.join(root, f))
            
            # Get distinct prefixes from database
            cursor.execute("SELECT DISTINCT SUBSTR(slow_family_id, 1, INSTR(slow_family_id, ':') - 1) FROM slow_family_promotion_map;")
            prefixes = [r[0] for r in cursor.fetchall() if r[0]]
            
            def clean_string(s):
                return re.sub(r'[^a-z0-9]', '', s.lower())
                
            prefix_to_file = {}
            for prefix in prefixes:
                words = re.split(r'[\s\-_%]+', prefix.split(':')[0])
                clean_words = [clean_string(w) for w in words if clean_string(w)]
                
                best_match = None
                best_score = 0
                for f in jsonl_files:
                    rel_f = os.path.relpath(f, str(patent_library_dir))
                    clean_f = clean_string(rel_f.replace('_slow_post_run_family_members.jsonl', ''))
                    
                    score = 0
                    for w in clean_words:
                        if w in clean_f:
                            score += len(w)
                            
                    if score > best_score:
                        best_score = score
                        best_match = f
                        
                if best_match and best_score > 0:
                    prefix_to_file[prefix] = best_match
            
            # Load promotion map
            cursor.execute("SELECT slow_family_id, simple_family_id FROM slow_family_promotion_map;")
            map_by_prefix = {}
            for slow_fid, simple_fid in cursor.fetchall():
                if ':' in slow_fid:
                    prefix, sfid = slow_fid.split(':', 1)
                    if prefix not in map_by_prefix:
                        map_by_prefix[prefix] = {}
                    map_by_prefix[prefix][sfid] = simple_fid
            
            # Load equivalents
            slow_family_equivalents.clear()
            for prefix, filepath in prefix_to_file.items():
                if prefix not in map_by_prefix:
                    continue
                submap = map_by_prefix[prefix]
                try:
                    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                        for line in f:
                            try:
                                data = json.loads(line)
                                slow_fid = data.get("simple_family_id")
                                pub = data.get("normalized_publication_number")
                                if slow_fid and pub:
                                    simple_fid = submap.get(slow_fid)
                                    if simple_fid:
                                        if simple_fid not in slow_family_equivalents:
                                            slow_family_equivalents[simple_fid] = set()
                                        slow_family_equivalents[simple_fid].add(pub)
                            except Exception:
                                pass
                except Exception as e:
                    print(f"Error loading {filepath}: {e}")
            print(f"Startup: Loaded equivalents for {len(slow_family_equivalents)} families in {time.time() - t_slow:.2f}s.")
        except Exception as e:
            print(f"Error loading slow scraper equivalents: {e}")
            
        # 3. Cache country densities
        startup_status["progress"] = 15
        startup_status["detail"] = "Caching global patent country densities..."
        
        print("Startup: Caching global patent country densities...")
        t0 = time.time()
        try:
            cursor.execute("SELECT publication_number FROM simple_family_members;")
            rows = cursor.fetchall()
            countries = []
            for r in rows:
                pub = r[0]
                if pub and len(pub) >= 2:
                    cc = pub[:2]
                    if cc.isalpha():
                        countries.append(cc.upper())
            country_density_cache = dict(Counter(countries))
            print(f"Startup: Cached country density for {len(country_density_cache)} countries in {time.time() - t0:.2f}s.")
        except Exception as e:
            print(f"Error caching countries: {e}")
            country_density_cache = {}
            
        # 4. Load or parse family embeddings from DB (using database-discovered model & dimensions)
        startup_status["progress"] = 40
        startup_status["detail"] = "Querying database embedding schema..."
        
        db_doc_type = 'family'
        db_model = 'text-embedding-3-large'
        db_dimensions = 3072
        db_count = 0
        
        try:
            cursor.execute("""
                SELECT doc_type, model, dimensions, COUNT(*) 
                FROM family_embeddings 
                WHERE embedding_json_or_blob IS NOT NULL
                GROUP BY doc_type, model, dimensions
                LIMIT 1;
            """)
            meta_row = cursor.fetchone()
            if meta_row:
                db_doc_type, db_model, db_dimensions, db_count = meta_row
                print(f"Startup: Discovered embedding metadata in DB - doc_type={db_doc_type}, model={db_model}, dimensions={db_dimensions}, count={db_count}")
            else:
                print("Startup Warning: No embedding metadata found in family_embeddings, using defaults.")
        except Exception as e:
            print(f"Startup Warning: Failed to query embedding metadata: {e}")

        # Set globals
        global EMBEDDING_MODEL, EMBEDDING_DIMENSIONS, EMBEDDING_DOC_TYPE
        EMBEDDING_MODEL = db_model
        EMBEDDING_DIMENSIONS = db_dimensions
        EMBEDDING_DOC_TYPE = db_doc_type

        t0 = time.time()
        cache_loaded = False
        if os.path.exists(CACHE_EMBEDDINGS_PATH) and os.path.exists(CACHE_IDS_PATH):
            print("Startup: Loading family embeddings cache from disk...")
            try:
                temp_embeddings = np.load(CACHE_EMBEDDINGS_PATH)
                with open(CACHE_IDS_PATH, "r") as f:
                    temp_ids = json.load(f)
                
                # Check shape matching database metadata
                if temp_embeddings.shape == (db_count, db_dimensions) and len(temp_ids) == db_count:
                    normalized_embeddings = temp_embeddings
                    family_ids = temp_ids
                    print(f"Startup: Loaded disk cache of shape {normalized_embeddings.shape} in {time.time() - t0:.2f}s.")
                    cache_loaded = True
                else:
                    print(f"Startup: Disk cache shape {temp_embeddings.shape} or count does not match database ({db_count}, {db_dimensions}). Rebuilding...")
            except Exception as e:
                print(f"Error loading disk cache: {e}. Reading from sqlite DB instead...")
                normalized_embeddings = None
                
        if not cache_loaded:
            print("Startup: Reading pre-computed embeddings from SQLite database...")
            startup_status["progress"] = 60
            startup_status["detail"] = "Reading precomputed embeddings from database..."
            t0 = time.time()
            try:
                cursor.execute(f"""
                    SELECT simple_family_id, embedding_json_or_blob 
                    FROM family_embeddings 
                    WHERE doc_type = ? AND embedding_json_or_blob IS NOT NULL;
                """, (db_doc_type,))
                rows = cursor.fetchall()
                
                family_ids_temp = []
                embeddings_list = []
                
                total_rows = len(rows)
                print(f"Startup: Loaded {total_rows} embedding rows from sqlite. Parsing JSON...")
                
                for idx, row in enumerate(rows):
                    fam_id = row[0]
                    emb_str = row[1]
                    try:
                        emb = json.loads(emb_str)
                        if len(emb) == db_dimensions:
                            family_ids_temp.append(fam_id)
                            embeddings_list.append(emb)
                    except Exception:
                        pass
                    
                    if idx % 1000 == 0 or idx == total_rows - 1:
                        progress_val = 60 + int((idx / total_rows) * 35)
                        startup_status["progress"] = progress_val
                        startup_status["detail"] = f"Parsing DB embeddings ({idx}/{total_rows})..."
                
                if embeddings_list:
                    normalized_embeddings = np.array(embeddings_list, dtype=np.float32)
                    family_ids = family_ids_temp
                    
                    # Norm check and normalization
                    norms = np.linalg.norm(normalized_embeddings, axis=1, keepdims=True)
                    normalized_embeddings = normalized_embeddings / (norms + 1e-12)
                    
                    # Save disk caches
                    np.save(CACHE_EMBEDDINGS_PATH, normalized_embeddings)
                    with open(CACHE_IDS_PATH, "w") as f:
                        json.dump(family_ids, f)
                        
                    print(f"Startup: Loaded and cached {len(family_ids)} family embeddings in {time.time() - t0:.2f}s.")
                else:
                    raise ValueError("No valid family embeddings found in database.")
            except Exception as e:
                print(f"Error loading database embeddings: {e}")
                normalized_embeddings = None
                family_ids = []
                
        # 5. Populate family total sizes in memory
        startup_status["progress"] = 90
        startup_status["detail"] = "Populating family sizes in memory..."
        print("Startup: Populating family total sizes with full resolution...")
        t_size = time.time()
        
        try:
            # Step A: Load base counts & representative publications
            cursor.execute("SELECT simple_family_id, family_patent_count, representative_publication FROM family_embedding_documents;")
            fed_rows = cursor.fetchall()
            fed_rep_map = {}
            for fid, cnt, rep in fed_rows:
                family_total_sizes[fid] = max(cnt or 1, 1)
                if rep:
                    fed_rep_map[fid] = rep

            # Step B: Include sizes from simple_patent_families
            cursor.execute("SELECT simple_family_id, family_size FROM simple_patent_families;")
            for fid, sz in cursor.fetchall():
                if sz:
                    family_total_sizes[fid] = max(family_total_sizes.get(fid, 0), sz)

            # Step C: Include counts from patent_family_layers
            cursor.execute("SELECT simple_family_id, COUNT(DISTINCT patent_id) FROM patent_family_layers GROUP BY simple_family_id;")
            for fid, cnt in cursor.fetchall():
                if cnt:
                    family_total_sizes[fid] = max(family_total_sizes.get(fid, 0), cnt)

            # Step D: Precompute priority_number -> patent count map
            cursor.execute("SELECT priority_number, COUNT(DISTINCT patent_id) FROM patents WHERE priority_number IS NOT NULL AND priority_number != '' GROUP BY priority_number;")
            prio_count_map = dict(cursor.fetchall())

            # Step E: Precompute publication_number -> priority_number map
            cursor.execute("SELECT publication_number, priority_number FROM patents WHERE publication_number IS NOT NULL;")
            pub_prio_map = dict(cursor.fetchall())

            # Step F: Precompute publication_number -> epo_members count map
            cursor.execute("SELECT publication_number, COUNT(DISTINCT member_publication) FROM patent_epo_family_members GROUP BY publication_number;")
            epo_count_map = dict(cursor.fetchall())

            # Apply maps to every family via representative_publication
            for fid, rep in fed_rep_map.items():
                cur_sz = family_total_sizes.get(fid, 1)
                prio = pub_prio_map.get(rep)
                if prio and prio in prio_count_map:
                    cur_sz = max(cur_sz, prio_count_map[prio])
                if rep in epo_count_map:
                    cur_sz = max(cur_sz, epo_count_map[rep])
                family_total_sizes[fid] = cur_sz

            # Incorporate slow_family_equivalents
            for fid, eqs in slow_family_equivalents.items():
                family_total_sizes[fid] = max(family_total_sizes.get(fid, 0), len(eqs))

            print(f"Startup: Loaded total sizes for {len(family_total_sizes)} families in {time.time() - t_size:.2f}s.")
        except Exception as e:
            print(f"Error loading total family sizes: {e}")
            
        conn.close()
        startup_completed = True
        startup_status["progress"] = 100
        startup_status["detail"] = "System ready."
        startup_status["status"] = "ready"
        print("Startup: Patent Analyzer initialization complete.")
        
        # Preload embedding model in a separate thread so it is ready once the UI starts
        def preload_model():
            local_prefixes = ("sentence-transformers/", "intfloat/", "BAAI/", "all-")
            global EMBEDDING_MODEL
            if EMBEDDING_MODEL and EMBEDDING_MODEL.startswith(local_prefixes):
                print(f"Startup: Preloading local embedding model '{EMBEDDING_MODEL}' in background...")
                try:
                    sys.path.append(r"C:\Users\ERAZER\Desktop\Patent Library\Librarians\Patent Librarian")
                    from patent_librarian.retrieval.embeddings import embed_texts
                    with _local_embedding_lock:
                        embed_texts(["warmup"], EMBEDDING_MODEL, task="query")
                    print("Startup: Local embedding model preloaded successfully.")
                except Exception as e:
                    print(f"Startup Warning: Failed to preload local embedding model: {e}")
        
        threading.Thread(target=preload_model, daemon=True).start()
    except Exception as e:
        print(f"Critical error during startup: {e}")
        startup_status["status"] = "error"
        startup_status["error"] = str(e)

@app.on_event("startup")
def startup_event():
    os.makedirs(STATIC_DIR, exist_ok=True)
    t = threading.Thread(target=heavy_startup, daemon=True)
    t.start()
    
    if "unittest" in sys.modules or os.environ.get("TESTING") == "1":
        print("Startup: Running startup synchronously for test context...")
        t.join()

@app.get("/api/status")
def get_status():
    return startup_status

@app.get("/api/companies")
def get_companies():
    global CORE_COMPANIES
    if not CORE_COMPANIES:
        try:
            CORE_COMPANIES = load_companies_from_db(DB_PATH)
        except Exception:
            pass
    return [
        {"key": k, "name": v["name"]} for k, v in CORE_COMPANIES.items()
    ]

def get_joins(has_company: bool, has_country: bool) -> str:
    joins = []
    if has_company or has_country:
        joins.append("JOIN patent_family_layers l ON s.simple_family_id = l.simple_family_id")
    if has_company:
        joins.append("JOIN patent_assignees pa ON l.patent_id = pa.patent_id")
        joins.append("JOIN assignees a ON pa.assignee_id = a.assignee_id")
    if has_country:
        joins.append("JOIN simple_family_members m ON l.simple_family_id = m.simple_family_id")
    return " ".join(joins)

def parse_domain_tags(domain_tags_val) -> list:
    if not domain_tags_val:
        return []
    if isinstance(domain_tags_val, list):
        tags_list = domain_tags_val
    elif isinstance(domain_tags_val, str):
        val_str = domain_tags_val.strip()
        if val_str.startswith('['):
            try:
                tags_list = json.loads(val_str)
            except Exception:
                tags_list = val_str.split('|')
        else:
            tags_list = val_str.split('|')
    else:
        return []
    
    clean_tags = []
    for t in tags_list:
        if not t:
            continue
        t_clean = str(t).strip()
        if t_clean and t_clean != "needs_review":
            clean_tags.append(t_clean)
    return clean_tags

def resolve_family_id(cursor, family_id: str) -> str:
    """
    If the family_id is not found in patent_family_layers, try to resolve it
    using the representative publication of the family in family_embedding_documents.
    """
    if not family_id:
        return family_id
    cursor.execute("SELECT 1 FROM patent_family_layers WHERE simple_family_id = ? LIMIT 1", (family_id,))
    if cursor.fetchone():
        return family_id
    cursor.execute("SELECT representative_publication FROM family_embedding_documents WHERE simple_family_id = ? LIMIT 1", (family_id,))
    row = cursor.fetchone()
    if row and row[0]:
        rep_pub = row[0]
        cursor.execute("""
            SELECT l.simple_family_id
            FROM patent_family_layers l
            JOIN patents p ON l.patent_id = p.patent_id
            WHERE p.publication_number = ? OR p.publication_number_normalized = ?
            LIMIT 1
        """, (rep_pub, rep_pub))
        mapped_row = cursor.fetchone()
        if mapped_row:
            return mapped_row[0]
    return family_id

@app.get("/api/overview")
def get_overview(
    company: str = Query(None, description="Filter by company key"),
    year: int = Query(None, description="Filter by priority year"),
    country: str = Query(None, description="Filter by extension country code (2 letter)")
):
    global family_to_patents_cache, country_matching_patents_cache
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=500, detail="Database file not found.")
        
    # Clean up FastAPI Query objects when called directly in Python
    from fastapi.params import Query as FastAPIQuery
    if isinstance(company, FastAPIQuery):
        company = company.default
    if isinstance(year, FastAPIQuery):
        year = year.default
    if isinstance(country, FastAPIQuery):
        country = country.default

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Initialize global cache family_to_patents if not already done
    if not family_to_patents_cache:
        cursor.execute("SELECT patent_id, simple_family_id FROM patent_family_layers WHERE simple_family_id IS NOT NULL")
        for pid, sfid in cursor.fetchall():
            if sfid not in family_to_patents_cache:
                family_to_patents_cache[sfid] = []
            family_to_patents_cache[sfid].append(pid)
            
    # Base query filter parameters
    where_clauses = ["1=1"]
    params = []
    
    if company:
        clause = get_company_filter(company, params, table_alias="pm")
        where_clauses.append(clause)
        
    if year is not None:
        where_clauses.append("CAST(SUBSTR(p.priority_date, 1, 4) AS INTEGER) = ?")
        params.append(year)
        
    if country is not None:
        c_upper = country.upper().strip()
        if c_upper not in country_matching_patents_cache:
            # 1. Matches in patents table directly
            cursor.execute("SELECT patent_id FROM patents WHERE SUBSTR(publication_number, 1, 2) = ?", (c_upper,))
            pids = set(r[0] for r in cursor.fetchall())
            
            # 2. Matches in patent_epo_family_members table
            cursor.execute("SELECT DISTINCT patent_id FROM patent_epo_family_members WHERE SUBSTR(member_publication, 1, 2) = ?", (c_upper,))
            pids.update(r[0] for r in cursor.fetchall())
            
            # 3. Matches in slow_family_equivalents (in-memory)
            for sfid, eqs in slow_family_equivalents.items():
                if any(eq.upper().startswith(c_upper) for eq in eqs):
                    if sfid in family_to_patents_cache:
                        pids.update(family_to_patents_cache[sfid])
            country_matching_patents_cache[c_upper] = pids
            
        pids_set = country_matching_patents_cache[c_upper]
        cursor.execute("CREATE TEMP TABLE temp_matching_patents (patent_id INTEGER PRIMARY KEY);")
        if pids_set:
            cursor.executemany("INSERT OR IGNORE INTO temp_matching_patents VALUES (?);", [(pid,) for pid in pids_set])
            
        where_clauses.append("p.patent_id IN (SELECT patent_id FROM temp_matching_patents)")
        
    where_str = " AND ".join(where_clauses)
    pm_join = "JOIN active_pool_membership pm ON p.patent_id = pm.patent_id" if company else ""
    
    # 1. Gather all unique publication numbers and their priority years (only filtered by company)
    pub_to_year = {}
    
    # Source A: Core patents
    core_params = []
    core_where = ["1=1"]
    core_join = ""
    if company:
        core_where.append(get_company_filter(company, core_params, table_alias="pm"))
        core_join = "JOIN active_pool_membership pm ON p.patent_id = pm.patent_id"
    core_where_str = " AND ".join(core_where)
    
    cursor.execute(f"""
        SELECT p.publication_number, CAST(SUBSTR(p.priority_date, 1, 4) AS INTEGER), l.simple_family_id
        FROM patents p
        LEFT JOIN patent_family_layers l ON p.patent_id = l.patent_id
        {core_join}
        WHERE {core_where_str} AND p.publication_number IS NOT NULL AND p.publication_number != ''
    """, core_params)
    core_rows = cursor.fetchall()
    
    for pub, yr, sfid in core_rows:
        if pub:
            pub_to_year[pub] = yr
            
    # Source B: EPO equivalents
    epo_params = []
    epo_where = ["1=1"]
    epo_join = ""
    if company:
        epo_where.append(get_company_filter(company, epo_params, table_alias="pm"))
        epo_join = "JOIN active_pool_membership pm ON p.patent_id = pm.patent_id"
    epo_where_str = " AND ".join(epo_where)
    
    cursor.execute(f"""
        SELECT m.member_publication, CAST(SUBSTR(p.priority_date, 1, 4) AS INTEGER)
        FROM patent_epo_family_members m
        JOIN patents p ON m.patent_id = p.patent_id
        {epo_join}
        WHERE {epo_where_str} AND m.member_publication IS NOT NULL AND m.member_publication != ''
    """, epo_params)
    epo_rows = cursor.fetchall()
    
    for pub, yr in epo_rows:
        if pub:
            pub_to_year[pub] = yr
            
    # Source C: Slow Scraper equivalents
    family_to_year = {sfid: yr for pub, yr, sfid in core_rows if sfid and yr is not None}
    for sfid, eqs in slow_family_equivalents.items():
        if sfid in family_to_year:
            yr = family_to_year[sfid]
            for eq in eqs:
                if eq:
                    pub_to_year[eq] = yr

    # 2. Total Patents (Core patents directly from live database table)
    cursor.execute(f"""
        SELECT COUNT(DISTINCT p.patent_id)
        FROM patents p
        {pm_join}
        WHERE {where_str}
    """, params)
    total_patents = cursor.fetchone()[0]
        
    # 3. Total Families (Distinct family records in live database)
    cursor.execute(f"""
        SELECT COUNT(DISTINCT fed.simple_family_id)
        FROM family_embedding_documents fed
    """)
    total_families = cursor.fetchone()[0]
    
    # 4. Tech Domains (Pie/Donut chart) (remain as is, using database since placeholders don't have domain tags)
    cursor.execute(f"""
        SELECT r.candidate_domain_tag, COUNT(DISTINCT p.patent_id)
        FROM resolved_domain_tags r
        JOIN patents p ON r.patent_id = p.patent_id
        {pm_join}
        WHERE {where_str} AND r.tag_axis = 'application_domain' AND r.candidate_domain_tag IS NOT NULL
        GROUP BY r.candidate_domain_tag
        ORDER BY COUNT(DISTINCT p.patent_id) DESC
        LIMIT 20
    """, params)
    domains_data = [{"domain": r[0], "count": r[1]} for r in cursor.fetchall()]
    
    # 5. Yearly priority filings count (Bar chart)
    # Count total publications (including placeholders) grouped by priority year, filtered by country
    yearly_counts = {}
    for pub, yr in pub_to_year.items():
        if yr is not None and 1999 <= yr <= 2024:
            if country is not None:
                c_upper = country.upper().strip()
                if not pub.upper().startswith(c_upper):
                    continue
            yearly_counts[yr] = yearly_counts.get(yr, 0) + 1
            
    yearly_data = [{"year": yr, "count": cnt} for yr, cnt in sorted(yearly_counts.items())]
    
    # 6. Country densities (Map)
    # Filter by year and calculate country code counts
    countries = []
    for pub, yr in pub_to_year.items():
        if year is not None and yr != year:
            continue
        if pub and len(pub) >= 2:
            cc = pub[:2]
            if cc.isalpha():
                countries.append(cc.upper())
                
    country_densities = dict(Counter(countries))
    
    conn.close()
    
    return {
        "total_patents": total_patents,
        "total_families": total_families,
        "domains": domains_data,
        "yearly_filings": yearly_data,
        "country_densities": country_densities
    }

def sanitize_fts_query(query: str) -> str:
    if not query:
        return ""
    import re
    # Replace characters that cause FTS syntax errors with spaces, keeping alphanumeric, spaces, and wildcard '*'
    sanitized = re.sub(r'[^\w\s\*]', ' ', query)
    return " ".join(sanitized.split())

def resolve_layer_to_embedding_id(cursor: sqlite3.Cursor, layer_family_id: str) -> str:
    if not layer_family_id:
        return layer_family_id
    cursor.execute("SELECT 1 FROM family_embedding_documents WHERE simple_family_id = ? LIMIT 1", (layer_family_id,))
    if cursor.fetchone():
        return layer_family_id
        
    cursor.execute("""
        SELECT p.publication_number, p.publication_number_normalized
        FROM patents p
        JOIN patent_family_layers l ON p.patent_id = l.patent_id
        WHERE l.simple_family_id = ?
        LIMIT 5;
    """, (layer_family_id,))
    pubs = []
    for r in cursor.fetchall():
        if r[0]: pubs.append(r[0])
        if r[1]: pubs.append(r[1])
        
    if pubs:
        placeholders = ",".join("?" * len(pubs))
        cursor.execute(f"""
            SELECT simple_family_id
            FROM family_embedding_documents
            WHERE representative_publication IN ({placeholders})
            LIMIT 1;
        """, pubs)
        row = cursor.fetchone()
        if row:
            return row[0]
            
    return layer_family_id

@app.get("/api/search")
def search_patents(
    q: str = Query("", description="Search text query"),
    type: str = Query("hybrid", description="Search type: keyword, vector, or hybrid"),
    company: str = Query(None, description="Filter by company key"),
    limit: int = Query(50, description="Max search results to return"),
    sort: str = Query("standard", description="Sorting method: standard, relevance, family_size, priority_date")
):
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=500, detail="Database file not found.")
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # If called directly in Python, FastAPI Query objects might be passed as defaults
    from fastapi.params import Query as FastAPIQuery
    if isinstance(q, FastAPIQuery):
        q = q.default or ""
    if isinstance(type, FastAPIQuery):
        type = type.default
    if isinstance(company, FastAPIQuery):
        company = company.default
    if isinstance(limit, FastAPIQuery):
        limit = limit.default
    if isinstance(sort, FastAPIQuery):
        sort = sort.default or "standard"
    
    # 1. Default empty search: return top families sorted by size or filing date
    if not q:
        params = []
        where_clauses = []
        joins = ""
        
        if company:
            clause = get_company_filter(company, params, table_alias="pm")
            where_clauses.append(clause)
            joins = "JOIN patent_family_layers l ON s.simple_family_id = l.simple_family_id JOIN active_pool_membership pm ON l.patent_id = pm.patent_id"
        
        where_str = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        
        cursor.execute(f"""
            SELECT DISTINCT s.simple_family_id, s.family_patent_count, s.filing_year
            FROM family_embedding_documents s
            {joins}
            {where_str};
        """, params)
        candidates = cursor.fetchall()
        
        # Sort in Python
        if sort == "priority_date":
            sorted_candidates = sorted(
                candidates, 
                key=lambda x: (x[2] if x[2] is not None else 0, family_total_sizes.get(x[0], x[1])), 
                reverse=True
            )
        else: # standard, relevance, family_size
            sorted_candidates = sorted(
                candidates, 
                key=lambda x: family_total_sizes.get(x[0], x[1]), 
                reverse=True
            )
        top_candidates = sorted_candidates[:limit]
        top_ids = [x[0] for x in top_candidates]
        
        results = []
        if top_ids:
            placeholders = ",".join("?" * len(top_ids))
            cursor.execute(f"""
                SELECT s.simple_family_id, s.title, s.filing_year, s.resolved_domain_tags_json, s.family_patent_count, s.abstract,
                       COALESCE(
                            (SELECT a2.raw_assignee_name
                             FROM patents p2
                             JOIN patent_assignees pa2 ON p2.patent_id = pa2.patent_id
                             JOIN assignees a2 ON pa2.assignee_id = a2.assignee_id
                             WHERE (p2.publication_number = s.representative_publication OR p2.publication_number_normalized = s.representative_publication) AND a2.raw_assignee_name IS NOT NULL
                             LIMIT 1),
                            'Unknown'
                       ) as assignee_name
                FROM family_embedding_documents s
                WHERE s.simple_family_id IN ({placeholders});
            """, top_ids)
            detail_rows = cursor.fetchall()
            
            # Map back to sort order
            detail_map = {r[0]: r for r in detail_rows}
            for fid, core_cnt, f_year in top_candidates:
                if fid in detail_map:
                    r = detail_map[fid]
                    results.append({
                        "family_id": r[0],
                        "title": r[1],
                        "priority_year": r[2],
                        "domain_tags": parse_domain_tags(r[3]),
                        "family_size": family_total_sizes.get(r[0], r[4]),
                        "abstract": r[5] or "No abstract available.",
                        "assignee": r[6] or "Unknown",
                        "score": 1.0,
                        "search_method": "default"
                    })
        conn.close()
        return results
 
    # 2. Keyword search (FTS match)
    keyword_results = []
    try:
        # Resolve company allowed families if company filter is active
        allowed_family_ids = None
        if company:
            sub_params = []
            clause = get_company_filter(company, sub_params, table_alias="pm")
            cursor.execute(f"""
                SELECT DISTINCT l.simple_family_id
                FROM patent_family_layers l
                JOIN active_pool_membership pm ON l.patent_id = pm.patent_id
                WHERE {clause} AND l.simple_family_id IS NOT NULL;
            """, sub_params)
            allowed_family_ids = {row[0] for row in cursor.fetchall()}

        # Call the package's search_family_keywords function which queries full text and claims
        search_res = search_family_keywords(
            db_path=DB_PATH,
            keywords=q,
            assignee=None,
            limit=500
        )
        
        # Extract and filter simple family IDs
        for r in search_res.get("results", []):
            fid = r.get("simple_family_id")
            if fid:
                if allowed_family_ids is not None and fid not in allowed_family_ids:
                    continue
                # Map the layer family ID to the corresponding embedding family ID
                emb_id = resolve_layer_to_embedding_id(cursor, fid)
                keyword_results.append(emb_id)
    except Exception as e:
        print(f"FTS Search error: {e}")
        keyword_results = []
 
    # 3. Vector search (Cosine similarity)
    vector_results = []
    vector_scores = {}
    
    if type in ["vector", "hybrid"]:
        if normalized_embeddings is not None and len(family_ids) > 0:
            try:
                # Get OpenAI embedding using query cache or API
                query_np = np.array(get_query_embedding(q, cursor, conn), dtype=np.float32)
                
                # Compute dot products (normalized_embeddings are normalized to unit norm)
                sims = np.dot(normalized_embeddings, query_np)
                
                # Fetch company allowed family IDs
                if company:
                    sub_params = []
                    clause = get_company_filter(company, sub_params, table_alias="pm")
                    cursor.execute(f"""
                        SELECT DISTINCT s.simple_family_id
                        FROM family_embedding_documents s
                        JOIN patent_family_layers l ON s.simple_family_id = l.simple_family_id
                        JOIN active_pool_membership pm ON l.patent_id = pm.patent_id
                        JOIN collection_stage_qc_evidence cqe ON l.patent_id = cqe.patent_id
                        WHERE {clause} AND cqe.slow_is_core_patent = 1;
                    """, sub_params)
                    allowed_family_ids = {row[0] for row in cursor.fetchall()}
                else:
                    allowed_family_ids = None
                
                # Sort and filter
                sorted_indices = np.argsort(sims)[::-1]
                count = 0
                for idx in sorted_indices:
                    fam_id = family_ids[idx]
                    if allowed_family_ids is not None and fam_id not in allowed_family_ids:
                        continue
                    vector_results.append(fam_id)
                    vector_scores[fam_id] = float(sims[idx])
                    count += 1
                    if count >= 100:
                        break
            except Exception as e:
                print(f"Vector search failed: {e}")
                if type == "vector":
                    type = "keyword"
        else:
            print("Embeddings cache not loaded, falling back to keyword search")
            if type == "vector":
                type = "keyword"

    # 4. Merge results and retrieve candidate details
    candidates = []
    search_method = "hybrid_rrf" if type == "hybrid" else type
    rrf_scores = {}
    
    if type == "keyword":
        candidates = keyword_results[:100]
    elif type == "vector":
        candidates = vector_results[:100]
    else:  # hybrid
        # Reciprocal Rank Fusion (RRF)
        for rank_idx, fam_id in enumerate(keyword_results):
            rrf_scores[fam_id] = rrf_scores.get(fam_id, 0.0) + (1.0 / (60.0 + (rank_idx + 1)))
        for rank_idx, fam_id in enumerate(vector_results):
            rrf_scores[fam_id] = rrf_scores.get(fam_id, 0.0) + (1.0 / (60.0 + (rank_idx + 1)))
            
        sorted_rrf = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
        candidates = [item[0] for item in sorted_rrf[:100]]

    # Fetch family details
    if not candidates:
        conn.close()
        return []
        
    placeholders = ",".join("?" * len(candidates))
    cursor.execute(f"""
        SELECT s.simple_family_id, s.title, s.filing_year, s.resolved_domain_tags_json, s.family_patent_count, s.abstract,
               COALESCE(
                   (SELECT a2.raw_assignee_name
                    FROM patents p2
                    JOIN patent_assignees pa2 ON p2.patent_id = pa2.patent_id
                    JOIN assignees a2 ON pa2.assignee_id = a2.assignee_id
                    WHERE (p2.publication_number = s.representative_publication OR p2.publication_number_normalized = s.representative_publication) AND a2.raw_assignee_name IS NOT NULL
                    LIMIT 1),
                   'Unknown'
               ) as assignee_name
        FROM family_embedding_documents s
        WHERE s.simple_family_id IN ({placeholders});
    """, candidates)
    
    details_map = {}
    for r in cursor.fetchall():
        details_map[r[0]] = {
            "family_id": r[0],
            "title": r[1],
            "priority_year": r[2],
            "domain_tags": parse_domain_tags(r[3]),
            "family_size": family_total_sizes.get(r[0], r[4]),
            "abstract": r[5] or "No abstract available.",
            "assignee": r[6] or "Unknown"
        }
        
    conn.close()
    
    # Construct results list
    results = []
    for idx, fam_id in enumerate(candidates):
        if fam_id in details_map:
            res_item = details_map[fam_id].copy()
            res_item["search_method"] = search_method
            
            # Populate scores & ranks
            if type == "vector":
                res_item["score"] = vector_scores.get(fam_id, 0.0)
                res_item["relevance_rank"] = idx + 1
            elif type == "hybrid":
                res_item["score"] = vector_scores.get(fam_id, 0.5)
                res_item["rrf_score"] = rrf_scores.get(fam_id, 0.0)
                res_item["relevance_rank"] = idx + 1
            else: # keyword
                res_item["score"] = max(0.1, 1.0 - (idx * 0.04))
                res_item["relevance_rank"] = idx + 1
                
            results.append(res_item)

    # 5. Apply selected sorting/ranking method
    if sort == "standard":
        if results:
            if type == "vector":
                relevance_key = lambda x: x["score"]
            elif type == "hybrid":
                relevance_key = lambda x: x["rrf_score"]
            else: # keyword
                relevance_key = lambda x: -x["relevance_rank"]

            rel_scores = [relevance_key(x) for x in results]
            sizes = [x["family_size"] for x in results]

            max_rel, min_rel = max(rel_scores), min(rel_scores)
            max_size, min_size = max(sizes), min(sizes)

            range_rel = max_rel - min_rel
            if range_rel < 1e-9:
                range_rel = 1.0

            range_size = max_size - min_size
            if range_size < 1e-9:
                range_size = 1.0

            for item in results:
                norm_rel = (relevance_key(item) - min_rel) / range_rel
                norm_size = (item["family_size"] - min_size) / range_size
                item["standard_score"] = 0.5 * norm_rel + 0.5 * norm_size

            results = sorted(results, key=lambda x: x["standard_score"], reverse=True)
    elif sort == "relevance":
        if type == "vector":
            results = sorted(results, key=lambda x: x["score"], reverse=True)
        elif type == "hybrid":
            results = sorted(results, key=lambda x: x["rrf_score"], reverse=True)
        else: # keyword
            results = sorted(results, key=lambda x: x["relevance_rank"])
    elif sort == "family_size":
        results = sorted(results, key=lambda x: x["family_size"], reverse=True)
    elif sort == "priority_date":
        # Sort by filing_year descending, sub-sorting by score descending
        results = sorted(results, key=lambda x: (x["priority_year"] if x["priority_year"] is not None else 0, x.get("score", 0.0) or x.get("rrf_score", 0.0)), reverse=True)

    # Slice to final limit
    results = results[:limit]

    # Re-assign hybrid RRF rank after sorting & slicing
    for idx, item in enumerate(results):
        if type == "hybrid":
            item["rrf_rank"] = idx + 1
            
    return results

@app.get("/api/family/{family_id}/graph")
def get_family_graph(family_id: str):
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=500, detail="Database file not found.")
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 1. Fetch seed details
    cursor.execute("""
        SELECT title, resolved_domain_tags_json as domain_tags, filing_year as priority_year, filing_year, representative_publication
        FROM family_embedding_documents
        WHERE simple_family_id = ?
    """, (family_id,))
    family_seed = cursor.fetchone()
    
    if not family_seed:
        cursor.execute("SELECT title, priority_year, filing_year, representative_publication FROM family_card_seeds WHERE simple_family_id = ?", (family_id,))
        family_seed = cursor.fetchone()
        if not family_seed:
            conn.close()
            raise HTTPException(status_code=404, detail=f"Family {family_id} not found.")
        title, priority_year, filing_year, representative_pub = family_seed
        domain_tags = "[]"
    else:
        title, domain_tags, priority_year, filing_year, representative_pub = family_seed
    
    cursor.execute("SELECT abstract FROM family_embedding_documents WHERE simple_family_id = ?;", (family_id,))
    abstract_row = cursor.fetchone()
    abstract = abstract_row[0] if abstract_row else "No abstract available."

    # 2. Comprehensive Family Resolution across all layers, members, priority applications, and EPO tables
    target_pids = set()
    target_family_ids = {family_id}
    target_pubs = set()
    if representative_pub:
        target_pubs.add(representative_pub)

    # A. Get patents directly linked in patent_family_layers or simple_family_members
    cursor.execute("SELECT patent_id FROM patent_family_layers WHERE simple_family_id = ?", (family_id,))
    for r in cursor.fetchall():
        target_pids.add(r[0])
        
    cursor.execute("SELECT patent_id, publication_number FROM simple_family_members WHERE simple_family_id = ?", (family_id,))
    for r in cursor.fetchall():
        if r[0]: target_pids.add(r[0])
        if r[1]: target_pubs.add(r[1])

    # B. Use representative_publication to resolve mapped family_ids & priority_numbers
    if representative_pub:
        cursor.execute("""
            SELECT p.patent_id, p.priority_number, l.simple_family_id
            FROM patents p
            LEFT JOIN patent_family_layers l ON p.patent_id = l.patent_id
            WHERE p.publication_number = ? OR p.publication_number_normalized = ?
        """, (representative_pub, representative_pub))
        for pid, prio, m_fid in cursor.fetchall():
            if pid: target_pids.add(pid)
            if m_fid: target_family_ids.add(m_fid)
            if prio:
                cursor.execute("SELECT patent_id, publication_number FROM patents WHERE priority_number = ?", (prio,))
                for pr2 in cursor.fetchall():
                    if pr2[0]: target_pids.add(pr2[0])
                    if pr2[1]: target_pubs.add(pr2[1])

    # Expand target_pids for all resolved target_family_ids
    for fid in list(target_family_ids):
        cursor.execute("SELECT patent_id FROM patent_family_layers WHERE simple_family_id = ?", (fid,))
        for r in cursor.fetchall():
            target_pids.add(r[0])

    # 3. Query patent details for all collected target_pids or target_pubs
    pub_rows = []
    if target_pids or target_pubs:
        pid_list = list(target_pids)
        pub_list = list(target_pubs)
        
        sql = """
            SELECT DISTINCT p.patent_id, p.publication_number, p.publication_number_normalized, p.country, p.filing_date, p.publication_date, p.kind_code, p.title, p.abstract,
                   COALESCE((SELECT a.raw_assignee_name FROM patent_assignees pa JOIN assignees a ON pa.assignee_id = a.assignee_id WHERE pa.patent_id = p.patent_id LIMIT 1), 'Unknown') as assignee_name,
                   (SELECT 1 FROM patent_text_versions WHERE patent_id = p.patent_id LIMIT 1) as has_text
            FROM patents p
            WHERE 1=0
        """
        params = []
        if pid_list:
            placeholders_p = ",".join("?" * len(pid_list))
            sql += f" OR p.patent_id IN ({placeholders_p})"
            params.extend(pid_list)
        if pub_list:
            placeholders_u = ",".join("?" * len(pub_list))
            sql += f" OR p.publication_number IN ({placeholders_u}) OR p.publication_number_normalized IN ({placeholders_u})"
            params.extend(pub_list + pub_list)
            
        cursor.execute(sql, params)
        pub_rows = cursor.fetchall()

    all_pubs = [r[1] for r in pub_rows if r[1]]
    all_pubs_norm = [r[2] for r in pub_rows if r[2]]

    if not representative_pub or (representative_pub not in all_pubs and representative_pub not in all_pubs_norm):
        if all_pubs:
            representative_pub = all_pubs[0]

    nodes = []
    node_map = {}

    for r in pub_rows:
        pid, pub, pub_norm, country, filing_date, pub_date, kind, p_title, p_abs, assignee, has_text = r
        if not pub or pub in node_map:
            continue
        node_id = f"pub_{pub}"
        node_map[pub] = node_id
        if pub_norm:
            node_map[pub_norm] = node_id

        is_rep = (pub == representative_pub or pub_norm == representative_pub or (representative_pub and pub.upper() == representative_pub.upper()))

        nodes.append({
            "id": node_id,
            "label": pub,
            "type": "representative" if is_rep else "sibling",
            "country": (country or (pub[:2] if pub else "XX")).upper(),
            "filing_date": filing_date,
            "publication_date": pub_date,
            "kind_code": kind or (pub[-2:] if pub and pub[-1].isalpha() else "Unknown"),
            "title": p_title or title,
            "assignee": assignee or "Unknown",
            "abstract": p_abs or abstract,
            "has_text": bool(has_text),
            "is_representative": is_rep
        })

    if nodes and not any(n["is_representative"] for n in nodes):
        nodes[0]["is_representative"] = True
        nodes[0]["type"] = "representative"

    # 4. Add EPO equivalents for all collected publication numbers
    search_pubs = list(node_map.keys())
    if search_pubs:
        placeholders = ",".join("?" * len(search_pubs))
        cursor.execute(f"""
            SELECT DISTINCT member_publication, member_publication_normalized
            FROM patent_epo_family_members
            WHERE publication_number IN ({placeholders})
               OR member_publication IN ({placeholders})
               OR epo_family_id IN (
                   SELECT DISTINCT epo_family_id
                   FROM patent_epo_family_members
                   WHERE publication_number IN ({placeholders}) OR member_publication IN ({placeholders})
               )
        """, search_pubs + search_pubs + search_pubs + search_pubs)
        for em in cursor.fetchall():
            epub, epub_norm = em
            if epub and epub not in node_map and (not epub_norm or epub_norm not in node_map):
                node_id = f"epo_{epub}"
                node_map[epub] = node_id
                cntry = (epub[:2] if epub and epub[:2].isalpha() else "XX").upper()
                nodes.append({
                    "id": node_id,
                    "label": epub,
                    "type": "epo_member",
                    "country": cntry,
                    "filing_date": None,
                    "publication_date": None,
                    "kind_code": epub[-2:] if epub and epub[-1].isalpha() else "Unknown",
                    "title": f"EPO Equivalent ({epub})",
                    "assignee": "Equivalent filing (Unassigned)",
                    "abstract": "No abstract available.",
                    "has_text": False,
                    "is_representative": False
                })

    # 5. Construct edges
    edges = []
    rep_nodes = [n for n in nodes if n["is_representative"]]
    rep_node = rep_nodes[0] if rep_nodes else (nodes[0] if nodes else None)

    if rep_node:
        rep_id = rep_node["id"]
        for node in nodes:
            if node["id"] != rep_id:
                edges.append({
                    "source": rep_id,
                    "target": node["id"],
                    "type": "equivalent",
                    "label": "sibling publication"
                })

    # 6. Citation edges within the family
    pub_nos = list(node_map.keys())
    if pub_nos:
        placeholders = ",".join("?" * len(pub_nos))
        cursor.execute(f"""
            SELECT source_publication_number, cited_publication_number, relation_direction, relation_source_field
            FROM patent_citation_edges
            WHERE source_publication_number IN ({placeholders}) AND cited_publication_number IN ({placeholders})
        """, pub_nos + pub_nos)
        citation_rows = cursor.fetchall()
        for crow in citation_rows:
            src, tgt, direction, field = crow
            src_id = node_map.get(src)
            tgt_id = node_map.get(tgt)
            if src_id and tgt_id and src_id != tgt_id:
                if not any(e["source"] == src_id and e["target"] == tgt_id and e["type"] == "citation" for e in edges):
                    edges.append({
                        "source": src_id,
                        "target": tgt_id,
                        "type": "citation",
                        "label": f"cites ({field})"
                    })

    conn.close()

    return {
        "family_id": family_id,
        "title": title,
        "abstract": abstract,
        "domain_tags": parse_domain_tags(domain_tags),
        "priority_year": priority_year,
        "filing_year": filing_year,
        "representative_publication": representative_pub,
        "visible_publication_count": len(nodes),
        "family_size": len(nodes),
        "nodes": nodes,
        "edges": edges
    }


@app.get("/api/patent/{publication_number}/description")
def get_patent_description(publication_number: str):
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=500, detail="Database file not found.")
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT text_content, language 
        FROM patent_text_versions 
        WHERE publication_number = ? AND text_type = 'full_description'
        LIMIT 1;
    """, (publication_number,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Full description not available for this publication.")
        
    return {
        "publication_number": publication_number,
        "text_content": row[0],
        "language": row[1]
    }

@app.get("/api/domain-cloud-data")
def get_domain_cloud_data(companies: str = Query(None, description="Comma-separated company keys")):
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=500, detail="Database file not found.")
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Resolve Query objects if passed in python test context
    from fastapi.params import Query as FastAPIQuery
    if isinstance(companies, FastAPIQuery):
        companies = companies.default
        
    # Resolve selected companies
    if companies is None:
        selected_company_keys = ["loreal", "beiersdorf", "procter_gamble", "shiseido", "unilever"]
    else:
        selected_company_keys = [c.strip().lower() for c in companies.split(",") if c.strip()]
        
    if not selected_company_keys:
        conn.close()
        return {"domains": TOP_DOMAINS or [], "points": []}
        
    company_clauses = []
    query_params = []
    
    for key in selected_company_keys:
        clause = get_company_filter(key, query_params, table_alias="pm")
        company_clauses.append(clause)
        
    if not company_clauses:
        conn.close()
        return {"domains": TOP_DOMAINS or [], "points": []}
        
    company_filter_str = f"({' OR '.join(company_clauses)})"
    
    try:
        cursor.execute(f"""
            SELECT DISTINCT r.publication_number, p.title, r.candidate_domain_tag, pm.company_key, r.confidence_resolved
            FROM resolved_domain_tags r
            JOIN patents p ON r.patent_id = p.patent_id
            JOIN active_pool_membership pm ON p.patent_id = pm.patent_id
            WHERE {company_filter_str} AND r.tag_axis = 'application_domain';
        """, query_params)
        rows = cursor.fetchall()
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Database query failed: {e}")
        
    conn.close()
    
    domains_filter = TOP_DOMAINS if TOP_DOMAINS else [
        'skin_care', 'hair_care', 'therapeutic_application', 
        'makeup_color_cosmetics', 'oral_care', 'cleansing_formula', 
        'food_beverage', 'sunscreen_photoprotection', 'hair_color'
    ]
            
    # Group domains by patent (publication_number)
    patent_groups = {}
    
    # Custom normalization helper to map keys to selected company keys
    def normalize_company_key(k: str) -> str:
        if not k:
            return ""
        k = k.lower().strip()
        if k in ("kao", "kaocorp", "kao_corp"):
            return "kao_corp"
        if k in ("esteelauder", "elcmanagement", "estee_lauder", "estee_lauder_inc", "estee_lauder_group_kk", "estee_lauder_international", "elc_management"):
            return "estee_lauder"
        return k

    # Load child_to_parent mapping dynamically to resolve child keys in active pool
    child_to_parent = {}
    for parent_key, parent_data in CORE_COMPANIES.items():
        for child_key in parent_data.get("keys", []):
            child_to_parent[child_key.lower().strip()] = parent_key

    for r in rows:
        pub, title, domain, company_key_from_db, confidence = r
        if not domain:
            continue
            
        if pub not in patent_groups:
            company_key = "other"
            
            k_lower = (company_key_from_db or "").lower().strip()
            resolved = child_to_parent.get(k_lower) or k_lower
            resolved = normalize_company_key(resolved)
            
            if resolved in selected_company_keys:
                company_key = resolved
            
            patent_groups[pub] = {
                "title": title or "Unknown Title",
                "company_key": company_key,
                "domain_scores": {}
            }
            
        conf_str = str(confidence).lower() if confidence is not None else ""
        if "high" in conf_str:
            conf = 0.9
        elif "medium" in conf_str:
            conf = 0.6
        elif "low" in conf_str:
            conf = 0.3
        else:
            conf = 0.5
            
        patent_groups[pub]["domain_scores"][domain] = max(
            patent_groups[pub]["domain_scores"].get(domain, 0.0), conf
        )
        
    points = []
    for pub, g in patent_groups.items():
        title = g["title"]
        company_key = g["company_key"]
        
        # Exclude unselected/other companies (e.g. gray dots)
        if company_key == "other":
            continue
            
        sorted_domains = sorted(g["domain_scores"].items(), key=lambda x: x[1], reverse=True)
        top_domains = sorted_domains[:3]
        
        for domain, _ in top_domains:
            if domain in domains_filter:
                points.append([pub, title, domain, company_key, 0])
                
    return {"domains": domains_filter, "points": points}

# ==========================================================================
# RESEARCH ASSISTANT AGENT WORKFLOW ENDPOINTS & HELPERS
# ==========================================================================
import uuid
import re

RESEARCH_TASKS_DIR = BASE_DIR / "data" / "reports" / "research_tasks"
os.makedirs(RESEARCH_TASKS_DIR, exist_ok=True)

def load_agent_prompt(path: Path) -> str:
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    return ""

# LLM API Callers
def call_deepseek(system_prompt: str, user_prompt: str, model: str = "deepseek-reasoner", history: list = None) -> str:
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise ValueError("DEEPSEEK_API_KEY environment variable is not set")
    
    url = "https://api.deepseek.com/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": user_prompt})
    
    data = {
        "model": model,
        "messages": messages,
        "temperature": 0.2
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers=headers,
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            return res_data["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"DeepSeek call failed: {e}. Falling back to OpenAI (gpt-5.4)...")
        return call_openai(system_prompt, user_prompt, model="gpt-5.4", history=history)

def call_openai(system_prompt: str, user_prompt: str, model: str = "gpt-5.5", history: list = None) -> str:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable is not set")
        
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": user_prompt})
    
    data = {
        "model": model,
        "messages": messages
    }
    # gpt-5.5 does not support temperature other than 1 (unsupported parameter value error for 0.2)
    if model not in ("gpt-5.5", "gpt-5.4"):
        data["temperature"] = 0.2
        
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers=headers,
        method="POST"
    )
    
    # Explicitly disable system/environment proxies for OpenAI calls
    proxy_handler = urllib.request.ProxyHandler({})
    opener = urllib.request.build_opener(proxy_handler)
    
    try:
        with opener.open(req, timeout=120) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            return res_data["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"OpenAI call with model {model} failed: {e}")
        if isinstance(e, urllib.error.HTTPError):
            try:
                err_body = e.read().decode("utf-8")
                print(f"OpenAI Error Body: {err_body}")
                e = ValueError(f"{e} - API Error details: {err_body}")
            except Exception:
                pass
        if model != "gpt-5.4":
            print("Falling back to gpt-5.4...")
            return call_openai(system_prompt, user_prompt, model="gpt-5.4", history=history)
        raise ValueError(f"OpenAI call failed: {e}")

# Tool executions
def execute_agent_tool(tool_name: str, args: dict) -> str:
    if tool_name == "run_sql":
        query = args.get("query", "")
        if not query.strip().upper().startswith("SELECT"):
            return json.dumps({"error": "Only SELECT queries are allowed."})
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(query)
            rows = cursor.fetchmany(50)
            result = [dict(row) for row in rows]
            conn.close()
            return json.dumps(result, indent=2)
        except Exception as e:
            return json.dumps({"error": str(e)})
            
    elif tool_name == "search_fts":
        query = args.get("query", "")
        limit = args.get("limit", 10)
        sanitized_query = sanitize_fts_query(query)
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("""
                SELECT publication_number, title, abstract, assignees, domain_tags, theme_tags
                FROM retrieval_publication_fts
                WHERE retrieval_publication_fts MATCH ?
                LIMIT ?
            """, (sanitized_query, limit))
            rows = cursor.fetchall()
            result = [dict(row) for row in rows]
            conn.close()
            return json.dumps(result, indent=2)
        except Exception as e:
            return json.dumps({"error": str(e)})
            
    elif tool_name == "search_vector":
        query = args.get("query", "")
        limit = args.get("limit", 10)
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            query_np = np.array(get_query_embedding(query, cursor, conn), dtype=np.float32)
            conn.close()
            
            global normalized_embeddings, family_ids
            if normalized_embeddings is None or len(family_ids) == 0:
                return json.dumps({"error": "Vector embeddings cache is not loaded yet."})
                
            sims = np.dot(normalized_embeddings, query_np)
            sorted_indices = np.argsort(sims)[::-1][:limit]
            
            result = []
            for idx in sorted_indices:
                result.append({
                    "family_id": family_ids[idx],
                    "score": float(sims[idx])
                })
            return json.dumps(result, indent=2)
        except Exception as e:
            return json.dumps({"error": str(e)})
            
    elif tool_name == "get_patent_details":
        pub = args.get("publication_number", "")
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("""
                SELECT patent_id, family_id, publication_number, country, filing_date, title, abstract, status
                FROM patents
                WHERE publication_number = ? OR publication_number_normalized = ?
                LIMIT 1
            """, (pub, pub))
            patent = cursor.fetchone()
            if not patent:
                conn.close()
                return json.dumps({"error": f"Patent {pub} not found."})
            patent_dict = dict(patent)
            
            cursor.execute("""
                SELECT text_type, language, text_available, substr(text_content, 1, 2000) as content_preview
                FROM patent_text_versions
                WHERE patent_id = ?
            """, (patent_dict["patent_id"],))
            patent_dict["text_versions"] = [dict(row) for row in cursor.fetchall()]
            
            cursor.execute("""
                SELECT tag_type, tag_value, confidence
                FROM patent_tags
                WHERE patent_id = ?
            """, (patent_dict["patent_id"],))
            patent_dict["tags"] = [dict(row) for row in cursor.fetchall()]
            
            conn.close()
            return json.dumps(patent_dict, indent=2)
        except Exception as e:
            return json.dumps({"error": str(e)})
            
    elif tool_name == "get_family_details":
        family_id = args.get("family_id", "")
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("""
                SELECT simple_family_id, title, assignee_primary, filing_year, priority_year, family_size, domain_tags, portfolio_score, representative_publication
                FROM family_card_seeds
                WHERE simple_family_id = ?
                LIMIT 1
            """, (family_id,))
            family = cursor.fetchone()
            if not family:
                conn.close()
                return json.dumps({"error": f"Family {family_id} not found."})
            family_dict = dict(family)
            
            # Resolve family ID
            resolved_family_id = resolve_family_id(cursor, family_id)
            
            cursor.execute("""
                SELECT p.patent_id, p.publication_number, p.country, p.filing_date, p.status, cqe.slow_is_core_patent as is_core
                FROM patents p
                JOIN patent_family_layers l ON p.patent_id = l.patent_id
                JOIN collection_stage_qc_evidence cqe ON p.patent_id = cqe.patent_id
                WHERE l.simple_family_id = ?
            """, (resolved_family_id,))
            family_dict["members"] = [dict(row) for row in cursor.fetchall()]
            
            conn.close()
            return json.dumps(family_dict, indent=2)
        except Exception as e:
            return json.dumps({"error": str(e)})
    else:
        return json.dumps({"error": f"Unknown tool name: {tool_name}"})

def save_research_task(task_id: str, data: dict):
    filepath = RESEARCH_TASKS_DIR / f"{task_id}.json"
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

def load_research_task(task_id: str) -> dict:
    filepath = RESEARCH_TASKS_DIR / f"{task_id}.json"
    if filepath.exists():
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    return None

def run_research_workflow(task_id: str, query: str):
    task = {
        "task_id": task_id,
        "query": query,
        "status": "running",
        "current_step": "Initializing agents and loading database maps...",
        "logs": [],
        "round": 1,
        "round1_evidence": None,
        "round1_evaluation": None,
        "round2_evidence": None,
        "combined_evidence": None,
        "report": None,
        "reviewed": False,
        "audit_results": None,
        "revised_report": None,
        "error": None
    }
    
    def log(message: str):
        print(f"[{task_id}] {message}")
        task["logs"].append({
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "message": message
        })
        save_research_task(task_id, task)
        
    log("Workflow started.")
    
    try:
        # Load agent prompts
        agents_dir = BASE_DIR / "Patent_Librarian_Agents"
        ret_agent_prompt = load_agent_prompt(agents_dir / "Patent Librarian Retrieval  Agent.MD")
        writ_agent_prompt = load_agent_prompt(agents_dir / "Patent Librarian Writing Agent.MD")
        
        # Load database map
        db_map_path = BASE_DIR / "database_map_compact.md"
        db_map = ""
        if db_map_path.exists():
            with open(db_map_path, "r", encoding="utf-8") as f:
                db_map = f.read()

        # ----------------------------------------------------
        # SEARCH STRATEGY GENERATION
        # ----------------------------------------------------
        log("Generating search strategy and aliases...")
        strategy_system_prompt = (
            "You are the Patent Librarian Search Strategy Agent.\n"
            "Your job is to analyze the user's research query and automatically determine if it targets a specific chemical ingredient, compound, or technology, and generate a list of all its aliases, synonyms, commercial names, and IUPAC/chemical names to maximize search recall.\n"
            "If the query targets a compound like Pro-Xylane (Hydroxypropyl Tetrahydropyrantriol), you MUST generate all its known aliases, such as:\n"
            "- Proxylane\n"
            "- Hydroxypropyl Tetrahydropyrantriol\n"
            "- Hydroxypropyl Tetrahydropyran Triol\n"
            "- hydroxypropyl tetrahydropyran\n"
            "- C-xyloside\n"
            "- C-glycoside\n"
            "- C-beta-D-xylopyranoside\n"
            "- C-beta-D-xylopyranoside\n"
            "- 2-hydroxypropyl xyloside\n\n"
            "Respond ONLY with a JSON object matching the following structure:\n"
            "```json\n"
            "{\n"
            "  \"is_ingredient_query\": true,\n"
            "  \"target_ingredient\": \"Pro-Xylane\",\n"
            "  \"search_keywords\": \"Proxylane, Hydroxypropyl Tetrahydropyrantriol, Hydroxypropyl Tetrahydropyran Triol, hydroxypropyl tetrahydropyran, C-xyloside, C-glycoside, C-beta-D-xylopyranoside, C-beta-D-xylopyranoside, 2-hydroxypropyl xyloside\"\n"
            "}\n"
            "```\n"
            "If the query is a broad portfolio or theme query that does not target a specific chemical ingredient, respond with:\n"
            "```json\n"
            "{\n"
            "  \"is_ingredient_query\": false,\n"
            "  \"target_ingredient\": null,\n"
            "  \"search_keywords\": null\n"
            "}\n"
            "```"
        )
        strategy_user_prompt = f"User query: {query}"
        strategy_response = call_deepseek(strategy_system_prompt, strategy_user_prompt, model="deepseek-reasoner")
        
        is_ingredient_query = False
        search_keywords = None
        
        json_match_strat = re.search(r"```json\s*([\s\S]*?)\s*```", strategy_response) or re.search(r"(\{[\s\S]*\})", strategy_response)
        if json_match_strat:
            try:
                strat_json = json.loads(json_match_strat.group(1).strip())
                is_ingredient_query = strat_json.get("is_ingredient_query", False)
                search_keywords = strat_json.get("search_keywords")
            except Exception as parse_ex:
                log(f"Failed to parse search strategy JSON: {parse_ex}")
                
        if is_ingredient_query and search_keywords:
            log(f"Detected ingredient-specific query. Generated search keywords and aliases: {search_keywords}")
        else:
            log("No specific ingredient detected in query. Proceeding with broad portfolio/theme mapping.")

        # ----------------------------------------------------
        # ROUND 1 RETRIEVAL
        # ----------------------------------------------------
        task["current_step"] = "Round 1: Planning and retrieving evidence..."
        log("Round 1 Retrieval started.")
        
        system_prompt = (
            "You are the Retrieval Planner Agent for Patent Librarian.\n"
            "Your job is to analyze the user question and determine which query templates are required to construct the evidence packet.\n"
            "You MUST NOT output any final statistics, representative families, status distributions, safe claims, or report-ready conclusions. You only choose the retrieval route.\n\n"
            "Available query templates:\n"
            "- company_family_scope_summary\n"
            "- family_domain_counts_by_period\n"
            "- family_domain_rank_changes\n"
            "- family_confidence_distribution\n"
            "- family_status_distribution_by_period\n"
            "- representative_families_by_domain_period\n"
            "- untagged_family_coverage\n"
            "- domain_overlap_summary\n"
            "- outlier_candidate_families\n\n"
            "NOTE: Company scoping is handled automatically by the backend \u2014 do NOT include company_key in your output.\n\n"
            "Please output your plan as a JSON code block matching the following structure:\n"
            "```json\n"
            "{\n"
            "  \"queries\": [\n"
            "    \"company_family_scope_summary\",\n"
            "    \"family_domain_counts_by_period\",\n"
            "    ...\n"
            "  ],\n"
            "  \"params\": {\n"
            "    \"from_year\": 2000,\n"
            "    \"to_year\": 2024\n"
            "  }\n"
            "}\n"
            "```"
        )
        
        user_prompt = f"User natural language query: {query}"
        
        log("Calling Retrieval Planner Agent (DeepSeek)...")
        planner_response = call_deepseek(system_prompt, user_prompt, model="deepseek-reasoner")
        
        requested_templates = []
        from_year = None
        to_year = None
        
        json_match = re.search(r"```json\s*([\s\S]*?)\s*```", planner_response) or re.search(r"````json\s*([\s\S]*?)\s*````", planner_response) or re.search(r"(\{[\s\S]*\})", planner_response)
        if json_match:
            try:
                plan_json = json.loads(json_match.group(1).strip())
                requested_templates = plan_json.get("queries", [])
                params = plan_json.get("params", {})
                from_year = params.get("from_year")
                to_year = params.get("to_year")
            except Exception as parse_ex:
                log(f"Failed to parse planner JSON: {parse_ex}")

        # ----------------------------------------------------------------
        # Company scoping — determined SOLELY by keyword detection.
        # The LLM is never asked to choose a company; this block is the
        # single source of truth for company_key.
        #
        # Rules:
        #   - Explicit company / brand name in the query  → that company
        #   - No company signal whatsoever                → "all_companies"
        #     (runs a true cross-portfolio broad search)
        # ----------------------------------------------------------------
        global CORE_COMPANIES
        if not CORE_COMPANIES:
            CORE_COMPANIES = load_companies_from_db(DB_PATH)
        company_key = "all_companies"   # default: broad search
        fall_from = 2000
        fall_to = 2024
        q_low = query.lower()

        if "beiersdorf" in q_low or "nivea" in q_low or "eucerin" in q_low or "la prairie" in q_low:
            company_key = "beiersdorf"
        elif "shiseido" in q_low:
            company_key = "shiseido"
        elif ("procter" in q_low or "p&g" in q_low or "gamble" in q_low
              or "pantene" in q_low or "olay" in q_low
              or "head & shoulders" in q_low or "gillette" in q_low):
            company_key = "procter_gamble"
        elif ("loreal" in q_low or "l'oreal" in q_low or "l'oréal" in q_low
              or "loréal" in q_low or "lancome" in q_low or "lancôme" in q_low
              or "garnier" in q_low or "maybelline" in q_low or "kerastase" in q_low
              or "kérastase" in q_low or "redken" in q_low or "vichy" in q_low):
            company_key = "loreal"
        else:
            # Dynamically check loaded companies (e.g., croda, basf, unilever, etc.)
            for c_key, c_info in CORE_COMPANIES.items():
                if c_key == "all_companies":
                    continue
                c_name = c_info.get("name", "").lower()
                c_key_clean = c_key.replace("_", " ").lower()
                if c_key in q_low or c_key_clean in q_low or (c_name and c_name in q_low):
                    company_key = c_key
                    break

        log(f"Company scope resolved to: '{company_key}' (keyword-based, no LLM involvement)")

        years = [int(y) for y in re.findall(r'\b(19\d{2}|20\d{2})\b', query)]
        if years:
            if len(years) >= 2:
                years.sort()
                fall_from = max(1999, min(years))
                fall_to = min(2025, max(years))
            else:
                fall_from = years[0]

        if not from_year:
            from_year = fall_from
        if not to_year:
            to_year = fall_to

        if not requested_templates:
            requested_templates = [
                "company_family_scope_summary",
                "family_domain_counts_by_period",
                "family_domain_rank_changes",
                "family_confidence_distribution",
                "family_status_distribution_by_period",
                "representative_families_by_domain_period",
                "untagged_family_coverage",
                "domain_overlap_summary",
                "outlier_candidate_families"
            ]
            
        log(f"Executing deterministic retrieval for company={company_key}, from_year={from_year}, to_year={to_year} using templates: {requested_templates}")
        
        from patent_librarian.retrieval.evidence_builder import EvidenceBuilder
        
        builder = EvidenceBuilder(
            db_path=str(DB_PATH),
            company_key=company_key,
            from_year=from_year,
            to_year=to_year,
            task_id=task_id,
            keywords=search_keywords
        )
        
        evidence_packet = builder.build_evidence_packet(requested_templates)
        task["round1_evidence"] = evidence_packet
        log("Round 1 Retrieval complete.")
        
        # ----------------------------------------------------
        # ROUND 1 WRITING EVALUATION
        # ----------------------------------------------------
        task["current_step"] = "Round 1: Evaluating evidence adequacy..."
        log("Writing Agent evaluating evidence...")
        
        eval_system_prompt = (
            f"{writ_agent_prompt}\n\n"
            f"--- EVALUATION INSTRUCTIONS ---\n"
            f"You are the Writing Agent. Before writing, you must decide if the provided Evidence Packet is sufficient to answer the user query.\n"
            f"Please review the Evidence Packet and output a JSON decision:\n"
            f"If SUFFICIENT, output:\n"
            f"{{\n"
            f"  \"decision\": \"SUFFICIENT\",\n"
            f"  \"report\": \"[Write your complete, beautiful markdown report here adhering strictly to the guidelines and formatting policies]\"\n"
            f"}}\n"
            f"If INSUFFICIENT, output:\n"
            f"{{\n"
            f"  \"decision\": \"INSUFFICIENT\",\n"
            f"  \"feedback\": \"[Explain what additional evidence, tables, columns, or patent numbers you need the Retrieval Agent to pull]\"\n"
            f"}}"
        )
        
        eval_user_prompt = f"User query: {query}\n\nEvidence Packet:\n{json.dumps(evidence_packet, indent=2)}"
        
        log("Calling Writing Agent (DeepSeek) for evaluation...")
        eval_response = call_deepseek(eval_system_prompt, eval_user_prompt, model="deepseek-reasoner")
        
        decision_dict = None
        json_match = re.search(r"(\{[\s\S]*\})", eval_response)
        if json_match:
            try:
                decision_dict = json.loads(json_match.group(1).strip())
            except Exception:
                pass
                
        if not decision_dict:
            decision_dict = {
                "decision": "SUFFICIENT",
                "report": eval_response
            }
            
        task["round1_evaluation"] = decision_dict
        decision_val = decision_dict.get("decision", "SUFFICIENT")
        log(f"Writing Agent decision: {decision_val}")
        
        # ----------------------------------------------------
        # ROUND 2 RETRIEVAL (IF INSUFFICIENT)
        # ----------------------------------------------------
        if decision_val == "INSUFFICIENT":
            task["round"] = 2
            task["current_step"] = "Round 2: Retrieving additional evidence..."
            feedback = decision_dict.get("feedback", "Need more evidence.")
            log(f"Round 2 Retrieval started. Gaps: {feedback}")
            
            log(f"Rerunning Evidence Builder in Round 2 to address gaps: {feedback}")
            
            from patent_librarian.retrieval.evidence_builder import EvidenceBuilder
            
            builder_r2 = EvidenceBuilder(
                db_path=str(DB_PATH),
                company_key=evidence_packet.get("scope", {}).get("company", "loreal"),
                from_year=int(evidence_packet.get("scope", {}).get("time_range", "2000-2024").split("-")[0]),
                to_year=int(evidence_packet.get("scope", {}).get("time_range", "2000-2024").split("-")[-1]),
                task_id=task_id,
                keywords=search_keywords
            )
            
            all_templates = [
                "company_family_scope_summary",
                "family_domain_counts_by_period",
                "family_domain_rank_changes",
                "family_confidence_distribution",
                "family_status_distribution_by_period",
                "representative_families_by_domain_period",
                "untagged_family_coverage",
                "domain_overlap_summary",
                "outlier_candidate_families"
            ]
            
            evidence_packet_r2 = builder_r2.build_evidence_packet(all_templates)
            task["round2_evidence"] = evidence_packet_r2
            log("Round 2 Retrieval complete.")
            
            log("Combining Evidence Packets...")
            combined_evidence = {
                "round1_evidence": evidence_packet,
                "round2_evidence": evidence_packet_r2,
                "note": "Combined evidence from rounds 1 and 2"
            }
            task["combined_evidence"] = combined_evidence
            
            # ----------------------------------------------------
            # ROUND 2 WRITING (FINAL)
            # ----------------------------------------------------
            task["current_step"] = "Round 2: Writing final report..."
            log("Writing Agent drafting final report...")
            
            final_system_prompt = (
                f"{writ_agent_prompt}\n\n"
                f"--- FINAL DRAFT INSTRUCTIONS ---\n"
                f"This is Round 2 (the final round). You MUST write the final report now based on the combined evidence.\n"
                f"Format your output as a complete, beautiful markdown report. Adhere strictly to evidence limits and the guidelines."
            )
            
            final_user_prompt = f"User query: {query}\n\nCombined Evidence Packets:\n{json.dumps(combined_evidence, indent=2)}"
            
            log("Calling Writing Agent (DeepSeek) to write final report...")
            final_report = call_deepseek(final_system_prompt, final_user_prompt, model="deepseek-reasoner")
            task["report"] = final_report
            
        else:
            # Sufficient in Round 1
            task["combined_evidence"] = evidence_packet
            task["report"] = decision_dict.get("report", eval_response)
            
        log("Initial report writing complete.")
        
        # ----------------------------------------------------
        # PATENT VERIFICATION & REVIEW AGENT REDRAFTING
        # ----------------------------------------------------
        task["current_step"] = "Patent Hallucination Audit & Reviewing report..."
        log("Gathering all patent numbers from evidence packs...")
        
        from patent_verifier import gather_evidence_patent_numbers, verify_report_patents
        
        full_set, base_set, raw_patents = gather_evidence_patent_numbers(task["combined_evidence"])
        log(f"Gathered {len(full_set)} real patent publication numbers/variants from evidence packs.")
        
        log("Comparing drafted report to real evidence patent numbers...")
        verification_result = verify_report_patents(task["report"], full_set, base_set)
        
        task["hallucination_review"] = verification_result
        annotated_report = verification_result["annotated_report"]
        hallucinated_list = verification_result["hallucinated_patents"]
        
        if hallucinated_list:
            log(f"⚠️ Detected {len(hallucinated_list)} patent publication numbers with HIGH HALLUCINATION RISK in draft report: {[p['patent_number'] for p in hallucinated_list]}")
        else:
            log("✅ All patent numbers in draft report verified against evidence packs.")

        task["original_draft"] = task["report"]
        task["annotated_draft"] = annotated_report

        log("Invoking Review Agent to redraft report and resolve patent hallucination risks...")
        
        review_agent_prompt = load_agent_prompt(agents_dir / "Patent Librarian Review Agent.MD")
        
        review_system_prompt = (
            f"{review_agent_prompt}\n\n"
            f"--- COMPREHENSIVE HALLUCINATION REVIEW & REDRAFT INSTRUCTIONS ---\n"
            f"You are the Review Agent. Perform a comprehensive hallucination check on the draft report against the Evidence Packet:\n"
            f"1. PATENT NUMBERS: Check all patent publication numbers (especially those tagged [HIGH HALLUCINATION RISK]). Replace hallucinated numbers with valid patent numbers from the Evidence Packet or remove unsupported citations.\n"
            f"2. QUANTITATIVE METRICS: Verify all statistics, filing counts, percentages, year ranges, and growth rates (CAGR) against quantitative_snapshot, period_summaries, and domain_counts in the Evidence Packet. Correct any fabricated numbers.\n"
            f"3. LEGAL & ASSET CLAIMS: Ensure pending applications are not treated as granted assets, and do not make status/litigation claims unsupported by the Evidence Packet.\n"
            f"4. OVERCLAIMS & CAVEATS: Remove unsupported commercialization claims or market dominance conclusions. Re-insert material caveats and data limitations where omitted.\n"
            f"Output ONLY the complete, beautiful, redrafted Markdown report with 100% evidence grounding."
        )
        
        pruned_evidence_review = prune_evidence_for_llm(task["combined_evidence"])
        
        review_user_prompt = (
            f"User Query: {query}\n\n"
            f"Evidence Packet:\n{json.dumps(pruned_evidence_review, indent=2)}\n\n"
            f"Hallucination Reviewed Report (Annotated Draft):\n{annotated_report}"
        )
        
        log("Calling Review Agent (DeepSeek) to redraft report...")
        redrafted_report = call_deepseek(review_system_prompt, review_user_prompt, model="deepseek-reasoner")
        
        task["report"] = redrafted_report
        task["reviewed"] = False  # Auditor Agent is NOT automatically invoked
        
        log("Review Agent completed redrafting. Final hallucination-checked report generated.")
        log("Note: Auditor Agent was not automatically invoked.")

        task["current_step"] = "Completed"
        task["status"] = "completed"
        save_research_task(task_id, task)
        
    except Exception as e:
        import traceback
        err_msg = str(e)
        trace = traceback.format_exc()
        log(f"Workflow error: {err_msg}")
        print(trace)
        task["status"] = "failed"
        task["current_step"] = "Error"
        task["error"] = err_msg
        save_research_task(task_id, task)

# Routes for Research Assistant
@app.post("/api/research/start")
def start_research_task(payload: dict):
    query = payload.get("query", "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")
        
    task_id = str(uuid.uuid4())
    t = threading.Thread(target=run_research_workflow, args=(task_id, query), daemon=True)
    t.start()
    
    return {"task_id": task_id, "status": "running"}

@app.get("/api/research/status/{task_id}")
def get_research_task_status(task_id: str):
    task = load_research_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

def prune_evidence_for_llm(evidence: dict) -> dict:
    import copy
    pruned = copy.deepcopy(evidence)

    # 1. Representative families — keep top 50, use patent publication number as
    #    the primary identifier (not the internal family ID).
    if "representative_families" in pruned:
        families = pruned["representative_families"]
        # Sort by score descending before slicing
        families_sorted = sorted(families, key=lambda f: float(f.get("score") or 0), reverse=True)
        pruned_families = []
        for fam in families_sorted[:50]:
            pruned_families.append({
                "patent_number":        fam.get("representative_publication"),
                "title":                fam.get("title"),
                "priority_year":        fam.get("priority_year"),
                "period":               fam.get("period"),
                "domain_tags":          fam.get("domain_tags"),
                "selected_for_domains": fam.get("selected_for_domains"),
                "selection_reason":     fam.get("selection_reason"),
                "score":                fam.get("score"),
                "family_confidence":    fam.get("family_confidence"),
            })
        pruned["representative_families"] = pruned_families

    # 2. Outliers — patent_number is set by evidence_builder; strip internal fields.
    if "outliers" in pruned:
        pruned_outliers = []
        for o in pruned["outliers"]:
            pruned_outliers.append({
                "patent_number":   o.get("patent_number") or o.get("representative_publication") or o.get("simple_family_id"),
                "title":           o.get("title"),
                "citation_count":  o.get("citation_count"),
                "family_size":     o.get("family_size"),
                "portfolio_score": o.get("portfolio_score"),
            })
        pruned["outliers"] = pruned_outliers

    # 3. Prune 'derived_from' from quantitative snapshot lists
    snap = pruned.get("quantitative_snapshot", {})
    for key in ["domain_counts", "domain_shares", "rank_changes"]:
        if key in snap and isinstance(snap[key], list):
            for item in snap[key]:
                if isinstance(item, dict):
                    item.pop("derived_from", None)

    # 4. Remove execution manifest (internal plumbing, not needed by LLM)
    pruned.pop("execution_manifest", None)

    return pruned

@app.post("/api/research/review")
def review_research_report(payload: dict):
    task_id = payload.get("task_id")
    if not task_id:
        raise HTTPException(status_code=400, detail="Missing task_id")
        
    task = load_research_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    if task["status"] != "completed":
        raise HTTPException(status_code=400, detail="Workflow has not completed yet")
        
    try:
        agents_dir = BASE_DIR / "Patent_Librarian_Agents"
        editor_agent_prompt = load_agent_prompt(agents_dir / "Patent Librarian Editor  Auditor.MD")
        
        system_prompt = (
            f"{editor_agent_prompt}\n\n"
            f"--- REVIEW & REVISE INSTRUCTIONS ---\n"
            f"You are the Editor / Audit Agent. You must review the draft report against the combined Evidence Packet.\n"
            f"Check for unsupported claims, overclaims, missing caveats, etc. as listed in your guidelines.\n"
            f"You MUST output your response in the following format:\n"
            f"1. A JSON audit block wrapped in ```json and ``` code block matching the FULL_AUDIT structure from your guidelines:\n"
            f"```json\n"
            f"{{\n"
            f"  \"audit_type\": \"full_audit\",\n"
            f"  \"overall_status\": \"PASS | PASS_WITH_MINOR_EDITS | NEEDS_REVISION | FAIL\",\n"
            f"  \"executive_summary\": \"...\",\n"
            f"  \"claim_audit\": [...],\n"
            f"  \"safe_to_publish\": true/false\n"
            f"}}\n"
            f"```\n"
            f"2. A revised report in markdown wrapped in ```markdown and ``` code block. Soften or revise any overstated claims to make it safe, accurate, and evidence-grounded, keeping the writer's voice where possible."
        )
        
        # Optimize evidence packet size to prevent rate limits and gateway timeouts
        pruned_evidence = prune_evidence_for_llm(task['combined_evidence'])
        
        user_prompt = (
            f"Evidence Packet:\n{json.dumps(pruned_evidence, indent=2)}\n\n"
            f"Draft Report:\n{task['report']}"
        )
        
        print("Calling Editor Auditor Agent (GPT 5.5)...")
        review_response = call_openai(system_prompt, user_prompt, model="gpt-5.5")
        
        audit_json = None
        revised_markdown = None
        
        json_match = re.search(r"```json\s*([\s\S]*?)\s*```", review_response) or re.search(r"````json\s*([\s\S]*?)\s*````", review_response)
        if json_match:
            try:
                audit_json = json.loads(json_match.group(1).strip())
            except Exception:
                pass
        
        md_match = re.search(r"```markdown\s*([\s\S]*?)\s*```", review_response) or re.search(r"````markdown\s*([\s\S]*?)\s*````", review_response)
        if md_match:
            revised_markdown = md_match.group(1).strip()
            
        if not audit_json:
            json_fallback = re.search(r"(\{[\s\S]*\})", review_response)
            if json_fallback:
                try:
                    audit_json = json.loads(json_fallback.group(1).strip())
                except Exception:
                    pass
                    
        if not revised_markdown:
            revised_markdown = re.sub(r"```json\s*[\s\S]*?\s*```", "", review_response).strip()
            
        task["reviewed"] = True
        task["audit_results"] = audit_json or {"raw_review": review_response}
        task["revised_report"] = revised_markdown or review_response
        
        save_research_task(task_id, task)
        return {"status": "success", "task_id": task_id}
        
    except Exception as e:
        print(f"Review failed: {e}")
        raise HTTPException(status_code=500, detail=f"Review execution failed: {str(e)}")

@app.get("/api/research/download/{task_id}/{version}")
def download_research_report(task_id: str, version: str):
    task = load_research_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    if task["status"] != "completed":
        raise HTTPException(status_code=400, detail="Workflow has not completed yet")
        
    if version == "original":
        content = task.get("report", "")
        filename = f"research_report_{task_id}.md"
    elif version == "revised":
        if not task.get("reviewed"):
            raise HTTPException(status_code=400, detail="Report has not been reviewed yet")
        content = task.get("revised_report", "")
        filename = f"research_report_revised_{task_id}.md"
    else:
        raise HTTPException(status_code=400, detail="Invalid version. Must be 'original' or 'revised'")
        
    from fastapi.responses import Response
    return Response(
        content=content,
        media_type="text/markdown",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )

# Serve Frontend SPA
@app.get("/")
def read_root():
    return FileResponse(STATIC_DIR / "index.html")

# Mount the static directory
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8080, reload=True)
