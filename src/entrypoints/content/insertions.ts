import type { Insertion } from "./insertion-basics";
import desktopAuthorCommunity from "./insertions/desktop-author-community";
import desktopChart from "./insertions/desktop-chart";
import desktopCommentGroup from "./insertions/desktop-comment-group";
import desktopFeedComment from "./insertions/desktop-feed-comment";
import desktopFeedPagePost from "./insertions/desktop-feed-page-post";
import desktopFeedThread from "./insertions/desktop-feed-thread";
import desktopFollowersHighlight from "./insertions/desktop-followers-highlight";
import desktopMentionProfileHeader from "./insertions/desktop-mention-profile-header";
import desktopPagePost from "./insertions/desktop-page-post";
import desktopPopupPost from "./insertions/desktop-popup-post";
import desktopPostComment from "./insertions/desktop-post-comment";
import desktopProfileHeader from "./insertions/desktop-profile-header";
import desktopReplyInputComment from "./insertions/desktop-reply-input-comment";
import desktopReplyTo from "./insertions/desktop-reply-to";
import desktopRepostHeader from "./insertions/desktop-repost-header";
import desktopReview from "./insertions/desktop-review";
import desktopSearchPeopleCommunity from "./insertions/desktop-search-people-community";
import desktopVideoComment from "./insertions/desktop-video-comment";
import mobilePagePost from "./insertions/mobile-page-post";
import mobileProfileHeader from "./insertions/mobile-profile-header";

export const insertionLookup: Record<string, Insertion> = {
  desktopAuthorCommunity,
  desktopChart,
  desktopCommentGroup,
  desktopFollowersHighlight,
  desktopMentionProfileHeader,
  desktopPagePost,
  desktopPopupPost,
  desktopPostComment,
  desktopProfileHeader,
  desktopReplyInputComment,
  desktopReplyTo,
  desktopRepostHeader,
  desktopReview,
  desktopSearchPeopleCommunity,
  desktopVideoComment,
  desktopFeedComment,
  desktopFeedPagePost,
  desktopFeedThread,

  mobilePagePost,
  mobileProfileHeader,
};
