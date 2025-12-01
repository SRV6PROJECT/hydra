import axios, { AxiosInstance } from "axios";

export interface CommunityApiOptions {
  ifModifiedSince?: Date;
}

export class CommunityApi {
  private static instance: AxiosInstance;

  static async setupApi() {
    this.instance = axios.create({
      baseURL: import.meta.env.MAIN_VITE_COMMUNITY_API_URL,
    });
  }

  private static getHeaders(options?: CommunityApiOptions) {
    return {
      "Hydra-If-Modified-Since": options?.ifModifiedSince?.toUTCString(),
    };
  }

  static async get<T = unknown>(
    url: string,
    params?: unknown,
    options?: CommunityApiOptions
  ) {
    if (!this.instance) await this.setupApi();
    return this.instance
      .get<T>(url, { params, headers: this.getHeaders(options) })
      .then((r) => r.data);
  }

  static async post<T = unknown>(url: string, data?: unknown) {
    if (!this.instance) await this.setupApi();
    return this.instance.post<T>(url, data).then((r) => r.data);
  }

  static async put<T = unknown>(url: string, data?: unknown) {
    if (!this.instance) await this.setupApi();
    return this.instance.put<T>(url, data).then((r) => r.data);
  }

  static async patch<T = unknown>(url: string, data?: unknown) {
    if (!this.instance) await this.setupApi();
    return this.instance.patch<T>(url, data).then((r) => r.data);
  }

  static async delete<T = unknown>(url: string) {
    if (!this.instance) await this.setupApi();
    return this.instance.delete<T>(url).then((r) => r.data);
  }
}
