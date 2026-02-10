import type { PositiveVkId, VkId } from "@/shared/@primitives/vk";

export type CommentLocation = {
  postType: "photo" | "video" | "wall";
  wallVkId: VkId;
  postVkId: PositiveVkId;
  commentVkId: PositiveVkId;
};

export type ReviewLocation = {
  wallVkId: VkId;
  reviewVkId: PositiveVkId;
};
