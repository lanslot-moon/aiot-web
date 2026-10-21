import { cn } from "@/lib/utils";
import { Link, useLocation } from "react-router";
import { useSidebar } from '../../../../../components/ui/sidebar-hooks';
import NavItem from "../nav-items/index";
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { ChildItem, MenuItem } from "../sidebaritems";

interface NavCollapseProps {
  menu: MenuItem[];
  className?: string;
}

export default function NavCollapse({ menu, className }: NavCollapseProps) {
  const { pathname } = useLocation();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const isCollapse = state === "collapsed" && !isMobile;

  const isActiveRoute = (item: ChildItem): boolean => {
    if (item.activePaths?.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return true;
    if (item.url && (pathname === item.url || pathname.startsWith(`${item.url}/`))) return true;
    if (item.items) return item.items.some(isActiveRoute);
    return false;
  };

  return (
    <>

      {menu.map((section, index) => (
        <div key={index}>
          {/* Heading */}


          {section.heading && !isCollapse && <span className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">
            {section.heading}
          </span>}

          {section.items?.map((item: ChildItem, index) => {
            const hasChildren =
              Array.isArray(item.items) && item.items.length > 0;
            const active = isActiveRoute(item);

            // 👉 No children → direct link
            if (!hasChildren)
              return (
                <Tooltip key={index}><TooltipTrigger render={<Link
                  onClick={() => { if (isMobile) setOpenMobile(false); }}
                  aria-label={item.name}
                  aria-current={active ? "page" : undefined}
                  to={item.url || "#"}
                  target={item.external ? "_blank" : undefined}
                />} className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-md transition-all duration-200 ease-in-out focus-visible:outline focus-visible:outline-ring",

                    className,
                  )}

                >

                  <NavItem item={item} hasChildren={false} isActive={active} />
                </TooltipTrigger>{isCollapse && <TooltipContent side="right">{item.name}</TooltipContent>}</Tooltip>




              );

            // 👉 With children → collapsible
            return (
              <details
                key={`${item.name}:${active ? pathname : 'inactive'}`}
                className="group/nav"
                open={active || item.isActive}
              >
                <summary
                  className={cn(
                    "cursor-pointer rounded-md flex items-center transition-all duration-200 ease-in-out focus-visible:outline focus-visible:outline-ring",

                  )}
                >
                  <NavItem
                    item={item}
                    hasChildren={true}
                    className={className}
                    isActive={active}
                  />
                </summary>

                <div className="pl-3  ml-5  border-l border-border">
                  {item.items?.map((sub: ChildItem, index) =>
                    sub.items ? (
                      <NavCollapse
                        key={index}
                        menu={[{ items: [sub] }]}
                        className={className}
                      />
                    ) : (
                      <Link
                        key={index}
                        onClick={() => { if (isMobile) setOpenMobile(false); }}
                        aria-label={sub.name}
                        aria-current={isActiveRoute(sub) ? "page" : undefined}
                        to={sub.url || "#"}
                        target={sub.external ? "_blank" : undefined}
                        className={cn(
                          "block rounded-md transition-all duration-200 ease-in-out",

                          className,
                        )}
                      >
                        <NavItem item={sub} hasChildren={false} className={cn("px-2! py-1! my-1!", pathname === sub.url && "bg-primary/5 text-primary")} isActive={pathname === sub.url} />
                      </Link>
                    )
                  )}
                </div>
              </details>
            );
          })}
        </div >
      ))
      }
    </>
  );
}
