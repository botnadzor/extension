import { staticListsService } from "@/lib/proxy-services";

export async function checkIfDataWarmupToastNeeded(): Promise<boolean> {
  const [accountsMetadata, tagsMetadata] = await Promise.all([
    staticListsService.getListMetadata("accounts"),
    staticListsService.getListMetadata("tags"),
  ]);

  return !accountsMetadata.active || !tagsMetadata.active;
}
