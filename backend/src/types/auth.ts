export interface RegisterInput {
  email: string;
  password: string;
  full_name: string;
  role?: string;
}

export interface CreateRoleInput {
  name: string;
  display_name: string;
  description?: string;
}
