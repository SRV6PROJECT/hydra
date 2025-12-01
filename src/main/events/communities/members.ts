import { registerEvent } from "../register-event";
import { communitiesSublevel } from "@main/level";
import type { Community, CommunityMember, GameShop } from "@types";
import { CommunityApi } from "@main/services";

const addCommunityMember = async (
  _event: Electron.IpcMainInvokeEvent,
  communityId: string,
  member: {
    displayName: string;
    profileImageUrl?: string | null;
    isOnline?: boolean;
    currentGame?: { title: string; objectId: string; shop: GameShop } | null;
  }
) => {
  const community = await CommunityApi.get<Community>(
    `/communities/${communityId}`
  ).catch(() => null);
  if (!community) throw new Error("api_unavailable");
  const remoteUpdated = await CommunityApi.post<Community>(
    `/communities/${communityId}/members`,
    member
  ).catch(() => null);
  if (!remoteUpdated) throw new Error("api_unavailable");
  await communitiesSublevel.put(communityId, remoteUpdated);
  const created = (remoteUpdated.members ?? []).find(
    (m) => !(community.members ?? []).some((cm) => cm.id === m.id)
  );
  return created ?? null;
};

const removeCommunityMember = async (
  _event: Electron.IpcMainInvokeEvent,
  communityId: string,
  memberId: string
) => {
  const community = await CommunityApi.get<Community>(
    `/communities/${communityId}`
  ).catch(() => null);
  if (!community) throw new Error("api_unavailable");
  const ok = await CommunityApi.delete(
    `/communities/${communityId}/members/${memberId}`
  ).catch(() => null);
  if (!ok) throw new Error("api_unavailable");
  const members: CommunityMember[] = (community.members ?? []).filter(
    (m) => m.id !== memberId
  );
  const updated: Community = {
    ...community,
    members,
    membersCount: members.length,
  };
  await communitiesSublevel.put(communityId, updated);
  return true;
};

const updateCommunityMember = async (
  _event: Electron.IpcMainInvokeEvent,
  communityId: string,
  memberId: string,
  partial: Record<string, unknown>
) => {
  const community = await CommunityApi.get<Community>(
    `/communities/${communityId}`
  ).catch(() => null);
  if (!community) throw new Error("api_unavailable");
  const remoteUpdated = await CommunityApi.patch<Community>(
    `/communities/${communityId}/members/${memberId}`,
    partial
  ).catch(() => null);
  if (!remoteUpdated) throw new Error("api_unavailable");
  await communitiesSublevel.put(communityId, remoteUpdated);
  return (remoteUpdated.members ?? []).find((m) => m.id === memberId) ?? null;
};

registerEvent("addCommunityMember", addCommunityMember);
registerEvent("removeCommunityMember", removeCommunityMember);
registerEvent("updateCommunityMember", updateCommunityMember);
