import {Injectable} from "@angular/core";

@Injectable({
  providedIn: 'root',
})
export class HelperService {
  isLink(text: string): boolean {
    const urlPattern = /^(https?:\/\/)?([\w.-]+)\.([a-z\.]{2,6})([\/\w\.-]*)*\/?$/i;
    return urlPattern.test(text.trim());
  }
}
