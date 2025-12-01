import { registerEvent } from "../register-event";
import { communitiesSublevel } from "@main/level";
import { getUserData } from "@main/services/user/get-user-data";
import type { Community, CommunityMember } from "@types";
import { CommunityApi } from "@main/services";

const joinCommunity = async (
  _event: Electron.IpcMainInvokeEvent,
  communityId: string
) => {
  const community = await CommunityApi.get<Community>(
    `/communities/${communityId}`
  ).catch(() => null);
  if (!community) throw new Error("api_unavailable");
  const me = await getUserData();
  if (!me) throw new Error("user_not_logged_in");

  if (community.isClosed && community.ownerId !== me.id) {
    throw new Error("community_closed");
  }

  const exists = (community.members ?? []).some((m) => m.id === me.id);
  if (exists) return community;

  const remoteUpdated = await CommunityApi.post<Community>(
    `/communities/${communityId}/members`,
    {
      id: me.id,
      displayName: me.displayName,
      profileImageUrl: me.profileImageUrl,
    }
  ).catch(() => null);
  if (!remoteUpdated) throw new Error("api_unavailable");
  await communitiesSublevel.put(communityId, remoteUpdated);
  return remoteUpdated;
};

const leaveCommunity = async (
  _event: Electron.IpcMainInvokeEvent,
  communityId: string
) => {
  const community = await CommunityApi.get<Community>(
    `/communities/${communityId}`
  ).catch(() => null);
  if (!community) throw new Error("api_unavailable");
  const me = await getUserData();
  if (!me) throw new Error("user_not_logged_in");

  if (community.ownerId && community.ownerId === me.id) {
    throw new Error("owner_cannot_leave");
  }

  const members: CommunityMember[] = (community.members ?? []).filter(
    (m) => m.id !== me.id
  );
  if (members.length < 1) {
    throw new Error("cannot_leave_last_member");
  }
  const updated: Community = {
    ...community,
    members,
    membersCount: members.length,
  };
  const ok = await CommunityApi.delete(
    `/communities/${communityId}/members/${me.id}`
  ).catch(() => null);
  if (!ok) throw new Error("api_unavailable");
  await communitiesSublevel.put(communityId, updated);
  return updated;
};

registerEvent("joinCommunity", joinCommunity);
registerEvent("leaveCommunity", leaveCommunity);
