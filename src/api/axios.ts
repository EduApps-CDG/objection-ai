import axios, { AxiosError } from 'axios';

const axiosInstance = axios.create({
    withCredentials: true,
    
});

const ValidationError = class extends Error {
  public validationErrors: Record<string, string[]>;

  constructor(error: AxiosError) {
    super('Validation error');
    this.name = 'ValidationError';
    this.validationErrors = ///@ts-ignore
      error.response?.data?.message || ({} as Record<string, string[]>);
  }
};

axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    console.log('[axios] Request:', {
      method: config.method?.toUpperCase(),
      url: config.url,
      headers: config.headers,
      data: config.data,
    });

    return config;
  },
  (error) => {
    Promise.reject(error);
  },
);

let isRefreshing = false;
let refreshSubscribers: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const { config, response } = error;
    const originalRequest = config;
    const status = response?.status;

    if (
      status === 401 &&
      !originalRequest._retry &&
      localStorage.getItem('token') &&
      !originalRequest.url.endsWith('/refresh')
    ) {
      if (!isRefreshing) {
        isRefreshing = true;

        fetch(`https://objection.lol/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: localStorage.getItem('token') }),
        })
          .then((res) => {
            if (!res.ok) {
              if (res.status === 401 || res.status === 403) {
                throwAxiosError(
                  401,
                  'You are not authorized to perform this action.'
                );
              }

              throwAxiosError(
                res.status,
                'Failed to refresh token',
              );
            }

            return res.json();
          })
          .then((res) => {
            //@ts-ignore
            localStorage.setItem('token', res.token);
            //@ts-ignore
            onRefreshed(res.token);
          })
          .catch((err) => {
            onRefreshFailed(err);

            if (err instanceof AxiosError && err.response?.status === 401) {
              // If the error is a 401, it means the refresh token is invalid
              // and the user needs to log in again.
              console.error('Refresh token is invalid, logging out user.');
                localStorage.removeItem('token');
            }
          })
          .finally(() => {
            isRefreshing = false;
            refreshSubscribers = [];
          });
      }

      const retryOrigReq = new Promise((resolve, reject) => {
        subscribeTokenRefresh({
          resolve: (token: string) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            originalRequest._retry = true;

            resolve(axiosInstance(originalRequest));
          },
          reject: (err: unknown) => {
            reject(err);
          },
        });
      });

      return retryOrigReq;
    } else if (
      status === 503 &&
      !originalRequest.url.endsWith('auth/me') &&
      !originalRequest.url.endsWith('/export')
    ) {
      return Promise.reject(error);
    } else if (
      status === 400 &&
      response.data &&
      typeof response.data === 'object' &&
      // workaround for server throws new BadRequestException('Invalid email or password.') and the like
      'statusCode' in response.data === false
    ) {
      return Promise.reject(new ValidationError(error));
    } else {
      return Promise.reject(error);
    }
  },
);

const subscribeTokenRefresh = (callbacks: {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}) => {
  refreshSubscribers.push(callbacks);
};

const onRefreshed = (token: string) => {
  refreshSubscribers.forEach(({ resolve }) => resolve(token));
};

const onRefreshFailed = (error: unknown) => {
  refreshSubscribers.forEach(({ reject }) => reject(error));
};

const throwAxiosError = (errorCode: number, message: string) => {
  throw new AxiosError(message, String(errorCode), undefined, undefined, {
    status: errorCode,
    data: null,
    headers: {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: {} as any,
    statusText: '',
  });
};

export default axiosInstance;
