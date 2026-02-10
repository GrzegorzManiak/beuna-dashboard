type CacheEntry<T> = {
    value: T;
    expiresAt: number;
};

function createExpiringCache<T>(ttlMs: number) {
    const store = new Map<string, CacheEntry<T>>();

    function get(key: string): T | null {
        const entry = store.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            store.delete(key);
            return null;
        }
        return entry.value;
    }

    function set(key: string, value: T): void {
        store.set(key, { value, expiresAt: Date.now() + ttlMs });
    }

    return { get, set };
}

export {
    createExpiringCache,
};
