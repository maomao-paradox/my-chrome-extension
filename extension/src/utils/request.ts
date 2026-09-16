import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  InternalAxiosRequestConfig,
} from "axios";
// import { toast } from "@/dom-api";

// 请求配置扩展
export interface RequestConfig extends AxiosRequestConfig {
  // 是否显示loading
  showLoading?: boolean;
  // 是否显示错误消息
  showError?: boolean;
  // 是否自动处理错误
  autoHandleError?: boolean;
  // 重试次数
  retryCount?: number;
  // 重试延迟(ms)
  retryDelay?: number;
  // 是否展示上传进度
  showUploadProgress?: boolean;
  // get请求是否使用缓存
  useCache?: boolean;
  // 上传进度回调
  onProgress?: (percent: number) => void;
}

// 内部请求配置，继承axios内部配置
interface InternalRequestConfig extends InternalAxiosRequestConfig {
  showLoading?: boolean;
  showError?: boolean;
  autoHandleError?: boolean;
  retryCount?: number;
  retryDelay?: number;
  _isRetryAfterRefresh?: boolean;
  showUploadProgress?: boolean;
  useCache?: boolean;
  onProgress?: (percent: number) => void;
}

// 请求状态码枚举
export enum HttpStatus {
  SUCCESS = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  INTERNAL_SERVER_ERROR = 500,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
  GATEWAY_TIMEOUT = 504,
}

// 业务状态码枚举
export enum BusinessCode {
  SUCCESS = 0,
  FAILED = -1,
  TOKEN_EXPIRED = 401,
  PERMISSION_DENIED = 403,
  NOT_FOUND = 404,
  SERVER_ERROR = 500,
}

// Loading 服务接口
export interface LoadingService {
  show(): any; // 返回 loading 实例
  hide(instance?: any): void; // 接受可选的实例参数
}

// 消息提示服务接口
export interface MessageService {
  error(message: string): void;
}

// Token刷新服务接口
export interface TokenRefreshService {
  refreshToken(): Promise<{ token_info: { access_token: string } }>;
}

// 请求服务配置
export interface RequestServiceConfig {
  // 基础URL配置
  apiBaseURL?: string;
  // 超时时间配置
  timeout?: number;
  // Loading服务实现
  loadingService?: LoadingService;
  // 消息提示服务实现
  messageService?: MessageService;
  // Token刷新服务实现
  tokenRefreshService?: TokenRefreshService;
  // Token过期处理回调
  onTokenExpired?: () => void;
  // 是否在开发环境从localStorage获取token
  devTokenKey?: string;
}

// 内部配置类型（部分字段必需，部分可选）
interface InternalRequestServiceConfig {
  apiBaseURL: string;
  timeout: number;
  loadingService?: LoadingService;
  messageService?: MessageService;
  tokenRefreshService?: TokenRefreshService;
  onTokenExpired: () => void;
  devTokenKey: string;
}

class RequestService {
  private instance: AxiosInstance;
  private loadingCount = 0;
  private loadingInstance: any;
  private config: InternalRequestServiceConfig;

  constructor(config: RequestServiceConfig = {}) {
    // 合并配置
    this.config = {
      apiBaseURL: config.apiBaseURL || "/api",
      timeout: config.timeout || 15000,
      loadingService: config.loadingService,
      messageService: config.messageService,
      tokenRefreshService: config.tokenRefreshService,
      onTokenExpired: config.onTokenExpired || (() => {}),
      devTokenKey: config.devTokenKey || "auth-token",
    };

    // 创建axios实例
    this.instance = axios.create({
      baseURL: this.config.apiBaseURL,
      timeout: this.config.timeout,
      headers: {
        "Content-Type": "application/json;charset=utf-8",
      },
      withCredentials: true,
    });

    this.setupInterceptors();
  }

  // 动态更新baseURL的方法
  public updateBaseURL(newBaseURL: string) {
    this.instance.defaults.baseURL = newBaseURL;
    console.log(`BaseURL updated to: ${newBaseURL}`);
  }

  // 新增：运行时注入
  public setMessageService(svc: MessageService) {
    this.config.messageService = svc;
    return this;
  }

  public setLoadingService(svc: LoadingService) {
    this.config.loadingService = svc;
    return this;
  }

