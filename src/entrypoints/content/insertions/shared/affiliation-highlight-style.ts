import { cnl } from "@/shared/tailwindcss-helpers";

export function applyInlineAffiliationVars(
  target: HTMLElement,
  color: string,
): void {
  target.style.setProperty("--bn-inline-affiliation-color", color);
  target.style.setProperty(
    "--bn-inline-affiliation-border",
    "color-mix(in srgb, var(--bn-inline-affiliation-color) 80%, rgba(250 0 0))",
  );
}

export function clearInlineAffiliationVars(target: HTMLElement): void {
  target.style.removeProperty("--bn-inline-affiliation-color");
  target.style.removeProperty("--bn-inline-affiliation-border");
}

export const inlineAffiliationStripClassListTokens: string[] = cnl(`
  bn:border-l-3 bn:border-l-(--bn-inline-affiliation-border)
  bn:bg-(--bn-inline-affiliation-color)
  bn:dark:border-l-(--bn-inline-affiliation-border)/50
  bn:dark:bg-(--bn-inline-affiliation-color)/20
`);

export const inlineAffiliationOverlayBaseClassListTokens: string[] = cnl(`
  bn:absolute bn:inset-0 bn:-z-10 bn:mt-[-2px] bn:mr-[-2px] bn:mb-[-5px]
  bn:border-l-3 bn:border-l-(--bn-inline-affiliation-border)
  bn:bg-(--bn-inline-affiliation-color) bn:px-[2px] bn:pt-[2px] bn:pb-[5px]
  bn:dark:border-l-(--bn-inline-affiliation-border)/50
  bn:dark:bg-(--bn-inline-affiliation-color)/20
`);

export function applyPagePostAffiliationVars(
  target: HTMLElement,
  color: string,
): void {
  target.style.setProperty("--bn-page-post-affiliation-color", color);
  target.style.setProperty(
    "--bn-page-post-affiliation-border",
    "color-mix(in srgb, var(--bn-page-post-affiliation-color) 80%, rgba(250 0 0))",
  );
}

export function clearPagePostAffiliationVars(target: HTMLElement): void {
  target.style.removeProperty("--bn-page-post-affiliation-color");
  target.style.removeProperty("--bn-page-post-affiliation-border");
}

export const pagePostHeaderHighlightClassListTokens: string[] = cnl(`
  bn:rounded-t-[10px] bn:border-l-3
  bn:border-l-(--bn-page-post-affiliation-border)
  bn:bg-(--bn-page-post-affiliation-color) bn:pt-[10px]! bn:pb-[5px]!
  bn:dark:border-l-(--bn-page-post-affiliation-border)/50
  bn:dark:bg-(--bn-page-post-affiliation-color)/20
`);
