export const authHdr = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })
export const jsonHdr = () => ({ ...authHdr(), 'Content-Type': 'application/json' })

export function logout() {
  localStorage.clear()
  window.location.href = '/'
}

export async function apiFetch(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { ...authHdr(), ...opts.headers } })
  if (res.status === 401) { logout(); return null }
  return res
}

export async function apiGet(path) {
  const res = await apiFetch(path)
  if (!res) return null
  return res.json()
}

export async function apiPost(path, body) {
  const res = await apiFetch(path, { method: 'POST', headers: jsonHdr(), body: JSON.stringify(body) })
  if (!res) return null
  return { ok: res.ok, data: await res.json() }
}

export async function apiPatch(path, body) {
  const res = await apiFetch(path, { method: 'PATCH', headers: jsonHdr(), body: JSON.stringify(body) })
  if (!res) return null
  return { ok: res.ok, data: await res.json() }
}

export async function apiDelete(path) {
  const res = await apiFetch(path, { method: 'DELETE' })
  return res?.ok ?? false
}
