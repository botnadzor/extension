import type { PositiveVkId, VkId } from "@/shared/@model/primitives";

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
