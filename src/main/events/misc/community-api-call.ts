import { registerEvent } from "../register-event";
import { CommunityApi } from "@main/services/community-api";

interface CommunityApiCallPayload {
  method: "get" | "post" | "put" | "patch" | "delete";
  url: string;
  data?: unknown;
  params?: unknown;
  options?: {
    ifModifiedSince?: Date;
  };
}

const communityApiCall = async (
  _event: Electron.IpcMainInvokeEvent,
  payload: CommunityApiCallPayload
) => {
  const { method, url, data, params, options } = payload;

  switch (method) {
    case "get":
      return CommunityApi.get(url, params, options);
    case "post":
      return CommunityApi.post(url, data);
    case "put":
      return CommunityApi.put(url, data);
    case "patch":
      return CommunityApi.patch(url, data);
    case "delete":
      return CommunityApi.delete(url);
    default:
      throw new Error(`Unsupported HTTP method: ${method}`);
  }
};

registerEvent("communityApiCall", communityApiCall);
