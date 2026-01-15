import { defineInsertion } from "../insertion-basics";

export default defineInsertion({
  appliesTo: "desktopVkWebsite",
  elementSelector: ".reply_field.submit_post_field",

  init: ({ element, logger }) => {
    logger.info("Found reply to field");

    return () => {
      element.style.backgroundColor = "";
    };
  },
});
