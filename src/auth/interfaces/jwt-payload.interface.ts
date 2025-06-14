export interface JwtPayload {
  /** User ID */
  sub: string;

  /** Username */
  username: string;

  /** User email */
  email?: string;

  /** User roles */
  roles: string[];

  /** Token issued at timestamp */
  iat?: number;

  /** Token expiration timestamp */
  exp?: number;
}
