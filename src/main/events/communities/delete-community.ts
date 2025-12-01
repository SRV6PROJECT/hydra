import { registerEvent } from "../register-event";
import { communitiesSublevel } from "@main/level";
import { CommunityApi } from "@main/services";

const deleteCommunity = async (
  _event: Electron.IpcMainInvokeEvent,
  id: string
) => {
  const existing = await communitiesSublevel.get(id);
  if (!existing) throw new Error("community_not_found");
  const ok = await CommunityApi.delete(`/communities/${id}`).catch(() => null);
  if (!ok) throw new Error("api_unavailable");
  await communitiesSublevel.del(id);
  return true;
};

registerEvent("deleteCommunity", deleteCommunity);
