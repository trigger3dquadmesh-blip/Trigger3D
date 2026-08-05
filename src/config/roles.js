export const ROLES = Object.freeze({
  ADMIN: 'admin',
  FACULTY: 'faculty',
  STUDENT: 'student',
})

export const ROLE_HOME_PATHS = Object.freeze({
  [ROLES.ADMIN]: '/admin',
  [ROLES.FACULTY]: '/faculty',
  [ROLES.STUDENT]: '/student',
})

export function getRoleHomePath(role) {
  return ROLE_HOME_PATHS[role] ?? '/account'
}
