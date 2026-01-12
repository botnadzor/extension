import { useFrontendBaseUrl } from "@/hooks/frontend-service";
import {
  useStaticListItems,
  useStaticListSummary,
} from "@/hooks/static-lists-service";
import { generateUrl } from "@/lib/urls";

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
  name,
  href,
}: {
  color: string | undefined;
  count: number;
  name: string;
  href: string;
}) {
  return (
    <>
      <div className="text-right">{count.toLocaleString("ru-RU")}</div>
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
  const tags = useStaticListItems("tags");
  const frontendBaseUrl = useFrontendBaseUrl();

  const regionTags = tags
    .filter((tag) => tag.type === "region")
    .toSorted((a, b) => a.name.localeCompare(b.name));

  const accountSubcategoryTags = tags
    .filter((tag) => tag.type === "accountSubcategory")
    .toSorted((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="pt-2.5 pr-3 pb-3 pl-1">
      <div className="text-sm">Показано количество обнаруженных аккаунтов</div>

      <div className="grid grid-cols-[5em_1.5em_1fr] text-sm">
        <ListHeader
          href={generateUrl(frontendBaseUrl, "/regions")}
          name="Регионы"
        />

        {regionTags.map((tag) => (
          <ListItem
            key={tag.id}
            color={tag.color}
            count={accountListSummary.itemCountByTagId[tag.id] ?? 0}
            name={tag.name}
            href={generateUrl(frontendBaseUrl, `/region/${tag.id}`)}
          />
        ))}

        <ListHeader name="Подкатегории" />

        {accountSubcategoryTags.map((tag) => (
          <ListItem
            key={tag.id}
            color={tag.color}
            count={accountListSummary.itemCountByTagId[tag.id] ?? 0}
            name={tag.name}
            href={generateUrl(
              frontendBaseUrl,
              `/account-subcategory/${tag.id}`,
            )}
          />
        ))}
      </div>
    </div>
  );
}
