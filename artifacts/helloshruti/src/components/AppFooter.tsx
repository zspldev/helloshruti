import { basePath } from '@/lib/base-path';
import appInfo from '@/config/app-info.json';

// Small, centered footer for the main (landing) screen: app identity/version,
// attribution, and the Zapurzaa Systems logo. Version and release date come
// from app-info.json so they can be bumped without touching this component.
export default function AppFooter() {
  return (
    <div className="flex flex-col items-center gap-1.5 pb-8 pt-4 text-center">
      <p className="text-xs text-muted-foreground">
        Hello Shruti. {appInfo.version} &middot; {appInfo.releaseDate}
      </p>
      <p className="text-xs text-muted-foreground">Created by</p>
      <img
        src={`${basePath}/zapurzaa-logo.png`}
        alt="Zapurzaa Systems"
        className="h-5 w-auto opacity-90"
      />
    </div>
  );
}
