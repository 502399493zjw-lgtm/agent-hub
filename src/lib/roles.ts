/**
 * Role-based access control helpers.
 *
 * Role hierarchy: user < moderator < admin
 */

const ROLE_LEVELS: Record<string, number> = {
  user: 0,
  moderator: 1,
  admin: 2,
};

export type Role = 'user' | 'moderator' | 'admin';

export const VALID_ROLES: readonly string[] = ['user', 'moderator', 'admin'];

/**
 * Check if a user's role meets the minimum required role.
 * Returns true if userRole >= minRole in the hierarchy.
 */
export function hasRole(userRole: string, minRole: Role): boolean {
  const userLevel = ROLE_LEVELS[userRole] ?? 0;
  const minLevel = ROLE_LEVELS[minRole] ?? 0;
  return userLevel >= minLevel;
}

/**
 * Check if a role string is valid.
 */
export function isValidRole(role: string): role is Role {
  return VALID_ROLES.includes(role);
}
