// cspell:ignoreRegExp /selector:.*/
// cspell:ignoreRegExp /valuePattern:.*/

import type { z } from "zod/mini";

import type { insertionConfigSchema } from "@/shared/@model/insertion-configs";

export default [
  // ---------------------------------------------------------------------------
  // Variant: account
  // ---------------------------------------------------------------------------

  /**
   * Follower (in a list of user cards) on desktop (React-based UI: tabs have outlines and shadows)
   * Examples:
   * - https://vk.com/ria → followers
   */
  {
    id: "desktopDialogFollower",
    variant: "account",
    appliesTo: "desktopVkWebsite",
    selector:
      "[class*=MembersListModal__modalContainer] [data-testid=grid-item]",
    markup: {
      data: {
        accountAvatar: {
          selector: ".vkuiAvatar__host>img",
        },
        accountIdentifier: [
          {
            selector: "",
            reactProp: "GridItem:key",
          },
          {
            selector: ".vkuiHorizontalCell__content a",
            attribute: "href",
          },
        ],
        accountName: ".vkuiHorizontalCell__content a",
      },
      edits: [
        {
          selector: "",
          style: {
            position: "relative",
          },
        },
      ],
      ui: {
        actionBar: {
          selector: ".vkuiHorizontalCell__host",
          position: "append",
          style: {
            display: "flex",
            height: "20px",
            justifyContent: "center",
            left: "0",
            position: "absolute",
            right: "0",
            top: "84px", // bottom of avatar
            "--bn-inline-action-background-color": "var(--bn-color-background)",
          },
        },
        affiliationBadge: {
          selector: "",
          position: "append",
          style: {
            background:
              "color-mix(in srgb, var(--bn-inline-affiliation-color) 70%, transparent)",
            color: "var(--bn-color-foreground)",
            padding: "2px",
            position: "absolute",
            textAlign: "center",
            top: "60px", // 1/2 of avatar height
            transform: "translateY(-50%)",
          },
        },
        affiliationHighlight: {
          selector: "",
          position: "prepend",
          style: { borderLeft: "none", opacity: "50%" },
        },
        regDate: {
          selector: ".vkuiHorizontalCell__host",
          position: "append",
          style: {
            background:
              "color-mix(in srgb, var(--bn-color-background) 70%, transparent)",
            color: "var(--bn-color-foreground)",
            display: "block",
            textAlign: "center",
            fontSize: "11px",
            lineHeight: "1.2",
            padding: "2px",
            position: "absolute",
            top: "0px",
            left: "0px",
            right: "0px",
          },
        },
      },
    },
  },

  /**
   * Desktop reactions / likes list avatar tiles
   * Followers (lists of user cards) on desktop (pre-React UI: tabs have border-bottom)
   *
   * Examples:
   * - https://vk.com/durov → click "followers"
   */
  {
    id: "desktopPreReactDialogFollowers",
    variant: "account",
    appliesTo: "desktopVkWebsite",
    selector: "[id^='tb_'] .fans_fan_row",
    markup: {
      data: {
        accountAvatar: {
          selector: "a.fans_fan_ph img",
        },
        accountIdentifier: {
          selector: "",
          attribute: "data-id",
        },
        accountName: ".fans_fan_lnk",
      },
      edits: [
        {
          selector: "",
          style: {
            position: "relative",
            overflow: "visible", // ensure action bar tooltips are visible
          },
        },
        {
          // Prevent account name from going under highlight
          selector: ".fans_fan_name",
          style: {
            position: "relative",
          },
        },
        {
          // Disable zoom avatar on hover (clashes with action bar)
          selector: ".fans_fanph_wrap",
          style: { pointerEvents: "none" },
        },
      ],
      ui: {
        actionBar: {
          selector: "",
          position: "append",
          style: {
            display: "flex",
            height: "20px",
            justifyContent: "center",
            left: "0",
            position: "absolute",
            right: "0",
            top: "82px", // bottom of avatar
            "--bn-inline-action-background-color": "var(--bn-color-background)",
          },
        },
        affiliationBadge: {
          selector: "",
          position: "append",
          style: {
            background:
              "color-mix(in srgb, var(--bn-inline-affiliation-color) 70%, transparent)",
            color: "var(--bn-color-foreground)",
            left: "0px",
            padding: "2px",
            position: "absolute",
            right: "0px",
            textAlign: "center",
            top: "54px", // 1/2 of avatar height + padding
            transform: "translateY(-50%)",
          },
        },
        affiliationHighlight: {
          selector: "",
          position: "prepend",
          style: { borderLeft: "none", opacity: "50%" },
        },
        regDate: {
          selector: "",
          position: "append",
          style: {
            background:
              "color-mix(in srgb, var(--bn-color-background) 70%, transparent)",
            color: "var(--bn-color-foreground)",
            display: "block",
            fontSize: "12.5px", // matching name font size
            left: "0px",
            lineHeight: "1.2",
            padding: "2px",
            position: "absolute",
            right: "0px",
            textAlign: "center",
            top: "0px",
          },
        },
      },
    },
  },

  {
    id: "desktopDialogFollowers",
    variant: "accountList",
    appliesTo: "desktopVkWebsite",
    selector: "[class*=MembersListModal__modalContainer]",
    markup: {
      data: {
        accountList:
          "[class*=MembersListModal__modalContainer] .vkuiCustomScrollView__host",
        activeTab: "[role=tab][aria-selected=true]",
        loadMoreButton: false,
      },
      edits: [
        {
          selector: "",
          style: { "--bn-insertion-summary-height": "300px" },
        },
        {
          selector: "[data-testid=modalbox] > div:last-child",
          style: {
            "--max-height-scroll":
              "calc(100vh - var(--bn-insertion-summary-height) - var(--empty-space))",
            position: "relative",
          },
        },
      ],
      ui: {
        summary: {
          selector: "[data-testid=modalheader]",
          position: "after",
          style: {
            height: "var(--bn-insertion-summary-height)",
            flexShrink: "0",
            padding: "4px",
            paddingLeft: "10px",
            paddingRight: "10px",
          },
        },
        tableMeasurer: {
          selector: "[data-testid=modalbox] > div:last-child",
          position: "append",
          style: {
            backgroundColor: "var(--bn-color-background)",
            borderBottomLeftRadius: "12px",
            borderBottomRightRadius: "12px",
            position: "absolute",
            inset: "0",
            padding: "4px",
            paddingTop: "10px",
          },
        },
      },
    },
  },

  /*
   * Desktop reactions dialog
   * Examples:
   * - post: https://vk.com/wall-173277106_4892265?reply=4892462&w=reactions-173277106_4892265%3Ftype%3Dpost
   * - comment: https://vk.com/wall-173277106_4892265?reply=4892462&w=reactions-173277106_4892462%3Ftype%3Dcomment
   */
  {
    id: "desktopDialogReactions",
    variant: "accountList",
    appliesTo: "desktopVkWebsite",
    selector: "[data-testid=feed-reactions-modal]",
    markup: {
      data: {
        accountList: "[class*=ReactionsViewer__modalBody]",
        activeTab: "[role=tab][aria-selected=true]",
        loadMoreButton: false,
      },
      edits: [
        {
          selector: "",
          style: { "--bn-insertion-summary-height": "300px" },
        },
        {
          selector: "[class*=ReactionsViewer__modalBody]",
          style: {
            position: "relative", // Ensure table measurer is positioned correctly
          },
        },
      ],
      ui: {
        summary: {
          selector: "[data-testid=modalheader]",
          position: "after",
          style: {
            height: "var(--bn-insertion-summary-height)",
            flexShrink: "0",
            padding: "4px",
            paddingLeft: "10px",
            paddingRight: "10px",
          },
        },
        tableMeasurer: {
          selector: "[class*=ReactionsViewer__modalBody]",
          position: "append",
          style: {
            backgroundColor: "var(--bn-color-background)",
            borderBottomLeftRadius: "8px",
            borderBottomRightRadius: "8px",
            inset: "0",
            padding: "4px",
            paddingTop: "10px",
            position: "absolute",
          },
        },
      },
    },
  },

  /**
   * Desktop reactions / likes list avatar tiles
   * Examples:
   * - https://vk.com/ria?w=likes%2Fwall-15755094_48295538
   * - https://vk.com/ria?w=likes%2Fwall_reply-15755094_49579807
   */
  {
    id: "desktopPreReactDialogReactions",
    variant: "account",
    appliesTo: "desktopVkWebsite",
    selector: "#wk_likes_content .fans_fan_row",
    markup: {
      data: {
        accountAvatar: {
          selector: "a.fans_fan_ph img",
        },
        accountIdentifier: {
          selector: "a.fans_fan_ph",
          attribute: "href",
        },
        accountName: ".fans_fan_lnk",
      },
      edits: [
        {
          selector: "",
          style: {
            position: "relative",
            overflow: "visible", // ensure action bar tooltips are visible
          },
        },
        {
          // Prevent account name from going under highlight
          selector: ".fans_fan_name",
          style: {
            position: "relative",
          },
        },
      ],
      ui: {
        actionBar: {
          selector: "",
          position: "append",
          style: {
            display: "flex",
            justifyContent: "center",
            marginLeft: "-4px",
            marginRight: "-4px",
            top: "4px",
          },
        },
        affiliationBadge: {
          selector: "",
          position: "append",
          style: {
            background:
              "color-mix(in srgb, var(--bn-inline-affiliation-color) 70%, transparent)",
            color: "var(--bn-color-foreground)",
            left: "0px",
            padding: "2px",
            position: "absolute",
            right: "0px",
            textAlign: "center",
            top: "54px", // 1/2 of avatar height + padding
            transform: "translateY(-50%)",
          },
        },
        affiliationHighlight: {
          selector: "",
          position: "prepend",
          style: { borderLeft: "none", opacity: "50%" },
        },
        regDate: {
          selector: "",
          position: "append",
          style: {
            background:
              "color-mix(in srgb, var(--bn-color-background) 70%, transparent)",
            color: "var(--bn-color-foreground)",
            display: "block",
            fontSize: "12.5px", // matching name font size
            left: "0px",
            lineHeight: "1.2",
            padding: "2px",
            position: "absolute",
            right: "0px",
            textAlign: "center",
            top: "0px",
          },
        },
      },
    },
  },

  /**
   * Desktop profile page header
   * Examples:
   * - https://vk.com/id1
   * - https://vk.com/durov
   * - https://m.vk.com/id1034309676
   */
  {
    id: "desktopProfileHeader",
    variant: "account",
    appliesTo: "desktopVkWebsite",
    selector: ".ProfileHeader__in",
    markup: {
      data: {
        accountAvatar: ".page_avatar_img img",
        accountIdentifier: [
          {
            selector: ".ProfileHeader__ava > div > div",
            attribute: "id",
            valuePattern: "[_](\\d+)",
          },
          {
            ancestorSelector: "html",
            selector: "link[rel='alternate'][href*='android']",
            attribute: "href",
          },
        ],
        accountName: "#owner_page_name",
      },
      edits: [
        {
          selector: ".ProfileHeader__info > div",
          style: { position: "relative" },
        },
        {
          selector: ".ProfileHeader__info > div > *",
          style: { position: "relative" },
        },
      ],
      ui: {
        actionBar: {
          selector: ".OwnerPageName",
          position: "append",
          style: { top: "1px" },
        },
        affiliationBadge: {
          selector: "[data-bn-insertion-ui-element='actionBar']",
          position: "before",
          style: {
            display: "inline-block",
            top: "-2px",
            marginBottom: "-4px",
            align: "middle",
            paddingLeft: "4px",
            paddingRight: "4px",
            fontWeight: "400",
          },
        },
        affiliationHighlight: {
          selector: ".ProfileHeader__info > div",
          position: "prepend",
          style: { inset: "0", marginLeft: "-4px" },
        },
        regDate: {
          selector: ".OwnerPageName",
          position: "append",
          style: { top: "1px", fontSize: "13px" },
        },
      },
    },
  },

  /**
   * Mobile profile page header
   * Examples:
   * - https://m.vk.com/id1
   * - https://m.vk.com/durov
   * - https://m.vk.com/id1034309676
   */
  {
    id: "mobileProfileHeader",
    variant: "account",
    appliesTo: "mobileVkWebsite",
    selector: ".ProfileInfo__main",
    markup: {
      data: {
        accountAvatar: "[data-testid='profile-avatar'] > img",
        accountIdentifier: {
          ancestorSelector: "html",
          selector: ".vkuiPanelHeader__contentIn > span",
        },
        accountName: ".ProfileInfoName",
      },
      edits: [
        {
          selector: ".ProfileInfoName",
          style: { zIndex: "0", position: "relative" },
        },
        {
          // Clamp state layer - profile header not clickable otherwise
          selector:
            "[class*='vkitOverlay__root']:has(.vkuiTappable__stateLayer)",
          style: { top: "auto", height: "34px" },
        },
      ],
      ui: {
        actionBar: {
          selector: ".ProfileInfoName",
          position: "append",
          style: { top: "2px", paddingLeft: "6px", position: "relative" },
        },
        affiliationBadge: {
          selector: "[data-bn-insertion-ui-element='actionBar']",
          position: "before",
          style: {
            display: "inline-block",
            fontWeight: "400",
            marginBottom: "-4px",
            paddingLeft: "6px",
            top: "-2px",
          },
        },
        affiliationHighlight: {
          selector: ".ProfileInfoName",
          position: "prepend",
          style: { inset: "0", zIndex: "-1" },
        },
        regDate: {
          selector: ".ProfileInfoName",
          position: "after",
          style: {
            marginTop: "4px",
            position: "relative",
            textAlign: "center",
          },
        },
      },
    },
  },

  /**
   * Legacy desktop post header (wall page posts)
   * Examples:
   * - Posts on user/community walls (vk.com/wall-*)
   * - https://vk.com/wall1034309676_77
   */

  // or without login regular post
  {
    id: "desktopPreReactPost",
    variant: "account",
    appliesTo: "desktopVkWebsite",
    selector: ".PostHeader",
    markup: {
      data: {
        accountAvatar: ".PostHeaderTitle__authorLink img",
        accountIdentifier: {
          selector: ".PostHeaderTitle__authorLink",
          attribute: "href",
        },
        accountName: ".PostHeaderTitle__authorBlock",
      },
      edits: [
        {
          selector: ".PostHeader",
          style: { overflow: "visible", position: "relative" },
        },
        {
          selector: ".PostHeader > *",
          style: { overflow: "visible", position: "relative" },
        },
      ],
      ui: {
        actionBar: {
          selector: ".PostHeaderTitle__authorBlock",
          position: "after",
          style: { marginLeft: "4px" },
        },
        affiliationBadge: {
          selector: ".PostHeaderTitle__authorBlock",
          position: "after",
          style: { paddingLeft: "2px" },
        },
        affiliationHighlight: {
          selector: "",
          position: "prepend",
          style: { inset: "0", top: "-4px", bottom: "-4px" },
        },
        regDate: [
          {
            selector: "[data-testid='post-header-title']",
            position: "after",
            style: { marginTop: "2px" },
          },
          {
            selector: ".PostHeaderTitle",
            position: "after",
            style: { marginTop: "2px" },
          },
        ],
      },
    },
  },

  /**
   * Modern desktop feed posts ([data-testid="post"])
   * Examples:
   * - Posts in VK feed (vk.com/feed)
   * - Posts on user/community walls with modern layout
   * - https://vk.com/wall1034309676_77
   * - https://m.vk.com/wall1034309676_77
   */
  {
    id: "desktopAndMobilePost",
    variant: "account",
    appliesTo: "desktopAndMobileVkWebsite",
    selector:
      '[data-testid="post"] > .vkuiDiv__host > [class*="vkitPostHeader__container"]',
    markup: {
      data: {
        accountAvatar: "[data-testid='post-header-avatar'] img",
        accountIdentifier: [
          {
            selector: "",
            reactProp: "MeProvider:feedItem/id",
          },
          {
            selector: "[data-testid='post-header-title'][href^='/']",
            attribute: "href",
          },
        ],
        accountName: "[data-testid='post-header-title']",
      },
      edits: [
        {
          selector: "",
          style: { position: "relative" },
        },
        {
          selector: ":scope > *",
          style: { position: "relative" },
        },
        {
          // Ensure tooltips are visible
          selector: "[class*='vkitPostHeader__mainInfo']",
          style: { overflow: "visible" },
        },
        {
          // Ensure reg date overflows correctly to line 2
          selector: "h3",
          style: { overflow: "visible", flexWrap: "wrap" },
        },
      ],
      ui: {
        actionBar: {
          selector: "[data-testid='post-header-title']",
          position: "after",
          style: {
            marginLeft: "4px",
          },
        },
        affiliationBadge: {
          selector: "[data-testid='post-header-title']",
          position: "append",
          style: { paddingLeft: "4px" },
        },
        affiliationHighlight: {
          selector: "",
          position: "prepend",
          style: { top: "-4px", bottom: "-4px" },
        },
        regDate: [
          {
            selector: "[class*='vkitPostHeaderActions']",
            position: "before",
            style: { marginLeft: "-8px" },
          },
        ],
      },
    },
  },

  /**
   * Mobile page posts ([data-testid="post"])
   * Examples:
   * - Posts on m.vk.com user/community walls
   * - https://m.vk.com/wall1034309676_77 (without login)
   */
  {
    id: "mobilePreReactPost",
    variant: "account",
    appliesTo: "mobileVkWebsite",
    selector: ".wi_head, .pic_header",
    markup: {
      data: {
        accountAvatar: ".Avatar__image",
        accountIdentifier: {
          selector: ".pi_author",
          attribute: "data-item-owner-id",
        },
        accountName: ".pi_author",
      },
      edits: [
        {
          selector: ".wi_head > *",
          style: { position: "relative" },
        },
        {
          selector: ".pic_header > *",
          style: { position: "relative" },
        },
      ],
      ui: {
        actionBar: [
          {
            // post
            selector: "[data-testid='mobile-wall-post-author']",
            position: "after",
            style: { marginLeft: "4px" },
          },
          {
            // re post
            selector: ".pi_author",
            position: "after",
            style: { marginLeft: "4px", top: "3px" },
          },
        ],
        affiliationBadge: [
          {
            // post
            selector: "[data-testid='mobile-wall-post-author']",
            position: "after",
            style: { paddingLeft: "4px", top: "1px" },
          },
          {
            // re post
            selector: ".pi_author",
            position: "after",
            style: { paddingLeft: "4px" },
          },
        ],
        affiliationHighlight: {
          selector: "",
          position: "prepend",
          style: { top: "-4px", bottom: "-4px" },
        },
        regDate: {
          selector: "[data-testid='mobile-wall-post-author']",
          position: "after",
          style: { marginTop: "2px" },
        },
      },
    },
  },

  /**
   * Desktop repost headers
   * Examples:
   * - Repost content on walls/feeds
   * - https://vk.com/wall1034309676_77 (without login)
   */
  {
    id: "desktopPreReactRepost",
    variant: "account",
    appliesTo: "desktopVkWebsite",
    selector: ".copy_post_header",
    markup: {
      data: {
        accountAvatar: ".CopyPost__authorLink img",
        accountIdentifier: {
          selector: ".CopyPost__authorLink",
          attribute: "href",
        },
        accountName: ".copy_post_header_info",
      },
      edits: [{ selector: ":scope > *", style: { position: "relative" } }],
      ui: {
        actionBar: {
          selector: ".copy_post_header_info",
          position: "after",
          style: { marginLeft: "4px" },
        },
        affiliationBadge: {
          selector: ".copy_post_header_info",
          position: "after",
          style: { paddingLeft: "2px" },
        },
        affiliationHighlight: {
          selector: "",
          position: "prepend",
          style: { inset: "0", top: "-4px", bottom: "-4px" },
        },
        regDate: {
          selector: ".copy_post_header_info",
          position: "after",
          style: { marginTop: "2px" },
        },
      },
    },
  },

  /**
   * Desktop search results (people / communities)
   * Examples:
   * - https://vk.com/search?c%5Bsection%5D=people
   */
  {
    id: "desktopAndMobilePeopleList",
    variant: "account",
    appliesTo: "desktopAndMobileVkWebsite",
    selector: "[data-testid='userrichcell']",
    markup: {
      data: {
        accountAvatar: "[data-testid='userrichcell-avatar'] img",
        accountIdentifier: [
          {
            selector: "[data-testid='userrichcell-avatar'] a",
            attribute: "href",
          },
          {
            selector: "a:has([data-testid='userrichcell-name'])",
            attribute: "href",
          },
        ],
        accountName: "[data-testid='userrichcell-name']",
      },
      edits: [
        {
          selector: "[class*='RichCell__children']",
          style: { overflow: "visible" },
        },
      ],
      ui: {
        actionBar: [
          {
            selector: "[class*='vkuiRichCell__extraSubtitle']",
            position: "after",
            style: { top: "3px", marginLeft: "-3px" },
          },
          {
            selector: ".vkuiRichCell__children",
            position: "after",
            style: { top: "3px", marginLeft: "-3px" },
          },
        ],
        affiliationBadge: {
          selector: "[class*='vkitUserRichCell__name']",
          position: "append",
          style: { marginLeft: "3px" },
        },
        affiliationHighlight: {
          selector: "",
          position: "prepend",
          style: { inset: "-2px", left: "-2px", marginRight: "2px" },
        },
        regDate: [
          {
            selector: "[class*='vkuiRichCell__extraSubtitle']",
            position: "after",
          },
          {
            selector: ".vkuiRichCell__children",
            position: "after",
          },
        ],
      },
    },
  },

  /*
   * Examples:
   * - https://m.vk.com/wall-140899168_3954792?reply=3955042 -- TODO: Fix  link or annotate it with instructions (relationship to this insertion is unclear)
   * - https://vk.com/wall-173277106_4892265?reply=4892462&w=reactions-173277106_4892462%3Ftype%3Dcomment
   */
  {
    id: "desktopAndMobileLikeCell",
    variant: "account",
    appliesTo: "desktopAndMobileVkWebsite",
    selector: "[class*='vkitVirtualizedList'] > * > .vkuiSimpleCell__host",
    markup: {
      data: {
        accountAvatar:
          "[data-testid='wall_reactions_modal_reacted_user_avatar'] img",
        accountIdentifier: [
          {
            selector: "",
            attribute: "href",
          },
        ],
        accountName: ".vkuiSimpleCell__content > span",
      },
      edits: [
        {
          selector: ".vkuiSimpleCell__middle",
          style: {
            // Ensure highlight is placed relative to its parent
            position: "relative",
            // Ensure tooltips are not clipped when overflow
            overflow: "visible",
            // Ensure highlight height remains fixed, even when we trigger reg date
            height: "42px",
            padding: "0px",
          },
        },
        {
          // Prevent account name from going under highlight
          selector: ".vkuiSimpleCell__middle > *",
          style: { position: "relative" },
        },
        {
          // Inserting affiliationHighlight makes this element second, so it gets marginTop: 2px - needs cancelling
          selector: ".vkuiSimpleCell__content",
          style: { marginTop: "0px" },
        },
      ],
      ui: {
        actionBar: [
          {
            selector: ":first-child > :scope .vkuiSimpleCell__content",
            position: "append",
            style: { marginLeft: "2px" },
            // Tooltip direction is down for the first element because of overflow:scroll in parent (not ideal because is partially overlapping with the next element's highlight)
            tooltipDirection: "down",
          },
          {
            selector: ":not(:first-child) > :scope .vkuiSimpleCell__content",
            position: "append",
            style: { marginLeft: "2px" },
            // Elements are too close to each other. If tooltip is placed down, it will be partially hidden by the next element's highlight
            tooltipDirection: "up",
          },
        ],
        affiliationBadge: {
          selector: "[data-bn-insertion-ui-element='actionBar']",
          position: "before",
        },
        affiliationHighlight: {
          selector: ".vkuiSimpleCell__middle",
          position: "prepend",
          style: { left: "-5px" },
        },
        regDate: {
          selector: ".vkuiSimpleCell__content",
          position: "after",
          // Ensure reg date does not increase the cell height
          style: { marginTop: "-2px" },
        },
      },
    },
  },

  // - https://m.vk.com/incident22?act=members
  {
    id: "mobileSubCell",
    variant: "account",
    appliesTo: "mobileVkWebsite",
    selector: ".upanel > .inline_item",
    markup: {
      data: {
        accountAvatar: ".Avatar__image",
        accountIdentifier: [
          {
            selector: "",
            attribute: "class",
            valuePattern: "unew(\\d+)",
          },
          {
            selector: "",
            attribute: "href",
          },
        ],
        accountName: {
          selector: ".Avatar__image",
          attribute: "alt",
        },
      },
      edits: [
        {
          selector: "",
          style: { position: "relative" },
        },
      ],
      ui: {
        actionBar: {
          // TODO: inside link - all our buttons buttons open profile
          selector: ".ii_owner",
          position: "append",
          style: { marginLeft: "4px", top: "2px" },
        },
        affiliationBadge: {
          selector: "[data-bn-insertion-ui-element='actionBar']",
          position: "before",
        },
        affiliationHighlight: {
          selector: ".ii_img",
          position: "after",
        },
        regDate: {
          selector: ".ii_body",
          position: "append",
        },
      },
    },
  },

  /**
   * Desktop community post author (expanded text)
   * Examples:
   * - Author links in expanded community post text
   * - https://vk.com/wall-60212615_5184695
   */

  {
    id: "desktopAndMobileCommunityPostAuthor",
    variant: "account",
    appliesTo: "desktopAndMobileVkWebsite",
    selector:
      "[data-testid='post-footer-author'], [class*='vkitShowMoreText__text'] > a[class*='vkitTextClamp__root'], .wi_date[class*='PostHeader__description']",
    markup: {
      data: {
        // No avatar available
        accountAvatar: "",
        accountIdentifier: {
          selector: "",
          attribute: "href",
        },
        accountName: "",
      },
      edits: [
        {
          selector: "",
          style: { position: "relative", zIndex: "0" },
        },
      ],
      ui: {
        // TODO: inside link - buttons not clickable
        actionBar: {
          selector: "",
          position: "append",
          style: {
            marginLeft: "4px",
            marginTop: "-8px",
            top: "4px",
            position: "relative",
          },
        },
        affiliationBadge: {
          selector: "[data-bn-insertion-ui-element='actionBar']",
          position: "before",
          style: { paddingLeft: "2px", position: "relative" },
        },
        affiliationHighlight: {
          selector: "",
          position: "prepend",
          style: { inset: "0", "z-index": "-1" },
        },
        regDate: {
          selector: "",
          position: "append",
          style: { marginTop: "2px", position: "relative" },
        },
      },
    },
  },

  // ---------------------------------------------------------------------------
  // Variant: comment
  // ---------------------------------------------------------------------------

  /**
   * Desktop group activity comments
   * Examples:
   * - Group activity pages
   * - Group discussions/comments
   */
  {
    id: "desktopAdminComment",
    variant: "comment",
    appliesTo: "desktopVkWebsite",
    selector: ".group_activity_reply_wrap",
    markup: {
      data: {
        accountAvatar: ".group_activity_photo_img",
        accountIdentifier: {
          selector: "a.group_activity_content_owner_name",
          attribute: "href",
        },
        accountName: ".group_activity_content_owner_name",
        commentIdentifier: [
          {
            selector: ".group_activity_content_date a[href*='reply=']",
            attribute: "href",
          },
          {
            selector: ".group_activity_content_date [onclick*='showWiki']",
            attribute: "onclick",
          },
        ],

        postCommentCount: false, // Not available for group comments
      },
      edits: [
        {
          selector: ".group_activity_content",
          style: { position: "relative" },
        },
        {
          selector: ".group_activity_content > :not(.like_indicators_wrap)",
          style: { position: "relative" },
        },
      ],
      ui: {
        actionBar: {
          selector: ".ui_actions_menu_wrap",
          position: "after",
          style: {
            marginLeft: "8px",
            marginTop: "-7px",
            position: "relative",
          },
        },
        affiliationBadge: {
          selector: "a.group_activity_content_owner_name",
          position: "after",
          style: { marginLeft: "-5px" },
        },
        affiliationHighlight: {
          selector: ".group_activity_content",
          position: "prepend",
          style: { marginLeft: "-5px" },
        },
        regDate: {
          selector: ".group_activity_content_date",
          position: "append",
          style: { marginTop: "3px" },
        },
      },
    },
  },

  // - https://m.vk.com/video-85596321_456270337?reply=182214
  {
    id: "mobileWindowComment",
    variant: "comment",
    appliesTo: "mobileVkWebsite",
    selector: "[data-testid='comment']",
    markup: {
      data: {
        accountAvatar: "[data-testid='comment-avatar'] > img",
        accountIdentifier: {
          selector: "[data-testid='comment-owner']",
          attribute: "href",
        },
        accountName: "[data-testid='comment-owner'] > span > span",
        commentIdentifier: [
          {
            selector: "",
            attribute: "id",
          },
        ],
        postCommentCount: {
          ancestorSelector: ".vkuiPanelHeader__content",
          selector: "[class*='Comments__counter']",
        },
      },
      edits: [
        {
          selector: "[data-testid='comment-text'] > *",
          style: { position: "relative" },
        },
      ],
      ui: {
        actionBar: {
          selector:
            "[class*='vkitComment__info'] > [class*='vkitLink__link']:last-child",
          position: "after",
          style: {},
        },
        affiliationBadge: {
          selector: "[data-testid='comment-owner']",
          position: "after",
        },
        affiliationHighlight: {
          selector: "[data-testid='comment-text']",
          position: "prepend",
        },
        regDate: {
          selector: "[class*='vkitComment__contentWrapper']",
          position: "before",
        },
      },
    },
  },

  /**
   * Modern desktop comments
   * Examples:
   * - New VK wall post comments (vk.com/ria)
   */
  {
    id: "desktopComment",
    variant: "comment",
    appliesTo: "desktopVkWebsite",
    selector:
      "[data-testid='wall_comments_comment_root'], [data-testid='wall_comments_comment_in_thread']",
    markup: {
      data: {
        accountAvatar: "[data-testid='comment-avatar'] img",
        accountIdentifier: {
          selector: "[data-testid='comment-avatar']",
          attribute: "href",
        },
        accountName: "[data-testid='comment-owner']",
        commentIdentifier: {
          selector: "a[href*='reply=']",
          attribute: "href",
        },
        postCommentCount: {
          ancestorSelector: "[data-testid='post']",
          selector: "[data-testid='post_footer_action_comment']",
          attribute: "aria-label",
        },
      },
      edits: [
        {
          // commentContent = authorLink.nextElementSibling
          selector: "[data-testid='comment-avatar'] + *",
          style: { position: "relative" },
        },
      ],
      ui: {
        actionBar: [
          {
            selector: "[class*='groupLike']",
            position: "after",
            style: { marginTop: "-2px" },
          },
          {
            selector: "[data-testid='comment-share']",
            position: "after",
          },
          {
            selector: "[data-testid='wall_comment_date']",
            position: "after",
          },
        ],
        affiliationBadge: [
          {
            selector: "[data-testid='comment-avatar'] + * a[href^='/']",
            position: "after",
            style: { paddingLeft: "2px", top: "1px" },
          },
          {
            selector: "[data-testid='comment-avatar']",
            position: "after",
            style: { paddingLeft: "2px", top: "1px" },
          },
        ],
        affiliationHighlight: {
          selector: "[data-testid='comment-avatar'] + *",
          position: "prepend",
          style: {
            marginLeft: "4px",
          },
        },
        regDate: {
          selector: "[class*='vkitComment__contentWrapper']",
          position: "before",
          style: { marginTop: "4px" },
        },
      },
    },
  },

  /**
   * Legacy desktop wall groups comments (.reply._post)
   * Examples:
   * - Wall posts with groups comments without login (vk.com/ria)
   */

  // TODO: photo comment too - need to build comment id
  {
    id: "desktopPreReactComment",
    variant: "comment",
    appliesTo: "desktopVkWebsite",
    selector: ".reply",
    markup: {
      data: {
        accountAvatar: [".reply_image img", ".reply_author img"],
        accountIdentifier: {
          selector: ".author",
          attribute: "data-from-id",
        },
        accountName: ".author",
        commentIdentifier: [
          {
            selector: "a[href*='reply=']",
            attribute: "href",
          },
          {
            selector: "a[href*='/wall'], a[href*='/video'], a[href*='/photo']",
            attribute: "href",
          },
          {
            selector: "[onclick*='replyClick']",
            attribute: "onclick",
          },
          {
            selector: "",
            attribute: "data-post-id",
          },
          {
            selector: "",
            attribute: "id",
          },
        ],
        postCommentCount: {
          ancestorSelector: ".reply._post",
          selector: ".PostBottomAction.comment._comment._reply_wrap",
          attribute: "data-count",
        },
      },
      edits: [
        {
          selector: ".reply_content",
          style: { position: "relative" },
        },
        {
          selector: ".reply_content>*",
          style: { position: "relative" },
        },
        {
          // Unconditional background removal (was conditional in legacy)
          selector: "a.wall_reply_more_redesign_2024",
          style: { background: "none", backgroundImage: "none" },
        },
      ],
      ui: {
        actionBar: [
          {
            selector: ".reply_link_wrap.share_link_wrap",
            position: "after",
            style: { marginLeft: "5px", marginTop: "-4px", top: "2px" },
          },
          {
            selector: ".reply_link_wrap",
            position: "after",
            style: { marginLeft: "5px", marginTop: "-4px", top: "2px" },
          },
        ],
        affiliationBadge: [
          {
            selector: ".reply_author .image_status__status",
            position: "after",
            style: { paddingLeft: "2px" },
          },
          {
            selector: ".reply_author .author",
            position: "after",
            style: { paddingLeft: "2px" },
          },
        ],
        affiliationHighlight: {
          selector: ".reply_content",
          position: "prepend",
          style: { inset: "-2px", left: "-6px" },
        },
        regDate: {
          selector: ".reply_author",
          position: "append",
        },
      },
    },
  },

  /**
   * Desktop video comments
   * Examples:
   * - Comments on video pages (vk.com/video*)
   * - https://vk.com/video-85596321_456270337?reply=182214
   */
  {
    id: "desktopVideoComment",
    variant: "comment",
    appliesTo: "desktopVkWebsite",
    selector: "[data-testid='comment']",
    markup: {
      data: {
        accountAvatar: "[data-testid='comment-avatar'] img",
        accountIdentifier: {
          selector: "[data-testid='comment-owner']",
          attribute: "href",
        },
        accountName: "[data-testid='comment-owner']",
        commentIdentifier: {
          selector: "[data-testid='comment']",
          attribute: "id",
        },
        postCommentCount: false,
      },
      edits: [
        {
          selector: "[data-testid='comment-avatar'] + *",
          style: { position: "relative" },
        },
        {
          // Static overflow edit (legacy was dynamic)
          selector: "[data-testid='comment-text']",
          style: { overflow: "visible" },
        },
      ],
      ui: {
        actionBar: [
          {
            selector: "[data-testid='comment-reply']",
            position: "after",
            style: { marginLeft: "-10px" },
          },
          {
            selector: ".vkitCommentLike__like",
            position: "after",
            style: { marginLeft: "-10px" },
          },
        ],
        affiliationBadge: {
          selector: "[data-testid='comment-owner']",
          position: "after",
          style: { paddingLeft: "2px" },
        },
        affiliationHighlight: {
          selector: "[data-testid='comment-avatar'] + *",
          position: "prepend",
          style: {
            inset: "0",
            marginLeft: "2px",
          },
        },
        regDate: {
          selector: "[class*='vkitCommentBase__title']",
          position: "append",
          style: { marginLeft: "4px" },
        },
      },
    },
  },

  /**
   * Legacy mobile comments (without login)
   * Examples:
   * - https://m.vk.com/wall-20169232_9024015
   */
  {
    id: "mobileComment",
    variant: "comment",
    appliesTo: "mobileVkWebsite",
    selector: ".ReplyItem__wrap",
    markup: {
      data: {
        accountAvatar: [".Avatar__content", ".Avatar__image"],
        accountIdentifier: {
          selector: "a.ReplyItem__name",
          attribute: "href",
        },
        accountName: ".ReplyItem__name",
        commentIdentifier: {
          selector: "a[href*='reply=']",
          attribute: "href",
        },
        postCommentCount: false, // Not available in legacy markup
      },
      edits: [
        {
          // Ensures all children are visible and clickable (are not covered by affiliation highlight)
          // Last child is .ReplyItem__like, we keep its style as is or it jumps to a new row
          selector: ".ReplyItem__content>*:not(:last-child)",
          style: { position: "relative" },
        },
      ],
      ui: {
        actionBar: {
          selector: "a.item_date",
          position: "after",
          style: {
            marginLeft: "6px",
            marginTop: "-4px",
            marginBottom: "-4px",
            top: "3px",
          },
        },
        affiliationBadge: [
          {
            selector: ".ImageStatus__status",
            position: "after",
            style: { paddingLeft: "5px" },
          },
          {
            selector: "a.ReplyItem__name",
            position: "after",
            style: { paddingLeft: "5px" },
          },
        ],
        affiliationHighlight: {
          selector: ".ReplyItem__content",
          position: "prepend",
          style: { inset: "-2px", left: "-6px" },
        },
        regDate: {
          selector: ".ReplyItem__header",
          position: "append",
          style: { marginTop: "1px" },
        },
      },
    },
  },

  /**
   * Modern mobile feed comments (with login)
   * Examples:
   * - New mobile VK feed wall post comments (m.vk.com)
   * - https://m.vk.com/wall-20169232_9024015
   */
  {
    id: "mobileCommentNew",
    variant: "comment",
    appliesTo: "mobileVkWebsite",
    selector:
      "[data-testid='wall_comments_comment_root'], [data-testid='wall_comments_comment_in_thread']",
    markup: {
      data: {
        accountAvatar: "[data-testid='comment-avatar'] img",
        accountIdentifier: {
          selector: "[data-testid='comment-avatar']",
          attribute: "href",
        },
        accountName: "[data-testid='comment-owner']",
        commentIdentifier: {
          selector: "a[href*='reply=']",
          attribute: "href",
        },
        postCommentCount: {
          ancestorSelector: "[data-testid='post']",
          selector: "[data-testid='post_footer_action_comment']",
          attribute: "aria-label",
        },
      },
      edits: [
        {
          selector: "[data-testid='comment-avatar'] + *",
          style: { position: "relative" },
        },
      ],
      ui: {
        actionBar: [
          {
            selector: "[data-testid='comment-reply']",
            position: "after",
            style: { marginLeft: "2px" },
          },
          {
            selector: "[data-testid='wall_comment_date']",
            position: "after",
            style: { marginLeft: "4px", top: "2px" },
          },
        ],
        affiliationBadge: {
          selector: "[data-testid='comment-text']",
          position: "before",
          style: { top: "-3px", fontSize: "14px" },
        },
        affiliationHighlight: {
          selector: "[data-testid='comment-avatar'] + *",
          position: "prepend",
          style: { inset: "0", marginLeft: "4px" },
        },
        regDate: {
          selector: "[data-bn-insertion-ui-element='affiliationBadge']",
          position: "after",
          style: { marginTop: "-3px", fontSize: "14px" },
        },
      },
    },
  },

  {
    id: "desktopPreReactMentionProfileTooltip",
    variant: "account",
    appliesTo: "desktopVkWebsite",
    selector: ".mention_tt_wrap",
    markup: {
      data: {
        accountAvatar: ".mention_tt_img img",
        accountIdentifier: {
          selector: ".mention_tt_name",
          attribute: "href",
        },
        accountName: ".mention_tt_name",
      },
      edits: [],
      ui: {
        actionBar: {
          selector: ".mention_tt_title",
          position: "append",
          style: { marginLeft: "4px" },
        },
        affiliationBadge: {
          selector: ".mention_tt_title",
          position: "append",
          style: { paddingLeft: "2px" },
        },
        affiliationHighlight: {
          selector: ".mention_tt_title",
          position: "prepend",
          style: { inset: "-2px", left: "-2px" },
        },
        regDate: {
          selector: ".mention_tt_name",
          position: "after",
          style: { marginLeft: "4px" },
        },
      },
    },
  },

  // ---------------------------------------------------------------------------
  // Variant: reply form
  // ---------------------------------------------------------------------------

  {
    id: "desktopReplyForm",
    variant: "replyForm",
    appliesTo: "desktopVkWebsite",
    selector: "[class*=vkitCommentInput__root]",
    markup: {
      data: {
        accountIdentifier: {
          selector: "",
          reactProp: "GProvider:replyCommentId",
        },
        attachedItemCount: "[data-testid='comment-input-attachments']>*",
        newAttachmentButtonPresence: "[data-testid='show-attach-dropdown']",
      },
      edits: [],
      ui: {
        bnCardAttachmentButton: {
          selector: "[data-testid='show-attach-dropdown']",
          position: "before",
          style: { marginRight: "6px" }, // Instead of 8px, for visual compensation of icon shape
        },
      },
    },
  },

  /**
   * Reply form in pre-React UI, e.g. in popovers with photos
   * Examples:
   * - https://vk.com/ria?z=photo-15755094_459774936
   */
  {
    id: "desktopPreReactReplyForm",
    variant: "replyForm",
    appliesTo: "desktopVkWebsite",
    selector: ".reply_form",
    markup: {
      data: {
        accountIdentifier: {
          selector: "input[type='hidden'][id^='reply_to-']",
          attribute: "value",
          pipe: {
            ancestorSelector: ".pv_narrow_column_cont.wall_module",
            selector: "div[id$='_%'] .reply_image",
            attribute: "href",
          },
        },
        // cspell:ignore medadd_c_linkcon
        attachedItemCount: ".page_preview_photo_wrap,.medadd_c_linkcon",
        newAttachmentButtonPresence:
          ".page_add_media:not([style*='display: none'])",
      },
      edits: [],
      ui: {
        bnCardAttachmentButton: {
          selector: ".page_add_media",
          position: "after",
          style: { marginLeft: "20px", marginTop: "6px" },
        },
      },
    },
  },

  // ---------------------------------------------------------------------------
  // Variant: review
  // ---------------------------------------------------------------------------

  /**
   * Examples:
   * - https://vk.com/reviews-187080127
   */
  {
    id: "desktopReview",
    variant: "review",
    appliesTo: "desktopVkWebsite",
    selector: "[data-testid='review']",
    markup: {
      data: {
        accountAvatar: "[data-testid='review-avatar-link'] img",
        accountIdentifier: {
          selector: "[data-testid='review-avatar-link']",
          attribute: "href",
        },
        accountName: "[data-testid='review-name']",
        reviewIdentifier: {
          selector: "",
          attribute: "id",
        },
      },
      edits: [
        {
          // Ensures parent element of affiliation highlight defines its position
          selector: "a + div + div",
          style: { position: "relative" },
        },
        {
          // Ensures review date is clickable (does not get covered by affiliation highlight)
          selector: "[data-testid='review-status-text']",
          style: { position: "relative" },
        },
      ],
      ui: {
        actionBar: {
          selector: ":scope>div>div:last-child>div:last-child",
          position: "append",
          style: { paddingLeft: "6px", marginTop: "-2px", top: "1px" },
        },
        affiliationBadge: {
          selector: "a:has([data-testid='review-name'])",
          position: "after",
          style: { paddingLeft: "4px" },
        },
        affiliationHighlight: {
          selector: "a + div + div",
          position: "prepend",
          style: { inset: "-2px", left: "-6px" },
        },
        regDate: {
          selector: "[data-testid='showmoretext']",
          position: "before",
          style: { marginTop: "-6px", marginBottom: "4px" },
        },
      },
    },
  },

  /**
   * Examples:
   * - https://m.vk.com/reviews-187080127
   */
  {
    id: "mobileReview",
    variant: "review",
    appliesTo: "mobileVkWebsite",
    selector: "[data-testid='review']",
    markup: {
      data: {
        accountAvatar: "[data-testid='review-avatar-link'] img",
        accountIdentifier: {
          selector: "[data-testid='review-avatar-link']",
          attribute: "href",
        },
        accountName: "[data-testid='review-name']",
        reviewIdentifier: false, // Not available in mobile markup
      },
      edits: [
        {
          // Ensures parent element of affiliation highlight defines its position
          selector: "a + div + div",
          style: { position: "relative" },
        },
        {
          // Ensures review date is clickable (does not get covered by affiliation highlight)
          selector: "[data-testid='review-status-text']",
          style: { position: "relative" },
        },
      ],
      ui: {
        actionBar: {
          selector: ":scope>div>div:last-child>div:last-child",
          position: "append",
          style: { paddingLeft: "2px", marginTop: "-2px", top: "1px" },
        },
        affiliationBadge: {
          selector: "a:has([data-testid='review-name'])",
          position: "after",
          style: { paddingLeft: "4px" },
        },
        affiliationHighlight: {
          selector: "a + div + div",
          position: "prepend",
          style: { inset: "-2px", left: "-6px" },
        },
        regDate: {
          selector: "[data-testid='showmoretext']",
          position: "before",
          style: { marginTop: "-6px", marginBottom: "4px" },
        },
      },
    },
  },
] satisfies Array<z.input<typeof insertionConfigSchema>>;
