import { registerEvent } from "../register-event";
import { communitiesSublevel } from "@main/level";
import { orderBy } from "lodash-es";
import type { Community } from "@types";
import { CommunityApi } from "@main/services";

const getCommunities = async (_event: Electron.IpcMainInvokeEvent) => {
  const remoteAll = await CommunityApi.get<Community[]>("/communities").catch(
    () => null
  );
  if (!remoteAll) throw new Error("api_unavailable");
  for (const c of remoteAll) {
    await communitiesSublevel.put(c.id, c);
  }
  return orderBy(remoteAll, "createdAt", "desc");
};

registerEvent("getCommunities", getCommunities);
