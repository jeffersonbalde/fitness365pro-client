const CACHE_TTL_MS = 5 * 60 * 1000

let memory = {
  clientId: null,
  profilePictureUrl: '',
  fetchedAt: 0,
}

export const getCachedProfilePictureUrl = (clientId) => {
  if (!clientId || memory.clientId !== String(clientId)) return null
  if (Date.now() - memory.fetchedAt > CACHE_TTL_MS) return null
  return memory.profilePictureUrl || null
}

export const setCachedProfilePictureUrl = (clientId, profilePictureUrl) => {
  if (!clientId) return
  memory = {
    clientId: String(clientId),
    profilePictureUrl: profilePictureUrl || '',
    fetchedAt: Date.now(),
  }
}

export const clearProfileCache = () => {
  memory = { clientId: null, profilePictureUrl: '', fetchedAt: 0 }
}
