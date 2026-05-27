import React, { useEffect, useState } from 'react'
import { adminApiRequest } from '../../utils/adminApi'
import { notifyError, notifySuccess } from '../../utils/notifications'
import AdminModuleLayout from './AdminModuleLayout'
import AdminCmsTabs from './AdminCmsTabs'

const defaultForm = {
  title: '',
  body: '',
  image_url: '',
  status: 'draft',
}

const AdminCmsPosts = () => {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState(defaultForm)

  const load = async () => {
    setLoading(true)
    try {
      const res = await adminApiRequest('/v1/admin/posts', { method: 'GET' })
      setItems(res.data?.data?.data || [])
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Failed to load admin posts.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      const endpoint = editingId ? `/v1/admin/posts/${editingId}` : '/v1/admin/posts'
      const method = editingId ? 'PUT' : 'POST'
      await adminApiRequest(endpoint, { method, body: form })
      notifySuccess(editingId ? 'Post updated.' : 'Post created.')
      setEditingId('')
      setForm(defaultForm)
      await load()
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Failed to save post.')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (item) => {
    setEditingId(item.id)
    setForm({
      title: item.title || '',
      body: item.body || '',
      image_url: item.image_url || '',
      status: item.status || 'draft',
    })
  }

  const remove = async (id) => {
    if (!window.confirm('Delete this post?')) return
    try {
      await adminApiRequest(`/v1/admin/posts/${id}`, { method: 'DELETE' })
      notifySuccess('Post deleted.')
      await load()
    } catch (error) {
      notifyError(error?.response?.data?.message || 'Failed to delete post.')
    }
  }

  return (
    <AdminModuleLayout
      title="Content Posts CMS"
      subtitle="Create and publish admin content that appears in client Home Feed."
    >
      <AdminCmsTabs />
      <div className="card border mb-3">
        <div className="card-body">
          <form className="row g-2" onSubmit={submit}>
            <div className="col-12 col-lg-4">
              <input
                className="form-control"
                placeholder="Post title"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                required
              />
            </div>
            <div className="col-12 col-lg-5">
              <input
                className="form-control"
                placeholder="Body text"
                value={form.body}
                onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))}
                required
              />
            </div>
            <div className="col-12 col-lg-3">
              <select
                className="form-select"
                value={form.status}
                onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
              >
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="col-12 col-lg-9">
              <input
                className="form-control"
                placeholder="Image URL (optional)"
                value={form.image_url}
                onChange={(event) => setForm((prev) => ({ ...prev, image_url: event.target.value }))}
              />
            </div>
            <div className="col-12 col-lg-3 d-flex gap-2">
              <button className="btn btn-primary w-100" type="submit" disabled={saving}>
                {editingId ? 'Update Post' : 'Create Post'}
              </button>
              {editingId && (
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => {
                    setEditingId('')
                    setForm(defaultForm)
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      <div className="card border">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-sm mb-0">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Published</th>
                  <th style={{ width: 180 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="text-center py-3">Loading...</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-3 text-muted">No posts yet.</td></tr>
                ) : items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.title}</td>
                    <td><span className="badge text-bg-light border">{item.status}</span></td>
                    <td>{item.publish_at ? new Date(item.publish_at).toLocaleString() : '-'}</td>
                    <td className="d-flex gap-2">
                      <button className="btn btn-sm btn-outline-primary" onClick={() => startEdit(item)}>Edit</button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => remove(item.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminModuleLayout>
  )
}

export default AdminCmsPosts