  // 设置拦截器
  private setupInterceptors() {
    // 请求拦截器
    this.instance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const requestConfig = config as InternalRequestConfig;

        // 显示loading
        if (requestConfig.showLoading !== false) {
          this.showLoading();
        }

        // 如果是开发环境，从localstorage中获取token
        if (import.meta.env.DEV && this.config.devTokenKey) {
          const token = localStorage.getItem(this.config.devTokenKey);
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }

        // 添加请求时间戳，防止缓存
        if (config.method === "get") {
          config.params = {
            ...config.params,
          };
          if (requestConfig.useCache === false) {
            config.params._t = Date.now();
          }
        }

        // 上传进度处理
        if (requestConfig.showUploadProgress && requestConfig.onProgress) {
          requestConfig.onProgress(0);

          config.onUploadProgress = (progressEvent: any) => {
            const percent = Math.round(
              (progressEvent.loaded * 100) / (progressEvent.total || 1),
            );

            setTimeout(() => {
              requestConfig.onProgress?.(percent);
            });
          };
        }

        console.log(
          `[Request] ${config.method?.toUpperCase()} ${config.url}`,
          config,
        );
        return config;
      },
      (error: AxiosError) => {
        this.hideLoading();
        return Promise.reject(error);
      },
    );

    // 响应拦截器
    this.instance.interceptors.response.use(
      async (response: AxiosResponse<any>) => {
        this.hideLoading();

        const { data } = response;
        const config = response.config as InternalRequestConfig;

        console.log(
          `[Response] ${config.method?.toUpperCase()} ${config.url}`,
          data,
        );

        // 如果是 Blob 类型（文件下载），直接返回
        if (data instanceof Blob) {
          return response;
        }

        // 根据业务状态码处理
        if (data.code === 10000) {
          return response;
        } else {
          return await this.handleBusinessError(data, config);
        }
      },
      (error: AxiosError) => {
        this.hideLoading();
        return this.handleHttpError(error);
      },
    );
  }

  // 处理业务错误
  private async handleBusinessError(data: any, config: InternalRequestConfig) {
    const { base_resp } = data;

    switch (base_resp.code) {
      case BusinessCode.TOKEN_EXPIRED:
        // 对于业务层面的token过期，也尝试刷新token并重试
        if (!config._isRetryAfterRefresh) {
          try {
            return await this.handleUnauthorizedWithRefresh(config);
          } catch (refreshError) {
            // 刷新失败，按原逻辑处理
            this.handleTokenExpired();
            return Promise.reject(refreshError);
          }
        } else {
          this.handleTokenExpired();
        }
        break;
      case BusinessCode.PERMISSION_DENIED:
        if (this.config.messageService) {
          this.config.messageService.error("权限不足");
        }
        break;
      default:
        if (config.showError !== false && this.config.messageService) {
          this.config.messageService.error(base_resp.message || "请求失败");
        }
        break;
    }

    return Promise.reject(new Error(base_resp.message || "请求失败"));
  }

  // 处理HTTP错误
  private async handleHttpError(error: AxiosError) {
    console.log(error.response);
    const config = error.config as InternalRequestConfig;

    // 重试机制
    if (this.shouldRetry(error, config)) {
      return this.retryRequest(config);
    }

    let message = "请求失败";

    if (error.response) {
      const { status } = error.response;
      switch (status) {
        case HttpStatus.BAD_REQUEST:
          message = "请求参数错误";
          break;
        case HttpStatus.UNAUTHORIZED:
          const responseURL =
            config?.url || error.response.request?.responseURL || "";
          if (responseURL.includes("/login")) {
            message = "用户名或密码错误";
          } else if (responseURL.includes("/identity/auth/sso")) {
            // 门户 SSO 不依赖当前 Radius 登录态，401 时不能触发 refresh。
          } else if (responseURL.includes("/auth/refresh")) {
            // do nothing
          } else if (responseURL.includes("/auth/logout")) {
            this.handleTokenExpired();
          } else {
            // 对于非登录接口的401错误，尝试刷新token并重试
            if (!config?._isRetryAfterRefresh) {
              return this.handleUnauthorizedWithRefresh(config!);
            } else {
              message = "登录已过期，请重新登录";
              this.handleTokenExpired();
            }
          }
          break;
        case HttpStatus.FORBIDDEN:
          message = "权限不足";
          break;
        case HttpStatus.NOT_FOUND:
          message = "请求的资源不存在";
          break;
        case HttpStatus.INTERNAL_SERVER_ERROR:
          message = "服务器内部错误";
          break;
        case HttpStatus.BAD_GATEWAY:
          message = "网关错误";
          break;
        case HttpStatus.SERVICE_UNAVAILABLE:
          message = "服务暂不可用";
          break;
        case HttpStatus.GATEWAY_TIMEOUT:
          message = "网关超时";
          break;
        default:
          message = `请求失败 (${status})`;
      }
    } else if (error.request) {
      message = "网络错误，请检查网络连接";
    }

    message = (error.response?.data as any)?.base_resp?.message || message;

    if (config?.showError !== false && this.config.messageService) {
      this.config.messageService.error(message);
    }

    return Promise.reject(error);
  }

  // 判断是否需要重试
  private shouldRetry(
    error: AxiosError,
    config?: InternalRequestConfig,
  ): boolean {
    if (!config || config.retryCount === undefined || config.retryCount <= 0) {
      return false;
    }

    // 只对网络错误和5xx错误进行重试
    const shouldRetryStatus =
      !error.response ||
      (error.response.status >= 500 && error.response.status < 600);

    return shouldRetryStatus;
  }

  // 重试请求
  private async retryRequest(
    config: InternalRequestConfig,
  ): Promise<AxiosResponse> {
    const retryDelay = config.retryDelay || 1000;
    const retryCount = (config.retryCount || 0) - 1;

    await new Promise((resolve) => setTimeout(resolve, retryDelay));

    const newConfig = {
      ...config,
      retryCount,
    } as InternalRequestConfig;

    return this.instance.request(newConfig);
  }

  // 处理401错误：尝试刷新token并重试请求
  private async handleUnauthorizedWithRefresh(
    config: InternalRequestConfig,
  ): Promise<AxiosResponse> {
    if (!this.config.tokenRefreshService) {
      this.handleTokenExpired();
      return Promise.reject(new Error("Token refresh service not configured"));
    }

    try {
      // 刷新token
      const res = await this.config.tokenRefreshService.refreshToken();
      if (
        import.meta.env.DEV &&
        this.config.devTokenKey &&
        res?.token_info?.access_token
      ) {
        localStorage.setItem(
          this.config.devTokenKey,
          res.token_info.access_token,
        );
      }
      console.log("[Request] Token refreshed successfully", res);

      // 更新请求头中的token
      config.headers = config.headers || {};

      // 标记这是刷新token后的重试请求
      config._isRetryAfterRefresh = true;

      // 重新发起请求
      return this.instance.request(config);
    } catch (refreshError) {
      console.error("[Request] Token refresh failed:", refreshError);
      // 刷新失败，执行登出流程
      this.handleTokenExpired();
      return Promise.reject(refreshError);
    }
  }

  // 处理token过期
  private handleTokenExpired() {
    this.config.onTokenExpired();
  }

  // 显示loading
  private showLoading() {
    this.loadingCount++;
    if (this.loadingCount === 1) {
      if (this.config.loadingService) {
        this.loadingInstance = this.config.loadingService.show();
      } else {
        console.log("Show loading...");
      }
    }
  }

  // 隐藏loading
  private hideLoading() {
    this.loadingCount--;
    if (this.loadingCount <= 0) {
      this.loadingCount = 0;
      if (this.config.loadingService) {
        this.config.loadingService.hide(this.loadingInstance);
      } else {
        console.log("Hide loading...");
      }
      this.loadingInstance = null;
    }
  }

  // 通用请求方法
  public request<T = any>(config: RequestConfig): Promise<T> {
    return this.instance.request(config).then((res) => res.data);
  }

  // GET请求
  public get<T = any>(
    url: string,
    params?: any,
    config?: RequestConfig,
  ): Promise<T> {
    return this.request({
      method: "GET",
      url,
      params,
      ...config,
    });
  }

  // POST请求
  public post<T = any>(
    url: string,
    data?: any,
    config?: RequestConfig,
  ): Promise<T> {
    return this.request({
      method: "POST",
      url,
      data,
      ...config,
    });
  }

  // PUT请求
  public put<T = any>(
    url: string,
    data?: any,
    config?: RequestConfig,
  ): Promise<T> {
    return this.request({
      method: "PUT",
      url,
      data,
      ...config,
    });
  }

  // DELETE请求
  public delete<T = any>(
    url: string,
    params?: any,
    config?: RequestConfig,
    data?: any,
  ): Promise<T> {
    return this.request({
      method: "DELETE",
      url,
      params,
      data,
      ...config,
    });
  }

  // PATCH请求
  public patch<T = any>(
    url: string,
    data?: any,
    config?: RequestConfig,
  ): Promise<T> {
    return this.request({
      method: "PATCH",
      url,
      data,
      ...config,
    });
  }

  // 上传文件
  public upload<T = any>(
    url: string,
    file: File | FormData,
    config?: RequestConfig,
  ): Promise<T> {
    const formData = file instanceof FormData ? file : new FormData();
    if (file instanceof File) {
      formData.append("file", file);
    }

    return this.request({
      method: "POST",
      url,
      data: formData,
      headers: {
        "Content-Type": "multipart/form-data",
      },
      ...config,
    });
  }

  // 下载文件
  public async download(
    url: string,
    params?: any,
    filename?: string,
  ): Promise<void> {
    return this.instance
      .request({
        method: "GET",
        url,
        params,
        responseType: "blob",
      })
      .then((response) => {
        const blob = new Blob([response.data]);
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = filename || "download";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
      });
  }

  // 取消请求
  public cancelRequest(requestId: string) {
    // 实现请求取消逻辑
    console.log(`Cancel request: ${requestId}`);
  }

  // 获取axios实例
  public getInstance(): AxiosInstance {
    return this.instance;
  }
}

// 创建请求服务的工厂函数
export function createRequestService(
  config: RequestServiceConfig,
): RequestService {
  return new RequestService(config);
}

// 创建请求服务实例
export const request = createRequestService({
  apiBaseURL: "/api",
  timeout: 15000,
  //   loadingService: {
  //     show: () =>
  //       ElLoading.service({
  //         lock: true,
  //         text: "",
  //         background: "rgba(0, 0, 0, 0.7)",
  //       }),
  //     hide: (instance) => instance?.close(),
  //   },
  // messageService: {
  //   error: (msg) => toast.error(msg),
  // },
  devTokenKey: "auth-token",
});
