import { registerEvent } from "../register-event";
import { communitiesSublevel } from "@main/level";
import { getUserData } from "@main/services/user/get-user-data";
import type { Community, CommunityPost } from "@types";
import { CommunityApi } from "@main/services";

const addCommunityPost = async (
  _event: Electron.IpcMainInvokeEvent,
  communityId: string,
  post: {
    authorId: string;
    authorDisplayName: string;
    authorProfileImageUrl?: string | null;
    content: string;
  }
) => {
  const community = await CommunityApi.get<Community>(
    `/communities/${communityId}`
  ).catch(() => null);
  if (!community) throw new Error("api_unavailable");
  const me = await getUserData();
  if (!me) throw new Error("user_not_logged_in");
  if (community.ownerId && community.ownerId !== me.id)
    throw new Error("not_owner");
  const newPost = await CommunityApi.post<CommunityPost>(
    `/communities/${communityId}/posts`,
    {
      content: post.content,
      authorId: me.id,
      authorDisplayName: me.displayName,
      authorProfileImageUrl: me.profileImageUrl ?? null,
    }
  ).catch(() => null);
  if (!newPost) throw new Error("api_unavailable");
  const posts: CommunityPost[] = [newPost, ...(community.posts ?? [])];
  const updated: Community = { ...community, posts };
  await communitiesSublevel.put(communityId, updated);
  return newPost;
};

const removeCommunityPost = async (
  _event: Electron.IpcMainInvokeEvent,
  communityId: string,
  postId: string
) => {
  const community = await CommunityApi.get<Community>(
    `/communities/${communityId}`
  ).catch(() => null);
  if (!community) throw new Error("api_unavailable");
  const ok = await CommunityApi.delete(
    `/communities/${communityId}/posts/${postId}`
  ).catch(() => null);
  if (!ok) throw new Error("api_unavailable");
  const posts: CommunityPost[] = (community.posts ?? []).filter(
    (p) => p.id !== postId
  );
  const updated: Community = { ...community, posts };
  await communitiesSublevel.put(communityId, updated);
  return true;
};

registerEvent("addCommunityPost", addCommunityPost);
registerEvent("removeCommunityPost", removeCommunityPost);
