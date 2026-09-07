import { supabase } from '../lib/supabase.js'

const bucketName = 'profile-photos'
const storageMarkers = [
  '/storage/v1/object/public/profile-photos/',
  '/storage/v1/object/sign/profile-photos/',
]

export function getAvatarStoragePath(value) {
  if (!value) return ''
  if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, '')
  const marker = storageMarkers.find((candidate) => value.includes(candidate))
  if (!marker) return ''
  return decodeURIComponent(value.split(marker)[1].split('?')[0])
}

export async function resolveProfileAvatar(profile) {
  if (!profile?.avatar_url) return profile ? { ...profile, avatar_storage_path: '' } : profile

  const storagePath = getAvatarStoragePath(profile.avatar_url)
  if (!storagePath) return { ...profile, avatar_storage_path: '', avatar_url: profile.avatar_url }

  const { data, error } = await supabase.storage.from(bucketName).createSignedUrl(storagePath, 3600)
  return {
    ...profile,
    avatar_storage_path: storagePath,
    avatar_url: error ? '' : data.signedUrl,
  }
}
