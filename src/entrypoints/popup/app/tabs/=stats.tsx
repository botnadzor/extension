import {
  useFrontendBaseUrl,
  useRemoteNextStaticListSummary,
  useStaticListItems,
  useStaticListSummary,
} from "@/shared/@ui-helpers/data-hooks";
import { generateUrl } from "@/shared/url-helpers";

import { UpdatableCount } from "./helpers";

function ListHeader({
  href,
  name,
}: {
  href?: string | undefined;
  name: string;
}) {
  return (
    <>
      <div />
      <div />
      <div className="pt-3 font-bold">
        {href ? (
          <a
            className="u-link"
            href={href}
            rel="noopener noreferrer"
            target="_blank"
          >
            {name}
          </a>
        ) : (
          name
        )}
      </div>
    </>
  );
}

function ListItem({
  color,
  count,
  href,
  name,
  nextCount,
}: {
  color: string | undefined;
  count: number | undefined;
  href: string;
  name: string;
  nextCount: number | undefined;
}) {
  return (
    <>
      <div className="text-right">
        <UpdatableCount
          className="inline-block"
          count={count}
          nextCount={nextCount}
        />
      </div>

      <div className="flex h-lh items-center justify-center">
        {color && (
          <div
            className="mt-0.5 size-1.75 rounded-full"
            style={{ backgroundColor: color }}
          />
        )}
      </div>
      <div>
        <a
          className="truncate u-link"
          href={href}
          rel="noopener noreferrer"
          target="_blank"
        >
          {name}
        </a>
      </div>
    </>
  );
}

export function StatsTabBody() {
  const accountListSummary = useStaticListSummary("accounts");
  const nextAccountListSummary = useRemoteNextStaticListSummary("accounts");
  const tags = useStaticListItems("tags");
  const frontendBaseUrl = useFrontendBaseUrl();

  const regionTags = tags
    .filter((tag) => tag.type === "region")
    .toSorted((a, b) => a.name.localeCompare(b.name));

  const accountSubcategoryTags = tags
    .filter((tag) => tag.type === "accountSubcategory")
    .toSorted((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="px-3 pt-2.5 pb-3">
      <div className="text-sm">Показано количество обнаруженных аккаунтов</div>

      <div className="grid grid-cols-[5em_1.5em_1fr] text-sm">
        <ListHeader
          href={generateUrl(frontendBaseUrl, "/regions")}
          name="Регионы"
        />

        {regionTags.map((tag) => (
          <ListItem
            color={tag.color}
            count={
              accountListSummary.itemCount > 0
                ? accountListSummary.itemCountByTagId[tag.id]
                : undefined
            }
            href={generateUrl(frontendBaseUrl, `/region/${tag.id}`)}
            key={tag.id}
            name={tag.name}
            nextCount={
              nextAccountListSummary.itemCount > 0
                ? (nextAccountListSummary.itemCountByTagId[tag.id] ?? 0)
                : undefined
            }
          />
        ))}

        <ListHeader name="Подкатегории" />

        {accountSubcategoryTags.map((tag) => (
          <ListItem
            color={tag.color}
            count={
              accountListSummary.itemCount > 0
                ? accountListSummary.itemCountByTagId[tag.id]
                : undefined
            }
            href={generateUrl(
              frontendBaseUrl,
              `/account-subcategory/${tag.id}`,
            )}
            key={tag.id}
            name={tag.name}
            nextCount={
              nextAccountListSummary.itemCount > 0
                ? (nextAccountListSummary.itemCountByTagId[tag.id] ?? 0)
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
