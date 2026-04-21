/*
 * StorageAdapter — Love Arcade v16.0
 * Interfaz unificada: get, set, remove, listByPrefix, transaction.
 * Web: localStorage.
 * Native: SQLite + Preferences (fallback localStorage si plugin no disponible).
 */
(function (global) {
    'use strict';

    const DB_NAME = 'love_arcade_storage';
    const DB_TABLE = 'kv_store';
    const SCHEMA_VERSION_KEY = 'love_arcade_schema_version';
    const SCHEMA_VERSION = '2';
    const SENSITIVE_KEY_PATTERNS = [
        /^love_arcade_session/i,
        /^supabase\./i,
        /token/i,
        /secret/i,
        /password/i,
        /auth/i,
    ];

    function _isNativePlatform() {
        try {
            return Boolean(global.Capacitor?.isNativePlatform?.());
        } catch (_) {
            return false;
        }
    }

    function _isSensitiveKey(key) {
        return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(String(key || '')));
    }

    function _getPreferences() {
        return global.Capacitor?.Plugins?.Preferences || global.Preferences || null;
    }

    function _getSecureStorage() {
        return global.Capacitor?.Plugins?.CapacitorSecureStoragePlugin
            || global.Capacitor?.Plugins?.SecureStoragePlugin
            || global.SecureStoragePlugin
            || null;
    }

    function _getSQLitePlugin() {
        return global.Capacitor?.Plugins?.CapacitorSQLite || global.CapacitorSQLite || null;
    }

    function _jsonParse(raw, fallback) {
        try { return JSON.parse(raw); } catch (_) { return fallback; }
    }

    const LocalStorageBackend = {
        async init() {},
        async get(key) {
            const val = localStorage.getItem(key);
            return val === null ? null : val;
        },
        async set(key, value) {
            localStorage.setItem(key, String(value));
        },
        async remove(key) {
            localStorage.removeItem(key);
        },
        async listKeys() {
            const keys = [];
            for (let i = 0; i < localStorage.length; i += 1) {
                const key = localStorage.key(i);
                if (typeof key === 'string') keys.push(key);
            }
            return keys;
        },
        async listByPrefix(prefix) {
            const keys = await this.listKeys();
            const out = {};
            for (const key of keys) {
                if (!key.startsWith(prefix)) continue;
                const value = localStorage.getItem(key);
                if (value !== null) out[key] = value;
            }
            return out;
        },
        async transaction(handler) {
            return await handler(this);
        }
    };

    function createNativeBackend() {
        const sqlite = _getSQLitePlugin();
        const preferences = _getPreferences();
        const secureStorage = _getSecureStorage();
        if (!sqlite || !preferences) return null;

        let _dbReady = false;

        async function _ensureDb() {
            if (_dbReady) return;
            await sqlite.createConnection({ database: DB_NAME, version: 1, encrypted: false, mode: 'no-encryption', readonly: false });
            await sqlite.open({ database: DB_NAME, readonly: false });
            await sqlite.execute({
                database: DB_NAME,
                statements: `CREATE TABLE IF NOT EXISTS ${DB_TABLE} (k TEXT PRIMARY KEY NOT NULL, v TEXT, updated_at INTEGER NOT NULL);`
            });
            _dbReady = true;
        }

        async function _secureSet(key, value) {
            if (!secureStorage?.set) return false;
            try {
                await secureStorage.set({ key, value: String(value) });
                return true;
            } catch (_) {
                return false;
            }
        }

        async function _secureGet(key) {
            if (!secureStorage?.get) return null;
            try {
                const res = await secureStorage.get({ key });
                return typeof res?.value === 'string' ? res.value : null;
            } catch (_) {
                return null;
            }
        }

        async function _secureRemove(key) {
            if (!secureStorage?.remove) return;
            try { await secureStorage.remove({ key }); } catch (_) {}
        }

        async function _migrateFromLocalStorage() {
            const schema = await preferences.get({ key: SCHEMA_VERSION_KEY });
            if (String(schema?.value || '') === SCHEMA_VERSION) return;

            const keys = [];
            for (let i = 0; i < localStorage.length; i += 1) {
                const k = localStorage.key(i);
                if (typeof k === 'string') keys.push(k);
            }

            await _ensureDb();
            const now = Date.now();
            for (const key of keys) {
                const value = localStorage.getItem(key);
                if (value === null) continue;
                if (_isSensitiveKey(key)) {
                    const stored = await _secureSet(key, value);
                    if (!stored) {
                        await sqlite.run({ database: DB_NAME, statement: `INSERT OR REPLACE INTO ${DB_TABLE} (k, v, updated_at) VALUES (?, ?, ?);`, values: [key, value, now] });
                    }
                } else {
                    await sqlite.run({ database: DB_NAME, statement: `INSERT OR REPLACE INTO ${DB_TABLE} (k, v, updated_at) VALUES (?, ?, ?);`, values: [key, value, now] });
                }
            }

            await preferences.set({ key: SCHEMA_VERSION_KEY, value: SCHEMA_VERSION });
        }

        return {
            async init() {
                await _ensureDb();
                await _migrateFromLocalStorage();
            },
            async get(key) {
                await _ensureDb();
                if (_isSensitiveKey(key)) {
                    const secureVal = await _secureGet(key);
                    if (secureVal !== null) return secureVal;
                }
                const row = await sqlite.query({ database: DB_NAME, statement: `SELECT v FROM ${DB_TABLE} WHERE k = ? LIMIT 1;`, values: [key] });
                const first = row?.values?.[0];
                if (!first) return null;
                if (typeof first.v === 'string') return first.v;
                if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
                return null;
            },
            async set(key, value) {
                await _ensureDb();
                const str = String(value);
                if (_isSensitiveKey(key)) {
                    const secureSaved = await _secureSet(key, str);
                    if (secureSaved) {
                        await sqlite.run({ database: DB_NAME, statement: `DELETE FROM ${DB_TABLE} WHERE k = ?;`, values: [key] });
                        return;
                    }
                }
                await sqlite.run({ database: DB_NAME, statement: `INSERT OR REPLACE INTO ${DB_TABLE} (k, v, updated_at) VALUES (?, ?, ?);`, values: [key, str, Date.now()] });
            },
            async remove(key) {
                await _ensureDb();
                await _secureRemove(key);
                await sqlite.run({ database: DB_NAME, statement: `DELETE FROM ${DB_TABLE} WHERE k = ?;`, values: [key] });
            },
            async listKeys() {
                await _ensureDb();
                const rows = await sqlite.query({ database: DB_NAME, statement: `SELECT k FROM ${DB_TABLE};` });
                const dbKeys = (rows?.values || []).map((r) => r.k || r[0]).filter((k) => typeof k === 'string');
                return Array.from(new Set(dbKeys));
            },
            async listByPrefix(prefix) {
                await _ensureDb();
                const likePattern = `${prefix}%`;
                const rows = await sqlite.query({
                    database: DB_NAME,
                    statement: `SELECT k, v FROM ${DB_TABLE} WHERE k LIKE ?;`,
                    values: [likePattern]
                });
                const out = {};
                for (const row of (rows?.values || [])) {
                    const key = row.k || row[0];
                    const value = row.v || row[1];
                    if (typeof key === 'string' && typeof value === 'string') out[key] = value;
                }
                return out;
            },
            async transaction(handler) {
                await _ensureDb();
                await sqlite.execute({ database: DB_NAME, statements: 'BEGIN TRANSACTION;' });
                try {
                    const result = await handler(this);
                    await sqlite.execute({ database: DB_NAME, statements: 'COMMIT;' });
                    return result;
                } catch (err) {
                    await sqlite.execute({ database: DB_NAME, statements: 'ROLLBACK;' });
                    throw err;
                }
            },
            async metadata() {
                const schema = await preferences.get({ key: SCHEMA_VERSION_KEY });
                return { schemaVersion: schema?.value || null };
            }
        };
    }

    const StorageAdapter = {
        _backend: LocalStorageBackend,
        _readyPromise: null,

        async init() {
            if (this._readyPromise) return this._readyPromise;
            this._readyPromise = (async () => {
                const nativeBackend = _isNativePlatform() ? createNativeBackend() : null;
                this._backend = nativeBackend || LocalStorageBackend;
                await this._backend.init();
                return this;
            })();
            return this._readyPromise;
        },

        async ready() {
            return await this.init();
        },

        async get(key) {
            await this.ready();
            return await this._backend.get(key);
        },

        async set(key, value) {
            await this.ready();
            return await this._backend.set(key, value);
        },

        async remove(key) {
            await this.ready();
            return await this._backend.remove(key);
        },

        async listByPrefix(prefix) {
            await this.ready();
            return await this._backend.listByPrefix(prefix);
        },

        async listKeys() {
            await this.ready();
            return await this._backend.listKeys();
        },

        async transaction(handler) {
            await this.ready();
            return await this._backend.transaction(handler);
        },

        async getSchemaVersion() {
            await this.ready();
            if (typeof this._backend.metadata !== 'function') return null;
            const meta = await this._backend.metadata();
            return meta?.schemaVersion || null;
        },

        isNative: _isNativePlatform,
        constants: {
            DB_NAME,
            DB_TABLE,
            SCHEMA_VERSION,
            SCHEMA_VERSION_KEY
        }
    };

    global.StorageAdapter = StorageAdapter;
})(window);
