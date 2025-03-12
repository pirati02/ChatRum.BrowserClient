import { BaseError } from "./base-error";

export interface BaseResponse<T>{
    body: T,
    error: BaseError
}