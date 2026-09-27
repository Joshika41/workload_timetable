export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  role: string;
  department_id?: number;
  name?: string;
}

export interface UserMeResponse {
  id: number;
  email: string;
  role: string;
  department_id?: number;
  name?: string;
  erp_id?: string;
}
