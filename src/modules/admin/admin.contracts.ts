export interface AdminPageInput {
  page: number;
  limit: number;
  q?: string;
}
export interface AdminPriorityInput {
  type: string;
  priority: number;
}
