import { ErrorType } from './error.types';

export interface ApiError {
  code: string;
  description: string;
  type: ErrorType;
  numericType: number;
  metadata: any | null;
}
