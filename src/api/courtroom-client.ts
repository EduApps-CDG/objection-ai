import axios from 'axios';
import type { Configuration } from './api/configuration';
import CourtroomWebSocketClient from './courtroom-websocket-client';
import { AuthApi, RoomApi } from './courtroom/api';

const axiosInstance = axios.create({ withCredentials: true });

axiosInstance.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    Promise.reject(error);
  },
);

const configuration: Configuration = {
  basePath: "wss://objection.lol/courtroom-api",
  isJsonMime: (mime: string) => mime.includes('application/json'),
};

export const CourtroomClient = {
  auth: new AuthApi(configuration, '', axiosInstance),
  room: new RoomApi(configuration, '', axiosInstance),
  socket: new CourtroomWebSocketClient(),
};
