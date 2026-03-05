// cspell:ignoreRegExp /selector:.*/
// cspell:ignoreRegExp /valuePattern:.*/

import type { z } from "zod/mini";

import type { insertionConfigSchema } from "@/shared/@model/insertion-configs";

export default [
  // ---------------------------------------------------------------------------
  // Variant: account
  // ---------------------------------------------------------------------------

  /**
   * Desktop followers list avatar tiles
   * Examples:
   * - https://vk.com/ria → followers
   */
  {
    id: "desktopDialogFollowers",
    variant: "account",
    appliesTo: "desktopVkWebsite",
    selector:
      "[class*=MembersListModal__modalContainer] [data-testid=grid-item]",
    markup: {
      data: {
        accountAvatar: {
          selector: ".vkuiAvatar_host>img",
        },
        accountIdentifier: {
          selector: ".vkuiHorizontalCell__content a",
          attribute: "href",
        },
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
   * Examples:
   * - https://vk.com/ria?w=likes%2Fwall-15755094_48295538
   * - https://vk.com/ria?w=likes%2Fwall_reply-15755094_49579807
   */
  {
    id: "desktopDialogReactions",
    variant: "account",
    appliesTo: "desktopVkWebsite",
    selector: ".fans_fan_row",
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
   *
   * CRITICAL ISSUE: Legacy extracts vkDomain from location.pathname, not from
   * a DOM element. The accountIdentifier selector below is an approximation
   * targeting the profile name link. Profile pages may not have a suitable href
   * inside .ProfileHeader__wrapper that matches the expected /username pattern.
   * The insertion system's extractAccountIdentifierFromMarkup only works with
   * DOM-based selectors.
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
          style: { top: "-2px", paddingLeft: "2px" },
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
   *
   * CRITICAL ISSUE: Legacy extracts vkDomain from location.pathname, not from
   * a DOM element. The accountIdentifier selector below is an approximation.
   * See unverifiedDesktopProfileHeader for details.
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
      ],
      ui: {
        // TODO buttons not clickable - profile header is a link/button
        actionBar: {
          selector: ".ProfileInfoName",
          position: "append",
          style: { top: "2px", paddingLeft: "6px", position: "relative" },
        },
        affiliationBadge: {
          selector: "[data-bn-insertion-ui-element='actionBar']",
          position: "before",
          style: { top: "-2px", paddingLeft: "6px", position: "relative" },
        },
        affiliationHighlight: {
          selector: ".ProfileInfoName",
          position: "prepend",
          style: { inset: "0", zIndex: "-1" },
        },
        regDate: {
          selector: ".ProfileInfoName",
          position: "after",
          style: { marginTop: "4px", position: "relative" },
        },
      },
    },
  },

  /**
   * Legacy desktop post header (wall page posts)
   * Examples:
   * - Posts on user/community walls (vk.com/wall-*)
   *
   * ISSUE: Legacy dynamically saves/restores overflow on .PostHeaderTitle.
   * Markup edits set overflow: visible unconditionally, which cannot be
   * reversed to the original value on cleanup (only to what was there before
   * the edit was applied).
   */

  // or without login regular post
  {
    id: "desktopOldPost",
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
          style: { inset: "0" },
        },
        regDate: [
          {
            selector: '[data-testid="post-header-title"]',
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
   *
   * ISSUE: Legacy conditionally removes parent element style and hides
   * authorLink.nextElementSibling (a gradient text hider) only when affiliation
   * exists. Markup edits are unconditional — the hider will be hidden for all
   * accounts, not just bots. This may cause post titles to overflow visually
   * for non-affiliated accounts.
   */
  {
    id: "desktopAndMobilePost",
    variant: "account",
    appliesTo: "desktopAndMobileVkWebsite",
    selector:
      '[data-testid="post"] > .vkuiDiv__host > [class*="vkitPostHeader__container"]',
    markup: {
      data: {
        accountAvatar: '[data-testid="post-header-avatar"] img',
        accountIdentifier: [
          {
            selector: "",
            reactProp: "MeProvider:feedItem/id",
          },
          {
            selector: '[data-testid="post-header-title"][href^="/"]',
            attribute: "href",
          },
        ],
        accountName: '[data-testid="post-header-title"]',
      },
      edits: [
        {
          selector: "",
          style: { position: "relative" },
        },
      ],
      ui: {
        actionBar: [
          {
            selector: "h3",
            position: "append",
            style: { marginLeft: "4px" },
          },
        ],
        affiliationBadge: {
          selector: '[data-testid="post-header-title"]',
          position: "after",
          style: { paddingLeft: "4px" },
        },
        affiliationHighlight: {
          selector: "",
          position: "prepend",
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
   *
   * ISSUE: Legacy conditionally removes parent element style and hides
   * authorLink.nextElementSibling only when affiliation exists. Markup edits
   * are unconditional. See unverifiedDesktopFeedPost for details.
   */
  {
    id: "mobileOldPost",
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
        actionBar: {
          selector: "[data-testid='mobile-wall-post-author'], .pi_author",
          position: "after",
          style: { marginLeft: "4px" },
        },
        affiliationBadge: {
          selector: '[data-testid="mobile-wall-post-author"], .pi_author',
          position: "after",
          style: { paddingLeft: "2px" },
        },
        affiliationHighlight: {
          selector: "",
          position: "prepend",
        },
        regDate: {
          selector: '[data-testid="mobile-wall-post-author"]',
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
   */
  {
    id: "desktopOldRepost",
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
          style: { inset: "0" },
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
   * Mobile repost headers (pic_body_full)
   * Examples:
   * - Repost content on m.vk.com
   */
  {
    id: "unverifiedMobileOldRepost",
    disabled: true,
    variant: "account",
    appliesTo: "mobileVkWebsite",
    selector: ".pic_body_full",
    markup: {
      data: {
        accountAvatar: "a.pi_author img",
        accountIdentifier: {
          selector: "a.pi_author",
          attribute: "href",
        },
        accountName: ".pic_desc_a",
      },
      edits: [],
      ui: {
        actionBar: {
          selector: ".pic_desc_a",
          position: "after",
          style: { marginLeft: "4px" },
        },
        affiliationBadge: {
          selector: ".pic_desc_a",
          position: "after",
          style: { paddingLeft: "2px" },
        },
        affiliationHighlight: {
          selector: ".pic_header",
          position: "prepend",
          style: { inset: "0" },
        },
        regDate: {
          selector: "a.pi_author",
          position: "after",
          style: { marginTop: "2px" },
        },
      },
    },
  },

  /**
   * Mobile page profile posts (.PostHeader__infoWrapper)
   * Examples:
   * - Post headers on m.vk.com user profile pages
   */
  {
    id: "unverifiedMobilePageProfile",
    disabled: true,
    variant: "account",
    appliesTo: "mobileVkWebsite",
    selector: ".PostHeader__infoWrapper",
    markup: {
      data: {
        accountAvatar: [".PostHeader__avatar img", ".PostHeader__image img"],
        accountIdentifier: {
          selector: '[data-testid="mobile-wall-post-author"]',
          attribute: "href",
        },
        accountName: '[data-testid="mobile-wall-post-author"]',
      },
      edits: [],
      ui: {
        actionBar: {
          selector: "a.PostHeaderTime",
          position: "after",
          style: { marginLeft: "4px" },
        },
        affiliationBadge: {
          selector: "a.PostHeaderTime",
          position: "after",
          style: { paddingLeft: "2px" },
        },
        affiliationHighlight: {
          selector: ".PostHeader__info",
          position: "prepend",
          style: { inset: "0" },
        },
        regDate: {
          selector: '[data-testid="mobile-wall-post-author"]',
          position: "after",
          style: { marginTop: "2px" },
        },
      },
    },
  },

  /**
   * Desktop mention tooltip profile header
   * Examples:
   * - Hover tooltips on @username mentions in posts
   *
   * ISSUE: Legacy applies inline affiliation CSS custom properties and extra
   * Tailwind classes directly to .mention_tt_title element for highlighting.
   * The insertion system uses a separate prepended highlight element instead,
   * which will produce a different visual result.
   */
  {
    id: "unverifiedDesktopMentionProfileHeader",
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

  /**
   * Desktop search results (people / communities)
   * Examples:
   * - https://vk.com/search?c%5Bsection%5D=people
   *
   * ISSUE: Legacy creates a custom row div below the name with badge + actions,
   * applies inline affiliation CSS variables on the root element, and manages
   * overflow on RichCell__children. The standard account variant placement
   * approach is simpler but will produce a different visual layout.
   */
  {
    id: "desktopAndMobilePeopleList",
    variant: "account",
    appliesTo: "desktopAndMobileVkWebsite",
    selector: "[data-testid='userrichcell']",
    markup: {
      data: {
        accountAvatar: '[data-testid="userrichcell-avatar"] img',
        accountIdentifier: [
          {
            selector: '[data-testid="userrichcell-avatar"] a',
            attribute: "href",
          },
          {
            selector: "a:has([data-testid='userrichcell-name'])",
            attribute: "href",
          },
        ],
        accountName: '[data-testid="userrichcell-name"]',
      },
      edits: [
        {
          selector: '[class*="RichCell__children"]',
          style: { overflow: "visible" },
        },
      ],
      ui: {
        actionBar: {
          selector: "[class*='vkitUserRichCell__name']",
          position: "after",
          style: { marginLeft: "2px", top: "3px" },
        },
        affiliationBadge: {
          selector: "[data-bn-insertion-ui-element='actionBar']",
          position: "before",
        },
        affiliationHighlight: {
          selector: "",
          position: "prepend",
          style: { inset: "-2px", left: "-2px" },
        },
        regDate: {
          selector: ".vkuiRichCell__children",
          position: "after",
        },
      },
    },
  },

  {
    id: "mobileLikeCell",
    variant: "account",
    appliesTo: "mobileVkWebsite",
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
          selector: ".vkuiSimpleCell__middle > *",
          style: { position: "relative" },
        },
      ],
      ui: {
        actionBar: {
          selector: ".vkuiSimpleCell__content",
          position: "append",
          style: { marginLeft: "2px" },
        },
        affiliationBadge: {
          selector: "[data-bn-insertion-ui-element='actionBar']",
          position: "before",
        },
        affiliationHighlight: {
          selector: ".vkuiSimpleCell__middle",
          position: "prepend",
        },
        regDate: {
          selector: ".vkuiSimpleCell__content",
          position: "after",
        },
      },
    },
  },

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
          // TODO inside link - all our buttons buttons open profile
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
   *
   * ISSUE: Legacy applies affiliation highlight CSS variables and classes
   * directly on the author link element and manages overflow dynamically.
   * The insertion system uses a separate highlight element.
   *
   * ISSUE: accountAvatar is not available in this context — the expanded text
   * area does not contain an avatar image. Extraction will fall back to the
   * default placeholder avatar.
   */

  // TODO need our element to put insertions into it
  {
    id: "desktopCommunityPostAuthor",
    variant: "account",
    appliesTo: "desktopAndMobileVkWebsite",
    selector:
      "[data-testid='post-footer-author'], [class*='vkitShowMoreText__text'] > a[class*='vkitTextClamp__root'], .wi_date[class*='PostHeader__description']",
    markup: {
      data: {
        // No avatar available in expanded text context
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
        // TODO inside link - buttons not clickable
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

  /**
   * Desktop popup comment tooltip
   * Examples:
   * - Hover tooltips showing comment previews (.tt_w.wall_tt.fw_reply_tt)
   *
   * ISSUE: commentIdentifier extraction uses multiple fallback strategies
   * (href with reply=, onclick with replyClick). Current config uses array
   * of selectors - needs verification.
   *
   * NOTE: Legacy does not apply affiliation highlight to popup tooltips,
   * only shows action bar. The affiliationHighlight config is included for
   * completeness but may not be used.
   */
  {
    id: "unverifiedDesktopCommentPopup",
    disabled: true, // no data about owner in popup; popup disappears, need execution pause
    variant: "comment",
    appliesTo: "desktopVkWebsite",
    selector: ".tt_w.wall_tt.fw_reply_tt",
    markup: {
      data: {
        accountAvatar: [".reply_image img", ".reply_author img"],
        accountIdentifier: {
          selector: '.reply_author a.author[href^="/"]',
          attribute: "href",
        },
        accountName: ".reply_author .author",
        commentIdentifier: [
          {
            selector: "a[href*='reply=']",
            attribute: "href",
          },
          {
            selector: "[onclick*='replyClick']",
            attribute: "onclick",
          },
        ],
        postCommentCount: {
          ancestorSelector: ".reply._post",
          selector: ".PostBottomAction.comment._comment._reply_wrap",
          attribute: "data-count",
        },
      },
      edits: [],
      ui: {
        actionBar: {
          selector: ".reply_footer",
          position: "append",
          style: {},
        },
        affiliationBadge: {
          selector: '.reply_author a.author[href^="/"]',
          position: "after",
          style: { paddingLeft: "2px" },
        },
        affiliationHighlight: {
          // Not used in legacy (no affiliation highlight in popups)
          selector: ".content",
          position: "prepend",
          style: { inset: "0" },
        },
        regDate: {
          selector: '.reply_author a.author[href^="/"]',
          position: "after",
          style: { marginLeft: "4px" },
        },
      },
    },
  },

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
   * Modern desktop feed comments
   * Examples:
   * - New VK feed wall post comments (vk.com/feed)
   *
   * ISSUE: Legacy uses dynamic selector for actionBar with multiple fallbacks
   * including closest() for liked elements. Static selector may not match all cases.
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
   * Legacy desktop wall comments (.reply._post)
   * Examples:
   * - Wall posts with comments (vk.com/wall-*)
   *
   * ISSUE: commentIdentifier extraction uses multiple fallback strategies
   * (href with reply=, onclick with replyClick, data-post-id, id attribute).
   * Current config uses array of selectors - needs verification.
   *
   * ISSUE: Legacy conditionally removes background from .wall_reply_more_redesign_2024
   * only when affiliation exists. New markup.edits are unconditional. May cause
   * visual side effects on comments without affiliations.
   */

  // TODO photo comment too - need to build comment id
  {
    id: "desktopOldComment",
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
   *
   * CRITICAL ISSUE: Legacy extracts commentIdentifier by combining window.location.href
   * with element's id attribute (extractVideoCommentLocation function, lines 21-54).
   * Current insertion system doesn't support this cross-scope pattern.
   *
   * The commentIdentifier selector below uses id attribute only, which won't contain
   * wall/post IDs needed for full comment location. This config will likely fail
   * comment collection and inspector functionality.
   *
   * POTENTIAL FIX: Enhance insertion variant to support custom extraction functions,
   * or add support for window.location-based patterns.
   *
   * ISSUE: Legacy dynamically manages overflow property (saves previous value,
   * restores on cleanup). Static markup.edits can't replicate this behavior.
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
   * Legacy mobile comments (.ReplyItem class structure)
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
   * Modern mobile feed comments
   * Examples:
   * - New mobile VK feed wall post comments (m.vk.com)
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
    id: "desktopOldReplyForm",
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
