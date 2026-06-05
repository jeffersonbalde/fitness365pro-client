const snapshots = new Map()

export const getPageSnapshot = (key) => snapshots.get(key) ?? null

export const setPageSnapshot = (key, value) => {
  snapshots.set(key, value)
}

export const clearPageSnapshot = (key) => {
  snapshots.delete(key)
}
