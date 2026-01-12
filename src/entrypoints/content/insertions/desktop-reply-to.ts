import type { Insertion } from "../insertion-basics";

const insertion: Insertion = {
  appliesTo: "desktopVkWebsite",
  elementSelector: ".reply_field.submit_post_field",

  init: ({ element, logger }) => {
    logger.info("Found reply to field");

    return () => {
      element.style.backgroundColor = "";
    };
  },
};

export default insertion;
